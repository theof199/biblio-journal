import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '../../../api/queryClient'
import type { JournalItem, JournalPage } from '../../../api/journal'
import type { ReactionsCatalogue } from '../../../api/reactions'
import type { Bobine, FilmDeSalle } from '../../../api/voyage'
import VoyageFilm from '../../../pages/VoyageFilm'
import { exemple } from '../../../test/contrat'
import { visionnage } from '../../../test/journal'
import { monterVoyage } from '../../../test/pageVoyage'
import { json, servir } from '../../../test/serveur'
import { fichePrete, filmDeSalle, salle } from '../../../test/voyage'
import { PAGES_1900 } from '../pages'
import { MOTS_DE_LA_SEANCE, libelleDeLaVoiture, phraseDesSeances } from './hale'

/**
 * La séance Hale's Tours (plan des pages 1900, brief 5) : la fiche d'un film d'une année 1900 se
 * regarde du fond d'une fausse voiture. La page se monte dans l'app entière, le monde n'y arrive que
 * par le registre ; elle garde ses lectures, ses gestes et leurs gardes, que ces tests retrouvent un à
 * un sous le costume.
 */
const bobine = (tmdb_id: number, title: string, etat: Bobine['etat']): Bobine => ({ tmdb_id, title, duree_min: 1, cover_url: null, plex_url: null, etat })

const VOL = filmDeSalle({
  id: 'f-vol',
  tmdb_id: 5698,
  title: 'Le Vol du grand rapide',
  original_title: 'The Great Train Robbery',
  year: 1903,
  realisateur: 'Edwin S. Porter',
  raison: 'Le premier western, et un coup de feu vers la salle.',
  etat: 'a_demander',
  note: null,
  cover_url: 'https://image.tmdb.org/t/p/w500/vol.jpg',
  backdrop_url: 'https://image.tmdb.org/t/p/w1280/vol.jpg',
  plex_url: null,
})
const LUNE = filmDeSalle({ id: 'f-lune', tmdb_id: 775, title: 'Le Voyage dans la Lune', original_title: 'Le Voyage dans la Lune', year: 1902, realisateur: 'Georges Méliès', raison: null, etat: 'vu', note: 8, cover_url: null, backdrop_url: null, plex_url: null })
const SANS_NOTE = filmDeSalle({ id: 'f-muet', tmdb_id: 779, title: 'Une vue sans note', etat: 'vu', note: null, plex_url: null })
const PERDU = filmDeSalle({ id: 'f-perdu', tmdb_id: 701, title: 'Une vue perdue', etat: 'introuvable', note: null, plex_url: null })
const PLEX = filmDeSalle({ id: 'f-plex', tmdb_id: 700, title: 'Sur le Plex', etat: 'sur_le_plex', note: null, plex_url: 'https://app.plex.tv/desktop#!/details?key=700' })
const DEMANDE = filmDeSalle({ id: 'f-demande', tmdb_id: 702, title: 'Déjà demandé', etat: 'demande', note: null, plex_url: null })
/** Un programme dont la première bobine est vue : son `tmdb_id` est celui de cette bobine (l'API). */
const PROGRAMME = filmDeSalle({
  id: 'p-lumiere',
  tmdb_id: 511,
  title: 'Programme Lumière',
  etat: 'sur_le_plex',
  note: null,
  plex_url: null,
  programme: { duree_min: 2, bobines: [bobine(511, 'La Sortie de l’usine', 'vu'), bobine(512, 'Le Repas de bébé', 'sur_le_plex')] },
})
const FILMS = [VOL, LUNE, SANS_NOTE, PERDU, PLEX, DEMANDE, PROGRAMME]
const FICHE = fichePrete({ annee: 1903, salles: [salle({ id: 's-ess', nom: 'Les essentiels', films: FILMS })], podium: [null, null, null], ticket: null, maturite: null, seances: [], demande_salle: null })

const ANNEE = 'GET /api/me/voyage/annees/1903'
const REALISATEURS = (tmdb: number) => `GET /api/reference/films/${tmdb}/realisateurs`
const CARTON = (tmdb: number) => `GET /api/reference/chroniques/films/${tmdb}`
const JOURNAL = 'GET /api/me/journal?limit=20'
const REACTIONS = 'GET /api/reference/reactions'
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const CARTON_PRET = exemple<{ titre: string; texte: string }>('/reference/chroniques/films/{tmdbId}', 'get', 200)
const ROUTES = { [ANNEE]: () => json(FICHE), ...Object.fromEntries(FILMS.map((f) => [REALISATEURS(f.tmdb_id), () => json({ realisateurs: [] })])) }

const page = (film: FilmDeSalle) => `/voyage/1903/films/${film.id}`
const compte = (requetes: string[], cle: string) => requetes.filter((r) => r === cle).length
const vide = () => new Response(null, { status: 204 })
const journal = (items: JournalItem[]) => () => json({ ...PAGE, items, next_cursor: null })
const voiture = (film: FilmDeSalle) => screen.findByRole('img', { name: libelleDeLaVoiture(film.title) })

/** Mon visionnage d'un film TMDB ; sa remarque est privée. */
function vuDe(id: string, tmdb: number, o: { date?: string; note?: number | null; reactions?: string[] } = {}): JournalItem {
  const v = visionnage({ id, media: `m-${id}`, date: o.date ?? '2026-09-14', note: o.note ?? null, reactions: o.reactions })
  v.media.external_id = String(tmdb)
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.carnet.comment = 'Une remarque privée, qui ne sort jamais du billet.'
  return v
}

/** Ce qui a navigué hors de la fiche : l'adresse et son état, tels que le billet les lirait. */
function Sonde() {
  const l = useLocation()
  return <p data-testid="sonde">{`${l.pathname}${l.search} ${JSON.stringify(l.state)}`}</p>
}

/** La fiche seule, avec une sonde sur les routes du billet. */
function monterAvecSonde(entree: string, routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  const requetes = servir(routes)
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entree]}>
        <Routes>
          <Route path="/voyage/:annee/films/:filmId" element={<VoyageFilm />} />
          <Route path="/voyage/:annee/films/:filmId/billet" element={<Sonde />} />
          <Route path="/voyage/:annee/films/:filmId/billet/corriger" element={<Sonde />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { requetes }
}

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

/** Une image doublée : elle note son adresse et ne se charge qu'à la demande du test. */
class FausseImage {
  static creees: FausseImage[] = []
  src = ''
  onload: (() => void) | null = null
  constructor() {
    FausseImage.creees.push(this)
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
  FausseImage.creees = []
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('les règles de la séance', () => {
  // Mutations : `note + 1` ; la note nulle écrite « null sur 10 » ; les réactions oubliées, ou jointes
  // sans guillemets ; la date écrite sans visionnage retrouvé.
  it('« Tes séances » tient en une phrase : la date, la note, les réactions', () => {
    expect(phraseDesSeances(8, { date: '14 septembre 2026', reactions: ['Frissons'] })).toBe('Vu le 14 septembre 2026 · 8 sur 10 · « Frissons ».')
    expect(phraseDesSeances(null, { date: '1er mai 2026', reactions: ['J’ai adoré', 'Ça m’a touché'] })).toBe('Vu le 1er mai 2026 · sans note · « J’ai adoré », « Ça m’a touché ».')
    expect(phraseDesSeances(10, { date: '2 juin 2026', reactions: [] })).toBe('Vu le 2 juin 2026 · 10 sur 10.')
    expect(phraseDesSeances(7, null)).toBe('Vu · 7 sur 10.')
    expect(phraseDesSeances(null, null)).toBe('Vu · sans note.')
  })
})

describe('la fiche d’un film des années 1900', () => {
  // Mutations : `projection` retiré des gabarits de `PAGES_1900` (la toile reviendrait) ; une lecture
  // ajoutée dans la notice ou dans la voiture (un `fetch` de la carte au montage).
  it('se regarde du fond de la fausse voiture, sans une lecture de plus que la fiche par défaut', async () => {
    const { requetes, container } = monterVoyage(page(VOL), ROUTES)
    expect(await voiture(VOL)).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: VOL.title })).toBeInTheDocument()
    await waitFor(() => expect(requetes).toContain(REALISATEURS(VOL.tmdb_id)))
    // Un film à voir : ni le journal, ni les réactions, ni le carton du chroniqueur.
    expect(requetes.filter((r) => !r.includes('/auth/')).sort()).toEqual([ANNEE, REALISATEURS(VOL.tmdb_id)].sort())
  })

  // Le jumeau, pour un film vu : le journal et le catalogue des réactions, une fois chacun, comme le
  // défaut. Mutation : le journal relu par la notice.
  it('un film vu ne lit que sa fiche, ses réalisateurs, mon journal et le catalogue des réactions', async () => {
    const { requetes } = monterVoyage(page(LUNE), { ...ROUTES, [JOURNAL]: journal([vuDe('e-lune', 775, { note: 8, reactions: ['adore'] })]), [REACTIONS]: () => json(CATALOGUE) })
    expect(await screen.findByText(/« J’ai adoré »/)).toBeInTheDocument()
    expect(requetes.filter((r) => !r.includes('/auth/')).sort()).toEqual([ANNEE, JOURNAL, REALISATEURS(775), REACTIONS].sort())
  })

  // Mutations : l'image que la voiture ne poserait plus sur l'écran ; l'affiche prise avant le fond
  // (`urlProjetee`, à la page).
  it('l’écran porte l’image que la page a chargée : le fond du film, une fois chargé', async () => {
    vi.stubGlobal('Image', FausseImage)
    monterVoyage(page(VOL), ROUTES)
    const ecran = (await voiture(VOL)).children[1] as HTMLElement
    expect(ecran.style.backgroundImage).toBe('')
    expect(FausseImage.creees.map((i) => i.src)).toEqual([VOL.backdrop_url])
    act(() => FausseImage.creees[0]!.onload?.())
    await waitFor(() => expect(ecran.style.backgroundImage).toContain(VOL.backdrop_url!))
  })

  // Mutations : `useMouvementReduit` ignoré (`calme` en dur à la page) ; `data-vivante` toujours
  // « oui » dans la voiture. Le balayage de `pages1900.test.tsx` tient que la feuille n'anime que sous
  // cette racine vivante.
  it('au calme, rien ne tangue : la voiture n’est pas vivante', async () => {
    calme()
    monterVoyage(page(VOL), ROUTES)
    expect(await voiture(VOL)).toHaveAttribute('data-vivante', 'non')
  })

  // Le jumeau : sans « moins d'animations », elle l'est, et le tempo est posé pour l'écran qui s'allume.
  // Mutations : `data-vivante` toujours « non » ; `STYLE_DU_TEMPO` retiré de la racine.
  it('sans calme demandé, la voiture est vivante, au tempo', async () => {
    monterVoyage(page(VOL), ROUTES)
    const racine = await voiture(VOL)
    expect(racine).toHaveAttribute('data-vivante', 'oui')
    expect(racine.style.getPropertyValue('--tempo')).not.toBe('')
  })

  // Mutations : le titre hors du `h1` (la page n'aurait plus de titre) ; la salle, le titre original,
  // la raison ou l'année oubliés ; le lien du réalisateur vers une autre page, ou jamais de lien.
  it('garde le titre, la salle, le titre original, l’année, la raison, et le réalisateur qui mène aux Suivis', async () => {
    monterVoyage(page(VOL), { ...ROUTES, [REALISATEURS(VOL.tmdb_id)]: () => json({ realisateurs: [{ tmdb_id: 4567, name: 'Edwin S. Porter' }] }) })
    expect(await screen.findByRole('heading', { level: 1, name: VOL.title })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('Voiture · Les essentiels')).toBeInTheDocument()
    expect(screen.getByText('The Great Train Robbery')).toBeInTheDocument()
    expect(screen.getByText(VOL.raison!)).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Edwin S. Porter ›' })).toHaveAttribute('href', '/suivis/realisateurs/4567')
    expect(screen.getByText('· 1903')).toBeInTheDocument()
  })

  // Le jumeau : sans réalisateur résolu, le nom que porte la salle, sans lien. Mutation : le repli retiré.
  it('sans réalisateur résolu, le nom de la salle, sans lien', async () => {
    const { requetes } = monterVoyage(page(VOL), ROUTES)
    await waitFor(() => expect(requetes).toContain(REALISATEURS(VOL.tmdb_id)))
    expect(await screen.findByText('Edwin S. Porter')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Edwin S. Porter/ })).toBeNull()
  })

  // Mutations : la vignette ou sa légende retirées ; l'image sans texte de remplacement ; `hale` absent
  // des images du monde. Les rubriques abandonnées de la maquette n'y sont pas.
  it('montre l’entrée d’un Hale’s Tours et sa légende, sans « Trois photogrammes »', async () => {
    monterVoyage(page(VOL), ROUTES)
    expect(await screen.findByRole('heading', { level: 2, name: MOTS_DE_LA_SEANCE.titre })).toBeInTheDocument()
    const vignette = screen.getByRole('img', { name: MOTS_DE_LA_SEANCE.vignette })
    expect(vignette.getAttribute('src')).toMatch(/hale/)
    expect(vignette.closest('figure')).toHaveTextContent('Dès 1905, à Kansas City, les Hale’s Tours projettent des vues de chemin de fer au bout d’une fausse voiture qui tangue.')
    expect(screen.queryByText(/photogrammes/i)).toBeNull()
  })

  // Mutations : « Tes séances » montré pour un film à voir ; la date du visionnage oubliée ; la clé de
  // la réaction au lieu de sa phrase ; la remarque du carnet ajoutée à la phrase.
  it('un film vu : « Tes séances » dit la date, la note et les réactions du dernier visionnage, jamais la remarque', async () => {
    monterVoyage(page(LUNE), { ...ROUTES, [JOURNAL]: journal([vuDe('e-lune', 775, { date: '2026-09-14', note: 8, reactions: ['adore', 'touche'] })]), [REACTIONS]: () => json(CATALOGUE) })
    const seances = await screen.findByRole('region', { name: MOTS_DE_LA_SEANCE.seances })
    expect(await within(seances).findByText('Vu le 14 septembre 2026 · 8 sur 10 · « J’ai adoré », « Ça m’a touché ».')).toBeInTheDocument()
    expect(screen.queryByText(/remarque privée/)).toBeNull()
  })

  // Les jumeaux : sans visionnage retrouvé, la note seule ; sans note, « sans note » ; à voir, rien.
  // Mutation : la section rendue quel que soit l'état du film.
  it('« Tes séances » sans visionnage retrouvé dit la note seule, et ne se montre pas pour un film à voir', async () => {
    const vue = monterVoyage(page(SANS_NOTE), { ...ROUTES, [JOURNAL]: journal([]) })
    expect(await within(await screen.findByRole('region', { name: MOTS_DE_LA_SEANCE.seances })).findByText('Vu · sans note.')).toBeInTheDocument()
    vue.unmount()
    monterVoyage(page(VOL), ROUTES)
    await voiture(VOL)
    expect(screen.queryByRole('region', { name: MOTS_DE_LA_SEANCE.seances })).toBeNull()
  })
})

describe('le guichet d’un film des années 1900', () => {
  // Mutations : le mot écrit en dur dans le guichet du monde (le composteur du brief 6 ne le
  // reprendrait pas) ; le geste mené à la correction ; « Corriger » offert sans visionnage.
  it('un film à voir : « Composter une séance » mène au billet, sans « Corriger »', async () => {
    monterAvecSonde(page(VOL), ROUTES)
    const lien = await screen.findByRole('link', { name: /^Composter une séance/ })
    expect(lien).toHaveTextContent('ouvre le composteur')
    expect(screen.queryByRole('link', { name: /Corriger/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Je l’ai vu/ })).toBeNull()
    fireEvent.click(lien)
    expect(await screen.findByTestId('sonde')).toHaveTextContent('/voyage/1903/films/f-vol/billet null')
  })

  // Le mot est celui du monde (`mots.billet.ouvrir`, que le composteur du brief 6 reprend) : changé
  // là, il change ici. Mutation : « Composter une séance » écrit en dur dans le guichet du monde.
  it('le geste porte le mot du monde, jamais un mot écrit dans le guichet', async () => {
    const avant = PAGES_1900.mots.billet
    PAGES_1900.mots.billet = { ...avant, ouvrir: 'Prendre place', ouvrirSous: 'le train part' }
    try {
      monterAvecSonde(page(VOL), ROUTES)
      expect(await screen.findByRole('link', { name: /^Prendre place/ })).toHaveTextContent('le train part')
      expect(screen.queryByRole('link', { name: /Composter/ })).toBeNull()
    } finally {
      PAGES_1900.mots.billet = avant
    }
  })

  // Mutation : la première bobine prise sans regarder son état (`billet.vu` remplacé par l'adresse
  // nue du billet, dans `Guichet` ou dans le guichet du monde).
  it('sur un programme vu en partie, « Composter » vise la bobine qui reste à voir, jamais celle déjà vue', async () => {
    monterAvecSonde(page(PROGRAMME), ROUTES)
    fireEvent.click(await screen.findByRole('link', { name: /Composter une séance/ }))
    expect(await screen.findByTestId('sonde')).toHaveTextContent('/voyage/1903/films/p-lumiere/billet?bobine=512 null')
  })

  // Mutations : « Corriger » offert sans entrée retrouvée (`entreeConnue` toujours vrai) ; l'entrée
  // que le lien n'emporterait plus ; « Composter » offert sur un film vu.
  it('un film vu : « Corriger » n’est offert qu’avec son visionnage, et l’emporte au billet de correction', async () => {
    const lune = vuDe('e-lune', 775, { note: 8 })
    const { requetes } = monterAvecSonde(page(LUNE), { ...ROUTES, [JOURNAL]: journal([lune]) })
    const lien = await screen.findByRole('link', { name: /Corriger/ })
    expect(screen.queryByRole('link', { name: /Composter une séance/ })).toBeNull()
    expect(compte(requetes, JOURNAL)).toBe(1)
    fireEvent.click(lien)
    expect(await screen.findByTestId('sonde')).toHaveTextContent(`/voyage/1903/films/f-lune/billet/corriger {"item":${JSON.stringify(lune)}}`)
  })

  it('un film vu dont le visionnage n’est pas au journal : ni « Corriger », ni « Composter »', async () => {
    const { requetes } = monterAvecSonde(page(LUNE), { ...ROUTES, [JOURNAL]: journal([]) })
    expect(await screen.findByRole('button', { name: 'Mettre sur le podium' })).toBeInTheDocument()
    await waitFor(() => expect(requetes).toContain(JOURNAL))
    await screen.findByText('Vu · 8 sur 10.')
    expect(screen.queryByRole('link', { name: /Corriger/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Composter/ })).toBeNull()
  })

  // Tout geste que le guichet par défaut offre reste offert. Mutations : un `case` retiré du guichet
  // du monde (« Introuvable », « Demander sur Sir ») ; le verrou de `Guichet` retiré.
  it('« Introuvable » et « Demander sur Sir » restent, et n’écrivent qu’une fois', async () => {
    let poses = 0
    let demandes = 0
    const { requetes } = monterVoyage(page(VOL), { ...ROUTES, 'PUT /api/me/introuvables/5698': () => ((poses += 1), vide()), 'POST /api/me/demandes': () => ((demandes += 1), json({ statut: 'demande' }, 201)) })
    const introuvable = await screen.findByRole('button', { name: 'Introuvable' })
    expect(screen.getByRole('button', { name: 'Demander sur Sir' })).toBeInTheDocument()
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(1))
    fireEvent.click(introuvable)
    fireEvent.click(introuvable)
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    expect([poses, demandes]).toEqual([1, 0])
  })

  // Mutations : « Le remettre à voir » retiré ; « Introuvable » encore offert sur un film introuvable.
  it('un film introuvable : « Le remettre à voir » retire la marque', async () => {
    const { requetes } = monterVoyage(page(PERDU), { ...ROUTES, 'DELETE /api/me/introuvables/701': vide })
    fireEvent.click(await screen.findByRole('button', { name: 'Le remettre à voir' }))
    await waitFor(() => expect(requetes).toContain('DELETE /api/me/introuvables/701'))
    expect(screen.queryByRole('button', { name: 'Introuvable' })).toBeNull()
  })

  // Mutations : le lien du Plex retiré, ou ouvert dans la page ; la mention « demandé » oubliée.
  it('« Voir sur le Plex » s’ouvre à part, et un film demandé le dit', async () => {
    const vue = monterVoyage(page(PLEX), ROUTES)
    const plex = await screen.findByRole('link', { name: 'Voir sur le Plex' })
    expect(plex).toHaveAttribute('href', PLEX.plex_url)
    expect(plex).toHaveAttribute('target', '_blank')
    vue.unmount()
    monterVoyage(page(DEMANDE), ROUTES)
    expect(await screen.findByText('demandé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Demander sur Sir' })).toBeNull()
  })

  // Mutations : « Mettre sur le podium » retiré du guichet du monde, ou offert sur un film à voir ; le
  // refus de l'API que le guichet du monde n'afficherait plus.
  it('un film vu monte sur le podium par le feuillet de la page, et un refus s’affiche tel que l’API l’a écrit', async () => {
    monterVoyage(page(LUNE), { ...ROUTES, [JOURNAL]: journal([]), 'PUT /api/me/voyage/annees/1903/podium/1': () => json({ code: 'CONFLICT', message: 'Ce film est déjà sur une autre marche.', retryable: false }, 409) })
    fireEvent.click(await screen.findByRole('button', { name: 'Mettre sur le podium' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Mettre sur le podium' })
    fireEvent.click(within(feuillet).getAllByRole('button', { pressed: false })[0]!)
    expect(await within(feuillet).findByRole('alert')).toHaveTextContent('Ce film est déjà sur une autre marche.')
  })

  it('le refus d’une écriture du guichet s’affiche tel que l’API l’a écrit', async () => {
    monterVoyage(page(VOL), { ...ROUTES, 'PUT /api/me/introuvables/5698': () => json({ code: 'UPSTREAM_UNAVAILABLE', message: 'Le service ne répond pas.', retryable: true }, 503) })
    fireEvent.click(await screen.findByRole('button', { name: 'Introuvable' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le service ne répond pas.')
  })

  // Mutations : « Le film » retiré du guichet du monde ; le carton lu dès l'ouverture de la fiche (au
  // compte IA, un carton manquant s'enfile à la lecture).
  it('« Le film » reste, et le carton du chroniqueur ne se lit qu’à ce geste', async () => {
    const { requetes } = monterVoyage(page(VOL), { ...ROUTES, [CARTON(5698)]: () => json(CARTON_PRET) })
    const bouton = await screen.findByRole('button', { name: 'Le film' })
    await waitFor(() => expect(requetes).toContain(REALISATEURS(5698)))
    expect(requetes.some((r) => r.includes('/reference/chroniques/'))).toBe(false)
    fireEvent.click(bouton)
    expect(await screen.findByRole('dialog', { name: `Le film ${CARTON_PRET.titre}` })).toBeInTheDocument()
    expect(compte(requetes, CARTON(5698))).toBe(1)
  })

  // Mutation : le programme que la notice du monde ne rendrait plus (`programme` oublié).
  it('le programme et ses bobines restent : une bobine à voir ouvre son billet, une bobine vue n’en offre pas', async () => {
    monterVoyage(page(PROGRAMME), ROUTES)
    const programme = await screen.findByRole('region', { name: 'Programme' })
    expect(within(programme).getByRole('link', { name: 'Je l’ai vu : Le Repas de bébé' })).toHaveAttribute('href', '/voyage/1903/films/p-lumiere/billet?bobine=512')
    expect(within(programme).queryByRole('link', { name: 'Je l’ai vu : La Sortie de l’usine' })).toBeNull()
  })
})
