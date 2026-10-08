import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import type { Malle, RubriqueVue, Tickets, Voyageur } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { voyage1890 } from '../test/voyage'
import type { PropsMalleDeLaSacoche } from '../voyage/sacoche/Malle'
import type { PropsObjetsDeLaSacoche } from '../voyage/sacoche/Objets'

// Les objets trouvés de la sacoche sont une clé de gabarit **sans défaut** (`objetsDeLaSacoche`, plan
// des écrans des lots, brief 3) : un monde qui ne la compose pas ne monte pas le bloc et ne lit rien.
// `VoyageSacoche.test.tsx`, monté sur 1890, compte les requêtes de la sacoche et reste vert sans être
// retouché ; ce fichier tient le bloc lecteur, sur un 1890 auquel on prête un dessin qui dit ce qu'il
// reçoit. Le catalogue, les places et les mots sont au monde : `mondes/1900/pages/objetsDeLaSacoche.test.tsx`.
const SACOCHE = '/voyage/sacoche'
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const MALLE = 'GET /api/me/voyage/decennies/1890/etiquettes'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const VUE = 'POST /api/me/voyage/rubriques/objet/vue'
const VUE_DE_LA_MALLE = 'POST /api/me/voyage/rubriques/etiquette/vue'
const DU_JEU = /\/etiquettes|\/voyageur|\/rubriques\/|\/objets\//

const EN_1897 = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', recompense: null, visitee: true }], { source: null, ia: true })
const DEUX_TICKETS: Tickets = { tickets: [1898, 1899].map((a) => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null })) }
/** L'exemple du contrat : la lanterne et le parapluie ramassés, la rubrique `objet` vue le 5 octobre 2026. */
const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const LA_MALLE: Malle = { ...exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200), decennie: 1890 }
const MARQUE: RubriqueVue = { rubrique: 'objet', vue_le: '2026-10-08T10:00:00.000Z' }
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)
const ROUTES = {
  [VOYAGE]: () => json(EN_1897),
  [TICKETS]: () => json(DEUX_TICKETS),
  [VOYAGEUR]: () => json(ETAT),
  [VUE]: () => json(MARQUE),
}
const AVEC_LA_MALLE = { ...ROUTES, [MALLE]: () => json(LA_MALLE), [VUE_DE_LA_MALLE]: () => json({ rubrique: 'etiquette', vue_le: MARQUE.vue_le } satisfies RubriqueVue) }

/** Les dessins prêtés : ce qu'ils reçoivent, en une ligne. */
const ObjetsDuMonde = (p: PropsObjetsDeLaSacoche) => <p data-testid="objets">{`${p.panne ? 'panne' : 'sans panne'} | ${p.objets ? p.objets.map((o) => `${o.cle} ${o.annee}`).join(', ') || 'aucun' : 'rien'}`}</p>
const MalleDuMonde = (p: PropsMalleDeLaSacoche) => <p data-testid="malle">{`${p.panne ? 'panne' : 'sans panne'} | ${p.malle ? `${p.malle.collees} sur ${p.malle.total}` : 'rien'}`}</p>

const dit = () => screen.getByTestId('objets').textContent
const tickets = async () => within(await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')).getAllByRole('listitem')
/** Pas de pause : plus aucune lecture en vol qui n'ait déjà été refusée, plus aucune écriture. */
const auCalme = (client: QueryClient) =>
  waitFor(() => expect(client.getQueryCache().getAll().filter((q) => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount === 0).length + client.isMutating()).toBe(0))
const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter(Boolean)

describe('les objets trouvés de la sacoche, une clé sans défaut', () => {
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

  // Décision 1 du propriétaire : ces écrans sont de 1900 seulement. Mutation : dans `Objets.tsx`, le
  // bloc monté sans regarder la clé (un dessin de repli à la place de `gabaritSeul`).
  it('un monde qui ne les compose pas ne monte rien et ne lit rien : ni l’état du voyageur, ni aucune marque', async () => {
    const { client, requetes } = monterVoyage(SACOCHE, ROUTES)
    await tickets()
    await auCalme(client)
    expect(screen.queryByRole('region', { name: 'Objets trouvés' })).toBeNull()
    expect(requetes.filter((r) => DU_JEU.test(r))).toEqual([])
    expect(regions()).toEqual(['La sacoche du voyageur', 'Passeport', 'Portefeuille'])
  })

  // Mutations : le bloc monté avant le portefeuille dans `VoyageSacoche.tsx` ; une lecture de la malle
  // de la décennie ajoutée au bloc (`lireMalle`) ; les objets filtrés par le bloc (le catalogue est au
  // monde : une clé que personne ne connaît ici passe telle quelle).
  it('composés, ils ont leur région entre le portefeuille et les coulisses, ne lisent que l’état du voyageur et passent ce qu’il sert, tel quel', async () => {
    preter({ objetsDeLaSacoche: ObjetsDuMonde })
    const inconnu: Voyageur = { ...ETAT, objets: [...ETAT.objets, { cle: 'gramophone', annee: 1911, ramasse_le: '2026-10-07T10:00:00.000Z' }] }
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => json(inconnu) })
    const region = await screen.findByRole('region', { name: 'Objets trouvés' })
    await waitFor(() => expect(dit()).toBe('sans panne | lanterne 1900, parapluie 1902, gramophone 1911'))
    expect(region).toContainElement(screen.getByTestId('objets'))
    expect(regions()).toEqual(['La sacoche du voyageur', 'Passeport', 'Portefeuille', 'Objets trouvés'])
    // Les coulisses viennent après : leur pli est le premier bouton qui suit la région.
    const coulisses = screen.getByRole('button', { name: /Coulisses/ })
    expect(region.compareDocumentPosition(coulisses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await auCalme(client)
    expect(requetes.filter((r) => DU_JEU.test(r)).sort()).toEqual([VOYAGEUR, VUE].sort())
  })

  // Comme la malle : rien avant la réponse. Mutation : la garde de l'attente retirée du bloc (la région
  // monte vide dès que le monde arrive ; deux tests de `VoyageSacoche.test.tsx`, qui comptent les
  // sections à l'arrivée en 1901, rougissent aussi).
  it('tant que l’état du voyageur n’a pas répondu, la région ne paraît pas ; une consigne vide, elle, se montre', async () => {
    preter({ objetsDeLaSacoche: ObjetsDuMonde })
    let repondre!: (r: Response) => void
    monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: () => new Promise<Response>((r) => (repondre = r)) })
    await tickets()
    await waitFor(() => expect(typeof repondre).toBe('function'))
    expect(screen.queryByRole('region', { name: 'Objets trouvés' })).toBeNull()
    expect(screen.queryByTestId('objets')).toBeNull()
    act(() => repondre(json({ ...ETAT, objets: [] })))
    await waitFor(() => expect(dit()).toBe('sans panne | aucun'))
  })

  // Décision 3 : la rubrique se marque vue à l'ouverture de la sacoche, par le crochet de la malle. Le
  // cache n'apprend que la date du serveur, et sur la seule rubrique `objet` : une écriture de l'état
  // du voyageur ne périme pas le préfixe `voyage`. Mutations : dans `Objets.tsx`, la rubrique
  // `etiquette` passée au crochet (le `POST` de la malle part, pas le sien) ; dans `visite.ts`,
  // `onSuccess` remplacé par `invalidateQueries({ queryKey: cles.voyage })` (la carte et les tickets
  // repartent) ; la marque relancée chaque fois que le bloc remontre la rubrique (le verrou retiré).
  it('la rubrique objet se marque vue une fois par visite : le cache apprend sa date, et elle seule, sans que rien soit relu', async () => {
    preter({ objetsDeLaSacoche: ObjetsDuMonde })
    // La relecture tombe en panne, puis revient avec un objet de plus : le bloc cesse de montrer la
    // rubrique, puis la montre de nouveau, dans la même visite.
    let lectures = 0
    const melon = { cle: 'melon', annee: 1901, ramasse_le: '2026-10-08T09:00:00.000Z' }
    const lire = () => (++lectures === 1 ? json(ETAT) : lectures === 2 ? panne('L’état est en panne.')() : json({ ...ETAT, objets: [...ETAT.objets, melon] }))
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, [VOYAGEUR]: lire })
    const vueEnCache = () => client.getQueryData<Voyageur>(cles.voyageur)?.rubriques.find((r) => r.rubrique === 'objet')?.vue_le
    await waitFor(() => expect(vueEnCache()).toBe(MARQUE.vue_le))
    await auCalme(client)
    expect(client.getQueryData<Voyageur>(cles.voyageur)).toEqual({ ...ETAT, rubriques: ETAT.rubriques.map((r) => (r.rubrique === 'objet' ? MARQUE : r)) })
    expect(requetes.filter((r) => r.startsWith('GET') && r.includes('/me/voyage')).sort()).toEqual([VOYAGE, TICKETS, VOYAGEUR].sort())
    // Une écriture au journal périme le préfixe : l'état est relu, la marque ne repart pas.
    await act(async () => {
      await client.invalidateQueries({ queryKey: cles.voyage })
    })
    await waitFor(() => expect(dit()).toBe('panne | rien'))
    await act(async () => {
      await client.refetchQueries({ queryKey: cles.voyageur, exact: true })
    })
    await waitFor(() => expect(dit()).toBe('sans panne | lanterne 1900, parapluie 1902, melon 1901'))
    await auCalme(client)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([VUE])
  })

  // La marque ne part ni en panne, ni pour une consigne vide (rien à dater), ni quand l'état d'une
  // visite d'avant, encore en cache, est relu en panne. Mutations : le `POST` au montage du bloc, sans
  // condition (`useVisiteDeRubrique('objet', true)`) ; la condition « non vide » retirée ; la marque
  // partie pendant la relecture (`!voyageur.isFetching` retiré : elle part sur l'état en cache, et son
  // `POST` réussi efface la panne de la relecture).
  it.each([
    ['l’état du voyageur en panne', { [VOYAGEUR]: panne('L’état est en panne.') }, 'panne | rien', false],
    ['l’état en panne, celui d’une visite d’avant encore en cache', { [VOYAGEUR]: panne('L’état est en panne.') }, 'panne | rien', true],
    ['rien de ramassé encore', { [VOYAGEUR]: () => json({ ...ETAT, objets: [] }) }, 'sans panne | aucun', false],
  ])('la marque ne part pas, %s', async (_, routes, attendu, enCache) => {
    preter({ objetsDeLaSacoche: ObjetsDuMonde })
    // Périmé d'emblée (`updatedAt: 0`) : la sacoche le relit en s'ouvrant.
    const { client, requetes } = monterVoyage(SACOCHE, { ...ROUTES, ...routes }, (c) => (enCache ? void c.setQueryData(cles.voyageur, ETAT, { updatedAt: 0 }) : undefined))
    await tickets()
    await auCalme(client)
    await waitFor(() => expect(dit()).toBe(attendu))
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })

  // Règle commune 3 : une lecture en panne n'éteint que son bloc. La malle lit le même état, pour ce
  // qui y est nouveau : elle garde sa ligne. Mutations : une garde commune (`throwOnError` sur la
  // lecture de l'état dans `Objets.tsx` : la page entière tombe) ; dans `Malle.tsx`, la malle rendue
  // nulle tant que la visite l'est (`lue && visite ? … : null` : elle attendrait un état qui ne vient pas).
  it('la panne de l’état du voyageur se dit chez les objets trouvés, et n’éteint ni la malle ni le portefeuille', async () => {
    preter({ objetsDeLaSacoche: ObjetsDuMonde, malleDeLaSacoche: MalleDuMonde })
    const { client, requetes } = monterVoyage(SACOCHE, { ...AVEC_LA_MALLE, [VOYAGEUR]: panne('L’état est en panne.') })
    await waitFor(() => expect(dit()).toBe('panne | rien'))
    await waitFor(() => expect(screen.getByTestId('malle')).toHaveTextContent('sans panne | 1 sur 15'))
    expect(await tickets()).toHaveLength(2)
    expect(within(screen.getByRole('region', { name: 'Portefeuille' })).queryByRole('alert')).toBeNull()
    expect(regions()).toEqual(['La sacoche du voyageur', 'Passeport', 'Malle', 'Portefeuille', 'Objets trouvés'])
    await auCalme(client)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([])
  })

  // Les deux rubriques montées ensemble : une seule lecture de l'état, chacune sa marque, et chaque
  // marque ne pose que son champ. Mutation : dans `visite.ts`, la réponse du `POST` posée sur toutes
  // les rubriques (`rubriques.map(() => vue)` : la seconde marque écraserait la première).
  it('avec la malle, l’état n’est lu qu’une fois et chaque rubrique garde sa date', async () => {
    preter({ objetsDeLaSacoche: ObjetsDuMonde, malleDeLaSacoche: MalleDuMonde })
    const { client, requetes } = monterVoyage(SACOCHE, AVEC_LA_MALLE)
    await waitFor(() => expect(dit()).toBe('sans panne | lanterne 1900, parapluie 1902'))
    await auCalme(client)
    expect(requetes.filter((r) => r === VOYAGEUR)).toHaveLength(1)
    expect(requetes.filter((r) => r.startsWith('POST')).sort()).toEqual([VUE_DE_LA_MALLE, VUE].sort())
    expect(client.getQueryData<Voyageur>(cles.voyageur)?.rubriques).toEqual(
      ETAT.rubriques.map((r) => (r.rubrique === 'objet' ? MARQUE : r.rubrique === 'etiquette' ? { rubrique: 'etiquette', vue_le: MARQUE.vue_le } : r)),
    )
  })
})
