import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import type { Location, NavigateFunction } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { exemple } from '../test/contrat'
import { fabriquerZip } from '../test/zip'
import { INTERVALLE_SUIVI } from '../api/letterboxd'
import type { RapportImport, TacheImport } from '../api/letterboxd'
import type { Doublons } from '../api/doublons'
import type { AddMediaResponse, JournalItem } from '../api/journal'

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
/** La tâche telle que le `POST` la rend (en cours), puis telle que le suivi la rend (finie). */
const LANCEE = exemple<TacheImport>('/me/journal/import/letterboxd', 'post', 202)
const FINIE = exemple<TacheImport>('/me/journal/import/letterboxd/{id}', 'get', 200)
const RAPPORT = FINIE.rapport
const SUIVI = `GET /api/me/journal/import/letterboxd/${LANCEE.id}`
const lancee = () => json(LANCEE, 202)
const finie = (rapport: RapportImport = RAPPORT) => json({ ...FINIE, rapport })
/** Un rapport vide, complété de ce que le test regarde. */
const unRapport = (partiel: Partial<RapportImport> = {}): RapportImport => ({
  importes: 0,
  deja_presents: 0,
  vus_sans_date: { lignes: 0, importes: 0, deja_presents: 0 },
  non_reconnus: [],
  erreurs: [],
  ...partiel,
})
const DOUBLONS = exemple<Doublons>('/me/journal/doublons', 'get', 200)
const APERCU = 'GET /api/me/journal/doublons'
const RETRAIT = 'DELETE /api/me/journal/doublons'
const JOURNAL = 'GET /api/me/journal?limit=100'
const IMPORT = 'POST /api/me/journal/import/letterboxd'

const duree = (minutes: number, manquantes: number) => ({
  value: minutes,
  unit: 'minutes',
  basis: 'measured',
  coverage: { counted: 0, missing: manquantes },
  note: null,
})
const periode = (film: number) => ({
  from: null,
  to: '2026-09-29',
  counts: { finished_by_type: { movie: film } },
  quantities: { movie_minutes: duree(0, 0) },
})
const stats = () => ({
  dashboard: {
    scope: { user: {}, timezone: 'Europe/Paris', week_starts_on: 'monday', generated_at: '2026-09-29T00:00:00.000Z' },
    periods: { week: periode(0), month: periode(0), year: periode(0), all: periode(0) },
    highlights: {},
  },
  comparison: null,
})

const ENTETE = 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date'
const CSV = `${ENTETE}\n2026-09-02,Alien,1979,https://boxd.it/a,4.5,,,2026-09-01\n`
const fichier = (contenu: BlobPart, nom = 'diary.csv') => new File([contenu], nom)

const erreurApi = (message: string, status = 400) => json({ code: 'VALIDATION_ERROR', message, retryable: false }, status)

/** Le geste « retour » du navigateur (ou du téléphone), que la page ne dessine pas. */
let historique!: NavigateFunction
/** L'adresse affichée, telle que la barre du navigateur la montrerait. */
let adresse!: Location
function Historique() {
  historique = useNavigate()
  adresse = useLocation()
  return null
}

function monter(chemin = '/profil/reglages', strict = false) {
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

describe('l’import Letterboxd', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Les lignes tranchées se gardent dans ce navigateur, sous la clé de la tâche.
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  const base = (extra: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) =>
    servir({
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats()),
      [JOURNAL]: () => json({ items: [], next_cursor: null }),
      ...extra,
    })

  it('envoie le CSV choisi en JSON, suit l’avancement de la tâche puis montre « N importés · M déjà présents »', async () => {
    let liberer!: (r: Response) => void
    let corps = ''
    let suivis = 0
    const requetes = base({
      [IMPORT]: (init) => {
        corps = String(init.body)
        return new Promise<Response>((r) => (liberer = r))
      },
      // La première relecture la trouve à mi-chemin, la suivante finie.
      [SUIVI]: () => {
        suivis += 1
        return suivis === 1
          ? json({ ...LANCEE, lignes_total: 480, lignes_traitees: 120 })
          : finie(unRapport({ importes: 2, deja_presents: 1 }))
      },
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByText('Import en cours…')).toBeInTheDocument()
    await waitFor(() => expect(corps).not.toBe(''))
    expect(JSON.parse(corps)).toEqual({ csv: CSV })

    liberer(lancee())
    expect(await screen.findByText('Import en cours… 120 / 480 lignes')).toBeInTheDocument()
    // Relue toutes les deux secondes, sans rien renvoyer.
    expect(await screen.findByText('2 importés · 1 déjà présents', undefined, { timeout: 4_000 })).toBeInTheDocument()
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
    expect(requetes.filter((r) => r === SUIVI)).toHaveLength(2)
    // Finie, elle n'est plus relue : plus d'un intervalle plus tard, toujours deux lectures. Une
    // attente réelle, parce que c'est l'absence d'appel qu'on mesure.
    await new Promise((r) => setTimeout(r, INTERVALLE_SUIVI + 500))
    expect(requetes.filter((r) => r === SUIVI)).toHaveLength(2)
  }, 10_000)

  it('une tâche interrompue : son message, et ce qu’elle avait fait', async () => {
    const message = 'L’import s’est arrêté avant la fin : le serveur a redémarré.'
    base({
      [IMPORT]: lancee,
      [SUIVI]: () =>
        json({ ...FINIE, etat: 'echoue', message, rapport: unRapport({ importes: 7 }) }),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByText('7 importés · 0 déjà présents')).toBeInTheDocument()
  })

  it('une erreur définitive en plein suivi arrête la relecture, sans boucler derrière le message', async () => {
    // Relue une fois en cours, puis introuvable (expirée, ou la session d'un autre) : la dernière
    // donnée reçue dit encore `en_cours`, et c'est elle que l'intervalle lisait.
    const message = 'Cet import est introuvable : il a expiré, ou il n’est pas le tien.'
    let suivis = 0
    const requetes = base({
      [IMPORT]: lancee,
      [SUIVI]: () => {
        suivis += 1
        return suivis === 1
          ? json({ ...LANCEE, lignes_total: 480, lignes_traitees: 120 })
          : json({ code: 'NOT_FOUND', message, retryable: false }, 404)
      },
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByRole('alert', undefined, { timeout: 4_000 })).toHaveTextContent(message)
    expect(requetes.filter((r) => r === SUIVI)).toHaveLength(2)
    // Plus d'un intervalle de suivi plus tard, aucune relecture de plus. Une attente réelle : c'est
    // l'absence d'appel qu'on mesure, et l'intervalle est celui de l'appli.
    await new Promise((r) => setTimeout(r, INTERVALLE_SUIVI + 500))
    expect(requetes.filter((r) => r === SUIVI)).toHaveLength(2)
  }, 10_000)

  it('une tâche introuvable au suivi : le message de l’API', async () => {
    const message = 'Cet import est introuvable : il a expiré, ou il n’est pas le tien.'
    base({ [IMPORT]: lancee, [SUIVI]: () => json({ code: 'NOT_FOUND', message, retryable: false }, 404) })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('un ZIP de l’export : diary.csv, watched.csv et ratings.csv en sont extraits avant l’envoi', async () => {
    // « 400 films dans le zip, 200 à l'import » : diary.csv seul ne porte que les visionnages datés.
    const WATCHED = 'Date,Name,Year,Letterboxd URI\n2024-03-03,Heat,1995,https://boxd.it/f2\n'
    const RATINGS = 'Date,Name,Year,Letterboxd URI,Rating\n2024-03-03,Heat,1995,https://boxd.it/f2,4\n'
    let corps = ''
    base({
      [IMPORT]: (init) => {
        corps = String(init.body)
        return lancee()
      },
      [SUIVI]: () => finie(),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    const zip = await fabriquerZip([
      { nom: 'export/watched.csv', contenu: WATCHED, methode: 'deflate' },
      { nom: 'export/diary.csv', contenu: CSV, methode: 'deflate' },
      { nom: 'export/ratings.csv', contenu: RATINGS, methode: 'deflate' },
      { nom: 'export/deleted/watched.csv', contenu: 'pas celui-ci', methode: 'deflate' },
    ])
    choisir(fichier(zip as BlobPart, 'letterboxd-export.zip'))

    await screen.findByText(/importés ·/)
    expect(JSON.parse(corps)).toEqual({ csv: CSV, watched_csv: WATCHED, ratings_csv: RATINGS })
  })

  it('les films vus sans date précise sont comptés à part des visionnages datés', async () => {
    base({
      [IMPORT]: lancee,
      [SUIVI]: () => finie(unRapport({ importes: 200, vus_sans_date: { lignes: 200, importes: 150, deja_presents: 50 } })),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByText('200 importés · 0 déjà présents')).toBeInTheDocument()
    expect(
      screen.getByText('Films vus sans date précise : 200 — 150 importés à la date où tu les as marqués vus · 50 déjà au journal'),
    ).toBeInTheDocument()
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

    // Parti au profil puis revenu par l'historique : la même erreur, rien de renvoyé. « Retour »
    // recule dans l'historique (`ui/BoutonRetour.tsx`) : l'import se retrouve en avançant.
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    await screen.findByText(/Importer Letterboxd/)
    act(() => historique(1))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
  })

  it('une seule requête même sous StrictMode', async () => {
    const requetes = base({ [IMPORT]: lancee, [SUIVI]: () => finie() })
    monter('/profil/reglages', true)
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    await screen.findByText(/importés ·/)
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
  })

  const AFFICHE_ALIEN = 'https://image.tmdb.org/t/p/w500/alien.jpg'
  const ALIEN = {
    tmdb_id: '348',
    title: 'Alien, le huitième passager',
    original_title: 'Alien',
    year: 1979,
    cover_url: AFFICHE_ALIEN,
  }
  const AWAKENING = { tmdb_id: '999501', title: 'Alien: Awakening', original_title: 'Alien: Awakening', year: 1979, cover_url: null }

  /** La ligne ambiguë du rapport : la date et la note que l'import aurait écrites viennent avec elle. */
  const LIGNE_ALIEN = {
    fichier: 'diary' as const,
    ligne: 2,
    name: 'Alien',
    year: 1979,
    date: '2026-09-01',
    rating: 9,
    candidats: [ALIEN],
  }

  it('le rapport liste les non reconnus avec leurs candidats, vignette comprise, et les erreurs par ligne', async () => {
    base({
      [IMPORT]: lancee,
      [SUIVI]: () =>
        finie(
          unRapport({
            deja_presents: 3,
            non_reconnus: [
              { ...LIGNE_ALIEN, candidats: [ALIEN, AWAKENING] },
              { fichier: 'watched', ligne: 3, name: 'Film inconnu', year: null, date: '2024-03-03', rating: null, candidats: [] },
            ],
            erreurs: [
              { fichier: 'diary', ligne: 4, message: 'Date illisible.' },
              { fichier: 'watched', ligne: 4, message: 'Titre manquant.' },
            ],
          }),
        ),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    expect(await screen.findByText('0 importés · 3 déjà présents')).toBeInTheDocument()
    expect(screen.getByText('Alien (1979)')).toBeInTheDocument()
    // L'affiche dans le bouton du candidat, et son titre original quand il diffère : de quoi
    // trancher à l'œil. Sans affiche chez TMDB, pas d'image inventée.
    const alien = screen.getByRole('button', { name: 'Alien, le huitième passager (1979)' })
    expect(within(alien).getByRole('img')).toHaveAttribute('src', AFFICHE_ALIEN)
    expect(within(alien).getByText('Alien')).toBeInTheDocument()
    const awakening = screen.getByRole('button', { name: 'Alien: Awakening (1979)' })
    expect(within(awakening).queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Vu le 1er septembre 2026 · 9/10')).toBeInTheDocument()
    expect(screen.getByText('Film inconnu')).toBeInTheDocument()
    expect(screen.getByText('Vu sans date précise, marqué vu le 3 mars 2024')).toBeInTheDocument()
    expect(screen.getByText('Aucun candidat')).toBeInTheDocument()
    // Deux fichiers, deux numérotations : la même ligne 4 ne se confond pas.
    expect(screen.getByText('Ligne 4 : Date illisible.')).toBeInTheDocument()
    expect(screen.getByText('watched.csv, ligne 4 : Titre manquant.')).toBeInTheDocument()
  })

  const MEDIA = exemple<AddMediaResponse>('/media', 'post', 201)
  const ITEM = exemple<JournalItem>('/me/journal', 'post', 201)
  const AJOUT = 'POST /api/media'
  const VISIONNAGE = 'POST /api/me/journal'
  /** Les deux routes du formulaire, qui gardent ce qu'on leur envoie. */
  const enregistrement = (corps: { media?: unknown; visionnage?: unknown } = {}) => ({
    [AJOUT]: (init: RequestInit) => {
      corps.media = JSON.parse(String(init.body))
      return json(MEDIA, 201)
    },
    [VISIONNAGE]: (init: RequestInit) => {
      corps.visionnage = JSON.parse(String(init.body))
      return json(ITEM, 201)
    },
  })

  it('toucher un candidat enregistre le visionnage à la date et à la note de sa ligne, et le rapport reste à l’écran', async () => {
    const corps: { media?: unknown; visionnage?: unknown } = {}
    const requetes = base({
      [IMPORT]: lancee,
      [SUIVI]: () => finie(unRapport({ importes: 4, non_reconnus: [{ ...LIGNE_ALIEN, candidats: [ALIEN, AWAKENING] }] })),
      ...enregistrement(corps),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    fireEvent.click(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' }))

    // Le formulaire ne s'ouvre pas : la ligne passe à « ajouté », dans le rapport.
    expect(await screen.findByText('Ajouté : Alien, le huitième passager (1979)')).toBeInTheDocument()
    expect(screen.getByText('4 importés · 0 déjà présents')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Séance du/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alien: Awakening (1979)' })).not.toBeInTheDocument()
    // Les deux routes du formulaire, dans son ordre, avec la date et la note de la ligne.
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([IMPORT, AJOUT, VISIONNAGE])
    expect(corps.media).toEqual({ source: 'tmdb', external_id: '348', type: 'movie' })
    expect(corps.visionnage).toEqual({ media_id: MEDIA.media.id, finished_at: '2026-09-01', rating: 9 })
  })

  it('une ligne sans note s’enregistre sans note ; un échec se dit sur sa ligne, qui reste à trancher', async () => {
    const message = 'Ce film n’a pas pu être ajouté.'
    const corps: { visionnage?: unknown } = {}
    let essais = 0
    base({
      [IMPORT]: lancee,
      [SUIVI]: () => finie(unRapport({ non_reconnus: [{ ...LIGNE_ALIEN, rating: null }] })),
      [AJOUT]: () => json(MEDIA, 201),
      [VISIONNAGE]: (init) => {
        essais += 1
        corps.visionnage = JSON.parse(String(init.body))
        return essais === 1 ? erreurApi(message) : json(ITEM, 201)
      },
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    fireEvent.click(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText(/^Ajouté/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Alien, le huitième passager (1979)' }))
    expect(await screen.findByText('Ajouté : Alien, le huitième passager (1979)')).toBeInTheDocument()
    expect(corps.visionnage).toEqual({ media_id: MEDIA.media.id, finished_at: '2026-09-01' })
  })

  it('la ligne ajoutée le reste après un retour arrière et un rechargement, sans renvoyer le fichier', async () => {
    const requetes = base({
      [IMPORT]: lancee,
      [SUIVI]: () => finie(unRapport({ importes: 4, non_reconnus: [LIGNE_ALIEN] })),
      ...enregistrement(),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))
    fireEvent.click(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' }))
    await screen.findByText('Ajouté : Alien, le huitième passager (1979)')
    // Lancée, la tâche a pris la place du fichier dans l'historique : c'est elle qu'un
    // rechargement retrouvera, pas le fichier, qu'il renverrait en lançant une autre tâche.
    expect([adresse.pathname, adresse.search]).toEqual(['/profil/import-letterboxd', `?tache=${LANCEE.id}`])

    // Au profil, puis retour arrière : la tâche est dans l'adresse, le rapport revient tel quel.
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    await screen.findByText(/Importer Letterboxd/)
    act(() => historique(1))
    expect(await screen.findByText('Ajouté : Alien, le huitième passager (1979)')).toBeInTheDocument()

    // Un rechargement : plus rien en mémoire, ni fichier ni cache — seulement l'adresse.
    cleanup()
    monter(`/profil/import-letterboxd?tache=${LANCEE.id}`)
    expect(await screen.findByText('4 importés · 0 déjà présents')).toBeInTheDocument()
    expect(screen.getByText('Ajouté : Alien, le huitième passager (1979)')).toBeInTheDocument()
    expect(requetes.filter((r) => r === IMPORT)).toHaveLength(1)
    expect(requetes.filter((r) => r === VISIONNAGE)).toHaveLength(1)
  })

  it('l’état d’une ligne se garde sous la clé de sa tâche : une autre tâche ne le voit pas', async () => {
    const AUTRE = { ...FINIE, id: '6c1f4d3e-9e5b-4a7c-8d2f-3b8e0f5c7a21', rapport: unRapport({ non_reconnus: [LIGNE_ALIEN] }) }
    base({
      [IMPORT]: lancee,
      [SUIVI]: () => finie(unRapport({ non_reconnus: [LIGNE_ALIEN] })),
      [`GET /api/me/journal/import/letterboxd/${AUTRE.id}`]: () => json(AUTRE),
      ...enregistrement(),
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))
    fireEvent.click(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' }))
    await screen.findByText('Ajouté : Alien, le huitième passager (1979)')

    cleanup()
    monter(`/profil/import-letterboxd?tache=${AUTRE.id}`)
    expect(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' })).toBeInTheDocument()
    expect(screen.queryByText(/^Ajouté/)).not.toBeInTheDocument()
  })

  it('« Corriger » ouvre le formulaire sur le visionnage ajouté, et la correction ramène au rapport', async () => {
    let patch: unknown
    base({
      [IMPORT]: lancee,
      [SUIVI]: () => finie(unRapport({ importes: 4, non_reconnus: [LIGNE_ALIEN] })),
      ...enregistrement(),
      'GET /api/reference/reactions': () => json(exemple('/reference/reactions', 'get', 200)),
      [`PATCH /api/me/journal/${ITEM.entry.id}`]: (init) => {
        patch = JSON.parse(String(init.body))
        return json(ITEM)
      },
    })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))
    fireEvent.click(await screen.findByRole('button', { name: 'Alien, le huitième passager (1979)' }))
    await screen.findByText('Ajouté : Alien, le huitième passager (1979)')

    fireEvent.click(screen.getByRole('button', { name: 'Corriger' }))
    expect(await screen.findByLabelText(/Séance du/)).toHaveValue(ITEM.entry.finished_at)
    fireEvent.click(screen.getByRole('radio', { name: 'Note 3 sur 10' }))
    fireEvent.click(screen.getByRole('button', { name: 'Corriger mon papier' }))

    expect(await screen.findByText('Ajouté : Alien, le huitième passager (1979)')).toBeInTheDocument()
    expect(screen.getByText('4 importés · 0 déjà présents')).toBeInTheDocument()
    expect(patch).toEqual({ rating: 3 })
  })

  it('après un import réussi, le journal, les chiffres et le bilan sont périmés', async () => {
    let finir!: (r: Response) => void
    base({ [IMPORT]: lancee, [SUIVI]: () => new Promise<Response>((r) => (finir = r)) })
    const client = monter()
    await screen.findByText(/Importer Letterboxd/)
    // Ce que les pages du profil ont lu avant d'arriver à la caisse.
    for (const cle of [cles.journalComplet, cles.stats, cles.realisateurs, cles.sagas]) client.setQueryData(cle, [])
    choisir(fichier(CSV))
    // Tant que la tâche tourne, rien n'est périmé ; c'est sa fin qui périme.
    await waitFor(() => expect(finir).toBeDefined())
    expect(client.getQueryState(cles.stats)?.isInvalidated).toBe(false)
    finir(finie())
    await screen.findByText(/importés ·/)

    // La page d'import ne montre pas le profil : ces requêtes n'ont pas d'observateur, elles
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
    base({ [IMPORT]: lancee, [SUIVI]: () => finie() })
    monter()
    await screen.findByText(/Importer Letterboxd/)
    choisir(fichier(CSV))

    fireEvent.click(await screen.findByRole('button', { name: 'Terminé' }))
    expect(await screen.findByRole('heading', { level: 1, name: `Profil de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })
})

describe('retirer les doublons', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Jamais la boîte du navigateur : la confirmation se fait dans la page.
    vi.stubGlobal('confirm', vi.fn(() => true))
  })
  afterEach(() => vi.unstubAllGlobals())

  const TROIS: Doublons = {
    total: 3,
    doublons: [0, 1, 2].map((i) => ({ ...DOUBLONS.doublons[0]!, id: `d${i}` })),
    cas_limites: [],
  }
  const CAS = DOUBLONS.cas_limites[0]!

  const base = (extra: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) =>
    servir({
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/stats': () => json(stats()),
      [JOURNAL]: () => json({ items: [], next_cursor: null }),
      ...extra,
    })

  it('montre l’aperçu, ne retire rien sans confirmation dans la page, puis retire', async () => {
    const requetes = base({ [APERCU]: () => json(TROIS), [RETRAIT]: () => json(TROIS) })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: /Retirer les doublons/ }))
    expect(await screen.findByText('3 doublons trouvés')).toBeInTheDocument()
    expect(requetes).toContain(APERCU)
    expect(requetes).not.toContain(RETRAIT)
    expect(confirm).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer les 3 doublons' }))
    expect(await screen.findByText('3 doublons retirés.')).toBeInTheDocument()
    expect(requetes.filter((r) => r === RETRAIT)).toHaveLength(1)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('« Annuler » ne retire rien et rend le bouton', async () => {
    const requetes = base({ [APERCU]: () => json(TROIS), [RETRAIT]: () => json(TROIS) })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: /Retirer les doublons/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }))

    expect(await screen.findByRole('button', { name: /Retirer les doublons/ })).toBeInTheDocument()
    expect(requetes).not.toContain(RETRAIT)
  })

  it('aucun doublon : il le dit, sans rien proposer de retirer', async () => {
    base({ [APERCU]: () => json({ total: 0, doublons: [], cas_limites: [] }) })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: /Retirer les doublons/ }))
    expect(await screen.findByText('Aucun doublon dans ton journal.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Retirer (le|les) / })).not.toBeInTheDocument()
  })

  it('les cas limites se montrent à part, ne partent jamais avec les doublons, et se retirent un par un', async () => {
    const RETRAIT_CAS = `DELETE /api/me/journal/${CAS.id}`
    let entetes: HeadersInit | undefined
    const requetes = base({
      [APERCU]: () => json({ ...TROIS, cas_limites: [CAS] }),
      // Le retrait d'ensemble rend les cas limites qui restent : le même.
      [RETRAIT]: () => json({ ...TROIS, cas_limites: [CAS] }),
      [RETRAIT_CAS]: (init) => {
        entetes = init.headers
        return new Response(null, { status: 204 })
      },
    })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: /Retirer les doublons/ }))
    expect(await screen.findByText('À vérifier toi-même')).toBeInTheDocument()
    expect(screen.getByText(`${CAS.media.title} · 13 juillet 2026 (9/10)`)).toBeInTheDocument()
    expect(screen.getByText('Ressemble à celui du 12 juillet 2026 (9/10) : la veille ou le lendemain.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer les 3 doublons' }))
    expect(await screen.findByText('3 doublons retirés.')).toBeInTheDocument()
    // Le retrait d'ensemble ne vise que `/me/journal/doublons` ; le cas limite est toujours là.
    expect(requetes).not.toContain(RETRAIT_CAS)
    const retirerCeluiCi = screen.getByRole('button', { name: `Retirer ${CAS.media.title} du 13 juillet 2026` })

    fireEvent.click(retirerCeluiCi)
    expect(await screen.findByText('Retiré.')).toBeInTheDocument()
    expect(requetes.filter((r) => r === RETRAIT_CAS)).toHaveLength(1)
    // Un DELETE sans corps ne se dit pas JSON : l'API refusait un corps JSON vide.
    expect(Object.keys(entetes ?? {}).map((c) => c.toLowerCase())).not.toContain('content-type')
  })

  it('aucun doublon sûr, mais des cas limites : il le dit, sans proposer de retrait d’ensemble', async () => {
    base({ [APERCU]: () => json({ total: 0, doublons: [], cas_limites: [CAS] }) })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: /Retirer les doublons/ }))
    expect(await screen.findByText('Aucun doublon sûr dans ton journal.')).toBeInTheDocument()
    expect(screen.getByText('À vérifier toi-même')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Retirer (le|les) / })).not.toBeInTheDocument()
  })

  it('après le retrait, le journal, les chiffres, le Voyage, les réalisateurs et les sagas sont périmés', async () => {
    base({ [APERCU]: () => json(TROIS), [RETRAIT]: () => json(TROIS) })
    const client = monter()
    // Ce que les autres pages ont lu avant d'arriver à la caisse.
    for (const cle of [cles.journalComplet, cles.stats, cles.realisateurs, cles.sagas]) client.setQueryData(cle, [])

    fireEvent.click(await screen.findByRole('button', { name: /Retirer les doublons/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer les 3 doublons' }))
    await screen.findByText('3 doublons retirés.')

    for (const cle of [cles.journalComplet, cles.stats, cles.voyage, cles.realisateurs, cles.sagas]) {
      const etat = client.getQueryState(cle)
      // La caisse ne les observe pas : elles restent marquées périmées, relues au retour.
      expect([cle, etat?.isInvalidated]).toEqual([cle, true])
    }
  })
})

describe('la caisse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    // Le jour du test est fixé : la date du ticket en dépend.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 1, 12))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-theme')
  })

  const base = (extra: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) =>
    servir({ 'GET /api/auth/me': () => json(SESSION), ...extra })

  it('s’ouvre sur /profil/reglages avec son titre et la date du jour', async () => {
    base()
    monter()

    expect(await screen.findByRole('heading', { level: 1, name: 'La caisse' })).toBeInTheDocument()
    expect(screen.getByText('01/10/2026')).toBeInTheDocument()
  })

  it('« Voir tous mes films » mène à Mes films', async () => {
    base()
    monter()

    expect(await screen.findByRole('link', { name: 'Voir tous mes films' })).toHaveAttribute('href', '/profil/mes-films')
  })

  it('porte la mention de TMDB, en anglais, avec son logo', async () => {
    base()
    monter()

    expect(
      await screen.findByText('This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'TMDB' })).toHaveAttribute('src', expect.stringMatching(/tmdb\.svg$/))
  })

  it('le thème est « Auto » tant que rien n’a été choisi', async () => {
    base()
    monter()

    const groupe = await screen.findByRole('radiogroup', { name: 'Thème' })
    expect(within(groupe).getByRole('radio', { name: 'Auto' })).toBeChecked()
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('choisir « Nuit » l’écrit et l’applique à la page', async () => {
    base()
    monter()

    fireEvent.click(await screen.findByRole('radio', { name: 'Nuit' }))

    expect(screen.getByRole('radio', { name: 'Nuit' })).toBeChecked()
    expect(localStorage.getItem('journal.theme')).toBe('sombre')
    expect(document.documentElement).toHaveAttribute('data-theme', 'sombre')
  })

  it('choisir « Jour » force le thème clair', async () => {
    base()
    monter()

    fireEvent.click(await screen.findByRole('radio', { name: 'Jour' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'clair')
  })

  it('revenir à « Auto » ôte le thème forcé', async () => {
    localStorage.setItem('journal.theme', 'sombre')
    base()
    monter()

    fireEvent.click(await screen.findByRole('radio', { name: 'Auto' }))

    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(localStorage.getItem('journal.theme')).toBe('auto')
  })

  it('rouvre sur le choix enregistré', async () => {
    localStorage.setItem('journal.theme', 'clair')
    base()
    monter()

    expect(await screen.findByRole('radio', { name: 'Jour' })).toBeChecked()
  })

  it('« Se déconnecter » ferme la session côté API', async () => {
    const requetes = base({ 'POST /api/auth/logout': () => new Response(null, { status: 204 }) })
    monter()

    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => expect(requetes).toContain('POST /api/auth/logout'))
  })

  // Mutation : retirer `<Cinoche />` de la caisse.
  it('porte la liaison Cinoche, à côté de celle de SensCritique', async () => {
    base({
      'GET /api/me/senscritique': () => json(exemple('/me/senscritique', 'delete', 200)),
      'GET /api/me/cinoche': () => json(exemple('/me/cinoche', 'delete', 200)),
    })
    monter()

    const titre = await screen.findByRole('heading', { level: 2, name: 'Cinoche' })
    // Chaque liaison a sa section : la sienne offre de relier le compte.
    expect(within(titre.closest('section')!).getByRole('button', { name: /Relier mon compte/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'SensCritique' })).toBeInTheDocument()
  })
})
