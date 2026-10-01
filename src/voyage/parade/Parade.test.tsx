import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { JournalItem, JournalPage } from '../../api/journal'
import type { FichePrete, Marche, Voyage } from '../../api/voyage'
import { exemple } from '../../test/contrat'
import { visionnage } from '../../test/journal'
import { monterVoyage } from '../../test/pageVoyage'
import { json } from '../../test/serveur'
import { ficheEnAttente, ficheVerrouillee, filmDeSalle, fichePrete, salle, voyage1890 } from '../../test/voyage'

const SOURCE = { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1897 }
const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: null },
    { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)

const KANE = filmDeSalle({ id: 'f-kane', tmdb_id: 15, title: 'Citizen Kane', etat: 'vu', note: 9 })
const FAUCON = filmDeSalle({ id: 'f-faucon', tmdb_id: 963, title: 'Le Faucon maltais', etat: 'a_demander', note: null })
const BOBINE = { tmdb_id: 501, title: 'La Sortie de l’usine', duree_min: 1, cover_url: null, plex_url: null, etat: 'vu' as const }
const PROGRAMME = filmDeSalle({ id: 'f-prog', tmdb_id: 500, title: 'Le programme Lumière', etat: 'vu', programme: { duree_min: 1, bobines: [BOBINE] } })
const PROGRAMME_A_VOIR = filmDeSalle({
  id: 'f-prog2',
  tmdb_id: 510,
  title: 'Un programme à voir',
  etat: 'a_demander',
  programme: { duree_min: 1, bobines: [{ ...BOBINE, tmdb_id: 511, etat: 'a_demander' }] },
})
const ESSENTIELS = salle({ id: 's-ess', nom: 'Les essentiels', films: [KANE, FAUCON, PROGRAMME, PROGRAMME_A_VOIR] })

const SUR_LA_1: Marche = { place: 1, tmdb_id: 15, programme_id: null, title: 'Citizen Kane', cover_url: null, backdrop_url: null }

/** Une fiche prête de 1897 sans ticket, verdict ni séance : chaque test pose son podium. */
const fiche = (s: Partial<FichePrete> = {}) =>
  fichePrete({
    annee: 1897,
    ticket: null,
    maturite: null,
    generique: null,
    seances: [],
    seance_en_cours: false,
    salles: [ESSENTIELS],
    pistes: [],
    demande_salle: null,
    podium: [SUR_LA_1, null, null],
    ...s,
  })

const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
/** Mes films sortis l'année de la fiche, et eux seuls : le feuillet d'une marche ne lit jamais tout le journal. */
const JOURNAL = (annee = 1897) => `GET /api/me/journal?limit=100&sortie_min=${annee}&sortie_max=${annee}`
/** Un film de mon journal, avec son identifiant TMDB : l'exemple du contrat les ferait tous `27205`. */
const vu = (id: string, titre: string, annee: number, tmdb: number, note: number | null = null): JournalItem => {
  const v = visionnage({ id, titre, annee, date: '2026-09-01', note })
  return { ...v, media: { ...v.media, external_id: String(tmdb) } }
}
const MON_JOURNAL = [vu('e1', 'Un film de 1897', 1897, 101, 8), vu('e2', 'Un film de 1898', 1898, 102)]
const journal = (items: JournalItem[]) => () => json({ ...PAGE, items, next_cursor: null })

const ANNEE = 'GET /api/me/voyage/annees/1897'
const CARTE = 'GET /api/me/voyage'
const ROUTES = {
  [CARTE]: () => json(VOYAGE),
  [ANNEE]: () => json(fiche()),
  [JOURNAL()]: journal(MON_JOURNAL),
}

const corps = (init: RequestInit) => JSON.parse(String(init.body)) as unknown
const compte = (requetes: string[], cle: string) => requetes.filter((r) => r === cle).length
const laMarche = (n: number) => screen.findByRole('button', { name: new RegExp(`^Marche ${n} : `) })

describe('la parade du podium', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('montre les trois marches, l’occupant de chacune ou « à venir »', async () => {
    monterVoyage('/voyage/1897', ROUTES)
    expect(await laMarche(1)).toHaveAccessibleName('Marche 1 : Citizen Kane')
    expect(screen.getByRole('button', { name: 'Marche 2 : à venir, poser un film' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marche 3 : à venir, poser un film' })).toBeInTheDocument()
    expect(screen.getByText('Toucher une marche pour y poser un film · appui long pour la vider')).toBeInTheDocument()
  })

  // Mutations : `candidats` lu pour une autre année que celle de la fiche ; l'invalidation retirée (la
  // fiche ne se relirait pas), ou réduite à la fiche (la carte garderait l'affiche de l'ancien n° 1) ;
  // les salles de la fiche non passées (aucun programme).
  it('le feuillet d’une marche vide propose mes films de l’année et les programmes vus, sans « Retirer » ; choisir pose le film et relit la fiche et la carte', async () => {
    let pose: unknown
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      'PUT /api/me/voyage/annees/1897/podium/2': (init) => ((pose = corps(init)), json({ podium: [SUR_LA_1, null, null] })),
    })
    fireEvent.click(await laMarche(2))
    const feuillet = await screen.findByRole('dialog', { name: 'Marche 2' })
    const film = await within(feuillet).findByRole('button', { name: /Un film de 1897/ })
    expect(within(feuillet).getByRole('button', { name: /Le programme Lumière/ })).toBeInTheDocument()
    expect(within(feuillet).queryByRole('button', { name: /Un film de 1898/ })).toBeNull()
    expect(within(feuillet).queryByRole('button', { name: /Un programme à voir/ })).toBeNull()
    expect(within(feuillet).queryByRole('button', { name: 'Retirer' })).toBeNull()
    expect(compte(requetes, ANNEE)).toBe(1)
    fireEvent.click(film)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(pose).toEqual({ tmdb_id: 101 })
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    await waitFor(() => expect(compte(requetes, CARTE)).toBe(2))
  })

  // Mutation : le programme posé par son titre, ou son `tmdb_id` (le corps, côté page, réduit au film).
  it('un programme vu se pose par son identifiant de programme', async () => {
    let pose: unknown
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'PUT /api/me/voyage/annees/1897/podium/3': (init) => ((pose = corps(init)), json({ podium: [SUR_LA_1, null, null] })),
    })
    fireEvent.click(await laMarche(3))
    const feuillet = await screen.findByRole('dialog', { name: 'Marche 3' })
    fireEvent.click(await within(feuillet).findByRole('button', { name: /Le programme Lumière/ }))
    await waitFor(() => expect(pose).toEqual({ programme_id: 'f-prog' }))
  })

  // Mutation : le journal lu dès la parade montée (`enabled` toujours vrai) : chaque fiche prête lirait
  // tout mon journal, page après page, sans que je touche une marche.
  it('ne lit mon journal qu’à l’ouverture d’un feuillet', async () => {
    const { requetes } = monterVoyage('/voyage/1897', ROUTES)
    await laMarche(1)
    await new Promise((r) => setTimeout(r, 50))
    expect(compte(requetes, JOURNAL())).toBe(0)
    fireEvent.click(await laMarche(2))
    await within(await screen.findByRole('dialog', { name: 'Marche 2' })).findByRole('button', { name: /Un film de 1897/ })
    expect(compte(requetes, JOURNAL())).toBe(1)
  })

  // Mutations : `viderLaMarche` jamais appelé (« Retirer » poserait) ; l'occupant non coché.
  it('une marche occupée : son occupant coché, et « Retirer » vide la marche, puis relit la fiche', async () => {
    let videe = 0
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [JOURNAL()]: journal([vu('e1', 'Citizen Kane', 1897, 15, 9), ...MON_JOURNAL]),
      'DELETE /api/me/voyage/annees/1897/podium/1': () => ((videe += 1), new Response(null, { status: 204 })),
    })
    fireEvent.click(await laMarche(1))
    const feuillet = await screen.findByRole('dialog', { name: 'Marche 1' })
    expect(await within(feuillet).findByRole('button', { name: /Citizen Kane/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(feuillet).getByRole('button', { name: /Un film de 1897/ })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Retirer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(videe).toBe(1)
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
  })

  // Mutations : la garde du double toucher retirée ; l'appui long qui ne vide rien ; le minuteur gardé
  // au relâcher (un toucher bref viderait la marche) ; le feuillet qui s'ouvre au relâcher d'un appui long.
  it('un appui long vide une marche occupée, une fois ; un toucher bref ouvre son feuillet sans rien vider', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let videe = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'DELETE /api/me/voyage/annees/1897/podium/1': () => ((videe += 1), new Response(null, { status: 204 })),
    })
    const une = await laMarche(1)
    fireEvent.pointerDown(une)
    fireEvent.pointerUp(une)
    fireEvent.click(une)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(videe).toBe(0)
    expect(await screen.findByRole('dialog', { name: 'Marche 1' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Marche 1' })).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.pointerDown(une)
    await vi.advanceTimersByTimeAsync(500)
    fireEvent.pointerUp(une)
    fireEvent.click(une)
    await waitFor(() => expect(videe).toBe(1))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(videe).toBe(1)
  })

  // Le jumeau du feuillet, pour l'appui long. Mutations : la garde du double geste retirée ; le refus
  // tu ou réécrit sous la parade.
  it('deux appuis longs pendant l’envoi ne vident qu’une fois, et un refus se lit sous la parade', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let videe = 0
    let repondre: () => void = () => undefined
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'DELETE /api/me/voyage/annees/1897/podium/1': () => {
        videe += 1
        return new Promise<Response>((r) => (repondre = () => r(json({ code: 'VALIDATION', message: 'Cette marche ne se vide pas.', retryable: false }, 400))))
      },
    })
    const une = await laMarche(1)
    for (let i = 0; i < 2; i += 1) {
      fireEvent.pointerDown(une)
      await vi.advanceTimersByTimeAsync(500)
      fireEvent.pointerUp(une)
      fireEvent.click(une)
    }
    await act(async () => repondre())
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette marche ne se vide pas.')
    expect(videe).toBe(1)
  })

  // Les jumeaux du relâcher : un défilement qui part d'une marche (le navigateur l'annule), ou le doigt
  // qui glisse hors d'elle. Mutations : le minuteur gardé à `pointercancel`, puis à `pointerleave`.
  it.each(['pointerCancel', 'pointerLeave'] as const)('un appui interrompu (%s) ne vide rien', async (geste) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', ROUTES)
    const une = await laMarche(1)
    fireEvent.pointerDown(une)
    await vi.advanceTimersByTimeAsync(200)
    fireEvent[geste](une)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(requetes.some((r) => r.startsWith('DELETE'))).toBe(false)
  })

  // Un appui long sans `click` au relâcher (un toucher que le navigateur garde pour lui) ne doit pas
  // avaler le toucher suivant. Mutation : la marque de l'appui long jamais remise à zéro à l'appui.
  it('après un appui long sans clic, le toucher suivant ouvre le feuillet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    monterVoyage('/voyage/1897', { ...ROUTES, 'DELETE /api/me/voyage/annees/1897/podium/1': () => new Response(null, { status: 204 }) })
    const une = await laMarche(1)
    fireEvent.pointerDown(une)
    await vi.advanceTimersByTimeAsync(500)
    fireEvent.pointerUp(une)
    fireEvent.pointerDown(une)
    fireEvent.pointerUp(une)
    fireEvent.click(une)
    expect(await screen.findByRole('dialog', { name: 'Marche 1' })).toBeInTheDocument()
  })

  // Le jumeau au clavier : le chemin qui remplace l'appui long (le feuillet, puis « Retirer ») ne doit
  // pas être avalé par la marque d'un appui long resté sans clic. Mutation : la marque non remise à zéro
  // par une touche.
  it('après un appui long sans clic, « Entrée » au clavier ouvre le feuillet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    monterVoyage('/voyage/1897', { ...ROUTES, 'DELETE /api/me/voyage/annees/1897/podium/1': () => new Response(null, { status: 204 }) })
    const une = await laMarche(1)
    fireEvent.pointerDown(une)
    await vi.advanceTimersByTimeAsync(500)
    fireEvent.pointerLeave(une)
    fireEvent.keyDown(une, { key: 'Enter' })
    fireEvent.click(une, { detail: 0 })
    expect(await screen.findByRole('dialog', { name: 'Marche 1' })).toBeInTheDocument()
  })

  // Mutation : le minuteur gardé au démontage (quitter la page le doigt posé viderait la marche).
  it('quitter la page pendant un appui ne vide rien', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes, unmount } = monterVoyage('/voyage/1897', ROUTES)
    fireEvent.pointerDown(await laMarche(1))
    unmount()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(requetes.some((r) => r.startsWith('DELETE'))).toBe(false)
  })

  // Mutation : l'appui long qui vide aussi une marche vide (un `DELETE` pour rien).
  it('un appui long sur une marche vide ne vide rien', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', ROUTES)
    const deux = await laMarche(2)
    fireEvent.pointerDown(deux)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(requetes.some((r) => r.startsWith('DELETE'))).toBe(false)
  })

  // Mutation : la garde du double toucher retirée.
  it('deux touchers rapides sur un film ne le posent qu’une fois', async () => {
    let poses = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'PUT /api/me/voyage/annees/1897/podium/2': () => ((poses += 1), json({ podium: [SUR_LA_1, null, null] })),
    })
    fireEvent.click(await laMarche(2))
    const film = await within(await screen.findByRole('dialog', { name: 'Marche 2' })).findByRole('button', { name: /Un film de 1897/ })
    fireEvent.click(film)
    fireEvent.click(film)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((r) => setTimeout(r, 50))
    expect(poses).toBe(1)
  })

  // Mutations : le refus réécrit par la page ; la garde jamais relâchée (après un refus, rien ne se retente).
  it('un refus de l’API s’affiche tel qu’elle l’a écrit, le feuillet reste, et le geste se retente', async () => {
    let poses = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'PUT /api/me/voyage/annees/1897/podium/2': () =>
        ++poses === 1
          ? json({ code: 'VALIDATION', message: 'Ce film n’est pas dans ton journal pour cette année.', retryable: false }, 400)
          : json({ podium: [SUR_LA_1, null, null] }),
    })
    fireEvent.click(await laMarche(2))
    const feuillet = await screen.findByRole('dialog', { name: 'Marche 2' })
    fireEvent.click(await within(feuillet).findByRole('button', { name: /Un film de 1897/ }))
    expect(await within(feuillet).findByRole('alert')).toHaveTextContent('Ce film n’est pas dans ton journal pour cette année.')
    fireEvent.click(within(feuillet).getByRole('button', { name: /Un film de 1897/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(poses).toBe(2)
  })

  // Mutation : le feuillet refermé par un rappel qui survit à sa fermeture (celui de `useMutation`, ou
  // de `mutate` sur une mutation que la parade garde) : il reculerait une seconde fois, hors de l'année.
  it('fermer le feuillet pendant l’envoi, puis la réponse : la page reste sur l’année', async () => {
    let repondre: () => void = () => undefined
    monterVoyage(['/voyage', '/voyage/1897'], {
      ...ROUTES,
      'PUT /api/me/voyage/annees/1897/podium/2': () => new Promise<Response>((r) => (repondre = () => r(json({ podium: [SUR_LA_1, null, null] })))),
    })
    fireEvent.click(await laMarche(2))
    const feuillet = await screen.findByRole('dialog', { name: 'Marche 2' })
    fireEvent.click(await within(feuillet).findByRole('button', { name: /Un film de 1897/ }))
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => repondre())
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
  })

  // Le jumeau du contexte (`Seance.test.tsx`) : la péremption qui suit une marche ne relance pas le
  // générique en train de s'écrire (aucun appel au chroniqueur sans geste). Mutation : `resetQueries`
  // au lieu d'`invalidateQueries` (le générique en vol repartirait).
  it('vider une marche pendant que le générique s’écrit ne le redemande pas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let generiques = 0
    const { requetes } = monterVoyage('/voyage/1897?feuille=generique', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ ticket: { annee: 1898, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: null } })),
      'POST /api/me/voyage/annees/1897/generique': () => ((generiques += 1), new Promise<Response>(() => undefined)),
      'DELETE /api/me/voyage/annees/1897/podium/1': () => new Response(null, { status: 204 }),
    })
    const une = await laMarche(1)
    await waitFor(() => expect(generiques).toBe(1))
    fireEvent.pointerDown(une)
    await vi.advanceTimersByTimeAsync(500)
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    await vi.advanceTimersByTimeAsync(50)
    expect(generiques).toBe(1)
  })

  // Mutation : la parade réservée aux fiches prêtes (« Ton podium se pose dès maintenant » mentirait).
  it('la parade d’une année en attente se pose, hors IA', async () => {
    let pose: unknown
    const horsIa: Voyage = { ...VOYAGE, ia: false, annee_en_cours: 1898, source: SOURCE }
    const { requetes } = monterVoyage('/voyage/1898', {
      ...ROUTES,
      'GET /api/me/voyage': () => json(horsIa),
      'GET /api/me/voyage/annees/1898': () => json(ficheEnAttente(1898)),
      [JOURNAL(1898)]: journal(MON_JOURNAL),
      'PUT /api/me/voyage/annees/1898/podium/1': (init) => ((pose = corps(init)), json({ podium: [null, null, null] })),
    })
    fireEvent.click(await laMarche(1))
    const feuillet = await screen.findByRole('dialog', { name: 'Marche 1' })
    fireEvent.click(await within(feuillet).findByRole('button', { name: /Un film de 1898/ }))
    await waitFor(() => expect(pose).toEqual({ tmdb_id: 102 }))
    // La page (les films vus en avance) et le feuillet lisent les mêmes films, sous la même clé : une
    // seule lecture. Mutation : le feuillet sur le journal entier, ou sur une autre clé.
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([JOURNAL(1898)])
  })

  // Le jumeau : une année fermée n'a pas de podium (l'API le rend toujours vide, et refuse d'y poser).
  // Mutation : la parade passée aux deux variantes de l'année fermée.
  it('une année fermée n’a pas de parade', async () => {
    monterVoyage('/voyage/1898', { ...ROUTES, 'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898)), [JOURNAL(1898)]: journal([]) })
    await screen.findByRole('heading', { level: 1, name: '1898' })
    await screen.findByText(/Fermé jusqu’au ticket/)
    expect(screen.queryByRole('button', { name: /^Marche 1/ })).toBeNull()
  })

  // Le jumeau de la fiche en cours : une année bouclée garde sa parade (la maquette la porte aux deux).
  it('une année bouclée a sa parade', async () => {
    monterVoyage('/voyage/1896', { ...ROUTES, 'GET /api/me/voyage/annees/1896': () => json(fiche({ annee: 1896 })) })
    expect(await laMarche(1)).toHaveAccessibleName('Marche 1 : Citizen Kane')
  })
})
