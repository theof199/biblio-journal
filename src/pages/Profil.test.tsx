import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import type { NavigateFunction } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { visionnage as v } from '../test/journal'
import { fabriquerZip } from '../test/zip'
import type { RapportImport } from '../api/letterboxd'

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
const RAPPORT = exemple<RapportImport>('/me/journal/import/letterboxd', 'post', 200)
const JOURNAL = 'GET /api/me/journal?limit=100'
const REALISATEURS = 'GET /api/me/realisateurs'
const SAGAS = 'GET /api/me/sagas'
const VIDES = { [REALISATEURS]: () => json([]), [SAGAS]: () => json([]) }
const IMPORT = 'POST /api/me/journal/import/letterboxd'

const compte = (film: number) => ({ finished_by_type: { movie: film } })
const stats = (total: number, cetteAnnee: number) => ({
  dashboard: {
    scope: { user: {}, timezone: 'Europe/Paris', week_starts_on: 'monday', generated_at: '2026-09-29T00:00:00.000Z' },
    periods: {
      week: { from: null, to: '2026-09-29', counts: compte(0), quantities: {} },
      month: { from: null, to: '2026-09-29', counts: compte(0), quantities: {} },
      year: { from: null, to: '2026-09-29', counts: compte(cetteAnnee), quantities: {} },
      all: { from: null, to: '2026-09-29', counts: compte(total), quantities: {} },
    },
    highlights: {},
  },
  comparison: null,
})

const JOURNAL_DE_TEST = [
  v({ id: 'a', titre: 'Alien', annee: 1979, date: '2026-09-20', note: 9, reactions: ['en_salle'] }),
  v({ id: 'b', titre: 'Metropolis', annee: 1927, date: '2026-08-02', note: 7 }),
  v({ id: 'c', titre: 'Heat', annee: 1995, date: '2026-08-10' }),
]

const ENTETE = 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date'
const CSV = `${ENTETE}\n2026-09-02,Alien,1979,https://boxd.it/a,4.5,,,2026-09-01\n`
const fichier = (contenu: BlobPart, nom = 'diary.csv') => new File([contenu], nom)

const erreurApi = (message: string, status = 400) => json({ code: 'VALIDATION_ERROR', message, retryable: false }, status)

/** Le geste « retour » du navigateur (ou du téléphone), que la page ne dessine pas. */
let historique!: NavigateFunction
function Historique() {
  historique = useNavigate()
  return null
}

function monter(chemin = '/profil', strict = false) {
  const client = createQueryClient()
  const arbre = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[chemin]}>
        <Historique />
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(strict ? <StrictMode>{arbre}</StrictMode> : arbre)
  return client
}

const choisir = (f: File) =>
  fireEvent.change(screen.getByLabelText('Fichier d’export Letterboxd'), { target: { files: [f] } })

describe('le profil', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Le jour du test est fixé : les « douze derniers mois » et « cette année » en dépendent.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('montre le pseudo, les deux chiffres de /stats, le bilan et les graphiques', async () => {
    servir({
      ...VIDES,
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(12, 3)),
      [JOURNAL]: () => json({ items: JOURNAL_DE_TEST, next_cursor: null }),
    })
    monter()

    expect(await screen.findByRole('heading', { level: 1, name: SESSION.user.pseudo })).toBeInTheDocument()
    expect(await screen.findByText(/films vus,/)).toHaveTextContent('12 films vus, 3 cette année')

    const bilan = await screen.findByRole('region', { name: 'Bilan' })
    await within(bilan).findByText('1 séances en salle, dont 1 cette année')
    expect(within(bilan).getByText('Note moyenne : 8/10')).toBeInTheDocument()
    expect(within(bilan).getByText('1920 → 1990, 3 décennies sur 8')).toBeInTheDocument()
    expect(within(bilan).getByText('Le plus ancien : Metropolis (1927)')).toBeInTheDocument()
    expect(within(bilan).getByText('0 réalisateur suivi, dont 0 terminé')).toBeInTheDocument()
    expect(within(bilan).getByText('0 saga suivie, dont 0 terminée')).toBeInTheDocument()

    const graphiques = screen.getByRole('region', { name: 'Graphiques' })
    // Septembre 2026 est le dernier des douze mois : une entrée en août, une en septembre… et deux en août.
    expect(within(graphiques).getByRole('img', { name: 'Films par mois : 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1' })).toBeInTheDocument()
    expect(within(graphiques).getByRole('img', { name: 'Répartition des notes : 0, 0, 0, 0, 0, 0, 1, 0, 1, 0' })).toBeInTheDocument()
    expect(within(graphiques).getByLabelText('1920 : couverte')).toBeInTheDocument()
    expect(within(graphiques).getByLabelText('1930 : pas encore')).toBeInTheDocument()
  })

  it('tant que le journal n’est pas là, le bilan dit « … » et les graphiques manquent : jamais un zéro', async () => {
    let liberer!: (r: Response) => void
    servir({
      ...VIDES,
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(12, 3)),
      [JOURNAL]: () => new Promise<Response>((r) => (liberer = r)),
    })
    monter()

    const bilan = await screen.findByRole('region', { name: 'Bilan' })
    expect(within(bilan).getAllByText('…')).toHaveLength(6)
    expect(screen.queryByRole('region', { name: 'Graphiques' })).not.toBeInTheDocument()

    liberer(json({ items: JOURNAL_DE_TEST, next_cursor: null }))
    expect(await within(bilan).findByText('Note moyenne : 8/10')).toBeInTheDocument()
  })

  it('les réalisateurs et les sagas suivis : combien, et combien terminés (un introuvable ne compte pas contre)', async () => {
    const realisateur = exemple<{ tmdb_id: number }[]>('/me/realisateurs', 'get', 200)[0]!
    const page = exemple<{ films: { vu: unknown }[] }>('/me/realisateurs/{tmdbId}/page', 'get', 200)
    const saga = exemple<{ tmdb_id: number }[]>('/me/sagas', 'get', 200)[0]!
    const films = exemple<{ films: { vu: unknown; introuvable: boolean }[] }>('/me/sagas/{tmdbId}/films', 'get', 200)
    // Tout vu, sauf les introuvables : la saga est terminée. Le réalisateur garde son film pas vu.
    const vu = { entry_id: 'e0000000-0000-4000-8000-000000000009', rating: 8, finished_at: '2026-01-01' }
    films.films.forEach((f) => (f.vu = f.introuvable ? null : vu))
    page.films[0]!.vu = null
    servir({
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(1, 1)),
      [JOURNAL]: () => json({ items: JOURNAL_DE_TEST, next_cursor: null }),
      [REALISATEURS]: () => json([realisateur]),
      [`GET /api/me/realisateurs/${realisateur.tmdb_id}/page`]: () => json(page),
      [SAGAS]: () => json([saga]),
      [`GET /api/me/sagas/${saga.tmdb_id}/films`]: () => json(films),
    })
    monter()

    const bilan = await screen.findByRole('region', { name: 'Bilan' })
    expect(await within(bilan).findByText('1 réalisateur suivi, dont 0 terminé')).toBeInTheDocument()
    expect(within(bilan).getByText('1 saga suivie, dont 1 terminée')).toBeInTheDocument()
  })

  it('un journal vide : « Aucun film noté », « Aucune année connue », pas de graphique', async () => {
    servir({
      ...VIDES,
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(0, 0)),
      [JOURNAL]: () => json({ items: [], next_cursor: null }),
    })
    monter()

    const bilan = await screen.findByRole('region', { name: 'Bilan' })
    await within(bilan).findByText('Aucun film noté')
    expect(within(bilan).getByText('Aucune année connue')).toBeInTheDocument()
    expect(within(bilan).getByText('Le plus ancien : inconnu')).toBeInTheDocument()
    expect(within(bilan).getByText('0 séances en salle, dont 0 cette année')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Graphiques' })).not.toBeInTheDocument()
  })

  it('un journal qui échoue se tait : ni alerte, le bilan reste à « … », les chiffres du haut restent', async () => {
    servir({
      ...VIDES,
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(12, 3)),
      [JOURNAL]: () => erreurApi('Le journal n’a pas pu être lu.', 500),
    })
    monter()

    await screen.findByText(/films vus,/)
    const bilan = await screen.findByRole('region', { name: 'Bilan' })
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]) === '/api/me/journal?limit=100')).toBe(true))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(bilan).getAllByText('…')).toHaveLength(4)
  })

  it('une panne de /stats s’affiche par son message, tel quel, et « Réessayer » relit', async () => {
    let enPanne = true
    servir({
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => (enPanne ? erreurApi('Les statistiques sont en panne.', 503) : json(stats(5, 1))),
      [JOURNAL]: () => json({ items: [], next_cursor: null }),
    })
    monter()

    expect(await screen.findByRole('alert')).toHaveTextContent('Les statistiques sont en panne.')
    enPanne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText(/films vus,/)).toHaveTextContent('5 films vus, 1 cette année')
  })

  it('porte la mention de TMDB, en anglais, avec son logo', async () => {
    servir({
      ...VIDES,
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(0, 0)),
      [JOURNAL]: () => json({ items: [], next_cursor: null }),
    })
    monter()

    expect(
      await screen.findByText('This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'TMDB' })).toHaveAttribute('src', expect.stringMatching(/tmdb\.svg$/))
  })

  it('« Mes films » et « Se déconnecter » restent là', async () => {
    servir({
      ...VIDES,
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(0, 0)),
      [JOURNAL]: () => json({ items: [], next_cursor: null }),
    })
    monter()

    expect(await screen.findByRole('link', { name: 'Mes films' })).toHaveAttribute('href', '/profil/mes-films')
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })
})

describe('l’import Letterboxd', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  const base = (extra: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) =>
    servir({
      ...VIDES,
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats(0, 0)),
      [JOURNAL]: () => json({ items: [], next_cursor: null }),
      ...extra,
    })

  it('envoie le CSV choisi en JSON, montre l’attente puis « N importés · M déjà présents »', async () => {
    let liberer!: (r: Response) => void
    let corps = ''
    const requetes = base({
      [IMPORT]: (init) => {
        corps = String(init.body)
        return new Promise<Response>((r) => (liberer = r))
      },
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByText('Import en cours…')).toBeInTheDocument()
    await waitFor(() => expect(corps).not.toBe(''))
    expect(JSON.parse(corps)).toEqual({ csv: CSV })

    liberer(json({ importes: 2, deja_presents: 1, non_reconnus: [], erreurs: [] }))
    expect(await screen.findByText('2 importés · 1 déjà présents')).toBeInTheDocument()
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
  })

  it('un ZIP de l’export : diary.csv en est extrait avant l’envoi', async () => {
    let corps = ''
    base({
      [IMPORT]: (init) => {
        corps = String(init.body)
        return json(RAPPORT)
      },
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    const zip = await fabriquerZip([
      { nom: 'watched.csv', contenu: 'x', methode: 'deflate' },
      { nom: 'export/diary.csv', contenu: CSV, methode: 'deflate' },
    ])
    choisir(fichier(zip as BlobPart, 'letterboxd-export.zip'))

    await screen.findByText(/importés ·/)
    expect(JSON.parse(corps)).toEqual({ csv: CSV })
  })

  it('un ZIP sans diary.csv : son message, et aucun appel à l’API d’import', async () => {
    const requetes = base()
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier((await fabriquerZip([{ nom: 'watched.csv', contenu: 'x' }])) as BlobPart, 'export.zip'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce ZIP ne contient pas diary.csv')
    expect(requetes).not.toContain(IMPORT)
  })

  it('un fichier que l’API refuse : son message s’affiche tel quel', async () => {
    const message = 'Ce fichier n’est pas le journal de Letterboxd : il manque des colonnes.'
    const requetes = base({ [IMPORT]: () => erreurApi(message) })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier('Date,Name\n2026-01-01,X\n', 'watched.csv'))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText(/importés ·/)).not.toBeInTheDocument()

    // Parti au profil puis revenu par l'historique : la même erreur, rien de renvoyé.
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    await screen.findByText(/Importer Letterboxd/)
    act(() => historique(-1))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
  })

  it('une seule requête même sous StrictMode', async () => {
    const requetes = base({ [IMPORT]: () => json(RAPPORT) })
    monter('/profil', true)
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    await screen.findByText(/importés ·/)
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
  })

  it('le rapport liste les non reconnus avec leurs candidats, et les erreurs par ligne', async () => {
    base({
      [IMPORT]: () =>
        json({
          importes: 0,
          deja_presents: 3,
          non_reconnus: [
            { ligne: 2, name: 'Alien', year: 1979, candidats: [{ tmdb_id: '348', title: 'Alien, le huitième passager', year: 1979 }] },
            { ligne: 3, name: 'Film inconnu', year: null, candidats: [] },
          ],
          erreurs: [{ ligne: 4, message: 'Date illisible.' }],
        }),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByText('0 importés · 3 déjà présents')).toBeInTheDocument()
    expect(screen.getByText('Alien (1979)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alien, le huitième passager (1979)' })).toBeInTheDocument()
    expect(screen.getByText('Film inconnu')).toBeInTheDocument()
    expect(screen.getByText('Aucun candidat')).toBeInTheDocument()
    expect(screen.getByText('Ligne 4 : Date illisible.')).toBeInTheDocument()
  })

  it('un candidat choisi ouvre le formulaire déjà rempli de la date et de la note de sa ligne', async () => {
    base({
      [IMPORT]: () =>
        json({
          importes: 0,
          deja_presents: 0,
          non_reconnus: [{ ligne: 2, name: 'Alien', year: 1979, candidats: [{ tmdb_id: '348', title: 'Alien, le huitième passager', year: 1979 }] }],
          erreurs: [],
        }),
      'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    fireEvent.click(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' }))

    expect(await screen.findByLabelText(/Vu le/)).toHaveValue('2026-09-01') // « Watched Date », pas « Date »
    expect(screen.getByRole('radio', { name: 'Note 9 sur 10' })).toHaveAttribute('aria-checked', 'true')
  })

  it('revenir au rapport depuis le formulaire d’un candidat le retrouve tel quel, sans renvoyer le fichier', async () => {
    const requetes = base({
      [IMPORT]: () =>
        json({
          importes: 4,
          deja_presents: 0,
          non_reconnus: [{ ligne: 2, name: 'Alien', year: 1979, candidats: [{ tmdb_id: '348', title: 'Alien, le huitième passager', year: 1979 }] }],
          erreurs: [],
        }),
      'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))
    fireEvent.click(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' }))
    await screen.findByLabelText(/Vu le/)

    act(() => historique(-1))

    expect(await screen.findByText('4 importés · 0 déjà présents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alien, le huitième passager (1979)' })).toBeInTheDocument()
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
  })

  it('après un import réussi, le journal, les chiffres et le bilan sont périmés', async () => {
    base({ [IMPORT]: () => json(RAPPORT) })
    const client = monter()
    await screen.findByText(/Importer Letterboxd/)
    await waitFor(() => expect(client.getQueryState(cles.journalComplet)?.status).toBe('success'))
    choisir(fichier(CSV))
    await screen.findByText(/importés ·/)

    // La page d'import ne montre plus le profil : ses requêtes n'ont plus d'observateur, elles
    // restent donc marquées périmées (et sont relues au retour) au lieu d'être refaites en douce.
    expect(client.getQueryState(cles.journalComplet)?.isInvalidated).toBe(true)
    expect(client.getQueryState(cles.stats)?.isInvalidated).toBe(true)
    // Comme après le formulaire : un film importé peut terminer une filmographie suivie.
    expect(client.getQueryState(cles.realisateurs)?.isInvalidated).toBe(true)
    expect(client.getQueryState(cles.sagas)?.isInvalidated).toBe(true)
  })

  it('sans fichier (accès direct, rechargement) : on repart du profil, sans appel', async () => {
    const requetes = base()
    monter('/profil/import-letterboxd')

    expect(await screen.findByText('Aucun fichier choisi. Repars du profil.')).toBeInTheDocument()
    expect(requetes).not.toContain(IMPORT)
  })

  it('« Terminé » ramène au profil', async () => {
    base({ [IMPORT]: () => json(RAPPORT) })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    fireEvent.click(await screen.findByRole('button', { name: 'Terminé' }))
    expect(await screen.findByRole('heading', { level: 1, name: SESSION.user.pseudo })).toBeInTheDocument()
  })
})
