import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { cles } from '../api/cles'
import type { JournalItem, JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'
import type { Bobine, FichePrete, Progression, Voyage } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { PAGES_A_VENIR } from '../mondes/avenir/pages'
import { formatDateVisionnage, jourLocal } from '../ui/format'
import { oublierLeRetour } from '../voyage/annee/retour'
import { DUREE_DU_COMPOSTAGE, FRAPPE, VIBRATION, decalerJour } from '../voyage/billet'
import type { PropsBilletDeSeance } from '../voyage/billet/BilletDeSeance'
import { TEMPO } from '../voyage/tempo'
import { billetRange, oublierLeBillet } from '../voyage/billet/range'
import { RELECTURES } from '../voyage/relecture'
import { exemple } from '../test/contrat'
import { visionnage } from '../test/journal'
import { SESSION, monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { ficheEnAttente, fichePrete, ficheVerrouillee, filmDeSalle, morceau, salle, seance, voyage1890 } from '../test/voyage'

const SOURCE = { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1897 }
const VOYAGE = voyage1890(
  1897,
  [
    { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion' },
    { annee: 1897, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1898, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)
const HORS_IA: Voyage = { ...VOYAGE, ia: false, source: SOURCE }

const bobine = (tmdb_id: number, title: string, etat: Bobine['etat']): Bobine => ({ tmdb_id, title, duree_min: 1, cover_url: null, plex_url: null, etat })
const FAUCON = filmDeSalle({ id: 'f-faucon', tmdb_id: 963, title: 'Le Faucon maltais', year: 1897, realisateur: 'John Huston', etat: 'a_demander', plex_url: null })
const KANE = filmDeSalle({ id: 'f-kane', tmdb_id: 15, title: 'Citizen Kane', year: 1897, etat: 'vu', note: 9, plex_url: null })
const PROGRAMME = filmDeSalle({
  id: 'p-lumiere',
  tmdb_id: 511,
  title: 'Programme Lumière',
  year: 1897,
  etat: 'sur_le_plex',
  plex_url: null,
  programme: { duree_min: 2, bobines: [bobine(511, 'La Sortie de l’usine', 'vu'), bobine(512, 'Le Repas de bébé', 'sur_le_plex')] },
})
const ESSENTIELS = salle({ id: 's-ess', nom: 'Les essentiels', films: [FAUCON, KANE, PROGRAMME] })

const PROGRESSION: Progression = { essentiels_vus: 0, essentiels_total: 2, salles_completes: 0, salles_autres: 1 }
const JUGE = '2026-09-21T21:00:00.000Z'
const REJUGE = '2026-09-30T08:00:00.000Z'
/** La fiche de 1897, deux films vus, un verdict « pas encore mûre » : chaque test pose ce qui change. */
const fiche = (s: Partial<FichePrete> = {}): FichePrete =>
  fichePrete({
    annee: 1897,
    profondeur: 2,
    progression: PROGRESSION,
    recompense: null,
    ticket: null,
    maturite: { mure: false, motif: 'Encore un peu tôt.', jugee_le: JUGE },
    generique: null,
    seances: [],
    seance_en_cours: false,
    salles: [ESSENTIELS],
    pistes: [],
    demande_salle: null,
    podium: [null, null, null],
    ...s,
  })

const CARTE = 'GET /api/me/voyage'
const ANNEE = 'GET /api/me/voyage/annees/1897'
const REACTIONS = 'GET /api/reference/reactions'
const MEDIA = 'POST /api/media'
const JOURNAL = 'POST /api/me/journal'
/** Mes films des années 1890 : la boîte à billets, où le billet lit son numéro (décision D3). */
const BOITE = 'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899'
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200)
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
/** Une requête sous chaque préfixe que périme une écriture du journal, sans observateur (rien ne les relit). */
const PERIMABLES = [cles.seances, cles.stats, cles.tickets, cles.realisateurs, cles.sagas]

/** L'entrée que rend `POST /me/journal` : un film sorti en `annee` (l'année que l'API lit pour le jury). */
function entreeRendue(annee: number | null = 2010): JournalItem {
  const e = exemple<JournalItem>('/me/journal', 'post', 201)
  e.media.year = annee
  return e
}

/** Mon visionnage de Citizen Kane, sa remarque privée comprise : l'état de navigation du billet de correction. */
function kaneVu(): JournalItem {
  const v = visionnage({ id: 'e-kane', media: 'm-kane', titre: 'Citizen Kane', annee: 1897, date: '2026-09-01', note: 9, reactions: ['adore'] })
  v.media.external_id = '15'
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.carnet.comment = 'Une remarque privée, rien qu’à moi.'
  return v
}

/** Un visionnage d'un film sorti `annee`, vu le `date`. */
const vu = (id: string, annee: number, date: string) => visionnage({ id, media: `m-${id}`, annee, date })

/** L'entrée que rend le compostage d'un film de 1897 (vue le 12 juillet 2026, l'exemple du contrat). */
const NEUVE = entreeRendue(1897)

/**
 * La boîte des années 1890 après ce compostage, dans l'ordre de l'API (le plus récent devant) : deux
 * billets avant lui, et un film de 2010 vu entre eux, qu'une API d'avant le filtre rendrait aussi.
 * Le billet neuf y porte le N° 0003 ; numéroté sur tout le journal, il porterait le N° 0004.
 */
const BOITE_DE_TROIS = [NEUVE, vu('e-b', 1895, '2026-06-01'), vu('e-x', 2010, '2026-05-15'), vu('e-a', 1896, '2026-05-01')]

/**
 * Le serveur d'un billet : la fiche relue rend `apres` une fois le visionnage écrit (le film vu
 * compte), `avant` jusque-là. `ecrit` le dit au test. `boite` : mes films de la décennie, ou la
 * réponse à leur lecture.
 */
function serveur(
  o: { voyage?: Voyage; avant?: FichePrete; apres?: () => FichePrete; entree?: JournalItem; boite?: JournalItem[] | (() => Promise<Response>) } = {},
) {
  const etat = { ecrit: false, creations: 0 }
  const boite = o.boite ?? []
  const routes = {
    [BOITE]: () => (typeof boite === 'function' ? boite() : json({ ...PAGE, items: boite, next_cursor: null })),
    [CARTE]: () => json(o.voyage ?? VOYAGE),
    [ANNEE]: () => json(etat.ecrit ? (o.apres?.() ?? fiche({ profondeur: 3 })) : (o.avant ?? fiche())),
    [REACTIONS]: () => json(CATALOGUE),
    [MEDIA]: () => json(exemple('/media', 'post', 201), 201),
    [JOURNAL]: () => {
      etat.ecrit = true
      etat.creations += 1
      return json(o.entree ?? entreeRendue(), 201)
    },
  }
  return { etat, routes }
}

const billet = (film: { id: string }, suite = '') => `/voyage/1897/films/${film.id}/billet${suite}`
const compte = (requetes: string[], cle: string) => requetes.filter((r) => r === cle).length
const corps = (init: RequestInit) => JSON.parse(String(init.body)) as Record<string, unknown>
const composter = () => screen.findByRole('button', { name: /Tamponner « Vu »/ })
const lAnnee = () => screen.findByRole('region', { name: 'L’année 1897' })
/** L'encre du tampon, qui n'a de nom qu'une fois posée. */
const tamponne = () => screen.findByRole('img', { name: /^VU : / })
/** Hors du calme, le compostage joue toute sa séquence avant l'année (décision D4) : la traverser. */
const traverser = async () => {
  await tamponne()
  await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE)
}

/** `matchMedia` manque à jsdom : le test pose la réponse de « moins d'animations ». */
const calme = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

/** Web Animations, absent de jsdom : doublé, il note chaque animation lancée. */
function animer() {
  const animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation)
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })
  return animate
}

function vibreur() {
  const vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  return vibrate
}

describe('le billet de séance', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    oublierLeRetour(1897)
    oublierLeBillet()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (Element.prototype as { animate?: unknown }).animate
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  // Les tests qui attendent l'année composent au calme : l'année revient aussitôt (décision D4) ; la
  // séquence du tampon a les siens, plus bas, sous minuteries simulées.

  // Mutations : la garde du double toucher retirée ; le retour à l'année oublié (retour à l'accueil).
  it('composte une fois, puis revient à l’année relue', async () => {
    calme()
    const { etat, routes } = serveur()
    const { requetes } = monterVoyage(billet(FAUCON), routes)
    fireEvent.click(await screen.findByRole('button', { name: '7 sur 10' }))
    const bouton = await composter()
    // Deux touchers avant le rendu suivant : le bouton n'est pas encore éteint, seule la garde tient.
    act(() => {
      bouton.click()
      bouton.click()
    })
    expect(await lAnnee()).toBeInTheDocument()
    expect(etat.creations).toBe(1)
    expect(compte(requetes, MEDIA)).toBe(1)
    expect(compte(requetes, ANNEE)).toBeGreaterThan(1)
  })

  // Mutations : les mots d'avant (« Composter le billet » · « et revenir à l’année ») ; le nom de la
  // correction pris aux mots du monde ; un numéro posé avant le tampon.
  it('dit « Tamponner « Vu » » · « et ranger le billet », le numéro en attente ; « Corriger le billet » en correction', async () => {
    const { routes } = serveur()
    const vue = monterVoyage(billet(FAUCON), routes)
    expect(await composter()).toHaveAccessibleName('Tamponner « Vu » et ranger le billet')
    expect(screen.getByText('Cinématographe · billet de séance')).toBeInTheDocument()
    expect(screen.getByText('N° ····')).toBeInTheDocument()
    vue.unmount()
    monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }, routes)
    expect(await screen.findByRole('button', { name: /Corriger le billet/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tamponner/ })).toBeNull()
  })

  // Mutations : la date d'aujourd'hui toujours ; la note oubliée ; les cartons ou la remarque oubliés.
  it('le corps de POST /me/journal porte la date du dateur (« Hier »), la note poinçonnée, les cartons, la remarque', async () => {
    calme()
    const { routes } = serveur()
    let envoye: Record<string, unknown> | null = null
    monterVoyage(billet(FAUCON), {
      ...routes,
      [JOURNAL]: (init) => {
        envoye = corps(init)
        return routes[JOURNAL]()
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Hier' }))
    fireEvent.click(screen.getByRole('button', { name: '8 sur 10' }))
    // Deux cartons, choisis à rebours : ils partent dans l'ordre du catalogue.
    const [premier, second] = [CATALOGUE.reactions[0]!, CATALOGUE.reactions[2]!]
    fireEvent.click(await screen.findByRole('button', { name: second.phrase }))
    fireEvent.click(screen.getByRole('button', { name: premier.phrase }))
    expect(screen.getByText('2 cartons choisis')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Remarque privée' }), { target: { value: '  Le train fonce.  ' } })
    fireEvent.click(await composter())
    await lAnnee()
    expect(envoye).toEqual({
      media_id: exemple<{ media: { id: string } }>('/media', 'post', 201).media.id,
      finished_at: decalerJour(jourLocal(), -1),
      rating: 8,
      reactions: [premier.cle, second.cle],
      comment: 'Le train fonce.',
    })
  })

  // Mutations : la limite des douze cartons ignorée ; un carton choisi qui ne se reprend pas.
  it('douze cartons au plus, et un carton choisi se reprend', async () => {
    const { routes } = serveur()
    monterVoyage(billet(FAUCON), routes)
    await screen.findByRole('button', { name: CATALOGUE.reactions[0]!.phrase })
    expect(CATALOGUE.reactions.length).toBeGreaterThan(12)
    for (const r of CATALOGUE.reactions) fireEvent.click(screen.getByRole('button', { name: r.phrase }))
    expect(screen.getByText('12 cartons choisis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: CATALOGUE.reactions[12]!.phrase })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: CATALOGUE.reactions[0]!.phrase }))
    expect(screen.getByRole('button', { name: CATALOGUE.reactions[0]!.phrase })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('11 cartons choisis')).toBeInTheDocument()
  })

  // Mutation : un billet sans note envoie la note d'avant, ou `0` (« sans note » rebouche tout).
  it('« sans note » rebouche le poinçon et envoie une note nulle', async () => {
    calme()
    const { routes } = serveur()
    let envoye: Record<string, unknown> | null = null
    monterVoyage(billet(FAUCON), { ...routes, [JOURNAL]: (init) => ((envoye = corps(init)), routes[JOURNAL]()) })
    fireEvent.click(await screen.findByRole('button', { name: '6 sur 10' }))
    expect(screen.getByRole('button', { name: '6 sur 10' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'sans note' }))
    expect(screen.getByRole('button', { name: '6 sur 10' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(await composter())
    await lAnnee()
    expect(envoye).toMatchObject({ rating: null, finished_at: jourLocal() })
    expect(envoye).not.toHaveProperty('reactions')
    expect(envoye).not.toHaveProperty('comment')
  })

  // Mutations : `peutAvancer` ignoré ; « ‹ » qui n'avance rien ; le raccourci jamais allumé.
  it('« › » est désactivé à aujourd’hui, s’allume après « ‹ », et les raccourcis suivent la date', async () => {
    const { routes } = serveur()
    monterVoyage(billet(FAUCON), routes)
    const dateur = await screen.findByRole('group', { name: 'Date du visionnage' })
    const suivant = within(dateur).getByRole('button', { name: 'Jour suivant' })
    expect(suivant).toBeDisabled()
    expect(within(dateur).getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(dateur).getByRole('button', { name: 'Jour précédent' }))
    expect(suivant).toBeEnabled()
    expect(within(dateur).getByRole('button', { name: 'Hier' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(dateur).getByRole('button', { name: 'Jour précédent' }))
    expect(within(dateur).getByRole('button', { name: 'Hier' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dateur).getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(suivant)
    fireEvent.click(suivant)
    expect(suivant).toBeDisabled()
    // Le jumeau de « Hier » : « Aujourd’hui » ramène au jour du téléphone.
    fireEvent.click(within(dateur).getByRole('button', { name: 'Jour précédent' }))
    fireEvent.click(within(dateur).getByRole('button', { name: 'Jour précédent' }))
    fireEvent.click(within(dateur).getByRole('button', { name: 'Aujourd’hui' }))
    expect(within(dateur).getByRole('button', { name: 'Aujourd’hui' })).toHaveAttribute('aria-pressed', 'true')
    expect(suivant).toBeDisabled()
  })

  // Mutations : la date dite hors de la molette oubliée ; une molette décalée d'un cran (le jour, le
  // mois ou l'année).
  it('le dateur dit la date en toutes lettres, et chaque molette tourne sur son cran', async () => {
    const { routes } = serveur()
    monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }, routes)
    const dateur = await screen.findByRole('group', { name: 'Date du visionnage' })
    expect(within(dateur).getByText('1er septembre 2026')).toBeInTheDocument()
    const crans = [...dateur.querySelectorAll<HTMLElement>('[style*="translateY"]')].map((p) => p.style.transform)
    const an = Number(jourLocal().slice(0, 4))
    // 1er (cran 0), septembre (cran 8), 2026 parmi les années de la molette, qui partent de deux ans avant celle-ci.
    expect(crans).toEqual(['translateY(0px)', 'translateY(-320px)', `translateY(${-(2026 - Math.min(2026, an - 2)) * 40}px)`])
    fireEvent.click(within(dateur).getByRole('button', { name: 'Jour précédent' }))
    expect(within(dateur).getByText('31 août 2026')).toBeInTheDocument()
    expect([...dateur.querySelectorAll<HTMLElement>('[style*="translateY"]')].map((p) => p.style.transform).slice(0, 2)).toEqual(['translateY(-1200px)', 'translateY(-280px)'])
  })

  // Mutation : le candidat du programme (son `tmdb_id`, celui de la première bobine, déjà vue).
  it('une bobine : POST /media porte l’identifiant de la bobine, et le billet son titre', async () => {
    calme()
    const { routes } = serveur()
    let media: Record<string, unknown> | null = null
    monterVoyage(billet(PROGRAMME, '?bobine=512'), { ...routes, [MEDIA]: (init) => ((media = corps(init)), routes[MEDIA]()) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Le Repas de bébé' })).toBeInTheDocument()
    fireEvent.click(await composter())
    await lAnnee()
    expect(media).toEqual({ source: 'tmdb', external_id: '512', type: 'movie' })
  })

  // Mutations : la garde de la bobine retirée : le billet d'un programme noterait sa première bobine ;
  // puis la garde réduite à une bobine demandée (le jumeau : un programme ouvert sans `?bobine=`).
  it.each(['?bobine=999', ''])('un programme sans bobine reconnue (« %s ») ne s’offre pas au billet', async (suite) => {
    const { routes } = serveur()
    const { requetes } = monterVoyage(billet(PROGRAMME, suite), routes)
    expect(await screen.findByText('Cette bobine n’est pas au programme de « Programme Lumière ».')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour au film' })).toHaveAttribute('href', '/voyage/1897/films/p-lumiere')
    expect(screen.queryByRole('button', { name: /Tamponner/ })).toBeNull()
    expect(requetes.some((r) => r.startsWith('POST'))).toBe(false)
  })

  // Mutation : `filmDeLaFiche` au premier film venu.
  it('dit l’absence d’un film qui n’est pas dans les salles de l’année', async () => {
    const { routes } = serveur()
    monterVoyage('/voyage/1897/films/inconnu/billet', routes)
    expect(await screen.findByText('Ce film n’est pas dans les salles de 1897.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tamponner/ })).toBeNull()
  })

  // Le jumeau de la fiche du film : une adresse tapée vers une année après la mienne (un ticket gagné
  // pas encore utilisé) mène à la page de l'année fermée, jamais à « pas dans les salles ». Le film
  // absent d'une année ouverte garde son message : le test précédent. Mutation : le renvoi retiré.
  it('une année fermée renvoie à sa page, qui dit pourquoi, au lieu de « pas dans les salles »', async () => {
    const { routes } = serveur()
    const { requetes } = monterVoyage('/voyage/1898/films/f-kane/billet', {
      ...routes,
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
      'GET /api/me/voyage/annees/1898': () => json(ficheVerrouillee(1898)),
      'GET /api/me/journal?limit=100&sortie_min=1898&sortie_max=1898': () => json({ ...PAGE, items: [], next_cursor: null }),
    })
    expect(await screen.findByText('Cette année s’ouvre avec le ticket de 1897.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'L’année 1898' })).toBeInTheDocument()
    expect(screen.queryByText(/pas dans les salles/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Tamponner/ })).toBeNull()
    expect(requetes.some((r) => r.startsWith('POST'))).toBe(false)
  })

  // Le même renvoi pour une année en attente du Voyage suivi. Mutation : `en_attente` retiré
  // d'`anneeSansSalles`.
  it('une année en attente renvoie à sa page, qui dit qui est en retard, au lieu de « pas dans les salles »', async () => {
    const { routes } = serveur({ voyage: { ...HORS_IA, source: { ...SOURCE, annee_en_cours: 1896 } } })
    const { requetes } = monterVoyage(billet(KANE), {
      ...routes,
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
      [ANNEE]: () => json(ficheEnAttente(1897)),
      'GET /api/me/journal?limit=100&sortie_min=1897&sortie_max=1897': () => json({ ...PAGE, items: [], next_cursor: null }),
    })
    expect(await screen.findByText(/theo n’a pas encore ouvert 1897/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'L’année 1897' })).toBeInTheDocument()
    expect(screen.queryByText(/pas dans les salles/)).toBeNull()
    expect(requetes.some((r) => r.startsWith('POST'))).toBe(false)
  })

  // Et pour une année que le chroniqueur écrit encore. Mutation : `en_preparation` retiré
  // d'`anneeSansSalles`.
  it('une année en préparation renvoie à sa page, où le chroniqueur écrit, au lieu de « pas dans les salles »', async () => {
    const { routes } = serveur()
    const { requetes } = monterVoyage(billet(KANE), {
      ...routes,
      'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
      [ANNEE]: () => json(exemple('/me/voyage/annees/{annee}', 'get', 202), 202),
    })
    expect(await screen.findByRole('status', { name: 'Le chroniqueur écrit…' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'L’année 1897' })).toBeInTheDocument()
    expect(screen.queryByText(/pas dans les salles/)).toBeNull()
    expect(requetes.some((r) => r.startsWith('POST'))).toBe(false)
  })

  // Le jumeau du formulaire du journal. Mutation : une clé retirée des péremptions (les Suivis
  // reproposeraient le film, le Profil garderait ses chiffres).
  it('périme ce que périme le formulaire du journal', async () => {
    calme()
    const { routes } = serveur()
    const vue = monterVoyage(billet(FAUCON), routes, (c) => {
      for (const cle of PERIMABLES) c.setQueryData(cle, { garde: true })
    })
    fireEvent.click(await composter())
    await lAnnee()
    expect(PERIMABLES.filter((cle) => !vue.client.getQueryState(cle)?.isInvalidated)).toEqual([])
  })

  it('un refus s’affiche tel que l’API l’a écrit, et le billet se retente', async () => {
    calme()
    const { routes } = serveur()
    let essais = 0
    monterVoyage(billet(FAUCON), {
      ...routes,
      [JOURNAL]: () => (++essais === 1 ? json({ code: 'CONFLICT', message: 'Déjà noté aujourd’hui.', retryable: false }, 409) : routes[JOURNAL]()),
    })
    fireEvent.click(await composter())
    expect(await screen.findByRole('alert')).toHaveTextContent('Déjà noté aujourd’hui.')
    fireEvent.click(await composter())
    expect(await lAnnee()).toBeInTheDocument()
    expect(essais).toBe(2)
  })

  // Le piège du rappel qui survit (tâches 8 à 10). Mutation : la navigation dans `onSuccess` de
  // `useMutation` : quitté pendant l'envoi, le billet ramènerait quand même à l'année.
  it('quitté pendant l’envoi, le billet ne ramène pas à l’année à la réponse', async () => {
    const { routes } = serveur()
    let repondre: () => void = () => undefined
    const { requetes } = monterVoyage([`/voyage/1897/films/${FAUCON.id}`, billet(FAUCON)], {
      ...routes,
      'GET /api/reference/films/963/realisateurs': () => json({ realisateurs: [] }),
      [JOURNAL]: () => new Promise<Response>((r) => (repondre = () => r(routes[JOURNAL]()))),
    })
    fireEvent.click(await composter())
    await waitFor(() => expect(requetes).toContain(JOURNAL))
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    // La fiche du film : son enseigne, que le billet n'a pas.
    expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
    await act(async () => {
      repondre()
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(screen.getByText('Salle · Les essentiels')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
  })

  describe('le retour à l’année', () => {
    // Mutations : le retour jamais pris (un second passage le rejoue) ; `avancees` recalculé à chaque
    // lecture (une relecture qui avance encore revibre) ; le retour joué sur la fiche d'avant (sans
    // attendre la relecture : rien n'aurait bougé).
    it('le billet des films passe de 2 à 3, la région d’état dit « +1 film vu », et le téléphone vibre une fois, au palier de l’Ours', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const vibrate = vibreur()
      let apres = fiche({ profondeur: 3 })
      const { routes } = serveur({ voyage: HORS_IA, apres: () => apres })
      const vue = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      // Le tampon a déjà fait vibrer le téléphone (décision D4) : seul le palier compte ici.
      await tamponne()
      expect(vibrate).toHaveBeenCalledTimes(1)
      vibrate.mockClear()
      await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE)
      await lAnnee()
      const annonce = await screen.findByText('+1 film vu')
      expect(annonce).toHaveAttribute('role', 'status')
      const films = screen.getByRole('listitem', { name: '3 films vus' })
      expect(within(films).getByText('2')).toBeInTheDocument()
      expect(within(films).getByText('3')).toBeInTheDocument()
      expect(vibrate).toHaveBeenCalledTimes(1)
      expect(vibrate).toHaveBeenCalledWith(VIBRATION)

      // La fiche se relit et a encore avancé (un autre écran, un autre appareil) : rien ne revibre.
      apres = fiche({ profondeur: 4 })
      await act(() => vue.client.refetchQueries({ queryKey: ['voyage', 'annee', 1897] }))
      await screen.findByRole('listitem', { name: '4 films vus' })
      expect(vibrate).toHaveBeenCalledTimes(1)

      // Plus tard, la même année rouverte : le retour a été pris, rien ne roule ni ne vibre.
      vue.unmount()
      monterVoyage('/voyage/1897', routes)
      await screen.findByRole('listitem', { name: '4 films vus' })
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByText('+1 film vu')).toBeNull()
      expect(vibrate).toHaveBeenCalledTimes(1)
    })

    // Au calme, rien ne bouge, le téléphone non plus (décision du 30 septembre : la maquette). Mutation :
    // la garde du calme retirée de la vibration.
    it('au calme, le palier ne fait pas vibrer, et l’annonce reste', async () => {
      calme()
      const vibrate = vibreur()
      const { routes } = serveur({ voyage: HORS_IA })
      monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await lAnnee()
      expect(await screen.findByText('+1 film vu')).toHaveAttribute('role', 'status')
      await new Promise((r) => setTimeout(r, 50))
      expect(vibrate).not.toHaveBeenCalled()
    })

    // Les célébrations : le billet confie à l'année ce que la fiche portait de quoi fêter. Mutation :
    // `fete` oublié de l'avant (l'année n'aurait rien à comparer, et l'Ours passerait sans sa scène).
    it('le billet qui fait gagner l’Ours le fête sur l’année relue', async () => {
      calme()
      const { routes } = serveur({ voyage: HORS_IA, apres: () => fiche({ profondeur: 3, recompense: 'ours' }) })
      monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await lAnnee()
      expect(await screen.findByRole('dialog', { name: 'L’Ours : trois films de 1897' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // Le jumeau du palier. Mutation : vibrer à chaque avancée.
    it('une avancée sans palier ne fait pas vibrer', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const vibrate = vibreur()
      const { routes } = serveur({ voyage: HORS_IA, avant: fiche({ profondeur: 5 }), apres: () => fiche({ profondeur: 6 }) })
      monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      // La vibration du tampon n'est pas celle d'un palier.
      await tamponne()
      vibrate.mockClear()
      await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE)
      await lAnnee()
      expect(await screen.findByText('+1 film vu')).toBeInTheDocument()
      expect(vibrate).not.toHaveBeenCalled()
    })

    // Le compostage ralenti (le tempo, `voyage/tempo.ts`) : l'année ne revient ni au bout des 2 170 ms
    // d'avant, ni avant la fin de la séquence au tempo ; la page et la corde posent le tempo que leurs
    // feuilles lisent. Mutations : `TEMPO = 1` ; l'attente du talon retirée (l'année reviendrait avant
    // la fin) ; `STYLE_DU_TEMPO` retiré de la page ou de la corde (leur `calc` tomberait).
    it('l’année ne revient qu’à la fin du compostage au tempo, jamais au bout des 2 170 ms d’avant', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { routes } = serveur({ voyage: HORS_IA })
      monterVoyage(billet(FAUCON), routes)
      const bouton = await composter()
      expect(screen.getByRole('region', { name: 'Le billet de séance' }).style.getPropertyValue('--tempo')).toBe(String(TEMPO))
      fireEvent.click(bouton)
      // Le départ de la séquence : le marteau descend.
      await waitFor(() => expect(document.querySelector('[data-etape="descend"]')).not.toBeNull())
      await vi.advanceTimersByTimeAsync(2170 + 100)
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
      await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE - 2170 - 100 - 300)
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
      expect(screen.getByRole('region', { name: 'Le billet de séance' })).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(300)
      await lAnnee()
      const corde = await screen.findByRole('list', { name: 'La progression de l’année' })
      expect(corde.style.getPropertyValue('--tempo')).toBe(String(TEMPO))
    })

    // Mutations : la garde du calme retirée (le « +1 » volerait) ; `peutAnimer` ignoré.
    it('un « +1 » vole sur le billet gagné, jamais au calme', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const animate = animer()
      const { routes } = serveur({ voyage: HORS_IA })
      const vue = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await traverser()
      await lAnnee()
      const films = await screen.findByRole('listitem', { name: '3 films vus' })
      await waitFor(() => expect(within(films).getByText('+1')).toBeInTheDocument())
      expect(animate).toHaveBeenCalled()
      vue.unmount()

      calme()
      animate.mockClear()
      monterVoyage(billet(FAUCON), serveur({ voyage: HORS_IA }).routes)
      fireEvent.click(await composter())
      await lAnnee()
      expect(await screen.findByText('+1 film vu')).toBeInTheDocument()
      const posee = screen.getByRole('listitem', { name: '3 films vus' })
      expect(within(posee).queryByText('+1')).toBeNull()
      // Le compteur est posé à sa valeur, sans rouler depuis l'ancienne.
      expect(within(posee).queryByText('2')).toBeNull()
      expect(animate).not.toHaveBeenCalled()
    })

    // Mutation : la garde de Web Animations retirée (le « +1 » s'afficherait, immobile, ou lèverait).
    it('sans Web Animations, rien ne vole, mais le compteur roule', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { routes } = serveur({ voyage: HORS_IA })
      monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await traverser()
      await lAnnee()
      const films = await screen.findByRole('listitem', { name: '3 films vus' })
      await waitFor(() => expect(within(films).getByText('2')).toBeInTheDocument())
      expect(within(films).queryByText('+1')).toBeNull()
    })

    // Mutations : `doitGuetterVerdict` contourné (hors IA, la fiche se relirait) ; `verdictAChange`
    // ignoré (le guet ne s'arrêterait qu'au plafond).
    it('au compte IA, pour un film de l’année en cours, la fiche se relit toutes les cinq secondes jusqu’au verdict, puis s’arrête', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      calme()
      let verdict = JUGE
      const { routes } = serveur({
        entree: entreeRendue(1897),
        apres: () => fiche({ profondeur: 3, maturite: { mure: false, motif: 'Encore un peu tôt.', jugee_le: verdict } }),
      })
      const { requetes } = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await lAnnee()
      await vi.advanceTimersByTimeAsync(200)
      const n = compte(requetes, ANNEE)
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms)
      expect(compte(requetes, ANNEE)).toBe(n + 1)
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms)
      expect(compte(requetes, ANNEE)).toBe(n + 2)
      verdict = REJUGE
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms)
      expect(compte(requetes, ANNEE)).toBe(n + 3)
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms * 6)
      expect(compte(requetes, ANNEE)).toBe(n + 3)
    })

    // Le jumeau. Mutation : `doitGuetterVerdict` contourné.
    it.each([
      ['hors IA', HORS_IA, 1897],
      ['au compte IA, pour un film d’une autre année', VOYAGE, 2010],
    ] as const)('%s, aucune relecture de guet', async (_cas, voyage, anneeDuFilm) => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      calme()
      const { routes } = serveur({ voyage, entree: entreeRendue(anneeDuFilm) })
      const { requetes } = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await lAnnee()
      await vi.advanceTimersByTimeAsync(200)
      const n = compte(requetes, ANNEE)
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms * 4)
      expect(compte(requetes, ANNEE)).toBe(n)
    })

    // Le jumeau du verdict : le Lion accorde le ticket sans rejuger. Mutation : le ticket ignoré par le guet.
    it('un ticket apparu arrête le guet, même sans verdict neuf', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      calme()
      let ticket: FichePrete['ticket'] = null
      const { routes } = serveur({ entree: entreeRendue(1897), apres: () => fiche({ profondeur: 3, ticket }) })
      const { requetes } = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await lAnnee()
      await vi.advanceTimersByTimeAsync(200)
      const n = compte(requetes, ANNEE)
      ticket = { annee: 1898, emis_le: REJUGE, utilise_le: null }
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms)
      expect(compte(requetes, ANNEE)).toBe(n + 1)
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms * 4)
      expect(compte(requetes, ANNEE)).toBe(n + 1)
    })

    // Le jumeau : l'API ne juge qu'à la création. Mutation : `creation` toujours vrai.
    it('au compte IA, une correction ne guette rien', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { routes } = serveur()
      const { requetes } = monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }, {
        ...routes,
        'PATCH /api/me/journal/e-kane': () => json(kaneVu()),
      })
      fireEvent.click(await screen.findByRole('button', { name: '7 sur 10' }))
      fireEvent.click(screen.getByRole('button', { name: /Corriger le billet/ }))
      await lAnnee()
      await vi.advanceTimersByTimeAsync(200)
      const n = compte(requetes, ANNEE)
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms * 4)
      expect(kaneVu().media.year).toBe(VOYAGE.annee_en_cours)
      expect(compte(requetes, ANNEE)).toBe(n)
    })

    // Mutation : le guet au plafond ignoré (la fiche se relirait tant que le verdict ne change pas).
    it('le guet s’arrête au douzième essai', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      calme()
      const { routes } = serveur({ entree: entreeRendue(1897) })
      const { requetes } = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await lAnnee()
      await vi.advanceTimersByTimeAsync(200)
      const n = compte(requetes, ANNEE)
      for (let i = 0; i < 20; i += 1) await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms)
      expect(compte(requetes, ANNEE)).toBe(n + RELECTURES.verdict.plafond)
    })

    // Mutation : la minuterie non annulée en quittant la page.
    it('le guet s’arrête en quittant la page', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      calme()
      const { routes } = serveur({ entree: entreeRendue(1897) })
      const { requetes } = monterVoyage(['/voyage/1896', billet(FAUCON)], {
        ...routes,
        'GET /api/me/voyage/annees/1896': () => json(fiche({ annee: 1896, recompense: 'lion', maturite: null })),
      })
      fireEvent.click(await composter())
      await lAnnee()
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms + 200)
      fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
      await screen.findByRole('heading', { level: 1, name: '1896' })
      const n = compte(requetes, ANNEE)
      await vi.advanceTimersByTimeAsync(RELECTURES.verdict.ms * 4)
      expect(compte(requetes, ANNEE)).toBe(n)
    })

    // Le jumeau : depuis la fiche du film, le billet est remplacé par l'année ; reculer ramène au film,
    // jamais au billet. Mutations : toujours reculer (le billet ramènerait au film, pas à l'année) ;
    // pousser l'année au lieu de la remplacer (reculer rouvrirait le billet).
    it('depuis la fiche du film, le billet laisse place à l’année, et reculer ne le rouvre pas', async () => {
      calme()
      const { routes } = serveur()
      monterVoyage(['/voyage/1896', `/voyage/1897/films/${FAUCON.id}`, billet(FAUCON)], {
        ...routes,
        'GET /api/me/voyage/annees/1896': () => json(fiche({ annee: 1896, recompense: 'lion', maturite: null })),
        'GET /api/reference/films/963/realisateurs': () => json({ realisateurs: [] }),
      })
      fireEvent.click(await composter())
      expect(await lAnnee()).toBeInTheDocument()
      fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
      expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Tamponner/ })).toBeNull()
    })

    // Depuis la séance, l'année est derrière le billet. Mutations : le lien de la séance sans son état
    // (le billet remplacerait l'année par elle-même) ; toujours remplacer. L'historique aurait alors
    // deux fois 1897, et « Retour à la carte » ramènerait à 1897.
    it('depuis la séance, le billet recule vers l’année sans la doubler, et les billets roulent', async () => {
      calme()
      const { routes } = serveur({ avant: fiche({ seances: [seance({ id: 's-1', rang: 1, long: morceau(FAUCON) })] }) })
      monterVoyage(['/voyage/1896', '/voyage/1897'], {
        ...routes,
        'GET /api/me/voyage/annees/1896': () => json(fiche({ annee: 1896, recompense: 'lion', maturite: null })),
      })
      const zone = await screen.findByRole('region', { name: 'Ce soir à la baraque' })
      fireEvent.click(within(zone).getByRole('link', { name: `Je l’ai vu : ${FAUCON.title}` }))
      fireEvent.click(await composter())
      await lAnnee()
      expect(await screen.findByText('+1 film vu')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
      expect(await screen.findByRole('heading', { level: 1, name: '1896' })).toBeInTheDocument()
    })
  })

  describe('la correction', () => {
    // Mutation : `construirePatch` remplacé par le brouillon entier.
    it('`PATCH` ne porte que ce qui a changé, et le billet part de l’entrée, remarque privée comprise', async () => {
      const { routes } = serveur()
      let envoye: Record<string, unknown> | null = null
      const { requetes } = monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }, {
        ...routes,
        'PATCH /api/me/journal/e-kane': (init) => ((envoye = corps(init)), json(kaneVu())),
      })
      expect(await screen.findByRole('heading', { level: 1, name: 'Citizen Kane' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Remarque privée' })).toHaveValue('Une remarque privée, rien qu’à moi.')
      expect(screen.getByRole('button', { name: '9 sur 10' })).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(screen.getByRole('button', { name: '7 sur 10' }))
      fireEvent.click(screen.getByRole('button', { name: /Corriger le billet/ }))
      await lAnnee()
      expect(envoye).toEqual({ rating: 7 })
      expect(requetes.some((r) => r.startsWith('POST'))).toBe(false)
    })

    // Mutation : le billet de correction sans son entrée qui tente quand même (il n'y a rien à corriger).
    it('sans l’entrée dans l’état de navigation, dit que le visionnage n’est plus disponible', async () => {
      const { routes } = serveur()
      monterVoyage(billet(KANE, '/corriger'), routes)
      expect(await screen.findByText('Ce visionnage n’est plus disponible.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Retour au film' })).toHaveAttribute('href', '/voyage/1897/films/f-kane')
      expect(screen.queryByRole('button', { name: /Corriger le billet/ })).toBeNull()
    })

    // Mutations : la confirmation sautée ; « Annuler » qui supprime ; le billet effacé laissé dans
    // l'historique (remplacé par la fiche du film : le « Retour » du film ramènerait au film).
    it('« Supprimer » envoie `DELETE` après confirmation, puis recule vers la fiche du film', async () => {
      const { routes } = serveur()
      let effacements = 0
      monterVoyage(['/voyage/1897', `/voyage/1897/films/${KANE.id}`, { pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }], {
        ...routes,
        'GET /api/me/journal?limit=20': () => json({ ...PAGE, items: [kaneVu()], next_cursor: null }),
        'GET /api/reference/films/15/realisateurs': () => json({ realisateurs: [] }),
        'DELETE /api/me/journal/e-kane': () => ((effacements += 1), new Response(null, { status: 204 })),
      })
      // Rien ne prend le focus à l'ouverture du billet.
      expect(await screen.findByRole('button', { name: 'Supprimer' })).not.toHaveFocus()
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
      expect(screen.getByText('Supprimer ce visionnage ? Le commentaire et les réactions partent avec.')).toBeInTheDocument()
      expect(effacements).toBe(0)
      // Le focus va au geste sans risque, puis revient à « Supprimer » : la confirmation se montre, et le
      // clavier ne se perd pas.
      expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
      expect(screen.queryByText(/Supprimer ce visionnage/)).toBeNull()
      expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveFocus()
      expect(effacements).toBe(0)
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
      // La fiche du film : son enseigne, que le billet n'a pas.
      expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Corriger le billet/ })).toBeNull()
      expect(effacements).toBe(1)
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
      expect(await lAnnee()).toBeInTheDocument()
    })

    // Le jumeau du rappel qui survit, pour la suppression. Mutation : la navigation dans `onSuccess` de
    // `useMutation` : quitté pendant l'envoi, le billet reculerait une seconde fois, hors du film.
    it('quitté pendant la suppression, le billet ne recule pas une seconde fois à la réponse', async () => {
      const { routes } = serveur()
      let repondre: () => void = () => undefined
      const { requetes } = monterVoyage(['/voyage/1897', `/voyage/1897/films/${KANE.id}`, { pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }], {
        ...routes,
        'GET /api/me/journal?limit=20': () => json({ ...PAGE, items: [kaneVu()], next_cursor: null }),
        'GET /api/reference/films/15/realisateurs': () => json({ realisateurs: [] }),
        'DELETE /api/me/journal/e-kane': () => new Promise<Response>((r) => (repondre = () => r(new Response(null, { status: 204 })))),
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
      await waitFor(() => expect(requetes).toContain('DELETE /api/me/journal/e-kane'))
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
      expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
      await act(async () => {
        repondre()
        await new Promise((r) => setTimeout(r, 50))
      })
      expect(screen.getByText('Salle · Les essentiels')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
    })

    // Le jumeau des péremptions du compostage. Mutation : « Supprimer » qui ne périme rien.
    it('« Supprimer » périme ce que périme le formulaire du journal', async () => {
      const { routes } = serveur()
      const vue = monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }, {
        ...routes,
        'GET /api/me/journal?limit=20': () => json({ ...PAGE, items: [], next_cursor: null }),
        'GET /api/reference/films/15/realisateurs': () => json({ realisateurs: [] }),
        'DELETE /api/me/journal/e-kane': () => new Response(null, { status: 204 }),
      }, (c) => {
        for (const cle of PERIMABLES) c.setQueryData(cle, { garde: true })
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
      await screen.findByText('Salle · Les essentiels')
      expect(PERIMABLES.filter((cle) => !vue.client.getQueryState(cle)?.isInvalidated)).toEqual([])
    })

    // Les jumeaux du refus du compostage. Mutations : le message de l'API réécrit ; la garde de
    // « Supprimer » jamais relâchée après un refus.
    it('un refus de la suppression s’affiche tel que l’API l’a écrit, et « Supprimer » se retente', async () => {
      const { routes } = serveur()
      let essais = 0
      monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }, {
        ...routes,
        'GET /api/me/journal?limit=20': () => json({ ...PAGE, items: [], next_cursor: null }),
        'GET /api/reference/films/15/realisateurs': () => json({ realisateurs: [] }),
        'DELETE /api/me/journal/e-kane': () =>
          ++essais === 1 ? json({ code: 'NOT_FOUND', message: 'Ce visionnage n’existe plus.', retryable: false }, 404) : new Response(null, { status: 204 }),
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Ce visionnage n’existe plus.')
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
      expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
      expect(essais).toBe(2)
    })

    // Le jumeau de la garde du compostage. Mutation : la garde de « Supprimer » retirée.
    it('deux touchers sur « Supprimer » n’effacent qu’une fois', async () => {
      const { routes } = serveur()
      let effacements = 0
      monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kaneVu() } }, {
        ...routes,
        'GET /api/me/journal?limit=20': () => json({ ...PAGE, items: [], next_cursor: null }),
        'GET /api/reference/films/15/realisateurs': () => json({ realisateurs: [] }),
        'DELETE /api/me/journal/e-kane': () => ((effacements += 1), new Response(null, { status: 204 })),
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
      const confirmer = screen.getByRole('button', { name: 'Supprimer' })
      // Deux touchers avant le rendu suivant : le bouton n'est pas encore éteint, seule la garde tient.
      act(() => {
        confirmer.click()
        confirmer.click()
      })
      expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
      expect(effacements).toBe(1)
    })
  })

  describe('le billet numéroté (idée 5, décision D4)', () => {
    // Mutations : le numéro pris dans tout le journal (« N° 0004 ») ; posé dès la réponse de la boîte,
    // avant les tirages ; `rangerLeBillet` oublié ; le talon sans son numéro ; l'année ramenée avant la
    // fin de la séquence ; ni vibration, ni billet amené à l'écran ; l'encre sans sa date.
    it('tamponne, numérote, range le billet, puis revient à l’année', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const vibrate = vibreur()
      const amener = vi.fn()
      Object.defineProperty(Element.prototype, 'scrollIntoView', { value: amener, configurable: true, writable: true })
      const { routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      const { requetes } = monterVoyage(billet(FAUCON), routes)
      const bouton = await composter()
      expect(screen.getByText('N° ····')).toBeInTheDocument()
      fireEvent.click(bouton)
      const encre = await tamponne()
      expect(encre).toHaveAccessibleName(`VU : Cinématographe · séance du ${formatDateVisionnage(jourLocal())}`)
      // Sur l'anneau, en capitales, comme la maquette (`encreVu`).
      expect(encre.querySelector('textPath')).toHaveTextContent(`CINÉMATOGRAPHE · SÉANCE DU ${formatDateVisionnage(jourLocal()).toUpperCase()} ·`)
      // La boîte a répondu, mais le numéro attend le numéroteur.
      expect(compte(requetes, BOITE)).toBe(1)
      expect(screen.getByText('N° ····')).toBeInTheDocument()
      expect(vibrate).toHaveBeenCalledWith(VIBRATION)
      expect(amener).toHaveBeenCalled()
      // La pause, le marteau qui remonte, les tirages : le numéro est posé, l'année pas encore là.
      await vi.advanceTimersByTimeAsync(FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + 20)
      expect(screen.getByText('N° 0003')).toBeInTheDocument()
      expect(compte(requetes, BOITE)).toBe(1)
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
      // Le talon part avec le même numéro.
      await vi.advanceTimersByTimeAsync(FRAPPE.avantTalon)
      expect(screen.getAllByText('N° 0003')).toHaveLength(2)
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
      await vi.advanceTimersByTimeAsync(FRAPPE.talon)
      expect(await lAnnee()).toBeInTheDocument()
      expect(billetRange(SESSION.user.id)).toBe(NEUVE.entry.id)
    })

    // Mutations : la garde « montée » retirée (la séquence finie ramènerait à l'année) ; sa dernière
    // lecture seule retirée (parti pendant le talon, ramené quand même).
    it.each([
      ['le numéroteur', FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * 3, false],
      ['le talon', FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + FRAPPE.avantTalon + FRAPPE.talon / 2, true],
    ] as const)('ne ramène pas à l’année un membre parti pendant %s', async (_moment, apres, talon) => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      monterVoyage([`/voyage/1897/films/${FAUCON.id}`, billet(FAUCON)], {
        ...routes,
        'GET /api/reference/films/963/realisateurs': () => json({ realisateurs: [] }),
      })
      fireEvent.click(await composter())
      await tamponne()
      await vi.advanceTimersByTimeAsync(apres)
      // Le numéroteur roule : ni l'attente, ni le numéro ; le talon part : il porte le numéro.
      expect(screen.queryAllByText('N° 0003')).toHaveLength(talon ? 2 : 0)
      expect(screen.queryByText('N° ····')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
      // La fiche du film : son enseigne, que le billet n'a pas.
      expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE)
      expect(screen.getByText('Salle · Les essentiels')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
    })

    // Le jumeau de `rangerLeBillet` dès l'écriture : le retour ne se confiait qu'à la fin de la
    // séquence. Un membre venu de la séance qui touche « Retour » pendant le tampon reculait vers une
    // année muette : ni « +1 », ni billets qui roulent, ni verdict guetté. Mutation : le retour confié
    // seulement au bout de la séquence.
    it('« Retour » vers l’année pendant la séquence : l’année dit quand même « +1 film vu »', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { routes } = serveur({ voyage: HORS_IA, entree: NEUVE, boite: BOITE_DE_TROIS })
      monterVoyage(['/voyage/1897', { pathname: billet(FAUCON), state: { depuis: 'annee' } }], routes)
      fireEvent.click(await composter())
      await tamponne()
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
      expect(await lAnnee()).toBeInTheDocument()
      expect(await screen.findByText('+1 film vu')).toHaveAttribute('role', 'status')
      // La séquence quittée ne navigue plus : l'année reste, seule.
      await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE)
      expect(screen.getAllByRole('region', { name: 'L’année 1897' })).toHaveLength(1)
    })

    // Mutation : la garde « montée » ignorée après la descente du marteau (le téléphone vibrerait pour
    // un billet quitté).
    it('quitté pendant que le marteau descend, le téléphone ne vibre pas', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const vibrate = vibreur()
      const { routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      monterVoyage([`/voyage/1897/films/${FAUCON.id}`, billet(FAUCON)], {
        ...routes,
        'GET /api/reference/films/963/realisateurs': () => json({ realisateurs: [] }),
      })
      fireEvent.click(await composter())
      await waitFor(() => expect(document.querySelector('[data-frappe="descend"]')).not.toBeNull())
      fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
      expect(await screen.findByText('Salle · Les essentiels')).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(DUREE_DU_COMPOSTAGE)
      expect(vibrate).not.toHaveBeenCalled()
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
    })

    // Mutations : la garde du calme retirée de la séquence (l'année n'arrive qu'après le tampon) ; la
    // vibration jouée avant elle ; la boîte lue au calme ; `rangerLeBillet` oublié au calme.
    it('au calme, range le billet et revient aussitôt, sans tampon ni vibration', async () => {
      calme()
      const vibrate = vibreur()
      const { routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      const { requetes } = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      expect(await lAnnee()).toBeInTheDocument()
      expect(billetRange(SESSION.user.id)).toBe(NEUVE.entry.id)
      expect(vibrate).not.toHaveBeenCalled()
      expect(compte(requetes, BOITE)).toBe(0)
    })

    // Mutation : la séquence qui attend la lecture de la boîte avant de rouler.
    it('le réseau lent n’arrête pas le billet : « N° ···· », puis l’année', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { routes } = serveur({ entree: NEUVE, boite: () => new Promise<Response>(() => undefined) })
      const { requetes } = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await composter())
      await tamponne()
      await vi.advanceTimersByTimeAsync(FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + 20)
      expect(compte(requetes, BOITE)).toBe(1)
      expect(screen.getByText('N° ····')).toBeInTheDocument()
      await vi.advanceTimersByTimeAsync(FRAPPE.avantTalon + FRAPPE.talon)
      expect(await lAnnee()).toBeInTheDocument()
      expect(billetRange(SESSION.user.id)).toBe(NEUVE.entry.id)
    })

    // Mutation : la garde `envoi` relâchée à `onSettled`, avant la navigation (le bouton se rallume
    // pendant le tampon).
    it('deux touchers pendant la séquence n’écrivent qu’une fois', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { etat, routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      monterVoyage(billet(FAUCON), routes)
      const bouton = await composter()
      fireEvent.click(bouton)
      await tamponne()
      expect(bouton).toBeDisabled()
      fireEvent.click(bouton)
      await vi.advanceTimersByTimeAsync(FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + FRAPPE.avantTalon + 20)
      expect(bouton).toBeDisabled()
      fireEvent.click(bouton)
      await vi.advanceTimersByTimeAsync(FRAPPE.talon)
      expect(await lAnnee()).toBeInTheDocument()
      expect(etat.creations).toBe(1)
    })

    /**
     * Ce que le billet offre sous le tampon : le dateur, le poinçon, les cartons, la remarque. Lu à
     * chaque fois : rien n'est gardé d'un rendu à l'autre.
     */
    const champs = () => ({
      hier: screen.getByRole('button', { name: 'Hier' }),
      veille: screen.getByRole('button', { name: 'Jour précédent' }),
      quatre: screen.getByRole('button', { name: '4 sur 10' }),
      carton: screen.getByRole('button', { name: CATALOGUE.reactions[0]!.phrase }),
      remarque: screen.getByLabelText('Remarque privée'),
    })
    /** Ce que le brouillon montre : le jour dit, la note lue, le carton choisi, la remarque. */
    const montre = () => ({
      jour: within(screen.getByRole('group', { name: 'Date du visionnage' })).getByText(/\d{4}$/, { selector: 'p' }).textContent,
      note: screen.getByRole('group', { name: 'Note sur 10' }).nextElementSibling!.querySelector('b')!.textContent,
      carton: champs().carton.getAttribute('aria-pressed'),
      remarque: (champs().remarque as HTMLTextAreaElement).value,
    })
    /** Le geste brut sur chaque champ, tel que jsdom le livre (il ne connaît pas `inert`). */
    const toutToucher = () => {
      const c = champs()
      fireEvent.click(c.hier)
      fireEvent.click(c.veille)
      fireEvent.click(c.quatre)
      fireEvent.click(c.carton)
      fireEvent.change(c.remarque, { target: { value: 'écrit sous le tampon' } })
    }
    /**
     * Le clavier : jsdom donne le focus à un élément inerte, un navigateur non (constaté dans Chromium).
     * Le geste est donc tenté comme un navigateur le livrerait : rien n'atteint ce qu'un `inert` couvre.
     */
    const prendLeFocus = (e: HTMLElement) => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      if (!e.closest('[inert]')) e.focus()
      return document.activeElement === e
    }
    const VIDE = { jour: formatDateVisionnage(jourLocal()), note: '—', carton: 'false', remarque: '' }

    // Mutation : la garde de `retoucher` retirée (`if (envoi.current) return`) : la note, la date, le
    // carton et la remarque changent à l'écran sous le tampon, sans être écrits.
    it('sous le tampon, toucher le dateur, la note, un carton ou la remarque ne change rien', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { etat, routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      monterVoyage(billet(FAUCON), routes)
      await screen.findByRole('button', { name: CATALOGUE.reactions[0]!.phrase })
      expect(montre()).toEqual(VIDE)
      fireEvent.click(await composter())
      // Dès le toucher, pendant l'envoi : le brouillon est parti.
      toutToucher()
      expect(montre()).toEqual(VIDE)
      await tamponne()
      toutToucher()
      expect(montre()).toEqual(VIDE)
      await vi.advanceTimersByTimeAsync(FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + FRAPPE.avantTalon + 20)
      toutToucher()
      expect(montre()).toEqual(VIDE)
      await vi.advanceTimersByTimeAsync(FRAPPE.talon)
      expect(await lAnnee()).toBeInTheDocument()
      expect(etat.creations).toBe(1)
    })

    // Mutation : `INERTE` retiré du billet (`{...(occupe ? INERTE : null)}`) : le focus entre sous le
    // tampon, et le clavier avec lui.
    it('sous le tampon, aucun champ du billet ne prend le focus ; « Retour » reste vivant', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      monterVoyage(billet(FAUCON), routes)
      await screen.findByRole('button', { name: CATALOGUE.reactions[0]!.phrase })
      // Au repos, chacun le prend : sans quoi la suite ne prouverait rien.
      for (const champ of Object.values(champs())) expect(prendLeFocus(champ)).toBe(true)
      fireEvent.click(await composter())
      for (const champ of Object.values(champs())) expect(prendLeFocus(champ)).toBe(false)
      await tamponne()
      for (const champ of Object.values(champs())) expect(prendLeFocus(champ)).toBe(false)
      await vi.advanceTimersByTimeAsync(FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + FRAPPE.avantTalon + 20)
      for (const champ of Object.values(champs())) expect(prendLeFocus(champ)).toBe(false)
      // Quitter le billet pendant le tampon est voulu (`CLAUDE.md`) : « Retour » n'est pas couvert.
      expect(prendLeFocus(screen.getByRole('button', { name: 'Retour' }))).toBe(true)
    })

    // Mutations : `onError: relacher` retiré de `composter` (le billet resterait inerte et figé après
    // un refus) ; `INERTE` posé sans condition.
    it('un enregistrement refusé rend le billet : les champs reprennent le focus et les gestes', async () => {
      const { routes } = serveur()
      monterVoyage(billet(FAUCON), { ...routes, [JOURNAL]: () => json({ code: 'CONFLICT', message: 'Déjà noté aujourd’hui.', retryable: false }, 409) })
      await screen.findByRole('button', { name: CATALOGUE.reactions[0]!.phrase })
      fireEvent.click(await composter())
      for (const champ of Object.values(champs())) expect(prendLeFocus(champ)).toBe(false)
      expect(await screen.findByRole('alert')).toHaveTextContent('Déjà noté aujourd’hui.')
      for (const champ of Object.values(champs())) expect(prendLeFocus(champ)).toBe(true)
      fireEvent.click(champs().quatre)
      fireEvent.click(champs().carton)
      fireEvent.change(champs().remarque, { target: { value: 'corrigé après le refus' } })
      expect(montre()).toEqual({ ...VIDE, note: '4', carton: 'true', remarque: 'corrigé après le refus' })
    })

    // Mutations : le tampon joué en correction (l'année n'arriverait qu'après lui) ; le numéro pris
    // dans tout le journal (« N° 0003 ») ; le billet corrigé rangé comme un neuf.
    it('la correction dit son numéro et ne tamponne pas', async () => {
      const kane = kaneVu()
      const { routes } = serveur({ boite: [vu('e-c', 1899, '2026-09-15'), kane, vu('e-x', 2010, '2026-08-20'), vu('e-a', 1896, '2026-08-01')] })
      monterVoyage({ pathname: billet(KANE, '/corriger'), state: { item: kane } }, { ...routes, 'PATCH /api/me/journal/e-kane': () => json(kaneVu()) })
      expect(await screen.findByText('N° 0002')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Corriger le billet/ }))
      expect(await lAnnee()).toBeInTheDocument()
      expect(billetRange(SESSION.user.id)).toBeNull()
    })
  })

  describe('le poinçon', () => {
    // Mutations : seul le trou de la note percé ; la note lue oubliée.
    it('perce les trous de 1 à la note, et la lit en grand', async () => {
      const { routes } = serveur()
      monterVoyage(billet(FAUCON), routes)
      const poincon = await screen.findByRole('group', { name: 'Note sur 10' })
      expect(poincon.querySelectorAll('[data-perce="true"]')).toHaveLength(0)
      fireEvent.click(within(poincon).getByRole('button', { name: '4 sur 10' }))
      expect([...poincon.querySelectorAll('[data-perce="true"]')].map((b) => b.textContent)).toEqual(['1', '2', '3', '4'])
      expect(poincon.nextElementSibling).toHaveTextContent('4sur 10')
      fireEvent.click(screen.getByRole('button', { name: 'sans note' }))
      expect(poincon.querySelectorAll('[data-perce="true"]')).toHaveLength(0)
      expect(poincon.nextElementSibling).toHaveTextContent('—sur 10')
    })

    // Mutations : la garde du calme retirée (des confettis au calme) ; les confettis comptés depuis 1
    // (chaque trou déjà percé relâcherait le sien).
    it('lâche un confetti par trou nouvellement percé, jamais au calme', async () => {
      const animate = animer()
      const { routes } = serveur()
      const vue = monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await screen.findByRole('button', { name: '3 sur 10' }))
      expect(animate).toHaveBeenCalledTimes(3)
      fireEvent.click(screen.getByRole('button', { name: '5 sur 10' }))
      expect(animate).toHaveBeenCalledTimes(5)
      vue.unmount()

      calme()
      animate.mockClear()
      monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await screen.findByRole('button', { name: '3 sur 10' }))
      expect(screen.getByRole('button', { name: '3 sur 10' })).toHaveAttribute('aria-pressed', 'true')
      expect(animate).not.toHaveBeenCalled()
    })
  })

  // Mutation : la route déclarée hors de `<Coque />` (la barre disparaîtrait).
  it('garde la barre d’onglets, l’onglet Voyage marqué', async () => {
    const { routes } = serveur()
    monterVoyage(billet(FAUCON), routes)
    await composter()
    const onglets = screen.getByRole('navigation', { name: 'Onglets' })
    expect(within(onglets).getByRole('link', { name: 'Voyage' })).toHaveAttribute('aria-current', 'page')
  })

  // Mutation : le cachet de la maquette (« T ») en dur.
  it('le cachet de cire de la remarque porte l’initiale du membre', async () => {
    const { routes } = serveur()
    monterVoyage(billet(FAUCON), routes)
    const remarque = await screen.findByRole('textbox', { name: 'Remarque privée' })
    const rubrique = remarque.parentElement!
    expect(within(rubrique).getByText(SESSION.user.pseudo.charAt(0).toUpperCase())).toBeInTheDocument()
    expect(within(rubrique).getByText('privée : toi seul la lis')).toBeInTheDocument()
  })

  // Le dessin du billet est une section qu'un monde peut composer (`GabaritsDesPages.billetDeSeance`).
  // Sans gabarit, le défaut reste : tous les tests plus haut, montés sur 1890, qui n'en a aucun. Le
  // monde de test est 1890, auquel on prête un dessin qui dit ce qu'il reçoit.
  describe('le dessin du monde', () => {
    let remettre = () => undefined as void
    afterEach(() => remettre())
    const preter = (pages: typeof PAGES_1890, gabarits: typeof PAGES_1890.gabarits) => {
      const avant = pages.gabarits
      pages.gabarits = gabarits
      remettre = () => void (pages.gabarits = avant)
    }

    /** Un dessin de monde : il dit ce qu'il a reçu, tend deux gestes, et rend la suppression de la page. */
    const DessinDuMonde = (p: PropsBilletDeSeance) => (
      <section aria-label="Le billet du monde">
        <div ref={p.support}>
          <p data-testid="film">{`${p.film.titre} | ${p.film.realisateur ?? 'sans réalisateur'} | ${p.film.sortie} | ${p.film.couverture ?? 'sans affiche'} | gare de ${p.annee} | ${p.pseudo}`}</p>
          <p data-testid="etat">{`${p.correction ? 'correction' : 'création'} | ${p.etape} | ${p.tirage === null ? 'immobile' : 'roule'} | numéro ${p.numero ?? 'aucun'} | ${p.occupe ? 'occupé' : 'libre'} | ${p.refus ?? 'sans refus'}`}</p>
          <p data-testid="brouillon">{`${p.brouillon.date} | ${p.brouillon.note ?? 'sans note'} | ${p.brouillon.reactions.join(',')} | ${p.brouillon.remarque}`}</p>
          <p data-testid="reactions">{p.reactions.catalogue ? `${p.reactions.catalogue.length} réactions` : p.reactions.panne ? 'en panne' : 'pas encore lues'}</p>
        </div>
        <button type="button" onClick={() => p.onRetoucher((b) => ({ ...b, note: 6, remarque: 'Écrit du monde.' }))}>
          Noter six
        </button>
        <button type="button" onClick={p.reactions.onReessayer}>
          Relire les réactions
        </button>
        <button type="button" onClick={p.onComposter}>
          Composter du monde
        </button>
        <div data-testid="suppression">{p.suppression}</div>
      </section>
    )
    const dit = (quoi: string) => screen.getByTestId(quoi).textContent

    // Mutations : la page qui monte `BilletDeSeance` sans passer par `gabaritDe` ; le film, le pseudo
    // ou le catalogue que la page ne passerait plus ; `onRetoucher` qui n'écrirait pas le brouillon ; la
    // garde du double toucher retirée (deux écritures partiraient du dessin du monde).
    it('monte le dessin du monde à la place du billet, lui passe ce que la page a lu, et garde l’écriture', async () => {
      calme()
      preter(PAGES_1890, { billetDeSeance: DessinDuMonde })
      const { etat, routes } = serveur()
      let envoye: Record<string, unknown> | null = null
      monterVoyage(billet(FAUCON), {
        ...routes,
        [JOURNAL]: (init) => {
          envoye = corps(init)
          return routes[JOURNAL]()
        },
      })
      await screen.findByRole('region', { name: 'Le billet du monde' })
      expect(dit('film')).toBe(`Le Faucon maltais | John Huston | 1897 | ${FAUCON.cover_url ?? 'sans affiche'} | gare de 1897 | ${SESSION.user.pseudo}`)
      expect(dit('etat')).toBe('création | repos | immobile | numéro aucun | libre | sans refus')
      await waitFor(() => expect(dit('reactions')).toBe(`${CATALOGUE.reactions.length} réactions`))
      // Rien du billet par défaut : ni sa tête, ni son dateur, ni son bouton.
      expect(screen.queryByText('Enregistrer un visionnage')).toBeNull()
      expect(screen.queryByRole('group', { name: 'Date du visionnage' })).toBeNull()
      expect(screen.queryByRole('button', { name: /Tamponner/ })).toBeNull()
      expect(screen.getByTestId('suppression')).toBeEmptyDOMElement()
      fireEvent.click(screen.getByRole('button', { name: 'Noter six' }))
      expect(dit('brouillon')).toBe(`${jourLocal()} | 6 |  | Écrit du monde.`)
      const bouton = screen.getByRole('button', { name: 'Composter du monde' })
      act(() => {
        bouton.click()
        bouton.click()
      })
      expect(await lAnnee()).toBeInTheDocument()
      expect(etat.creations).toBe(1)
      expect(envoye).toMatchObject({ finished_at: jourLocal(), rating: 6, comment: 'Écrit du monde.' })
    })

    // La séquence reste à la page : le dessin n'en voit que l'étape, le tirage et le numéro. Mutations :
    // l'étape, le tirage ou le numéro que la page ne passerait plus ; `support` non passé (rien n'est
    // amené à l'écran) ; la séquence jouée par le dessin par défaut seulement.
    it('la page joue le compostage sous le dessin du monde : l’étape, le numéroteur, le numéro, puis l’année', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const amener = vi.fn()
      Object.defineProperty(Element.prototype, 'scrollIntoView', { value: amener, configurable: true, writable: true })
      preter(PAGES_1890, { billetDeSeance: DessinDuMonde })
      const { routes } = serveur({ entree: NEUVE, boite: BOITE_DE_TROIS })
      monterVoyage(billet(FAUCON), routes)
      fireEvent.click(await screen.findByRole('button', { name: 'Composter du monde' }))
      await waitFor(() => expect(dit('etat')).toBe('création | descend | immobile | numéro aucun | occupé | sans refus'))
      expect(amener).toHaveBeenCalled()
      // Sous le tampon, le brouillon parti ne se retouche plus, d'où que vienne le geste.
      fireEvent.click(screen.getByRole('button', { name: 'Noter six' }))
      expect(dit('brouillon')).toBe(`${jourLocal()} | sans note |  | `)
      await vi.advanceTimersByTimeAsync(FRAPPE.descend + 10)
      expect(dit('etat')).toContain('| pose |')
      await vi.advanceTimersByTimeAsync(FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * 3)
      expect(dit('etat')).toContain('création | numerote | roule |')
      await vi.advanceTimersByTimeAsync(FRAPPE.tirage * FRAPPE.tirages)
      expect(dit('etat')).toBe('création | numerote | immobile | numéro 3 | occupé | sans refus')
      await vi.advanceTimersByTimeAsync(FRAPPE.avantTalon)
      expect(dit('etat')).toBe('création | talon | immobile | numéro 3 | occupé | sans refus')
      expect(screen.queryByRole('region', { name: 'L’année 1897' })).toBeNull()
      await vi.advanceTimersByTimeAsync(FRAPPE.talon)
      expect(await lAnnee()).toBeInTheDocument()
    })

    // Mutations : `correction` ou le numéro de la boîte que la page ne passerait plus ; la suppression
    // montée hors du dessin, ou jamais ; le refus de l'écriture non passé ; le billet resté occupé
    // après un refus.
    it('en correction, le dessin du monde reçoit le numéro lu dans la boîte, le refus de l’API et « Supprimer » tout monté', async () => {
      const kane = kaneVu()
      preter(PAGES_1890, { billetDeSeance: DessinDuMonde })
      const { routes } = serveur({ boite: [vu('e-c', 1899, '2026-09-15'), kane, vu('e-a', 1896, '2026-08-01')] })
      let effacements = 0
      monterVoyage([`/voyage/1897/films/${KANE.id}`, { pathname: billet(KANE, '/corriger'), state: { item: kane } }], {
        ...routes,
        'GET /api/reference/films/15/realisateurs': () => json({ realisateurs: [] }),
        'PATCH /api/me/journal/e-kane': () => json({ code: 'CONFLICT', message: 'Ce visionnage a changé ailleurs.', retryable: false }, 409),
        'DELETE /api/me/journal/e-kane': () => ((effacements += 1), new Response(null, { status: 204 })),
      })
      await screen.findByRole('region', { name: 'Le billet du monde' })
      await waitFor(() => expect(dit('etat')).toBe('correction | repos | immobile | numéro 2 | libre | sans refus'))
      expect(dit('brouillon')).toBe('2026-09-01 | 9 | adore | Une remarque privée, rien qu’à moi.')
      fireEvent.click(screen.getByRole('button', { name: 'Noter six' }))
      fireEvent.click(screen.getByRole('button', { name: 'Composter du monde' }))
      await waitFor(() => expect(dit('etat')).toBe('correction | repos | immobile | numéro 2 | libre | Ce visionnage a changé ailleurs.'))
      // « Supprimer » est celui de la page, rendu par le dessin, là où il le pose.
      const suppression = within(screen.getByTestId('suppression'))
      fireEvent.click(suppression.getByRole('button', { name: 'Supprimer' }))
      expect(suppression.getByText(/Supprimer ce visionnage \?/)).toBeInTheDocument()
      fireEvent.click(suppression.getByRole('button', { name: 'Supprimer' }))
      await waitFor(() => expect(effacements).toBe(1))
    })

    // Mutation : la panne du catalogue ou son « Réessayer » que la page ne passerait plus.
    it('dit au dessin du monde la panne des réactions, et son rappel les relit', async () => {
      preter(PAGES_1890, { billetDeSeance: DessinDuMonde })
      const { routes } = serveur()
      let essais = 0
      monterVoyage(billet(FAUCON), {
        ...routes,
        [REACTIONS]: () => ((essais += 1) === 1 ? json({ code: 'INTERNAL', message: 'Les réactions ne répondent pas.', retryable: false }, 500) : json(CATALOGUE)),
      })
      await screen.findByRole('region', { name: 'Le billet du monde' })
      await waitFor(() => expect(dit('reactions')).toBe('en panne'))
      fireEvent.click(screen.getByRole('button', { name: 'Relire les réactions' }))
      await waitFor(() => expect(dit('reactions')).toBe(`${CATALOGUE.reactions.length} réactions`))
    })

    // Le gabarit est celui du monde de l'année : prêté au monde « à venir », il ne change rien à 1890.
    // Mutation : le gabarit lu dans un autre monde que celui de l'année.
    it('ne prend que le dessin du monde de l’année : un autre monde garde le billet par défaut', async () => {
      preter(PAGES_A_VENIR, { billetDeSeance: DessinDuMonde })
      const { routes } = serveur()
      monterVoyage(billet(FAUCON), routes)
      expect(await composter()).toBeInTheDocument()
      expect(screen.getByText('Enregistrer un visionnage')).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Le billet du monde' })).toBeNull()
    })
  })
})
