import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import type { JournalPage } from '../../../api/journal'
import type { Voyage } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import { visionnage } from '../../../test/journal'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { voyage1890 } from '../../../test/voyage'
import { arrets } from '../../../voyage/decennie'
import { PAGES_1890 } from '../../1890/pages'
import { PAGES_1900 } from '../pages'
import { MOTS_DU_PASSEPORT as P, dateDuTampon, libelleDeLaSortie, libelleDeLEntree, placeDuTampon, regleDuTampon } from './frontiere'
import { MOTS_DE_LA_LIGNE as M, compteDuLien, etatDeLArret, heureDeLArret, lieuDeLArret, phraseDeLaLigne } from './ligne'

/**
 * La ligne des années 1900 et son passeport (plan des pages 1900, brief 8) : la page d'une décennie
 * 1900. Elle se monte dans l'app entière, le monde n'y arrive que par le registre ; elle garde ses
 * trois lectures. Les tests de `pages/VoyageDecennie.test.tsx`, montés sur 1890, tiennent le défaut.
 */
/** Les pages de la décennie que la page offre : les vraies (`null`), ou celles qu'un test pose. */
const entrees = vi.hoisted(() => ({ pages: null as readonly ('billets' | 'recherche')[] | null }))
vi.mock('../../../voyage/decennie', async (original) => {
  const vrai = await original<{ PAGES_DE_LA_DECENNIE: readonly ('billets' | 'recherche')[] }>()
  return {
    ...vrai,
    get PAGES_DE_LA_DECENNIE() {
      return entrees.pages ?? vrai.PAGES_DE_LA_DECENNIE
    },
  }
})

const DEPART = 1895
const progression = { essentiels_vus: 2, essentiels_total: 5, salles_completes: 1, salles_autres: 3 }
/**
 * 1900 Lion, 1901 Ours, 1902 passée sans récompense, 1903 en cours (l'Ours, deux essentiels sur
 * cinq), 1904 fermée avec deux films vus en avance, 1905 fermée ; la carte s'arrête là : 1906 à 1909
 * n'ont pas de page.
 */
const ANNEES: Partial<Voyage['annees'][number]>[] = [
  { annee: 1899, statut: 'ouverte', visitee: true, recompense: 'ours', profondeur: 3, progression: null },
  { annee: 1900, statut: 'ouverte', visitee: true, recompense: 'lion', profondeur: 6, progression: null },
  { annee: 1901, statut: 'ouverte', visitee: true, recompense: 'ours', profondeur: 3, progression: null },
  { annee: 1902, statut: 'ouverte', visitee: true, recompense: null, profondeur: 1, progression: null },
  { annee: 1903, statut: 'en_cours', visitee: true, recompense: 'ours', profondeur: 3, progression },
  { annee: 1904, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 2, progression: null },
  { annee: 1905, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0, progression: null },
]
const TAMPON_1890 = { decennie: 1890, boucle_le: '2026-09-11T22:30:00.000Z' }
const VOYAGE = voyage1890(1903, ANNEES, { ia: true, source: null, rattrape_la_source: false, depart: DEPART, tampons: [TAMPON_1890] })
const LEA = { ...exemple<Voyage>('/me/voyage', 'get', 200).source, id: '11111111-1111-4111-8111-111111111111', pseudo: 'Léa', annee_en_cours: 1901 } as NonNullable<Voyage['source']>
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const CARTE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const JOURNAL = 'GET /api/me/journal?limit=100&sortie_min=1900&sortie_max=1909'
const LIGNE = '/voyage/decennies/1900'
const PHRASE = 'Il manque une récompense en 1902, 1904, 1905, 1906, 1907, 1908 et 1909, et le ticket de 1910.'

const ticket = (annee: number, utiliseLe: string | null = null) => ({ annee, motif: 'Un ticket.', emis_le: '2026-09-21T21:00:00.000Z', montre_le: null, utilise_le: utiliseLe })
const vu = (id: string, an: number) => visionnage({ id, media: 'm-' + id, annee: an, date: '2026-09-01', note: null })
const journal = (items: ReturnType<typeof vu>[]) => () => json({ ...PAGE, items, next_cursor: null })
const routes = (v: Voyage = VOYAGE, plus: Record<string, () => Response | Promise<Response>> = {}) => ({ [CARTE]: () => json(v), [TICKETS]: () => json({ tickets: [] }), [JOURNAL]: journal([]), ...plus })

/** Les arrêts tels que la page les montre : « → » pour un lien, « · » sinon, l'année, le lieu, l'état. */
const rangees = async () => {
  const liste = await screen.findByRole('list', { name: M.liste })
  return within(liste)
    .getAllByRole('listitem')
    .map((li) => {
      const [, heure, lieu, etat] = [...li.firstElementChild!.children].map((e) => e.textContent)
      return `${li.firstElementChild!.tagName === 'A' ? '→' : '·'} ${heure} | ${lieu} | ${etat}`
    })
}
const passeport = async () => within(await screen.findByRole('region', { name: `${PAGES_1900.mots.decennie.passeport} · années 1900` }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})
afterEach(() => {
  entrees.pages = null
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('les règles de la ligne', () => {
  const lignes = (v: Voyage = VOYAGE, tickets: { annee: number }[] = []) => arrets(v, [], tickets, 1900)
  const o = { depart: DEPART, tropLent: null, rattrape: false, enAvance: PAGES_1900.mots.fermee.enAvance }

  // Mutations : les minutes sans leur zéro (« 19.4 ») ; le siècle en dur.
  it('dit l’année en heure', () => {
    expect([1900, 1904, 1909, 2012].map(heureDeLArret)).toEqual(['19.00', '19.04', '19.09', '20.12'])
  })

  // Mutations : la récompense tue sur l'année en cours ; le compte dit d'une année bouclée ; « Bouclée »
  // à la place d'une récompense ; « à développer » dit d'une année d'avant le départ.
  it('dit l’état d’un arrêt : la récompense, « Bouclée », le compte de l’année en cours, « à développer »', () => {
    expect(lignes().map((l) => etatDeLArret(l, DEPART, PAGES_1900.mots))).toEqual(['Lion', 'Ours', 'Bouclée', 'Ours · 2 sur 5', 'à développer', 'à développer', 'à développer', 'à développer', 'à développer', 'à développer'])
    // Le ticket de 1904 émis : 1903 est bouclée, et ne compte plus.
    expect(etatDeLArret(lignes(VOYAGE, [{ annee: 1904 }])[3]!, DEPART, PAGES_1900.mots)).toBe('Ours')
    const nue = voyage1890(1903, ANNEES.map((a) => (a.annee === 1903 ? { ...a, recompense: null, progression: null } : a)), { ia: true, source: null, depart: DEPART })
    expect(etatDeLArret(lignes(nue)[3]!, DEPART, PAGES_1900.mots)).toBe('en cours')
    expect(etatDeLArret(lignes(nue, [{ annee: 1904 }])[3]!, DEPART, PAGES_1900.mots)).toBe('Bouclée')
    expect(arrets(VOYAGE, [], [], 1890).slice(0, 5).map((l) => etatDeLArret(l, DEPART, PAGES_1900.mots))).toEqual(['', '', '', '', ''])
  })

  // Mutations : « tu es ici » sur toute année ouverte ; « plaque » dite d'une année vue en avance ; le
  // nombre de films sans son pluriel ; « tu le rattrapes bientôt » hors de l'année en cours.
  it('dit le lieu d’un arrêt et ce qui s’y tient', () => {
    expect(lignes().map((l) => lieuDeLArret(l, o))).toEqual(['Paris, l’Exposition', 'Creil', 'Couville', 'Longueville · tu es ici', 'Allaman · 2 vus en avance', 'Bassersdorf · plaque', 'Brest · plaque', 'Monte-Carlo · plaque', 'Ponteland · plaque', 'Iguerande · plaque'])
    expect(lignes().map((l) => lieuDeLArret(l, { ...o, rattrape: true })).filter((s) => /rattrapes/.test(s))).toEqual(['Longueville · tu es ici · tu le rattrapes bientôt'])
    const une = voyage1890(1903, ANNEES.map((a) => (a.annee === 1904 ? { ...a, profondeur: 1 } : a)), { ia: true, source: null, depart: DEPART })
    expect(lieuDeLArret(lignes(une)[4]!, o)).toBe('Allaman · 1 vu en avance')
    // Hors de 1900, un lieu sans photographie, et rien avant le départ.
    expect(lieuDeLArret(arrets(VOYAGE, [], [], 1890)[2]!, o)).toBe('Gare de 1892')
  })

  // Aucun nombre n'est écrit d'avance. Mutations : « quatre » en dur ; les gares passées comptées sur
  // `ouvrable` ; la gare ouverte dite quand elle est bouclée ; « une gares ».
  it('dit où j’en suis sur la ligne, d’après les arrêts', () => {
    expect(phraseDeLaLigne(lignes())).toBe('Dix gares, de l’Exposition au Kinemacolor. Tu as passé trois gares ; la quatrième gare est ouverte.')
    expect(phraseDeLaLigne(lignes(VOYAGE, [{ annee: 1904 }]))).toBe('Dix gares, de l’Exposition au Kinemacolor. Tu as passé quatre gares.')
    const debut = voyage1890(1900, [{ annee: 1900, statut: 'en_cours', visitee: true, recompense: null, profondeur: 0, progression: null }], { ia: true, source: null, depart: DEPART })
    expect(phraseDeLaLigne(lignes(debut))).toBe('Dix gares, de l’Exposition au Kinemacolor. Tu n’as encore passé aucune gare ; la première gare est ouverte.')
    const seconde = voyage1890(1901, [{ annee: 1900, statut: 'ouverte', visitee: true }, { annee: 1901, statut: 'en_cours', visitee: true }], { ia: true, source: null, depart: DEPART })
    expect(phraseDeLaLigne(lignes(seconde))).toBe('Dix gares, de l’Exposition au Kinemacolor. Tu as passé une gare ; la deuxième gare est ouverte.')
    const avant = voyage1890(1899, [{ annee: 1899, statut: 'en_cours', visitee: true }, { annee: 1900, statut: 'verrouillee', visitee: false }], { ia: true, source: null, depart: DEPART })
    expect(phraseDeLaLigne(lignes(avant))).toBe('Dix gares, de l’Exposition au Kinemacolor. Tu n’as encore passé aucune gare.')
    const tout = voyage1890(1911, Array.from({ length: 10 }, (_, k) => ({ annee: 1900 + k, statut: 'ouverte' as const, visitee: true })), { ia: true, source: null, depart: DEPART })
    expect(phraseDeLaLigne(lignes(tout))).toBe('Dix gares, de l’Exposition au Kinemacolor. Tu as passé les dix gares.')
  })

  // Mutations : « 1 billets » ; « 0 billet » ; un compte dit avant la lecture.
  it('dit le compte du casier, et rien tant qu’il n’est pas lu', () => {
    expect([null, 0, 1, 94].map(compteDuLien)).toEqual(['', 'aucun billet', '1 billet', '94 billets'])
  })

  // Le tampon est daté à Paris, comme celui de la décennie : 22 h 30 UTC le 11 est déjà le 12 à Paris.
  // Mutation : `timeZone` retiré du format (sous Honolulu, le 11).
  it('date un tampon de frontière à Paris, quel que soit le fuseau de l’appareil', () => {
    vi.stubEnv('TZ', 'Pacific/Honolulu')
    expect(dateDuTampon(TAMPON_1890.boucle_le)).toEqual({ jour: '12 SEPT', annee: '2026', libelle: '12 septembre 2026' })
    expect(libelleDeLaSortie(1890, TAMPON_1890.boucle_le)).toBe('Tampon rond : sortie des années 1890, le 12 septembre 2026')
    expect(regleDuTampon(1900)).toMatch(/ticket de 1910/)
  })
})

describe('la ligne des années 1900', () => {
  // Mutations : un des six gabarits retiré de `PAGES_1900` (le manège uni, le fronton de la foire, le
  // registre des recettes, la palissade ou le livret de la foire reviendraient) ; la phrase écrite en dur.
  it('porte l’affiche, le chapitre, le nom du monde et où j’en suis, à la place de la page de la foire', async () => {
    monterVoyage(LIGNE, routes())
    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1900' })).toBeInTheDocument()
    expect(screen.getByText('Le voyage immobile')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('img', { name: M.affiche })).toBeInTheDocument()
    expect(screen.getByText('Chapitre II')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à la carte' })).toBeInTheDocument()
    expect(screen.getByText('Dix gares, de l’Exposition au Kinemacolor. Tu as passé trois gares ; la quatrième gare est ouverte.')).toBeInTheDocument()
    await rangees()
    expect(screen.queryByRole('img', { name: new RegExp(`^${PAGES_1900.mots.decennie.annonce}`) })).toBeNull()
    expect(screen.queryByRole('heading', { name: new RegExp(PAGES_1900.mots.decennie.palissade.titre) })).toBeNull()
    expect(screen.queryByRole('list', { name: 'La palissade' })).toBeNull()
    expect(screen.queryByText('Le tampon se pose ici')).toBeNull()
    // L'ordre de l'écran 1 : l'indicateur, les liens, puis le passeport.
    const noms = [...screen.getByRole('region', { name: 'Années 1900' }).children].slice(2).map((e) => e.getAttribute('aria-label'))
    expect(noms).toEqual([PAGES_1900.mots.decennie.registre, `${M.liens} des années 1900`, `${PAGES_1900.mots.decennie.passeport} · années 1900`])
  })

  // Un arrêt qui a sa page en est le lien, et lui seul : 1906 à 1909, que la carte ne porte pas, ne
  // s'ouvrent pas. Une année fermée a sa page (la plaque à développer) : elle s'ouvre, comme au
  // registre. Mutation : le lien posé sans regarder `ouvrable` (`<Link>` sur tout arrêt).
  it('dix arrêts, chacun à son heure, son lieu et son état, et seuls ceux qui ont leur page s’ouvrent', async () => {
    monterVoyage(LIGNE, routes())
    expect(await rangees()).toEqual([
      '→ 19.001900 | Paris, l’Exposition | Lion',
      '→ 19.011901 | Creil | Ours',
      '→ 19.021902 | Couville | Bouclée',
      '→ 19.031903 | Longueville · tu es ici | Ours · 2 sur 5',
      '→ 19.041904 | Allaman · 2 vus en avance | à développer',
      '→ 19.051905 | Bassersdorf · plaque | à développer',
      '· 19.061906 | Brest · plaque | à développer',
      '· 19.071907 | Monte-Carlo · plaque | à développer',
      '· 19.081908 | Ponteland · plaque | à développer',
      '· 19.091909 | Iguerande · plaque | à développer',
    ])
    const liste = within(screen.getByRole('list', { name: M.liste }))
    expect(liste.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/voyage/1900', '/voyage/1901', '/voyage/1902', '/voyage/1903', '/voyage/1904', '/voyage/1905'])
    // « Tu es ici » se dit aussi à qui ne voit pas le point de laiton.
    expect(liste.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'step').map((a) => a.getAttribute('href'))).toEqual(['/voyage/1903'])
  })

  // Le départ du Voyage tombe au milieu des années 1890 : l'indicateur, prêté à leur page, n'y ouvre
  // aucune année d'avant 1895. Mutation : la même (le lien sans `ouvrable`).
  it('n’ouvre aucune année d’avant le départ du Voyage', async () => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { registre: PAGES_1900.gabarits.registre }
    try {
      monterVoyage('/voyage/decennies/1890', routes(VOYAGE, { 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899': journal([]) }))
      expect(await rangees()).toEqual([
        '· 18.901890 | Gare de 1890 | ',
        '· 18.911891 | Gare de 1891 | ',
        '· 18.921892 | Gare de 1892 | ',
        '· 18.931893 | Gare de 1893 | ',
        '· 18.941894 | Gare de 1894 | ',
        '· 18.951895 | Gare de 1895 · plaque | à développer',
        '· 18.961896 | Gare de 1896 · plaque | à développer',
        '· 18.971897 | Gare de 1897 · plaque | à développer',
        '· 18.981898 | Gare de 1898 · plaque | à développer',
        '→ 18.991899 | Gare de 1899 | Ours',
      ])
    } finally {
      PAGES_1890.gabarits = avant
    }
  })

  // Mutations : dans `voyageurSuivi`, la garde `!v.ia` retirée (« Léa y est » au compte IA) ; dans
  // `lieuDeLArret`, la garde `o.tropLent` retirée (« null » sans Voyage suivi) ; « y est » dit de
  // mon année en cours.
  it('ne dit « Léa y est » ni « Léa est trop lent » qu’à un membre hors IA qui suit un Voyage', async () => {
    // Hors IA : 1903, que Léa n'a pas ouverte, attend ; Léa est en 1901.
    const enAttente = ANNEES.map((a) => (a.annee === 1903 ? { ...a, visitee: false, progression: null } : a))
    const lectrice = monterVoyage(LIGNE, routes(voyage1890(1903, enAttente, { ia: false, source: LEA, rattrape_la_source: false, depart: DEPART })))
    const lus = await rangees()
    expect(lus[1]).toBe('→ 19.011901 | Creil · Léa y est | Ours')
    expect(lus[3]).toBe(`→ 19.031903 | Longueville · Léa est trop lent | ${PAGES_1900.mots.annonce.attente}`)
    lectrice.unmount()
    // Au compte IA, même si la carte portait une source : rien.
    const ia = monterVoyage(LIGNE, routes({ ...VOYAGE, ia: true, source: LEA }))
    expect((await rangees()).join('\n')).not.toMatch(/Léa|trop lent|y est|null/)
    ia.unmount()
    // Sans Voyage suivi, une année en attente ne le dit de personne.
    monterVoyage(LIGNE, routes(voyage1890(1903, enAttente, { ia: false, source: null, rattrape_la_source: false, depart: DEPART })))
    const seuls = await rangees()
    expect(seuls[3]).toBe(`→ 19.031903 | Longueville | ${PAGES_1900.mots.annonce.attente}`)
    expect(seuls.join('\n')).not.toMatch(/Léa|trop lent|y est|null/)
  })

  // Mutations : dans `etatDeLArret`, la garde de l'attente retirée (le compte, « en cours ») ; dans
  // `arrets`, `enCours` sans la garde de l'attente (« tu es ici », `aria-current`).
  it('une année en attente ne se dit jamais en cours : ni « tu es ici », ni son compte', async () => {
    const enAttente = ANNEES.map((a) => (a.annee === 1903 ? { ...a, visitee: false } : a))
    monterVoyage(LIGNE, routes(voyage1890(1903, enAttente, { ia: false, source: LEA, rattrape_la_source: false, depart: DEPART })))
    const lus = await rangees()
    expect(lus[3]).toBe(`→ 19.031903 | Longueville · Léa est trop lent | ${PAGES_1900.mots.annonce.attente}`)
    expect(lus.join('\n')).not.toMatch(/tu es ici|sur 5|en cours/)
    expect(within(screen.getByRole('list', { name: M.liste })).getAllByRole('link').some((a) => a.hasAttribute('aria-current'))).toBe(false)
    expect(screen.getByText(/Tu as passé trois gares\.$/)).toBeInTheDocument()
  })

  // Mutations : une lecture de la fiche de l'année en cours ajoutée par la page ou par un gabarit
  // (`GET …/annees/1903`) ; tout le journal lu à la place de celui de la décennie.
  it('ne lit que la carte, mes tickets et mes films de la décennie : jamais une fiche d’année', async () => {
    const { requetes } = monterVoyage(LIGNE, routes())
    await rangees()
    await (await passeport()).findByText(PHRASE)
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual([CARTE, TICKETS, JOURNAL].sort())
  })

  // Les liens sont ceux que la page passe, et eux seuls. Mutations : dans `LiensDeLaLigne`, les deux
  // pages écrites en dur, ou un lien « Passeport » ajouté comme sur la maquette ; le compte pris
  // ailleurs que chez la page ; « chercher » dit sous le casier.
  it('n’offre que le casier et le guichet que la page passe, le casier avec son compte', async () => {
    let lire: (r: Response) => void = () => undefined
    const liens = async () => within(await screen.findByRole('navigation', { name: `${M.liens} des années 1900` })).getAllByRole('link')
    const tous = monterVoyage(LIGNE, routes(VOYAGE, { [JOURNAL]: () => new Promise<Response>((resolve) => (lire = resolve)) }))
    expect((await liens()).map((a) => `${a.getAttribute('href')} : ${a.textContent}`)).toEqual([`/voyage/decennies/1900/billets : ${PAGES_1900.mots.boite.titre}`, `/voyage/decennies/1900/recherche : ${PAGES_1900.mots.recherche.catalogue} ${M.chercher}`])
    lire(json({ ...PAGE, items: [vu('a', 1901), vu('b', 1903)], next_cursor: null }))
    await waitFor(async () => expect((await liens())[0]!.textContent).toBe(`${PAGES_1900.mots.boite.titre} 2 billets`))
    tous.unmount()
    entrees.pages = ['recherche']
    const guichet = monterVoyage(LIGNE, routes())
    expect((await liens()).map((a) => a.getAttribute('href'))).toEqual(['/voyage/decennies/1900/recherche'])
    guichet.unmount()
    entrees.pages = []
    monterVoyage(LIGNE, routes())
    await rangees()
    expect(screen.queryByRole('navigation', { name: `${M.liens} des années 1900` })).toBeNull()
  })
})

describe('le passeport des années 1900', () => {
  // Mutations : dans `Frontiere`, le tampon de sortie monté sans `sortie` (daté du jour) ; la date lue
  // ailleurs que sur `boucle_le` ; l'entrée montrée sans `entree` ; la photo ou sa légende retirées ;
  // l'image sans texte de remplacement ; `douane` absent du dossier.
  it('porte la sortie des années 1890 datée de son tampon, à Paris, l’entrée en 1900, la place du tampon et la douane', async () => {
    vi.stubEnv('TZ', 'Pacific/Honolulu')
    monterVoyage(LIGNE, routes())
    const p = await passeport()
    expect(p.getByRole('heading', { level: 2, name: 'Années 1900' })).toBeInTheDocument()
    expect(p.getByText(`Spectateur du voyage immobile. ${regleDuTampon(1900)}`)).toBeInTheDocument()
    const sortie = p.getByRole('img', { name: 'Tampon rond : sortie des années 1890, le 12 septembre 2026' })
    expect(sortie.textContent).toBe('SORTIE · ANNÉES 1890 · LES ORIGINES ·12 SEPT2026')
    expect(p.getByRole('img', { name: libelleDeLEntree(1900) }).textContent).toBe('FRONTIÈREENTRÉE EN 1900VISÉ · QUAI DE 1899')
    expect(p.getByText(placeDuTampon(1900))).toBeInTheDocument()
    expect(p.getByText('3 années sur 10')).toBeInTheDocument()
    const photo = p.getByRole('img', { name: P.douane })
    expect(photo.getAttribute('src')).toMatch(/douane/)
    expect(p.getByText(P.legende)).toBeInTheDocument()
    expect(await p.findByText(PHRASE)).toBeInTheDocument()
  })

  // Mutations : `sortieDe` qui daterait du jour faute de tampon ; dans `Frontiere`, le tampon de sortie
  // dessiné sans `sortie` ; l'entrée dessinée avant d'y être (`entree` ignorée).
  it('sans tampon de 1890, aucun tampon de sortie ; avant 1900, aucune entrée', async () => {
    const avant = voyage1890(1899, [{ annee: 1899, statut: 'en_cours', visitee: true, recompense: null, profondeur: 1 }, { annee: 1900, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0, progression: null }], { ia: true, source: null, depart: DEPART })
    monterVoyage(LIGNE, routes(avant))
    const p = await passeport()
    expect(p.getByText(placeDuTampon(1900))).toBeInTheDocument()
    expect(p.queryByRole('img', { name: /^Tampon/ })).toBeNull()
    expect(p.queryByText(/SORTIE|ENTRÉE|\b2026\b/)).toBeNull()
    expect(within(p.getByRole('group', { name: P.tampons })).queryAllByRole('img')).toEqual([])
  })

  // Mutations : dans la page, `tickets.data?.tickets ?? []` passé à `ceQuiManque` (la phrase part avant
  // la réponse et réclame le ticket de 1910 à qui l'a peut-être utilisé) ; dans `Frontiere`, l'attente
  // rendue comme une phrase.
  it('ne réclame aucun ticket tant que les tickets ne sont pas lus', async () => {
    monterVoyage(LIGNE, routes(VOYAGE, { [TICKETS]: () => new Promise<Response>(() => undefined) }))
    const p = await passeport()
    expect(p.getByText('3 années sur 10')).toBeInTheDocument()
    await rangees()
    expect(screen.queryByText(/Il manque/)).toBeNull()
    expect(screen.queryByText(/ticket de 1910 est utilisé/)).toBeInTheDocument()
    expect(screen.queryByText(/le ticket de 1910\./)).toBeNull()
  })

  // Mutations : la panne des tickets tue ; la phrase dite malgré le ticket utilisé.
  it('dit la panne des tickets à la place de la phrase, et ne réclame pas un ticket utilisé', async () => {
    const panne = monterVoyage(LIGNE, routes(VOYAGE, { [TICKETS]: () => json({ code: 'VALIDATION', message: 'Les tickets se sont égarés.', retryable: false }, 400) }))
    expect(await (await passeport()).findByText('Les tickets se sont égarés.')).toBeInTheDocument()
    expect(screen.queryByText(/Il manque/)).toBeNull()
    panne.unmount()
    monterVoyage(LIGNE, routes(VOYAGE, { [TICKETS]: () => json({ tickets: [ticket(1910, '2027-01-02T10:00:00.000Z')] }) }))
    expect(await (await passeport()).findByText('Il manque une récompense en 1902, 1904, 1905, 1906, 1907, 1908 et 1909.')).toBeInTheDocument()
  })

  // Bouclée, la décennie porte le tampon de la carte et de la sacoche, sans place ni phrase.
  // Mutations : la place montrée sous le tampon ; le tampon de 1890 pris pour celui de 1900.
  it('une fois bouclée, montre le tampon de la décennie à sa date, sans sa place ni « Il manque »', async () => {
    monterVoyage(LIGNE, routes({ ...VOYAGE, tampons: [TAMPON_1890, { decennie: 1900, boucle_le: '2027-03-02T10:00:00.000Z' }] }))
    const p = await passeport()
    expect(p.getByText('2 mars 2027')).toBeInTheDocument()
    expect(p.getByText('bouclée')).toBeInTheDocument()
    expect(p.queryByText(placeDuTampon(1900))).toBeNull()
    await rangees()
    expect(screen.queryByText(/Il manque/)).toBeNull()
  })
})
