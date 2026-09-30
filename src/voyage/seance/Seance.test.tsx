import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FichePrete, FilmSeance, Seance, Voyage } from '../../api/voyage'
import { RELECTURES } from '../relecture'
import { monterVoyage } from '../../test/pageVoyage'
import { json } from '../../test/serveur'
import { filmDeSalle, fichePrete, morceau, salle, seance, voyage1890 } from '../../test/voyage'

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

const FAUCON = filmDeSalle({ id: 'f-faucon', tmdb_id: 963, title: 'Le Faucon maltais', etat: 'a_demander' })
const PLEX = filmDeSalle({ id: 'f-plex', tmdb_id: 701, title: 'Un film sur le Plex', etat: 'sur_le_plex' })
const KANE = filmDeSalle({ id: 'f-kane', tmdb_id: 15, title: 'Citizen Kane', etat: 'vu', note: 9 })
const BOBINE = { tmdb_id: 511, title: 'La Sortie de l’usine', duree_min: 1, cover_url: null, plex_url: null, etat: 'a_demander' as const }
const PROGRAMME = filmDeSalle({
  id: 'f-prog',
  tmdb_id: 510,
  title: 'Le programme Lumière',
  etat: 'a_demander',
  programme: { duree_min: 2, bobines: [BOBINE, { ...BOBINE, tmdb_id: 512, title: 'Le Repas de bébé', etat: 'vu' }] },
})
const ESSENTIELS = salle({ id: 's-ess', nom: 'Les essentiels', contexte: null, films: [FAUCON, PLEX, KANE, PROGRAMME] })

/** Le court de ce soir : une bobine précise du programme (l'API rend alors les titre, identifiant et état de la bobine). */
const COURT: FilmSeance = { ...morceau(PROGRAMME), tmdb_id: 511, title: 'La Sortie de l’usine', bobine: { tmdb_id: 511, title: 'La Sortie de l’usine' } }
const ID = 'b2c3d4e5-2345-4bcd-8e0f-123456789abc'
const PROPOSEE = seance({ id: ID, rang: 2, long: morceau(FAUCON), court: COURT, anecdote: 'Une anecdote pour le générique.' })
const PRISE: Seance = { ...PROPOSEE, statut: 'prise' }

/** Une fiche prête de 1897 sans ticket ni verdict : chaque test pose ses séances. */
const fiche = (s: Partial<FichePrete> = {}) =>
  fichePrete({
    annee: 1897,
    ticket: null,
    maturite: null,
    generique: null,
    seances: [PROPOSEE],
    seance_en_cours: false,
    salles: [ESSENTIELS],
    pistes: [],
    demande_salle: null,
    podium: [null, null, null],
    ...s,
  })

const ANNEE = 'GET /api/me/voyage/annees/1897'
const CARTE = 'GET /api/me/voyage'
const ROUTES = {
  [CARTE]: () => json(VOYAGE),
  [ANNEE]: () => json(fiche()),
}

const corps = (init: RequestInit) => JSON.parse(String(init.body)) as unknown
const compte = (requetes: string[], cle: string) => requetes.filter((r) => r === cle).length
const laSeance = () => screen.findByRole('region', { name: 'Ce soir à la baraque' })

describe('la séance du soir', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('le prospectus : le long et le court, leur salle et leur état, l’anecdote, et ses talons', async () => {
    monterVoyage('/voyage/1897', ROUTES)
    const zone = await laSeance()
    const prospectus = within(zone).getByRole('article', { name: 'Séance n° 2' })
    expect(within(prospectus).getByText('Le Faucon maltais')).toBeInTheDocument()
    expect(within(prospectus).getAllByText('Les essentiels · à voir')).toHaveLength(2)
    expect(within(prospectus).getByText('La Sortie de l’usine')).toBeInTheDocument()
    expect(within(prospectus).getByText('Une anecdote pour le générique.')).toBeInTheDocument()
    for (const talon of ['Prendre', 'Ignorer', 'Autre long', 'Autre court']) expect(within(prospectus).getByRole('button', { name: talon })).toBeInTheDocument()
    expect(within(prospectus).queryByText('PRISE')).toBeNull()
  })

  // Mutation : la garde `ia` retirée (le geste que l'API refuse, `403`, s'offrirait).
  it('hors IA, ni séance ni « Composer une séance »', async () => {
    monterVoyage('/voyage/1897', { ...ROUTES, [CARTE]: () => json(HORS_IA), [ANNEE]: () => json(fiche({ seances: [] })) })
    await screen.findByRole('button', { name: /^Marche 1/ })
    expect(screen.queryByRole('region', { name: 'Ce soir à la baraque' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Composer une séance' })).toBeNull()
  })

  // Le jumeau : on ne compose que dans l'année en cours (l'API rend `404` ailleurs). Mutation : la garde
  // de l'année en cours retirée.
  it('une année bouclée n’a pas de séance, même au compte IA', async () => {
    monterVoyage('/voyage/1896', { ...ROUTES, 'GET /api/me/voyage/annees/1896': () => json(fiche({ annee: 1896, seances: [] })) })
    await screen.findByRole('button', { name: /^Marche 1/ })
    expect(screen.queryByRole('button', { name: 'Composer une séance' })).toBeNull()
  })

  // Mutations : le guet coupé (l'intervalle `false`) ; le message tu à la fin d'une composition sans
  // séance neuve ; le compte des séances pris après la composition (le message ne se dirait jamais).
  it('« Composer » : un envoi, la fiche relue toutes les cinq secondes jusqu’à la fin, et sans séance neuve, le message', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let envois = 0
    let lectures = 0
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => ((lectures += 1), json(fiche({ seances: [], seance_en_cours: lectures > 1 && lectures < 4 }))),
      'POST /api/me/voyage/annees/1897/seances': () => ((envois += 1), json({ statut: 'en_preparation' }, 202)),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Composer une séance' }))
    fireEvent.click(within(zone).getByRole('button', { name: 'Composer une séance' }))
    expect(await within(zone).findByText('Le chroniqueur compose la séance…')).toBeInTheDocument()
    expect(envois).toBe(1)
    expect(compte(requetes, ANNEE)).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(compte(requetes, ANNEE)).toBe(2)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await within(zone).findByRole('alert')).toHaveTextContent('Le chroniqueur n’a pas pu composer ce soir, réessaie.')
    expect(within(zone).getByRole('button', { name: 'Composer une séance' })).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(compte(requetes, ANNEE)).toBe(4)
  })

  // Le jumeau du message : une séance neuve le tait, y compris quand le bouton revient ensuite (la
  // séance ignorée). Mutation : le message dit quelle que soit la fin (il attendrait, caché, sous la séance).
  it('« Composer » qui aboutit montre la séance neuve, sans message, même une fois ignorée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let lectures = 0
    let ignoree = false
    const neuve = () => ({ ...PROPOSEE, statut: ignoree ? ('ignoree' as const) : ('proposee' as const) })
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => ((lectures += 1), json(fiche({ seances: lectures > 2 ? [neuve()] : [], seance_en_cours: lectures === 2 }))),
      'POST /api/me/voyage/annees/1897/seances': () => json({ statut: 'en_preparation' }, 202),
      [`POST /api/me/voyage/seances/${ID}/ignorer`]: () => ((ignoree = true), json({ seance: neuve() })),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Composer une séance' }))
    await within(zone).findByText('Le chroniqueur compose la séance…')
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await within(zone).findByRole('article', { name: 'Séance n° 2' })).toBeInTheDocument()
    expect(within(zone).queryByRole('alert')).toBeNull()
    fireEvent.click(within(zone).getByRole('button', { name: 'Ignorer' }))
    expect(await within(zone).findByRole('button', { name: 'Composer une séance' })).toBeInTheDocument()
    expect(within(zone).queryByRole('alert')).toBeNull()
  })

  // Mutations : le plafond jamais atteint ; l'abandon tu ; « Réessayer » sans relecture.
  it('une séance trouvée en composition se guette, jusqu’au plafond, puis « Réessayer » reprend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', { ...ROUTES, [ANNEE]: () => json(fiche({ seances: [], seance_en_cours: true })) })
    const zone = await laSeance()
    expect(within(zone).getByText('Le chroniqueur compose la séance…')).toBeInTheDocument()
    for (let i = 0; i < RELECTURES.seance.plafond + 4; i += 1) await vi.advanceTimersByTimeAsync(RELECTURES.seance.ms)
    expect(await within(zone).findByRole('alert')).toHaveTextContent('Le chroniqueur n’a pas répondu, reviens plus tard.')
    expect(compte(requetes, ANNEE)).toBe(1 + RELECTURES.seance.plafond)
    fireEvent.click(within(zone).getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2 + RELECTURES.seance.plafond))
    expect(within(zone).queryByRole('alert')).toBeNull()
  })

  // Mutations : le refus réécrit par la page ; la garde jamais relâchée.
  it('un refus de « Composer » s’affiche tel que l’API l’a écrit, et le geste se retente', async () => {
    let envois = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ seances: [] })),
      'POST /api/me/voyage/annees/1897/seances': () => ((envois += 1), json({ code: 'VALIDATION', message: 'Il n’y a plus rien de neuf à proposer.', retryable: false }, 400)),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Composer une séance' }))
    expect(await within(zone).findByRole('alert')).toHaveTextContent('Il n’y a plus rien de neuf à proposer.')
    fireEvent.click(within(zone).getByRole('button', { name: 'Composer une séance' }))
    await waitFor(() => expect(envois).toBe(2))
  })

  // Mutations : la garde du double toucher retirée ; la péremption du Voyage retirée (la carte « Ce
  // soir » de l'accueil lit `seance_prise` sur la carte) ; le tampon sans le statut.
  it('« Prendre » deux fois vite : un seul envoi, la carte et la fiche relues, et le tampon « PRISE »', async () => {
    let envois = 0
    let prise = false
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ seances: [prise ? PRISE : PROPOSEE] })),
      [`POST /api/me/voyage/seances/${ID}/prendre`]: () => ((envois += 1), (prise = true), json({ seance: PRISE })),
    })
    const zone = await laSeance()
    const prendre = within(zone).getByRole('button', { name: 'Prendre' })
    fireEvent.click(prendre)
    fireEvent.click(prendre)
    expect(await within(zone).findByText('PRISE')).toBeInTheDocument()
    expect(envois).toBe(1)
    await waitFor(() => expect(compte(requetes, CARTE)).toBe(2))
    expect(compte(requetes, ANNEE)).toBe(2)
    // Prise, elle ne se reprend pas ; elle s'ignore ou se change encore.
    expect(within(zone).queryByRole('button', { name: 'Prendre' })).toBeNull()
    expect(within(zone).getByRole('button', { name: 'Ignorer' })).toBeInTheDocument()
  })

  // Le jumeau de « Prendre ». Mutations : la garde retirée ; `ignorer` qui prend ; la péremption retirée.
  it('« Ignorer » deux fois vite : un seul envoi, la séance s’efface et le bouton revient', async () => {
    let envois = 0
    let ignoree = false
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ seances: [{ ...PROPOSEE, statut: ignoree ? 'ignoree' : 'proposee' }] })),
      [`POST /api/me/voyage/seances/${ID}/ignorer`]: () => ((envois += 1), (ignoree = true), json({ seance: { ...PROPOSEE, statut: 'ignoree' } })),
    })
    const zone = await laSeance()
    const ignorer = within(zone).getByRole('button', { name: 'Ignorer' })
    fireEvent.click(ignorer)
    fireEvent.click(ignorer)
    expect(await within(zone).findByRole('button', { name: 'Composer une séance' })).toBeInTheDocument()
    expect(envois).toBe(1)
    await waitFor(() => expect(compte(requetes, CARTE)).toBe(2))
    expect(within(zone).queryByRole('article')).toBeNull()
  })

  // Mutations : un refus réécrit ; la garde jamais relâchée (après un refus passager, les talons ne
  // répondraient plus).
  it('un refus de « Prendre » s’affiche tel que l’API l’a écrit, et le geste se retente', async () => {
    let envois = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [`POST /api/me/voyage/seances/${ID}/prendre`]: () => ((envois += 1), json({ code: 'UPSTREAM_UNAVAILABLE', message: 'Le serveur est occupé.', retryable: true }, 503)),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Prendre' }))
    expect(await within(zone).findByRole('alert')).toHaveTextContent('Le serveur est occupé.')
    fireEvent.click(within(zone).getByRole('button', { name: 'Prendre' }))
    await waitFor(() => expect(envois).toBe(2))
  })

  // La séance rendue par l'API se pose tout de suite, sans attendre la relecture (le talon ne
  // s'offre pas une seconde fois à un toucher pendant ce temps). Mutation : la séance rendue ignorée.
  it('la séance rendue par « Prendre » et par un remplacement s’affiche avant la relecture', async () => {
    let lectures = 0
    const autre: Seance = { ...PRISE, long: morceau(PLEX) }
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      // Après la première, la fiche ne répond plus : seule la réponse de l'écriture peut changer la page.
      [ANNEE]: () => (++lectures === 1 ? json(fiche()) : new Promise<Response>(() => undefined)),
      [`POST /api/me/voyage/seances/${ID}/prendre`]: () => json({ seance: PRISE }),
      [`POST /api/me/voyage/seances/${ID}/remplacer`]: () => json({ seance: autre }),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Prendre' }))
    expect(await within(zone).findByText('PRISE')).toBeInTheDocument()
    fireEvent.click(within(zone).getByRole('button', { name: 'Autre long' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Un autre long' })).getByRole('button', { name: /Un film sur le Plex/ }))
    expect(await within(zone).findByRole('link', { name: 'Je l’ai vu : Un film sur le Plex' })).toBeInTheDocument()
  })

  // Mutations : `corpsRemplacement` sans la bobine (côté page : le candidat réduit à son `filmId`) ; le
  // morceau pris ailleurs que dans l'adresse ; le feuillet laissé ouvert.
  it('« Autre court » envoie `bobine_tmdb_id` pour une bobine, puis referme le feuillet', async () => {
    let envoye: unknown
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [`POST /api/me/voyage/seances/${ID}/remplacer`]: (init) => ((envoye = corps(init)), json({ seance: PROPOSEE })),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Autre court' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Un autre court' })
    // Jamais le long de ce soir ; la bobine vue n'est pas proposée.
    expect(within(feuillet).queryByRole('button', { name: /Le Faucon maltais/ })).toBeNull()
    expect(within(feuillet).queryByRole('button', { name: /Le Repas de bébé/ })).toBeNull()
    fireEvent.click(within(feuillet).getByRole('button', { name: /La Sortie de l’usine/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(envoye).toEqual({ morceau: 'court', film_id: 'f-prog', bobine_tmdb_id: 511 })
  })

  // Le jumeau. Mutations : « Autre long » qui ouvre les courts ; le corps d'un long qui porterait une
  // bobine ; la carte non relue (la séance prise de l'accueil garderait l'ancien long).
  it('« Autre long » propose les longs, par salle, envoie le film seul, puis la carte se relit', async () => {
    let envoye: unknown
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [`POST /api/me/voyage/seances/${ID}/remplacer`]: (init) => ((envoye = corps(init)), json({ seance: PROPOSEE })),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Autre long' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Un autre long' })
    const essentiels = within(feuillet).getByRole('region', { name: 'Les essentiels' })
    expect(within(essentiels).queryByRole('button', { name: /Le programme Lumière/ })).toBeNull()
    expect(within(essentiels).queryByRole('button', { name: /Citizen Kane/ })).toBeNull()
    fireEvent.click(within(essentiels).getByRole('button', { name: /Un film sur le Plex/ }))
    await waitFor(() => expect(envoye).toEqual({ morceau: 'long', film_id: 'f-plex' }))
    await waitFor(() => expect(compte(requetes, CARTE)).toBe(2))
  })

  // Mutation : la garde du double toucher retirée.
  it('deux touchers rapides dans « Autre long » ne remplacent qu’une fois', async () => {
    let envois = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [`POST /api/me/voyage/seances/${ID}/remplacer`]: () => ((envois += 1), json({ seance: PROPOSEE })),
    })
    fireEvent.click(within(await laSeance()).getByRole('button', { name: 'Autre long' }))
    const choix = within(await screen.findByRole('dialog', { name: 'Un autre long' })).getByRole('button', { name: /Un film sur le Plex/ })
    fireEvent.click(choix)
    fireEvent.click(choix)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((r) => setTimeout(r, 50))
    expect(envois).toBe(1)
  })

  // Mutations : le refus réécrit ; le feuillet refermé malgré le refus ; la garde jamais relâchée.
  it('un refus du remplacement s’affiche dans le feuillet, tel que l’API l’a écrit, et le choix se retente', async () => {
    let envois = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [`POST /api/me/voyage/seances/${ID}/remplacer`]: () => ((envois += 1), json({ code: 'VALIDATION', message: 'Ce film est déjà vu, ou introuvable.', retryable: false }, 400)),
    })
    fireEvent.click(within(await laSeance()).getByRole('button', { name: 'Autre long' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Un autre long' })
    fireEvent.click(within(feuillet).getByRole('button', { name: /Un film sur le Plex/ }))
    expect(await within(feuillet).findByRole('alert')).toHaveTextContent('Ce film est déjà vu, ou introuvable.')
    expect(screen.getByRole('dialog', { name: 'Un autre long' })).toBe(feuillet)
    fireEvent.click(within(feuillet).getByRole('button', { name: /Le Faucon maltais/ }))
    await waitFor(() => expect(envois).toBe(2))
  })

  // Mutation : le feuillet refermé par un rappel qui survit à sa fermeture : il reculerait une seconde
  // fois, hors de l'année.
  it('fermer le feuillet pendant l’envoi, puis la réponse : la page reste sur l’année', async () => {
    let repondre: () => void = () => undefined
    monterVoyage(['/voyage', '/voyage/1897'], {
      ...ROUTES,
      [`POST /api/me/voyage/seances/${ID}/remplacer`]: () => new Promise<Response>((r) => (repondre = () => r(json({ seance: PROPOSEE })))),
    })
    fireEvent.click(within(await laSeance()).getByRole('button', { name: 'Autre long' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Un autre long' })
    fireEvent.click(within(feuillet).getByRole('button', { name: /Un film sur le Plex/ }))
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => repondre())
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByRole('heading', { level: 1, name: '1897' })).toBeInTheDocument()
  })

  // Mutations : `?bobine=` oublié ; posé aussi sur un morceau sans bobine.
  it('« Je l’ai vu » ouvre le billet du morceau, celui de la bobine pour un court à bobine', async () => {
    monterVoyage('/voyage/1897', ROUTES)
    const zone = await laSeance()
    expect(within(zone).getByRole('link', { name: 'Je l’ai vu : La Sortie de l’usine' })).toHaveAttribute('href', '/voyage/1897/films/f-prog/billet?bobine=511')
    expect(within(zone).getByRole('link', { name: 'Je l’ai vu : Le Faucon maltais' })).toHaveAttribute('href', '/voyage/1897/films/f-faucon/billet')
  })

  // Mutation : « Je l’ai vu » offert sur un morceau déjà vu (le court vu depuis la composition).
  it('un morceau déjà vu ne s’offre plus au billet', async () => {
    const vue = seance({ id: ID, rang: 2, long: morceau(FAUCON), court: { ...COURT, etat: 'vu' } })
    monterVoyage('/voyage/1897', { ...ROUTES, [ANNEE]: () => json(fiche({ seances: [vue] })) })
    const zone = await laSeance()
    expect(within(zone).getByRole('link', { name: 'Je l’ai vu : Le Faucon maltais' })).toBeInTheDocument()
    expect(within(zone).queryByRole('link', { name: 'Je l’ai vu : La Sortie de l’usine' })).toBeNull()
    expect(within(zone).getByText('Les essentiels · vu')).toBeInTheDocument()
  })

  // Mutation : les séances passées sans `seancesPassees` (la récente y serait aussi), ou dépliées.
  it('les séances passées se replient, sans la séance de ce soir', async () => {
    const ancienne = seance({ id: 'a1a1a1a1-1111-4111-8111-111111111111', rang: 1, statut: 'prise', long: { ...morceau(KANE) }, composee_le: '2026-09-20T20:00:00.000Z' })
    monterVoyage('/voyage/1897', { ...ROUTES, [ANNEE]: () => json(fiche({ seances: [PROPOSEE, ancienne] })) })
    const zone = await laSeance()
    const passees = within(zone).getByText('Séances passées').closest('details')!
    expect(passees).not.toHaveAttribute('open')
    expect(within(passees).getByText('Citizen Kane · 20 septembre 2026 · vue')).toBeInTheDocument()
    expect(within(passees).queryByText(/Le Faucon maltais/)).toBeNull()
  })

  // Aucun appel au chroniqueur sans geste : la péremption qui suit une écriture ne relance pas le
  // contexte d'une salle en train de s'écrire. Mutation : `resetQueries` au lieu d'`invalidateQueries`.
  it('« Prendre » pendant qu’un contexte s’écrit ne le redemande pas', async () => {
    let contextes = 0
    let prendre: () => void = () => undefined
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      'POST /api/me/voyage/annees/1897/salles/s-ess/contexte': () => ((contextes += 1), new Promise<Response>(() => undefined)),
      [`POST /api/me/voyage/seances/${ID}/prendre`]: () => new Promise<Response>((r) => (prendre = () => r(json({ seance: PRISE })))),
    })
    const zone = await laSeance()
    fireEvent.click(within(zone).getByRole('button', { name: 'Prendre' }))
    fireEvent.click(screen.getByRole('button', { name: /Le contexte de la salle/ }))
    await screen.findByRole('dialog', { name: /Salle/ })
    await waitFor(() => expect(contextes).toBe(1))
    await act(async () => prendre())
    await waitFor(() => expect(compte(requetes, CARTE)).toBe(2))
    await new Promise((r) => setTimeout(r, 50))
    expect(contextes).toBe(1)
  })
})
