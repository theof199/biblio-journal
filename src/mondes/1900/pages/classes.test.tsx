import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FichePrete, FilmSeance, Table, Tables, Voyage } from '../../../api/voyage'
import type { JournalPage } from '../../../api/journal'
import { exemple } from '../../../test/contrat'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { ficheEnAttente, fichePrete, filmDeSalle, morceau, salle, seance, voyage1890 } from '../../../test/voyage'
import { RELECTURES } from '../../../voyage/relecture'
import { classeDe, filmDeLaMarche, MOTS_DES_CLASSES } from './classes'
import { MOTS_DU_WAGON, ceQueDitLaPorte } from './wagon'

/**
 * Les trois classes et le train du soir (plan des pages 1900, brief 4) : le podium d'une année 1900
 * est une voiture à trois portières, sa séance du soir une affichette de train de plaisir. La page se
 * monte dans l'app entière : le monde n'y arrive que par le registre.
 */
const SOURCE = { id: '22222222-2222-4222-8222-222222222222', pseudo: 'theo', annee_en_cours: 1902 }
const VOYAGE = voyage1890(
  1903,
  [
    { annee: 1902, statut: 'ouverte', visitee: true, recompense: 'palme' },
    { annee: 1903, statut: 'en_cours', visitee: true, recompense: null },
    { annee: 1904, statut: 'verrouillee', visitee: false, recompense: null },
  ],
  { ia: true, source: null, rattrape_la_source: false },
)
const HORS_IA: Voyage = { ...VOYAGE, ia: false, source: SOURCE }
const FICHE = 'GET /api/me/voyage/annees/1903'
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const JOURNAL = 'GET /api/me/journal?limit=100&sortie_min=1903&sortie_max=1903'

const ROBBERY = filmDeSalle({ id: 'f-rob', tmdb_id: 5698, rang: 1, title: 'The Great Train Robbery', year: 1903, etat: 'vu', note: 9, cover_url: 'https://images.test/robbery.jpg' })
const FEES = filmDeSalle({ id: 'f-fees', tmdb_id: 776, rang: 2, title: 'Le Royaume des fées', year: 1903, etat: 'sur_le_plex', cover_url: null })
const BOBINE = { tmdb_id: 901, title: 'La première vue', duree_min: 1, cover_url: null, plex_url: null, etat: 'a_demander' as const }
// Le programme porte le même numéro TMDB qu'un film : une marche de film ne doit jamais l'ouvrir.
const PROGRAMME = filmDeSalle({ id: 'f-prog', tmdb_id: 5698, rang: 3, title: 'Trois vues Lumière', year: 1903, etat: 'vu', cover_url: null, programme: { duree_min: 3, bobines: [BOBINE] } })
const SALLES = [salle({ id: 's-vues', rang: 2, nom: 'Les vues', films: [PROGRAMME] }), salle({ id: 's-ess', rang: 1, nom: 'Les essentiels', films: [ROBBERY, FEES] })]

const M = (place: number, titre: string, o: { tmdb?: number; programme?: string; affiche?: string | null }) => ({ place, tmdb_id: o.tmdb ?? null, programme_id: o.programme ?? null, title: titre, cover_url: o.affiche ?? null, backdrop_url: null })
const PREMIERE = M(1, 'The Great Train Robbery', { tmdb: 5698, affiche: 'https://images.test/robbery.jpg' })
const HORS_SALLES = M(2, 'Un film du journal', { tmdb: 4242 })

const COURT: FilmSeance = { ...morceau(PROGRAMME, 'Les vues'), tmdb_id: 901, title: 'La première vue', etat: 'a_demander', bobine: { tmdb_id: 901, title: 'La première vue' } }
const PROPOSEE = seance({ id: 'se-7', rang: 7, long: morceau(FEES), court: COURT, anecdote: 'Vingt minutes de pellicule : c’est un long.' })
const PRISE = { ...PROPOSEE, statut: 'prise' as const }
const PASSEE = seance({ id: 'se-6', rang: 6, long: morceau(ROBBERY), statut: 'prise', composee_le: '2026-06-21T18:00:00.000Z' })

const fiche = (s: Partial<FichePrete> = {}) =>
  fichePrete({ annee: 1903, ticket: null, maturite: null, generique: null, pistes: [], demande_salle: null, salles: SALLES, podium: [PREMIERE, HORS_SALLES, null], seances: [PROPOSEE, PASSEE], seance_en_cours: false, ...s })
const routes = (v: Voyage = VOYAGE, f: () => FichePrete = fiche) => ({
  'GET /api/me/voyage': () => json(v),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  [FICHE]: () => json(f()),
  [JOURNAL]: () => json({ ...PAGE, items: [], next_cursor: null }),
})
const lesClasses = () => screen.findByRole('region', { name: 'Les trois classes, ton podium' })
const leSoir = () => screen.findByRole('region', { name: 'Ce soir en gare' })
/** Mes tables, que la fiche de mon année en cours lit pour la porte du wagon-restaurant (lot d'écrans, brief 16). */
const TABLES = 'GET /api/me/voyage/tables'
const calme = () => vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('les règles des trois classes', () => {
  // Mutation : deux classes échangées.
  it('une place a sa classe : son chiffre romain et son nom', () => {
    expect([1, 2, 3].map((p) => classeDe(p))).toEqual([
      { chiffre: 'I', nom: '1ʳᵉ classe' },
      { chiffre: 'II', nom: '2ᵉ classe' },
      { chiffre: 'III', nom: '3ᵉ classe' },
    ])
  })

  // Mutations : un programme retrouvé par son numéro TMDB (`f.programme === null` retiré) ; une marche
  // de programme cherchée par TMDB ; le premier film de la salle rendu faute de mieux.
  it('une marche désigne son film dans les salles, un programme par son identifiant, et rien hors des salles', () => {
    expect(filmDeLaMarche(PREMIERE, SALLES)?.id).toBe('f-rob')
    expect(filmDeLaMarche(M(1, 'Trois vues Lumière', { programme: 'f-prog' }), SALLES)?.id).toBe('f-prog')
    expect(filmDeLaMarche(M(1, 'Un programme parti', { programme: 'f-ailleurs', tmdb: 5698 }), SALLES)).toBeNull()
    expect(filmDeLaMarche(HORS_SALLES, SALLES)).toBeNull()
    expect(filmDeLaMarche(PREMIERE, [])).toBeNull()
    expect(filmDeLaMarche(null, SALLES)).toBeNull()
  })
})

describe('les trois classes', () => {
  // Mutations : `Classes` retiré des gabarits (les marches par défaut reviendraient) ; dans `Portiere`,
  // le lien posé sans regarder la marche (une place libre ouvrirait un film), ou vers l'année ; le
  // titre ou « place libre » oublié.
  it('trois portières à la place des marches : l’occupée ouvre son film, la libre le dit et n’ouvre aucun film', async () => {
    monterVoyage('/voyage/1903', routes())
    const classes = await lesClasses()
    expect(screen.queryByRole('button', { name: /^Marche \d/ })).toBeNull()
    expect(classes).toHaveTextContent('Les trois classeston podium de 1903')
    // Un seul lien : la première classe, dont le film est dans une salle. Ni la place libre, ni le film hors des salles.
    expect(within(classes).getAllByRole('link').map((l) => `${l.getAttribute('aria-label')} → ${l.getAttribute('href')}`)).toEqual(['1ʳᵉ classe : The Great Train Robbery, ouvrir le film → /voyage/1903/films/f-rob'])
    expect(within(classes).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      '1ʳᵉ classe : changer de voyageur',
      '2ᵉ classe : Un film du journal, changer de voyageur',
      '3ᵉ classe : place libre, installer un film',
    ])
    expect(within(classes).getByText('The Great Train Robbery')).toBeInTheDocument()
    expect(within(classes).getByText(MOTS_DES_CLASSES.libre)).toBeInTheDocument()
    expect(within(classes).getByText(MOTS_DES_CLASSES.aChoisir)).toBeInTheDocument()
    expect(within(classes).getByText(MOTS_DES_CLASSES.aide)).toBeInTheDocument()
  })

  // Les gestes du podium restent ceux de la page : le feuillet d'une marche, dans l'adresse.
  // Mutations : « Changer » ou la portière libre non branchés ; la place d'une autre portière.
  it.each([
    ['« Changer »', '1ʳᵉ classe : changer de voyageur', 'Marche 1'],
    ['la portière d’un film hors des salles', '2ᵉ classe : Un film du journal, changer de voyageur', 'Marche 2'],
    ['la portière libre', '3ᵉ classe : place libre, installer un film', 'Marche 3'],
  ])('%s ouvre le feuillet de sa marche', async (_quoi, nom, feuillet) => {
    monterVoyage('/voyage/1903', routes())
    fireEvent.click(within(await lesClasses()).getByRole('button', { name: nom }))
    expect(await screen.findByRole('dialog', { name: feuillet })).toBeInTheDocument()
  })

  // Tenir une portière la vide, une fois, et le relâcher n'ouvre pas le film qu'on vient de retirer ;
  // le refus se lit sous les portières. Mutations, dans `Portiere` : les écouteurs de l'appui long non
  // posés sur le lien ; `preventDefault` retiré du `click` (la page du film s'ouvrirait) ; `erreur`
  // non rendue dans `Classes` ; `draggable={false}` retiré du lien, ou de son affiche.
  it('tenir la portière occupée la vide sans ouvrir son film, et un refus se lit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let videe = 0
    monterVoyage('/voyage/1903', {
      ...routes(),
      'DELETE /api/me/voyage/annees/1903/podium/1': () => ((videe += 1), json({ code: 'VALIDATION', message: 'Cette marche ne se vide pas.', retryable: false }, 400)),
    })
    const classes = await lesClasses()
    const porte = within(classes).getByRole('link')
    // Tenir ne lance pas le glisser natif du lien ni de son affiche, qui couperait l'appui.
    expect([porte.getAttribute('draggable'), porte.querySelector('img')!.getAttribute('draggable')]).toEqual(['false', 'false'])
    fireEvent.pointerDown(porte)
    await vi.advanceTimersByTimeAsync(600)
    fireEvent.pointerUp(porte)
    fireEvent.click(porte)
    expect(await within(classes).findByRole('alert')).toHaveTextContent('Cette marche ne se vide pas.')
    expect(videe).toBe(1)
    // Toujours sur l'année : la page du film ne s'est pas ouverte.
    expect(screen.getByRole('heading', { level: 1, name: '1903' })).toBeInTheDocument()
    expect(classes).toBeInTheDocument()
  })

  // Le jumeau : une place libre ne se vide pas, même tenue. Mutation : `useAppuiLong` armé sans marche.
  it('tenir une portière libre ne vide rien', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1903', routes())
    const libre = within(await lesClasses()).getByRole('button', { name: /^3ᵉ classe/ })
    fireEvent.pointerDown(libre)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(requetes.some((r) => r.startsWith('DELETE'))).toBe(false)
  })

  // Une année en attente a déjà son podium, sans salles : aucune portière n'a de film à ouvrir, et
  // l'aide ne le promet pas. Mutations : `Classes` retiré des gabarits ; l'aide en dur.
  it('une année en attente a ses portières, sans lien vers un film', async () => {
    monterVoyage('/voyage/1903', { ...routes(HORS_IA), [FICHE]: () => json(ficheEnAttente(1903, { podium: [PREMIERE, null, null] })) })
    const classes = await lesClasses()
    expect(within(classes).queryByRole('link')).toBeNull()
    expect(within(classes).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      '1ʳᵉ classe : The Great Train Robbery, changer de voyageur',
      '2ᵉ classe : place libre, installer un film',
      '3ᵉ classe : place libre, installer un film',
    ])
    expect(within(classes).getByText(MOTS_DES_CLASSES.aideSansFilm)).toBeInTheDocument()
    expect(within(classes).queryByText(MOTS_DES_CLASSES.aide)).toBeNull()
  })
})

describe('le train du soir', () => {
  // Mutations : `TrainDuSoir` retiré des gabarits (le prospectus par défaut dirait « Grande séance ») ;
  // le court, l'anecdote ou les séances passées oubliés ; la porte du wagon-restaurant montée sans
  // table (`.lien-wr` de la maquette portée telle quelle, ou `tablesDeLaPorte` contournée). **« Aucun
  // wagon-restaurant » s'inverse au brief 16 du lot d'écrans** : la porte existe, plus bas, quand une
  // table existe ce soir ; ici mes tables sont vides, et elle n'y est pas.
  it('l’affichette : le long en voiture, le court en tête, l’anecdote, les quatre talons, les séances passées ; sans table ce soir, aucune porte du wagon-restaurant', async () => {
    const { requetes } = monterVoyage('/voyage/1903', { ...routes(), [TABLES]: () => json({ tables: [] }) })
    const soir = await leSoir()
    expect(soir).toHaveTextContent('Ce soiren gare de 1903')
    const affichette = within(soir).getByRole('article', { name: 'Séance n° 7' })
    expect(affichette).toHaveTextContent('Train de plaisirce soir à 8 h ½')
    expect(screen.queryByText(/Grande séance/)).toBeNull()
    expect(affichette).toHaveTextContent('La voiture · le longLe Royaume des féesLes essentiels · sur ton Plex')
    expect(affichette).toHaveTextContent('En tête · en ouvertureLa première vueLes vues · à voir')
    expect(affichette).toHaveTextContent('Pendant le trajetVingt minutes de pellicule : c’est un long.')
    expect(within(affichette).getAllByRole('button').map((b) => b.textContent)).toEqual(['Prendre', 'Ignorer', 'Autre long', 'Autre court'])
    expect(within(affichette).queryByText('Prise')).toBeNull()
    expect(within(soir).getByText('Séances passées').closest('details')).toHaveTextContent('The Great Train Robbery · 21 juin 2026 · vue')
    // Mes tables sont lues, et vides : ni porte, ni mot.
    await waitFor(() => expect(requetes).toContain(TABLES))
    expect(screen.queryByText(/wagon-restaurant/i)).toBeNull()
    expect(within(soir).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/voyage/1903/films/f-fees/billet', '/voyage/1903/films/f-prog/billet?bobine=901'])
  })

  // Un talon n'agit pas pendant un envoi : le verrou reste à la page. Mutations : dans `Seance`, le
  // verrou retiré d'`agir` ; dans `TrainDuSoir`, « Prendre » encore offert sur une séance prise, ou le
  // tampon oublié.
  it('« Prendre » deux fois vite n’envoie qu’une fois, puis le tampon « Prise » et plus de talon « Prendre »', async () => {
    let envois = 0
    monterVoyage('/voyage/1903', {
      ...routes(VOYAGE, () => fiche({ seances: [envois > 0 ? PRISE : PROPOSEE, PASSEE] })),
      'POST /api/me/voyage/seances/se-7/prendre': () => ((envois += 1), json({ seance: PRISE })),
    })
    const soir = await leSoir()
    const prendre = within(soir).getByRole('button', { name: 'Prendre' })
    fireEvent.click(prendre)
    fireEvent.click(prendre)
    const tampon = await within(soir).findByText('Prise')
    expect(envois).toBe(1)
    expect(tampon).toHaveAttribute('data-frappe', 'oui')
    expect(within(soir).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ignorer', 'Autre long', 'Autre court'])
  })

  // Le jumeau : « Ignorer », gardé de même, et un refus qui se lit sur l'affichette. Mutations : le
  // talon branché sur `prendre` ; `talons.erreur` non rendue.
  it('« Ignorer » deux fois vite n’envoie qu’une fois, et un refus se lit', async () => {
    let envois = 0
    let repondre: () => void = () => undefined
    monterVoyage('/voyage/1903', {
      ...routes(),
      'POST /api/me/voyage/seances/se-7/ignorer': () => {
        envois += 1
        return new Promise<Response>((r) => (repondre = () => r(json({ code: 'VALIDATION', message: 'Cette séance ne s’ignore pas.', retryable: false }, 400))))
      },
    })
    const soir = await leSoir()
    fireEvent.click(within(soir).getByRole('button', { name: 'Ignorer' }))
    fireEvent.click(within(soir).getByRole('button', { name: 'Ignorer' }))
    await waitFor(() => expect(envois).toBe(1))
    await act(async () => repondre())
    expect(await within(soir).findByRole('alert')).toHaveTextContent('Cette séance ne s’ignore pas.')
    expect(envois).toBe(1)
  })

  // Mutations : les deux talons échangés, ou non branchés.
  it.each([
    ['Autre long', 'Un autre long'],
    ['Autre court', 'Un autre court'],
  ])('« %s » ouvre son feuillet, que la page tient', async (talon, feuillet) => {
    monterVoyage('/voyage/1903', routes())
    fireEvent.click(within(await leSoir()).getByRole('button', { name: talon }))
    expect(await screen.findByRole('dialog', { name: feuillet })).toBeInTheDocument()
  })

  // Sans séance à l'affiche : « Composer une séance », gardé contre le double toucher, puis la
  // composition qui s'écrit. Mutations : dans `Seance`, le verrou retiré de `lancer` ; dans
  // `TrainDuSoir`, le bouton non branché, ou la zone « en composition » non rendue.
  it('« Composer une séance » deux fois vite n’envoie qu’une fois, puis l’affichette dit la composition', async () => {
    let envois = 0
    monterVoyage('/voyage/1903', {
      ...routes(VOYAGE, () => fiche({ seances: [], seance_en_cours: envois > 0 })),
      'POST /api/me/voyage/annees/1903/seances': () => ((envois += 1), json({}, 202)),
    })
    const soir = await leSoir()
    expect(within(soir).queryByRole('article')).toBeNull()
    const composer = within(soir).getByRole('button', { name: 'Composer une séance' })
    fireEvent.click(composer)
    fireEvent.click(composer)
    expect(await within(soir).findByRole('status')).toHaveTextContent('Le chroniqueur compose la séance…')
    expect(soir).toHaveTextContent('Train de plaisiren composition')
    expect(envois).toBe(1)
  })

  // Le jumeau : pendant l'envoi, le bouton d'action (commun, `Action`) se désactive. Mutations :
  // `disabled` que `Action` ne poserait plus sur son bouton, ou que le train du soir ne lui passerait plus.
  it('« Composer une séance » se désactive tant que l’envoi est en vol', async () => {
    let repondre: () => void = () => undefined
    monterVoyage('/voyage/1903', {
      ...routes(VOYAGE, () => fiche({ seances: [], seance_en_cours: false })),
      'POST /api/me/voyage/annees/1903/seances': () => new Promise<Response>((r) => (repondre = () => r(json({ code: 'VALIDATION', message: 'Pas ce soir.', retryable: false }, 400)))),
    })
    const soir = await leSoir()
    const composer = within(soir).getByRole('button', { name: 'Composer une séance' })
    expect(composer).toBeEnabled()
    fireEvent.click(composer)
    await waitFor(() => expect(composer).toBeDisabled())
    await act(async () => repondre())
    await waitFor(() => expect(within(soir).getByRole('button', { name: 'Composer une séance' })).toBeEnabled())
  })

  // Le guet d'une composition s'arrête au plafond : l'affichette le dit à la place de « compose… », et
  // « Réessayer » le reprend sans recomposer (aucun appel au chroniqueur que le membre n'a pas
  // demandé). Sur le modèle du défaut (`Seance.test.tsx`). Mutations, dans `TrainDuSoir` : l'abandon
  // tu (« compose… » rendu quand même) ; « Réessayer » non branché.
  it('une composition restée sans réponse le dit sur l’affichette, et « Réessayer » reprend le guet sans recomposer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { requetes } = monterVoyage('/voyage/1903', { ...routes(VOYAGE, () => fiche({ seances: [], seance_en_cours: true })), 'POST /api/me/voyage/annees/1903/seances': () => json({}, 202) })
    const lectures = () => requetes.filter((r) => r === FICHE).length
    const soir = await leSoir()
    expect(within(soir).getByRole('status')).toHaveTextContent('Le chroniqueur compose la séance…')
    for (let i = 0; i < RELECTURES.seance.plafond + 4; i += 1) await vi.advanceTimersByTimeAsync(RELECTURES.seance.ms)
    expect(await within(soir).findByRole('alert')).toHaveTextContent('Le chroniqueur n’a pas répondu, reviens plus tard.')
    expect(within(soir).queryByRole('status')).toBeNull()
    expect(soir).toHaveTextContent('Train de plaisiren composition')
    expect(lectures()).toBe(1 + RELECTURES.seance.plafond)
    fireEvent.click(within(soir).getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(lectures()).toBe(2 + RELECTURES.seance.plafond))
    expect(within(soir).queryByRole('alert')).toBeNull()
    expect(within(soir).getByRole('status')).toHaveTextContent('Le chroniqueur compose la séance…')
    await vi.advanceTimersByTimeAsync(RELECTURES.seance.ms)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })

  // La page décide seule qui voit le train du soir ; le gabarit ne le redécide pas. Mutations, dans
  // la page : `v.ia` ou `enCours` retiré de la garde de la séance.
  it('ne s’offre ni hors IA, ni sur une année derrière soi', async () => {
    const horsIa = monterVoyage('/voyage/1903', routes({ ...HORS_IA, source: { ...SOURCE, annee_en_cours: 1903 } }))
    await lesClasses()
    expect(screen.queryByRole('region', { name: 'Ce soir en gare' })).toBeNull()
    expect(screen.queryByText('Train de plaisir')).toBeNull()
    horsIa.unmount()
    monterVoyage('/voyage/1902', { ...routes(), 'GET /api/me/voyage/annees/1902': () => json(fiche({ annee: 1902 })) })
    await lesClasses()
    expect(screen.queryByRole('region', { name: 'Ce soir en gare' })).toBeNull()
  })

  // Au calme, rien ne bouge : la feuille n'anime que sous `data-vivante='oui'` (le balayage de
  // `pages1900.test.tsx` la tient). Mutation : `calme` ignoré dans `TrainDuSoir`.
  it('au calme, le train du soir n’est pas vivant : le tampon ne se frappe pas', async () => {
    const vivant = monterVoyage('/voyage/1903', routes())
    expect(await leSoir()).toHaveAttribute('data-vivante', 'oui')
    vivant.unmount()
    calme()
    monterVoyage('/voyage/1903', routes())
    expect(await leSoir()).toHaveAttribute('data-vivante', 'non')
  })
})

// La porte du wagon-restaurant (plan des écrans des lots, brief 16, décision 10 ; maquette, écran 17 :
// `.lien-wr`) : sur la fiche de mon année en cours, quand une table existe ce soir. Le bloc lecteur
// est tenu par `pages/VoyageAnnee.porte.test.tsx` sur un dessin prêté ; ici, la gare de 1900.
describe('la porte du wagon-restaurant', () => {
  const EXEMPLE = exemple<Tables>('/me/voyage/tables', 'get', 200)
  /** Alice (moi) a dressé une table pour bob, ce soir. */
  const LA_MIENNE: Table = { ...EXEMPLE.tables[0]!, soir: '2026-10-09' }
  /** Bob m'invite, ce soir. */
  const CHEZ_BOB: Table = { ...LA_MIENNE, id: 'a1000000-0000-4000-8000-000000000001', hote: LA_MIENNE.invite, invite: LA_MIENNE.hote }
  const etat = (t: Table, e: Table['etat']): Table => ({ ...t, etat: e })
  const aTable = (tables: Table[], v: Voyage = VOYAGE) => ({ ...routes(v), [TABLES]: () => json({ tables } satisfies Tables) })
  const laPorte = () => screen.findByRole('link', { name: new RegExp(`^${MOTS_DU_WAGON.porte}`) })

  beforeEach(() => {
    calme()
    // L'heure se fixe, elle ne s'attend pas : le 9 octobre 2026, 20 h à Paris.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T18:00:00.000Z'))
  })

  // Mutations : `porteDuWagon` retiré des gabarits de `PAGES_1900` ; `{porte}` oublié par `Gare`, ou
  // rangé avant le train du soir ; le lien mené ailleurs que là où `Porte` le dit (`to="/voyage"`).
  it('sous le train du soir, hors de lui, elle dit ce qu’il en est de ma table et mène au wagon', async () => {
    monterVoyage('/voyage/1903', aTable([etat(LA_MIENNE, 'a_pris_sa_place')]))
    const porte = await laPorte()
    expect(porte).toHaveAttribute('href', '/voyage/wagon-restaurant')
    expect(porte).toHaveAccessibleName(`${MOTS_DU_WAGON.porte} bob a pris sa place : le même film, à deux, ce soir`)
    const soir = await leSoir()
    expect(soir.contains(porte)).toBe(false)
    expect(soir.compareDocumentPosition(porte) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const classes = await lesClasses()
    expect(classes.compareDocumentPosition(porte) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // **Pour tout membre** : hors IA, la page ne monte pas le train du soir, et la porte est là quand
  // même. Mutation : la porte rendue par `TrainDuSoir`, ou rangée dans la place `seance`.
  it('un membre hors IA n’a pas de train du soir, et trouve la porte', async () => {
    monterVoyage('/voyage/1903', aTable([CHEZ_BOB], HORS_IA))
    expect(await laPorte()).toHaveAccessibleName(`${MOTS_DU_WAGON.porte} bob t’invite à sa table : le même film, à deux, ce soir`)
    expect(screen.queryByRole('region', { name: 'Ce soir en gare' })).toBeNull()
  })

  // Mutations : dans `tablesDeLaPorte`, toute table gardée ; le soir comparé au jour de l'appareil.
  it.each([
    ['d’hier', [{ ...etat(CHEZ_BOB, 'a_pris_sa_place'), soir: '2026-10-08' }]],
    ['que j’ai déclinée', [etat(CHEZ_BOB, 'a_decline')]],
  ])('une table %s n’ouvre aucune porte', async (_, tables) => {
    const { requetes, client } = monterVoyage('/voyage/1903', aTable(tables))
    await leSoir()
    await waitFor(() => expect(requetes).toContain(TABLES))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(screen.queryByText(new RegExp(MOTS_DU_WAGON.porte, 'i'))).toBeNull()
  })

  // Ce que la porte dit : l'état de l'invité, dit à l'hôte ou à l'invité ; plusieurs tables le même
  // soir, leur compte. Mutations : les phrases de l'hôte dites à l'invité ; la première table seule
  // quand il y en a plusieurs ; « a pris sa place » dit d'une invitation qui attend.
  it('dit l’état de la table à l’hôte, à l’invité, ou le compte de mes tables', () => {
    const un = (t: Table, role: 'hote' | 'invite') => ceQueDitLaPorte([{ table: t, role }])
    expect((['attend', 'a_pris_sa_place', 'a_decline'] as const).map((e) => un(etat(LA_MIENNE, e), 'hote'))).toEqual([
      'bob n’a pas encore pris sa place : le même film, à deux, ce soir',
      'bob a pris sa place : le même film, à deux, ce soir',
      'bob a rendu sa place : ta table reste dressée ce soir',
    ])
    expect((['attend', 'a_pris_sa_place'] as const).map((e) => un(etat(CHEZ_BOB, e), 'invite'))).toEqual([
      'bob t’invite à sa table : le même film, à deux, ce soir',
      'Ta place est prise à la table de bob : le même film, à deux, ce soir',
    ])
    expect(ceQueDitLaPorte([{ table: CHEZ_BOB, role: 'invite' }, { table: LA_MIENNE, role: 'hote' }])).toBe('2 tables t’attendent ce soir')
  })
})
