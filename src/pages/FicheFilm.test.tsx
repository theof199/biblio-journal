import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within, type BoundFunctions, type queries } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import FicheFilm from './FicheFilm'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir as servirBrut } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { JournalPage } from '../api/journal'
import type { CinemaDuFilm, SeancesDuFilm } from '../api/seances'
import { FournisseurPosition } from '../cinema/FournisseurPosition'
import { simulerNavigateur } from '../test/navigateur'
import type { FicheReference } from '../api/personnes'
import type { ReactionsCatalogue } from '../api/reactions'
import type { CandidatFilm } from '../formulaire/candidat'

/** Rejoue le candidat reçu par `/journal/nouveau`, pour vérifier que « Marquer comme vu » envoie le bon film. */
function FormulaireFactice() {
  const { state } = useLocation() as { state: { candidat: CandidatFilm } }
  return (
    <output>
      formulaire de création · {state.candidat.external_id} · {state.candidat.title} ·{' '}
      {state.candidat.director ?? 'sans réalisateur'}
    </output>
  )
}

const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
// « Inception » (tmdb_id 27205), déjà dans le journal de l'exemple du contrat — son
// `vu.entry_id` ci-dessous est délibérément le même que `ITEM.entry.id`, pour que la fiche puisse
// retrouver l'entrée complète en cache.
const ITEM = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
const PAGE_JOURNAL: JournalPage = { items: [ITEM], next_cursor: null }

const FILM_VU = {
  tmdb_id: 27205,
  title: 'Inception',
  original_title: 'Inception',
  year: 2010,
  cover_url: ITEM.media.cover_url,
  vu: { entry_id: ITEM.entry.id, rating: 9, finished_at: '2026-07-12' },
  introuvable: false,
  plex_url: null as string | null,
}
const FILM_A_VOIR = {
  tmdb_id: 27000,
  title: 'Un autre film',
  original_title: null as string | null,
  year: 2015,
  cover_url: null as string | null,
  vu: null,
  introuvable: false,
}
const FICHE = exemple<FicheReference>('/reference/films/{tmdbId}', 'get', 200)
const routeFiche = (tmdbId: number) => `GET /api/reference/films/${tmdbId}`
const routeSeances = (tmdbId: number) => `GET /api/reference/films/${tmdbId}/seances`
const SEANCES_VIDES: SeancesDuFilm = { jour: '2026-10-03', calcule_le: null, cinemas: [] }

/**
 * `servir` de `test/serveur`, plus la fiche TMDB et les séances du jour (vides) des deux films de ce fichier : sans elle, chaque
 * test qui n'en parle pas lèverait une « requête inattendue » de plus. Une route que le test pose
 * lui-même l'emporte.
 */
function servir(routes: Parameters<typeof servirBrut>[0]) {
  return servirBrut({
    [routeFiche(27205)]: () => json(FICHE),
    [routeFiche(27000)]: () => json(FICHE),
    [routeSeances(27205)]: () => json(SEANCES_VIDES),
    [routeSeances(27000)]: () => json(SEANCES_VIDES),
    ...routes,
  })
}
const REALISATEURS_DU_FILM = { realisateurs: [{ tmdb_id: 525, name: 'Christopher Nolan' }] }

function monter(state: unknown, tmdbId = 27205, client = createQueryClient(), prefixe = '/suivis/films') {
  return render(
    <QueryClientProvider client={client}>
      <FournisseurPosition>
        <MemoryRouter initialEntries={[{ pathname: `${prefixe}/${tmdbId}`, state }]}>
          <Routes>
            <Route path="/suivis/films/:tmdbId" element={<FicheFilm />} />
            <Route path="/au-cine/films/:tmdbId" element={<FicheFilm />} />
            <Route path="/journal/nouveau" element={<FormulaireFactice />} />
            <Route path="/journal/:id/corriger" element={<output>formulaire de correction</output>} />
          </Routes>
        </MemoryRouter>
      </FournisseurPosition>
    </QueryClientProvider>,
  )
}

describe('la fiche d’un film', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('sans état de navigation (rechargement direct), renvoie vers les Suivis plutôt que de planter', () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/suivis/films/27205']}>
          <Routes>
            <Route path="/suivis/films/:tmdbId" element={<FicheFilm />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByText('Ce film n’est plus disponible. Repars des Suivis.')).toBeInTheDocument()
  })

  it('un film à voir montre « Marquer comme vu », qui ouvre le formulaire avec le bon candidat', async () => {
    monter({ film: FILM_A_VOIR, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    const bouton = await screen.findByRole('button', { name: 'Marquer comme vu' })
    fireEvent.click(bouton)
    // Mutation : le mauvais `tmdb_id`, un titre recopié du réalisateur au lieu du film, ou le
    // réalisateur oublié feraient tous les trois tomber cette assertion précise.
    expect(await screen.findByText('formulaire de création · 27000 · Un autre film · Christopher Nolan')).toBeInTheDocument()
  })

  it('un réalisateur déjà connu (page réalisateur) s’affiche en lien, sans appel réseau annexe', async () => {
    const requetes = servir({})
    monter({ film: FILM_A_VOIR, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    const lien = await screen.findByRole('link', { name: 'Christopher Nolan' })
    expect(lien).toHaveAttribute('href', '/suivis/realisateurs/525')
    // Mutation : un appel à `/reference/films/.../realisateurs` ici gâcherait un aller-retour que
    // la page réalisateur a déjà payé — la donnée est dans l'état de navigation. Les séances du jour
    // sont, elles, la seule requête que la fiche ajoute depuis Au ciné.
    await vi.waitFor(() => expect(requetes).toHaveLength(2))
    expect([...requetes].sort()).toEqual([routeFiche(27205), routeSeances(27205)].sort())
  })

  it('sans réalisateur connu (une saga n’en porte pas), les réalisateurs du film sont résolus et affichés en lien', async () => {
    servir({
      'GET /api/reference/films/27000/realisateurs': () => json(REALISATEURS_DU_FILM),
    })
    monter({ film: FILM_A_VOIR, realisateur: null }, FILM_A_VOIR.tmdb_id)

    const lien = await screen.findByRole('link', { name: 'Christopher Nolan' })
    expect(lien).toHaveAttribute('href', '/suivis/realisateurs/525')
  })

  it('un film vu déjà présent dans mon journal montre ses réactions et un lien « Corriger »', async () => {
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'GET /api/me/journal?limit=20': () => json(PAGE_JOURNAL),
    })
    monter({ film: FILM_VU, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    for (const cle of ITEM.carnet.reactions) {
      const reaction = CATALOGUE.reactions.find((r) => r.cle === cle)!
      expect(await screen.findByText(`${reaction.emoji} ${reaction.phrase}`)).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Corriger' })).toHaveAttribute(
      'href',
      `/journal/${ITEM.entry.id}/corriger`,
    )
  })

  it('retrouve l’entrée par `vu.entry_id`, jamais par un autre visionnage du même film', async () => {
    // Même film (`external_id` identique), mais une autre entrée : la retrouver par `tmdb_id`
    // ouvrirait la correction du mauvais visionnage.
    const AUTRE_VISIONNAGE = { ...ITEM, entry: { ...ITEM.entry, id: 'une-autre-entree' } }
    const requetes = servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'GET /api/me/journal?limit=20': () => json({ items: [AUTRE_VISIONNAGE], next_cursor: null }),
    })
    monter({ film: FILM_VU, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    await screen.findByText('Vu · noté 9 / 10')
    await vi.waitFor(() => expect(requetes).toContain('GET /api/me/journal?limit=20'))
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Mutation : chercher par `media.external_id` trouverait `AUTRE_VISIONNAGE` et montrerait
    // « Corriger » vers `/journal/une-autre-entree/corriger`.
    expect(screen.queryByRole('link', { name: 'Corriger' })).not.toBeInTheDocument()
  })

  it('lit les pages suivantes du journal jusqu’à trouver l’entrée d’un film vu il y a longtemps', async () => {
    const AUTRE = { ...ITEM, entry: { ...ITEM.entry, id: 'recente' }, media: { ...ITEM.media, external_id: '1' } }
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'GET /api/me/journal?limit=20': () => json({ items: [AUTRE], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': () => json(PAGE_JOURNAL),
    })
    monter({ film: FILM_VU, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    // Mutation : sans l'effet qui lit la page suivante, l'entrée (en page 2) ne serait jamais
    // trouvée et « Corriger » n'apparaîtrait pas.
    expect(await screen.findByRole('link', { name: 'Corriger' })).toHaveAttribute(
      'href',
      `/journal/${ITEM.entry.id}/corriger`,
    )
  })

  it('une page du journal en échec arrête la recherche : aucune boucle d’appels', async () => {
    const AUTRE = { ...ITEM, entry: { ...ITEM.entry, id: 'recente' } }
    const requetes = servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'GET /api/me/journal?limit=20': () => json({ items: [AUTRE], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': () =>
        json({ code: 'INTERNAL', message: 'Le journal n’a pas pu être lu.', retryable: false }, 500),
    })
    monter({ film: FILM_VU, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    await vi.waitFor(() => expect(requetes).toContain('GET /api/me/journal?limit=20&cursor=page-2'))
    await new Promise((resolve) => setTimeout(resolve, 250))
    // Mutation : sans `isFetchNextPageError` dans la garde, l'effet relance la page en échec sans fin.
    expect(requetes.filter((r) => r.includes('cursor=page-2'))).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Corriger' })).not.toBeInTheDocument()
  })

  it('« Introuvable » pose la marque, la fiche le dit aussitôt et propose de le remettre à voir', async () => {
    const requetes = servir({
      'PUT /api/me/introuvables/27000': () => new Response(null, { status: 204 }),
      'DELETE /api/me/introuvables/27000': () => new Response(null, { status: 204 }),
    })
    monter({ film: FILM_A_VOIR, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } }, 27000)

    fireEvent.click(await screen.findByRole('button', { name: 'Introuvable' }))
    expect(await screen.findByText('Marqué introuvable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Le remettre à voir' }))
    await vi.waitFor(() => expect(screen.queryByText('Marqué introuvable')).not.toBeInTheDocument())
    expect(requetes).toEqual([
      routeFiche(27000),
      routeSeances(27000),
      'PUT /api/me/introuvables/27000',
      'DELETE /api/me/introuvables/27000',
    ])
  })

  it('poser la marque périme les filmographies, les sagas et le Voyage', async () => {
    servir({ 'PUT /api/me/introuvables/27000': () => new Response(null, { status: 204 }) })
    const client = createQueryClient()
    client.setQueryData(cles.pageRealisateur(525), { films: [] })
    client.setQueryData(cles.filmsSaga(8091), { films: [] })
    client.setQueryData(cles.voyage, {})
    monter({ film: FILM_A_VOIR, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } }, 27000, client)

    fireEvent.click(await screen.findByRole('button', { name: 'Introuvable' }))
    await screen.findByText('Marqué introuvable')
    // Mutation : retirer l'une des trois invalidations laisse le carrousel « Ensuite » proposer
    // un film qu'on vient de déclarer introuvable.
    expect(client.getQueryState(cles.pageRealisateur(525))?.isInvalidated).toBe(true)
    expect(client.getQueryState(cles.filmsSaga(8091))?.isInvalidated).toBe(true)
    expect(client.getQueryState(cles.voyage)?.isInvalidated).toBe(true)
  })

  it('un film vu n’a pas de bouton « Introuvable »', async () => {
    servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'GET /api/me/journal?limit=20': () => json(PAGE_JOURNAL),
    })
    monter({ film: FILM_VU, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })
    await screen.findByRole('link', { name: 'Corriger' })
    expect(screen.queryByRole('button', { name: 'Introuvable' })).not.toBeInTheDocument()
  })

  it('« Demander sur Sir » sur un film absent du Plex, et l’erreur de Seerr telle quelle', async () => {
    const message = 'Seerr ne répond pas.'
    servir({
      'POST /api/me/voyage/demander/27000': () => json({ code: 'UPSTREAM_UNAVAILABLE', message, retryable: false }, 503),
    })
    const film = { ...FILM_A_VOIR, sur_le_plex: false, demande: false }
    monter({ film, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } }, 27000)

    fireEvent.click(await screen.findByRole('button', { name: 'Demander sur Sir' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('« Demander sur Sir » n’apparaît ni sur un film déjà demandé, ni sur le Plex, ni sur un film de saga', () => {
    monter({ film: { ...FILM_A_VOIR, sur_le_plex: false, demande: true }, realisateur: null }, 27000)
    expect(screen.getByText('Demandé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Demander sur Sir' })).not.toBeInTheDocument()
  })

  it('ne lit jamais le journal d’un autre membre : l’appel ne porte aucun `user_id`, la fiche ne montre que mon carnet à moi', async () => {
    const requetes = servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'GET /api/me/journal?limit=20': () => json(PAGE_JOURNAL),
    })
    monter({ film: FILM_VU, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    await screen.findByRole('link', { name: 'Corriger' })
    // Mutation : un `user_id` glissé dans cette requête irait lire le journal d'un autre membre —
    // `servir()` lève une « requête inattendue » sur toute URL qui ne correspond pas exactement,
    // donc le moindre paramètre ajouté ferait déjà tomber ce test avant même l'assertion.
    expect(requetes).toContain('GET /api/me/journal?limit=20')
    expect(requetes.some((r) => r.includes('user_id'))).toBe(false)
  })
})

describe('la fiche d’un film : ce que TMDB en dit', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const NOLAN = { tmdb_id: 525, name: 'Christopher Nolan' }
  const monterFilm = () => monter({ film: FILM_A_VOIR, realisateur: NOLAN }, 27000)
  const avecFiche = (surcharge: Partial<FicheReference>) =>
    servir({ [routeFiche(27000)]: () => json({ ...FICHE, ...surcharge }) })

  it('montre la durée au format « 2 h 49 » et les genres sur une seule ligne', async () => {
    avecFiche({ runtime_min: 169, genres: ['Drame', 'Science-Fiction'] })
    monterFilm()

    expect(await screen.findByText('2 h 49 · Drame, Science-Fiction')).toBeInTheDocument()
  })

  it('montre le synopsis', async () => {
    avecFiche({ summary: 'Un voleur entre dans les rêves.' })
    monterFilm()

    expect(await screen.findByText('Un voleur entre dans les rêves.')).toBeInTheDocument()
  })

  it('montre le casting, le nom et le rôle de chaque tête d’affiche', async () => {
    avecFiche({ cast: [{ name: 'Leonardo DiCaprio', character: 'Dom Cobb', photo_url: null }] })
    monterFilm()

    expect(await screen.findByText('Leonardo DiCaprio')).toBeInTheDocument()
    expect(screen.getByText('Dom Cobb')).toBeInTheDocument()
  })

  it('montre chaque plateforme sous le libellé de son mode, et aucun mode vide', async () => {
    avecFiche({
      availability: {
        ...FICHE.availability!,
        subscription: [{ id: 8, name: 'Netflix', logo_url: 'https://image.tmdb.org/netflix.jpg' }],
        rent: [],
        buy: [{ id: 2, name: 'Apple TV', logo_url: null }],
        free: [],
        ads: [],
      },
    })
    monterFilm()

    const abonnement = (await screen.findByRole('heading', { name: 'Abonnement' })).parentElement!
    expect(within(abonnement).getByText('Netflix')).toBeInTheDocument()
    const achat = screen.getByRole('heading', { name: 'Achat' }).parentElement!
    expect(within(achat).getByText('Apple TV')).toBeInTheDocument()
    for (const absent of ['Location', 'Gratuit', 'Avec publicité']) {
      expect(screen.queryByRole('heading', { name: absent })).not.toBeInTheDocument()
    }
  })

  it('pose la mention JustWatch en lien vers JustWatch sous « Où regarder »', async () => {
    avecFiche({})
    monterFilm()

    const lien = await screen.findByRole('link', { name: FICHE.availability!.attribution.text })
    expect(lien).toHaveAttribute('href', FICHE.availability!.attribution.url)
  })

  it('sans disponibilité (nulle), ne montre pas « Où regarder » mais montre le reste', async () => {
    avecFiche({ availability: null })
    monterFilm()

    expect(await screen.findByText(FICHE.summary!)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Où regarder' })).not.toBeInTheDocument()
  })

  it('avec tous les modes vides, ne montre ni « Où regarder » ni la mention', async () => {
    avecFiche({
      availability: { ...FICHE.availability!, subscription: [], rent: [], buy: [], free: [], ads: [] },
    })
    monterFilm()

    await screen.findByText(FICHE.summary!)
    expect(screen.queryByRole('heading', { name: 'Où regarder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: FICHE.availability!.attribution.text })).not.toBeInTheDocument()
  })

  it('une route en échec laisse l’en-tête et les boutons, sans aucune des nouvelles sections', async () => {
    servir({
      [routeFiche(27000)]: () => json({ code: 'INTERNAL', message: 'TMDB est tombé.', retryable: false }, 500),
    })
    monterFilm()

    expect(await screen.findByRole('button', { name: 'Marquer comme vu' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Un autre film' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Christopher Nolan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Introuvable' })).toBeInTheDocument()
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('heading', { name: 'Casting' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Où regarder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('les champs nuls ou vides ne rendent rien : ni durée, ni genres, ni synopsis, ni casting', async () => {
    avecFiche({ summary: null, runtime_min: null, genres: [], cast: [], availability: null })
    const { container } = monterFilm()

    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('heading', { name: 'Casting' })).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/min|\bh \d\d|·/)
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('une tête d’affiche sans rôle ne montre que son nom', async () => {
    avecFiche({ cast: [{ name: 'Inconnu', character: null, photo_url: null }] })
    monterFilm()

    const tete = (await screen.findByText('Inconnu')).closest('li')!
    expect(tete).toHaveTextContent(/^Inconnu$/)
  })
})

describe('la fiche d’un film : « Séances aujourd’hui »', () => {
  /** Dix-huit heures cinquante-cinq à Paris. */
  const MAINTENANT = '2026-10-03T18:55:00+02:00'
  const NOLAN = { tmdb_id: 525, name: 'Christopher Nolan' }
  const HALLES = { id: 'C1', nom: 'UGC Les Halles', latitude: 48.8625, longitude: 2.3466 }
  const ODEON = { id: 'C2', nom: 'UGC Odéon', latitude: 48.8527, longitude: 2.3385 }
  const CHAMPO = { id: 'C3', nom: 'Le Champo', latitude: null, longitude: null }
  /** À deux pas d'Odéon. */
  const PRES_D_ODEON = { reponse: 'position', latitude: 48.853, longitude: 2.339 } as const

  const duFilm = (cinema: Omit<CinemaDuFilm, 'seances'>, creneaux: [string, 'VF' | 'VOST' | 'VO'][]): CinemaDuFilm => ({
    ...cinema,
    seances: creneaux.map(([hhmm, version]) => ({ debut: `2026-10-03T${hhmm}:00+02:00`, version })),
  })
  const seancesDuFilm = (...cinemas: CinemaDuFilm[]): SeancesDuFilm => ({ jour: '2026-10-03', calcule_le: '2026-10-03T16:00:05.000Z', cinemas })
  /** « celui de la prochaine séance d'abord », comme l'API les rend : Odéon (19:20), puis les Halles (19:40). */
  const PROGRAMME = seancesDuFilm(
    duFilm(HALLES, [['19:40', 'VF'], ['22:00', 'VF']]),
    duFilm(ODEON, [['19:20', 'VOST'], ['21:10', 'VOST']]),
    duFilm(CHAMPO, [['20:00', 'VO']]),
  )

  let navigateur: ReturnType<typeof simulerNavigateur> | undefined
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(MAINTENANT))
  })
  afterEach(() => {
    navigateur?.retirer()
    navigateur = undefined
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const avecSeances = (programme: SeancesDuFilm) => servir({ [routeSeances(27000)]: () => json(programme) })
  const monterFilm = (prefixe = '/au-cine/films') => monter({ film: FILM_A_VOIR, realisateur: NOLAN }, 27000, createQueryClient(), prefixe)
  const bloc = async () => within((await screen.findByRole('heading', { name: 'Séances aujourd’hui' })).closest('section')!)
  const nomsDeCinemas = (b: BoundFunctions<typeof queries>) => b.getAllByRole('heading', { level: 3 }).map((titre) => titre.textContent)
  const avancer = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

  it('placé sous l’en-tête du film, avant le synopsis, avec la prochaine séance annoncée', async () => {
    servir({
      [routeFiche(27000)]: () => json({ ...FICHE, summary: 'Un voleur entre dans les rêves.' }),
      [routeSeances(27000)]: () => json(PROGRAMME),
    })
    monterFilm()

    const titre = await screen.findByRole('heading', { name: 'Séances aujourd’hui' })
    const synopsis = await screen.findByText('Un voleur entre dans les rêves.')
    // Mutation : poser le bloc après le synopsis fait suivre le titre au lieu de le précéder.
    expect(titre.compareDocumentPosition(synopsis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Un autre film' }).compareDocumentPosition(titre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect((await bloc()).getByText('Prochaine séance dans 25 min')).toBeInTheDocument()
  })

  it('un cadre par cinéma, ses heures en pastilles avec leur version', async () => {
    avecSeances(PROGRAMME)
    monterFilm()

    const b = await bloc()
    const odeon = within(b.getByRole('heading', { name: 'UGC Odéon' }).closest('article')!)
    expect(odeon.getAllByRole('listitem').map((pastille) => pastille.textContent)).toEqual(['19:20VOST', '21:10VOST'])
    const halles = within(b.getByRole('heading', { name: 'UGC Les Halles' }).closest('article')!)
    expect(halles.getAllByRole('listitem').map((pastille) => pastille.textContent)).toEqual(['19:40VF', '22:00VF'])
  })

  it('les pastilles ne sont pas interactives : ni lien ni bouton, aucune réservation', async () => {
    avecSeances(PROGRAMME)
    monterFilm()

    const b = await bloc()
    // Mutation : transformer une pastille en lien (ou en bouton) le ferait apparaître ici.
    expect(b.queryAllByRole('link')).toEqual([])
    expect(b.queryAllByRole('button')).toEqual([])
  })

  it('sans la position : le cinéma de la prochaine séance d’abord, sans distance, et rien n’est demandé ni offert', async () => {
    navigateur = simulerNavigateur({ permission: 'prompt', geolocation: PRES_D_ODEON })
    avecSeances(PROGRAMME)
    monterFilm()

    const b = await bloc()
    expect(nomsDeCinemas(b)).toEqual(['UGC Odéon', 'UGC Les Halles', 'Le Champo'])
    await vi.waitFor(() => expect(navigateur!.query).toHaveBeenCalled())
    // La position ne se demande que depuis l'onglet : ici, ni bouton ni lecture.
    expect(navigateur.getCurrentPosition).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Autoriser/ })).not.toBeInTheDocument()
    expect(b.queryByText(/à \d/)).not.toBeInTheDocument()
  })

  it('avec la position déjà accordée : le plus proche d’abord, la distance dite, sans coordonnées en dernier', async () => {
    navigateur = simulerNavigateur({ permission: 'granted', geolocation: PRES_D_ODEON })
    // Un ordre d'API qui ne serait pas celui de la distance : les Halles, plus loin, d'abord.
    avecSeances(seancesDuFilm(duFilm(HALLES, [['19:00', 'VF']]), duFilm(CHAMPO, [['19:05', 'VF']]), duFilm(ODEON, [['21:00', 'VF']])))
    monterFilm()

    const b = await bloc()
    await b.findAllByText(/à \d/)
    // Mutation : un tri par prochaine séance seule mettrait les Halles (19:00) avant Odéon.
    expect(nomsDeCinemas(b)).toEqual(['UGC Odéon', 'UGC Les Halles', 'Le Champo'])
    expect(within(b.getByRole('heading', { name: 'UGC Odéon' }).closest('article')!).getByText(/^à \d+ m$/)).toBeInTheDocument()
    expect(within(b.getByRole('heading', { name: 'Le Champo' }).closest('article')!).queryByText(/à \d/)).not.toBeInTheDocument()
    // « Prochaine séance » est la plus tôt de toutes (19:00 aux Halles), pas celle du premier cadre (21:00 à Odéon).
    expect(b.getByText('Prochaine séance dans 5 min')).toBeInTheDocument()
  })

  it('absent quand le film n’a aucune séance aujourd’hui : ni titre ni cadre', async () => {
    const requetes = avecSeances(seancesDuFilm())
    monterFilm()

    await screen.findByRole('heading', { level: 1, name: 'Un autre film' })
    await vi.waitFor(() => expect(requetes).toContain(routeSeances(27000)))
    await avancer(50)
    expect(screen.queryByRole('heading', { name: 'Séances aujourd’hui' })).not.toBeInTheDocument()
  })

  it('une panne des séances ne montre rien et ne dérange pas la fiche', async () => {
    servir({ [routeSeances(27000)]: () => json({ code: 'INTERNAL', message: 'Le programme est en panne.', retryable: false }, 500) })
    monterFilm()

    expect(await screen.findByRole('button', { name: 'Marquer comme vu' })).toBeInTheDocument()
    await avancer(50)
    expect(screen.queryByRole('heading', { name: 'Séances aujourd’hui' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('une séance commencée quitte sa pastille sans rechargement, un cinéma qui n’en a plus s’en va, et tout s’éteint à la dernière', async () => {
    const requetes = avecSeances(seancesDuFilm(duFilm(ODEON, [['19:00', 'VOST'], ['21:00', 'VOST']]), duFilm(HALLES, [['19:10', 'VF']])))
    monterFilm()

    const b = await bloc()
    expect(b.getByText('19:00')).toBeInTheDocument()
    expect(nomsDeCinemas(b)).toEqual(['UGC Odéon', 'UGC Les Halles'])

    // 19:03 : la séance de 19:00 a commencé, le cadre d'Odéon garde 21:00.
    await avancer(8 * 60_000)
    // Mutation : sans l'horloge (`useMaintenant` figé), 19:00 resterait affiché.
    expect(b.queryByText('19:00')).not.toBeInTheDocument()
    expect(b.getByText('21:00')).toBeInTheDocument()
    expect(b.getByText('Prochaine séance dans 7 min')).toBeInTheDocument()

    // 19:15 : les Halles n'ont plus rien, leur cadre s'en va.
    await avancer(12 * 60_000)
    expect(nomsDeCinemas(b)).toEqual(['UGC Odéon'])

    // 21:05 : plus rien aujourd'hui, le bloc entier s'efface.
    await avancer(110 * 60_000)
    expect(screen.queryByRole('heading', { name: 'Séances aujourd’hui' })).not.toBeInTheDocument()
    // L'horloge ne relance jamais l'API.
    expect(requetes.filter((requete) => requete === routeSeances(27000))).toHaveLength(1)
  })

  it('une seule requête de plus pour la fiche : celle des séances du film, sans paramètre', async () => {
    navigateur = simulerNavigateur({ permission: 'granted', geolocation: PRES_D_ODEON })
    const requetes = avecSeances(PROGRAMME)
    monter({ film: FILM_A_VOIR, realisateur: NOLAN }, 27000, createQueryClient(), '/au-cine/films')

    await bloc()
    await avancer(2 * 60_000)

    // Mutation : une requête de plus (les séances de tous les films, un rappel périodique, la position en
    // paramètre) fait grandir cette liste ; `servir` lève d'ailleurs sur toute URL qui n'est pas exactement celle-ci.
    expect([...requetes].sort()).toEqual([routeFiche(27000), routeSeances(27000)].sort())
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toContain('48.853')
  })

  it('ouverte depuis Au ciné avec son état : la fiche s’affiche, les réalisateurs se résolvent et « Marquer comme vu » prérempli le formulaire', async () => {
    servir({ 'GET /api/reference/films/27000/realisateurs': () => json(REALISATEURS_DU_FILM) })
    monter({ film: FILM_A_VOIR, realisateur: null }, 27000, createQueryClient(), '/au-cine/films')

    expect(await screen.findByRole('heading', { level: 1, name: 'Un autre film' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Christopher Nolan' })).toHaveAttribute('href', '/suivis/realisateurs/525')
    fireEvent.click(screen.getByRole('button', { name: 'Marquer comme vu' }))

    expect(await screen.findByText('formulaire de création · 27000 · Un autre film · Christopher Nolan')).toBeInTheDocument()
  })

  it('ouverte d’un lien collé sous Au ciné (sans état) : elle renvoie vers Au ciné, pas vers les Suivis, et ne lit rien', async () => {
    const requetes = servir({})
    monter(null, 27000, createQueryClient(), '/au-cine/films')

    expect(screen.getByText('Ce film n’est plus disponible. Repars d’Au ciné.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à Au ciné' })).toHaveAttribute('href', '/au-cine')
    expect(screen.queryByText(/Suivis/)).not.toBeInTheDocument()
    await avancer(50)
    expect(requetes).toEqual([])
  })
})
