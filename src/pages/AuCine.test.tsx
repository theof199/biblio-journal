import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import AuCine from './AuCine'
import { createQueryClient } from '../api/queryClient'
import { json, servir as servirBrut } from '../test/serveur'
import { exemple } from '../test/contrat'
import type { JournalItem, JournalPage } from '../api/journal'
import { cles } from '../api/cles'
import type { CinemaDuJour, SeanceDuJour, SeancesDuJour } from '../api/seances'
import type { Sorties } from '../api/sorties'
import type { Realisateur } from '../api/realisateurs'
import type { FilmsSaga, Saga } from '../api/sagas'
import type { EtatFiche } from './FicheFilm'
import { FournisseurPosition } from '../cinema/FournisseurPosition'
import { simulerNavigateur } from '../test/navigateur'

/**
 * Depuis le sceau des Suivis, l'onglet demande aussi les deux listes suivies, et depuis le tableau du
 * hall les séances du jour : vides ici, sauf quand un test les pose lui-même (`routes` l'emporte sur
 * ces défauts).
 */
const servir = (routes: Parameters<typeof servirBrut>[0]) =>
  servirBrut({
    'GET /api/me/realisateurs': () => json([]),
    'GET /api/me/sagas': () => json([]),
    [ROUTE_PROCHAINES_SEANCES]: () => json(SEANCES_VIDES),
    ...routes,
  })

const ROUTE_PROCHAINES_SEANCES = 'GET /api/me/cinema/seances'
const SEANCES_VIDES: SeancesDuJour = { jour: '2026-09-15', calcule_le: null, cinemas: [], seances: [] }
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

/** Un lecteur de l'état de navigation : la fiche d'un film (`FicheFilm` vit de cet état). */
function StubFicheFilm() {
  const etat = useLocation().state as EtatFiche | null
  if (!etat) return <p>Aucun état</p>
  return (
    <p>
      Fiche du film {etat.film.title} ({etat.film.tmdb_id}), {etat.film.vu ? `vu (${etat.film.vu.entry_id})` : 'pas vu'}
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
      <FournisseurPosition>
        <MemoryRouter initialEntries={['/au-cine']}>
          <Routes>
            <Route path="/au-cine" element={<AuCine />} />
            <Route path="/au-cine/films/:tmdbId" element={<StubFicheFilm />} />
            <Route path="/journal/:id" element={<StubFiche />} />
          </Routes>
        </MemoryRouter>
      </FournisseurPosition>
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

  it('toucher une tuile ouvre la fiche du film sous Au ciné, pas le formulaire', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_EXEMPLE), ...routeSeances([]) })
    monter()

    const tuile = await screen.findByRole('link', { name: /Marée basse/ })
    expect(tuile).toHaveAttribute('href', '/au-cine/films/1022789')
    fireEvent.click(tuile)

    expect(await screen.findByText('Fiche du film Marée basse (1022789), pas vu')).toBeInTheDocument()
  })

  it('une tuile d’un film déjà vu en salle ouvre sa fiche avec son visionnage, pour qu’elle ne propose pas de le marquer vu', async () => {
    servir({
      'GET /api/reference/sorties': () => json(SORTIES_EXEMPLE),
      ...routeSeances([seance({ id: 'vu-1', finished_at: '2026-09-10', externalId: '912649' })]),
    })
    monter()

    fireEvent.click(await screen.findByRole('link', { name: /Les Gardiens de la nuit/ }))

    expect(await screen.findByText('Fiche du film Les Gardiens de la nuit (912649), vu (vu-1)')).toBeInTheDocument()
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

describe('Au ciné qui attend ses données', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('IntersectionObserver', FauxObservateur)
  })
  afterEach(() => vi.unstubAllGlobals())

  const jamais = () => new Promise<Response>(() => {})

  it('annonce « Chargement… » une fois par requête : les séances du jour, les sorties, les séances', async () => {
    servir({
      'GET /api/reference/sorties': jamais,
      'GET /api/me/journal?limit=40&reaction=en_salle': jamais,
      [ROUTE_PROCHAINES_SEANCES]: jamais,
    })
    monter()

    const statuts = await screen.findAllByRole('status')
    expect(statuts).toHaveLength(3)
    for (const statut of statuts) expect(statut).toHaveTextContent('Chargement…')
  })

  it('les séances du jour en attente : le tableau en blanc, dans son panneau', async () => {
    servir({
      'GET /api/reference/sorties': jamais,
      'GET /api/me/journal?limit=40&reaction=en_salle': jamais,
      [ROUTE_PROCHAINES_SEANCES]: jamais,
    })
    monter()

    expect(await screen.findAllByTestId('ligne-tableau-en-attente')).toHaveLength(3)
    expect(screen.queryByText('Plus de séance ce soir.')).not.toBeInTheDocument()
  })

  it('garde le titre de la page et ceux de ses quatre sections', async () => {
    servir({ 'GET /api/reference/sorties': jamais, 'GET /api/me/journal?limit=40&reaction=en_salle': jamais })
    monter()

    expect(await screen.findByRole('heading', { level: 1, name: 'Au ciné' })).toBeInTheDocument()
    expect(screen.getByText('Prochaines séances')).toBeInTheDocument()
    expect(screen.getByText('Sorti cette semaine dans mes cinémas')).toBeInTheDocument()
    expect(screen.getByText('La semaine prochaine')).toBeInTheDocument()
    expect(screen.getByText('Tes séances')).toBeInTheDocument()
  })

  it('dessine deux grilles de six tuiles en blanc et trois lignes de séance', async () => {
    servir({ 'GET /api/reference/sorties': jamais, 'GET /api/me/journal?limit=40&reaction=en_salle': jamais })
    monter()

    expect(await screen.findAllByTestId('tuile-en-attente')).toHaveLength(12)
    expect(screen.getAllByTestId('ligne-en-attente')).toHaveLength(3)
  })

  it('les séances arrivées, ses lignes en blanc et son statut s’en vont, les sorties attendent encore', async () => {
    servir({ 'GET /api/reference/sorties': jamais, ...routeSeances([seance({ id: 'e1', finished_at: '2026-09-10', title: 'Alien' })]) })
    monter()

    expect(await screen.findByText('Alien')).toBeInTheDocument()
    expect(screen.queryByTestId('ligne-en-attente')).not.toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getAllByTestId('tuile-en-attente')).toHaveLength(12)
  })

  it('les sorties arrivées, ses tuiles en blanc s’en vont, les séances attendent encore', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_VIDES), 'GET /api/me/journal?limit=40&reaction=en_salle': jamais })
    monter()

    expect(await screen.findByText('Rien cette semaine.')).toBeInTheDocument()
    expect(screen.queryByTestId('tuile-en-attente')).not.toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getAllByTestId('ligne-en-attente')).toHaveLength(3)
  })

  it('ne dit pas « 0 séance cette année » tant que les séances ne sont pas là', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_VIDES), 'GET /api/me/journal?limit=40&reaction=en_salle': jamais })
    monter()

    await screen.findAllByTestId('ligne-en-attente')
    expect(screen.queryByText(/séances? cette année/)).not.toBeInTheDocument()
  })

  it('donne le compte de l’année une fois les séances arrivées', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_VIDES), ...routeSeances([]) })
    monter()

    expect(await screen.findByText('0 séance cette année')).toBeInTheDocument()
  })

  it('tout arrivé, plus aucun statut ni aucune forme en blanc', async () => {
    servir({ 'GET /api/reference/sorties': () => json(SORTIES_VIDES), ...routeSeances([seance({ id: 'e1', finished_at: '2026-09-10', title: 'Alien' })]) })
    monter()

    expect(await screen.findByText('Rien cette semaine.')).toBeInTheDocument()
    expect(await screen.findByText('Alien')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tuile-en-attente')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ligne-en-attente')).not.toBeInTheDocument()
  })

  it('ne lance que les cinq requêtes de la page, chacune une fois — les séances du jour en une seule', async () => {
    const requetes = servir({ 'GET /api/reference/sorties': jamais, 'GET /api/me/journal?limit=40&reaction=en_salle': jamais })
    monter()

    await screen.findAllByRole('status')
    await patienter(20)
    expect([...requetes].sort()).toEqual(
      [
        'GET /api/me/cinema/seances',
        'GET /api/me/journal?limit=40&reaction=en_salle',
        'GET /api/me/realisateurs',
        'GET /api/me/sagas',
        'GET /api/reference/sorties',
      ].sort(),
    )
  })
})

describe('le tableau du hall : les prochaines séances', () => {
  /** Dix-huit heures cinquante-cinq à Paris : l'heure de la maquette. */
  const MAINTENANT = '2026-10-03T18:55:00+02:00'
  const HALLES: CinemaDuJour = { id: 'C1', nom: 'UGC Les Halles', latitude: 48.8625, longitude: 2.3466 }
  const ODEON: CinemaDuJour = { id: 'C2', nom: 'UGC Odéon', latitude: 48.8527, longitude: 2.3385 }
  const CHAMPO: CinemaDuJour = { id: 'C3', nom: 'Le Champo', latitude: null, longitude: null }
  /** À deux pas d'Odéon : plus près que les Halles, alors que « Halles » précède « Odéon » par ordre alphabétique. */
  const PRES_D_ODEON = { reponse: 'position', latitude: 48.853, longitude: 2.339 } as const

  function uneSeance(
    hhmm: string,
    cinema: CinemaDuJour,
    titre: string,
    tmdbId: number,
    extra: Partial<SeanceDuJour> = {},
  ): SeanceDuJour {
    return {
      debut: `2026-10-03T${hhmm}:00+02:00`,
      version: 'VF',
      cinema_id: cinema.id,
      film: { tmdb_id: tmdbId, title: titre, year: 2026, cover_url: null },
      nouveaute: true,
      marque: null,
      ...extra,
    }
  }
  const jour = (cinemas: CinemaDuJour[], seances: SeanceDuJour[]): SeancesDuJour => ({
    jour: '2026-10-03',
    calcule_le: '2026-10-03T16:00:05.000Z',
    cinemas,
    seances,
  })

  const SOIREE = jour(
    [HALLES, ODEON, CHAMPO],
    [
      uneSeance('19:00', HALLES, 'Digger', 101),
      uneSeance('19:10', ODEON, 'Le Chant des oliviers', 102, { version: 'VOST', marque: 'realisateur', nouveaute: false }),
      uneSeance('19:15', HALLES, 'Mémoire de fille', 103),
      uneSeance('19:15', ODEON, 'Raison et sentiments', 104, { version: 'VOST', marque: 'saga', nouveaute: false }),
      uneSeance('19:20', CHAMPO, 'Verity', 105),
    ],
  )

  let navigateur: ReturnType<typeof simulerNavigateur> | undefined
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('IntersectionObserver', FauxObservateur)
    // L'horloge avance d'elle-même (`shouldAdvanceTime`) : `findBy…` s'appuie sur de vraies minuteries.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(MAINTENANT))
  })
  afterEach(() => {
    navigateur?.retirer()
    navigateur = undefined
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  const tableau = () => within(screen.getByText('Prochaines séances').closest('section')!)
  const sortiesDeLaSemaine = () => within(screen.getByText('Sorti cette semaine dans mes cinémas').closest('section')!)
  // La première liste est celle des séances (la légende vient après) ; la deuxième cellule d'une ligne porte le titre en premier.
  const titresDuTableau = () => {
    const [lignes] = tableau().queryAllByRole('list')
    if (!lignes) return []
    return within(lignes)
      .getAllByRole('listitem')
      .map((ligne) => within(ligne).getByRole('link').children[1]?.children[0]?.textContent)
  }
  const SEANCES_DU_SOIR = { 'GET /api/reference/sorties': () => json(SORTIES_VIDES), ...routeSeances([]) }
  const avancer = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

  it('une ligne par séance à venir, par heure, avec cinéma, version et sceau ; la toute prochaine dit « dans 5 min »', async () => {
    servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
    monter()

    await tableau().findByText('Digger')
    expect(titresDuTableau()).toEqual(['Digger', 'Le Chant des oliviers', 'Mémoire de fille', 'Raison et sentiments', 'Verity'])
    const premiere = tableau().getByRole('link', { name: /Digger/ })
    expect(within(premiere).getByText('19:00')).toBeInTheDocument()
    expect(within(premiere).getByText('dans 5 min')).toBeInTheDocument()
    expect(within(premiere).getByText('UGC Les Halles')).toBeInTheDocument()
    expect(within(premiere).getByText('VF')).toBeInTheDocument()
    // « dans N min » n'est que pour la toute première ligne.
    expect(tableau().getAllByText(/^dans /)).toHaveLength(1)
    const oliviers = tableau().getByRole('link', { name: /Le Chant des oliviers/ })
    expect(within(oliviers).getByText('VOST')).toBeInTheDocument()
    expect(within(oliviers).getByRole('img', { name: 'Réalisateur suivi' })).toBeInTheDocument()
    expect(within(tableau().getByRole('link', { name: /Raison et sentiments/ })).getByRole('img', { name: 'Saga suivie' })).toBeInTheDocument()
    // Pas de sceau sur une nouveauté sans suivi.
    expect(within(premiere).queryByRole('img')).not.toBeInTheDocument()
  })

  it('une séance sans cinéma connu garde sa ligne, sans nom ni distance ; sa version reste dite', async () => {
    servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(jour([], [uneSeance('19:00', HALLES, 'Digger', 101, { version: 'VO' })])) })
    monter()

    const ligne = await tableau().findByRole('link', { name: /Digger/ })
    expect(ligne).toHaveTextContent('19:00')
    expect(within(ligne).getByText('VO')).toBeInTheDocument()
    expect(ligne).not.toHaveTextContent('UGC')
  })

  it('une légende n’explique que les sceaux présents', async () => {
    servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
    monter()

    await tableau().findByText('Digger')
    const listes = tableau().getAllByRole('list')
    const legende = listes[listes.length - 1]!
    expect(within(legende).getByText('Réalisateur suivi')).toBeInTheDocument()
    expect(within(legende).getByText('Saga suivie')).toBeInTheDocument()
  })

  it('sans aucun suivi dans la liste, aucune légende', async () => {
    servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(jour([HALLES], [uneSeance('19:00', HALLES, 'Digger', 101)])) })
    monter()

    await tableau().findByText('Digger')
    expect(tableau().queryByText('Réalisateur suivi')).not.toBeInTheDocument()
    expect(tableau().queryByText('Saga suivie')).not.toBeInTheDocument()
  })

  it('sans la position : à heure égale, par nom de cinéma, et aucune distance', async () => {
    servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
    monter()

    await tableau().findByText('Digger')
    // 19:15 : « UGC Les Halles » avant « UGC Odéon ».
    expect(titresDuTableau().slice(2, 4)).toEqual(['Mémoire de fille', 'Raison et sentiments'])
    expect(tableau().queryByText(/ km| m$/)).not.toBeInTheDocument()
  })

  it('avec la position : à heure égale, le cinéma le plus proche d’abord, la distance dite, ceux sans coordonnées après', async () => {
    navigateur = simulerNavigateur({ permission: 'granted', geolocation: PRES_D_ODEON })
    servir({
      ...SEANCES_DU_SOIR,
      [ROUTE_PROCHAINES_SEANCES]: () =>
        json(jour([HALLES, ODEON, CHAMPO], [uneSeance('19:15', HALLES, 'Aux Halles', 1), uneSeance('19:15', ODEON, 'A Odéon', 2), uneSeance('19:15', CHAMPO, 'Au Champo', 3)])),
    })
    monter()

    await tableau().findByText(/à \d+ m/)
    // Mutation : un tri par nom seul (sans distance) mettrait les Halles avant Odéon.
    expect(titresDuTableau()).toEqual(['A Odéon', 'Aux Halles', 'Au Champo'])
    expect(tableau().getByRole('link', { name: /A Odéon/ })).toHaveTextContent('UGC Odéon · à ')
    expect(tableau().getByRole('link', { name: /Aux Halles/ })).toHaveTextContent(/UGC Les Halles · à \d/)
    expect(tableau().getByRole('link', { name: /Au Champo/ })).not.toHaveTextContent('à ')
  })

  it('toucher une ligne ouvre la fiche du film sous Au ciné', async () => {
    servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
    monter()

    const ligne = await tableau().findByRole('link', { name: /Digger/ })
    expect(ligne).toHaveAttribute('href', '/au-cine/films/101')
    fireEvent.click(ligne)

    expect(await screen.findByText('Fiche du film Digger (101), pas vu')).toBeInTheDocument()
  })

  describe('« Tout voir »', () => {
    const SEPT = jour(
      [HALLES],
      Array.from({ length: 7 }, (_, rang) => uneSeance(`19:${10 + rang * 5}`, HALLES, `Film ${rang + 1}`, 200 + rang)),
    )

    it('cinq entrées d’abord, puis « Tout voir (7) » déplie les autres en place, « Réduire » les replie', async () => {
      const requetes = servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SEPT) })
      monter()

      await tableau().findByText('Film 1')
      expect(titresDuTableau()).toHaveLength(5)
      expect(tableau().queryByText('Film 6')).not.toBeInTheDocument()

      const toutVoir = tableau().getByRole('button', { name: 'Tout voir (7)' })
      expect(toutVoir).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(toutVoir)

      expect(titresDuTableau()).toHaveLength(7)
      expect(tableau().getByRole('button', { name: 'Réduire' })).toHaveAttribute('aria-expanded', 'true')
      // Déplier ne rappelle pas l'API : tout était déjà là.
      expect(requetes.filter((requete) => requete === ROUTE_PROCHAINES_SEANCES)).toHaveLength(1)

      fireEvent.click(tableau().getByRole('button', { name: 'Réduire' }))
      expect(titresDuTableau()).toHaveLength(5)
    })

    it('le compte suit l’horloge : une séance commencée en retire une de « Tout voir (N) »', async () => {
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SEPT) })
      monter()

      await tableau().findByRole('button', { name: 'Tout voir (7)' })
      await avancer(16 * 60_000)

      // 19:10 est passée (il est 19:11) : six restent.
      expect(tableau().getByRole('button', { name: 'Tout voir (6)' })).toBeInTheDocument()
    })

    it('cinq séances ou moins : pas de « Tout voir »', async () => {
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
      monter()

      await tableau().findByText('Digger')
      expect(tableau().queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('le temps qui passe', () => {
    const DEUX = jour([HALLES], [uneSeance('19:00', HALLES, 'Digger', 101), uneSeance('19:30', HALLES, 'Verity', 105)])

    it('une séance commencée quitte le tableau sans rechargement, et « dans N min » suit', async () => {
      const requetes = servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(DEUX) })
      monter()

      const premiere = await tableau().findByRole('link', { name: /Digger/ })
      expect(within(premiere).getByText('dans 5 min')).toBeInTheDocument()

      await avancer(60_000)
      expect(within(tableau().getByRole('link', { name: /Digger/ })).getByText('dans 4 min')).toBeInTheDocument()

      // 18:55 + 6 minutes : 19:00 a commencé.
      await avancer(5 * 60_000)
      // Mutation : sans l'horloge (`useMaintenant` figé), Digger resterait affiché.
      expect(tableau().queryByText('Digger')).not.toBeInTheDocument()
      // Verity devient la toute prochaine, dans 29 minutes (19:30 – 19:01).
      expect(within(tableau().getByRole('link', { name: /Verity/ })).getByText('dans 29 min')).toBeInTheDocument()
      // L'horloge ne rappelle jamais l'API.
      expect(requetes.filter((requete) => requete === ROUTE_PROCHAINES_SEANCES)).toHaveLength(1)
    })

    it('« dans 1 h 05 » à partir d’une heure', async () => {
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(jour([HALLES], [uneSeance('20:00', HALLES, 'Digger', 101)])) })
      monter()

      expect(await tableau().findByText('dans 1 h 05')).toBeInTheDocument()
    })

    it('la dernière séance passée : « Plus de séance ce soir. », le panneau reste, les sorties aussi', async () => {
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(jour([HALLES], [uneSeance('19:00', HALLES, 'Digger', 101)])) })
      monter()

      await tableau().findByText('Digger')
      expect(tableau().queryByText('Plus de séance ce soir.')).not.toBeInTheDocument()

      await avancer(10 * 60_000)

      expect(tableau().getByText('Plus de séance ce soir.')).toBeInTheDocument()
      expect(screen.getByText('Prochaines séances')).toBeInTheDocument()
      // Aucune promesse sur demain.
      expect(screen.queryByText(/demain/i)).not.toBeInTheDocument()
      expect(screen.getByText('Sorti cette semaine dans mes cinémas')).toBeInTheDocument()
    })

    it('une page qui n’a plus aucune séance dès l’arrivée dit la même chose', async () => {
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(jour([], [])) })
      monter()

      expect(await tableau().findByText('Plus de séance ce soir.')).toBeInTheDocument()
      expect(tableau().queryByRole('button')).not.toBeInTheDocument()
    })

    it('une séance déjà commencée dans la réponse n’est jamais montrée', async () => {
      servir({
        ...SEANCES_DU_SOIR,
        [ROUTE_PROCHAINES_SEANCES]: () => json(jour([HALLES], [uneSeance('18:30', HALLES, 'Déjà commencé', 1), uneSeance('19:00', HALLES, 'Digger', 101)])),
      })
      monter()

      await tableau().findByText('Digger')
      expect(screen.queryByText('Déjà commencé')).not.toBeInTheDocument()
    })
  })

  describe('en cas de panne', () => {
    it('une requête en échec s’affiche telle quelle avec Réessayer, jamais « Plus de séance ce soir. »', async () => {
      const message = 'Le programme des cinémas est momentanément indisponible.'
      let enPanne = true
      servir({
        ...SEANCES_DU_SOIR,
        [ROUTE_PROCHAINES_SEANCES]: () => (enPanne ? json({ code: 'INTERNAL', message, retryable: false }, 500) : json(SOIREE)),
      })
      monter()

      const alerte = await screen.findByRole('alert')
      expect(alerte).toHaveTextContent(message)
      expect(screen.queryByText('Plus de séance ce soir.')).not.toBeInTheDocument()
      // Les autres sections ne dépendent pas de cette route.
      expect(await screen.findByText('Rien cette semaine.')).toBeInTheDocument()

      enPanne = false
      fireEvent.click(within(alerte).getByRole('button', { name: 'Réessayer' }))
      expect(await tableau().findByText('Digger')).toBeInTheDocument()
    })
  })

  describe('la position', () => {
    const LIGNE = 'Autoriser la position pour voir les salles les plus proches'

    it('« prompt » : une ligne discrète offre « Autoriser », rien n’est demandé avant le toucher, puis les distances et le tri apparaissent', async () => {
      navigateur = simulerNavigateur({ permission: 'prompt', geolocation: PRES_D_ODEON })
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
      monter()

      expect(await tableau().findByText(LIGNE, { exact: false })).toBeInTheDocument()
      expect(tableau().getByText('Elle ne quitte pas ton téléphone.')).toBeInTheDocument()
      await patienter(50)
      // Mutation : lire la position dès l'affichage de la ligne ferait partir la demande sans geste.
      expect(navigateur.getCurrentPosition).not.toHaveBeenCalled()
      expect(titresDuTableau().slice(2, 4)).toEqual(['Mémoire de fille', 'Raison et sentiments'])

      fireEvent.click(tableau().getByRole('button', { name: 'Autoriser' }))

      await tableau().findAllByText(/à \d/)
      expect(navigateur.getCurrentPosition).toHaveBeenCalledTimes(1)
      // Plus proche d'Odéon : à 19:15 il passe avant les Halles.
      expect(titresDuTableau().slice(2, 4)).toEqual(['Raison et sentiments', 'Mémoire de fille'])
      expect(tableau().queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument()
      expect(tableau().queryByText(LIGNE, { exact: false })).not.toBeInTheDocument()
    })

    it('déjà accordée : lue sans toucher, sans la ligne', async () => {
      navigateur = simulerNavigateur({ permission: 'granted', geolocation: PRES_D_ODEON })
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
      monter()

      await tableau().findAllByText(/à \d/)
      expect(navigateur.getCurrentPosition).toHaveBeenCalledTimes(1)
      expect(tableau().queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument()
    })

    it('refusée : ni bouton ni distance, tri par heure seule, et rien n’est demandé', async () => {
      navigateur = simulerNavigateur({ permission: 'denied', geolocation: PRES_D_ODEON })
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
      monter()

      await tableau().findByText('Digger')
      await patienter(50)
      expect(tableau().queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument()
      expect(tableau().queryByText(/à \d/)).not.toBeInTheDocument()
      expect(navigateur.getCurrentPosition).not.toHaveBeenCalled()
    })

    it('un navigateur sans géolocalisation : ni bouton ni distance', async () => {
      navigateur = simulerNavigateur({})
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
      monter()

      await tableau().findByText('Digger')
      expect(tableau().queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument()
    })

    it('aucun cinéma n’a de coordonnées : la ligne n’est pas offerte, elle ne servirait à rien', async () => {
      navigateur = simulerNavigateur({ permission: 'prompt', geolocation: PRES_D_ODEON })
      servir({
        ...SEANCES_DU_SOIR,
        [ROUTE_PROCHAINES_SEANCES]: () => json(jour([CHAMPO], [uneSeance('19:00', CHAMPO, 'Digger', 101)])),
      })
      monter()

      await tableau().findByText('Digger')
      await patienter(50)
      expect(tableau().queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument()
    })

    it('un refus au toucher retire la ligne et laisse le tri par heure', async () => {
      navigateur = simulerNavigateur({ permission: 'prompt', geolocation: { reponse: 'refus' } })
      servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
      monter()

      fireEvent.click(await tableau().findByRole('button', { name: 'Autoriser' }))

      await vi.waitFor(() => expect(tableau().queryByRole('button', { name: 'Autoriser' })).not.toBeInTheDocument())
      expect(tableau().queryByText(/à \d/)).not.toBeInTheDocument()
      expect(titresDuTableau()[0]).toBe('Digger')
    })

    it('la position ne part dans aucune requête et ne s’écrit nulle part', async () => {
      navigateur = simulerNavigateur({ permission: 'prompt', geolocation: PRES_D_ODEON })
      const requetes = servir({ ...SEANCES_DU_SOIR, [ROUTE_PROCHAINES_SEANCES]: () => json(SOIREE) })
      monter()

      fireEvent.click(await tableau().findByRole('button', { name: 'Autoriser' }))
      await tableau().findAllByText(/à \d/)
      await avancer(2 * 60_000)

      // Mutation : mettre la position dans la clé ou l'URL de la requête (`?lat=…`) ferait tomber l'une de ces lignes.
      const appels = JSON.stringify(vi.mocked(fetch).mock.calls)
      expect(appels).not.toContain('48.853')
      expect(appels).not.toContain('2.339')
      expect(requetes.every((requete) => !/lat|lon|geo|48\.8|2\.3/i.test(requete))).toBe(true)
      expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.body === undefined)).toBe(true)
      // Ni stockée : le choix de position ne survit pas à la page.
      expect(localStorage.length).toBe(0)
      expect(sessionStorage.length).toBe(0)
      // Et la requête des séances n'est partie qu'une fois, avant comme après.
      expect(requetes.filter((requete) => requete === ROUTE_PROCHAINES_SEANCES)).toHaveLength(1)
    })
  })

  describe('les tuiles de « Sorti cette semaine »', () => {
    const film = (tmdbId: number, titre: string) => ({
      ...SORTIES_EXEMPLE.en_cours.films[0]!,
      allocine_id: tmdbId,
      tmdb_id: tmdbId,
      title: titre,
      cinemas: ['UGC Les Halles'],
    })
    const SORTIES: Sorties = {
      ...SORTIES_EXEMPLE,
      en_cours: {
        ...SORTIES_EXEMPLE.en_cours,
        films: [film(101, 'Digger'), film(105, 'Verity'), film(999, 'Sans séance')],
      },
      prochaine: { ...SORTIES_EXEMPLE.prochaine, films: [{ ...SORTIES_EXEMPLE.prochaine.films[0]!, tmdb_id: 101, title: 'Digger bis' }] },
    }
    const SEANCES = jour(
      [HALLES, ODEON],
      [
        uneSeance('21:00', HALLES, 'Digger', 101),
        uneSeance('19:20', ODEON, 'Digger', 101),
        uneSeance('18:30', HALLES, 'Verity', 105),
        uneSeance('22:10', HALLES, 'Verity', 105),
      ],
    )
    const tuile = (titre: string) => sortiesDeLaSemaine().getByRole('link', { name: new RegExp(titre) })

    it('portent, en bas à gauche, l’heure de leur prochaine séance (la plus tôt, tous cinémas) ; sans séance, rien', async () => {
      servir({ 'GET /api/reference/sorties': () => json(SORTIES), ...routeSeances([]), [ROUTE_PROCHAINES_SEANCES]: () => json(SEANCES) })
      monter()

      const digger = await sortiesDeLaSemaine().findByRole('link', { name: /Digger/ })
      expect(within(digger).getByText('19:20')).toBeInTheDocument()
      expect(within(digger).getByText('Prochaine séance à')).toBeInTheDocument()
      // Verity : 18:30 a commencé, il reste 22:10.
      expect(within(tuile('Verity')).getByText('22:10')).toBeInTheDocument()
      expect(tuile('Sans séance')).not.toHaveTextContent(/\d\d:\d\d/)
    })

    it('la tuile cesse de montrer l’heure d’une séance passée, et s’éteint quand il n’en reste plus', async () => {
      servir({ 'GET /api/reference/sorties': () => json(SORTIES), ...routeSeances([]), [ROUTE_PROCHAINES_SEANCES]: () => json(SEANCES) })
      monter()

      await within(await sortiesDeLaSemaine().findByRole('link', { name: /Digger/ })).findByText('19:20')
      // 19:25 : Digger passe à 21:00.
      await avancer(30 * 60_000)
      expect(within(tuile('Digger')).getByText('21:00')).toBeInTheDocument()
      expect(within(tuile('Digger')).queryByText('19:20')).not.toBeInTheDocument()
      // 23:00 : plus rien aujourd'hui.
      await avancer(3 * 60 * 60_000)
      expect(tuile('Digger')).not.toHaveTextContent(/\d\d:\d\d/)
      expect(tuile('Verity')).not.toHaveTextContent(/\d\d:\d\d/)
    })

    it('« La semaine prochaine » n’a aucun repère horaire, même pour un film qui a des séances', async () => {
      servir({ 'GET /api/reference/sorties': () => json(SORTIES), ...routeSeances([]), [ROUTE_PROCHAINES_SEANCES]: () => json(SEANCES) })
      monter()

      const prochaine = within((await screen.findByText('La semaine prochaine')).closest('section')!)
      const diggerBis = await prochaine.findByRole('link', { name: /Digger bis/ })
      await sortiesDeLaSemaine().findByText('22:10')
      expect(diggerBis).not.toHaveTextContent(/\d\d:\d\d/)
      // Mais elle s'ouvre, elle aussi, sur la fiche du film sous Au ciné.
      expect(diggerBis).toHaveAttribute('href', '/au-cine/films/101')
    })

    it('sans les séances du jour (panne), les tuiles n’ont aucune heure et restent ouvrables', async () => {
      servir({
        'GET /api/reference/sorties': () => json(SORTIES),
        ...routeSeances([]),
        [ROUTE_PROCHAINES_SEANCES]: () => json({ code: 'INTERNAL', message: 'En panne.', retryable: false }, 500),
      })
      monter()

      await screen.findByRole('alert')
      expect(tuile('Digger')).not.toHaveTextContent(/\d\d:\d\d/)
      expect(tuile('Digger')).toHaveAttribute('href', '/au-cine/films/101')
    })
  })
})
