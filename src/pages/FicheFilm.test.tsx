import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import FicheFilm from './FicheFilm'
import { createQueryClient } from '../api/queryClient'
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

function monter(state: unknown, tmdbId = 27205) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
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

  it('un film vu mais absent de mon journal (pas encore chargé) ne montre ni réactions ni « Corriger »', async () => {
    // Le journal contient une entrée, mais celle d'un *autre* film (`external_id` différent) :
    // sans le bon filtre par `tmdb_id`, une implémentation qui prendrait « la première entrée
    // venue » la trouverait quand même — ce test ne passerait plus qu'avec le vrai `tmdb_id`.
    const AUTRE_FILM = { ...ITEM, media: { ...ITEM.media, external_id: '999999' } }
    const requetes = servir({
      'GET /api/reference/reactions': () => json(CATALOGUE),
      'GET /api/me/journal?limit=20': () => json({ items: [AUTRE_FILM], next_cursor: null }),
    })
    monter({ film: FILM_VU, realisateur: { tmdb_id: 525, name: 'Christopher Nolan' } })

    await screen.findByText('Vu · noté 9 / 10')
    // Attend que le journal ait vraiment répondu et que le rendu en tienne compte — sinon
    // l'absence de « Corriger » serait vraie par construction avant toute réponse, dans un code
    // correct comme dans un code fautif, et la mutation ne serait jamais vue tomber (jumeau de
    // `Accueil.test.tsx`, « plus rien n'observe le bas de la page »).
    await vi.waitFor(() => expect(requetes).toContain('GET /api/me/journal?limit=20'))
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Mutation : afficher « Corriger » sans entrée connue ouvrirait un formulaire de correction
    // sans `item` — `Formulaire.tsx` n'a alors rien à corriger.
    expect(screen.queryByRole('link', { name: 'Corriger' })).not.toBeInTheDocument()
    // Le texte de l'unique réaction de `AUTRE_FILM` (héritée de `ITEM` par le spread) : si
    // `itemAuJournal` la retrouvait par erreur (mauvais filtre), cette puce apparaîtrait ici.
    expect(screen.queryByText(ITEM.carnet.reactions[0]!)).not.toBeInTheDocument()
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
