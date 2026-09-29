import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import AuCine from './AuCine'
import { createQueryClient } from '../api/queryClient'
import { json, servir as servirBrut } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { JournalItem, JournalPage } from '../api/journal'
import { cles } from '../api/cles'
import type { Sorties } from '../api/sorties'
import type { Realisateur } from '../api/realisateurs'
import type { FilmsSaga, Saga } from '../api/sagas'
import type { CandidatFilm } from '../formulaire/candidat'

/**
 * Depuis le sceau des Suivis, l'onglet demande aussi les deux listes suivies : vides ici, sauf
 * quand un test les pose lui-même (`routes` l'emporte sur ces défauts).
 */
const servir = (routes: Parameters<typeof servirBrut>[0]) =>
  servirBrut({ 'GET /api/me/realisateurs': () => json([]), 'GET /api/me/sagas': () => json([]), ...routes })

const SORTIES_EXEMPLE = exemple<Sorties>('/reference/sorties', 'get', 200)
const BASE_ITEM = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

const SORTIES_VIDES: Sorties = {
  en_cours: { du: '2026-09-15', au: '2026-09-15', calcule_le: null, cinemas_configures: false, films: [] },
  prochaine: { du: '2026-09-21', au: '2026-09-27', films: [] },
}

function seance(overrides: { id: string; finished_at: string; title?: string; externalId?: string }): JournalItem {
  return {
    ...BASE_ITEM,
    entry: { ...BASE_ITEM.entry, id: overrides.id, finished_at: overrides.finished_at },
    media: { ...BASE_ITEM.media, title: overrides.title ?? BASE_ITEM.media.title, external_id: overrides.externalId ?? BASE_ITEM.media.external_id },
  }
}

/** Un `IntersectionObserver` de test qui ne se déclenche que sur demande — jumeau d'`Accueil.test.tsx`. */
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

/** Un `IntersectionObserver` qui signale sa sentinelle visible dès qu'on l'observe — jumeau de `MesFilms.test.tsx`. */
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

const pannePassagere = async () => {
  await new Promise((r) => setTimeout(r, 20))
  return json({ code: 'INTERNAL', message: 'Le journal n’a pas pu être lu.', retryable: false }, 500)
}
const patienter = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pagesDe = (requetes: string[]) => requetes.filter((r) => r.includes('cursor=page-2')).length

/** Un lecteur de l'état de navigation : le formulaire de création (`candidat`). */
function StubFormulaire() {
  const location = useLocation()
  const etat = location.state as { candidat?: CandidatFilm } | null
  if (!etat?.candidat) return <p>Aucun candidat</p>
  return (
    <p>
      Formulaire pour {etat.candidat.title} ({etat.candidat.source}:{etat.candidat.external_id})
    </p>
  )
}

/** Un lecteur de l'état de navigation : la fiche d'un visionnage (`item`, `depuis`). */
function StubFiche() {
  const location = useLocation()
  const etat = location.state as { item?: JournalItem; depuis?: string } | null
  if (!etat?.item) return <p>Aucune séance</p>
  return (
    <p>
      Fiche de {etat.item.media.title}, depuis {etat.depuis}
    </p>
  )
}

function monter(client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/au-cine']}>
        <Routes>
          <Route path="/au-cine" element={<AuCine />} />
          <Route path="/journal/nouveau" element={<StubFormulaire />} />
          <Route path="/journal/:id" element={<StubFiche />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const routeSeances = (items: JournalItem[], next_cursor: string | null = null) => ({
  'GET /api/me/journal?limit=40&reaction=en_salle': () => json({ items, next_cursor }),
})

describe('Au ciné', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('IntersectionObserver', FauxObservateur)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('affiche le titre fixe de l’onglet et compte 0 séance quand tout est vide', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_VIDES), ...routeSeances([]) })
    monter()

    expect(await screen.findByRole('heading', { level: 1, name: 'Au ciné' })).toBeInTheDocument()
    expect(await screen.findByText('0 séance cette année')).toBeInTheDocument()
  })

  it('trois listes vides : leurs trois messages propres, jamais confondus', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_VIDES), ...routeSeances([]) })
    monter()

    expect(await screen.findByText('Pas encore de programme.')).toBeInTheDocument()
    expect(await screen.findByText('Rien cette semaine.')).toBeInTheDocument()
    expect(await screen.findByText('Aucune séance pour l’instant.')).toBeInTheDocument()
  })

  it('« Rien à l’affiche aujourd’hui. » quand la tâche de fond a tourné sans rien trouver', async () => {
    const sorties: Sorties = {
      ...SORTIES_VIDES,
      en_cours: { ...SORTIES_VIDES.en_cours, cinemas_configures: true, calcule_le: '2026-09-15T08:00:00Z' },
    }
    servir({ 'GET /api/reference/sorties': () => json(sorties), ...routeSeances([]) })
    monter()

    expect(await screen.findByText('Rien à l’affiche aujourd’hui.')).toBeInTheDocument()
    expect(screen.queryByText('Pas encore de programme.')).not.toBeInTheDocument()
  })

  it('la grille « à l’affiche » montre le cinéma, la grille « semaine prochaine » n’en montre aucun', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_EXEMPLE), ...routeSeances([]) })
    monter()

    expect(await screen.findByText('Les Gardiens de la nuit')).toBeInTheDocument()
    expect(screen.getByText('UGC Ciné Cité Les Halles +1')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Marée basse/ })).toBeInTheDocument()
  })

  it('un seul cinéma pour toute la grille : son nom la titre une fois, et quitte chaque tuile', async () => {
    const film = SORTIES_EXEMPLE.en_cours.films[0]!
    const sorties: Sorties = {
      ...SORTIES_EXEMPLE,
      en_cours: {
        ...SORTIES_EXEMPLE.en_cours,
        films: [
          { ...film, allocine_id: 1, tmdb_id: 1, title: 'Premier film', cinemas: ['Le Rex'] },
          { ...film, allocine_id: 2, tmdb_id: 2, title: 'Second film', cinemas: ['Le Rex'] },
        ],
      },
    }
    servir({ 'GET /api/reference/sorties': () => json(sorties), ...routeSeances([]) })
    monter()

    await screen.findByRole('link', { name: /Premier film/ })
    // Mutation : garder le sous-titre sur chaque tuile le répète trois fois ; ne pas titrer la
    // grille ne le montre plus du tout.
    expect(screen.getAllByText('Le Rex')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Premier film/ })).not.toHaveTextContent('Le Rex')
  })

  it('« mis à jour à HH h » suit calcule_le, en heure Europe/Paris', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_EXEMPLE), ...routeSeances([]) })
    monter()

    // calcule_le = 2026-09-15T08:00:03.000Z, CEST (+2) : 10h à Paris.
    expect(await screen.findByText('mis à jour à 10 h')).toBeInTheDocument()
  })

  it('une tuile « déjà dans ton journal » porte la coche, rapprochée par tmdb_id parmi les séances chargées', async () => {
    servir({
      'GET /api/reference/sorties': () => json(SORTIES_EXEMPLE),
      ...routeSeances([seance({ id: 's1', finished_at: '2026-09-10', externalId: '912649' })]),
    })
    monter()

    const tuile = await screen.findByRole('link', { name: /Les Gardiens de la nuit/ })
    expect(tuile.querySelector('[aria-label="Déjà dans ton journal"]')).toBeInTheDocument()
    // « Marée basse » (tmdb_id 1022789) n'est vu par aucune séance chargée : pas de coche. Sans
    // couverture (`cover_url` nul), `Affiche` pose aussi son titre en texte alternatif : la
    // tuile se cherche par son rôle de lien, jamais par un texte qui s'y trouve en double.
    const autreTuile = screen.getByRole('link', { name: /Marée basse/ })
    expect(autreTuile.querySelector('[aria-label="Déjà dans ton journal"]')).not.toBeInTheDocument()
  })

  it('une tuile sans tmdb_id résolu n’est pas cliquable et ne porte jamais la coche', async () => {
    const sorties: Sorties = {
      ...SORTIES_EXEMPLE,
      en_cours: {
        ...SORTIES_EXEMPLE.en_cours,
        films: [{ ...SORTIES_EXEMPLE.en_cours.films[0]!, tmdb_id: null }],
      },
    }
    servir({
      'GET /api/reference/sorties': () => json(sorties),
      ...routeSeances([seance({ id: 's1', finished_at: '2026-09-10', externalId: '912649' })]),
    })
    monter()

    const titre = await screen.findByText('Les Gardiens de la nuit')
    expect(titre.closest('a')).toBeNull()
    expect(screen.queryByLabelText('Déjà dans ton journal')).not.toBeInTheDocument()
  })

  it('toucher une tuile ouvre le formulaire, prérempli sur ce film', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_EXEMPLE), ...routeSeances([]) })
    monter()

    fireEvent.click(await screen.findByRole('link', { name: /Marée basse/ }))

    expect(await screen.findByText('Formulaire pour Marée basse (tmdb:1022789)')).toBeInTheDocument()
  })

  it('toucher une séance ouvre sa fiche, avec le retour vers Au ciné', async () => {
    servir({
      'GET /api/reference/sorties': () => json(SORTIES_VIDES),
      ...routeSeances([seance({ id: 's1', finished_at: '2026-09-10', title: 'Une séance' })]),
    })
    monter()

    fireEvent.click(await screen.findByText('Une séance'))

    expect(await screen.findByText('Fiche de Une séance, depuis /au-cine')).toBeInTheDocument()
  })

  it('l’erreur des sorties s’affiche telle quelle, avec Réessayer, sans se redire sous « La semaine prochaine »', async () => {
    const message = 'Les sorties sont momentanément indisponibles.'
    let enPanne = true
    servir({
      // `retryable: false` : sinon le client relance tout seul (`createQueryClient`), et l'assertion
      // devrait attendre les tentatives internes avant de voir l'erreur se stabiliser.
      'GET /api/reference/sorties': () => (enPanne ? json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503) : json(SORTIES_VIDES)),
      ...routeSeances([]),
    })
    monter()

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(message)
    // Un seul bloc d'erreur pour les deux sections : la « semaine prochaine » ne le répète pas.
    expect(screen.getAllByText(message)).toHaveLength(1)

    enPanne = false
    fireEvent.click(within(alerte).getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Rien cette semaine.')).toBeInTheDocument()
  })

  it('l’erreur des séances s’affiche telle quelle sans donnée, avec Réessayer', async () => {
    const message = 'Le journal est momentanément indisponible.'
    let enPanne = true
    servir({
      'GET /api/reference/sorties': () => json(SORTIES_VIDES),
      'GET /api/me/journal?limit=40&reaction=en_salle': () =>
        enPanne ? json({ code: 'SERVICE_UNCONFIGURED', message, retryable: false }, 503) : json({ items: [], next_cursor: null }),
    })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)

    enPanne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Aucune séance pour l’instant.')).toBeInTheDocument()
  })

  it('la pagination de « Tes séances » s’arrête au dernier curseur, jamais une troisième requête', async () => {
    const s1 = seance({ id: 's1', finished_at: '2026-09-10', title: 'Premiere' })
    const s2 = seance({ id: 's2', finished_at: '2026-09-01', title: 'Seconde' })
    const requetes = servir({
      'GET /api/reference/sorties': () => json(SORTIES_VIDES),
      'GET /api/me/journal?limit=40&reaction=en_salle': () => json({ items: [s1], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=40&cursor=page-2&reaction=en_salle': () => json({ items: [s2], next_cursor: null }),
    })
    monter()

    await screen.findByTestId('sentinelle-au-cine')
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toHaveLength(1)

    FauxObservateur.dernier!.declencher()

    await screen.findByText('Seconde')
    await vi.waitFor(() => expect(screen.queryByTestId('sentinelle-au-cine')).not.toBeInTheDocument())
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([
      'GET /api/me/journal?limit=40&reaction=en_salle',
      'GET /api/me/journal?limit=40&cursor=page-2&reaction=en_salle',
    ])
  })

  it('une page en échec n’entre pas en rafale, et « Réessayer » la reprend', async () => {
    vi.stubGlobal('IntersectionObserver', ObservateurVisible)
    const s1 = seance({ id: 's1', finished_at: '2026-09-10', title: 'Premiere' })
    const s2 = seance({ id: 's2', finished_at: '2026-09-01', title: 'Seconde' })
    let enPanne = true
    const requetes = servir({
      'GET /api/reference/sorties': () => json(SORTIES_VIDES),
      'GET /api/me/journal?limit=40&reaction=en_salle': () => json({ items: [s1], next_cursor: 'page-2' }),
      'GET /api/me/journal?limit=40&cursor=page-2&reaction=en_salle': () => (enPanne ? pannePassagere() : json({ items: [s2], next_cursor: null })),
    })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent('Le journal n’a pas pu être lu.')
    // Mutation : sans `isFetchNextPageError` dans la garde, l'observateur recréé après l'échec
    // resignale la sentinelle visible, et la page repart sans fin.
    await patienter(250)
    expect(pagesDe(requetes)).toBe(1)
    expect(screen.getByText('Premiere')).toBeInTheDocument()

    enPanne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Seconde')).toBeInTheDocument()
    expect(pagesDe(requetes)).toBe(2)
  })

  it('une séance passée d’une autre année ne compte jamais dans l’en-tête', async () => {
    // `toFake: ['Date']` seul : `findByText` s'appuie sur de vraies minuteries (`waitFor`), que
    // des faux timers globaux bloqueraient sans jamais les avancer.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-29T12:00:00+02:00'))
    servir({
      'GET /api/reference/sorties': () => json(SORTIES_VIDES),
      ...routeSeances([
        seance({ id: 's1', finished_at: '2026-01-05', title: 'Cette année' }),
        seance({ id: 's2', finished_at: '2026-09-03', title: 'Cette année aussi' }),
        // Un compte qui figerait une année en dur (2025, par exemple) donnerait aussi 1 ici — le
        // même total par coïncidence. Deux séances de 2026 contre une de 2025 les distingue :
        // seule l'année réellement en cours (« maintenant », fixée ci-dessus) rend 2.
        seance({ id: 's3', finished_at: '2025-12-20', title: 'L’an dernier' }),
      ]),
    })
    monter()

    expect(await screen.findByText('2 séances cette année')).toBeInTheDocument()
  })

  describe('le sceau des Suivis', () => {
    const DELAPORTE = { ...exemple<Realisateur[]>('/me/realisateurs', 'get', 200)[0]!, tmdb_id: 7, name: 'ALIX DELAPORTE' }
    const ALIEN = exemple<Saga[]>('/me/sagas', 'get', 200)[0]!
    const FILMS_ALIEN = exemple<FilmsSaga>('/me/sagas/{tmdbId}/films', 'get', 200)
    // « Marée basse » (1022789), de la semaine prochaine : faisons-la sortir d'une saga suivie.
    const SORTIES = structuredClone(SORTIES_EXEMPLE)
    const MAREE = { ...FILMS_ALIEN.films[0]!, tmdb_id: SORTIES.prochaine.films[0]!.tmdb_id }

    it('un réalisateur suivi, retrouvé par son nom, pose le sceau sur sa tuile à l’affiche', async () => {
      servir({
        'GET /api/reference/sorties': () => json(SORTIES),
        'GET /api/me/realisateurs': () => json([DELAPORTE]),
        ...routeSeances([]),
      })
      monter()

      // Mutation : sans le rapprochement des noms, aucune tuile ne porterait ce sceau.
      expect(await screen.findByLabelText('Réalisateur suivi')).toBeInTheDocument()
      expect(screen.queryByLabelText('Saga suivie')).not.toBeInTheDocument()
    })

    it('une saga suivie dont les films sont déjà en cache pose le sceau sur la tuile de la semaine prochaine', async () => {
      const client = createQueryClient()
      client.setQueryData(cles.filmsSaga(ALIEN.tmdb_id), { films: [MAREE] })
      const requetes = servir({
        'GET /api/reference/sorties': () => json(SORTIES),
        'GET /api/me/sagas': () => json([ALIEN]),
        ...routeSeances([]),
      })
      monter(client)

      expect(await screen.findByLabelText('Saga suivie')).toBeInTheDocument()
      // « aucun appel réseau nouveau » : jamais la filmographie d'une saga depuis cet onglet.
      expect(requetes.filter((r) => r.includes('/films'))).toEqual([])
    })

    it('sans filmographie en cache, le sceau de saga n’est pas posé, et rien n’est demandé pour autant', async () => {
      const requetes = servir({
        'GET /api/reference/sorties': () => json(SORTIES),
        'GET /api/me/sagas': () => json([ALIEN]),
        ...routeSeances([]),
      })
      monter()

      await screen.findAllByText('Marée basse')
      await vi.waitFor(() => expect(requetes).toContain('GET /api/me/sagas'))
      await patienter(30)
      // Mutation : un chargement des films (charger = true) ferait partir `GET /api/me/sagas/8091/films`.
      expect(requetes.filter((r) => r.includes('/films'))).toEqual([])
      expect(screen.queryByLabelText('Saga suivie')).not.toBeInTheDocument()
    })

    it('rien de suivi : aucun sceau', async () => {
      servir({ 'GET /api/reference/sorties': () => json(SORTIES), ...routeSeances([]) })
      monter()

      await screen.findAllByText('Marée basse')
      expect(screen.queryByLabelText('Réalisateur suivi')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Saga suivie')).not.toBeInTheDocument()
    })
  })
})
