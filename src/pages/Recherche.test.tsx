import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Recherche from './Recherche'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { JournalPage } from '../api/journal'
import type { SearchPage } from '../api/recherche'

const VOYAGE_VIDE = {
  configure: false,
  depart: 1895,
  annee_en_cours: 1895,
  annees: [],
  ticket_a_montrer: null,
  tampons: [],
  seance_prise: null,
  ia: false,
  source: null,
}
const PLEX_VIDE = { configure: false, calcule_le: null, films: [], demandes: [] }
/** Servies par toute page qui lit le Voyage courant (l'année en cours vaut toujours 1895 ici, sans chronique). */
const ROUTES_VOYAGE = {
  'GET /api/me/voyage': () => json(VOYAGE_VIDE),
  'GET /api/me/voyage/annees/1895': () => json({ configure: false }),
  'GET /api/reference/plex': () => json(PLEX_VIDE),
}
const RESULTATS = exemple<SearchPage>('/search', 'get', 200)
const INCEPTION = RESULTATS.items.find((r) => r.type === 'movie')!

function monter(client = createQueryClient()) {
  window.localStorage.clear()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/recherche']}>
        <Recherche />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la recherche', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('le délai attend la fin de la frappe : une seule requête pour plusieurs lettres', async () => {
    const requetes = servir({
      ...ROUTES_VOYAGE,
      'GET /api/search?type=movie&q=inception': () => json(RESULTATS),
    })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'i' } })
    await vi.advanceTimersByTimeAsync(100)
    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'in' } })
    await vi.advanceTimersByTimeAsync(100)
    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })

    // Mutation : sans le débounce, chaque frappe ci-dessus aurait déjà déclenché son propre appel.
    expect(requetes.filter((r) => r.includes('/search'))).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(300)
    expect(requetes.filter((r) => r.includes('/search'))).toEqual(['GET /api/search?type=movie&q=inception'])

    await vi.advanceTimersByTimeAsync(300)
    expect(requetes.filter((r) => r.includes('/search'))).toHaveLength(1)
  })

  it('affiche une erreur de l’API telle quelle', async () => {
    const message = 'La recherche est momentanément indisponible.'
    servir({
      ...ROUTES_VOYAGE,
      'GET /api/search?type=movie&q=inception': () =>
        json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503),
    })
    monter()

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('marque « vu · note » un résultat déjà au journal, lu depuis le cache de l’accueil', async () => {
    const item = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
    const resultatVu = { ...INCEPTION, external_id: item.media.external_id }
    const client = createQueryClient()
    // Le journal est déjà en cache (visité depuis l'accueil) : la recherche ne le relit pas.
    client.setQueryData(cles.journal, { pages: [{ items: [item], next_cursor: null }], pageParams: [undefined] })
    servir({
      ...ROUTES_VOYAGE,
      'GET /api/search?type=movie&q=inception': () => json({ ...RESULTATS, items: [resultatVu] }),
    })
    monter(client)

    fireEvent.change(screen.getByLabelText('Rechercher un film'), { target: { value: 'inception' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()

    expect(await screen.findByText(`vu · ${item.entry.rating}`)).toBeInTheDocument()
  })
})
