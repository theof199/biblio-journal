import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { cles } from '../../../api/cles'
import type { FicheEnPreparation, FichePrete } from '../../../api/voyage'
import type { JournalPage } from '../../../api/journal'
import { exemple } from '../../../test/contrat'
import { visionnage } from '../../../test/journal'
import { SESSION, monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { ficheEnAttente, fichePrete, ficheVerrouillee, voyage1890 } from '../../../test/voyage'
import { arriveesDeLAnnee } from '../../../voyage/annee'
import { confierLeRetour } from '../../../voyage/annee/retour'
import { PAGES_A_VENIR } from '../../avenir/pages'
import { PAGES_1900 } from '../pages'
import { heureDeLaGare, libelleDeLaPhoto, mentionDeLaPlaque, rangDeLaGare } from './gare'
import { gainDe, ligneDeLIndicateur, lignesDeLAnnee, phraseDuCompteur, venuesDArriver } from './lignes'

/**
 * Les pages d'une année 1900 (plan des pages 1900, brief 1) : son costume, la tête de la gare dans
 * ses quatre modes, et les corps « fermée » et « en attente ». La page se monte dans l'app entière,
 * comme pour 1890 : le monde n'y arrive que par le registre.
 */
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const VOYAGE = voyage1890(
  1903,
  [
    { annee: 1900, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1901, statut: 'ouverte', visitee: true, recompense: 'ours' },
    { annee: 1902, statut: 'ouverte', visitee: true, recompense: 'palme' },
    { annee: 1903, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1904, statut: 'verrouillee', visitee: false, recompense: null },
    { annee: 1905, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)
// Le Voyage suivi est une année derrière le mien : son année ne se confond pas avec la mienne.
const SUIVI = { ...VOYAGE, ia: false, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1902 } }
const EN_PREPARATION = exemple<FicheEnPreparation>('/me/voyage/annees/{annee}', 'get', 202)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const JOURNAL = (annee: number) => `GET /api/me/journal?limit=100&sortie_min=${annee}&sortie_max=${annee}`
const FICHE = (annee: number) => `GET /api/me/voyage/annees/${annee}`
const nue = (s: Partial<FichePrete>) => fichePrete({ ticket: null, maturite: null, generique: null, ...s })
const journal = (items: ReturnType<typeof visionnage>[]) => () => json({ ...PAGE, items, next_cursor: null })
const vu = (id: string, titre: string, annee: number, note: number | null = null) => visionnage({ id, media: 'm-' + id, titre, annee, date: '2026-09-01', note })
const ROUTES = { 'GET /api/me/voyage': () => json(VOYAGE), 'GET /api/me/voyage/tickets': () => json({ tickets: [] }) }

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('les règles de la gare', () => {
  // Mutations : `annee % 10` pour les minutes (1912 dirait 19 h 02) ; l'heure en dur à 19 ; l'aiguille
  // des heures sans la part des minutes.
  it('l’horloge marque l’année : le siècle pour l’heure, les deux derniers chiffres pour les minutes', () => {
    expect(heureDeLaGare(1903)).toEqual({ heures: 19, minutes: 3, libelle: '19 h 03', angleDesHeures: 211.5, angleDesMinutes: 18 })
    expect(heureDeLaGare(1912).libelle).toBe('19 h 12')
    expect(heureDeLaGare(1900).libelle).toBe('19 h 00')
    expect(heureDeLaGare(2003).libelle).toBe('20 h 03')
  })

  // Mutation : le rang compté depuis un (`annee % 10 - 1`), ou borné à la quatrième.
  it('une gare a son rang sur la ligne, de la première à la dixième', () => {
    expect([1900, 1903, 1909].map(rangDeLaGare)).toEqual(['Première gare', 'Quatrième gare', 'Dixième gare'])
  })

  // Mutation : deux modes échangés dans `mentionDeLaPlaque` ou dans `libelleDeLaPhoto`.
  it('la plaque et la photographie disent l’état de la voie', () => {
    const m = PAGES_1900.mots
    expect((['encours', 'bouclee', 'fermee', 'attente'] as const).map((mode) => mentionDeLaPlaque(mode, 1906, m))).toEqual(['Septième gare', 'Septième gare', 'Plaque à développer', 'Voie fermée'])
    expect(libelleDeLaPhoto('encours', 1906)).toBe('Brest, la gare vers 1900')
    expect(libelleDeLaPhoto('bouclee', 1906)).toBe('Brest, la gare vers 1900')
    expect(libelleDeLaPhoto('fermee', 1906)).toMatch(/^Brest, .*plaque de verre encore négative$/)
    expect(libelleDeLaPhoto('attente', 1906)).toMatch(/^Brest, .*assombrie : la voie n’est pas ouverte$/)
  })
})

describe('le costume de 1900', () => {
  // Les mots des écrans de la maquette, tels que les pages les affichent. Un brief qui en corrige un
  // le corrige ici. Mutation : un mot repris du monde « à venir » (`boniment: 'L’ouverture'`).
  it('parle comme la maquette : la gare, le guide, l’indicateur, les trois classes, le composteur, le casier, le guichet, la courroie', () => {
    const m = PAGES_1900.mots
    expect([m.annonce.bouclee, m.annonce.attente, m.boniment, m.programme.sur, m.programme.titre, m.parade.titre, m.seance.titre, m.seance.sous]).toEqual([
      'Ligne bouclée', 'Voie fermée', 'Guide du voyageur', 'L’indicateur', 'Arrivées', 'Les trois classes', 'Ce soir', 'en gare',
    ])
    expect([m.billet.valider, m.billet.validerSous, m.boite.titre, m.boite.ranger, m.recherche.champ, m.decennie.registre, m.decennie.passeport, m.manivelle.bouton]).toEqual([
      'Composter le billet', 'il part au casier', 'Le casier du contrôleur', 'Ranger au casier', 'Quel film ?', 'L’indicateur de la ligne', 'Passeport du Voyage', 'Tirer la courroie pour mettre l’indicateur à jour',
    ])
    // Le geste qui mène au billet, au guichet de la fiche d'un film (écran 5) : le mot que le composteur du brief 6 reprend.
    expect([m.billet.ouvrir, m.billet.ouvrirSous]).toEqual(['Composter une séance', 'ouvre le composteur'])
    // Aucune rubrique de la fiche d'année ne garde le nom du monde « à venir ».
    const a = PAGES_A_VENIR.mots
    expect([m.boniment, m.programme.sur, m.parade.titre, m.boite.titre, m.recherche.catalogue, m.manivelle.bouton, m.fermee.pancarte, m.intertitre].filter((mot, i) => mot === [a.boniment, a.programme.sur, a.parade.titre, a.boite.titre, a.recherche.catalogue, a.manivelle.bouton, a.fermee.pancarte, a.intertitre][i])).toEqual([])
  })

  // Mutation : `pages: PAGES_A_VENIR` remis au monde 1900 : la rubrique s'appellerait « L’ouverture ».
  it('une année 1900 ouverte ne parle plus comme le monde « à venir »', async () => {
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903 })) })
    const page = await screen.findByRole('region', { name: 'L’année 1903' })
    expect(await within(page).findByRole('region', { name: 'Guide du voyageur' })).toBeInTheDocument()
    expect(within(page).queryByRole('region', { name: PAGES_A_VENIR.mots.boniment })).toBeNull()
    expect(within(page).queryByText(PAGES_A_VENIR.mots.annonce.enCours)).toBeNull()
    expect(page.style.getPropertyValue('--m-email')).toBe('#1d3767')
    expect(page.style.getPropertyValue('--m-f-affiche')).toMatch(/^'Oswald'/)
  })
})

/** Ce qu'un mode de la tête montre, et lui seul : chaque ligne interdit qu'un mode en montre un autre. */
const MARQUES = {
  horloge: () => screen.queryByRole('img', { name: /^L’horloge de la gare marque/ }),
  tampon: () => screen.queryByText('Ligne bouclée'),
  lanterne: () => screen.queryByRole('img', { name: 'La lanterne rouge du laboratoire' }),
  semaphore: () => screen.queryByRole('img', { name: 'Le sémaphore est à l’arrêt' }),
} as const
const montrees = () => (Object.keys(MARQUES) as (keyof typeof MARQUES)[]).filter((cle) => MARQUES[cle]() !== null)

describe('la tête de la gare', () => {
  // Mutations : dans `Tete`, l'horloge montée dans tous les modes ; le tampon posé dès `encours`, ou
  // d'après le seul mode `bouclee` (l'année en cours au ticket émis ne le porterait plus, alors que
  // son indicateur le porte) ; la lanterne posée en attente, ou le sémaphore sur une année fermée ; les
  // deux variantes échangées dans `mentionDeLaPlaque`. Dans la page : `anneeBouclee` sans la garde du
  // mode (une voie qui attend derrière soi serait tamponnée). Le titre : `SousLaTete` ou `VoieFermee`
  // qui remonterait un `Fronton`.
  it.each([
    { mode: 'encours', annee: 1903, voyage: VOYAGE, fiche: () => json(nue({ annee: 1903 })), marques: ['horloge'], mention: 'Quatrième gare', photo: 'Longueville, la gare vers 1900' },
    { mode: 'encours, son ticket émis', annee: 1903, voyage: VOYAGE, fiche: () => json(nue({ annee: 1903, recompense: 'lion', ticket: TICKET(1904) })), marques: ['horloge', 'tampon'], mention: 'Quatrième gare', photo: 'Longueville, la gare vers 1900' },
    { mode: 'attente, derrière soi', annee: 1902, voyage: SUIVI, fiche: () => json(ficheEnAttente(1902)), marques: ['semaphore'], mention: 'Voie fermée', photo: 'Couville, la gare vers 1900, assombrie : la voie n’est pas ouverte' },
    { mode: 'bouclee', annee: 1902, voyage: VOYAGE, fiche: () => json(nue({ annee: 1902, recompense: 'palme' })), marques: ['horloge', 'tampon'], mention: 'Troisième gare', photo: 'Couville, la gare vers 1900' },
    { mode: 'fermee', annee: 1904, voyage: VOYAGE, fiche: () => json(ficheVerrouillee(1904)), marques: ['lanterne'], mention: 'Plaque à développer', photo: 'Allaman, la gare vers 1900, sur une plaque de verre encore négative' },
    { mode: 'attente', annee: 1904, voyage: SUIVI, fiche: () => json(ficheEnAttente(1904)), marques: ['semaphore'], mention: 'Voie fermée', photo: 'Allaman, la gare vers 1900, assombrie : la voie n’est pas ouverte' },
  ])('en mode $mode : sa plaque, sa photographie, ses seules marques, et un seul titre', async ({ annee, voyage, fiche, marques, mention, photo }) => {
    monterVoyage(`/voyage/${annee}`, { ...ROUTES, 'GET /api/me/voyage': () => json(voyage), [FICHE(annee)]: fiche, [JOURNAL(annee)]: journal([]) })
    expect(await screen.findByRole('img', { name: photo })).toBeInTheDocument()
    // Le mode vient de la fiche, sinon de la carte : il se pose quand les deux sont lues.
    await waitFor(() => expect(montrees()).toEqual(marques))
    expect(screen.getByText(mention)).toBeInTheDocument()
    // Le fronton n'est pas répété : l'année ne s'écrit qu'une fois en titre, sur la plaque, et la
    // ligne du monde que le fronton par défaut porte n'est nulle part.
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([String(annee)])
    expect(screen.queryByText('Le voyage immobile · le train')).toBeNull()
    // Ni la toile du bandeau par défaut, ni les mots du monde « à venir ».
    expect(screen.queryByRole('img', { name: `Le décor de ${annee}.` })).toBeNull()
    expect(screen.queryByText(PAGES_A_VENIR.mots.annonce.fermee)).toBeNull()
    expect(screen.queryByText(PAGES_A_VENIR.mots.annonce.attente)).toBeNull()
    // Ce qui reste à la page, par-dessus la tête.
    expect(screen.getByRole('link', { name: 'Retour à la carte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chapitre II' })).toHaveAttribute('href', '/voyage/decennies/1900')
  })

  // L'horloge dit l'heure de son année, pas celle d'une autre gare. Mutation : l'année en dur (1903).
  it('l’horloge de 1902 marque 19 h 02, et la fiche le dit sous la tête', async () => {
    monterVoyage('/voyage/1902', { ...ROUTES, [FICHE(1902)]: () => json(nue({ annee: 1902, recompense: 'palme' })) })
    expect(await screen.findByRole('img', { name: 'L’horloge de la gare marque 19 h 02' })).toBeInTheDocument()
    expect(await screen.findByText('L’horloge marque 19 h 02 : l’année est l’heure de la gare.')).toBeInTheDocument()
  })

  // Une année bouclée ne porte que deux marques, la même partout : le tampon de la tête et celui de
  // l'indicateur, qui nomme la récompense. Le ruban que la page accroche au fronton par défaut ne se
  // montre pas ici. Mutation : `children` rendu de nouveau par `SousLaTete`.
  it('une année bouclée ne porte pas le ruban du fronton par défaut : la tête et l’indicateur le disent', async () => {
    monterVoyage('/voyage/1902', { ...ROUTES, [FICHE(1902)]: () => json(nue({ annee: 1902, recompense: 'palme' })) })
    expect(await screen.findByText('Ligne bouclée · Palme')).toBeInTheDocument()
    expect(MARQUES.tampon()).not.toBeNull()
    expect(screen.queryByText(/^Bouclée/)).toBeNull()
  })

  // La tête est là avant la fiche, et sur une année qui s'écrit : même titre, même horloge.
  // Mutation : `SousLaTete` retiré des gabarits (le fronton par défaut répéterait l'année en titre).
  it('une année en préparation garde sa tête, un seul titre, et l’estrade du chroniqueur', async () => {
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(EN_PREPARATION, 202) })
    expect(await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['1903'])
    expect(montrees()).toEqual(['horloge'])
    expect(screen.getByRole('img', { name: 'Le chroniqueur sur son estrade.' })).toBeInTheDocument()
  })

  // Au calme, rien ne bouge : la feuille n'anime que sous `data-vivante='oui'`. Mutations : `calme`
  // ignoré dans `Tete` ; `calme` que la page ne passerait plus à la tête.
  it.each([
    ['l’horloge', 1903, VOYAGE, () => json(nue({ annee: 1903 })), /^L’horloge de la gare marque/],
    ['le sémaphore', 1904, SUIVI, () => json(ficheEnAttente(1904)), /^Le sémaphore/],
    ['la lanterne', 1904, VOYAGE, () => json(ficheVerrouillee(1904)), /^La lanterne/],
  ] as const)('au calme, %s ne bouge pas ; sinon elle vit', async (_quoi, annee, voyage, fiche, nom) => {
    const routes = { ...ROUTES, 'GET /api/me/voyage': () => json(voyage), [FICHE(annee)]: fiche, [JOURNAL(annee)]: journal([]) }
    const vivante = monterVoyage(`/voyage/${annee}`, routes)
    expect((await screen.findByRole('img', { name: nom })).closest('[data-vivante]')).toHaveAttribute('data-vivante', 'oui')
    vivante.unmount()
    calme()
    monterVoyage(`/voyage/${annee}`, routes)
    expect((await screen.findByRole('img', { name: nom })).closest('[data-vivante]')).toHaveAttribute('data-vivante', 'non')
  })
})

describe('une année 1900 fermée', () => {
  // Tout ce que le corps par défaut offre (`AnneeFermee`) reste offert. Mutations, dans `VoieFermee` :
  // la liste des films vus en avance retirée ; le chemin retiré ; `phraseDuChemin` retirée ; le lien
  // d'un film sans son adresse ; l'intertitre retiré ; `vusEnAvance` sans son filtre d'année.
  it('garde ce que le défaut offre : le compte, le ticket, le chemin, mes films de l’année et leur lien, l’intertitre', async () => {
    const { requetes } = monterVoyage('/voyage/1905', {
      ...ROUTES,
      [FICHE(1905)]: () => json(ficheVerrouillee(1905, { profondeur: 1 })),
      [JOURNAL(1905)]: journal([vu('e2', 'Un film de 1904', 1904), vu('e1', 'Un film de 1905', 1905, 8)]),
    })
    expect(await screen.findByText('Encore 2 tickets, un par année, depuis 1903.')).toBeInTheDocument()
    expect(screen.getByText(/cette année s’ouvre avec le ticket de 1904/)).toBeInTheDocument()
    expect(screen.getByText('Une plaque de verre')).toBeInTheDocument()
    const route = screen.getByRole('list', { name: 'Chemin : 1903, tu es ici, puis 1904, puis 1905, fermée' })
    expect([...route.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['1903ici', '1904', '1905fermée'])
    expect(within(screen.getByRole('list', { name: 'Tes films vus en avance' })).getByRole('listitem', { name: '1 film vu en avance' })).toBeInTheDocument()
    const vus = await screen.findByRole('region', { name: 'Déjà vus en avance' })
    expect(within(vus).getByRole('link', { name: /Un film de 1905.*vu · 8\/10/ })).toHaveAttribute('href', '/journal/e1')
    expect(screen.queryByText(/Un film de 1904/)).toBeNull()
    expect(screen.getByText(/Au bout des années 1900, le tampon « Spectateur du voyage immobile »\./)).toBeInTheDocument()
    // Le gabarit ne lit rien : la page garde ses lectures, et n'en ajoute aucune.
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([JOURNAL(1905)])
    expect(requetes.filter((r) => r.startsWith('GET /api/me/voyage/annees/'))).toEqual([FICHE(1905)])
    // Décision 8 du plan (recommandation suivie) : le ticket ne s'utilise pas depuis une année fermée.
    expect(screen.queryByRole('button', { name: /ticket/i })).toBeNull()
    // Ni parade (l'API la rend vide), ni banderole, ni mots du défaut.
    expect(screen.queryByRole('region', { name: 'Les trois classes, ton podium' })).toBeNull()
    expect(screen.queryByText(/est trop lent/)).toBeNull()
    expect(screen.queryByText(PAGES_A_VENIR.mots.fermee.pancarte)).toBeNull()
  })

  // Mutation : la panne du journal tue dans `VoieFermee`.
  it('dit une panne du journal, sans perdre l’année fermée', async () => {
    monterVoyage('/voyage/1904', {
      ...ROUTES,
      [FICHE(1904)]: () => json(ficheVerrouillee(1904)),
      [JOURNAL(1904)]: () => json({ code: 'VALIDATION', message: 'Le journal ne se lit pas.', retryable: false }, 400),
    })
    expect(await screen.findByText('Le journal ne se lit pas.')).toBeInTheDocument()
    expect(screen.getByText('Encore un ticket : le Lion de 1903, ou plus tôt si le jury le décide.')).toBeInTheDocument()
  })

  // « X est trop lent » ne se dit que d'une voie qui attend. Mutations : `attente &&` retiré de la
  // banderole ; `rattrape` passé nul à `phraseDuChemin`.
  it('au membre qui rattrape, nomme le Voyage suivi dans la phrase, sans banderole', async () => {
    monterVoyage('/voyage/1904', {
      ...ROUTES,
      'GET /api/me/voyage': () => json({ ...SUIVI, rattrape_la_source: true }),
      [FICHE(1904)]: () => json(ficheVerrouillee(1904)),
      [JOURNAL(1904)]: journal([]),
    })
    expect(await screen.findByText('Encore un ticket : le Lion de 1903, ou dès que theo y arrive.')).toBeInTheDocument()
    expect(screen.queryByText(/est trop lent/)).toBeNull()
  })
})

describe('une année 1900 en attente', () => {
  // Mutations, dans `VoieFermee` : la banderole retirée ; le pseudo ou l'année pris ailleurs que dans
  // `source` ; `{parade}` retiré ; la liste des films vus retirée de cette variante ; les deux
  // variantes échangées (la cuve et le chemin se montreraient ici).
  it('garde ce que le défaut offre : la banderole, où en est le Voyage suivi, mes films, et la parade', async () => {
    monterVoyage('/voyage/1904', {
      ...ROUTES,
      'GET /api/me/voyage': () => json(SUIVI),
      [FICHE(1904)]: () => json(ficheEnAttente(1904, { profondeur: 2 })),
      [JOURNAL(1904)]: journal([vu('e1', 'Un film de 1904', 1904)]),
    })
    expect(await screen.findByText('theo est trop lent')).toBeInTheDocument()
    const attendant = screen.getByRole('region', { name: 'En attendant' })
    expect(attendant).toHaveTextContent('theo n’a pas encore ouvert 1904 : son train est encore en gare de 1902.')
    expect(within(attendant).getByRole('heading', { level: 2, name: 'En attendant' })).toBeInTheDocument()
    expect(within(attendant).getByText('Ton podium se pose dès maintenant.')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '2 films vus en avance' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Un film de 1904/ })).toHaveAttribute('href', '/journal/e1')
    expect(screen.getByRole('region', { name: 'Les trois classes, ton podium' })).toBeInTheDocument()
    // Ni la cuve ni le chemin d'une année fermée.
    expect(screen.queryByText('Une plaque de verre')).toBeNull()
    expect(screen.queryByRole('list', { name: /^Chemin/ })).toBeNull()
  })

  // « X est trop lent » ne se dit ni au compte IA ni sans Voyage suivi. Mutation : le garde retiré
  // (`lent` remplacé par un texte bâti sans `tropLent`).
  it('sans Voyage suivi, ne dit de personne qu’il est trop lent', async () => {
    monterVoyage('/voyage/1904', { ...ROUTES, [FICHE(1904)]: () => json(ficheEnAttente(1904)), [JOURNAL(1904)]: journal([]) })
    const attendant = await screen.findByRole('region', { name: 'En attendant' })
    expect(attendant).toHaveTextContent('Le Voyage que tu suis n’a pas encore ouvert 1904.')
    await waitFor(() => expect(screen.getByRole('listitem', { name: '0 film vu en avance' })).toBeInTheDocument())
    expect(screen.queryByText(/trop lent/)).toBeNull()
  })
})

/**
 * Brief 2 : le corps d'une année ouverte. Le compteur des arrivées tient la place de la corde, le
 * guide celle du boniment, l'indicateur celle du programme, la courroie celle de la manivelle dessinée.
 */
const P = (vus: number, total: number, completes: number) => ({ essentiels_vus: vus, essentiels_total: total, salles_completes: completes, salles_autres: 3 })
const TICKET = (annee: number, utiliseLe: string | null = null) => ({ annee, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: utiliseLe })
/** Les lignes de l'indicateur, telles qu'elles se lisent : une chaîne par ligne, ses cellules séparées. */
const lignes = () => within(screen.getByRole('region', { name: 'L’indicateur' })).getAllByRole('row').map((r) => [...r.children].map((c) => [...c.childNodes].map((n) => n.textContent).join(' — ')).join(' | '))
const pointees = () => within(screen.getByRole('region', { name: 'L’indicateur' })).getAllByRole('row').filter((r) => r.getAttribute('data-pointee') === 'oui').map((r) => r.children[0]!.textContent)
const compteur = () => screen.getByText(/^arrivées? sur \d/).parentElement!
const plus = () => [...compteur().querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent).filter((t) => t?.startsWith('+'))

describe('les règles de l’indicateur', () => {
  const mots = (...a: Parameters<typeof arriveesDeLAnnee>) => arriveesDeLAnnee(...a).map((l) => ligneDeLIndicateur(l, 1903, true)).map((l) => `${l.nom} | ${l.libelle} | ${l.etat}`)

  // Mutations : « arrivé » et « attendu » échangés ; le compte d'une ligne attendue sans son total ;
  // le Lion arrivé qui redirait son compte (faussé par les introuvables) ; l'année du ticket en dur.
  it('une ligne dit ce qu’elle fait gagner, ce qu’elle compte, et si elle est arrivée', () => {
    expect(mots(2, P(2, 5, 1), null, null)).toEqual(['Ours | 3 films de 1903 | attendu · 2 sur 3', 'Lion | Tous les essentiels | attendu · 2 sur 5', 'Palme | 2 salles complètes | attendu · 1 sur 2', 'Ticket | Le ticket pour 1904 | attendu'])
    expect(mots(15, P(3, 5, 2), 'palme', TICKET(1904))).toEqual(['Ours | 3 films de 1903 | arrivé · 15', 'Lion | Tous les essentiels | arrivé', 'Palme | 2 salles complètes | arrivé · 2', 'Ticket | Le ticket pour 1904 | arrivé'])
  })

  // Une récompense plus haute fait arriver l'Ours sous son palier (un Lion tenu par des introuvables,
  // deux films vus) : la ligne ne redit pas un compte qui la contredit, comme le Lion. Mutation : le
  // compte gardé sur l'Ours arrivé (« arrivé · 2 » sous « 3 films »).
  it('l’Ours arrivé par la récompense, sous son palier, ne redit pas son compte', () => {
    expect(mots(2, P(1, 3, 0), 'lion', null)[0]).toBe('Ours | 3 films de 1903 | arrivé')
    expect(mots(3, P(1, 3, 0), 'lion', null)[0]).toBe('Ours | 3 films de 1903 | arrivé · 3')
  })

  // Deux salles complètes sans le Lion ne font pas la Palme : la ligne reste attendue et dit ce qui
  // lui manque, seulement alors. Mutations : la note retirée (« attendu · 2 sur 2 », sans raison) ; la
  // note posée sous le palier, ou gardée sur la Palme arrivée.
  it('des salles complètes sans le Lion attendent la Palme, et la ligne dit qu’il la faut', () => {
    const palme = (...a: Parameters<typeof arriveesDeLAnnee>) => ligneDeLIndicateur(arriveesDeLAnnee(...a)[2]!, 1903, true)
    expect(palme(4, P(2, 5, 2), 'ours', null)).toEqual({ nom: 'Palme', libelle: '2 salles complètes', note: 'avec le Lion', etat: 'attendu · 2 sur 2' })
    expect([palme(4, P(2, 5, 1), 'ours', null).note, palme(9, P(5, 5, 2), 'palme', null).note]).toEqual([null, null])
  })

  // Une année derrière soi sans ticket (ouverte par le rattrapage du Voyage suivi) ne le promet plus :
  // jumeau de `ligneDuBas`. L'année en cours garde sa ligne attendue, une année bouclée par son ticket
  // sa ligne arrivée. Mutations : le filtre retiré de `lignesDeLAnnee` ; `bouclee` ignoré (l'année en
  // cours perdrait sa promesse) ; `!a.arrivee` retiré (le ticket arrivé disparaîtrait).
  it('une année bouclée sans ticket ne montre pas la ligne du ticket, et ne la compte pas', () => {
    const cles = (ticket: ReturnType<typeof TICKET> | null, bouclee: boolean) => lignesDeLAnnee(arriveesDeLAnnee(4, P(2, 5, 1), 'ours', ticket), bouclee).map((a) => a.cle)
    expect(cles(null, true)).toEqual(['films', 'essentiels', 'salles'])
    expect(cles(null, false)).toEqual(['films', 'essentiels', 'salles', 'ticket'])
    expect(cles(TICKET(1902), true)).toEqual(['films', 'essentiels', 'salles', 'ticket'])
    expect(phraseDuCompteur(arriveesDeLAnnee(4, P(2, 5, 1), 'ours', null), true)).toBe('arrivée sur 3 : la ligne est bouclée.')
  })

  // Mutation : la branche `a.total === null` retirée de `ligneDeLIndicateur`.
  it('une année sans essentiel le dit, sans compte', () => {
    expect(mots(2, P(0, 0, 0), null, null)[1]).toBe('Lion | Aucun essentiel encore | attendu')
  })

  // Mutations : `ia` ignoré (le jury promis à tous) ; la note gardée sur un ticket arrivé.
  it('le ticket attendu dit d’où il viendra, et ne promet le jury qu’au compte IA', () => {
    const ticket = (ia: boolean, t: ReturnType<typeof TICKET> | null) => ligneDeLIndicateur(arriveesDeLAnnee(2, P(2, 5, 1), null, t)[3]!, 1903, ia).note
    expect([ticket(true, null), ticket(false, null), ticket(true, TICKET(1904))]).toEqual(['au Lion, ou plus tôt si le jury le décide', 'au Lion', null])
  })

  // Mutations : la garde `g.apres === a.valeur` retirée (un gain dépassé pointerait encore) ; un gain
  // lu sur la ligne d'une autre clé.
  it('un gain ne pointe que sa ligne, et pour la valeur qu’il annonce', () => {
    const [films, essentiels] = arriveesDeLAnnee(3, P(2, 5, 1), null, null)
    const gain = { cle: 'films' as const, avant: 2, apres: 3 }
    expect([gainDe(films!, [gain]), gainDe(essentiels!, [gain]), gainDe(films!, [{ ...gain, apres: 2 }])]).toEqual([gain, undefined, undefined])
  })

  // Mutations : toute ligne gagnée tenue pour venue d'arriver ; `<=` sur l'avant (un palier déjà tenu).
  it('une ligne vient d’arriver quand son gain franchit le palier, pas au-delà ni en deçà', () => {
    const venues = (profondeur: number, avant: number) => venuesDArriver(arriveesDeLAnnee(profondeur, P(2, 5, 1), null, null), [{ cle: 'films', avant, apres: profondeur }]).map((a) => a.cle)
    expect([venues(3, 2), venues(4, 1), venues(4, 3), venues(2, 1)]).toEqual([['films'], ['films'], [], []])
  })

  // Mutations : le pluriel figé ; « la ligne est bouclée » dite d'après le compte.
  it('le compteur dit combien d’arrivées, et la ligne bouclée seulement quand elle l’est', () => {
    const quatre = arriveesDeLAnnee(15, P(5, 5, 2), 'palme', TICKET(1904))
    expect([phraseDuCompteur(quatre, true), phraseDuCompteur(quatre, false), phraseDuCompteur(arriveesDeLAnnee(3, P(2, 5, 1), null, null), false)]).toEqual(['arrivées sur 4 : la ligne est bouclée.', 'arrivées sur 4.', 'arrivée sur 4.'])
  })
})

describe('le corps d’une année 1900 ouverte', () => {
  // Les lignes viennent de la fiche, et d'elle seule. Mutations : une ligne en dur dans `Indicateur`
  // ou dans `arriveesDeLAnnee` ; `Indicateur`, `Compteur` ou `Guide` retiré des gabarits (le défaut
  // reviendrait) ; `ia` ignoré.
  it('l’indicateur et le compteur disent ce que la fiche compte, à la place de la corde et du programme', async () => {
    const { requetes } = monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, profondeur: 4, progression: P(2, 5, 1), recompense: 'ours' })) })
    const indicateur = await screen.findByRole('region', { name: 'L’indicateur' })
    expect(lignes()).toEqual([
      'Ours | 3 films de 1903 | arrivé · 4',
      'Lion | Tous les essentiels | attendu · 2 sur 5',
      'Palme | 2 salles complètes | attendu · 1 sur 2',
      'Ticket | Le ticket pour 1904 — au Lion, ou plus tôt si le jury le décide | attendu',
    ])
    expect(within(indicateur).getByRole('heading', { level: 2 })).toHaveTextContent('L’indicateur1 sur 4')
    expect(indicateur).toHaveTextContent('Ligne 1903Arrivées')
    expect(compteur()).toHaveTextContent('1arrivée sur 4.')
    // Ni la corde, ni le programme par défaut, ni tampon tant que le ticket n'est pas émis.
    expect(screen.queryByRole('list', { name: 'La progression de l’année' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Arrivées' })).toBeNull()
    expect(screen.queryByText(/^Ligne bouclée/)).toBeNull()
    expect(pointees()).toEqual([])
    expect(plus()).toEqual([])
    // Les gabarits ne lisent rien : la fiche, la carte, et ce que la page lisait déjà.
    expect(requetes.filter((r) => r.startsWith('GET /api/me/voyage/annees/'))).toEqual([FICHE(1903)])
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([])
  })

  // Au retour d'un billet, la ligne qui se pointe doit se voir sans défiler : l'indicateur est sous le
  // compteur, avant le guide. Rien de ce que le défaut range n'est perdu. Mutations : `Gare` retiré des
  // gabarits (l'ordre par défaut : le guide d'abord) ; une section que `Gare` ne rendrait plus.
  it('range l’indicateur sous le compteur, avant le guide, sans perdre une section', async () => {
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, ticket: TICKET(1904) })) })
    await screen.findByRole('region', { name: 'Ton ticket' })
    const tous = [...document.querySelectorAll('*')]
    const reperes = [
      compteur(),
      screen.getAllByRole('status').find((e) => e.classList.contains('sr-only'))!,
      screen.getByRole('region', { name: 'L’indicateur' }),
      screen.getByRole('region', { name: 'Guide du voyageur' }),
      screen.getByRole('region', { name: /^Les trois classes/ }),
      screen.getByRole('region', { name: /^Ce soir/ }),
      screen.getByRole('region', { name: 'Les correspondances' }),
      screen.getByRole('region', { name: 'Ton ticket' }),
    ].map((e) => tous.indexOf(e))
    expect(reperes.every((x, i) => i === 0 || x > reperes[i - 1]!)).toBe(true)
  })

  // Mutation : la branche `essentiels_total === 0` retirée d'`arriveesDeLAnnee` (« attendu · 0 sur 0 »,
  // ou une ligne arrivée à zéro), ou `a.total === null` de `ligneDeLIndicateur`.
  it('« Aucun essentiel » ne se rend jamais en « 0 sur 0 »', async () => {
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, profondeur: 1, progression: P(0, 0, 0), recompense: null })) })
    await screen.findByRole('region', { name: 'L’indicateur' })
    expect(lignes()[1]).toBe('Lion | Aucun essentiel encore | attendu')
    expect(screen.queryByText(/0 sur 0/)).toBeNull()
    expect(compteur()).toHaveTextContent('0arrivée sur 4.')
  })

  // Une année bouclée garde son indicateur, tamponné, avec sa récompense ; l'année en cours l'est dès
  // son ticket émis (réponse du propriétaire du 7 octobre 2026). Mutations : le tampon posé d'après
  // `!enCours` seul ; la récompense retirée du tampon ; l'indicateur rendu pour la seule année en cours.
  it('une ligne bouclée porte le tampon rouge et sa récompense, dès le ticket émis', async () => {
    const bouclee = monterVoyage('/voyage/1902', { ...ROUTES, [FICHE(1902)]: () => json(nue({ annee: 1902, profondeur: 15, progression: P(5, 5, 2), recompense: 'palme', ticket: TICKET(1903, '2026-09-22T08:00:00.000Z') })) })
    expect(await screen.findByText('Ligne bouclée · Palme')).toBeInTheDocument()
    expect(lignes().map((l) => l.split(' | ')[2])).toEqual(['arrivé · 15', 'arrivé', 'arrivé · 2', 'arrivé'])
    expect(compteur()).toHaveTextContent('4arrivées sur 4 : la ligne est bouclée.')
    bouclee.unmount()
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, profondeur: 5, progression: P(5, 5, 0), recompense: 'lion', ticket: TICKET(1904) })) })
    expect(await screen.findByText('Ligne bouclée · Lion')).toBeInTheDocument()
    // La Palme reste attendue : la ligne est bouclée par le ticket, pas par le compte.
    expect(compteur()).toHaveTextContent('3arrivées sur 4 : la ligne est bouclée.')
    // Le ticket qui attend reste offert au bas de la page.
    expect(screen.getByRole('button', { name: 'Utiliser' })).toBeInTheDocument()
  })

  // Une année derrière soi sans ticket : fiche de 1901, mon année est 1903. Sous le tampon, aucune
  // ligne ne promet un ticket pour 1902, et le compteur comme le titre comptent sur trois. Mutations :
  // `Indicateur` qui rendrait `arrivees` sans `lignesDeLAnnee` ; son titre compté sur `arrivees` ;
  // `phraseDuCompteur` comptée sur `arrivees`.
  it('une année derrière soi sans ticket ne promet plus son ticket, ni dans l’indicateur ni au compteur', async () => {
    monterVoyage('/voyage/1901', { ...ROUTES, [FICHE(1901)]: () => json(nue({ annee: 1901, profondeur: 4, progression: P(2, 5, 1), recompense: 'ours' })) })
    const indicateur = await screen.findByRole('region', { name: 'L’indicateur' })
    expect(within(indicateur).getByText('Ligne bouclée · Ours')).toBeInTheDocument()
    expect(lignes()).toEqual(['Ours | 3 films de 1901 | arrivé · 4', 'Lion | Tous les essentiels | attendu · 2 sur 5', 'Palme | 2 salles complètes | attendu · 1 sur 2'])
    expect(indicateur).not.toHaveTextContent(/ticket/i)
    expect(within(indicateur).getByRole('heading', { level: 2 })).toHaveTextContent('L’indicateur1 sur 3')
    expect(compteur()).toHaveTextContent('1arrivée sur 3 : la ligne est bouclée.')
  })

  // Le ticket donné par le jury avant toute récompense : la ligne est bouclée, sans récompense à
  // nommer. La tête tamponne du même mot : c'est le tampon de l'indicateur qu'on lit ici. Mutations,
  // dans `Indicateur` : le tampon rendu seulement avec une récompense ; « · null » écrit à sa suite.
  it('une ligne bouclée sans récompense porte le tampon seul', async () => {
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, profondeur: 1, progression: P(1, 5, 0), recompense: null, ticket: TICKET(1904) })) })
    const indicateur = await screen.findByRole('region', { name: 'L’indicateur' })
    expect(within(indicateur).getByText('Ligne bouclée')).toBeInTheDocument()
    expect(within(indicateur).queryByText(/^Ligne bouclée ·/)).toBeNull()
    expect(lignes().map((l) => l.split(' | ')[2])).toEqual(['attendu · 1 sur 3', 'attendu · 1 sur 5', 'attendu · 0 sur 2', 'arrivé'])
  })

  // Le guide garde les deux gestes du boniment. Mutations, dans `Guide` : `onLire` ou `onGenerique`
  // non branché ; le générique offert sans `generique` ; l'ouverture entière ; les faits oubliés ;
  // `Guide` retiré des gabarits (le boniment par défaut porte le même nom et les mêmes gestes).
  it('le guide montre le premier paragraphe et les faits, lit l’ouverture, et n’offre le générique qu’avec le ticket', async () => {
    const ouverture = 'Le premier paragraphe du guide.\n\nLe second, que seule la feuille montre.'
    const sans = monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, ouverture, faits: ['Un fait de 1903.'] })) })
    const guide = await screen.findByRole('region', { name: 'Guide du voyageur' })
    expect(within(guide).getByText('Le premier paragraphe du guide.')).toBeInTheDocument()
    // Le guide, pas le boniment par défaut au même nom : son titre de rubrique, et les faits en dessous.
    expect(within(guide).getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`)).toEqual(['H2 Guide du voyageur1903', 'H3 Les faits de l’année'])
    expect(within(guide).queryByText(/Le second/)).toBeNull()
    expect(within(within(guide).getByRole('list')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Un fait de 1903.'])
    expect(within(guide).queryByRole('button', { name: 'Le générique de fin' })).toBeNull()
    fireEvent.click(within(guide).getByRole('button', { name: 'Lire l’ouverture' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Le second, que seule la feuille montre.')
    sans.unmount()
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, ouverture, ticket: TICKET(1904), generique: 'Le générique écrit.' })) })
    fireEvent.click(await screen.findByRole('button', { name: 'Le générique de fin' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Le générique écrit.')
  })

  // Le jury n'appartient qu'au compte IA : ni la ligne du bas, ni la ligne du ticket ne le promettent
  // à un autre membre. Mutations, dans la page : `fiche.maturite` passée telle quelle à `ligneDuBas` ;
  // `ia` passé vrai à l'indicateur.
  it('ne promet le jury qu’au compte IA, au bas de la page comme sur la ligne du ticket', async () => {
    const verdict = nue({ annee: 1903, maturite: { mure: false, motif: 'il manque encore deux essentiels.', jugee_le: '2026-09-21T21:00:00.000Z' } })
    const ia = monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(verdict) })
    expect(await screen.findByText(/Pas encore mûre : il manque encore deux essentiels\./)).toBeInTheDocument()
    expect(lignes()[3]).toMatch(/jury/)
    ia.unmount()
    monterVoyage('/voyage/1903', { ...ROUTES, 'GET /api/me/voyage': () => json({ ...SUIVI, source: { ...SUIVI.source, annee_en_cours: 1903 } }), [FICHE(1903)]: () => json(verdict) })
    await screen.findByRole('region', { name: 'L’indicateur' })
    expect(lignes()[3]).toBe('Ticket | Le ticket pour 1904 — au Lion | attendu')
    expect(screen.queryByText(/Pas encore mûre/)).toBeNull()
    expect(screen.queryByText(/jury/i)).toBeNull()
  })
})

describe('le retour d’un billet en gare', () => {
  const AVANT = { profondeur: 2, progression: P(2, 5, 1) }
  const apres = () => json(nue({ annee: 1903, profondeur: 3, progression: P(2, 5, 1), recompense: 'ours' }))
  const enCache = (c: Parameters<NonNullable<Parameters<typeof monterVoyage>[2]>>[0]) => c.setQueryData(cles.annee(1903), nue({ annee: 1903, ...AVANT, recompense: null }))

  // Mutations : dans la page, le gain joué sur la fiche du cache (sans attendre `relue`) ; dans
  // `Compteur`, le « +1 » ou le rouleau retiré ; dans `Indicateur`, la ligne non pointée.
  it('la ligne gagnée se pointe, un « +1 » monte, la molette tourne, et la région d’état le dit', async () => {
    confierLeRetour(1903, SESSION.user.id, { avant: AVANT, guet: null })
    // La relecture attend : la fiche du cache est à l'écran, telle qu'avant le billet.
    let lacher = () => undefined as void
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => new Promise<Response>((r) => (lacher = () => r(apres()))) }, enCache)
    // La région d'état est là dès la fiche montée, vide : elle ne se lit qu'à son changement.
    await screen.findByRole('region', { name: 'L’indicateur' })
    const etat = screen.getAllByRole('status').find((e) => e.classList.contains('sr-only'))!
    expect(etat).toBeEmptyDOMElement()
    expect([pointees(), plus(), compteur().textContent]).toEqual([[], [], '0arrivée sur 4.'])
    lacher()
    await waitFor(() => expect(etat).toHaveTextContent('+1 film vu'))
    expect(pointees()).toEqual(['Ours'])
    expect(plus()).toEqual(['+1'])
    // La molette tourne de l'ancien nombre au nouveau : l'ancien est tu aux lecteurs d'écran.
    const molette = compteur().querySelector('[data-tourne]')!
    expect(molette).toHaveAttribute('data-tourne', 'oui')
    expect([...molette.querySelectorAll('span span')].map((e) => `${e.textContent}${e.getAttribute('aria-hidden') ? ' (tu)' : ''}`)).toEqual(['0 (tu)', '1'])
    expect(molette.closest('[data-vivante]')).toHaveAttribute('data-vivante', 'oui')
  })

  // Un film de plus au-delà du palier : la ligne se pointe, rien n'arrive. Mutation : la molette qui
  // tourne à tout gain (`venuesDArriver` remplacé par les lignes pointées).
  it('un gain qui ne fait arriver aucune ligne pointe la sienne sans tourner la molette', async () => {
    confierLeRetour(1903, SESSION.user.id, { avant: { profondeur: 3, progression: P(2, 5, 1) }, guet: null })
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903, profondeur: 4, progression: P(2, 5, 1), recompense: 'ours' })) })
    await waitFor(() => expect(pointees()).toEqual(['Ours']))
    expect(plus()).toEqual(['+1'])
    expect(compteur().querySelector('[data-tourne]')).toHaveAttribute('data-tourne', 'non')
    expect(compteur()).toHaveTextContent('1arrivée sur 4.')
  })

  // Au calme, l'état final se pose d'un coup : la ligne est pointée, le nombre est le nouveau, rien ne
  // monte ni ne tourne. Mutations : `calme` ignoré dans `Compteur` (le « +1 », le rouleau) ou dans
  // `Indicateur` (`data-vivante`).
  it('au calme, la ligne est pointée et le compteur à sa valeur, sans « +1 » ni molette qui tourne', async () => {
    calme()
    confierLeRetour(1903, SESSION.user.id, { avant: AVANT, guet: null })
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: apres }, enCache)
    await waitFor(() => expect(pointees()).toEqual(['Ours']))
    expect(plus()).toEqual([])
    expect(compteur().querySelector('[data-tourne]')).toHaveAttribute('data-tourne', 'non')
    expect(compteur()).toHaveTextContent('1arrivée sur 4.')
    expect(compteur()).toHaveAttribute('data-vivante', 'non')
    expect(screen.getByRole('region', { name: 'L’indicateur' })).toHaveAttribute('data-vivante', 'non')
  })

  // Ni au rechargement (plus de retour confié), ni sur une relecture en panne (la fiche du cache est
  // encore à l'écran : la comparer consommerait le retour). Mutation, dans la page : le gain lu sans
  // attendre la relecture réussie (`!requete.isError` retiré de `relue`).
  it('le « +1 » ne se rejoue ni au rechargement ni sur une relecture en panne, et se joue à la relecture réussie', async () => {
    let lectures = 0
    confierLeRetour(1903, SESSION.user.id, { avant: AVANT, guet: null })
    const routes = { ...ROUTES, [FICHE(1903)]: () => ((lectures += 1) === 1 ? json({ code: 'INTERNAL', message: 'Le service a un souci.', retryable: false }, 500) : apres()) }
    const premiere = monterVoyage('/voyage/1903', routes, enCache)
    await waitFor(() => expect(premiere.client.getQueryState(cles.annee(1903))?.status).toBe('error'))
    await act(async () => undefined)
    expect([pointees(), plus()]).toEqual([[], []])
    await act(() => premiere.client.refetchQueries({ queryKey: cles.annee(1903), exact: true }))
    await waitFor(() => expect(pointees()).toEqual(['Ours']))
    expect(plus()).toEqual(['+1'])
    // La page rechargée : la même fiche, plus aucun retour à jouer.
    premiere.unmount()
    monterVoyage('/voyage/1903', routes)
    await screen.findByRole('region', { name: 'L’indicateur' })
    await waitFor(() => expect(compteur()).toHaveTextContent('1arrivée sur 4.'))
    await act(async () => undefined)
    expect([pointees(), plus()]).toEqual([[], []])
  })
})

describe('la courroie', () => {
  // Le dessin et les mots changent, pas le geste : `Manivelle` garde ses écouteurs et ses seuils
  // (`Manivelle.test.tsx`, vert sans être retouché). Mutations : `Courroie` retirée des gabarits ;
  // dans `Courroie`, la sangle qui ne suit plus la course, ou qui la suit au calme.
  it('remplace la manivelle dessinée, s’allonge avec le geste, et ne relit que la fiche et la carte', async () => {
    const { requetes } = monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903 })) })
    await screen.findByRole('region', { name: 'L’indicateur' })
    const courroie = screen.getByTestId('courroie')
    expect(screen.queryByTestId('manivelle')).toBeNull()
    expect(courroie).toHaveTextContent('Tire la courroie')
    const sangle = courroie.firstElementChild as HTMLElement
    const auRepos = parseFloat(sangle.style.height)
    const contenu = screen.getByTestId('contenu-manivelle')
    fireEvent.touchStart(contenu, { touches: [{ clientY: 10 }] })
    fireEvent.touchMove(contenu, { touches: [{ clientY: 210 }] })
    expect(courroie).toHaveTextContent('Relâche la courroie')
    expect(parseFloat(sangle.style.height)).toBeGreaterThan(auRepos)
    const avant = requetes.length
    fireEvent.touchEnd(contenu, { touches: [] })
    await waitFor(() => expect(requetes.slice(avant).sort()).toEqual(['GET /api/me/voyage', FICHE(1903)]))
    expect(await screen.findByText('L’indicateur est à jour.')).toBeInTheDocument()
    // Le bouton du bas reste, pour qui ne tire pas.
    expect(screen.getByRole('button', { name: 'Tirer la courroie pour mettre l’indicateur à jour' })).toBeInTheDocument()
  })

  it('au calme, la sangle ne s’allonge pas et rien ne tourne', async () => {
    calme()
    monterVoyage('/voyage/1903', { ...ROUTES, [FICHE(1903)]: () => json(nue({ annee: 1903 })) })
    await screen.findByRole('region', { name: 'L’indicateur' })
    const courroie = screen.getByTestId('courroie')
    const sangle = courroie.firstElementChild as HTMLElement
    const auRepos = sangle.style.height
    const contenu = screen.getByTestId('contenu-manivelle')
    fireEvent.touchStart(contenu, { touches: [{ clientY: 10 }] })
    fireEvent.touchMove(contenu, { touches: [{ clientY: 210 }] })
    expect(sangle.style.height).toBe(auRepos)
    expect(courroie).toHaveAttribute('data-vivante', 'non')
  })
})

/**
 * La garde de « rien ne bouge au calme », pour toute feuille des pages 1900, découvertes sur disque :
 * une feuille neuve y entre sans y être nommée. Une `animation` ou une `transition` (leurs propriétés
 * longues comprises) ne s'écrit que sous une racine `[data-vivante='oui']`, que son composant ne pose
 * pas au calme (les tests « au calme » de chaque racine le tiennent).
 */
describe('rien ne bouge au calme dans les feuilles des pages 1900', () => {
  const FEUILLES = import.meta.glob<string>('./*.module.css', { query: '?raw', import: 'default', eager: true })
  /** Les sélecteurs des règles qui animent, un par sélecteur d'une liste. */
  const quiBougent = (css: string) =>
    [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\b(?:animation|transition)(?:-[\w-]+)?\s*:[^{}]*\}/g)].flatMap(([, selecteurs]) => selecteurs!.split(',').map((s) => s.trim()))
  const VIVANTE = /^\.[\w-]+\[data-vivante='oui'\]/

  // Le plancher : sans lui, un glob qui ne trouverait rien, ou une expression qui ne lirait plus
  // aucune règle, passerait sans rien garder. Mutations : le glob ramené à `./Tete.module.css` ;
  // l'expression ramenée à `transition` seule.
  it('trouve les feuilles, celles qui animent comme celles qui n’animent rien, et lit leurs règles', () => {
    expect(Object.keys(FEUILLES)).toEqual(expect.arrayContaining(['./Tete.module.css', './Indicateur.module.css', './Courroie.module.css', './Soir.module.css', './Guide.module.css', './VoieFermee.module.css', './Voies.module.css', './Classes.module.css', './Rubrique.module.css', './Hale.module.css', './Action.module.css']))
    for (const css of Object.values(FEUILLES)) expect(css.length).toBeGreaterThan(200)
    const compte = (nom: string) => quiBougent(FEUILLES[`./${nom}`]!).length
    expect([compte('Tete.module.css') > 4, compte('Indicateur.module.css') > 2, compte('Courroie.module.css') > 0, compte('Soir.module.css') > 0, compte('Hale.module.css') > 3]).toEqual([true, true, true, true, true])
  })

  // Mutations : `.plaque { animation: eclat 1s }` hors racine vivante dans `Guide.module.css` ;
  // `transition: opacity 0.2s` sur `.pancarte` dans `VoieFermee.module.css` ; et celles des gardes par
  // feuille que celle-ci remplace : `transition: transform 0.28s` sur `.voie`, une `animation` sur
  // `.porte` des classes, `.trotteuse`, `.anneau`, `.plus` ou `.pris` animés sans leur racine vivante.
  it.each(Object.keys(FEUILLES))('%s n’anime rien hors d’une racine vivante', (chemin) => {
    expect(quiBougent(FEUILLES[chemin]!).filter((s) => !VIVANTE.test(s))).toEqual([])
  })
})
