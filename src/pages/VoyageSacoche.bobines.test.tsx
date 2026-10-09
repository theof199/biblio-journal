import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import type { BobineRamassee, RubriqueVue, Tickets, Voyageur } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { voyage1890 } from '../test/voyage'
import type { PropsBobinesDeLaSacoche } from '../voyage/sacoche/Bobines'
import type { PropsObjetsDeLaSacoche } from '../voyage/sacoche/Objets'
import { placesDesBobines, type BobinesDUnMonde } from '../voyage/sacoche/retrouvees'

// Les bobines retrouvées de la sacoche sont une clé de gabarit **sans défaut** (`bobinesDeLaSacoche`) :
// un monde qui ne la compose pas ne monte pas le bloc et ne lit rien. `VoyageSacoche.test.tsx`, monté
// sur 1890, compte les requêtes de la sacoche et reste vert sans être retouché ; ce fichier tient la
// règle des places, puis le bloc lecteur, sur un 1890 auquel on prête un dessin qui dit ce qu'il
// reçoit. Les mots et le dessin sont au monde : `mondes/1900/pages/bobinesDeLaSacoche.test.tsx`.
const SACOCHE = '/voyage/sacoche'
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const VUE = 'POST /api/me/voyage/rubriques/bobine/vue'
const VUE_DES_OBJETS = 'POST /api/me/voyage/rubriques/objet/vue'
const DU_JEU = /\/etiquettes|\/voyageur|\/rubriques\/|\/objets\/|\/bobines\//

const EN_1897 = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', recompense: null, visitee: true }], { source: null, ia: true })
const DEUX_TICKETS: Tickets = { tickets: [1898, 1899].map((a) => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null })) }
/** L'exemple du contrat : « Les Quatre Diables » (1890) et « Hamlet » (1900) au compte, en clés du serveur ; la rubrique `bobine` jamais vue. */
const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const tenue = (cle: string, ramasseLe = '2026-10-04T20:00:00.000Z'): BobineRamassee => ({ cle, ramasse_le: ramasseLe })
/** L'état du voyageur avec ces bobines, et la rubrique `bobine` vue à cette date (nulle : jamais). */
const avec = (bobines: BobineRamassee[], vueLe: string | null = null): Voyageur => ({ ...ETAT, bobines, rubriques: ETAT.rubriques.map((r) => (r.rubrique === 'bobine' ? { ...r, vue_le: vueLe } : r)) })
const MARQUE: RubriqueVue = { rubrique: 'bobine', vue_le: '2026-10-09T10:00:00.000Z' }
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)
const ROUTES = {
  [VOYAGE]: () => json(EN_1897),
  [TICKETS]: () => json(DEUX_TICKETS),
  [VOYAGEUR]: () => json(ETAT),
  [VUE]: () => json(MARQUE),
}

/** Les dessins prêtés : ce qu'ils reçoivent, en une ligne. Une place vide n'a que sa décennie. */
const ligne = (places: PropsBobinesDeLaSacoche['places']) => (places ? places.map((p) => `${p.decennie} ${p.bobine ? `${p.bobine.cle} « ${p.bobine.titre} »` : 'vide'}${p.nouvelle ? ' nouvelle' : ''}`).join(', ') : 'rien')
const BobinesDuMonde = (p: PropsBobinesDeLaSacoche) => <p data-testid="bobines">{`${p.panne ? 'panne' : 'sans panne'} | ${ligne(p.places)}`}</p>
const ObjetsDuMonde = (p: PropsObjetsDeLaSacoche) => <p data-testid="objets">{p.objets ? p.objets.map((o) => o.cle).join(', ') : 'rien'}</p>

const dit = () => screen.getByTestId('bobines').textContent
const tickets = async () => within(await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')).getAllByRole('listitem')
/** Pas de pause : plus aucune lecture en vol qui n'ait déjà été refusée, plus aucune écriture. */
const auCalme = (client: QueryClient) =>
  waitFor(() => expect(client.getQueryCache().getAll().filter((q) => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount === 0).length + client.isMutating()).toBe(0))
const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter(Boolean)

describe('les places des bobines retrouvées', () => {
  const FOIRE: BobinesDUnMonde = { decennie: 1890, bobines: [{ cle: 'les-quatre-diables', titre: 'Les Quatre Diables', qui: 'F. W. Murnau, 1928' }, { cle: 'la-tete-de-janus', titre: 'La Tête de Janus', qui: 'F. W. Murnau, 1920' }] }
  const TRAIN: BobinesDUnMonde = { decennie: 1900, bobines: [{ cle: 'hamlet', titre: 'Hamlet', qui: 'Georges Méliès, 1907' }] }
  const VUE_LE = { vueLe: '2026-10-05T00:00:00.000Z' }

  // Mutations, dans `placesDesBobines` : la clé servie cherchée telle quelle (`t.cle === bobine.cle` :
  // « Les Quatre Diables », servie à tirets bas, resterait à trouver) ; toute place rendue trouvée
  // (`ligne` ignorée) ; les places prises sur la réponse (une place pour « metropolis ») ; un seul
  // monde gardé (`catalogue.slice(-1)` : la bobine de 1890 absente).
  it('une place par bobine des mondes traversés, dans leur ordre ; trouvée si le compte la tient, sous sa clé du monde ; une place vide ne porte ni titre ni clé ; une clé inconnue n’a pas de place', () => {
    const places = placesDesBobines([FOIRE, TRAIN], [tenue('hamlet'), tenue('metropolis'), tenue('les_quatre_diables'), tenue('hamlet')], VUE_LE)
    expect(places).toEqual([
      { decennie: 1890, bobine: FOIRE.bobines[0], nouvelle: false },
      { decennie: 1890, bobine: null, nouvelle: false },
      { decennie: 1900, bobine: TRAIN.bobines[0], nouvelle: false },
    ])
    expect(JSON.stringify(places)).not.toMatch(/_|metropolis|Janus/)
    expect(placesDesBobines([FOIRE, TRAIN], [], VUE_LE).map((p) => p.bobine)).toEqual([null, null, null])
  })

  // Mutations : « nouvelle » posée sur toute bobine trouvée ; les deux dates comparées en chaînes
  // (`ramasse_le > vueLe` : `…T00:00:00Z` passerait pour après `…T00:00:00.000Z`) ; la visite nulle
  // prise pour « jamais vue » (tout serait nouveau avant que l'état soit lu).
  it('« nouvelle » : ramassée strictement après la visite de l’arrivée, ou la rubrique jamais vue ; rien tant que la visite n’est pas lue', () => {
    const tenues = [tenue('les_quatre_diables', '2026-10-05T00:00:00Z'), tenue('la_tete_de_janus', '2026-10-05T00:00:00.001Z'), tenue('hamlet', '2026-10-04T23:59:59.000Z')]
    const nouvelles = (visite: { vueLe: string | null } | null) => placesDesBobines([FOIRE, TRAIN], tenues, visite).filter((p) => p.nouvelle).map((p) => p.bobine?.cle)
    expect(nouvelles(VUE_LE)).toEqual(['la-tete-de-janus'])
    expect(nouvelles({ vueLe: null })).toEqual(['les-quatre-diables', 'la-tete-de-janus', 'hamlet'])
    expect(nouvelles(null)).toEqual([])
  })
})

describe('les bobines retrouvées de la sacoche, une clé sans défaut', () => {
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

  // Un membre de 1890 n'a pas cette rubrique. Mutation : dans `Bobines.tsx`, le bloc monté sans
  // regarder la clé (un dessin de repli à la place de `gabaritSeul`).
  it('un monde qui ne les compose pas ne monte rien et ne lit rien : ni l’état du voyageur, ni aucune marque', async () => {
    const { client, requetes } = monterVoyage(SACOCHE, ROUTES)
    await tickets()
    await auCalme(client)
    expect(screen.queryByRole('region', { name: 'Bobines retrouvées' })).toBeNull()
    expect(requetes.filter((r) => DU_JEU.test(r))).toEqual([])
    expect(regions()).toEqual(['La sacoche du voyageur', 'Passeport', 'Portefeuille'])
  })

  // En 1897, un seul monde traversé : les trois bobines de la foire. Le compte tient « Les Quatre
  // Diables » (à tirets bas), « Hamlet » (d'un monde pas encore traversé) et une clé que personne ne
  // connaît. Mutations : le bloc monté avant les objets trouvés dans `VoyageSacoche.tsx` ; la clé
  // servie cherchée sans traduction dans `retrouvees.ts` (trois places vides) ; les bobines du seul
  // monde qui dessine remplacées par celles de tout le registre (« Hamlet » aurait sa place en 1897) ;
  // une lecture de plus dans le bloc (`lireMalle`).
  it('composées, elles ont leur région après les objets trouvés, avant les coulisses, ne lisent que l’état du voyageur et montrent ce que le compte tient, par la clé du monde', async () => {
    preter({ objetsDeLaSacoche: ObjetsDuMonde, bobinesDeLaSacoche: BobinesDuMonde })
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(avec([...ETAT.bobines, tenue('metropolis')], '2026-10-08T00:00:00.000Z')), [VUE_DES_OBJETS]: () => json({ rubrique: 'objet', vue_le: MARQUE.vue_le }) })
    const region = await screen.findByRole('region', { name: 'Bobines retrouvées' })
    await waitFor(() => expect(dit()).toBe('sans panne | 1890 les-quatre-diables « Les Quatre Diables », 1890 vide, 1890 vide'))
    expect(ETAT.bobines.map((b) => b.cle)).toEqual(['les_quatre_diables', 'hamlet'])
    expect(region).toContainElement(screen.getByTestId('bobines'))
    expect(regions()).toEqual(['La sacoche du voyageur', 'Passeport', 'Portefeuille', 'Objets trouvés', 'Bobines retrouvées'])
    const coulisses = screen.getByRole('button', { name: /Coulisses/ })
    expect(region.compareDocumentPosition(coulisses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await auCalme(client)
    expect(requetes.filter((r) => DU_JEU.test(r)).sort()).toEqual([VOYAGEUR, VUE, VUE_DES_OBJETS].sort())
    expect(requetes.filter((r) => r === VOYAGEUR)).toHaveLength(1)
  })

  // Rien avant la réponse ; un état servi sans le champ `bobines` (une API d'avant) vaut « pas lu »,
  // comme sur la carte. Mutations : la garde de l'attente retirée du bloc ; le champ absent pris pour
  // une liste vide (`?? []` : trois places « à trouver » sous un compte que personne n'a lu).
  it('tant que l’état du voyageur n’a pas répondu, ou servi sans ses bobines, la région ne paraît pas ; aucune bobine au compte, elle se montre, vide', async () => {
    preter({ bobinesDeLaSacoche: BobinesDuMonde })
    let repondre!: (r: Response) => void
    const { client } = monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => new Promise<Response>((r) => (repondre = r)) })
    await tickets()
    await waitFor(() => expect(typeof repondre).toBe('function'))
    expect(screen.queryByRole('region', { name: 'Bobines retrouvées' })).toBeNull()
    const sansLeChamp: Partial<Voyageur> = { ...ETAT }
    delete sansLeChamp.bobines
    act(() => repondre(json(sansLeChamp)))
    await auCalme(client)
    expect(screen.queryByRole('region', { name: 'Bobines retrouvées' })).toBeNull()
    await act(async () => {
      client.setQueryData(cles.voyageur, avec([]))
    })
    await waitFor(() => expect(dit()).toBe('sans panne | 1890 vide, 1890 vide, 1890 vide'))
  })

  // « Nouvelle » tient la visite, et elle seule. Le serveur retient la marque : la visite suivante lit
  // la date posée. Mutations : dans `Bobines.tsx`, « nouvelle » calculée sur le `vue_le` du cache et non
  // sur celui de l'arrivée (elle s'efface sous les yeux quand la marque revient) ; la rubrique jamais
  // marquée (`useVisiteDeRubrique('bobine', false)` : encore nouvelle à la visite suivante) ; la
  // rubrique `objet` passée au crochet (la marque des bobines ne part pas).
  it('« nouvelle » reste pendant la visite, marque partie et revenue, et n’est plus là à la visite suivante', async () => {
    preter({ bobinesDeLaSacoche: BobinesDuMonde })
    let vueLe: string | null = '2026-10-05T00:00:00.000Z'
    const routes = {
      ...ROUTES,
      [VOYAGEUR]: () => json(avec([tenue('les_quatre_diables', '2026-10-04T20:00:00.000Z'), tenue('la_tete_de_janus', '2026-10-08T20:00:00.000Z')], vueLe)),
      [VUE]: () => {
        vueLe = MARQUE.vue_le
        return json(MARQUE)
      },
    }
    const ATTENDU = 'sans panne | 1890 les-quatre-diables « Les Quatre Diables », 1890 la-tete-de-janus « La Tête de Janus » nouvelle, 1890 vide'
    const premiere = monterVoyage(SACOCHE, routes)
    await waitFor(() => expect(dit()).toBe(ATTENDU))
    await waitFor(() => expect(premiere.client.getQueryData<Voyageur>(cles.voyageur)?.rubriques.find((r) => r.rubrique === 'bobine')?.vue_le).toBe(MARQUE.vue_le))
    await auCalme(premiere.client)
    expect(dit()).toBe(ATTENDU)
    expect(premiere.requetes.filter((r) => r.startsWith('POST'))).toEqual([VUE])
    // Seule sa date a changé dans le cache.
    expect(premiere.client.getQueryData<Voyageur>(cles.voyageur)).toEqual({ ...avec([tenue('les_quatre_diables', '2026-10-04T20:00:00.000Z'), tenue('la_tete_de_janus', '2026-10-08T20:00:00.000Z')], MARQUE.vue_le) })
    premiere.unmount()
    const seconde = monterVoyage(SACOCHE, routes)
    await waitFor(() => expect(dit()).toBe('sans panne | 1890 les-quatre-diables « Les Quatre Diables », 1890 la-tete-de-janus « La Tête de Janus », 1890 vide'))
    await auCalme(seconde.client)
  })

  // Le versement de la carte date ses bobines de l'instant où il les range : la rubrique jamais
  // ouverte, elles sont toutes nouvelles, une fois (décision : rien n'est marqué vu d'office).
  it('la rubrique jamais ouverte : tout ce que le compte tient est nouveau, et la marque part', async () => {
    preter({ bobinesDeLaSacoche: BobinesDuMonde })
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(avec([tenue('londres_apres_minuit'), tenue('les_quatre_diables')])) })
    await waitFor(() => expect(dit()).toBe('sans panne | 1890 les-quatre-diables « Les Quatre Diables » nouvelle, 1890 vide, 1890 londres-apres-minuit « Londres après minuit » nouvelle'))
    await auCalme(client)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([VUE])
  })

  // La marque ne part ni en panne, ni sans bobine au compte (rien à dater), ni quand l'état d'une
  // visite d'avant, encore en cache, est relu en panne : ce que font les objets trouvés. Mutations : le
  // `POST` au montage du bloc, sans condition (`useVisiteDeRubrique('bobine', true)`) ; la condition
  // « non vide » retirée (`tenues !== null`) ; dans `visite.ts`, `!voyageur.isFetching` retiré.
  it.each([
    ['l’état du voyageur en panne', { [VOYAGEUR]: panne('L’état est en panne.') }, 'panne | rien', false],
    ['l’état en panne, celui d’une visite d’avant encore en cache', { [VOYAGEUR]: panne('L’état est en panne.') }, 'panne | rien', true],
    ['aucune bobine au compte', { [VOYAGEUR]: () => json(avec([])) }, 'sans panne | 1890 vide, 1890 vide, 1890 vide', false],
  ])('la marque ne part pas, %s', async (_, routes, attendu, enCache) => {
    preter({ bobinesDeLaSacoche: BobinesDuMonde })
    // Périmé d'emblée (`updatedAt: 0`) : la sacoche le relit en s'ouvrant.
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, ...routes }, (c) => (enCache ? void c.setQueryData(cles.voyageur, ETAT, { updatedAt: 0 }) : undefined))
    await tickets()
    await auCalme(client)
    await waitFor(() => expect(dit()).toBe(attendu))
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })

  // Une bobine d'un monde que je n'ai pas traversé, ou que personne ne connaît, n'a pas de place ici ;
  // mais le point de la carte s'allume sur toute bobine datée : la rubrique se marque vue quand même,
  // sans quoi rien ne l'éteindrait. Mutation : la marque gardée par les places trouvées
  // (`places.some((p) => p.bobine)`) et non par ce que le compte tient.
  it('une bobine sans place ici fait quand même partir la marque : c’est elle qui éteint le point de la carte', async () => {
    preter({ bobinesDeLaSacoche: BobinesDuMonde })
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(avec([tenue('metropolis')])) })
    await waitFor(() => expect(dit()).toBe('sans panne | 1890 vide, 1890 vide, 1890 vide'))
    await auCalme(client)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([VUE])
  })
})
