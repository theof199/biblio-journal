import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { cles } from '../../api/cles'
import type { FichePrete, Voyage } from '../../api/voyage'
import { RELECTURES } from '../relecture'
import { monterVoyage } from '../../test/pageVoyage'
import { json } from '../../test/serveur'
import { filmDeSalle, fichePrete, salle, voyage1890 } from '../../test/voyage'

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

const KANE = filmDeSalle({ id: 'f-kane', tmdb_id: 15, title: 'Citizen Kane', etat: 'vu', note: 9 })
const FAUCON = filmDeSalle({ id: 'f-faucon', tmdb_id: 963, title: 'Le Faucon maltais', etat: 'a_demander', note: null })
const PERDU = filmDeSalle({ id: 'f-perdu', tmdb_id: 700, title: 'Une vue perdue', etat: 'introuvable', note: null })
const PLEX = filmDeSalle({ id: 'f-plex', tmdb_id: 701, title: 'Sur le Plex', etat: 'sur_le_plex', note: null })
const NOUVEAU = filmDeSalle({ id: 'f-neuf', tmdb_id: 702, title: 'Un film de la fournée', etat: 'a_demander', note: null })

const CONTEXTE = 'Un contexte déjà écrit, que rien ne redemande.'
const ESSENTIELS = salle({ id: 's-ess', nom: 'Les essentiels', raison_d_etre: 'Ce qu’il ne fallait pas manquer.', contexte: CONTEXTE, films: [KANE, FAUCON] })
const AILLEURS = salle({ id: 's-ail', nom: 'Ailleurs cette année-là', raison_d_etre: 'Ce qui ne rentre nulle part.', contexte: null, films: [PLEX] })
const COMPLETE = salle({ id: 's-comp', nom: 'Les vues complètes', raison_d_etre: 'Tout y est vu.', contexte: null, films: [KANE, PERDU] })

const PISTES = [
  { nom: 'Le cinéma muet allemand', raison: 'Expressionnisme et ombres.' },
  { nom: 'Les débuts du technicolor', raison: 'La couleur s’installe.' },
]

/** Une fiche prête de 1897 sans ticket, verdict ni séance : chaque test pose les salles qu'il lit. */
const fiche = (s: Partial<FichePrete> = {}) =>
  fichePrete({
    annee: 1897,
    ticket: null,
    maturite: null,
    generique: null,
    seances: [],
    seance_en_cours: false,
    salles: [ESSENTIELS, AILLEURS],
    pistes: PISTES,
    demande_salle: null,
    ...s,
  })

const ANNEE = 'GET /api/me/voyage/annees/1897'
const ROUTES = {
  'GET /api/me/voyage': () => json(VOYAGE),
  [ANNEE]: () => json(fiche()),
}

const corps = (init: RequestInit) => JSON.parse(String(init.body)) as unknown
const compte = (requetes: string[], cle: string) => requetes.filter((r) => r === cle).length
const laSalle = (nom: string) => screen.findByRole('region', { name: `Salle ${nom}` })

describe('les salles d’une année', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutations : `porteDeLEtagere(…, true)` ; `NouvelleSalle` sans la garde `ia` ; `contexteLisible(…, true)`.
  it('hors IA : ni « En voir plus », ni salle nouvelle, ni contexte à écrire ; le contexte écrit se lit', async () => {
    monterVoyage('/voyage/1897', { ...ROUTES, 'GET /api/me/voyage': () => json(HORS_IA) })
    const essentiels = await laSalle('Les essentiels')
    const ailleurs = screen.getByRole('region', { name: 'Salle Ailleurs cette année-là' })
    expect(screen.queryByRole('button', { name: 'En voir plus' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeNull()
    expect(within(ailleurs).queryByRole('button', { name: /Le contexte de la salle/ })).toBeNull()
    expect(within(ailleurs).getByText('Ce qui ne rentre nulle part.')).toBeInTheDocument()
    expect(within(essentiels).getByRole('button', { name: /Le contexte de la salle/ })).toBeInTheDocument()
  })

  // Le jumeau, au compte IA : les gestes y sont. Mutation : `porteDeLEtagere(…, false)`, `contexteLisible(…, false)`.
  it('au compte IA : « En voir plus », la salle nouvelle et le contexte à écrire', async () => {
    monterVoyage('/voyage/1897', ROUTES)
    const ailleurs = await laSalle('Ailleurs cette année-là')
    expect(within(ailleurs).getByRole('button', { name: 'En voir plus' })).toBeInTheDocument()
    expect(within(ailleurs).getByRole('button', { name: /Le contexte de la salle/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeInTheDocument()
  })

  // Mutation : `NouvelleSalle` réservée à l'année en cours (la maquette des pages la garde à une année bouclée).
  it('une année bouclée garde « Ouvrir une nouvelle salle »', async () => {
    monterVoyage('/voyage/1896', { ...ROUTES, 'GET /api/me/voyage/annees/1896': () => json(fiche({ annee: 1896 })) })
    await screen.findByRole('heading', { level: 1, name: '1896' })
    expect(screen.getByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeInTheDocument()
  })

  // Mutations : le tampon sans `salleComplete` ; le lien vers `/suivis/films/…` ; le mot de l'introuvable pris ailleurs que dans le monde.
  it('une salle complète porte « COMPLET » ; un film ouvre sa fiche du Voyage ; un perdu dit le mot du monde', async () => {
    monterVoyage('/voyage/1897', { ...ROUTES, [ANNEE]: () => json(fiche({ salles: [ESSENTIELS, COMPLETE] })) })
    const complete = await laSalle('Les vues complètes')
    const essentiels = screen.getByRole('region', { name: 'Salle Les essentiels' })
    expect(within(complete).getByText('COMPLET')).toBeInTheDocument()
    expect(within(essentiels).queryByText('COMPLET')).toBeNull()
    expect(within(essentiels).getByRole('link', { name: 'Citizen Kane, vu · 9/10' })).toHaveAttribute('href', '/voyage/1897/films/f-kane')
    expect(within(essentiels).getByRole('link', { name: 'Le Faucon maltais, à voir' })).toHaveAttribute('href', '/voyage/1897/films/f-faucon')
    expect(within(complete).getByRole('link', { name: 'Une vue perdue, perdu' })).toHaveAttribute('href', '/voyage/1897/films/f-perdu')
    expect(within(complete).getByText('1 vu sur 2')).toBeInTheDocument()
  })

  // Mutation : les ampoules allumées sans `ampoules(salle)` (toutes, ou l'introuvable compté).
  it('allume une ampoule par film vu, et pas pour un perdu', async () => {
    monterVoyage('/voyage/1897', { ...ROUTES, [ANNEE]: () => json(fiche({ salles: [COMPLETE] })) })
    const complete = await laSalle('Les vues complètes')
    const allumees = [...complete.querySelectorAll('[data-allumee]')].map((i) => i.getAttribute('data-allumee'))
    expect(allumees).toEqual(['true', 'false'])
  })

  // Mutations : la garde du double toucher retirée ; la salle non marquée « se remplit » après le `202`
  // (rien ne se relirait) ; l'intervalle jamais posé.
  it('« En voir plus » : un seul envoi pour deux touchers, puis la fiche relue toutes les trois secondes jusqu’à la fournée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let envois = 0
    let lectures = 0
    const pleine = salle({ ...AILLEURS, fournee_en_cours: false, films: [PLEX, NOUVEAU] })
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => {
        lectures += 1
        if (lectures === 1) return json(fiche())
        return json(fiche({ salles: [ESSENTIELS, lectures < 4 ? { ...AILLEURS, fournee_en_cours: true } : pleine] }))
      },
      'POST /api/me/voyage/salles/s-ail/plus': () => ((envois += 1), json({ statut: 'en_preparation' }, 202)),
    })
    const ailleurs = await laSalle('Ailleurs cette année-là')
    const bouton = within(ailleurs).getByRole('button', { name: 'En voir plus' })
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    expect(await within(ailleurs).findByText('La salle se remplit…')).toBeInTheDocument()
    expect(envois).toBe(1)
    expect(compte(requetes, ANNEE)).toBe(1)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(compte(requetes, ANNEE)).toBe(2)
    await vi.advanceTimersByTimeAsync(3_000)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(await within(ailleurs).findByRole('link', { name: /Un film de la fournée/ })).toBeInTheDocument()
    expect(compte(requetes, ANNEE)).toBe(4)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(compte(requetes, ANNEE)).toBe(4)
  })

  // Mutation : le guet réservé à la fournée demandée ici : la page rouverte pendant l'écriture (le
  // retour d'un film) laisserait la salle se remplir pour toujours.
  it('une salle trouvée en train de se remplir se relit aussi, jusqu’à la fournée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let lectures = 0
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => ((lectures += 1), json(fiche({ salles: [ESSENTIELS, { ...AILLEURS, fournee_en_cours: lectures < 2, films: lectures < 2 ? [PLEX] : [PLEX, NOUVEAU] }] }))),
    })
    const ailleurs = await laSalle('Ailleurs cette année-là')
    expect(within(ailleurs).getByText('La salle se remplit…')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(await within(ailleurs).findByRole('link', { name: /Un film de la fournée/ })).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(9_000)
    expect(compte(requetes, ANNEE)).toBe(2)
  })

  // Mutations : le plafond jamais atteint (la boucle sans `etatRelecture`) ; l'abandon tu ; « Réessayer » sans relecture.
  it('abandonne une fournée au plafond, le dit sous l’étagère, et « Réessayer » reprend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ salles: [ESSENTIELS, { ...AILLEURS, fournee_en_cours: true }] })),
    })
    const ailleurs = await laSalle('Ailleurs cette année-là')
    for (let i = 0; i < 20; i += 1) await vi.advanceTimersByTimeAsync(3_000)
    expect(await within(ailleurs).findByText('Le chroniqueur n’a pas répondu, reviens plus tard.')).toBeInTheDocument()
    expect(compte(requetes, ANNEE)).toBe(1 + RELECTURES.fournee.plafond)
    fireEvent.click(within(ailleurs).getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2 + RELECTURES.fournee.plafond))
    expect(within(ailleurs).queryByText('Le chroniqueur n’a pas répondu, reviens plus tard.')).toBeNull()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(compte(requetes, ANNEE)).toBe(3 + RELECTURES.fournee.plafond)
  })

  // Mutations : la minuterie gardée au démontage ; la boucle qui repart après une relecture arrivée page quittée.
  it('quitter la page arrête le guet, même une relecture en vol', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let lectures = 0
    let lacher: () => void = () => undefined
    const { requetes, unmount } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => {
        lectures += 1
        const reponse = json(fiche({ salles: [ESSENTIELS, { ...AILLEURS, fournee_en_cours: true }] }))
        // La deuxième relecture reste en vol jusqu'à ce que le test la lâche, page quittée.
        return lectures === 3 ? new Promise<Response>((r) => (lacher = () => r(reponse))) : reponse
      },
    })
    await laSalle('Ailleurs cette année-là')
    await vi.advanceTimersByTimeAsync(3_000)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(compte(requetes, ANNEE)).toBe(3)
    unmount()
    lacher()
    for (let i = 0; i < 10; i += 1) await vi.advanceTimersByTimeAsync(3_000)
    expect(compte(requetes, ANNEE)).toBe(3)
  })

  // Mutation : le compte des relectures gardé d'une fournée à la suivante : la seconde abandonnerait tôt.
  it('une seconde fournée repart de zéro dans ses relectures', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let lectures = 0
    let demandee = false
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => ((lectures += 1), json(fiche({ salles: [ESSENTIELS, { ...AILLEURS, fournee_en_cours: demandee || lectures < 9 }] }))),
      'POST /api/me/voyage/salles/s-ail/plus': () => ((demandee = true), json({ statut: 'en_preparation' }, 202)),
    })
    const ailleurs = await laSalle('Ailleurs cette année-là')
    for (let i = 0; i < 8; i += 1) await vi.advanceTimersByTimeAsync(3_000)
    fireEvent.click(await within(ailleurs).findByRole('button', { name: 'En voir plus' }))
    await within(ailleurs).findByText('La salle se remplit…')
    const avant = compte(requetes, ANNEE)
    for (let i = 0; i < 15; i += 1) await vi.advanceTimersByTimeAsync(3_000)
    expect(await within(ailleurs).findByText('Le chroniqueur n’a pas répondu, reviens plus tard.')).toBeInTheDocument()
    expect(compte(requetes, ANNEE) - avant).toBe(RELECTURES.fournee.plafond)
  })

  // Mutation : l'invalidation retirée après `200 { statut: 'epuisee' }` : la porte resterait ouverte.
  it('une salle épuisée relit la fiche, qui ferme la porte', async () => {
    let lectures = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => ((lectures += 1), json(fiche({ salles: [ESSENTIELS, { ...AILLEURS, epuisee: lectures > 1 }] }))),
      'POST /api/me/voyage/salles/s-ail/plus': () => json({ statut: 'epuisee' }),
    })
    const ailleurs = await laSalle('Ailleurs cette année-là')
    fireEvent.click(within(ailleurs).getByRole('button', { name: 'En voir plus' }))
    expect(await within(ailleurs).findByText('Salle épuisée')).toBeInTheDocument()
    expect(within(ailleurs).queryByRole('button', { name: 'En voir plus' })).toBeNull()
  })

  // Mutations : le refus réécrit par la page ; la garde jamais relâchée (`onSettled` retiré) : après un
  // refus passager, le bouton ne répondrait plus.
  it('un refus d’« En voir plus » s’affiche tel que l’API l’a écrit, et le geste se retente', async () => {
    let envois = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'POST /api/me/voyage/salles/s-ail/plus': () => (
        (envois += 1), json({ code: 'SERVICE_UNCONFIGURED', message: 'Le chroniqueur n’est pas configuré.', retryable: false }, 503)
      ),
    })
    const ailleurs = await laSalle('Ailleurs cette année-là')
    fireEvent.click(within(ailleurs).getByRole('button', { name: 'En voir plus' }))
    expect(await within(ailleurs).findByText('Le chroniqueur n’est pas configuré.')).toBeInTheDocument()
    fireEvent.click(within(ailleurs).getByRole('button', { name: 'En voir plus' }))
    await waitFor(() => expect(envois).toBe(2))
  })

  // Mutations : `enabled` sans `doitDemanderContexte` ; le contexte demandé sans que la feuille soit ouverte.
  it('le contexte écrit se lit sans appel, et rien ne part sans ouvrir la feuille', async () => {
    const { requetes } = monterVoyage('/voyage/1897', ROUTES)
    const essentiels = await laSalle('Les essentiels')
    expect(requetes.some((r) => r.includes('/contexte'))).toBe(false)
    fireEvent.click(within(essentiels).getByRole('button', { name: /Le contexte de la salle/ }))
    const feuille = await screen.findByRole('dialog', { name: 'Salle Les essentiels' })
    // Le premier paragraphe se compose mot à mot : le texte se lit sur la feuille entière.
    expect(feuille).toHaveTextContent('que rien ne redemande')
    expect(requetes.some((r) => r.includes('/contexte'))).toBe(false)
  })

  // Mutations : le texte non écrit dans la fiche en cache ; `staleTime` et `enabled` qui rappellent à la réouverture.
  it('un contexte manquant s’écrit une fois, s’inscrit dans la fiche, et rouvrir la feuille ne le redemande pas', async () => {
    let appels = 0
    const { client } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      'POST /api/me/voyage/annees/1897/salles/s-ail/contexte': () => ((appels += 1), json({ contexte: 'Ce que la salle raconte de 1897.' })),
    })
    const ailleurs = await laSalle('Ailleurs cette année-là')
    fireEvent.click(within(ailleurs).getByRole('button', { name: /Le contexte de la salle/ }))
    const feuille = await screen.findByRole('dialog', { name: 'Salle Ailleurs cette année-là' })
    await waitFor(() => expect(feuille).toHaveTextContent('Ce que la salle raconte de 1897.'))
    await waitFor(() => {
      const f = client.getQueryData<FichePrete>(cles.annee(1897))
      expect(f?.salles.find((s) => s.id === 's-ail')?.contexte).toBe('Ce que la salle raconte de 1897.')
    })
    fireEvent.click(within(feuille).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(within(ailleurs).getByRole('button', { name: /Le contexte de la salle/ }))
    expect(await screen.findByRole('dialog', { name: 'Salle Ailleurs cette année-là' })).toBeInTheDocument()
    expect(appels).toBe(1)
  })

  // Mutation : le refus du contexte réécrit ; « Réessayer » sans relecture.
  it('un contexte qui ne s’écrit pas dit le refus de l’API, et se réessaie', async () => {
    let appels = 0
    monterVoyage('/voyage/1897?feuille=salle-s-ail', {
      ...ROUTES,
      'POST /api/me/voyage/annees/1897/salles/s-ail/contexte': () =>
        (appels += 1) === 1
          ? json({ code: 'UPSTREAM_UNAVAILABLE', message: 'Le chroniqueur ne répond pas.', retryable: true }, 503)
          : json({ contexte: 'Enfin écrit.' }),
    })
    const feuille = await screen.findByRole('dialog', { name: 'Salle Ailleurs cette année-là' })
    expect(await within(feuille).findByText('Le chroniqueur ne répond pas.')).toBeInTheDocument()
    fireEvent.click(within(feuille).getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(feuille).toHaveTextContent('Enfin écrit.'))
    expect(appels).toBe(2)
  })

  // Mutation : la feuille d'une salle montée hors IA pour un contexte qui n'est pas écrit (l'API répondrait `403`).
  it('hors IA, une adresse vers un contexte non écrit n’ouvre rien et n’appelle rien', async () => {
    const { requetes } = monterVoyage('/voyage/1897?feuille=salle-s-ail', { ...ROUTES, 'GET /api/me/voyage': () => json(HORS_IA) })
    await laSalle('Ailleurs cette année-là')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(requetes.some((r) => r.includes('/contexte'))).toBe(false)
  })

  // Mutations : `piste` retirée du corps (ou réduite au texte) ; les pistes non retirées de la fiche en cache.
  it('la piste touchée part comme `piste` même après réécriture du champ, et quitte la liste', async () => {
    let envoye: unknown = null
    const { client } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      'POST /api/me/voyage/annees/1897/salles': (init) => ((envoye = corps(init)), json({ statut: 'en_preparation', demande_id: 'd-1' }, 202)),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Le cinéma muet allemand' }))
    expect(within(feuillet).getByText('Expressionnisme et ombres.')).toBeInTheDocument()
    const champ = within(feuillet).getByRole('textbox')
    expect(champ).toHaveValue('Le cinéma muet allemand')
    fireEvent.change(champ, { target: { value: 'Le muet allemand, ses ombres  ' } })
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Demander' }))
    await waitFor(() => expect(envoye).toEqual({ demande: 'Le muet allemand, ses ombres', piste: 'Le cinéma muet allemand' }))
    await waitFor(() => expect(client.getQueryData<FichePrete>(cles.annee(1897))?.pistes.map((p) => p.nom)).toEqual(['Les débuts du technicolor']))
    expect(await screen.findByText('La salle s’écrit…')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Le jumeau : une salle écrite à la main n'envoie aucune piste et n'en retire aucune. Mutation : `piste` posée au texte.
  it('une salle écrite à la main part sans piste', async () => {
    let envoye: unknown = null
    const { client } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      'POST /api/me/voyage/annees/1897/salles': (init) => ((envoye = corps(init)), json({ statut: 'en_preparation', demande_id: 'd-2' }, 202)),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    fireEvent.change(within(feuillet).getByRole('textbox'), { target: { value: 'Les films de fantômes' } })
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Demander' }))
    await waitFor(() => expect(envoye).toEqual({ demande: 'Les films de fantômes' }))
    await waitFor(() => expect(client.getQueryData<FichePrete>(cles.annee(1897))?.demande_salle?.statut).toBe('en_cours'))
    expect(client.getQueryData<FichePrete>(cles.annee(1897))?.pistes).toHaveLength(2)
  })

  // Mutations : la garde du double toucher retirée ; « Demander » actif sur un champ vide.
  it('« Demander » deux fois vite n’ouvre qu’une salle, et rien ne part d’un champ vide', async () => {
    let envois = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'POST /api/me/voyage/annees/1897/salles': () => ((envois += 1), json({ statut: 'en_preparation', demande_id: 'd-3' }, 202)),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    const demander = within(feuillet).getByRole('button', { name: 'Demander' })
    expect(demander).toBeDisabled()
    fireEvent.change(within(feuillet).getByRole('textbox'), { target: { value: '   ' } })
    expect(demander).toBeDisabled()
    // La touche Entrée du clavier soumet le formulaire sans passer par le bouton.
    fireEvent.submit(within(feuillet).getByRole('textbox').closest('form')!)
    await new Promise((r) => setTimeout(r, 50))
    expect(envois).toBe(0)
    expect(screen.getByRole('dialog', { name: 'Quelle salle ?' })).toBe(feuillet)
    fireEvent.change(within(feuillet).getByRole('textbox'), { target: { value: 'Les films de fantômes' } })
    fireEvent.click(demander)
    fireEvent.click(demander)
    expect(await screen.findByText('La salle s’écrit…')).toBeInTheDocument()
    expect(envois).toBe(1)
  })

  // Mutations : le refus de l'API réécrit, ou le feuillet fermé sur un refus ; la garde jamais relâchée.
  it('une salle refusée à la demande dit le message de l’API, garde la feuille, et se redemande', async () => {
    let envois = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      'POST /api/me/voyage/annees/1897/salles': () => (
        (envois += 1), json({ code: 'CONFLICT', message: 'Une salle s’écrit déjà pour cette année.', retryable: false }, 409)
      ),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    fireEvent.change(within(feuillet).getByRole('textbox'), { target: { value: 'Les films de fantômes' } })
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Demander' }))
    expect(await within(feuillet).findByText('Une salle s’écrit déjà pour cette année.')).toBeInTheDocument()
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Demander' }))
    await waitFor(() => expect(envois).toBe(2))
  })

  // Mutations : l'intervalle jamais posé ; la demande non marquée « en cours » dans la fiche en cache.
  it('la salle demandée : la fiche relue toutes les cinq secondes jusqu’à la salle neuve', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let lectures = 0
    const neuve = salle({ id: 's-neuve', nom: 'Les films de fantômes', raison_d_etre: 'Des spectres.', films: [NOUVEAU] })
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => {
        lectures += 1
        if (lectures === 1) return json(fiche())
        if (lectures < 4) return json(fiche({ demande_salle: { id: 'd-4', demande: 'Les films de fantômes', statut: 'en_cours', motif: null, salle_id: null } }))
        return json(fiche({ salles: [ESSENTIELS, AILLEURS, neuve] }))
      },
      'POST /api/me/voyage/annees/1897/salles': () => json({ statut: 'en_preparation', demande_id: 'd-4' }, 202),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    fireEvent.change(within(feuillet).getByRole('textbox'), { target: { value: 'Les films de fantômes' } })
    fireEvent.click(within(feuillet).getByRole('button', { name: 'Demander' }))
    expect(await screen.findByText('La salle s’écrit…')).toBeInTheDocument()
    expect(compte(requetes, ANNEE)).toBe(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(compte(requetes, ANNEE)).toBe(2)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await screen.findByRole('region', { name: 'Salle Les films de fantômes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(compte(requetes, ANNEE)).toBe(4)
  })

  // Mutation : le guet de la salle nouvelle sans plafond (le jumeau de celui de la fournée).
  it('abandonne une salle qui s’écrit au plafond, et le dit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ demande_salle: { id: 'd-5', demande: 'Les films de fantômes', statut: 'en_cours', motif: null, salle_id: null } })),
    })
    await screen.findByText('La salle s’écrit…')
    for (let i = 0; i < 45; i += 1) await vi.advanceTimersByTimeAsync(5_000)
    expect(await screen.findByText('Le chroniqueur n’a pas répondu, reviens plus tard.')).toBeInTheDocument()
    expect(compte(requetes, ANNEE)).toBe(1 + RELECTURES.salle.plafond)
  })

  // Mutations : la garde de l'identifiant retirée (un envoi par relecture, ou par réouverture de la
  // page) ; un refus jamais marqué vu ; une demande en cours marquée vue.
  it('un refus s’affiche avec son motif, et `…/vue` ne part qu’une fois, relectures et réouverture comprises', async () => {
    let vues = 0
    const refus = fiche({ demande_salle: { id: 'd-refus', demande: 'Les films en relief', statut: 'refusee', motif: 'Le relief attendra 1903.', salle_id: null } })
    const routes = {
      ...ROUTES,
      [ANNEE]: () => json(refus),
      'POST /api/me/voyage/demandes-salles/d-refus/vue': () => ((vues += 1), new Response(null, { status: 204 })),
    }
    const { client, unmount, requetes } = monterVoyage('/voyage/1897', routes)
    expect(await screen.findByText('Le relief attendra 1903.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir une nouvelle salle' })).toBeInTheDocument()
    await waitFor(() => expect(vues).toBe(1))
    await act(() => client.refetchQueries({ queryKey: cles.annee(1897) }))
    await waitFor(() => expect(compte(requetes, ANNEE)).toBe(2))
    unmount()
    monterVoyage('/voyage/1897', routes, (c) => c.setQueryData(cles.annee(1897), refus))
    expect(await screen.findByText('Le relief attendra 1903.')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 50))
    expect(vues).toBe(1)
  })

  // Le jumeau : une demande qui s'écrit n'est pas un refus. Mutation : `…/vue` pour toute demande montrée.
  it('une demande en cours ne se marque pas vue', async () => {
    const { requetes } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ demande_salle: { id: 'd-6', demande: 'Les films de fantômes', statut: 'en_cours', motif: null, salle_id: null } })),
    })
    await screen.findByText('La salle s’écrit…')
    await new Promise((r) => setTimeout(r, 50))
    expect(requetes.some((r) => r.includes('/vue'))).toBe(false)
  })

  // Mutations : « D’autres pistes » offert quand il en reste ; sa garde du double toucher retirée ; la
  // réponse non reportée dans la fiche en cache.
  it('sans piste, « D’autres pistes » en demande une fois, et les montre', async () => {
    let appels = 0
    const { client } = monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ pistes: [] })),
      'POST /api/me/voyage/annees/1897/pistes': () => ((appels += 1), json({ pistes: [{ nom: 'Le cinéma soviétique', raison: 'Le montage.' }] })),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    const autres = within(feuillet).getByRole('button', { name: 'D’autres pistes' })
    fireEvent.click(autres)
    fireEvent.click(autres)
    expect(await within(feuillet).findByRole('button', { name: 'Le cinéma soviétique' })).toBeInTheDocument()
    expect(appels).toBe(1)
    expect(client.getQueryData<FichePrete>(cles.annee(1897))?.pistes).toEqual([{ nom: 'Le cinéma soviétique', raison: 'Le montage.' }])
    expect(within(feuillet).queryByRole('button', { name: 'D’autres pistes' })).toBeNull()
  })

  // Mutations : le refus réécrit ; la garde jamais relâchée.
  it('un refus des pistes dit le message de l’API, et « D’autres pistes » se retente', async () => {
    let appels = 0
    monterVoyage('/voyage/1897', {
      ...ROUTES,
      [ANNEE]: () => json(fiche({ pistes: [] })),
      'POST /api/me/voyage/annees/1897/pistes': () => (
        (appels += 1), json({ code: 'UPSTREAM_UNAVAILABLE', message: 'Le chroniqueur ne répond pas.', retryable: true }, 503)
      ),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    fireEvent.click(within(feuillet).getByRole('button', { name: 'D’autres pistes' }))
    expect(await within(feuillet).findByText('Le chroniqueur ne répond pas.')).toBeInTheDocument()
    fireEvent.click(within(feuillet).getByRole('button', { name: 'D’autres pistes' }))
    await waitFor(() => expect(appels).toBe(2))
  })

  // Le jumeau : tant qu'il reste une piste, rien ne la renouvelle. Mutation : `autresPistes` toujours vrai.
  it('avec des pistes, « D’autres pistes » n’est pas offert', async () => {
    monterVoyage('/voyage/1897', ROUTES)
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir une nouvelle salle' }))
    const feuillet = await screen.findByRole('dialog', { name: 'Quelle salle ?' })
    expect(within(feuillet).getByRole('button', { name: 'Le cinéma muet allemand' })).toBeInTheDocument()
    expect(within(feuillet).queryByRole('button', { name: 'D’autres pistes' })).toBeNull()
  })
})
