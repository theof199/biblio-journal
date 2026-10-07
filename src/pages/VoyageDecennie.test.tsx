import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { JournalPage } from '../api/journal'
import type { Voyage } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { PAGES_A_VENIR } from '../mondes/avenir/pages'
import type { VueMonument } from '../mondes/types'
import { exemple } from '../test/contrat'
import { contexteFactice } from '../test/contexteFactice'
import { visionnage } from '../test/journal'
import { SESSION, monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { fichePrete, voyage1890 } from '../test/voyage'
import { PAGES_DE_LA_DECENNIE, anneeCivile } from '../voyage/decennie'
import stylesDuRegistre from '../voyage/decennie/Registre.module.css'
import stylesDuTampon from '../voyage/passeport/Tampon.module.css'
import { decennieDe } from '../voyage/regles'

/** Les pages de la décennie que la page offre : les vraies (`null`), ou celles qu'un test pose. */
const entrees = vi.hoisted(() => ({ pages: null as readonly ('billets' | 'recherche')[] | null }))
vi.mock('../voyage/decennie', async (original) => {
  const vrai = await original<{ PAGES_DE_LA_DECENNIE: readonly ('billets' | 'recherche')[] }>()
  return {
    ...vrai,
    get PAGES_DE_LA_DECENNIE() {
      return entrees.pages ?? vrai.PAGES_DE_LA_DECENNIE
    },
  }
})

/**
 * Le registre de la page, doublé pour un seul test : `sansMot` allumé, le monde de 1890 reste ce
 * qu'il est (il n'est pas « à venir ») mais ses mots n'invitent plus à toucher. Le registre le relit
 * à chaque appel, la page tenant le sien pour tout le fichier.
 */
const essai = vi.hoisted(() => ({ sansMot: false }))
vi.mock('../mondes', async (original) => {
  const vrai = await original<typeof import('../mondes')>()
  return {
    ...vrai,
    creerRegistre: () => {
      const registre = vrai.creerRegistre()
      return (d: number) => {
        const monde = registre(d)
        if (!essai.sansMot || d !== 1890) return monde
        const { mots } = monde.pages
        return { ...monde, pages: { ...monde.pages, mots: { ...mots, decennie: { ...mots.decennie, toucher: null } } } }
      }
    },
  }
})

/**
 * 1895 Palme, 1896 Lion, 1897 en cours (deux films, pas encore l'Ours), 1898 verrouillée mais
 * portant déjà l'Ours par des films vus en avance, 1899 verrouillée sans rien : trois années sur
 * cinq portent leur récompense ; il manque 1897 et 1899.
 */
const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme', profondeur: 9 },
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion', profondeur: 6 },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null, profondeur: 2 },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: 'ours', profondeur: 3 },
    { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null, profondeur: 0 },
  ],
  { ia: true, source: null, rattrape_la_source: false, depart: 1895 },
)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const JOURNAL = 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899'
const TICKETS = 'GET /api/me/voyage/tickets'
const MANEGE = 'Le manège des années 1890 : touchez un cheval pour ouvrir son année.'
const PHRASE = 'Il manque une récompense en 1897 et 1899, et le ticket de 1900.'

const ticket = (annee: number, utiliseLe: string | null = null) => ({ annee, motif: 'Un ticket.', emis_le: '2026-09-21T21:00:00.000Z', montre_le: null, utilise_le: utiliseLe })
/** Un visionnage d'un film sorti `an`, avec son affiche. */
const vu = (id: string, an: number, note: number | null = null) => {
  const v = visionnage({ id, media: 'm-' + id, annee: an, date: '2026-09-01', note })
  v.media.cover_url = `https://image.tmdb.org/t/p/w500/${id}.jpg`
  return v
}
const journal = (items: ReturnType<typeof vu>[]) => () => json({ ...PAGE, items, next_cursor: null })
const refus = (message: string) => () => json({ code: 'VALIDATION', message, retryable: false }, 400)

const ROUTES = {
  'GET /api/me/voyage': () => json(VOYAGE),
  [TICKETS]: () => json({ tickets: [ticket(1900)] }),
  [JOURNAL]: journal([]),
}

/**
 * Le manège doublé : quatre figures, 1893 (sans page : avant le départ) d'abord, puis 1898 (derrière),
 * 1897, et 1896 devant 1898, leurs rayons chevauchés ;
 * la toile peint sur un contexte factice (jsdom n'a pas de canvas ; sans rectangle, la toile rend
 * les coordonnées du toucher telles quelles).
 */
function doublerLeManege() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => contexteFactice().ctx as never)
  const dessin = vi.spyOn(PAGES_1890, 'dessinerMonument').mockImplementation((v: VueMonument) => {
    v.zone(1893, 330, 200, 30, true)
    v.zone(1898, 200, 60, 30, false)
    v.zone(1897, 60, 60, 30, true)
    v.zone(1896, 200, 84, 30, true)
  })
  return {
    peint: () => waitFor(() => expect(dessin).toHaveBeenCalled()),
    dernier: () => dessin.mock.calls[dessin.mock.calls.length - 1]![0],
  }
}

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

const decennie = () => screen.findByRole('heading', { level: 1, name: 'Années 1890' })
const registreDeLaPage = () => within(screen.getByRole('region', { name: 'Registre des recettes' }))

describe('la page d’une décennie', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    essai.sansMot = false
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutations : une lecture de la fiche de l'année en cours ajoutée (`GET …/annees/1897`) ;
  // `journalComplet` à la place (`GET /api/me/journal?limit=100`) ; la lecture des tickets retirée.
  it('ne lit que la carte, mes tickets et mes films de la décennie', async () => {
    const { requetes } = monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(await screen.findByText(PHRASE)).toBeInTheDocument()
    await screen.findByRole('list', { name: 'La palissade' })
    expect(requetes.filter((r) => r !== 'GET /api/auth/me').sort()).toEqual(['GET /api/me/voyage', TICKETS, JOURNAL].sort())
  })

  // Mutation : `decennieDeLAdresse` contournée (`Number(param)`).
  it.each(['1895', '1880', 'abc', String(decennieDe(anneeCivile()) + 10)])('ramène à la carte une adresse qui n’est pas une décennie (%s)', async (adresse) => {
    monterVoyage(`/voyage/decennies/${adresse}`, ROUTES)
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^Années/ })).not.toBeInTheDocument()
  })

  // Le jumeau de la règle, dans la page. Mutation : `decennieDeLAdresse(decennie, new Date().getFullYear())`
  // (l'année de l'appareil, réglé sur UTC : encore 2029).
  it('ouvre la décennie neuve dès le 1er janvier à Paris, quel que soit le fuseau de l’appareil', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2029-12-31T23:30:00.000Z'))
    vi.stubEnv('TZ', 'UTC')
    try {
      monterVoyage('/voyage/decennies/2030', { ...ROUTES, 'GET /api/me/journal?limit=100&sortie_min=2030&sortie_max=2039': journal([]) })
      expect(await screen.findByRole('heading', { level: 1, name: 'Années 2030' })).toBeInTheDocument()
    } finally {
      vi.unstubAllEnvs()
      vi.useRealTimers()
    }
  })

  // Mutations : `figureTouchee` contournée par la première figure (1893, sans page) ; le toucher
  // sans ses coordonnées ; l'ouverture branchée sur le premier contact (`onToucher`), qu'un
  // défilement commence aussi : le `pointerdown` seul ne doit rien ouvrir.
  it('ouvre l’année du cheval touché, au toucher achevé seulement', async () => {
    const manege = doublerLeManege()
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(fichePrete({ annee: 1897 })) })
    await decennie()
    await manege.peint()
    const toile = screen.getByRole('img', { name: MANEGE })

    fireEvent.pointerDown(toile, { clientX: 62, clientY: 58 })
    expect(screen.getByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()

    fireEvent.click(toile, { clientX: 62, clientY: 58 })
    expect(await screen.findByRole('region', { name: 'L’année 1897' })).toBeInTheDocument()
  })

  // Le doigt tombe sur 1898 (derrière, à 4 unités) et sur 1896 (devant, à 20) : celui de devant
  // l'emporte (décision du propriétaire du 1er octobre 2026, 2c-3). Mutations : le plan `devant`
  // perdu par la page (`zone` sans lui) ; `figureTouchee` revenue au seul plus proche.
  it('ouvre le cheval de devant quand le doigt tombe aussi sur un cheval de derrière', async () => {
    const manege = doublerLeManege()
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage/annees/1896': () => json(fichePrete({ annee: 1896 })) })
    await decennie()
    await manege.peint()
    fireEvent.click(screen.getByRole('img', { name: MANEGE }), { clientX: 200, clientY: 64 })
    expect(await screen.findByRole('region', { name: 'L’année 1896' })).toBeInTheDocument()
  })

  // Mutations : `bouclee: false` en dur ; `cases: []` (la foire ne se remplirait plus). Une autre
  // décennie que celle de l'année en cours : le test suivant.
  it('donne au manège un cheval par année, les cases de la décennie et le tampon', async () => {
    const manege = doublerLeManege()
    const bouclee: Voyage = { ...VOYAGE, tampons: [{ decennie: 1890, boucle_le: '2026-01-14T10:00:00.000Z' }] }
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(bouclee) })
    await decennie()
    await manege.peint()
    const vue = manege.dernier()
    expect(vue.annees.map((a) => `${a.annee} ${a.etat}`)).toEqual([
      '1890 avant', '1891 avant', '1892 avant', '1893 avant', '1894 avant',
      '1895 palme', '1896 lion', '1897 encours', '1898 avance', '1899 verrou',
    ])
    expect(vue.cases.map((c) => `${c.annee} ${c.etat} ${c.profondeur}`)).toEqual(['1895 palme 9', '1896 lion 6', '1897 encours 2', '1898 verrou 3', '1899 verrou 0'])
    expect(vue.bouclee).toBe(true)
    expect(vue.H).toBe(PAGES_1890.hauteurs.monument)
  })

  // L'API rend toutes les années, du départ à l'année civile : une carte en 1903 porte les années
  // 1890 et 1900. Mutations : le tampon lu sur la décennie de l'année en cours
  // (`tamponDe(v.tampons, decennieDe(v.annee_en_cours))`) ; les cases de toutes les décennies (le
  // filtre retiré) ; les chevaux de la première décennie (`chevaux(v, 1890)`).
  it('lit la décennie de la page, pas celle de l’année en cours ni la première', async () => {
    const manege = doublerLeManege()
    const monument1900 = vi.spyOn(PAGES_A_VENIR, 'dessinerMonument').mockImplementation(() => undefined)
    const en1903 = voyage1890(
      1903,
      [
        ...VOYAGE.annees.map((a) => ({ ...a, statut: 'ouverte' as const, visitee: true, recompense: a.recompense ?? ('ours' as const), profondeur: 3 })),
        { annee: 1900, statut: 'ouverte', visitee: true, recompense: 'lion', profondeur: 4 },
        { annee: 1901, statut: 'ouverte', visitee: true, recompense: 'ours', profondeur: 3 },
        { annee: 1902, statut: 'ouverte', visitee: true, recompense: null, profondeur: 1 },
        { annee: 1903, statut: 'en_cours', visitee: true, recompense: null, profondeur: 1 },
      ],
      { ia: true, source: null, rattrape_la_source: false, depart: 1895, tampons: [{ decennie: 1890, boucle_le: '2026-01-14T10:00:00.000Z' }] },
    )
    const routes = { ...ROUTES, 'GET /api/me/voyage': () => json(en1903), 'GET /api/me/journal?limit=100&sortie_min=1900&sortie_max=1909': journal([]) }

    const quittee = monterVoyage('/voyage/decennies/1890', routes)
    await decennie()
    expect(await screen.findByText('14 janvier 2026')).toBeInTheDocument()
    expect(screen.queryByText('Le tampon se pose ici')).not.toBeInTheDocument()
    await manege.peint()
    expect(manege.dernier().cases.map((c) => c.annee)).toEqual([1895, 1896, 1897, 1898, 1899])
    expect(manege.dernier().bouclee).toBe(true)
    quittee.unmount()

    monterVoyage('/voyage/decennies/1900', routes)
    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1900' })).toBeInTheDocument()
    await waitFor(() => expect(monument1900).toHaveBeenCalled())
    const vue = monument1900.mock.calls[monument1900.mock.calls.length - 1]![0]
    expect(vue.annees.map((a) => a.annee)).toEqual([1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909])
    expect(vue.cases.map((c) => c.annee)).toEqual([1900, 1901, 1902, 1903])
    expect(vue.bouclee).toBe(false)
    expect(await screen.findByText('Le tampon se pose ici')).toBeInTheDocument()
  })

  // L'invitation à toucher est un mot du monde : celui du monde « à venir » n'en a pas, son monument
  // n'ayant rien à toucher. Mutation : le mot rempli dans les pages du monde « à venir ».
  it('une décennie « à venir » nomme son monument sans inviter à toucher', async () => {
    monterVoyage('/voyage/decennies/1900', { ...ROUTES, 'GET /api/me/journal?limit=100&sortie_min=1900&sortie_max=1909': journal([]) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1900' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: `${PAGES_A_VENIR.mots.decennie.annonce} 1900.` })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /touche/i })).not.toBeInTheDocument()
  })

  // La page ne lit que le mot, plus `monde.aVenir` : un monde qui a son chantier et dont le mot est
  // nul ne dit pas la phrase. Mutation : la condition remise sur `monde.aVenir`.
  it('un monde qui n’est pas « à venir » et sans mot n’invite pas à toucher', async () => {
    essai.sansMot = true
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    // Le monde d'essai est bien celui de 1890, pas le monde « à venir » : son nom de rubrique le dit.
    expect(await screen.findByRole('img', { name: 'Le manège des années 1890.' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: MANEGE })).not.toBeInTheDocument()
  })

  // Mutation : la garde `ouvrable` retirée (1893 ouvrirait une page qui n'existe pas au Voyage).
  it('n’ouvre pas une année sans page', async () => {
    const manege = doublerLeManege()
    const { requetes } = monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    await manege.peint()

    fireEvent.click(screen.getByRole('img', { name: MANEGE }), { clientX: 331, clientY: 199 })
    expect(screen.getByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()
    expect(requetes.some((r) => r.includes('/annees/1893'))).toBe(false)
  })

  // Mutations : le toucher oublié (le manège ne s'emballe jamais) ; l'emballement même sur une année
  // qui s'ouvre ; l'emballement au calme.
  it('s’emballe au toucher hors d’une année qui s’ouvre', async () => {
    const manege = doublerLeManege()
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    await manege.peint()
    const toile = screen.getByRole('img', { name: MANEGE })

    fireEvent.pointerDown(toile, { clientX: 62, clientY: 58 })
    await new Promise((fin) => setTimeout(fin, 50))
    expect(manege.dernier().touche).toBe(-9)

    fireEvent.pointerDown(toile, { clientX: 10, clientY: 300 })
    // L'instant de la toile au toucher (jsdom peut dater ses images d'avant l'ouverture : `t` négatif).
    await waitFor(() => expect(manege.dernier().touche).not.toBe(-9))
    expect(manege.dernier().touche).toBeLessThanOrEqual(manege.dernier().t)
  })

  it('ne s’emballe pas au calme', async () => {
    calme()
    const manege = doublerLeManege()
    let lire: (r: Response) => void = () => undefined
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: () => new Promise<Response>((fin) => void (lire = fin)) })
    await decennie()
    await manege.peint()

    fireEvent.pointerDown(screen.getByRole('img', { name: MANEGE }), { clientX: 10, clientY: 300 })
    // Au calme, l'image ne se repeint qu'au rendu : les tickets, servis après le toucher, en provoquent un.
    lire(json({ tickets: [ticket(1900)] }))
    await screen.findByText(PHRASE)
    await waitFor(() => expect(manege.dernier().vivant).toBe(false))
    expect(manege.dernier().touche).toBe(-9)
  })

  // Mutation : la phrase tirée de `profondeur > 0` au lieu de la récompense (1897 compterait, 1898 aussi).
  it('dit ce qui manque au tampon', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(await screen.findByText(PHRASE)).toBeInTheDocument()
    expect(screen.getByText('3 années sur 5')).toBeInTheDocument()
  })

  // Mutation : `ceQuiManque(v.annees, [], d, v.depart)` (les tickets non passés) : la phrase réclame le
  // ticket de 1900 ; le test précédent passe encore sous cette mutation, celui-ci tombe.
  it('ne réclame pas un ticket déjà utilisé', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: () => json({ tickets: [ticket(1900, '2026-09-30T20:00:00.000Z')] }) })
    await decennie()
    expect(await screen.findByText('Il manque une récompense en 1897 et 1899.')).toBeInTheDocument()
    expect(screen.queryByText(/ticket de 1900/)).not.toBeInTheDocument()
  })

  // Mutation : `tickets.data?.tickets ?? []` : la phrase part avant la réponse et réclame le ticket de 1900.
  it('ne dit rien du ticket tant que les tickets ne sont pas lus', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: () => new Promise<Response>(() => undefined) })
    await decennie()
    expect(await screen.findByText('3 années sur 5')).toBeInTheDocument()
    await screen.findByRole('list', { name: 'La palissade' })
    expect(screen.queryByText(/Il manque/)).not.toBeInTheDocument()
  })

  // Mutations : la panne des tickets tue (`?? []` : la phrase réclame le ticket) ; la `Panne` des
  // tickets à la place de toute la page.
  it('une panne des tickets se dit à la place de la phrase, le passeport reste', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [TICKETS]: refus('Les tickets se sont égarés.') })
    await decennie()
    expect(await screen.findByText('Les tickets se sont égarés.')).toBeInTheDocument()
    expect(screen.getByText('3 années sur 5')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: MANEGE })).toBeInTheDocument()
    expect(screen.queryByText(/ticket de 1900/)).not.toBeInTheDocument()
  })

  // Mutations : la phrase montrée même tamponné (`phraseDuPasseport(…, null)`) ; le tampon du livret
  // qui frappe (`frappe` passé) : il se refrapperait à chaque visite d'une décennie bouclée depuis
  // des mois.
  it('montre le tampon et sa date, sans phrase ni frappe, une fois bouclée', async () => {
    const bouclee: Voyage = { ...VOYAGE, tampons: [{ decennie: 1890, boucle_le: '2026-01-14T10:00:00.000Z' }] }
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(bouclee) })
    await decennie()
    const jour = await screen.findByText('14 janvier 2026')
    expect(jour.parentElement).toHaveClass(stylesDuTampon.tampon!)
    expect(jour.parentElement).not.toHaveClass(stylesDuTampon.frappe!)
    expect(screen.queryByText('Le tampon se pose ici')).not.toBeInTheDocument()
    // Les tickets lus, la phrase aurait pu se dire : elle se tait.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/me/voyage/tickets')).toBe(true))
    await new Promise((fin) => setTimeout(fin, 50))
    expect(screen.queryByText(/Il manque/)).not.toBeInTheDocument()
  })

  // Le jumeau : sans tampon, sa place. Mutation : le livret sans `place` (rien ne se montre).
  it('montre la place du tampon tant que la décennie n’est pas bouclée', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(await screen.findByText('Le tampon se pose ici')).toBeInTheDocument()
  })

  // Mutations : `ouvrable` ignoré (chaque ligne un lien, 1890 et 1899 compris) ; « Prochainement »
  // dit aussi d'une année d'avant le départ.
  it('le registre ouvre les années ouvrables, et elles seules', async () => {
    const court = voyage1890(1897, VOYAGE.annees.filter((a) => a.annee <= 1897), { ia: true, depart: 1895 })
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(court) })
    await decennie()
    const registre = registreDeLaPage()
    expect(registre.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/voyage/1895', '/voyage/1896', '/voyage/1897'])
    const lignes = registre.getAllByRole('listitem')
    expect(lignes).toHaveLength(10)
    expect(lignes[0]).toHaveTextContent(/^1890—$/)
    expect(lignes[9]).toHaveTextContent(/^1899Prochainement$/)
  })

  // Mutation : « Prochainement » dit de toute année d'après le départ, même ouvrable
  // (`if (l.annee >= depart)`) : le registre ne compterait plus rien.
  it('le registre compte les films vus de chaque année, en cours et en avance compris', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    const lignes = registreDeLaPage().getAllByRole('listitem')
    expect(lignes[5]).toHaveTextContent(/^18959 vus/)
    expect(lignes[7]).toHaveTextContent(/^18972 vus · en cours/)
    expect(lignes[8]).toHaveTextContent(/^18983 vus en avance/)
    expect(lignes[9]).toHaveTextContent(/^1899—$/)
  })

  // La lectrice (hors IA, option A) : son année en cours que theo n'a pas encore ouverte reste fermée
  // pour elle. Le manège ne la peint pas en cours (le corail), le registre ne la dit pas en cours ni
  // ne la marque comme telle : les mots de la carte. Mutations : `chevaux` sans l'attente ; le texte
  // du registre sans elle ; `enCours` sans sa garde (la ligne marquée « ici »).
  // Décision du propriétaire du 1er octobre 2026 (2c-5, option a) : derrière le voyageur suivi
  // (1898), la ligne de l'année en cours (1897) l'ajoute à son état, aucune autre ; à la même année,
  // rien. Mutations : la phrase sur toutes les lignes (`enCours` ignoré) ; l'état « en cours » remplacé ;
  // `>` changé en `>=`.
  it.each([
    { source: 1898, texte: /^18972 vus · en cours · tu le rattrapes bientôt$/ },
    { source: 1897, texte: /^18972 vus · en cours$/ },
  ])('le registre dit « tu le rattrapes bientôt » sur l’année en cours seule (source en $source)', async ({ source, texte }) => {
    const lectrice: Voyage = { ...VOYAGE, ia: false, source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: source } }
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(lectrice) })
    await decennie()
    const lignes = registreDeLaPage().getAllByRole('listitem')
    expect(lignes[7]).toHaveTextContent(texte)
    expect(lignes.filter((l) => /rattrapes/.test(l.textContent ?? ''))).toHaveLength(source > 1897 ? 1 : 0)
    expect(screen.queryByText(/trop lent/)).toBeNull()
  })

  // Un compte hors IA qui ne suit personne (`source` nul) : rien ne se dit de personne, la ligne ne
  // compte que ses films. Mutation : la phrase sans pseudo (« null est trop lent », ou l'ancien texte).
  it('sans voyageur suivi, le registre ne dit de personne qu’il est trop lent', async () => {
    const seul: Voyage = { ...VOYAGE, ia: false, source: null, annees: VOYAGE.annees.map((a) => (a.annee === 1897 ? { ...a, visitee: false, profondeur: 2 } : a)) }
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(seul) })
    await decennie()
    expect(registreDeLaPage().getAllByRole('listitem')[7]).toHaveTextContent(/^18972 vus$/)
    expect(screen.queryByText(/trop lent|rattrapes/i)).toBeNull()
  })

  // Décision du propriétaire du 1er octobre 2026 (2c-5) : « theo est trop lent », le pseudo du
  // Voyage suivi, à la place de « tu le rattrapes bientôt ». Mutation : l'ancien texte remis.
  it.each([
    { profondeur: 2, texte: /^18972 vus · theo est trop lent$/ },
    { profondeur: 0, texte: /^1897theo est trop lent$/ },
  ])('montre en attente, pas en cours, l’année que le Voyage suivi n’a pas encore ouverte ($profondeur vus)', async ({ profondeur, texte }) => {
    const manege = doublerLeManege()
    const lectrice: Voyage = {
      ...VOYAGE,
      ia: false,
      source: { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1896 },
      annees: VOYAGE.annees.map((a) => (a.annee === 1897 ? { ...a, visitee: false, profondeur } : a)),
    }
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage': () => json(lectrice) })
    await decennie()
    await manege.peint()
    expect(manege.dernier().annees.map((a) => `${a.annee} ${a.etat}`).slice(5)).toEqual(['1895 palme', '1896 lion', '1897 attente', '1898 avance', '1899 verrou'])
    const ligne = registreDeLaPage().getAllByRole('listitem')[7]!
    expect(ligne).toHaveTextContent(texte)
    expect(ligne.querySelector('a')).toHaveAttribute('href', '/voyage/1897')
    expect(ligne.querySelector('a')).not.toHaveClass(stylesDuRegistre.ici!)
  })

  // Le témoin du précédent : au compte IA, l'année en cours est marquée « ici ». Mutation : la classe
  // jamais posée (le test précédent passerait sans rien garder).
  it('marque l’année en cours au registre', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    expect(registreDeLaPage().getAllByRole('listitem')[7]!.querySelector('a')).toHaveClass(stylesDuRegistre.ici!)
  })

  // Mutations : la palissade nourrie d'une liste vide ; la note tue.
  it('colle mes affiches par année et dit ma meilleure note au registre', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [JOURNAL]: journal([vu('a', 1895, 8), vu('b', 1895, 6), vu('c', 1896)]) })
    await decennie()
    const palissade = await screen.findByRole('list', { name: 'La palissade' })
    const panneaux = within(palissade).getAllByRole('listitem')
    expect(panneaux[0]!.querySelectorAll('img')).toHaveLength(2)
    expect(panneaux[0]).toHaveTextContent('+7')
    expect(panneaux[1]!.querySelectorAll('img')).toHaveLength(1)
    expect(panneaux[3]).toHaveTextContent('en avance')
    expect(registreDeLaPage().getAllByRole('listitem')[5]).toHaveTextContent('8/10')
  })

  // Tant que leur route manque, la page ne les offre pas (le test précédent) ; la liste doublée, leurs
  // liens. Mutation : un lien vers la décennie de l'année civile au lieu de celle de la page.
  it('la boîte et le guichet, une fois leur page écrite, sont à un toucher', async () => {
    entrees.pages = ['billets', 'recherche']
    try {
      monterVoyage('/voyage/decennies/1890', ROUTES)
      await decennie()
      expect(screen.getByRole('link', { name: 'La boîte à billets' })).toHaveAttribute('href', '/voyage/decennies/1890/billets')
      expect(screen.getByRole('link', { name: 'Catalogue des vues' })).toHaveAttribute('href', '/voyage/decennies/1890/recherche')
    } finally {
      entrees.pages = null
    }
  })

  // La boîte a sa page (tâche 7) : la page de la décennie l'offre, sans liste doublée. Mutations :
  // `billets` retiré de `PAGES_DE_LA_DECENNIE` ; le lien vers une autre adresse que la boîte.
  it('la boîte à billets est à un toucher, et s’ouvre', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    fireEvent.click(screen.getByRole('link', { name: 'La boîte à billets' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'La boîte à billets' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'La boîte à billets, années 1890' })).toBeInTheDocument()
  })

  // Le guichet a sa page (tâche 9) : la page de la décennie l'offre, sans liste doublée. Mutations :
  // `recherche` retiré de `PAGES_DE_LA_DECENNIE` ; le lien vers une autre adresse que le guichet.
  it('le guichet est à un toucher, et s’ouvre', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, 'GET /api/me/voyage/annees/1895': () => json(fichePrete({ annee: 1895, salles: [] })), 'GET /api/me/voyage/annees/1896': () => json(fichePrete({ annee: 1896, salles: [] })), 'GET /api/me/voyage/annees/1897': () => json(fichePrete({ annee: 1897, salles: [] })) })
    await decennie()
    fireEvent.click(screen.getByRole('link', { name: 'Catalogue des vues' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Catalogue des vues' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Catalogue des vues, années 1890' })).toBeInTheDocument()
  })

  // Un lien sans route tombe sur la route inconnue, qui ramène à l'accueil, hors du Voyage : le
  // joueur qui touche « La boîte à billets » se retrouverait sur son journal. Mutation : la boîte et
  // le guichet offerts avant que leur page n'existe (`PAGES_DE_LA_DECENNIE` qui les nomme sans leur
  // route dans `App.tsx`).
  it('chaque lien de la page mène à une page du Voyage', async () => {
    const page = monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    await screen.findByRole('list', { name: 'La palissade' })
    const liens = within(screen.getByRole('region', { name: 'Années 1890' }))
      .getAllByRole('link')
      .map((l) => l.getAttribute('href')!)
    expect(liens).toEqual(expect.arrayContaining(['/voyage', '/voyage/1895', ...PAGES_DE_LA_DECENNIE.map((p) => `/voyage/decennies/1890/${p}`)]))
    page.unmount()
    for (const lien of liens) {
      const vue = monterVoyage(lien, ROUTES)
      const onglet = () => within(screen.getByRole('navigation', { name: 'Onglets' })).getByRole('link', { name: 'Voyage' })
      await waitFor(() => expect(onglet(), lien).toHaveAttribute('aria-current', 'page'))
      vue.unmount()
    }
  })

  // Mutation : la `Panne` du journal à la place de toute la page.
  it('une panne du journal laisse le manège et le passeport', async () => {
    monterVoyage('/voyage/decennies/1890', { ...ROUTES, [JOURNAL]: refus('Le journal s’est égaré.') })
    await decennie()
    expect(await screen.findByText('Le journal s’est égaré.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: MANEGE })).toBeInTheDocument()
    expect(screen.getByText('3 années sur 5')).toBeInTheDocument()
    expect(await screen.findByText(PHRASE)).toBeInTheDocument()
    expect(registreDeLaPage().getAllByRole('listitem')).toHaveLength(10)
  })

  // Mutation : « Retour à la carte » en simple lien vers `/voyage` : la carte s'empilerait devant
  // l'année quittée, et le geste « retour » du téléphone y ramènerait.
  it('« Retour à la carte » recule dans l’historique quand il y a de quoi', async () => {
    monterVoyage(['/voyage/1897', '/voyage/decennies/1890'], { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(fichePrete({ annee: 1897 })) })
    await decennie()
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    expect(await screen.findByRole('region', { name: 'L’année 1897' })).toBeInTheDocument()
  })

  // Le jumeau : ouverte d'un lien, sans rien de l'app derrière. Mutation : toujours reculer
  // (`navigate(-1)` au lieu de `useRevenir` : rien ne se passerait).
  it('« Retour à la carte » mène à la carte quand rien n’est derrière', async () => {
    monterVoyage('/voyage/decennies/1890', ROUTES)
    await decennie()
    const retour = screen.getByRole('link', { name: 'Retour à la carte' })
    expect(retour).toHaveAttribute('href', '/voyage')
    fireEvent.click(retour)
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })
})
