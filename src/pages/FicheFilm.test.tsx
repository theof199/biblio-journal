import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import FicheFilm from './FicheFilm'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { JournalPage } from '../api/journal'
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
const REALISATEURS_DU_FILM = { realisateurs: [{ tmdb_id: 525, name: 'Christopher Nolan' }] }

function monter(state: unknown, tmdbId = 27205, client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: `/suivis/films/${tmdbId}`, state }]}>
        <Routes>
          <Route path="/suivis/films/:tmdbId" element={<FicheFilm />} />
          <Route path="/journal/nouveau" element={<FormulaireFactice />} />
          <Route path="/journal/:id/corriger" element={<output>formulaire de correction</output>} />
        </Routes>
      </MemoryRouter>
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
    // la page réalisateur a déjà payé — la donnée est dans l'état de navigation.
    expect(requetes).toEqual([])
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
    expect(requetes).toEqual(['PUT /api/me/introuvables/27000', 'DELETE /api/me/introuvables/27000'])
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
