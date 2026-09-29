import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Accueil from './Accueil'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { JournalPage } from '../api/journal'

const ITEM = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
const page = (items: JournalPage['items'], next_cursor: string | null): JournalPage => ({ items, next_cursor })
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
const STATS_VIDES = {
  dashboard: {
    scope: { user: {}, timezone: 'Europe/Paris', week_starts_on: 'monday', generated_at: '2026-09-29T00:00:00.000Z' },
    periods: {
      week: { from: null, to: '2026-09-29', counts: {}, quantities: {} },
      month: { from: null, to: '2026-09-29', counts: {}, quantities: {} },
      year: { from: null, to: '2026-09-29', counts: { finished_by_type: { movie: 3 } }, quantities: {} },
      all: { from: null, to: '2026-09-29', counts: {}, quantities: {} },
    },
    highlights: {},
  },
  comparison: null,
}

/** Un `IntersectionObserver` de test : `declencher()` simule la sentinelle qui entre dans l'écran. */
class FauxObservateur {
  static dernier: FauxObservateur | undefined
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FauxObservateur.dernier = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  declencher() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function monter() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <Accueil />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('la pagination infinie de l’accueil', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('IntersectionObserver', FauxObservateur)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('s’arrête au dernier curseur : deux pages, jamais une troisième requête', async () => {
    const AUTRE = { ...ITEM, entry: { ...ITEM.entry, id: 'autre' } }
    const requetes = servir({
      'GET /api/me/journal?limit=20': () => json(page([ITEM], 'page-2')),
      'GET /api/me/journal?limit=20&cursor=page-2': () => json(page([AUTRE], null)),
      'GET /api/stats': () => json(STATS_VIDES),
      'GET /api/me/voyage': () => json(VOYAGE_VIDE),
      'GET /api/reference/plex': () => json(PLEX_VIDE),
    })
    monter()

    await screen.findByTestId('sentinelle-journal')
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toHaveLength(1)

    // La sentinelle entre dans l'écran : la page suivante se charge.
    FauxObservateur.dernier!.declencher()

    // Mutation : une sentinelle rendue sans condition, ou un `getNextPageParam` qui rendrait
    // autre chose que `null`/`undefined` sur la dernière page (une chaîne vide, par exemple),
    // laisseraient la sentinelle dans le DOM.
    await vi.waitFor(() => expect(screen.queryByTestId('sentinelle-journal')).not.toBeInTheDocument())
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([
      'GET /api/me/journal?limit=20',
      'GET /api/me/journal?limit=20&cursor=page-2',
    ])

    // Sans sentinelle, plus rien n'observe le bas de la page : une intersection tardive ne peut
    // plus déclencher de nouvelle page.
    await new Promise((r) => setTimeout(r, 20))
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toHaveLength(2)
  })
})
