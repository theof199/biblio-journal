import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import type { FicheEnPreparation, FichePrete } from '../../../api/voyage'
import type { JournalPage } from '../../../api/journal'
import { exemple } from '../../../test/contrat'
import { visionnage } from '../../../test/journal'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { ficheEnAttente, fichePrete, ficheVerrouillee, voyage1890 } from '../../../test/voyage'
import { PAGES_A_VENIR } from '../../avenir/pages'
import { PAGES_1900 } from '../pages'
import { heureDeLaGare, libelleDeLaPhoto, mentionDeLaPlaque, rangDeLaGare } from './gare'

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
  // Mutations : dans `Tete`, l'horloge montée dans tous les modes ; le tampon posé dès `encours` ; la
  // lanterne posée en attente, ou le sémaphore sur une année fermée ; les deux variantes échangées
  // dans `mentionDeLaPlaque`. Le titre : `SousLaTete` ou `VoieFermee` qui remonterait un `Fronton`.
  it.each([
    { mode: 'encours', annee: 1903, voyage: VOYAGE, fiche: () => json(nue({ annee: 1903 })), marques: ['horloge'], mention: 'Quatrième gare', photo: 'Longueville, la gare vers 1900' },
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
    // Ce que la fiche accroche au fronton par défaut reste accroché. Mutation : `children` oublié.
    expect(screen.getByText('Bouclée · Palme')).toBeInTheDocument()
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

  // Le jumeau de la feuille : aucune animation hors de `data-vivante='oui'`. Mutation : une règle
  // `.trotteuse { animation: … }` sans le sélecteur de la tête vivante.
  it('la feuille de la tête n’anime rien hors de la tête vivante', () => {
    const feuille = Object.values(import.meta.glob<string>('./Tete.module.css', { query: '?raw', import: 'default', eager: true }))[0]!.replace(/\/\*[\s\S]*?\*\//g, '')
    const regles = [...feuille.matchAll(/([^{}]+)\{([^{}]*\banimation\s*:[^{}]*)\}/g)].map(([, selecteur]) => selecteur!.trim())
    expect(regles.length).toBeGreaterThan(4)
    expect(regles.filter((s) => !s.startsWith(".tete[data-vivante='oui'] "))).toEqual([])
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
