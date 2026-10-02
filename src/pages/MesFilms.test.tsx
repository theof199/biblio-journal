import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import MesFilms from './MesFilms'
import Fiche from './Fiche'
import Formulaire from './Formulaire'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { ROUTES_ACCUEIL } from '../test/routesAccueil'
import type { JournalItem, JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'

const BASE = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)

function film(overrides: {
  id: string
  title: string
  director?: string | null
  finished_at: string
  rating?: number | null
  reactions?: string[]
  comment?: string | null
}): JournalItem {
  return {
    ...BASE,
    entry: { ...BASE.entry, id: overrides.id, finished_at: overrides.finished_at, rating: overrides.rating ?? null },
    media: { ...BASE.media, title: overrides.title, director: overrides.director ?? null },
    carnet: { reactions: overrides.reactions ?? [], comment: overrides.comment ?? null },
  }
}

// Dates espacées à la main : F1 le plus récent, F3 le plus ancien. F3 vit sur la seconde page,
// jamais chargée sans pagination ni filtre.
const F1 = film({ id: 'f1', title: 'Inception', director: 'Christopher Nolan', finished_at: '2026-03-01', rating: 9, reactions: ['adore'] })
const F2 = film({ id: 'f2', title: 'Interstellar', director: 'Christopher Nolan', finished_at: '2026-02-01', rating: null })
const F3 = film({
  id: 'f3',
  title: 'Le Voyage de Chihiro',
  director: 'Hayao Miyazaki',
  finished_at: '2026-01-01',
  rating: 8,
  reactions: ['adore', 'en_salle'],
  comment: 'Vu avec Léa, jamais montré ailleurs.',
})

const compteVide = { finished_by_type: { movie: 0 } }
const stats = (total: number, cetteAnnee: number) => ({
  dashboard: {
    scope: { user: {}, timezone: 'Europe/Paris', week_starts_on: 'monday', generated_at: '2026-09-29T00:00:00.000Z' },
    periods: {
      week: { from: null, to: '2026-09-29', counts: compteVide, quantities: {} },
      month: { from: null, to: '2026-09-29', counts: compteVide, quantities: {} },
      year: { from: null, to: '2026-09-29', counts: { finished_by_type: { movie: cetteAnnee } }, quantities: {} },
      all: { from: null, to: '2026-09-29', counts: { finished_by_type: { movie: total } }, quantities: {} },
    },
    highlights: {},
  },
  comparison: null,
})

/**
 * Un `IntersectionObserver` fidèle au vrai sur un point : tout observateur neuf signale aussitôt
 * une sentinelle déjà visible. C'est ce qui relance la pagination à chaque recréation.
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

/** Une réponse qui attend d'être libérée par le test, pour observer la page pendant le chargement. */
function differee() {
  let liberer!: (r: Response) => void
  const promesse = new Promise<Response>((resolve) => (liberer = resolve))
  return { promesse, liberer }
}

/** Une panne de page qui prend le temps d'un vrai réseau : sans délai, l'état « en cours » ne se rend jamais. */
const pannePassagere = async () => {
  await new Promise((r) => setTimeout(r, 20))
  return json({ code: 'INTERNAL', message: 'Le journal n’a pas pu être lu.', retryable: false }, 500)
}
const pagesDe = (requetes: string[]) => requetes.filter((r) => r.includes('cursor=page-2')).length
const patienter = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Une sentinelle d'`IntersectionObserver` de test, jumelle de celle d'`Accueil.test.tsx`. */
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

function monter(client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/profil/mes-films']}>
        <Routes>
          <Route path="/profil/mes-films" element={<MesFilms />} />
          <Route path="/journal/:id" element={<Fiche />} />
          <Route path="/journal/:id/corriger" element={<Formulaire />} />
          <Route path="/recherche" element={<p>La recherche</p>} />
          <Route path="/" element={<p>L’accueil</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ouvrirPanneauNote = () => fireEvent.click(screen.getByRole('button', { name: 'Note' }))
const ouvrirPanneauReaction = () => fireEvent.click(screen.getByRole('button', { name: 'Réaction' }))

describe('Mes films', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('IntersectionObserver', FauxObservateur)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('liste le journal trié par date, récents d’abord, avec le compte de l’en-tête', async () => {
    servir({
      // Servie dans le désordre : la page ne doit rien au tri de l'API.
      'GET /api/me/journal?limit=20': () => json({ items: [F2, F1], next_cursor: null }),
      'GET /api/stats': () => json(stats(12, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    await screen.findByRole('heading', { name: 'Mes films' })
    expect(await screen.findByText('12 films · 3 cette année')).toBeInTheDocument()
    const titres = (await screen.findAllByRole('heading', { level: 1 })).length // garde-fou : un seul h1
    expect(titres).toBe(1)
    const noms = screen.getAllByText(/Inception|Interstellar/).map((n) => n.textContent)
    expect(noms).toEqual(['Inception', 'Interstellar'])
  })

  it('sans film, propose d’en ajouter un, vers la recherche', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [], next_cursor: null }),
      'GET /api/stats': () => json(stats(0, 0)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    expect(await screen.findByText('Aucun film pour l’instant.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un film' }))
    expect(await screen.findByText('La recherche')).toBeInTheDocument()
  })

  it('affiche le message d’erreur de l’API tel quel, sans film chargé', async () => {
    const message = 'Le journal est momentanément indisponible.'
    servir({
      'GET /api/me/journal?limit=20': () => json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503),
      'GET /api/stats': () => json(stats(0, 0)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('la remarque privée du carnet ne sort jamais', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(1, 1)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    await screen.findByText('Le Voyage de Chihiro')
    // Mutation : sans cette omission volontaire, la remarque — qui n'appartient qu'à son auteur —
    // apparaîtrait sur une liste que d'autres pages peuvent atteindre demain.
    expect(screen.queryByText(F3.carnet.comment!)).not.toBeInTheDocument()
  })

  it('un film cliqué ouvre sa fiche, avec ses propres données', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(2, 2)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    fireEvent.click(await screen.findByText('Le Voyage de Chihiro'))
    expect(await screen.findByRole('heading', { name: 'Le Voyage de Chihiro' })).toBeInTheDocument()
    expect(screen.getByText('Noté 8 / 10')).toBeInTheDocument()
  })

  it('sans filtre, la suite se charge quand la sentinelle entre dans l’écran', async () => {
    const requetes = servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': () => json({ items: [F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    await screen.findByTestId('sentinelle-mes-films')
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toHaveLength(1)
    expect(screen.queryByText('Le Voyage de Chihiro')).not.toBeInTheDocument()

    FauxObservateur.dernier!.declencher()

    await screen.findByText('Le Voyage de Chihiro')
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([
      'GET /api/me/journal?limit=20',
      'GET /api/me/journal?limit=20&cursor=page-2',
    ])
    // Mutation : sans le calcul de `hasNextPage` après la dernière page, la sentinelle resterait
    // dans le DOM et redéclencherait un appel.
    expect(screen.queryByTestId('sentinelle-mes-films')).not.toBeInTheDocument()
  })

  it('un filtre charge tout le journal, sans attendre le défilement', async () => {
    const requetes = servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': () => json({ items: [F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    // Sans filtre, la page attend le défilement : la sentinelle est là, une seule page a chargé.
    await screen.findByTestId('sentinelle-mes-films')
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Rechercher parmi mes films'), { target: { value: 'chihiro' } })

    // Chihiro n'est que sur la seconde page : le retrouver prouve que les deux pages ont chargé
    // sans qu'aucune sentinelle n'ait été déclenchée. Sous un filtre, la sentinelle disparaît :
    // c'est l'effet de chargement complet qui agit seul.
    expect(await screen.findByText('Le Voyage de Chihiro')).toBeInTheDocument()
    expect(screen.queryByTestId('sentinelle-mes-films')).not.toBeInTheDocument()
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([
      'GET /api/me/journal?limit=20',
      'GET /api/me/journal?limit=20&cursor=page-2',
    ])
  })

  it('la recherche filtre sur le titre et le réalisateur, insensible à la casse et aux accents', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    fireEvent.change(screen.getByLabelText('Rechercher parmi mes films'), { target: { value: 'MIYA' } })
    await screen.findByText('Le Voyage de Chihiro')
    expect(screen.queryByText('Inception')).not.toBeInTheDocument()
    expect(screen.queryByText('Interstellar')).not.toBeInTheDocument()
  })

  it('sans résultat, propose d’effacer les filtres', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    fireEvent.change(screen.getByLabelText('Rechercher parmi mes films'), { target: { value: '  introuvable ' } })
    // Le texte cherché, rogné. `findByText` rogne et resserre les blancs de lui-même : seul le
    // texte exact du nœud prouve que la page les a retirés.
    const rien = await screen.findByText(/Rien trouvé pour/)
    expect(rien.textContent).toBe('Rien trouvé pour « introuvable ».')

    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }))
    expect(await screen.findByText('Inception')).toBeInTheDocument()
    expect(screen.queryByText('Rien trouvé pour « introuvable ».')).not.toBeInTheDocument()
  })

  it('le filtre par note garde les notes cochées (ou), et écarte un film sans note', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': () => json({ items: [F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    ouvrirPanneauNote()
    fireEvent.click(screen.getByRole('button', { name: 'Note 9' }))

    await screen.findByText('Inception')
    expect(screen.queryByText('Interstellar')).not.toBeInTheDocument() // sans note : écarté
    expect(screen.queryByText('Le Voyage de Chihiro')).not.toBeInTheDocument() // note 8, pas cochée

    fireEvent.click(screen.getByRole('button', { name: 'Note 8' }))
    expect(await screen.findByText('Le Voyage de Chihiro')).toBeInTheDocument()
    expect(screen.getByText('Inception')).toBeInTheDocument()
    expect(screen.queryByText('Interstellar')).not.toBeInTheDocument()
  })

  it('le filtre par réaction garde tout ce qui est coché (et)', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    ouvrirPanneauReaction()
    fireEvent.click(screen.getByRole('button', { name: /J’ai adoré/ }))

    await screen.findByText('Inception')
    expect(screen.getByText('Le Voyage de Chihiro')).toBeInTheDocument()
    expect(screen.queryByText('Interstellar')).not.toBeInTheDocument() // n'a aucune réaction

    fireEvent.click(screen.getByRole('button', { name: /En salle/ }))
    // Seul Chihiro porte les deux réactions à la fois.
    expect(await screen.findByText('Le Voyage de Chihiro')).toBeInTheDocument()
    expect(screen.queryByText('Inception')).not.toBeInTheDocument()
  })

  it('le tri par note met les films sans note en dernier', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    ouvrirPanneauNote()
    fireEvent.click(screen.getByRole('button', { name: 'Trier par note' }))

    await screen.findByText('Inception')
    const ordre = screen.getAllByText(/Inception|Interstellar|Le Voyage de Chihiro/).map((n) => n.textContent)
    expect(ordre).toEqual(['Inception', 'Le Voyage de Chihiro', 'Interstellar'])
  })

  it('un film vu en salle porte l’icône dédiée, sans le redire dans les réactions', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(1, 1)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    await screen.findByText('Le Voyage de Chihiro')
    expect(screen.getByText('Vu au cinéma')).toBeInTheDocument()
    expect(screen.getByText('J’ai adoré')).toBeInTheDocument()
    expect(screen.queryByText(/En salle/)).not.toBeInTheDocument()
  })

  it('sous un filtre, une page en échec arrête le chargement complet, et « Réessayer » le reprend', async () => {
    let enPanne = true
    const requetes = servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': () => (enPanne ? pannePassagere() : json({ items: [F3], next_cursor: null })),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    fireEvent.change(screen.getByLabelText('Rechercher parmi mes films'), { target: { value: 'chihiro' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Le journal n’a pas pu être lu.')
    // Mutation : sans `isFetchNextPageError` dans la garde de l'effet, la même page repart dès
    // l'échec, sans fin — une quinzaine d'appels en un quart de seconde.
    await patienter(250)
    expect(pagesDe(requetes)).toBe(1)
    // La page ne prétend plus charger ce qui a échoué.
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument()

    enPanne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Le Voyage de Chihiro')).toBeInTheDocument()
    expect(pagesDe(requetes)).toBe(2)
  })

  it('sans filtre, une page en échec ne relance pas la sentinelle en boucle', async () => {
    vi.stubGlobal('IntersectionObserver', ObservateurVisible)
    const requetes = servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': pannePassagere,
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent('Le journal n’a pas pu être lu.')
    // Mutation : sans `isFetchNextPageError` dans `chargerLaSuite`, l'observateur recréé après
    // l'échec signale la sentinelle toujours visible, et la page repart.
    await patienter(250)
    expect(pagesDe(requetes)).toBe(1)
  })

  it('tant que le journal n’est pas entier, « Rien avec ces filtres » ne se dit pas', async () => {
    const suite = differee()
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=20&cursor=page-2': () => suite.promesse,
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    fireEvent.change(screen.getByLabelText('Rechercher parmi mes films'), { target: { value: 'chihiro' } })

    // Chihiro n'est que sur la page en vol : la première page seule ne contient rien qui corresponde.
    expect(await screen.findByText('Chargement…')).toBeInTheDocument()
    expect(screen.queryByText(/Rien trouvé/)).not.toBeInTheDocument()

    suite.liberer(json({ items: [F3], next_cursor: null }))
    expect(await screen.findByText('Le Voyage de Chihiro')).toBeInTheDocument()
  })

  it('la puce Date inverse l’ordre : anciens d’abord', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    fireEvent.click(screen.getByRole('button', { name: 'Date, récents d’abord' }))

    expect(await screen.findByRole('button', { name: 'Date, anciens d’abord' })).toBeInTheDocument()
    const ordre = screen.getAllByText(/Inception|Interstellar|Le Voyage de Chihiro/).map((n) => n.textContent)
    expect(ordre).toEqual(['Le Voyage de Chihiro', 'Interstellar', 'Inception'])
  })

  it('« Effacer les notes » décoche les notes et rend aussi le tri par date', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')

    ouvrirPanneauNote()
    fireEvent.click(screen.getByRole('button', { name: 'Trier par note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Note 9' }))
    expect(await screen.findByRole('button', { name: 'Note, tri · 1' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Effacer les notes' }))

    // Jumeau du « Effacer » de la feuille Note d'Android (`setTri(DATE_DESC)` puis `effacerNotes()`).
    expect(await screen.findByRole('button', { name: 'Note' })).toBeInTheDocument()
    const ordre = screen.getAllByText(/Inception|Interstellar|Le Voyage de Chihiro/).map((n) => n.textContent)
    expect(ordre).toEqual(['Inception', 'Interstellar', 'Le Voyage de Chihiro'])
  })

  it('les filtres survivent à un aller-retour par la fiche, dont le retour ramène ici', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F2, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(3, 3)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()
    await screen.findByText('Inception')
    fireEvent.change(screen.getByLabelText('Rechercher parmi mes films'), { target: { value: 'nolan' } })
    await screen.findByText('Interstellar')
    expect(screen.queryByText('Le Voyage de Chihiro')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Interstellar'))
    await screen.findByRole('heading', { name: 'Interstellar' })

    // « Retour » recule dans l'historique (`ui/BoutonRetour.tsx`, qui le garde) ; le repli par
    // `depuis`, sans historique, est gardé par `Fiche.test.tsx`.
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    await screen.findByRole('heading', { name: 'Mes films' })

    // Mutation : un `useState` seul remettrait la recherche à vide au remontage de la page.
    expect(screen.getByLabelText('Rechercher parmi mes films')).toHaveValue('nolan')
    expect(await screen.findByText('Inception')).toBeInTheDocument()
    expect(screen.queryByText('Le Voyage de Chihiro')).not.toBeInTheDocument()
  })

  it('de la fiche au formulaire puis retour, la fiche garde son film et ramène encore ici', async () => {
    servir({
      'GET /api/me/journal?limit=20': () => json({ items: [F1, F3], next_cursor: null }),
      'GET /api/stats': () => json(stats(2, 2)),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    monter()

    fireEvent.click(await screen.findByText('Le Voyage de Chihiro'))
    fireEvent.click(await screen.findByRole('link', { name: 'Corriger' }))
    await screen.findByLabelText(/Séance du/)

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    // Mutation : sans l'état remis par le retour du formulaire, la fiche dirait « plus disponible ».
    expect(await screen.findByRole('heading', { name: 'Le Voyage de Chihiro' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    expect(await screen.findByRole('heading', { name: 'Mes films' })).toBeInTheDocument()
  })
})

/** Le chemin courant, pour prouver la navigation plutôt que la deviner. */
function Ou() {
  return <output data-testid="chemin">{useLocation().pathname}</output>
}

describe('l’entrée de « Mes films » depuis le profil', () => {
  const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)

  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('un clic sur « Mes films » depuis le profil ouvre la page, l’onglet Profil restant seul marqué', async () => {
    servir({
      'GET /api/auth/me': () => json(SESSION),
      ...ROUTES_ACCUEIL,
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/profil']}>
          <App />
          <Ou />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('link', { name: /^Mes films, carte de / }))

    expect(await screen.findByRole('heading', { name: 'Mes films' })).toBeInTheDocument()
    expect(screen.getByTestId('chemin')).toHaveTextContent('/profil/mes-films')
    const barre = screen.getByRole('navigation', { name: 'Onglets' })
    const marques = within(barre)
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
      .map((lien) => lien.textContent)
    expect(marques).toEqual(['Profil'])
  })
})
