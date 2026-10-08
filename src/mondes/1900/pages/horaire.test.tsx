import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FichePrete, Horaire } from '../../../api/voyage'
import { monterVoyage } from '../../../test/pageVoyage'
import { json } from '../../../test/serveur'
import { fichePrete, voyage1890 } from '../../../test/voyage'
import { arriverAvant, ceQueLeGesteAFait, enGareDe, phraseDeLHoraireManque, phraseDeLHoraireTenu } from './horaire'

/**
 * L'horaire de la gare de 1900 (plan des écrans des lots, brief 10 ; maquette, écrans 2 et 14) : ce
 * que la fiche d'une année dit de chaque état servi, dans l'app entière, le monde venu du registre.
 * Les écritures et le cache sont tenus par `pages/VoyageAnnee.horaire.test.tsx` ; ici, les mots, ce
 * qui s'offre, et où. Aucun test sur le tracé.
 */
const CARTE = 'GET /api/me/voyage'
const ANNEE = 'GET /api/me/voyage/annees/1904'
const TENIR = 'POST /api/me/voyage/annees/1904/horaire'
const RETIRER = 'DELETE /api/me/voyage/annees/1904/horaire'

const VOYAGE = voyage1890(
  1904,
  [
    { annee: 1903, statut: 'ouverte', visitee: true, recompense: 'ours', horaire: null },
    { annee: 1904, statut: 'en_cours', visitee: true, recompense: null, horaire: null },
  ],
  { ia: false, source: null, rattrape_la_source: false },
)
// Un mercredi : la base ne tient pas « un dimanche », et l'écran ne l'écrit pas d'avance.
const MERCREDI: Horaire = { echeance: '2026-10-14', accepte_le: '2026-10-12T08:00:00.000Z', etat: 'accepte' }
const fiche = (s: Partial<FichePrete> = {}): FichePrete => fichePrete({ annee: 1904, ticket: null, maturite: null, generique: null, horaire: null, horaire_proposable: null, ...s })
const PROPOSEE = fiche({ horaire_proposable: '2026-10-14' })
const ACCEPTEE = fiche({ horaire: MERCREDI })
const TENUE = fiche({ horaire: { ...MERCREDI, echeance: '2026-10-11', etat: 'tenu' }, ticket: { annee: 1905, emis_le: '2026-10-10T19:00:00.000Z', utilise_le: null } })
const MANQUEE = fiche({ horaire: { ...MERCREDI, etat: 'manque' } })

const refus = (status: number, message: string) => json({ code: status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR', message, retryable: false }, status)
const routes = (f: FichePrete, plus: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) => ({
  [CARTE]: () => json(VOYAGE),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
  [ANNEE]: () => json(f),
  ...plus,
})
const lIndicateur = () => screen.findByRole('region', { name: 'L’indicateur' })
const lHoraire = () => screen.findByRole('region', { name: 'L’horaire' })
const sansBloc = () => screen.queryByRole('region', { name: 'L’horaire' })
const talon = (nom: string) => screen.getByRole('button', { name: nom })
const talons = () => screen.queryAllByRole('button', { name: /horaire/i }).map((b) => `${b.textContent} ${b.getAttribute('aria-pressed') === 'true' ? 'enfoncé' : 'levé'}`)
const plaque = () => screen.getByRole('heading', { level: 1, name: '1904' }).parentElement!

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.clear()
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('les mots de l’horaire', () => {
  // Mutations : « dimanche » en dur dans le titre ou dans une phrase ; les deux mots d'`enGareDe`
  // échangés ; la phrase du retrait dite pour une acceptation ; une phrase dite sans geste.
  it('disent le jour de l’échéance servie, jamais « dimanche » d’avance', () => {
    expect(arriverAvant('2026-10-14')).toBe('Arriver avant mercredi 14 octobre 2026')
    expect([enGareDe(1904, false), enGareDe(1904, true)]).toEqual(['Proposé en gare de 1904', 'Accepté en gare de 1904'])
    expect(ceQueLeGesteAFait('accepte', 1904, '2026-10-14')).toBe('Horaire accepté : arriver avant mercredi 14 octobre 2026.')
    expect(ceQueLeGesteAFait('retire', 1904, null)).toBe('Sans horaire : la gare de 1904 se boucle quand tu veux, rien ne se perd.')
    expect(ceQueLeGesteAFait(null, 1904, '2026-10-14')).toBe('')
    expect(phraseDeLHoraireManque('2026-10-14')).toBe('Il fallait arriver avant mercredi 14 octobre 2026. Rien ne se perd.')
    expect(phraseDeLHoraireTenu('2026-10-14', '2026-10-13T19:00:00.000Z')).toBe('Avant mercredi 14 octobre 2026 : arrivé le mardi 13 octobre 2026.')
    // Un horaire tenu dont la fiche ne dirait pas l'arrivée : l'échéance seule, sans jour inventé.
    expect(phraseDeLHoraireTenu('2026-10-14', null)).toBe('Avant mercredi 14 octobre 2026.')
  })
})

describe('l’horaire sur la fiche d’une année 1900', () => {
  // Mutations : `Gare` qui ne rendrait plus l'horaire, ou le rangerait après le guide ; le talon
  // « Sans horaire » levé sans horaire ; les gestes des deux talons échangés (le talon enfoncé écrirait).
  it('proposé : l’affichette sous l’indicateur, avant le guide, l’échéance servie en titre, « Tenir l’horaire » à toucher', async () => {
    const { requetes } = monterVoyage('/voyage/1904', routes(PROPOSEE))
    const bloc = await lHoraire()
    expect(bloc).toHaveTextContent('Proposé en gare de 1904')
    expect(bloc).toHaveTextContent('Arriver avant mercredi 14 octobre 2026')
    expect(bloc).toHaveTextContent('Tenu, la plaque de 1904 reçoit un filet doré et la mention « à l’heure » ; manqué, rien ne se perd.')
    expect(bloc).not.toHaveTextContent(/dimanche/i)
    expect(talons()).toEqual(['Tenir l’horaire levé', 'Sans horaire enfoncé'])
    const indicateur = await lIndicateur()
    const guide = screen.getByRole('region', { name: 'Guide du voyageur' })
    expect(indicateur.compareDocumentPosition(bloc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bloc.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // La région d'état est là, vide : rien n'a été fait.
    expect(within(bloc).getByRole('status')).toHaveTextContent(/^$/)
    fireEvent.click(talon('Sans horaire'))
    await act(async () => undefined)
    expect(requetes.filter((r) => r.includes('/horaire'))).toEqual([])
    // Ni la plaque ni l'indicateur ne disent un horaire tenu.
    expect(plaque()).not.toHaveTextContent('à l’heure')
    expect(indicateur).not.toHaveTextContent('Horaire tenu')
  })

  // La demande et sa confirmation, puis le retrait. Mutations : le talon enfoncé qui écrirait
  // encore ; la région d'état jamais remplie ; « Proposé » gardé une fois accepté ; l'attente non dite
  // (`aria-disabled`, `aria-busy`).
  it('accepter puis retirer : chaque geste écrit une fois, se dit dans la région d’état, et enfonce son talon', async () => {
    let etat: 'propose' | 'accepte' | 'retire' = 'propose'
    const reponse = { rendre: (_: Response) => undefined as void }
    const { requetes } = monterVoyage(
      '/voyage/1904',
      routes(PROPOSEE, {
        [ANNEE]: () => json(etat === 'accepte' ? ACCEPTEE : etat === 'retire' ? fiche({ horaire_proposable: '2026-10-21' }) : PROPOSEE),
        [TENIR]: () => new Promise<Response>((ok) => (reponse.rendre = ok)),
        [RETIRER]: () => ((etat = 'retire'), new Response(null, { status: 204 })),
      }),
    )
    const bloc = await lHoraire()
    fireEvent.click(talon('Tenir l’horaire'))
    await waitFor(() => expect(requetes).toContain(TENIR))
    // La demande est partie : le talon se dit en attente, rien n'est encore accepté.
    expect(talon('Tenir l’horaire')).toHaveAttribute('aria-disabled', 'true')
    expect(talon('Sans horaire')).not.toHaveAttribute('aria-disabled')
    expect(bloc).toHaveAttribute('aria-busy', 'true')
    expect(bloc).toHaveTextContent('Proposé en gare de 1904')
    etat = 'accepte'
    await act(async () => reponse.rendre(json(MERCREDI, 201)))
    await waitFor(() => expect(talons()).toEqual(['Tenir l’horaire enfoncé', 'Sans horaire levé']))
    expect(bloc).toHaveTextContent('Accepté en gare de 1904')
    expect(within(bloc).getByRole('status')).toHaveTextContent('Horaire accepté : arriver avant mercredi 14 octobre 2026.')
    expect(bloc).toHaveAttribute('aria-busy', 'false')
    expect(talon('Sans horaire')).not.toHaveAttribute('aria-disabled')
    fireEvent.click(talon('Tenir l’horaire'))
    await act(async () => undefined)
    expect(requetes.filter((r) => r.includes('/horaire'))).toEqual([TENIR])
    fireEvent.click(talon('Sans horaire'))
    await waitFor(() => expect(talons()).toEqual(['Tenir l’horaire levé', 'Sans horaire enfoncé']))
    expect(within(bloc).getByRole('status')).toHaveTextContent('Sans horaire : la gare de 1904 se boucle quand tu veux, rien ne se perd.')
    expect(bloc).toHaveTextContent('Arriver avant mercredi 21 octobre 2026')
    expect(requetes.filter((r) => r === RETIRER)).toHaveLength(1)
  })

  // Mutations : dans `Tete`, la mention posée sans `aLHeure` ; dans `Indicateur`, la ligne posée sans
  // `horaireTenu` ; le bloc dessiné aussi pour un horaire tenu (il redirait l'indicateur, avec ses
  // talons) ; l'arrivée dite en heure de l'appareil (un vendredi à Los Angeles).
  it('tenu : la plaque dit « à l’heure », l’indicateur « Horaire tenu » et le jour d’arrivée à Paris, et le bloc ne dessine rien', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    monterVoyage('/voyage/1904', routes({ ...TENUE, ticket: { annee: 1905, emis_le: '2026-10-10T02:00:00.000Z', utilise_le: null } }))
    const indicateur = await lIndicateur()
    expect(indicateur).toHaveTextContent('Horaire tenu')
    expect(indicateur).toHaveTextContent('Avant dimanche 11 octobre 2026 : arrivé le samedi 10 octobre 2026.')
    expect(plaque()).toHaveTextContent('à l’heure')
    expect(sansBloc()).toBeNull()
    expect(talons()).toEqual([])
  })

  // Décision 7 : « manqué, rien ne se perd », une ligne. Mutations : les talons offerts sur un horaire
  // manqué ; la plaque « à l'heure » pour tout horaire.
  it('manqué : une ligne, « rien ne se perd », aucun talon, et la plaque ne dit rien', async () => {
    monterVoyage('/voyage/1904', routes(MANQUEE))
    const bloc = await lHoraire()
    expect(bloc).toHaveTextContent('Horaire manqué')
    expect(bloc).toHaveTextContent('Il fallait arriver avant mercredi 14 octobre 2026. Rien ne se perd.')
    expect(talons()).toEqual([])
    expect(plaque()).not.toHaveTextContent('à l’heure')
    expect(await lIndicateur()).not.toHaveTextContent('Horaire tenu')
  })

  // Mutation : le bloc monté sans horaire ni proposition (une rubrique vide).
  it('ni horaire ni proposition : aucune rubrique « L’horaire »', async () => {
    monterVoyage('/voyage/1904', routes(fiche()))
    await lIndicateur()
    expect(sansBloc()).toBeNull()
    expect(screen.queryByText(/horaire/i)).toBeNull()
  })

  // Mutations : l'alerte jamais rendue par le dessin ; un `409` dit.
  it('un refus qui porte un message se dit dans le bloc, l’affichette reste ; un 409 ne dit rien et la fiche relue l’emporte', async () => {
    let n = 0
    monterVoyage(
      '/voyage/1904',
      routes(PROPOSEE, {
        [TENIR]: () => ((n += 1), n === 1 ? refus(400, 'Cette année n’est pas du Voyage.') : refus(409, 'Cette gare a déjà son horaire : un horaire manqué ne se reprend pas.')),
        [ANNEE]: () => json(n < 2 ? PROPOSEE : MANQUEE),
      }),
    )
    const bloc = await lHoraire()
    fireEvent.click(talon('Tenir l’horaire'))
    expect(await within(bloc).findByRole('alert')).toHaveTextContent('Cette année n’est pas du Voyage.')
    expect(talons()).toEqual(['Tenir l’horaire levé', 'Sans horaire enfoncé'])
    fireEvent.click(talon('Tenir l’horaire'))
    await waitFor(() => expect(screen.getByRole('region', { name: 'L’horaire' })).toHaveTextContent('Horaire manqué'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/a déjà son horaire/)).toBeNull()
  })
})
