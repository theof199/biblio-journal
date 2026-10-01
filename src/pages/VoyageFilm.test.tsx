import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { JournalItem, JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'
import type { Bobine, FilmDeSalle } from '../api/voyage'
import type { VueScene } from '../mondes/types'
import { PAGES_1890 } from '../mondes/1890/pages'
import { RELECTURES } from '../voyage/relecture'
import { exemple } from '../test/contrat'
import { contexteFactice } from '../test/contexteFactice'
import { visionnage } from '../test/journal'
import { monterVoyage } from '../test/pageVoyage'
import { json, servir } from '../test/serveur'
import { fichePrete, filmDeSalle, salle } from '../test/voyage'
import VoyageFilm from './VoyageFilm'

const bobine = (tmdb_id: number, title: string, etat: Bobine['etat']): Bobine => ({ tmdb_id, title, duree_min: 1, cover_url: null, plex_url: null, etat })

const KANE = filmDeSalle({
  id: 'f-kane',
  tmdb_id: 15,
  title: 'Citizen Kane',
  original_title: 'Citizen Kane',
  year: 1897,
  realisateur: 'Orson Welles',
  raison: null,
  etat: 'vu',
  note: 9,
  cover_url: 'https://image.tmdb.org/t/p/w500/kane.jpg',
  backdrop_url: 'https://image.tmdb.org/t/p/w1280/kane.jpg',
  plex_url: null,
})
const FAUCON = filmDeSalle({
  id: 'f-faucon',
  tmdb_id: 963,
  title: 'Le Faucon maltais',
  original_title: 'The Maltese Falcon',
  year: 1897,
  realisateur: 'John Huston',
  raison: 'Fonde le film noir.',
  etat: 'a_demander',
  note: null,
  cover_url: 'https://image.tmdb.org/t/p/w500/faucon.jpg',
  backdrop_url: null,
  plex_url: null,
})
const PERDU = filmDeSalle({ id: 'f-perdu', tmdb_id: 701, title: 'Une vue perdue', etat: 'introuvable', note: null, plex_url: null })
const PLEX = filmDeSalle({ id: 'f-plex', tmdb_id: 700, title: 'Sur le Plex', etat: 'sur_le_plex', note: null, plex_url: 'https://app.plex.tv/desktop#!/details?key=700' })
/** Un programme dont une bobine reste à voir : son `tmdb_id` est celui de sa première bobine (l'API). */
const PROGRAMME = filmDeSalle({
  id: 'p-lumiere',
  tmdb_id: 511,
  title: 'Programme Lumière',
  etat: 'sur_le_plex',
  note: null,
  plex_url: null,
  programme: { duree_min: 2, bobines: [bobine(511, 'La Sortie de l’usine', 'vu'), bobine(512, 'Le Repas de bébé', 'sur_le_plex')] },
})
const PROG_VU = filmDeSalle({
  id: 'p-vu',
  tmdb_id: 521,
  title: 'Programme vu',
  etat: 'vu',
  note: null,
  plex_url: null,
  programme: { duree_min: 3, bobines: [bobine(521, 'Bobine A', 'vu'), bobine(522, 'Bobine B', 'vu')] },
})
const FILMS = [KANE, FAUCON, PERDU, PLEX, PROGRAMME, PROG_VU]
const FICHE = fichePrete({
  annee: 1897,
  salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: FILMS })],
  podium: [null, null, null],
  ticket: null,
  maturite: null,
  seances: [],
  demande_salle: null,
})

const ANNEE = 'GET /api/me/voyage/annees/1897'
const REALISATEURS = (tmdb: number) => `GET /api/reference/films/${tmdb}/realisateurs`
const CARTON = (tmdb: number) => `GET /api/reference/chroniques/films/${tmdb}`
const JOURNAL = 'GET /api/me/journal?limit=20'
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const CARTON_PRET = exemple<{ titre: string; texte: string }>('/reference/chroniques/films/{tmdbId}', 'get', 200)
const CARTON_202 = exemple('/reference/chroniques/films/{tmdbId}', 'get', 202)

const ROUTES = {
  [ANNEE]: () => json(FICHE),
  ...Object.fromEntries(FILMS.map((f) => [REALISATEURS(f.tmdb_id), () => json({ realisateurs: [] })])),
}

const page = (film: FilmDeSalle) => `/voyage/1897/films/${film.id}`
const compte = (requetes: string[], cle: string) => requetes.filter((r) => r === cle).length
const vide = () => new Response(null, { status: 204 })
const corps = (init: RequestInit) => JSON.parse(String(init.body)) as unknown

/** Mon visionnage d'un film TMDB : le reste vient de l'exemple du contrat. */
function vuDe(id: string, tmdb: number, o: { date?: string; note?: number | null; reactions?: string[] } = {}): JournalItem {
  const v = visionnage({ id, media: `m-${id}`, date: o.date ?? '2026-09-01', note: o.note ?? null, reactions: o.reactions })
  v.media.external_id = String(tmdb)
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.carnet.comment = 'Une remarque privée, qui ne sort jamais du billet.'
  return v
}

/** Ce qui a navigué hors de la fiche : l'adresse et son état, tels qu'une page suivante les lirait. */
function Sonde() {
  const l = useLocation()
  return <p data-testid="sonde">{`${l.pathname}${l.search} ${JSON.stringify(l.state)}`}</p>
}

/** La fiche seule, avec une sonde sur les routes du billet (tâche 11) : de quoi lire l'état qu'on lui passe. */
function monterAvecSonde(entree: string, routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  const client = createQueryClient()
  const requetes = servir(routes)
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entree]}>
        <Routes>
          <Route path="/voyage/:annee/films/:filmId" element={<VoyageFilm />} />
          <Route path="/voyage/:annee/films/:filmId/billet" element={<Sonde />} />
          <Route path="/voyage/:annee/films/:filmId/billet/corriger" element={<Sonde />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, requetes }
}

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

/** Une image doublée : elle note son adresse et son `crossOrigin`, et ne se charge qu'à la demande du test. */
class FausseImage {
  static creees: FausseImage[] = []
  src = ''
  crossOrigin: string | null = null
  onload: (() => void) | null = null
  width = 1280
  height = 720
  complete = false
  naturalWidth = 0
  constructor() {
    FausseImage.creees.push(this)
  }
}

describe('la fiche d’un film du Voyage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    FausseImage.creees = []
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutation : `enabled` du carton toujours vrai : au compte IA, ouvrir une fiche enfilerait un carton.
  it('ne lit jamais le carton à l’ouverture, seulement sur « Le film »', async () => {
    const { requetes } = monterVoyage(page(FAUCON), { ...ROUTES, [CARTON(963)]: () => json(CARTON_PRET) })
    await screen.findByRole('heading', { level: 1, name: FAUCON.title })
    await waitFor(() => expect(requetes).toContain(REALISATEURS(963)))
    expect(requetes.some((r) => r.includes('/reference/chroniques/'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Le film/ }))
    await waitFor(() => expect(requetes).toContain(CARTON(963)))
  })

  // Mutations : `filmDeLaFiche` remplacé par le premier film venu ; la fiche d'une autre année lue.
  it('ne lit que la fiche de son année, et dit l’absence d’un film qui n’y est pas', async () => {
    const { requetes } = monterVoyage('/voyage/1897/films/inconnu', ROUTES)
    expect(await screen.findByText('Ce film n’est pas dans les salles de 1897.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'L’année 1897' })).toHaveAttribute('href', '/voyage/1897')
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(requetes.filter((r) => r.includes('/annees/'))).toEqual([ANNEE])
  })

  // Le jumeau : le film trouvé est celui de l'adresse, pas le premier de la salle.
  it('montre le film de l’adresse, sa salle, son titre original, son année et sa raison', async () => {
    monterVoyage(page(FAUCON), ROUTES)
    expect(await screen.findByRole('heading', { level: 1, name: 'Le Faucon maltais' })).toBeInTheDocument()
    expect(screen.getByText('Salle · Les essentiels')).toBeInTheDocument()
    expect(screen.getByText('The Maltese Falcon')).toBeInTheDocument()
    expect(screen.getByText('Fonde le film noir.')).toBeInTheDocument()
    expect(screen.getByText(/1897/, { selector: 'p span' })).toBeInTheDocument()
  })

  // Mutation (coque) : la route déclarée hors de `<Coque />` (la barre disparaîtrait), ou ailleurs que sous `voyage`.
  it('garde la barre d’onglets, l’onglet Voyage marqué', async () => {
    monterVoyage(page(FAUCON), ROUTES)
    await screen.findByRole('heading', { level: 1, name: FAUCON.title })
    const onglets = screen.getByRole('navigation', { name: 'Onglets' })
    expect(within(onglets).getByRole('link', { name: 'Voyage' })).toHaveAttribute('aria-current', 'page')
  })

  // Mutations : « Je l’ai vu » vers la correction, ou vers le formulaire du journal.
  it('un film à voir : « Je l’ai vu » mène au billet', async () => {
    monterAvecSonde(page(FAUCON), ROUTES)
    fireEvent.click(await screen.findByRole('link', { name: /Je l’ai vu/ }))
    expect(await screen.findByTestId('sonde')).toHaveTextContent('/voyage/1897/films/f-faucon/billet null')
    expect(screen.queryByRole('link', { name: /Corriger/ })).toBeNull()
  })

  // Mutations : la page suivante jamais lue ; `entreeConnue` toujours faux ; l'entrée non passée au billet.
  it('un vu dont l’entrée est retrouvée à la deuxième page du journal : « Corriger » mène au billet de correction avec l’entrée', async () => {
    const autre = vuDe('e-autre', 27205)
    const kane = vuDe('e-kane', 15, { note: 9 })
    const { requetes } = monterAvecSonde(page(KANE), {
      ...ROUTES,
      [JOURNAL]: () => json({ ...PAGE, items: [autre], next_cursor: 'c2' }),
      [`${JOURNAL}&cursor=c2`]: () => json({ ...PAGE, items: [kane], next_cursor: null }),
    })
    fireEvent.click(await screen.findByRole('link', { name: /Corriger/ }))
    const sonde = await screen.findByTestId('sonde')
    expect(sonde.textContent).toContain('/voyage/1897/films/f-kane/billet/corriger ')
    expect(JSON.parse(sonde.textContent!.split(' ').slice(1).join(' '))).toEqual({ item: kane })
    expect(compte(requetes, `${JOURNAL}&cursor=c2`)).toBe(1)
  })

  // Mutation : le journal lu au-delà de l'entrée retrouvée (la course ne s'arrête pas).
  it('cesse de lire le journal dès l’entrée retrouvée', async () => {
    const { requetes } = monterVoyage(page(KANE), {
      ...ROUTES,
      [JOURNAL]: () => json({ ...PAGE, items: [vuDe('e-kane', 15)], next_cursor: 'c2' }),
    })
    await screen.findByRole('link', { name: /Corriger/ })
    await new Promise((r) => setTimeout(r, 50))
    expect(requetes.filter((r) => r.startsWith('GET /api/me/journal'))).toEqual([JOURNAL])
  })

  // Mutation : `isFetchNextPageError` ignoré : une page suivante en panne se redemanderait en boucle.
  it('une page suivante du journal en panne ne se redemande pas en boucle, et la fiche se prive de « Corriger »', async () => {
    const { requetes } = monterVoyage(page(KANE), {
      ...ROUTES,
      [JOURNAL]: () => json({ ...PAGE, items: [vuDe('e-autre', 27205)], next_cursor: 'c2' }),
      [`${JOURNAL}&cursor=c2`]: () => json({ code: 'INTERNAL', message: 'Panne.', retryable: false }, 500),
    })
    await screen.findByRole('button', { name: 'Mettre sur le podium' })
    await waitFor(() => expect(compte(requetes, `${JOURNAL}&cursor=c2`)).toBe(1))
    await new Promise((r) => setTimeout(r, 100))
    expect(compte(requetes, `${JOURNAL}&cursor=c2`)).toBe(1)
    expect(screen.queryByRole('link', { name: /Corriger/ })).toBeNull()
  })

  // Mutation : la garde `etat === 'vu'` retirée (le journal lu pour tout film, deux appels inutiles).
  it('le journal n’est pas lu pour un film à voir', async () => {
    const { requetes } = monterVoyage(page(FAUCON), { ...ROUTES, [JOURNAL]: () => json({ ...PAGE, items: [], next_cursor: null }) })
    await screen.findByRole('heading', { level: 1, name: FAUCON.title })
    await waitFor(() => expect(requetes).toContain(REALISATEURS(963)))
    await new Promise((r) => setTimeout(r, 50))
    expect(requetes.some((r) => r.startsWith('GET /api/me/journal'))).toBe(false)
    expect(screen.queryByRole('region', { name: 'Ta note' })).toBeNull()
  })

  // Mutations : les trous percés en `i <= note` ; la date du visionnage oubliée ; la remarque privée affichée.
  it('un film vu : ta note en perforations, la date et les réactions de ton dernier visionnage, jamais ta remarque', async () => {
    monterVoyage(page(KANE), {
      ...ROUTES,
      [JOURNAL]: () => json({ ...PAGE, items: [vuDe('e-kane', 15, { date: '2026-07-12', note: 9, reactions: ['adore', 'touche'] })], next_cursor: null }),
      'GET /api/reference/reactions': () => json(CATALOGUE),
    })
    const note = await screen.findByRole('region', { name: 'Ta note' })
    expect(await within(note).findByText('Ta note · vu le 12 juillet 2026')).toBeInTheDocument()
    expect(within(note).getByRole('img', { name: '9 sur 10' }).querySelectorAll('[data-perce="true"]')).toHaveLength(9)
    expect(within(note).getByRole('img', { name: '9 sur 10' }).querySelectorAll('i')).toHaveLength(10)
    const reactions = within(note).getByRole('list', { name: 'Tes réactions' })
    expect(await within(reactions).findByText('J’ai adoré')).toBeInTheDocument()
    expect(within(reactions).getByText('Ça m’a touché')).toBeInTheDocument()
    expect(screen.queryByText(/remarque privée/)).toBeNull()
  })

  // Mutations : le lien du réalisateur toujours au nom de la salle ; jamais de lien.
  it('le réalisateur mène à sa page quand TMDB le résout, et reste un nom sinon', async () => {
    monterVoyage(page(FAUCON), { ...ROUTES, [REALISATEURS(963)]: () => json({ realisateurs: [{ tmdb_id: 3996, name: 'John Huston' }] }) })
    expect(await screen.findByRole('link', { name: 'John Huston ›' })).toHaveAttribute('href', '/suivis/realisateurs/3996')
  })

  it('sans réalisateur résolu, le nom de la salle, sans lien', async () => {
    const { requetes } = monterVoyage(page(FAUCON), ROUTES)
    await waitFor(() => expect(requetes).toContain(REALISATEURS(963)))
    expect(await screen.findByText('John Huston')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /John Huston/ })).toBeNull()
  })

  // Mutations : l'invalidation retirée ; la garde du double toucher retirée.
  it('« Introuvable » envoie `PUT /me/introuvables/<tmdb>` une fois, puis relit la fiche', async () => {
    let poses = 0
    const { requetes } = monterVoyage(page(FAUCON), { ...ROUTES, 'PUT /api/me/introuvables/963': () => ((poses += 1), vide()) })
    const bouton = await screen.findByRole('button', { name: 'Introuvable' })
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(1))
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    expect(poses).toBe(1)
  })

  // Le jumeau de la fiche d'un film des Suivis (`FicheFilm.tsx`) : la marque change le prochain à voir
  // des filmographies et des sagas. Mutation : `PERIMES.introuvable` réduit à `cles.voyage` (la page
  // d'un réalisateur d'où la fiche s'est ouverte resterait sur l'ancien état au retour).
  it('une marque « introuvable » périme aussi les Suivis', async () => {
    const { client } = monterVoyage(page(FAUCON), { ...ROUTES, 'PUT /api/me/introuvables/963': vide }, (c) => {
      c.setQueryData(cles.pageRealisateur(3996), { films: [] })
      c.setQueryData([...cles.sagas, 1], [])
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Introuvable' }))
    await waitFor(() => expect(client.getQueryState(cles.pageRealisateur(3996))?.isInvalidated).toBe(true))
    expect(client.getQueryState([...cles.sagas, 1])?.isInvalidated).toBe(true)
  })

  // Mutations : « Le remettre à voir » qui marque au lieu de retirer ; `PERIMES.remettre` réduit à
  // `cles.voyage` (le jumeau de la marque).
  it('« Le remettre à voir » retire la marque, relit la fiche et périme les Suivis', async () => {
    const { requetes, client } = monterVoyage(page(PERDU), { ...ROUTES, 'DELETE /api/me/introuvables/701': vide }, (c) => {
      c.setQueryData(cles.pageRealisateur(3996), { films: [] })
      c.setQueryData([...cles.sagas, 1], [])
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Le remettre à voir' }))
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    expect(requetes).toContain('DELETE /api/me/introuvables/701')
    expect(screen.queryByRole('button', { name: 'Introuvable' })).toBeNull()
    expect(client.getQueryState(cles.pageRealisateur(3996))?.isInvalidated).toBe(true)
    expect(client.getQueryState([...cles.sagas, 1])?.isInvalidated).toBe(true)
  })

  // Mutations : la demande sans relire la fiche ; les filmographies et le Plex non périmés (jumeau de `FicheFilm.tsx`).
  it('« Demander sur Sir » relaie la demande, relit la fiche et périme les filmographies et le Plex', async () => {
    const { requetes, client } = monterVoyage(page(FAUCON), { ...ROUTES, 'POST /api/me/voyage/demander/963': () => json({ demande: true }, 201) }, (c) => {
      c.setQueryData(cles.pageRealisateur(3996), { films: [] })
      c.setQueryData(cles.plex, [])
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Demander sur Sir' }))
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    expect(client.getQueryState(cles.pageRealisateur(3996))?.isInvalidated).toBe(true)
    expect(client.getQueryState(cles.plex)?.isInvalidated).toBe(true)
  })

  // Mutation : un refus réécrit par la page.
  it('un refus s’affiche tel que l’API l’a écrit', async () => {
    monterVoyage(page(FAUCON), {
      ...ROUTES,
      'PUT /api/me/introuvables/963': () => json({ code: 'VALIDATION_ERROR', message: 'Ce film ne se marque pas.', retryable: false }, 400),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Introuvable' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce film ne se marque pas.')
  })

  // Le jumeau de la garde du double toucher (ledger, tâche 7) : relâchée une fois la réponse venue.
  // Mutation : `onSettled` retiré (après un refus passager, le guichet ne répondrait plus).
  it('après un refus, « Introuvable » se retente', async () => {
    let poses = 0
    monterVoyage(page(FAUCON), {
      ...ROUTES,
      'PUT /api/me/introuvables/963': () => (++poses === 1 ? json({ code: 'INTERNAL', message: 'Panne passagère.', retryable: true }, 500) : vide()),
    })
    const bouton = await screen.findByRole('button', { name: 'Introuvable' })
    fireEvent.click(bouton)
    expect(await screen.findByRole('alert')).toHaveTextContent('Panne passagère.')
    await waitFor(() => expect(bouton).toBeEnabled())
    fireEvent.click(bouton)
    await waitFor(() => expect(poses).toBe(2))
  })

  // Mutations : la cible toujours un film (`{ tmdb_id }` pour un programme, que l'API refuserait) ;
  // l'invalidation réduite à la fiche (la carte garderait l'affiche de l'ancien n°1).
  it('« Mettre sur le podium » d’un programme pose `{ programme_id }`, puis ferme le feuillet et relit la fiche et la carte', async () => {
    let pose: unknown
    const { requetes, client } = monterVoyage(
      page(PROG_VU),
      {
        ...ROUTES,
        'PUT /api/me/voyage/annees/1897/podium/2': (init) => ((pose = corps(init)), json(exemple('/me/voyage/annees/{annee}/podium/{place}', 'put', 200))),
      },
      (c) => c.setQueryData(cles.voyage, exemple('/me/voyage', 'get', 200)),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Mettre sur le podium' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Mettre sur le podium' })
    fireEvent.click(within(feuillet).getByRole('button', { name: /^2/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(pose).toEqual({ programme_id: 'p-vu' })
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    expect(client.getQueryState(cles.voyage)?.isInvalidated).toBe(true)
  })

  // Le jumeau : un film pose `{ tmdb_id }`, et la marche qui le porte déjà est cochée. Mutation : la
  // cible toujours un programme.
  it('« Mettre sur le podium » d’un film pose `{ tmdb_id }`, la marche qui le porte cochée', async () => {
    let pose: unknown
    const podium = exemple<typeof FICHE>('/me/voyage/annees/{annee}', 'get', 200).podium
    monterVoyage(page(KANE), {
      ...ROUTES,
      [ANNEE]: () => json({ ...FICHE, podium: [{ ...podium[0]!, tmdb_id: 15, programme_id: null }, null, null] }),
      [JOURNAL]: () => json({ ...PAGE, items: [], next_cursor: null }),
      'PUT /api/me/voyage/annees/1897/podium/3': (init) => ((pose = corps(init)), json(exemple('/me/voyage/annees/{annee}/podium/{place}', 'put', 200))),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Mettre sur le podium' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Mettre sur le podium' })
    expect(within(feuillet).getByRole('button', { name: /^1/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(feuillet).getByRole('button', { name: /^3/ })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(feuillet).getByRole('button', { name: /^3/ }))
    await waitFor(() => expect(pose).toEqual({ tmdb_id: 15 }))
  })

  // Le jumeau du refus du guichet, dans le feuillet ; et deux touchers n'écrivent qu'une fois.
  // Mutations : le message réécrit ; la garde du double toucher retirée ; le feuillet fermé sur un refus.
  it('un refus du podium s’affiche dans le feuillet tel que l’API l’a écrit, après une seule écriture', async () => {
    let poses = 0
    monterVoyage(page(PROG_VU), {
      ...ROUTES,
      'PUT /api/me/voyage/annees/1897/podium/1': () => (
        (poses += 1), json({ code: 'VALIDATION_ERROR', message: 'Ce film n’est pas dans ton journal pour cette année.', retryable: false }, 400)
      ),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Mettre sur le podium' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Mettre sur le podium' })
    const marche = within(feuillet).getByRole('button', { name: /^1/ })
    fireEvent.click(marche)
    fireEvent.click(marche)
    expect(await within(feuillet).findByRole('alert')).toHaveTextContent('Ce film n’est pas dans ton journal pour cette année.')
    expect(poses).toBe(1)
    // Et la garde se relâche à la réponse. Mutation : `onSettled` retiré du feuillet (plus rien ne partirait).
    await waitFor(() => expect(marche).toBeEnabled())
    fireEvent.click(marche)
    await waitFor(() => expect(poses).toBe(2))
  })

  // Le piège du rappel qui survit (ledger, tâches 8 et 9). Mutation : la fermeture du feuillet dans
  // `onSuccess` de `useMutation` : fermé pendant l'envoi, puis la réponse, il reculerait une seconde
  // fois, hors de la fiche.
  it('fermer le feuillet du podium pendant l’envoi, puis la réponse : la page reste sur la fiche', async () => {
    let repondre: (r: Response) => void = () => undefined
    monterVoyage(['/voyage/1897', page(PROG_VU)], {
      ...ROUTES,
      'GET /api/me/voyage': () => json(exemple('/me/voyage', 'get', 200)),
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
      'PUT /api/me/voyage/annees/1897/podium/1': () => new Promise<Response>((r) => (repondre = r)),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Mettre sur le podium' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Mettre sur le podium' })
    fireEvent.click(within(feuillet).getByRole('button', { name: /^1/ }))
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => repondre(json(exemple('/me/voyage/annees/{annee}/podium/{place}', 'put', 200))))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByRole('heading', { level: 1, name: 'Programme vu' })).toBeInTheDocument()
  })

  // Mutation : le paramètre `?bobine=` oublié (le billet noterait le programme entier).
  it('une bobine non vue ouvre `…/billet?bobine=<tmdb>` ; une bobine vue n’en offre pas', async () => {
    monterAvecSonde(page(PROGRAMME), ROUTES)
    const programme = await screen.findByRole('region', { name: 'Programme' })
    expect(within(programme).getByText('Programme · 2 min')).toBeInTheDocument()
    expect(within(programme).queryByRole('link', { name: 'Je l’ai vu : La Sortie de l’usine' })).toBeNull()
    fireEvent.click(within(programme).getByRole('link', { name: 'Je l’ai vu : Le Repas de bébé' }))
    expect(await screen.findByTestId('sonde')).toHaveTextContent('/voyage/1897/films/p-lumiere/billet?bobine=512 null')
  })

  // Le jumeau du guichet : un programme porte le `tmdb_id` de sa première bobine, ici déjà vue.
  // Mutation : « Je l’ai vu » du guichet vers le billet du programme sans `?bobine=` (il noterait
  // une seconde fois la première bobine).
  it('sur un programme vu en partie, « Je l’ai vu » du guichet ouvre le billet de la première bobine à voir', async () => {
    monterAvecSonde(page(PROGRAMME), ROUTES)
    fireEvent.click(await screen.findByRole('link', { name: /poinçonner mon billet/ }))
    expect(await screen.findByTestId('sonde')).toHaveTextContent('/voyage/1897/films/p-lumiere/billet?bobine=512 null')
  })

  // Mutation : les affiches des bobines sans le traitement du monde (1890 : `sepia`).
  it('les affiches des bobines portent le traitement du monde', async () => {
    monterVoyage(page(PROGRAMME), ROUTES)
    const programme = await screen.findByRole('region', { name: 'Programme' })
    expect(within(programme).getByRole('list').className).toMatch(/\bsepia\b|_sepia_/)
  })

  // Mutation : `rel` retiré (la page ouverte pourrait piloter le Journal par `window.opener`).
  it('« Voir sur le Plex » s’ouvre à part', async () => {
    monterVoyage(page(PLEX), ROUTES)
    const lien = await screen.findByRole('link', { name: 'Voir sur le Plex' })
    expect(lien).toHaveAttribute('href', PLEX.plex_url)
    expect(lien).toHaveAttribute('target', '_blank')
    expect(lien).toHaveAttribute('rel', 'noreferrer')
  })

  // Mutation : le retour en simple navigation vers l'année (d'un réalisateur, la fiche ramènerait à
  // l'année au lieu de reculer, et l'empilerait devant la page quittée).
  it('« Retour » recule dans l’historique, d’où qu’on vienne', async () => {
    monterVoyage(['/voyage/1896', page(FAUCON)], {
      ...ROUTES,
      'GET /api/me/voyage': () => json(exemple('/me/voyage', 'get', 200)),
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
      'GET /api/me/voyage/annees/1896': () => json(fichePrete({ annee: 1896, ticket: null, maturite: null })),
    })
    await screen.findByRole('heading', { level: 1, name: FAUCON.title })
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    expect(await screen.findByRole('heading', { level: 1, name: '1896' })).toBeInTheDocument()
  })

  // Le jumeau : ouverte d'un lien, sans rien de l'app derrière. Mutation : toujours reculer (rien ne se passerait).
  it('« Retour » mène à l’année quand rien n’est derrière', async () => {
    monterVoyage(page(FAUCON), {
      ...ROUTES,
      'GET /api/me/voyage': () => json(exemple('/me/voyage', 'get', 200)),
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    })
    await screen.findByRole('heading', { level: 1, name: FAUCON.title })
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    expect(await screen.findByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
  })

  // Décision du propriétaire du 1er octobre 2026 (2b-3) : un programme porte le `tmdb_id` de sa
  // première bobine (l'API), ici déjà vue ; vu en partie, ses gestes visent la première bobine qui
  // reste à voir (512), jamais la première (511). « Corriger » ne s'offre pas tant qu'il en reste une.
  // Mutation : `tmdbVise` rendu au seul `film.tmdb_id` (les gestes repartent vers 511).
  describe('sur un programme vu en partie, les gestes visent la bobine qui reste à voir', () => {
    const programme = (id: string, etat: Bobine['etat']) =>
      filmDeSalle({
        id,
        tmdb_id: 511,
        title: 'Programme Lumière n°2',
        etat,
        note: null,
        plex_url: null,
        programme: { duree_min: 3, bobines: [bobine(511, 'La Sortie de l’usine', 'vu'), bobine(512, 'Le Repas de bébé', etat), bobine(513, 'La Pêche aux poissons rouges', etat)] },
      })
    const A_DEMANDER = programme('p-demander', 'a_demander')
    const PERDUE = programme('p-perdue', 'introuvable')
    const routes = {
      ...ROUTES,
      [ANNEE]: () => json({ ...FICHE, salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: [...FILMS, A_DEMANDER, PERDUE] })] }),
      [REALISATEURS(511)]: () => json({ realisateurs: [] }),
    }

    it.each([
      ['Demander sur Sir', A_DEMANDER, 'POST /api/me/voyage/demander/512', () => json({ demande: true }, 201)],
      ['Introuvable', A_DEMANDER, 'PUT /api/me/introuvables/512', vide],
      ['Le remettre à voir', PERDUE, 'DELETE /api/me/introuvables/512', vide],
    ] as const)('« %s » vise la bobine 512', async (nom, film, requete, reponse) => {
      const { requetes } = monterVoyage(page(film), { ...routes, [requete]: reponse })
      fireEvent.click(await screen.findByRole('button', { name: nom }))
      await waitFor(() => expect(requetes).toContain(requete))
      expect(requetes.filter((r) => r.includes('/511'))).toEqual([REALISATEURS(511)])
      expect(screen.queryByRole('link', { name: /Corriger/ })).toBeNull()
    })

    it('« Le film » lit le carton de la bobine 512', async () => {
      const { requetes } = monterVoyage(page(A_DEMANDER), { ...routes, [CARTON(512)]: () => json(CARTON_PRET) })
      fireEvent.click(await screen.findByRole('button', { name: /Le film/ }))
      await screen.findByRole('dialog', { name: `Le film ${CARTON_PRET.titre}` })
      expect(requetes).toContain(CARTON(512))
      expect(requetes).not.toContain(CARTON(511))
    })
  })

  describe('le carton du chroniqueur', () => {
    // Mutation : le titre du carton ignoré (la feuille garderait le titre du film).
    it('prêt : son titre et son texte, sur la feuille du film', async () => {
      monterVoyage(page(FAUCON), { ...ROUTES, [CARTON(963)]: () => json(CARTON_PRET) })
      fireEvent.click(await screen.findByRole('button', { name: /Le film/ }))
      const feuille = await screen.findByRole('dialog', { name: `Le film ${CARTON_PRET.titre}` })
      expect(within(feuille).getByText('1897 · salle « Les essentiels »')).toBeInTheDocument()
      expect(feuille).toHaveTextContent(CARTON_PRET.texte.slice(1, 40))
    })

    // Mutation : `staleTime: Infinity` retiré : rouverte une minute plus tard, la feuille relirait un texte écrit.
    it('un carton écrit ne se redemande jamais', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { requetes } = monterVoyage(page(FAUCON), { ...ROUTES, [CARTON(963)]: () => json(CARTON_PRET) })
      fireEvent.click(await screen.findByRole('button', { name: /Le film/ }))
      await screen.findByRole('dialog', { name: `Le film ${CARTON_PRET.titre}` })
      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await vi.advanceTimersByTimeAsync(60_000)
      fireEvent.click(screen.getByRole('button', { name: /Le film/ }))
      await screen.findByRole('dialog', { name: `Le film ${CARTON_PRET.titre}` })
      expect(compte(requetes, CARTON(963))).toBe(1)
    })

    // Mutations : `intervalle` rendu `false` (l'attente pour toujours) ; `>` au lieu de `>=` dans le
    // plafond (une lecture de trop) ; l'abandon jamais dit.
    it('en préparation : relu toutes les trois secondes, dix fois au plus, puis le dit', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { requetes } = monterVoyage(page(FAUCON), { ...ROUTES, [CARTON(963)]: () => json(CARTON_202, 202) })
      fireEvent.click(await screen.findByRole('button', { name: /Le film/ }))
      await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })
      for (let i = 0; i < 14; i += 1) await vi.advanceTimersByTimeAsync(RELECTURES.carton.ms)
      const feuille = screen.getByRole('dialog', { name: `Le film ${FAUCON.title}` })
      expect(await within(feuille).findByText('Le chroniqueur n’a pas encore écrit sur ce film.')).toBeInTheDocument()
      expect(compte(requetes, CARTON(963))).toBe(RELECTURES.carton.plafond)
    })

    // Le jumeau de l'abandon. Mutation : « Réessayer » sans remettre le compte à zéro.
    it('au plafond, « Réessayer » relit et reprend l’attente', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      let n = 0
      const { requetes } = monterVoyage(page(FAUCON), {
        ...ROUTES,
        [CARTON(963)]: () => (++n <= RELECTURES.carton.plafond + 1 ? json(CARTON_202, 202) : json(CARTON_PRET)),
      })
      fireEvent.click(await screen.findByRole('button', { name: /Le film/ }))
      for (let i = 0; i < 14; i += 1) await vi.advanceTimersByTimeAsync(RELECTURES.carton.ms)
      fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
      expect(await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(RELECTURES.carton.ms)
      expect(await screen.findByRole('dialog', { name: `Le film ${CARTON_PRET.titre}` })).toBeInTheDocument()
      expect(compte(requetes, CARTON(963))).toBe(RELECTURES.carton.plafond + 2)
    })

    // Le jumeau des refus du guichet. Mutations : le message réécrit ; « Réessayer » sans relire.
    it('un refus de l’API s’affiche tel qu’il est écrit, et « Réessayer » relit', async () => {
      let n = 0
      const { requetes } = monterVoyage(page(FAUCON), {
        ...ROUTES,
        [CARTON(963)]: () => (++n === 1 ? json({ code: 'VALIDATION_ERROR', message: 'Ce film n’a pas de carton.', retryable: false }, 400) : json(CARTON_PRET)),
      })
      fireEvent.click(await screen.findByRole('button', { name: /Le film/ }))
      const feuille = await screen.findByRole('dialog', { name: `Le film ${FAUCON.title}` })
      expect(await within(feuille).findByText('Ce film n’a pas de carton.')).toBeInTheDocument()
      fireEvent.click(within(feuille).getByRole('button', { name: 'Réessayer' }))
      expect(await screen.findByRole('dialog', { name: `Le film ${CARTON_PRET.titre}` })).toBeInTheDocument()
      expect(compte(requetes, CARTON(963))).toBe(2)
    })

    // Mutation : `{ configure: false }` pris pour une attente (la feuille taperait pour toujours).
    it('sans chroniqueur : le dit, sans attendre', async () => {
      monterVoyage(page(FAUCON), { ...ROUTES, [CARTON(963)]: () => json({ configure: false }) })
      fireEvent.click(await screen.findByRole('button', { name: /Le film/ }))
      const feuille = await screen.findByRole('dialog', { name: `Le film ${FAUCON.title}` })
      await waitFor(() => expect(feuille).toHaveTextContent('Le chroniqueur n’a pas encore écrit sur ce film.'))
      expect(within(feuille).queryByRole('status', { name: 'Le chroniqueur écrit…' })).toBeNull()
    })
  })

  describe('la projection (décision D1)', () => {
    /** La scène épiée : une toile qui peint (contexte factice), au calme (une image par rendu), le dessin du monde 1890 remplacé par un espion. */
    function epierLaScene() {
      calme()
      vi.stubGlobal('Image', FausseImage)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => contexteFactice().ctx as never)
      const scene = vi.spyOn(PAGES_1890, 'dessinerScene').mockImplementation(() => undefined)
      return () => {
        const appels = scene.mock.calls
        expect(appels.length).toBeGreaterThan(0)
        return appels[appels.length - 1]![0] as VueScene
      }
    }

    // Mutations : l'affiche avant le fond ; `crossOrigin = 'anonymous'` posé (TMDB ne répond pas en
    // CORS : l'image ne se chargerait pas) ; l'image passée avant d'être chargée.
    it('projette le fond du film, chargé sans `crossOrigin`, une fois chargé', async () => {
      const derniere = epierLaScene()
      monterVoyage(page(KANE), { ...ROUTES, [JOURNAL]: () => json({ ...PAGE, items: [], next_cursor: null }) })
      await screen.findByRole('heading', { level: 1, name: KANE.title })
      const image = FausseImage.creees.find((i) => i.src === KANE.backdrop_url)
      expect(image).toBeDefined()
      expect(image!.crossOrigin).toBeNull()
      expect(derniere().image).toBeNull()
      act(() => image!.onload?.())
      await waitFor(() => expect(derniere().image).toBe(image))
    })

    // Le jumeau du toucher du bandeau (`VoyageAnnee.test.tsx`). Mutation : le toucher de l'écran oublié
    // (le train ne repartirait plus).
    it('toucher l’écran relance la projection, à l’instant de la toile', async () => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => contexteFactice().ctx as never)
      const scene = vi.spyOn(PAGES_1890, 'dessinerScene').mockImplementation(() => undefined)
      const dernier = () => scene.mock.calls[scene.mock.calls.length - 1]![0]
      monterVoyage(page(FAUCON), ROUTES)
      await screen.findByRole('heading', { level: 1, name: FAUCON.title })
      act(() => void vi.advanceTimersByTime(2_000))
      expect(dernier().touche).toBe(-9)
      fireEvent.pointerDown(screen.getByRole('img', { name: `L’écran projette ${FAUCON.title}.` }))
      act(() => void vi.advanceTimersByTime(20))
      expect(dernier().touche).toBeGreaterThan(1.9)
      expect(dernier().touche).toBeLessThan(dernier().t)
    })

    // Le jumeau : sans fond, l'affiche. Mutation : le fond seul (l'écran resterait blanc).
    it('sans fond, projette l’affiche', async () => {
      epierLaScene()
      monterVoyage(page(FAUCON), ROUTES)
      await screen.findByRole('heading', { level: 1, name: FAUCON.title })
      expect(FausseImage.creees.map((i) => i.src)).toContain(FAUCON.cover_url)
    })
  })
})
