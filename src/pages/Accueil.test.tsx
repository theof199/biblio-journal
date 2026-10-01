import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import Accueil from './Accueil'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { ROUTES_ACCUEIL } from '../test/routesAccueil'
import { visionnage } from '../test/journal'
import type { JournalPage } from '../api/journal'
import type { Realisateur, RealisateurPage } from '../api/realisateurs'

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

/**
 * Un `IntersectionObserver` fidèle au vrai sur un point : tout observateur neuf signale aussitôt
 * une sentinelle déjà visible — jumelle de celle de `MesFilms.test.tsx`. C'est ce qui relance la
 * pagination à chaque recréation, et donc en boucle sans la garde `isFetchNextPageError`.
 */
class ObservateurVisible {
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe() {
    setTimeout(() => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver))
  }
  unobserve() {}
  disconnect() {}
}

/** Une panne qui prend le temps d'un vrai réseau : sans délai, l'état « en cours » ne se rend jamais. */
const pannePassagere = async () => {
  await new Promise((r) => setTimeout(r, 20))
  return json({ code: 'INTERNAL', message: 'Le journal n’a pas pu être lu.', retryable: false }, 500)
}
const pagesDe = (requetes: string[]) => requetes.filter((r) => r.includes('cursor=page-2')).length
const patienter = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
      'GET /api/me/realisateurs': () => json([]),
      'GET /api/me/sagas': () => json([]),
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

  it('une page en échec ne relance pas la sentinelle en boucle, et « Réessayer » la reprend', async () => {
    vi.stubGlobal('IntersectionObserver', ObservateurVisible)
    let enPanne = true
    const requetes = servir({
      'GET /api/me/journal?limit=20': () => json(page([ITEM], 'page-2')),
      'GET /api/me/journal?limit=20&cursor=page-2': () => (enPanne ? pannePassagere() : json(page([], null))),
      'GET /api/stats': () => json(STATS_VIDES),
      'GET /api/me/voyage': () => json(VOYAGE_VIDE),
      'GET /api/reference/plex': () => json(PLEX_VIDE),
      'GET /api/me/realisateurs': () => json([]),
      'GET /api/me/sagas': () => json([]),
    })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent('Le journal n’a pas pu être lu.')
    // Mutation : `if (journal.error)` au lieu de `if (!journal.data)` effacerait toute la grille
    // déjà affichée derrière la panne plein écran dès l'échec de la deuxième page.
    expect(screen.getByAltText(ITEM.media.title)).toBeInTheDocument()
    // Mutation : sans `isFetchNextPageError` dans la garde de l'effet et de `chargerLaSuite`,
    // l'observateur recréé après l'échec signale la sentinelle toujours visible, et la page
    // repart aussitôt — une quinzaine d'appels en un quart de seconde.
    await patienter(250)
    expect(pagesDe(requetes)).toBe(1)
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument()

    enPanne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await vi.waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(pagesDe(requetes)).toBe(2)
  })
})

describe('les filmographies du réalisateur en cours', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('IntersectionObserver', FauxObservateur)
  })
  afterEach(() => vi.unstubAllGlobals())

  const NOLAN = exemple<Realisateur[]>('/me/realisateurs', 'get', 200)[0]!
  const PAGE_NOLAN = exemple<RealisateurPage>('/me/realisateurs/{tmdbId}/page', 'get', 200)
  const realisateur = (id: number): Realisateur => ({ ...NOLAN, tmdb_id: id, name: `Réalisateur ${id}` })
  const filmA = (id: number, vu: boolean) => ({
    ...PAGE_NOLAN.films[0]!,
    tmdb_id: id,
    title: `Film ${id}`,
    year: 2000 + (id % 100),
    vu: vu ? { entry_id: `e-${id}`, rating: null, finished_at: '2026-09-01' } : null,
    introuvable: false,
  })
  const pageDe = (id: number, films: ReturnType<typeof filmA>[]): RealisateurPage => ({ ...PAGE_NOLAN, tmdb_id: id, films })
  const base = {
    'GET /api/me/journal?limit=20': () => json(page([ITEM], null)),
    'GET /api/stats': () => json(STATS_VIDES),
    'GET /api/me/voyage': () => json(VOYAGE_VIDE),
    'GET /api/reference/plex': () => json(PLEX_VIDE),
    'GET /api/me/sagas': () => json([]),
  }

  it('demande les filmographies l’une après l’autre, dans l’ordre de la liste, jamais en parallèle', async () => {
    let enVol = 0
    let maximum = 0
    const partis: number[] = []
    const lente = (id: number) => async () => {
      enVol += 1
      maximum = Math.max(maximum, enVol)
      partis.push(id)
      await patienter(20)
      enVol -= 1
      return json(pageDe(id, [filmA(id, false)]))
    }
    servir({
      ...base,
      'GET /api/me/realisateurs': () => json([1, 2, 3].map(realisateur)),
      'GET /api/me/realisateurs/1/page': lente(1),
      'GET /api/me/realisateurs/2/page': lente(2),
      'GET /api/me/realisateurs/3/page': lente(3),
    })
    monter()

    await vi.waitFor(() => expect(partis).toEqual([1, 2, 3]))
    await vi.waitFor(() => expect(enVol).toBe(0))
    // Mutation : des requêtes lancées toutes ensemble (l'ancien `useQueries`) en auraient eu trois en vol.
    expect(maximum).toBe(1)
  })

  it('la pastille de l’éventail reste celle du réalisateur qui a le plus de films vus', async () => {
    servir({
      ...base,
      'GET /api/me/realisateurs': () => json([realisateur(1), realisateur(2)]),
      'GET /api/me/realisateurs/1/page': () => json(pageDe(1, [filmA(11, true), filmA(12, false)])),
      'GET /api/me/realisateurs/2/page': () => json(pageDe(2, [filmA(21, true), filmA(22, true), filmA(23, false)])),
    })
    monter()

    // Le 2 a deux films vus contre un : son prochain film (23) est celui proposé, sous le nom du réalisateur.
    expect(await screen.findByText('Réalisateur 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Film 23' })).toHaveAttribute('href', '/journal/nouveau')
    expect(screen.queryByText('Réalisateur 1')).not.toBeInTheDocument()
  })
})

describe('la façade de l’accueil', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('IntersectionObserver', FauxObservateur)
    // Seule l'horloge est fausse : les délais du réseau doublé et de la requête restent réels.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const SEANCE = { id: 'a0000000-0000-4000-8000-000000000001', annee: 1927, long: { title: 'Metropolis', cover_url: null }, court: null }
  const JOURNAL = [
    visionnage({ id: 'a', titre: 'L’Aurore', date: '2026-09-26', note: 9 }),
    visionnage({ id: 'b', titre: 'Le Kid', date: '2026-09-20', note: 8 }),
    visionnage({ id: 'c', titre: 'Sherlock Junior', date: '2026-08-31', note: 8 }),
    visionnage({ id: 'd', titre: 'Charade', date: '2025-12-31', note: 7 }),
  ]
  const servirJournal = (items: JournalPage['items'], voyage: object = VOYAGE_VIDE) =>
    servir({
      ...ROUTES_ACCUEIL,
      'GET /api/me/journal?limit=20': () => json(page(items, null)),
      'GET /api/stats': () => json(STATS_VIDES),
      'GET /api/me/voyage': () => json(voyage),
    })

  it('met le jour en titre de la page', async () => {
    servirJournal(JOURNAL)
    monter()
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Mercredi 30 septembre')
  })

  it('annonce la séance prise sur le fronton, qui mène au Voyage', async () => {
    servirJournal(JOURNAL, { ...VOYAGE_VIDE, seance_prise: SEANCE })
    monter()
    const fronton = (await screen.findByRole('heading', { level: 1 })).closest('a')
    expect(fronton).toHaveAttribute('href', '/voyage')
    expect(fronton).toHaveTextContent('Ce soir')
    expect(fronton).toHaveTextContent('Metropolis')
  })

  it('annonce la dernière séance sur le fronton quand rien n’attend', async () => {
    servirJournal(JOURNAL)
    monter()
    const fronton = (await screen.findByRole('heading', { level: 1 })).closest('a')
    expect(fronton).toHaveAttribute('href', '/journal/a')
    expect(fronton).toHaveTextContent('Dernière séance')
  })

  it('met la séance prise devant, dans l’éventail', async () => {
    servirJournal(JOURNAL, { ...VOYAGE_VIDE, seance_prise: SEANCE })
    monter()
    expect(await screen.findByRole('link', { name: 'Metropolis' })).toHaveAttribute('href', '/voyage')
  })

  it('ne montre pas d’éventail sans séance ni film à voir', async () => {
    servirJournal(JOURNAL)
    monter()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: /Mettre en avant/ })).not.toBeInTheDocument()
  })

  it('montre la bande du Voyage quand il a répondu', async () => {
    servirJournal(JOURNAL)
    monter()
    expect(await screen.findByRole('link', { name: /Le Voyage/ })).toHaveAttribute('href', '/voyage')
  })

  it('ne met plus la dernière séance en avant : elle est dans la pellicule de son mois, une seule fois', async () => {
    servirJournal(JOURNAL)
    monter()
    await screen.findByRole('heading', { level: 2, name: 'Le journal' })
    expect(screen.getAllByAltText('L’Aurore')).toHaveLength(1)
    expect(screen.queryByText('Dernière séance', { selector: 'span' })).not.toBeInTheDocument()
    const septembre = screen.getByRole('heading', { level: 3, name: 'Septembre 2026' }).closest('section')!
    expect(within(septembre).getByAltText('L’Aurore')).toBeInTheDocument()
  })

  it('range le journal par mois, sous un titre chacun', async () => {
    servirJournal(JOURNAL)
    monter()
    const mois = await screen.findAllByRole('heading', { level: 3 })
    expect(mois.map((titre) => titre.textContent)).toEqual(['Septembre 2026', 'Août 2026', 'Décembre 2025'])
  })

  it('met chaque entrée dans la pellicule de son mois, vers sa fiche', async () => {
    servirJournal(JOURNAL)
    monter()
    const septembre = (await screen.findByRole('heading', { level: 3, name: 'Septembre 2026' })).closest('section')!
    const liens = within(septembre).getAllByRole('link')
    expect(liens.map((lien) => lien.getAttribute('href'))).toEqual(['/journal/a', '/journal/b'])
  })

  it('écrit le compte de l’année à côté du titre du journal', async () => {
    servirJournal(JOURNAL)
    monter()
    expect(await screen.findByText('3 films cette année')).toBeInTheDocument()
  })

  it('propose « J’ai vu un film », qui mène à la recherche', async () => {
    servirJournal(JOURNAL)
    monter()
    expect(await screen.findByRole('link', { name: 'J’ai vu un film' })).toHaveAttribute('href', '/recherche')
  })

  it('invite à remplir la vitrine quand le journal est vide, sans titre de journal ni bouton flottant', async () => {
    servirJournal([])
    monter()
    expect(await screen.findByText('La vitrine attend sa première affiche.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Le journal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'J’ai vu un film' })).not.toBeInTheDocument()
  })
})
