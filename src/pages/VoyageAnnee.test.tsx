import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { cles } from '../api/cles'
import type { JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'
import type { FicheEnPreparation, FichePrete, Voyage } from '../api/voyage'
import type { HabillagePages, VueBandeau } from '../mondes/types'
import { PAGES_1890 } from '../mondes/1890/pages'
import { PAGES_A_VENIR } from '../mondes/avenir/pages'
import { RELECTURES } from '../voyage/relecture'
import { INSECABLE, type PropsAnneeFermee } from '../voyage/annee/AnneeFermee'
import type { PropsTeteDAnnee } from '../voyage/annee/Bandeau'
import type { PropsFronton } from '../voyage/annee/Fronton'
import { confierLeRetour, oublierLeRetour } from '../voyage/annee/retour'
import { exemple } from '../test/contrat'
import { contexteFactice } from '../test/contexteFactice'
import { visionnage } from '../test/journal'
import { SESSION, monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { ficheEnAttente, fichePrete, ficheVerrouillee, voyage1890 } from '../test/voyage'

const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme' },
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: null },
    { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)
const FICHE = fichePrete({ annee: 1897 })
const EN_PREPARATION = exemple<FicheEnPreparation>('/me/voyage/annees/{annee}', 'get', 202)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
/** Mes films sortis l'année de la fiche, et eux seuls : une année fermée ne lit jamais tout le journal. */
const JOURNAL = (annee: number | string) => `GET /api/me/journal?limit=100&sortie_min=${annee}&sortie_max=${annee}`

const ROUTES = {
  'GET /api/me/voyage': () => json(VOYAGE),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  'GET /api/me/voyage/annees/1897': () => json(FICHE),
}

const vu = (id: string, titre: string, annee: number, note: number | null = null) =>
  visionnage({ id, media: 'm-' + id, titre, annee, date: '2026-09-01', note })
const journal = (items: ReturnType<typeof vu>[]) => () => json({ ...PAGE, items, next_cursor: null })

/** Une fiche prête de 1897 sans ticket ni verdict : chaque test pose ce qu'il lit. */
const nue = (s: Partial<FichePrete> = {}) => fichePrete({ annee: 1897, ticket: null, maturite: null, generique: null, ...s })
const ticket = (annee: number, utiliseLe: string | null = null) => ({ annee, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: utiliseLe })

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

/** Le bandeau épié : une toile qui peint (contexte factice), le dessin du monde 1890 remplacé par un espion. */
function epierLeBandeau(pages: HabillagePages = PAGES_1890) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => contexteFactice().ctx as never)
  const bandeau = vi.spyOn(pages, 'dessinerBandeau').mockImplementation(() => undefined)
  return () => {
    const appels = bandeau.mock.calls
    expect(appels.length).toBeGreaterThan(0)
    return appels[appels.length - 1]![0] as VueBandeau
  }
}

describe('la fiche d’une année', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // Mutation : `refetchOnMount: 'always'` retiré : une fiche de moins de 30 s ne se relirait pas.
  it('relit la fiche à chaque ouverture, même fraîche en cache', async () => {
    const { requetes } = monterVoyage('/voyage/1897', ROUTES, (c) => c.setQueryData(cles.annee(1897), FICHE))
    await waitFor(() => expect(requetes).toContain('GET /api/me/voyage/annees/1897'))
  })

  // Mutation : `intervalle` rendu `false` : la page resterait sur l'attente.
  it('relit une année en préparation toutes les cinq secondes, jusqu’à la fiche', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let n = 0
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () => (++n < 3 ? json(EN_PREPARATION, 202) : json(FICHE)),
    })
    await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await screen.findByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Le chroniqueur écrit…' })).toBeNull()
    expect(requetes.filter((r) => r === 'GET /api/me/voyage/annees/1897')).toHaveLength(3)
  })

  // Mutations : `>` au lieu de `>=` dans `etatRelecture` (une lecture de trop) ; l'abandon jamais dit.
  it('abandonne au plafond, le dit, et ne relit plus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(EN_PREPARATION, 202) })
    await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })
    for (let i = 0; i < 40; i += 1) await vi.advanceTimersByTimeAsync(5_000)
    expect(await screen.findByText('Le chroniqueur n’a pas répondu, reviens plus tard.')).toBeInTheDocument()
    expect(requetes.filter((r) => r === 'GET /api/me/voyage/annees/1897')).toHaveLength(RELECTURES.annee.plafond)
  })

  // Le jumeau de l'abandon. Mutation : « Réessayer » sans remettre le compte à zéro (une seule
  // lecture, puis l'abandon aussitôt redit).
  it('au plafond, « Réessayer » relit et reprend la relecture depuis zéro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(EN_PREPARATION, 202) })
    await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })
    for (let i = 0; i < 40; i += 1) await vi.advanceTimersByTimeAsync(5_000)
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(screen.getByRole('status', { name: 'Le chroniqueur écrit…' })).toBeInTheDocument()
    expect(requetes.filter((r) => r === 'GET /api/me/voyage/annees/1897')).toHaveLength(RELECTURES.annee.plafond + 3)
  })

  // Mutation : « Retour à la carte » en simple lien vers `/voyage` : la carte s'empilerait devant
  // l'année quittée, et le geste « retour » du téléphone y ramènerait.
  it('« Retour à la carte » recule dans l’historique quand il y a de quoi', async () => {
    monterVoyage(['/voyage/1896', '/voyage/1897'], {
      ...ROUTES,
      'GET /api/me/voyage/annees/1896': () => json(nue({ annee: 1896, recompense: 'lion' })),
    })
    await screen.findByRole('heading', { level: 1, name: '1897' })
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    expect(await screen.findByRole('heading', { level: 1, name: '1896' })).toBeInTheDocument()
  })

  // Le jumeau : ouverte d'un lien, sans rien de l'app derrière. Mutation : toujours reculer (rien
  // ne se passerait).
  it('« Retour à la carte » mène à la carte quand rien n’est derrière', async () => {
    monterVoyage('/voyage/1897', ROUTES)
    await screen.findByRole('heading', { level: 1, name: '1897' })
    const retour = screen.getByRole('link', { name: 'Retour à la carte' })
    expect(retour).toHaveAttribute('href', '/voyage')
    fireEvent.click(retour)
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })

  // Mutation : le lien vers `PREMIERE_DECENNIE` en dur (la plaque de 1903 ouvrirait les années 1890).
  it.each([
    { annee: 1897, plaque: 'Chapitre I', decennie: 1890 },
    { annee: 1903, plaque: 'Chapitre II', decennie: 1900 },
  ])('la plaque ouvre la décennie de l’année ($annee)', async ({ annee, plaque, decennie }) => {
    monterVoyage(`/voyage/${annee}`, {
      ...ROUTES,
      'GET /api/me/voyage/annees/1903': () => json(ficheVerrouillee(1903)),
      [JOURNAL(annee)]: journal([]),
    })
    await screen.findByRole('heading', { level: 1, name: String(annee) })
    expect(screen.getByRole('link', { name: plaque })).toHaveAttribute('href', `/voyage/decennies/${decennie}`)
  })

  // Mutation : la page d'une année sans `key` : revenir d'une année à une autre garderait le compte
  // des relectures de la première, et l'abandonnerait d'emblée.
  it('une autre année repart de zéro dans ses relectures', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let n = 0
    monterVoyage(['/voyage/1897', '/voyage/1896'], {
      ...ROUTES,
      'GET /api/me/voyage/annees/1896': () => json(EN_PREPARATION, 202),
      'GET /api/me/voyage/annees/1897': () => (++n < 2 ? json(EN_PREPARATION, 202) : json(FICHE)),
    })
    await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })
    for (let i = 0; i < 40; i += 1) await vi.advanceTimersByTimeAsync(5_000)
    await screen.findByText('Le chroniqueur n’a pas répondu, reviens plus tard.')
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await screen.findByRole('region', { name: 'Boniment d’ouverture' })).toBeInTheDocument()
  })

  // Mutation : le `:annee` lu sans vérifier qu'il est un entier : `GET …/annees/NaN`.
  it('ramène à la carte une année qui n’est pas un nombre', async () => {
    const { requetes } = monterVoyage('/voyage/demain', ROUTES)
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(requetes.some((r) => r.includes('/annees/'))).toBe(false)
  })

  it('dit une panne telle que l’API l’a écrite, et relit à « Réessayer »', async () => {
    let n = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () =>
        ++n === 1 ? json({ code: 'VALIDATION', message: 'Cette année n’existe pas au Voyage.', retryable: false }, 400) : json(FICHE),
    })
    expect(await screen.findByText('Cette année n’existe pas au Voyage.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
  })

  // Le jumeau : la carte du Voyage (l'année en cours, `ia`, le Voyage suivi) en panne. Mutation :
  // « Réessayer » qui ne relit que la fiche.
  it('dit une panne de la carte, et la relit à « Réessayer »', async () => {
    let n = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage': () => (++n === 1 ? json({ code: 'VALIDATION', message: 'Le Voyage ne se lit pas.', retryable: false }, 400) : json(VOYAGE)),
    })
    expect(await screen.findByText('Le Voyage ne se lit pas.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
  })

  // Mutation : `{ configure: false }` pris pour un chargement sans fin.
  it('dit quand le chroniqueur n’est pas configuré', async () => {
    monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json({ configure: false }) })
    expect(await screen.findByText('Le chroniqueur n’est pas configuré sur ce serveur : cette année ne peut pas encore s’ouvrir.')).toBeInTheDocument()
  })

  // Mutations : `vusEnAvance` sans son filtre d'année ; le jury promis sans `ia`.
  it('une année fermée : la pancarte, le chemin, et mes seuls films de l’année', async () => {
    monterVoyage('/voyage/1898', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898, { profondeur: 1 })),
      [JOURNAL(1898)]: journal([vu('e2', 'Un film de 1897', 1897), vu('e1', 'Un film de 1898', 1898)]),
    })
    expect(await screen.findByText('Encore un ticket : le Lion de 1897, ou plus tôt si le jury le décide.')).toBeInTheDocument()
    expect(screen.getByText('Cette année s’ouvre avec le ticket de 1897.')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Chemin : 1897, tu es ici, puis 1898, fermée' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '1 film vu en avance' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Un film de 1898/ })).toHaveAttribute('href', '/journal/e1')
    expect(screen.queryByText(/Un film de 1897/)).toBeNull()
  })

  // Le jumeau de la phrase : le chemin nomme chaque année jusqu'à la fermée. Mutation : `chemin`
  // borné à l'année en cours et à l'année demandée.
  it('le chemin d’une année lointaine passe par chaque année', async () => {
    monterVoyage('/voyage/1899', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1899': () => json(ficheVerrouillee(1899, { profondeur: 2 })),
      [JOURNAL(1899)]: journal([]),
    })
    const route = await screen.findByRole('list', { name: 'Chemin : 1897, tu es ici, puis 1898, puis 1899, fermée' })
    // Ce qui se voit (caché aux lecteurs d'écran, qui ont le nom) dit le même chemin. Mutation : la
    // dernière année marquée « fermée » d'après le mauvais rang.
    expect([...route.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['1897ici', '1898', '1899fermée'])
    expect(screen.getByText('Encore 2 tickets, un par année, depuis 1897.')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '2 films vus en avance' })).toBeInTheDocument()
  })

  // Mutation : le lien d'un film vu en avance sans son état de navigation : la fiche du visionnage,
  // qui ne lit rien sur le réseau, le dirait indisponible.
  it('un film vu en avance ouvre la fiche de son visionnage', async () => {
    monterVoyage('/voyage/1898', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898, { profondeur: 1 })),
      [JOURNAL(1898)]: journal([vu('e1', 'Un film de 1898', 1898, 8)]),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    fireEvent.click(await screen.findByRole('link', { name: /Un film de 1898/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Un film de 1898' })).toBeInTheDocument()
  })

  // Mutation : le journal en panne tu (la page resterait muette sur des films vus qui manquent).
  it('dit une panne du journal, sans perdre l’année fermée', async () => {
    monterVoyage('/voyage/1898', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898)),
      [JOURNAL(1898)]: () => json({ code: 'VALIDATION', message: 'Le journal ne se lit pas.', retryable: false }, 400),
    })
    expect(await screen.findByText('Le journal ne se lit pas.')).toBeInTheDocument()
    expect(screen.getByText('Cette année s’ouvre avec le ticket de 1897.')).toBeInTheDocument()
  })

  // Mutation : le journal lu quelle que soit la forme : chaque fiche prête coûterait tout le journal.
  it('ne lit jamais mon journal pour une fiche prête', async () => {
    const { requetes } = monterVoyage('/voyage/1897', ROUTES)
    await screen.findByRole('heading', { level: 1, name: '1897' })
    expect(requetes.some((r) => r.startsWith('GET /api/me/journal'))).toBe(false)
  })

  // Une année fermée lit ses seuls films (`sortie_min` et `sortie_max` à l'année), sous sa propre clé :
  // jamais tout le journal, ni le journal entier du profil déjà en cache, qu'elle ne remplace pas.
  // Mutations : la lecture de toute la décennie (`annee`, `annee + 9`) ; la clé du journal entier
  // gardée (`cles.journalComplet`) : la page lirait le cache du profil, et le profil, un an de films.
  it('une année fermée ne lit que ses films, sans toucher au journal entier en cache', async () => {
    const entier = [vu('e9', 'Un film de 1898 lu par le profil', 1898)]
    const { requetes, client } = monterVoyage(
      '/voyage/1898',
      {
        ...ROUTES,
        'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898, { profondeur: 1 })),
        [JOURNAL(1898)]: journal([vu('e1', 'Un film de 1898', 1898)]),
      },
      (c) => c.setQueryData(cles.journalComplet, entier),
    )
    expect(await screen.findByRole('link', { name: /Un film de 1898/ })).toHaveAttribute('href', '/journal/e1')
    expect(screen.queryByText(/lu par le profil/)).toBeNull()
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([JOURNAL(1898)])
    expect(client.getQueryData(cles.journalComplet)).toBe(entier)
  })

  // Mutation : `rattrape` passé nul : le membre qui rattrape croirait n'avoir que son ticket.
  it('au membre qui rattrape, la phrase du chemin nomme le Voyage suivi', async () => {
    const suivi = { ...VOYAGE, ia: false, rattrape_la_source: true, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1897 } }
    monterVoyage('/voyage/1898', {
      ...ROUTES,
      'GET /api/me/voyage': () => json(suivi),
      'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898)),
      [JOURNAL(1898)]: journal([]),
    })
    expect(await screen.findByText('Encore un ticket : le Lion de 1897, ou dès que theo y arrive.')).toBeInTheDocument()
  })

  // Le jumeau : suivre sans rattraper ne promet pas le Voyage suivi, ni le jury. Mutation : `rattrape`
  // tiré de `source` seule, sans `rattrape_la_source`.
  it('au membre qui suit sans rattraper, la phrase ne promet que le Lion', async () => {
    const suivi = { ...VOYAGE, ia: false, rattrape_la_source: false, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1897 } }
    monterVoyage('/voyage/1898', {
      ...ROUTES,
      'GET /api/me/voyage': () => json(suivi),
      'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898)),
      [JOURNAL(1898)]: journal([]),
    })
    expect(await screen.findByText('Encore un ticket : le Lion de 1897.')).toBeInTheDocument()
  })

  // Mutation : le pseudo ou l'année du Voyage suivi pris ailleurs que dans `source`.
  it('en attente : la banderole, et où en est le Voyage suivi', async () => {
    const horsIa = { ...VOYAGE, ia: false, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1896 } }
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage': () => json(horsIa),
      'GET /api/me/voyage/annees/1897': () => json(ficheEnAttente(1897)),
      [JOURNAL(1897)]: journal([vu('e1', 'Un film de 1897', 1897)]),
    })
    // Décision du propriétaire du 1er octobre 2026 (2c-5). Mutation : l'ancien texte remis à la banderole.
    expect(await screen.findByText('theo est trop lent')).toBeInTheDocument()
    expect(screen.queryByText(/rattrapes/i)).toBeNull()
    expect(screen.getByText(/theo n’a pas encore ouvert 1897 : sa roulotte est encore en 1896/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
    // Mutation : le journal lu pour la seule année fermée : ses films vus en avance manqueraient ici.
    expect(await screen.findByRole('link', { name: /Un film de 1897/ })).toBeInTheDocument()
    expect(screen.queryByText(/Encore un ticket/)).toBeNull()
  })

  // Mutations : la garde `useRef` retirée (deux encaissements, le second en 404) ; le retour à la carte oublié.
  it('encaisse le ticket une seule fois, puis ramène à la carte', async () => {
    let encaissements = 0
    const fiche = fichePrete({ annee: 1897, ticket: ticket(1898) })
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () => json(fiche),
      'POST /api/me/voyage/tickets/1898/utiliser': () => ((encaissements += 1), json({ annee_en_cours: 1898 })),
    })
    expect(await screen.findByText('Ton ticket pour 1898 t’attend')).toBeInTheDocument()
    // Mutation : `prochainPas` sans le ticket : le programme dirait encore comment le gagner.
    expect(screen.queryByText(/^Ticket :/)).toBeNull()
    const bouton = screen.getByRole('button', { name: 'Utiliser' })
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(encaissements).toBe(1)
  })

  // Le jumeau de la garde : elle se lève quand l'encaissement a répondu. Mutation : la garde jamais
  // relâchée (après un refus passager, « Utiliser » ne répondrait plus).
  it('après un refus, « Utiliser » se retente', async () => {
    let n = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () => json(nue({ ticket: ticket(1898) })),
      'POST /api/me/voyage/tickets/1898/utiliser': () =>
        ++n === 1 ? json({ code: 'UPSTREAM_UNAVAILABLE', message: 'Le serveur est occupé.', retryable: true }, 503) : json({ annee_en_cours: 1898 }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur est occupé.')
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser' }))
    expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(n).toBe(2)
  })

  // Le piège du rappel qui survit (tâche 8), sur le jumeau de « Utiliser » : la navigation dans
  // `onSuccess` de `useMutation` survit à la page quittée pendant l'envoi (le « retour » du
  // téléphone), et ramènerait à la carte depuis ailleurs. Mutations : `navigate('/voyage')` remis
  // dans `useMutation` (la carte s'ouvre) ; l'invalidation passée dans les rappels de `mutate` (la
  // carte ne se relit plus, alors que le ticket a bien servi).
  it('quitter l’année pendant l’encaissement, puis la réponse : on reste où l’on est allé, et le Voyage se relit', async () => {
    let repondre: () => void = () => undefined
    let lectures = 0
    const { requetes } = monterVoyage(['/voyage/1896', '/voyage/1897'], {
      ...ROUTES,
      'GET /api/me/voyage': () => ((lectures += 1), json(VOYAGE)),
      'GET /api/me/voyage/annees/1896': () => json(nue({ annee: 1896, recompense: 'lion' })),
      'GET /api/me/voyage/annees/1897': () => json(nue({ ticket: ticket(1898) })),
      'POST /api/me/voyage/tickets/1898/utiliser': () => new Promise<Response>((r) => (repondre = () => r(json({ annee_en_cours: 1898 })))),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser' }))
    await waitFor(() => expect(requetes).toContain('POST /api/me/voyage/tickets/1898/utiliser'))
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    expect(await screen.findByRole('heading', { level: 1, name: '1896' })).toBeInTheDocument()
    const avant = lectures
    await act(async () => repondre())
    await waitFor(() => expect(lectures).toBeGreaterThan(avant))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByRole('heading', { level: 1, name: '1896' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeNull()
  })

  // Mutation : l'invalidation de la carte oubliée : elle garderait l'année d'avant (60 s de cache côté
  // API ne s'y ajoutent pas : c'est le cache du Journal qui mentirait), et ne jouerait pas la marche.
  it('après l’encaissement, la carte relit le Voyage', async () => {
    let lectures = 0
    const fiche = fichePrete({ annee: 1897, ticket: ticket(1898) })
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage': () => ((lectures += 1), json(lectures === 1 ? VOYAGE : { ...VOYAGE, annee_en_cours: 1898 })),
      'GET /api/me/voyage/annees/1897': () => json(fiche),
      'POST /api/me/voyage/tickets/1898/utiliser': () => json({ annee_en_cours: 1898 }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser' }))
    await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })
    await waitFor(() => expect(lectures).toBeGreaterThanOrEqual(2))
  })

  // Mutation : un refus réécrit (« Le ticket n’a pas pu être utilisé ») au lieu du message de l'API.
  it('un refus de l’encaissement s’affiche tel que l’API l’a écrit, et la fiche reste', async () => {
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () => json(nue({ ticket: ticket(1898) })),
      'POST /api/me/voyage/tickets/1898/utiliser': () => json({ code: 'NOT_FOUND', message: 'Ce ticket a déjà servi.', retryable: false }, 404),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce ticket a déjà servi.')
    expect(screen.getByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
  })

  // Le jumeau, côté fiche, du filtre des tickets de la carte. Mutation : `ligneDuBas` appelé avec
  // l'année propre du ticket au lieu de l'année en cours de la carte.
  it('n’offre pas un ticket vers une année déjà ouverte par le rattrapage', async () => {
    const rattrape = { ...VOYAGE, ia: false, rattrape_la_source: true, annee_en_cours: 1899, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1899 } }
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage': () => json(rattrape),
      'GET /api/me/voyage/annees/1897': () => json(nue({ ticket: ticket(1898) })),
    })
    await screen.findByRole('heading', { level: 1, name: '1897' })
    expect(screen.queryByRole('button', { name: 'Utiliser' })).toBeNull()
  })

  // Mutations : la date prise en UTC (`utilise_le.slice(0, 10)` : le 21) ou brute ; le billet qui
  // ne se retourne pas. Minuit et demi à Paris le 22 septembre, encore le 21 à Greenwich.
  it('le billet utilisé dit son jour, celui du téléphone, et se retourne', async () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    monterVoyage('/voyage/1896', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1896': () => json(nue({ annee: 1896, recompense: 'lion', ticket: ticket(1897, '2026-09-21T22:30:00.000Z') })),
    })
    const billet = await screen.findByRole('button', { name: /Bon pour une année/ })
    expect(billet).toHaveTextContent('utilisé le 22 septembre 2026')
    expect(billet).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(billet)
    expect(billet).toHaveAttribute('aria-pressed', 'true')
    expect(billet).toHaveTextContent('Gagné en 1896, poinçonné à l’entrée de 1897.')
  })

  // Mutations : le verdict tu (la ligne `jury` jamais rendue) ; le jury montré sans `ia`.
  it('dit au compte IA que l’année n’est pas encore mûre, jamais à un autre membre', async () => {
    const verdict = nue({ maturite: { mure: false, motif: 'il manque encore deux essentiels.', jugee_le: '2026-09-21T21:00:00.000Z' } })
    const premier = monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(verdict) })
    expect(await screen.findByText(/Pas encore mûre : il manque encore deux essentiels\./)).toBeInTheDocument()
    premier.unmount()
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage': () => json({ ...VOYAGE, ia: false, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1897 } }),
      'GET /api/me/voyage/annees/1897': () => json(verdict),
    })
    await screen.findByRole('heading', { level: 1, name: '1897' })
    expect(screen.queryByText(/Pas encore mûre/)).toBeNull()
    expect(screen.queryByText(/jury/)).toBeNull()
  })

  // Mutations : un billet sans son total ; le libellé au pluriel figé.
  it('la corde nomme chaque billet en entier', async () => {
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () =>
        json(nue({ profondeur: 3, progression: { essentiels_vus: 1, essentiels_total: 5, salles_completes: 0, salles_autres: 3 } })),
    })
    const corde = await screen.findByRole('list', { name: 'La progression de l’année' })
    expect(within(corde).getAllByRole('listitem').map((b) => b.getAttribute('aria-label'))).toEqual(['3 films vus', '1 essentiel sur 5', '0 salle complète sur 3'])
  })

  // Le retour d'un billet (tâche 11) se joue sur la fiche **relue** après le montage, jamais sur celle
  // que le cache garde d'avant l'écriture. Mutation : `isFetchedAfterMount` ignoré (joué sur la fiche en
  // cache, rien n'aurait bougé, et la relecture ne rejouerait plus).
  it('un retour confié se joue sur la fiche relue, pas sur celle du cache', async () => {
    const progression = { essentiels_vus: 0, essentiels_total: 2, salles_completes: 0, salles_autres: 1 }
    confierLeRetour(1897, SESSION.user.id, { avant: { profondeur: 2, progression }, guet: null })
    monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(nue({ profondeur: 3, progression })) }, (c) =>
      c.setQueryData(cles.annee(1897), nue({ profondeur: 2, progression })),
    )
    expect(await screen.findByText('+1 film vu')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('listitem', { name: '3 films vus' })).toBeInTheDocument()
  })

  // Le jumeau : sans billet, une fiche ne roule rien. Mutation : le retour confié pour une autre année lu ici.
  it('sans retour confié pour elle, la fiche ne roule rien', async () => {
    confierLeRetour(1896, SESSION.user.id, { avant: { profondeur: 0, progression: null }, guet: null })
    monterVoyage('/voyage/1897', ROUTES)
    await screen.findByRole('heading', { level: 1, name: '1897' })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/^\+\d/)).toBeNull()
    oublierLeRetour(1896)
  })

  // Une déconnexion, puis un autre membre sur le même onglet. Mutation : la page lit le retour sans son
  // membre (ou le billet le confie sans le sien).
  it('un retour confié par un autre membre ne se joue pas', async () => {
    const progression = { essentiels_vus: 0, essentiels_total: 2, salles_completes: 0, salles_autres: 1 }
    confierLeRetour(1897, 'un-autre-membre', { avant: { profondeur: 2, progression }, guet: null })
    monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(nue({ profondeur: 3, progression })) })
    await screen.findByRole('listitem', { name: '3 films vus' })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/^\+\d/)).toBeNull()
    oublierLeRetour(1897)
  })

  // Les célébrations : au retour d'un billet, ce qu'il a bouclé se fête sur la fiche relue, dans
  // l'ordre, et le choix du billet le marque montré. Mutations : l'effet des célébrations retiré de
  // la page ; `relue` ignoré (la fiche du cache, où rien n'a bougé) ; `fete` oublié de l'avant ;
  // « Le garder » sans `/montre`.
  describe('les célébrations au retour d’un billet', () => {
    const P0 = { essentiels_vus: 1, essentiels_total: 2, salles_completes: 0, salles_autres: 2 }
    const P1 = { essentiels_vus: 2, essentiels_total: 2, salles_completes: 1, salles_autres: 2 }
    const AVANT = { profondeur: 3, progression: P0, fete: { sallesCompletes: 0, salles: [], recompense: 'ours' as const, ticket: null } }
    const APRES = nue({ profondeur: 4, progression: P1, recompense: 'lion', ticket: ticket(1898) })
    const MONTRE = 'POST /api/me/voyage/tickets/1898/montre'
    const routes = {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () => json(APRES),
      [MONTRE]: () => new Response(null, { status: 204 }),
    }
    // Comme en venant du billet : la carte et la fiche d'avant l'écriture sont en cache.
    const monter = (r: typeof routes = routes) =>
      monterVoyage('/voyage/1897', r, (c) => {
        c.setQueryData(cles.voyage, VOYAGE)
        c.setQueryData(cles.annee(1897), nue({ profondeur: 3, progression: P0, recompense: 'ours' }))
      })
    /** Des touchers dans le même instant, avant que React n'ait retiré les boutons de la scène. */
    const toucher = (...boutons: HTMLElement[]) => act(() => boutons.forEach((b) => b.click()))

    it('joue la salle bouclée, la récompense, puis l’année bouclée, et « Le garder » montre le ticket une seule fois', async () => {
      calme()
      confierLeRetour(1897, SESSION.user.id, { avant: AVANT, guet: null })
      const { requetes } = monter()
      expect(await screen.findByRole('dialog', { name: 'Salle complète : Une salle' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
      expect(screen.getByRole('dialog', { name: 'Le Lion : les essentiels de 1897' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
      expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
      const lectures = () => requetes.filter((r) => r === 'GET /api/me/voyage').length
      const avant = lectures()
      toucher(screen.getByRole('button', { name: 'Le garder' }), screen.getByRole('button', { name: 'Le garder' }))
      await waitFor(() => expect(requetes).toContain(MONTRE))
      expect(screen.queryByRole('dialog')).toBeNull()
      // La fiche reste là, son ticket en bas : le garder n'encaisse rien.
      expect(screen.getByText('Ton ticket pour 1898 t’attend')).toBeInTheDocument()
      // Les deux touchers sont du même instant : un second `/montre` serait parti avec le premier. La
      // relecture de la carte, qui suit sa réponse, clôt l'attente.
      await waitFor(() => expect(lectures()).toBeGreaterThan(avant))
      expect(requetes.filter((r) => r === MONTRE)).toHaveLength(1)
      expect(requetes.filter((r) => r.includes('/utiliser'))).toEqual([])
    })

    // Correction du brief : « L’utiliser » encaisse le ticket comme le « Utiliser » du bas de la fiche,
    // et mène à la carte. Mutations : `/montre` oublié de « L’utiliser » ; l'encaissement non branché.
    it('« L’utiliser » montre le ticket une seule fois, l’encaisse, et mène à la carte', async () => {
      calme()
      confierLeRetour(1897, SESSION.user.id, { avant: { ...AVANT, fete: { ...AVANT.fete, sallesCompletes: 1, recompense: 'lion' } }, guet: null })
      const { requetes } = monter({ ...routes, 'POST /api/me/voyage/tickets/1898/utiliser': () => json({ annee_en_cours: 1898 }) } as typeof routes)
      expect(await screen.findByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
      toucher(screen.getByRole('button', { name: 'L’utiliser' }), screen.getByRole('button', { name: 'L’utiliser' }), screen.getByRole('button', { name: 'Le garder' }))
      expect(await screen.findByRole('heading', { name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
      expect(requetes.filter((r) => r === MONTRE)).toHaveLength(1)
      expect(requetes.filter((r) => r === 'POST /api/me/voyage/tickets/1898/utiliser')).toHaveLength(1)
    })

    // Mutation : la fiche fêtée pour ce qu'elle porte, non pour ce qui a changé (elle se fêterait à
    // chaque billet).
    it('rien ne se joue quand le billet n’a rien bouclé', async () => {
      calme()
      confierLeRetour(1897, SESSION.user.id, {
        avant: { profondeur: 3, progression: P1, fete: { sallesCompletes: 1, salles: [], recompense: 'lion', ticket: 1898 } },
        guet: null,
      })
      monter()
      // Les gains et les célébrations se comparent dans le même rendu, sur la même relecture : l'annonce
      // dite, la fête se serait montrée avec elle. `act` vide ce qui resterait à rendre.
      expect(await screen.findByText('+1 film vu')).toBeInTheDocument()
      await act(async () => undefined)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // Le ticket du jury arrive après le billet, pendant le guet : l'année se boucle alors, elle seule.
    // Mutations : la comparaison arrêtée à la première relecture, même le verdict guetté ; le jumeau,
    // la comparaison poursuivie sans guet (une relecture quelconque ferait la fête).
    it.each([
      ['guetté, le ticket du jury boucle l’année quand il arrive', { depuis: null }, true],
      ['sans guet, une relecture plus tard ne fête rien', null, false],
    ] as const)('%s', async (_nom, guet, fete) => {
      calme()
      vi.useFakeTimers({ shouldAdvanceTime: true })
      let lectures = 0
      confierLeRetour(1897, SESSION.user.id, { avant: { ...AVANT, fete: { ...AVANT.fete, sallesCompletes: 1, recompense: 'lion' } }, guet })
      const { client } = monter({
        ...routes,
        // La relecture qui apporte le ticket apporte aussi la Palme (un autre appareil) : pendant le
        // guet, l'année seule se fête. Mutation : le filtre `s.type === 'annee'` retiré.
        'GET /api/me/voyage/annees/1897': () => ((lectures += 1), json(lectures === 1 ? { ...APRES, ticket: null } : { ...APRES, recompense: 'palme' })),
      })
      expect(await screen.findByText(/^\+1 film vu/)).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).toBeNull()
      await act(() => vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms))
      if (!guet) await act(() => client.refetchQueries({ queryKey: cles.annee(1897), exact: true }))
      await waitFor(() => expect(lectures).toBeGreaterThanOrEqual(2))
      expect(await screen.findByText('Ton ticket pour 1898 t’attend')).toBeInTheDocument()
      if (fete) expect(screen.getByRole('dialog', { name: '1897 est bouclée' })).toBeInTheDocument()
      else expect(screen.queryByRole('dialog')).toBeNull()
    })

    // Une relecture en panne laisse la fiche du cache à l'écran : rien n'y a bougé, et la comparer
    // consommerait le retour. Mutation : `!requete.isError` retiré de `relue` (la relecture réussie
    // qui suit ne fêterait ni n'annoncerait plus rien).
    it('une relecture en panne ne consomme pas le retour : la suivante, réussie, fête et annonce', async () => {
      calme()
      let lectures = 0
      confierLeRetour(1897, SESSION.user.id, { avant: AVANT, guet: null })
      const { client } = monter({
        ...routes,
        'GET /api/me/voyage/annees/1897': () =>
          (lectures += 1) === 1 ? json({ code: 'INTERNAL', message: 'Le service a un souci.', retryable: false }, 500) : json(APRES),
      })
      await waitFor(() => expect(client.getQueryState(cles.annee(1897))?.status).toBe('error'))
      await act(async () => undefined)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByText(/^\+1 film vu/)).toBeNull()
      await act(() => client.refetchQueries({ queryKey: cles.annee(1897), exact: true }))
      expect(await screen.findByRole('dialog', { name: 'Salle complète : Une salle' })).toBeInTheDocument()
      expect(screen.getByText(/^\+1 film vu/)).toBeInTheDocument()
    })
  })

  // Mutation : le programme rendu pour une année bouclée ; les trous pris à la mauvaise valeur.
  it('le programme de l’année en cours perce les trous des essentiels et des salles', async () => {
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1897': () =>
        json(nue({ recompense: 'ours', profondeur: 4, progression: { essentiels_vus: 3, essentiels_total: 5, salles_completes: 1, salles_autres: 3 } })),
    })
    const programme = await screen.findByRole('region', { name: 'Prochain pas' })
    const lion = within(programme).getByText('Lion : encore 2 essentiels').closest('li')!
    expect(within(lion).getByRole('img', { name: '3 percés sur 5' }).querySelectorAll('[data-perce="true"]')).toHaveLength(3)
    const palme = within(programme).getByText('Palme : 1 salle de plus').closest('li')!
    // Mutation : le pluriel figé (« 1 percés »).
    expect(within(palme).getByRole('img', { name: '1 percé sur 2' }).querySelectorAll('i')).toHaveLength(2)
    expect(within(programme).getByText('Ticket : au Lion, ou plus tôt si le jury le décide')).toBeInTheDocument()
  })

  // Mutation : `v.ia` passé vrai à `prochainPas` : un membre hors IA se verrait promettre le jury.
  it('le programme ne promet pas le jury à un membre hors IA', async () => {
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'GET /api/me/voyage': () => json({ ...VOYAGE, ia: false, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1897 } }),
      'GET /api/me/voyage/annees/1897': () => json(nue()),
    })
    expect(await screen.findByText('Ticket : au Lion')).toBeInTheDocument()
  })

  // Mutations : le ruban oublié ; la récompense prise à la carte au lieu de la fiche.
  it('une année bouclée : sa soirée de gala, son ruban, et pas de programme', async () => {
    monterVoyage('/voyage/1895', { ...ROUTES, 'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895, recompense: 'palme' })) })
    expect(await screen.findByText('Soirée de gala')).toBeInTheDocument()
    expect(screen.getByText('Bouclée · Palme')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Palme' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Prochain pas' })).toBeNull()
  })

  it('une année bouclée sans récompense porte « Bouclée » seul', async () => {
    monterVoyage('/voyage/1895', { ...ROUTES, 'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895, recompense: null })) })
    expect(await screen.findByText('Bouclée')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Palme' })).toBeNull()
  })

  // Mutations : l'ouverture entière dans le boniment ; « Lire l’ouverture » sans calque ; la feuille
  // qui ne se ferme pas ; les échos oubliés.
  it('le boniment montre le premier paragraphe et les échos, la feuille lit l’ouverture entière, puis se ferme', async () => {
    const ouverture = 'Le premier paragraphe du boniment.\n\nLe second, que seule la feuille montre.'
    calme()
    monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(nue({ ouverture, faits: ['Un premier écho.', 'Un second écho.'] })) })
    const boniment = await screen.findByRole('region', { name: 'Boniment d’ouverture' })
    expect(within(boniment).getByText('Le premier paragraphe du boniment.')).toBeInTheDocument()
    const echos = within(boniment).getByRole('heading', { name: 'Échos de l’année' }).nextElementSibling as HTMLElement
    expect(within(echos).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Un premier écho.', 'Un second écho.'])
    expect(screen.queryByText('Le second, que seule la feuille montre.')).toBeNull()
    fireEvent.click(within(boniment).getByRole('button', { name: 'Lire l’ouverture' }))
    const feuille = await screen.findByRole('dialog', { name: 'Ouverture 1897' })
    expect(within(feuille).getByText('Le second, que seule la feuille montre.')).toBeInTheDocument()
    fireEvent.click(within(feuille).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  // Mutation : `afficherGenerique` ignoré : le générique s'offrirait sans ticket (`409`).
  it('n’offre le générique qu’avec le ticket de l’année', async () => {
    monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(nue()) })
    await screen.findByRole('heading', { level: 1, name: '1897' })
    expect(screen.queryByRole('button', { name: 'Le générique de fin' })).toBeNull()
  })

  // Mutations : le texte écrit oublié dans la fiche en cache (rouvrir rappellerait le chroniqueur) ;
  // `enabled` sans la feuille (le générique s'écrirait à l'ouverture de la page).
  it('écrit le générique à sa première lecture seulement', async () => {
    calme()
    let appels = 0
    const { requetes } = monterVoyage('/voyage/1895', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895, ticket: ticket(1896, '2026-09-20T10:00:00.000Z') })),
      'POST /api/me/voyage/annees/1895/generique': () => ((appels += 1), json({ generique: 'Tu as bouclé 1895 sur la Palme.' })),
    })
    const lien = await screen.findByRole('button', { name: 'Le générique de fin' })
    expect(requetes).not.toContain('POST /api/me/voyage/annees/1895/generique')
    fireEvent.click(lien)
    // La lettrine détache la première lettre : le texte se lit dans la feuille entière.
    const feuille = await screen.findByRole('dialog', { name: 'Générique Le générique de fin' })
    await waitFor(() => expect(feuille).toHaveTextContent('Tu as bouclé 1895 sur la Palme.'))
    fireEvent.click(within(feuille).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Le générique de fin' }))
    expect(await screen.findByRole('dialog', { name: 'Générique Le générique de fin' })).toHaveTextContent('Tu as bouclé 1895 sur la Palme.')
    expect(appels).toBe(1)
  })

  // Mutation : le texte écrit laissé hors de la fiche en cache : la carte, qui lit ces fiches, et la
  // page, passé le délai de fraîcheur du générique, le croiraient encore à écrire.
  it('inscrit le générique écrit dans la fiche en cache', async () => {
    calme()
    const { client } = monterVoyage('/voyage/1895', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895, ticket: ticket(1896, '2026-09-20T10:00:00.000Z') })),
      'POST /api/me/voyage/annees/1895/generique': () => json({ generique: 'Tu as bouclé 1895 sur la Palme.' }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Le générique de fin' }))
    await waitFor(() => expect(client.getQueryData<FichePrete>(cles.annee(1895))?.generique).toBe('Tu as bouclé 1895 sur la Palme.'))
  })

  // Mutation : `enabled` sans `generique === null` : un générique déjà écrit se redemanderait.
  it('ne redemande jamais un générique déjà écrit', async () => {
    calme()
    const { requetes } = monterVoyage('/voyage/1895', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895, ticket: ticket(1896, '2026-09-20T10:00:00.000Z'), generique: 'Déjà écrit.' })),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Le générique de fin' }))
    expect(await screen.findByRole('dialog', { name: 'Générique Le générique de fin' })).toHaveTextContent('Déjà écrit.')
    expect(requetes.some((r) => r.endsWith('/generique'))).toBe(false)
  })

  // Mutations : l'erreur du générique réécrite, ou tue (la feuille attendrait sans fin) ; « Réessayer »
  // qui ne relance rien.
  it('un générique refusé s’affiche tel que l’API l’a écrit, et se redemande à « Réessayer »', async () => {
    calme()
    let n = 0
    monterVoyage('/voyage/1895', {
      ...ROUTES,
      'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895, ticket: ticket(1896, '2026-09-20T10:00:00.000Z') })),
      'POST /api/me/voyage/annees/1895/generique': () =>
        ++n === 1
          ? json({ code: 'UPSTREAM_UNAVAILABLE', message: 'Le chroniqueur est indisponible.', retryable: false }, 503)
          : json({ generique: 'Tu as bouclé 1895 sur la Palme.' }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Le générique de fin' }))
    expect(await screen.findByText('Le chroniqueur est indisponible.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Générique Le générique de fin' })).toHaveTextContent('Tu as bouclé 1895 sur la Palme.'))
  })

  // Mutations : un registre qui rend toujours le monde 1890 : 1902 porterait la baraque ; `pages:
  // PAGES_A_VENIR` remis au monde 1900 : 1902 porterait le papier d'un monde « à venir ».
  it.each([
    [1897, '#e8d8bf'],
    [1902, '#eee4cf'],
    [1912, '#f2e8d5'],
  ])('pose sur la page de %i les jetons de son monde', async (an, papier) => {
    monterVoyage(`/voyage/${an}`, {
      ...ROUTES,
      [`GET /api/me/voyage/annees/${an}`]: () => json(an === 1897 ? FICHE : ficheVerrouillee(an)),
      [JOURNAL(an)]: journal([]),
    })
    const page = await screen.findByRole('region', { name: `L’année ${an}` })
    expect(page.style.getPropertyValue('--m-papier')).toBe(papier)
  })

  // Mutations : le titre du passeport en dur, ou oublié quand le monde en a un.
  it('l’intertitre d’une année fermée annonce le tampon de son monde, s’il en a un', async () => {
    monterVoyage('/voyage/1898', { ...ROUTES, 'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898)), [JOURNAL(1898)]: journal([]) })
    const intertitre = await screen.findByText(/Au bout des années 1890, le tampon « Spectateur des origines »\./)
    // Les guillemets tiennent leur mot par une espace insécable (le texte cherché les voit normalisées) :
    // jamais « » seul en début de ligne. Mutation : une espace ordinaire.
    expect(intertitre.textContent).toContain(`«${INSECABLE}Spectateur des origines${INSECABLE}».`)
  })

  it('l’intertitre d’un monde à venir n’annonce aucun tampon', async () => {
    // 1912 : les années 1900 ont leur monde au registre (plan 3b), les années 1910 pas encore.
    monterVoyage('/voyage/1912', { ...ROUTES, 'GET /api/me/voyage/annees/1912': () => json(ficheVerrouillee(1912)), [JOURNAL(1912)]: journal([]) })
    await screen.findByText('Un monde à venir.')
    expect(screen.queryByText(/le tampon/)).toBeNull()
  })

  describe('le bandeau', () => {
    // Mutation : le mode tiré de la carte seule (une fiche en attente peindrait la baraque en cours).
    it.each([
      ['/voyage/1895', 'bouclee', () => json(nue({ annee: 1895, recompense: 'palme' }))],
      ['/voyage/1897', 'encours', () => json(nue())],
      ['/voyage/1898', 'fermee', () => json(ficheVerrouillee(1898))],
      ['/voyage/1897', 'attente', () => json(ficheEnAttente(1897))],
    ] as const)('%s se peint en mode %s', async (chemin, mode, fiche) => {
      calme()
      const dernier = epierLeBandeau()
      const annee = chemin.slice(-4)
      monterVoyage(chemin, { ...ROUTES, [`GET /api/me/voyage/annees/${annee}`]: fiche, [JOURNAL(annee)]: journal([]) })
      await screen.findByRole('heading', { level: 1, name: annee })
      await waitFor(() => expect(dernier().mode).toBe(mode))
      expect(dernier().annee).toBe(Number(annee))
    })

    // Tant que la fiche se lit, le bandeau suit la carte : pour la lectrice, une année que le Voyage
    // suivi n'a pas encore ouverte est en attente (`etatDeCase`, le jumeau de la carte), jamais la
    // baraque en cours. Mutation : le mode tiré du seul statut de l'année (`statutDeLAnnee`).
    it.each([
      { cas: 'à la lectrice', ia: false, mode: 'attente' },
      { cas: 'au compte IA', ia: true, mode: 'encours' },
    ] as const)('tant que la fiche se lit, une année non ouverte se peint d’après la carte ($cas)', async ({ ia, mode }) => {
      calme()
      const dernier = epierLeBandeau()
      const carte = {
        ...VOYAGE,
        ia,
        source: ia ? null : { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1896 },
        annees: VOYAGE.annees.map((a) => (a.annee === 1897 ? { ...a, visitee: false } : a)),
      }
      monterVoyage('/voyage/1897', {
        ...ROUTES,
        'GET /api/me/voyage': () => json(carte),
        // La fiche ne répond jamais : la page reste au chargement.
        'GET /api/me/voyage/annees/1897': () => new Promise<Response>(() => undefined),
      })
      await screen.findByRole('status')
      // Avant la carte, le bandeau se peint déjà « en cours » (`modeDuBandeau` sans `v`) : attendre une
      // image peinte d'après la carte (ses cases), sans quoi le témoin du compte IA passerait avant
      // qu'elle soit lue. Mutation : l'attente lue hors IA pour tout le monde (`etatDeCase(a, false)`).
      await waitFor(() => expect(dernier().cases.length).toBeGreaterThan(0))
      expect(dernier().mode).toBe(mode)
      expect(dernier().annee).toBe(1897)
    })

    // La fiche lue l'emporte sur la carte : theo a ouvert l'année depuis que la carte a été lue.
    // Mutation : l'attente de la carte prise même quand la fiche est là.
    it('une fiche prête l’emporte sur une carte qui la croyait en attente', async () => {
      calme()
      const dernier = epierLeBandeau()
      const carte = {
        ...VOYAGE,
        ia: false,
        source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1897 },
        annees: VOYAGE.annees.map((a) => (a.annee === 1897 ? { ...a, visitee: false } : a)),
      }
      monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage': () => json(carte) })
      await screen.findByRole('heading', { level: 1, name: '1897' })
      await screen.findByRole('region', { name: 'Boniment d’ouverture' })
      await waitFor(() => expect(dernier().mode).toBe('encours'))
    })

    // Mutations : la roulotte réservée à l'attente (décision de l'orchestrateur : dans tous les modes) ;
    // donnée au compte IA ; son année prise à la carte du membre.
    it('porte la roulotte du Voyage suivi dans tous les modes, jamais au compte IA', async () => {
      calme()
      const dernier = epierLeBandeau()
      const horsIa = { ...VOYAGE, ia: false, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1896 } }
      const premier = monterVoyage('/voyage/1895', {
        ...ROUTES,
        'GET /api/me/voyage': () => json(horsIa),
        'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895 })),
      })
      await screen.findByRole('heading', { level: 1, name: '1895' })
      await waitFor(() => expect(dernier().roulotte).toEqual({ pseudo: 'theo', annee: 1896 }))
      premier.unmount()
      monterVoyage('/voyage/1895', { ...ROUTES, 'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895 })) })
      await screen.findByRole('heading', { level: 1, name: '1895' })
      await waitFor(() => expect(dernier().mode).toBe('bouclee'))
      expect(dernier().roulotte).toBeNull()
    })

    // Mutations : `bouclee` lu sans le tampon ; les cases d'une autre décennie passées au monde ;
    // la récompense oubliée.
    it('remplit la foire des années de son monde, du tampon de la décennie, et de la récompense', async () => {
      calme()
      const dernier = epierLeBandeau()
      const voyage: Voyage = {
        ...VOYAGE,
        tampons: [{ decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' }],
        annees: [...VOYAGE.annees, { ...VOYAGE.annees[0]!, annee: 1900, statut: 'verrouillee', recompense: null }],
      }
      monterVoyage('/voyage/1896', {
        ...ROUTES,
        'GET /api/me/voyage': () => json(voyage),
        'GET /api/me/voyage/annees/1896': () => json(nue({ annee: 1896, recompense: 'lion' })),
      })
      await screen.findByRole('heading', { level: 1, name: '1896' })
      await waitFor(() => expect(dernier().recompense).toBe('lion'))
      expect(dernier().bouclee).toBe(true)
      expect(dernier().cases.map((c) => [c.annee, c.etat])).toEqual([
        [1895, 'palme'],
        [1896, 'lion'],
        [1897, 'encours'],
        [1898, 'verrou'],
        [1899, 'verrou'],
      ])
    })

    // Le jumeau : le tampon d'une autre décennie ne remplit pas cette foire. Mutation : `bouclee` dès
    // qu'un tampon existe.
    it('ne tient pas une décennie pour bouclée sur le tampon d’une autre', async () => {
      calme()
      const dernier = epierLeBandeau(PAGES_A_VENIR)
      // Une année d'un monde « à venir », qui peint encore son bandeau sur une toile (1900 compose sa tête).
      monterVoyage('/voyage/1912', {
        ...ROUTES,
        'GET /api/me/voyage': () => json({ ...VOYAGE, tampons: [{ decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' }] }),
        'GET /api/me/voyage/annees/1912': () => json(ficheVerrouillee(1912)),
        [JOURNAL(1912)]: journal([]),
      })
      await screen.findByRole('heading', { level: 1, name: '1912' })
      await waitFor(() => expect(dernier().mode).toBe('fermee'))
      expect(dernier().bouclee).toBe(false)
      expect(dernier().cases).toEqual([])
    })

    // Mutation : le toucher du bandeau oublié : le rideau ne se rouvrirait plus, le manège ne s'emballerait pas.
    it('un toucher rouvre le rideau et emballe le manège, à l’instant de la toile', async () => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      const dernier = epierLeBandeau()
      monterVoyage('/voyage/1897', ROUTES)
      await screen.findByRole('heading', { level: 1, name: '1897' })
      act(() => void vi.advanceTimersByTime(2_000))
      expect(dernier().touche).toBe(-9)
      fireEvent.pointerDown(screen.getByRole('img', { name: 'Le décor de 1897.' }))
      act(() => void vi.advanceTimersByTime(20))
      expect(dernier().touche).toBeGreaterThan(1.9)
      expect(dernier().touche).toBeLessThan(dernier().t)
    })
  })
  // Plan des pages 1900, brief 0 : un monde peut composer une section à la place de la page
  // (`Monde.pages.gabarits`). Le monde de test est celui de 1890, auquel on prête un gabarit.
  describe('les gabarits du monde', () => {
    let remettre: (() => void) | null = null
    afterEach(() => {
      remettre?.()
      remettre = null
    })

    /** Prête à un monde un gabarit du corps d'une année fermée, qui dit ce qu'il a reçu. */
    function preterUnGabarit(pages: HabillagePages = PAGES_1890) {
      const recues: PropsAnneeFermee[] = []
      const Gabarit = (p: PropsAnneeFermee) => {
        recues.push(p)
        return (
          <section aria-label="Le gabarit du monde">
            {`${p.annee} ${p.variante}`}
            {p.parade}
          </section>
        )
      }
      const avant = pages.gabarits
      pages.gabarits = { anneeFermee: Gabarit }
      remettre = () => void (pages.gabarits = avant)
      return () => recues[recues.length - 1]!
    }

    // Mutations : `gabaritDe` qui rend toujours le défaut ; la page qui monte `AnneeFermee` sans
    // passer par lui ; une propriété que la page ne passerait plus au gabarit.
    it('monte le gabarit du monde à la place du corps d’une année fermée, avec les mêmes propriétés', async () => {
      const derniere = preterUnGabarit()
      const { requetes } = monterVoyage('/voyage/1898', {
        ...ROUTES,
        'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898, { profondeur: 1 })),
        [JOURNAL(1898)]: journal([vu('e1', 'Un film de 1898', 1898)]),
      })
      expect(await screen.findByRole('region', { name: 'Le gabarit du monde' })).toHaveTextContent('1898 fermee')
      // Le défaut n'est plus là : ni sa pancarte, ni son chemin.
      expect(screen.queryByText('Cette année s’ouvre avec le ticket de 1897.')).toBeNull()
      expect(screen.queryByRole('list', { name: /^Chemin/ })).toBeNull()
      // La page garde ses lectures et les passe : le gabarit ne lit rien lui-même.
      await waitFor(() => expect(derniere().journal.items?.map((e) => e.entry.id)).toEqual(['e1']))
      expect(requetes).toContain(JOURNAL(1898))
      const { monde, voyage, profondeur, parade, annee, variante } = derniere()
      expect({ decennie: monde.decennie, enCours: voyage.annee_en_cours, profondeur, parade, annee, variante }).toEqual({
        decennie: 1890,
        enCours: 1897,
        profondeur: 1,
        parade: null,
        annee: 1898,
        variante: 'fermee',
      })
    })

    // Le jumeau : une année en attente passe par le même gabarit, et sa parade reste un nœud que la
    // page monte. Mutations : le gabarit lu pour la seule année verrouillée ; la parade retirée de ce
    // que la page passe.
    it('passe au gabarit l’année en attente et sa parade toute montée', async () => {
      preterUnGabarit()
      monterVoyage('/voyage/1897', {
        ...ROUTES,
        'GET /api/me/voyage': () => json({ ...VOYAGE, ia: false, source: { id: SOURCE_ID, pseudo: 'theo', annee_en_cours: 1896 } }),
        'GET /api/me/voyage/annees/1897': () => json(ficheEnAttente(1897)),
        [JOURNAL(1897)]: journal([]),
      })
      const gabarit = await screen.findByRole('region', { name: 'Le gabarit du monde' })
      expect(gabarit).toHaveTextContent('1897 attente')
      expect(within(gabarit).getByRole('region', { name: 'La parade, le podium' })).toBeInTheDocument()
      expect(screen.queryByText('theo est trop lent')).toBeNull()
    })

    // Le gabarit est celui du monde de l'année, pas d'un autre : prêté au monde « à venir », il ne
    // change rien à 1890, qui rend son défaut. Mutation : le gabarit lu dans un autre monde que
    // celui de la décennie.
    it('ne prend que le gabarit du monde de l’année : un autre monde garde le défaut', async () => {
      preterUnGabarit(PAGES_A_VENIR)
      monterVoyage('/voyage/1898', {
        ...ROUTES,
        'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898)),
        [JOURNAL(1898)]: journal([]),
      })
      expect(await screen.findByText('Cette année s’ouvre avec le ticket de 1897.')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Le gabarit du monde' })).toBeNull()
    })

    // Plan des pages 1900, brief 1 : la tête et le fronton sont deux sections de plus. Le défaut
    // reste sans gabarit : tout le describe « le bandeau » et les titres de niveau 1 de ce fichier
    // le tiennent pour 1890. Mutations : la page qui monte `Bandeau` ou `Fronton` sans passer par
    // `gabaritDe` ; une propriété que la page ne passerait plus à la tête.
    it('monte la tête et le fronton du monde à la place du bandeau et du fronton, sans toucher au retour ni à la plaque', async () => {
      const tetes: PropsTeteDAnnee[] = []
      const avant = PAGES_1890.gabarits
      PAGES_1890.gabarits = {
        teteDAnnee: (p: PropsTeteDAnnee) => {
          tetes.push(p)
          return <h1>{`La tête de ${p.annee}`}</h1>
        },
        fronton: (p: PropsFronton) => (
          <p>
            {`Le fronton du monde, ${p.annonce}, ${p.millesime}`}
            {p.children}
          </p>
        ),
      }
      remettre = () => void (PAGES_1890.gabarits = avant)
      monterVoyage('/voyage/1895', { ...ROUTES, 'GET /api/me/voyage/annees/1895': () => json(nue({ annee: 1895, recompense: 'palme' })) })
      expect(await screen.findByText(/^Le fronton du monde, Soirée de gala, bouclee/)).toHaveTextContent('Bouclée · Palme')
      // Ni la toile du bandeau ni le millésime du fronton par défaut : un seul titre, celui de la tête.
      expect(screen.queryByRole('img', { name: 'Le décor de 1895.' })).toBeNull()
      expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['La tête de 1895'])
      const derniere = tetes[tetes.length - 1]!
      expect({ decennie: derniere.monde.decennie, mode: derniere.mode, annee: derniere.annee, recompense: derniere.recompense, bouclee: derniere.bouclee, roulotte: derniere.roulotte, calme: derniere.calme }).toEqual({
        decennie: 1890,
        mode: 'bouclee',
        annee: 1895,
        recompense: 'palme',
        bouclee: false,
        roulotte: null,
        calme: false,
      })
      expect(derniere.cases.map((c) => c.annee)).toEqual([1895, 1896, 1897, 1898, 1899])
      // Ce qui reste à la page.
      expect(screen.getByRole('link', { name: 'Retour à la carte' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Chapitre I' })).toHaveAttribute('href', '/voyage/decennies/1890')
    })

    // Le jumeau : la forme « en préparation » monte le même fronton. Mutation : `Fronton` remis en dur
    // dans cette seule forme.
    it('monte le fronton du monde sur une année en préparation', async () => {
      const avant = PAGES_1890.gabarits
      PAGES_1890.gabarits = { fronton: (p: PropsFronton) => <p>{`Le fronton du monde, ${p.annonce}, ${p.millesime}`}</p> }
      remettre = () => void (PAGES_1890.gabarits = avant)
      monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage/annees/1897': () => json(EN_PREPARATION, 202) })
      expect(await screen.findByText('Le fronton du monde, Grande attraction, encours')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
      // La tête, elle, garde son défaut : une clé ne décide pas de l'autre.
      expect(screen.getByRole('img', { name: 'Le décor de 1897.' })).toBeInTheDocument()
    })
  })
})
