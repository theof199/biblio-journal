import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type Location } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Malle, RubriqueVue, Tickets, Voyageur } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { SESSION } from '../test/pageVoyage'
import { json, servir } from '../test/serveur'
import { voyage1890 } from '../test/voyage'
import type { PropsMalleDeLaSacoche } from '../voyage/sacoche/Malle'

// La malle aux étiquettes de la sacoche est une clé de gabarit **sans défaut** (`malleDeLaSacoche`,
// plan des écrans des lots, brief 2) : un monde qui ne la compose pas ne monte pas le bloc et ne lit
// rien. `VoyageSacoche.test.tsx`, monté sur 1890, compte les requêtes de la sacoche et reste vert sans
// être retouché ; ce fichier tient le bloc lecteur, sur un 1890 auquel on prête un dessin qui dit ce
// qu'il reçoit.
const SACOCHE = '/voyage/sacoche'
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const MALLE = 'GET /api/me/voyage/decennies/1890/etiquettes'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const VUE = 'POST /api/me/voyage/rubriques/etiquette/vue'
const DU_JEU = /\/etiquettes|\/voyageur|\/rubriques\//

const EN_1897 = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', recompense: null, visitee: true }], { source: null, ia: true })
const TROIS_TICKETS: Tickets = { tickets: [1898, 1899].map((a) => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null })) }
/** L'exemple du contrat : quinze places annoncées, quatre servies, la 7 collée le 29 septembre 2026 à 20 h 41 UTC. */
const LA_MALLE: Malle = { ...exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200), decennie: 1890 }
const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
/** Ma dernière visite de la malle, la veille du collage : la 7 est nouvelle. */
const AVANT = '2026-09-28T08:00:00.000Z'
const vuLe = (vueLe: string | null): Voyageur => ({ ...ETAT, rubriques: ETAT.rubriques.map((r) => (r.rubrique === 'etiquette' ? { ...r, vue_le: vueLe } : r)) })
const MARQUE: RubriqueVue = { rubrique: 'etiquette', vue_le: '2026-10-08T10:00:00.000Z' }
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)
const ROUTES = {
  'GET /api/auth/me': () => json(SESSION),
  [VOYAGE]: () => json(EN_1897),
  [TICKETS]: () => json(TROIS_TICKETS),
  [MALLE]: () => json(LA_MALLE),
  [VOYAGEUR]: () => json(vuLe(AVANT)),
  [VUE]: () => json(MARQUE),
}

/** Le dessin prêté : ce qu'il reçoit, en une ligne, et les deux gestes du calque. */
const MalleDuMonde = (p: PropsMalleDeLaSacoche) => (
  <div>
    <p data-testid="malle">{`${p.panne ? 'panne' : 'sans panne'} | ${p.malle ? `${p.malle.collees} sur ${p.malle.total}` : 'rien'} | nouvelles : ${p.nouvelles.join(' ') || 'aucune'} | ${p.ouverte ? 'ouverte' : 'fermée'}`}</p>
    <button type="button" onClick={p.ouvrir}>
      Ouvrir la malle
    </button>
    <button type="button" onClick={p.fermer}>
      Fermer la malle
    </button>
  </div>
)

/** L'adresse affichée ; `naviguer(-1)` est le retour du téléphone. */
let adresse!: Location
let naviguer!: ReturnType<typeof useNavigate>
function Adresse() {
  adresse = useLocation()
  naviguer = useNavigate()
  return null
}

function monter(routes: Record<string, (init: RequestInit) => Response | Promise<Response>> = ROUTES, historique: string[] = [SACOCHE], avant?: (client: QueryClient) => void) {
  const client = createQueryClient()
  avant?.(client)
  const requetes = servir(routes)
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={historique} initialIndex={historique.length - 1}>
        <Adresse />
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, requetes }
}

const dit = () => screen.getByTestId('malle').textContent
const tickets = async () => within(await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')).getAllByRole('listitem')
/** Pas de pause : plus aucune lecture en vol qui n'ait déjà été refusée, plus aucune écriture. */
const auCalme = (client: QueryClient) =>
  waitFor(() => expect(client.getQueryCache().getAll().filter((q) => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount === 0).length + client.isMutating()).toBe(0))
const vueEnCache = (client: QueryClient) => client.getQueryData<Voyageur>(cles.voyageur)?.rubriques.find((r) => r.rubrique === 'etiquette')?.vue_le

describe('la malle de la sacoche, une clé sans défaut', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    remettre()
    vi.unstubAllGlobals()
  })
  const preter = (gabarits: typeof PAGES_1890.gabarits) => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = gabarits
    remettre = () => void (PAGES_1890.gabarits = avant)
  }

  // Décision 1 du propriétaire : ces écrans sont de 1900 seulement. Mutations : dans `Malle.tsx`, le
  // bloc monté sans regarder la clé (un dessin de repli à la place de `gabaritSeul`) ; `gabaritSeul`
  // qui rend un composant vide au lieu de rien (la région et les lectures partiraient).
  it('un monde qui ne la compose pas ne monte rien et ne lit rien : ni la malle, ni l’état du voyageur, ni aucune marque', async () => {
    const { client, requetes } = monter()
    await tickets()
    await auCalme(client)
    expect(screen.queryByRole('region', { name: 'Malle' })).toBeNull()
    expect(requetes.filter((r) => DU_JEU.test(r))).toEqual([])
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter(Boolean)).toEqual(['La sacoche du voyageur', 'Passeport', 'Portefeuille'])
  })

  // Mutations : la malle lue à la décennie du départ et non de mon année en cours (`decennieDe(1895)`
  // est la même ici : voir le test de 1900, `mondes/1900/pages/malleDeLaSacoche.test.tsx`) ; le bloc
  // monté après le portefeuille ; `nouvelles` calculé sans `estNouveau` (toutes les places).
  it('composée, elle a sa région entre le passeport et le portefeuille, lit la malle de ma décennie et dit ce qui est nouveau', async () => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    const { client, requetes } = monter()
    const region = await screen.findByRole('region', { name: 'Malle' })
    await waitFor(() => expect(dit()).toBe('sans panne | 1 sur 15 | nouvelles : 7 | fermée'))
    expect(region).toContainElement(screen.getByTestId('malle'))
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter(Boolean)).toEqual(['La sacoche du voyageur', 'Passeport', 'Malle', 'Portefeuille'])
    await auCalme(client)
    expect(requetes.filter((r) => DU_JEU.test(r)).sort()).toEqual([MALLE, VOYAGEUR, VUE].sort())
  })

  // Décision 3 : « nouvelle » tient la visite. Le cache, lui, apprend la date du serveur (pour le point
  // rouge de la carte), et rien que ce champ. Mutations : `nouvelles` recalculé sur `voyageur.data`
  // après le `POST` (elle s'efface) ; `onSuccess` retiré (le cache garde la veille) ; la réponse du
  // `POST` posée à la place de l'état (les objets et le contrôleur disparaissent du cache).
  it('« nouvelle » ne s’efface pas sous les yeux quand la marque part ; le cache apprend la date du serveur, et elle seule', async () => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    let marquer!: (r: Response) => void
    const { client, requetes } = monter({ ...ROUTES, [VUE]: () => new Promise<Response>((r) => (marquer = r)) })
    await waitFor(() => expect(typeof marquer).toBe('function'))
    expect(dit()).toBe('sans panne | 1 sur 15 | nouvelles : 7 | fermée')
    expect(vueEnCache(client)).toBe(AVANT)
    act(() => marquer(json(MARQUE)))
    await waitFor(() => expect(vueEnCache(client)).toBe(MARQUE.vue_le))
    expect(dit()).toBe('sans panne | 1 sur 15 | nouvelles : 7 | fermée')
    expect(client.getQueryData<Voyageur>(cles.voyageur)).toEqual(vuLe(MARQUE.vue_le))
    // Une écriture au journal périme le préfixe : l'état relu porte la date neuve, la visite garde la sienne.
    await act(async () => {
      await client.invalidateQueries({ queryKey: cles.voyage })
    })
    await auCalme(client)
    expect(dit()).toBe('sans panne | 1 sur 15 | nouvelles : 7 | fermée')
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([VUE])
  })

  // Mutation : `estNouveau` remplacé par une comparaison de chaînes dans le bloc (`…:07Z` se range
  // après `…:07.500Z` dans l'ordre du texte : l'étiquette collée une demi-seconde avant ma visite
  // passerait pour nouvelle).
  it('une étiquette collée une demi-seconde avant ma visite n’est pas nouvelle : deux instants, pas deux chaînes', async () => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    const sansMillisecondes: Malle = { ...LA_MALLE, etiquettes: LA_MALLE.etiquettes.map((p) => (p.numero === 7 ? { ...p, collee_le: '2026-09-29T20:41:07Z' } : p)) }
    monter({ ...ROUTES, [MALLE]: () => json(sansMillisecondes), [VOYAGEUR]: () => json(vuLe('2026-09-29T20:41:07.500Z')) })
    await waitFor(() => expect(dit()).toBe('sans panne | 1 sur 15 | nouvelles : aucune | fermée'))
  })

  // Décision 3 : la rubrique se marque vue quand la malle est lue, la sacoche ouverte. Mutations : le
  // `POST` au montage du bloc, sans condition (il part malle en panne, et pour une décennie sans
  // malle) ; `montree` passé seul à la visite, sans la panne (la malle d'une visite d'avant, encore
  // en cache et relue en panne, se marquerait vue alors que le bloc dit sa panne).
  it.each([
    ['la malle en panne', { [MALLE]: panne('La malle est en panne.') }, 'panne | rien | nouvelles : aucune | fermée', false],
    ['la malle en panne, celle d’une visite d’avant encore en cache', { [MALLE]: panne('La malle est en panne.') }, 'panne | rien | nouvelles : aucune | fermée', true],
    ['une décennie sans malle', { [MALLE]: () => json({ decennie: 1890, total: 0, collees: 0, etiquettes: [] }) }, null, false],
    ['l’état du voyageur en panne', { [VOYAGEUR]: panne('L’état est en panne.') }, 'sans panne | 1 sur 15 | nouvelles : aucune | fermée', false],
  ])('la marque ne part pas, %s', async (_, routes, attendu, enCache) => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    // Périmée d'emblée (`updatedAt: 0`) : la sacoche la relit en s'ouvrant.
    const { client, requetes } = monter({ ...ROUTES, ...routes }, [SACOCHE], (c) => (enCache ? void c.setQueryData(cles.malle(1890), LA_MALLE, { updatedAt: 0 }) : undefined))
    await tickets()
    await auCalme(client)
    if (attendu === null) expect(screen.queryByRole('region', { name: 'Malle' })).toBeNull()
    else await waitFor(() => expect(dit()).toBe(attendu))
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })

  // Mutation : la marque relancée à chaque malle relue (le verrou retiré, l'effet rejoué par la relecture).
  it('la marque part une fois par visite, même relue, même la malle ouverte puis refermée', async () => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    const { client, requetes } = monter(ROUTES, ['/voyage', SACOCHE])
    await waitFor(() => expect(vueEnCache(client)).toBe(MARQUE.vue_le))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la malle' }))
    await waitFor(() => expect(dit()).toMatch(/ouverte$/))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la malle' }))
    await waitFor(() => expect(dit()).toMatch(/fermée$/))
    await act(async () => {
      await client.invalidateQueries({ queryKey: cles.voyage })
    })
    await auCalme(client)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([VUE])
  })

  // Règle commune 3 : une lecture en panne n'éteint que son bloc. Mutation : une garde commune aux deux blocs
  // (`throwOnError` sur la lecture de la malle : la page entière tombe).
  it('la panne de la malle n’éteint ni le portefeuille ni le passeport', async () => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    monter({ ...ROUTES, [MALLE]: panne('La malle est en panne.') })
    await waitFor(() => expect(dit()).toMatch(/^panne/))
    expect(await tickets()).toHaveLength(2)
    expect(within(screen.getByRole('region', { name: 'Portefeuille' })).queryByRole('alert')).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Passeport' })).getByRole('link')).toHaveAttribute('href', '/voyage/decennies/1890')
  })

  // Décision 2 : la malle s'ouvre dans l'adresse de la sacoche. Mutations : l'état gardé hors de
  // l'adresse (`useState` dans le bloc : le retour quitterait la sacoche pour la carte) ; `fermer` qui
  // navigue vers la carte.
  it('ouverte, la malle est dans l’adresse : le retour du téléphone la referme sans quitter la sacoche', async () => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    monter(ROUTES, ['/voyage', SACOCHE])
    await waitFor(() => expect(dit()).toMatch(/fermée$/))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la malle' }))
    await waitFor(() => expect(dit()).toMatch(/ouverte$/))
    expect(`${adresse.pathname}${adresse.search}`).toBe(`${SACOCHE}?malle=ouverte`)
    act(() => void naviguer(-1))
    await waitFor(() => expect(dit()).toMatch(/fermée$/))
    expect(`${adresse.pathname}${adresse.search}`).toBe(SACOCHE)
  })

  // Mutation : `ouverte` lu d'un état du bloc et non de l'adresse (un rechargement la refermerait).
  it('arrivée avec l’adresse, elle est ouverte, et se referme sans quitter la sacoche', async () => {
    preter({ malleDeLaSacoche: MalleDuMonde })
    monter(ROUTES, [`${SACOCHE}?malle=ouverte`])
    await waitFor(() => expect(dit()).toMatch(/ouverte$/))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la malle' }))
    await waitFor(() => expect(dit()).toMatch(/fermée$/))
    expect(`${adresse.pathname}${adresse.search}`).toBe(SACOCHE)
  })
})
