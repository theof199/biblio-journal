import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import type { CartePostaleEnvoyee, CartePostaleRecue, Courrier, RubriqueVue, Tickets, Voyageur } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { voyage1890 } from '../test/voyage'
import type { PropsCourrierDeLaSacoche } from '../voyage/sacoche/Courrier'
import type { PropsObjetsDeLaSacoche } from '../voyage/sacoche/Objets'

// Le courrier de la sacoche est une clé de gabarit **sans défaut** (`courrierDeLaSacoche`, plan des
// écrans des lots, brief 13) : un monde qui ne la compose pas ne monte pas le bloc et ne lit rien.
// `VoyageSacoche.test.tsx`, monté sur 1890, compte les requêtes de la sacoche et reste vert sans être
// retouché ; ce fichier tient le bloc lecteur, sur un 1890 auquel on prête un dessin qui dit ce qu'il
// reçoit. Ce que 1900 en dessine : `mondes/1900/pages/courrierDeLaSacoche.test.tsx`.
const SACOCHE = '/voyage/sacoche'
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const BOITE = 'GET /api/me/voyage/cartes-postales'
const VUE = 'POST /api/me/voyage/rubriques/courrier/vue'
const VUE_DES_OBJETS = 'POST /api/me/voyage/rubriques/objet/vue'
const LUE = (id: string) => `POST /api/me/voyage/cartes-postales/${id}/lue`
const DU_JEU = /\/etiquettes|\/voyageur|\/rubriques\/|\/objets\/|\/cartes-postales|\/tables/

const EN_1897 = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', recompense: null, visitee: true }], { source: null, ia: true })
const DEUX_TICKETS: Tickets = { tickets: [1898, 1899].map((a) => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null })) }
const ETAT = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
/** L'exemple du contrat : une carte reçue de bob (gare de 1900, déjà lue), une envoyée à bob (gare de 1901). */
const EXEMPLE = exemple<Courrier>('/me/voyage/cartes-postales', 'get', 200)
const DEJA_LUE: CartePostaleRecue = EXEMPLE.recues[0]!
/** Une carte reçue plus récente, pas encore lue : elle vient en tête, comme le serveur la range. */
const NEUVE: CartePostaleRecue = { ...DEJA_LUE, id: '5d1c7a40-2b6e-4f93-a0d8-9e3b1c6f7a54', annee: 1903, mot: 'Bien arrivé à Longueville.', postee_le: '2026-10-08T07:00:00.000Z', lue_le: null }
const ENVOYEE: CartePostaleEnvoyee = EXEMPLE.envoyees[0]!
const LA_BOITE: Courrier = { recues: [NEUVE, DEJA_LUE], envoyees: [ENVOYEE], en_attente: [1900] }
const MARQUE: RubriqueVue = { rubrique: 'courrier', vue_le: '2026-10-08T10:00:00.000Z' }
const LUE_LE = '2026-10-08T10:00:05.000Z'
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const panne = (message: string) => () => json({ code: 'VALIDATION_ERROR', message, retryable: false }, 400)
const ROUTES = {
  [VOYAGE]: () => json(EN_1897),
  [TICKETS]: () => json(DEUX_TICKETS),
  [VOYAGEUR]: () => json(ETAT),
  [BOITE]: () => json(LA_BOITE),
  [VUE]: () => json(MARQUE),
  [LUE(NEUVE.id)]: () => json({ ...NEUVE, lue_le: LUE_LE } satisfies CartePostaleRecue),
}

/**
 * Le dessin prêté : ce qu'il reçoit, en une ligne, et un bouton par carte. Il ne montre que les
 * identifiants, les sens et « nouvelle » : jamais un mot (ce que 1900 en fait est tenu chez lui).
 */
const ligne = (p: PropsCourrierDeLaSacoche) =>
  [
    p.panne ? 'panne' : 'sans panne',
    p.recues ? `reçues ${p.recues.map((c) => `${c.id.slice(0, 2)}${c.lue_le === null ? ' nouvelle' : ''}`).join(', ') || 'aucune'}` : 'rien',
    p.envoyees ? `envoyées ${p.envoyees.map((c) => c.id.slice(0, 2)).join(', ') || 'aucune'}` : 'rien',
    p.ouverte ? `ouverte ${p.ouverte.sens} ${p.ouverte.carte.id.slice(0, 2)}` : 'fermée',
  ].join(' | ')
const CourrierDuMonde = (p: PropsCourrierDeLaSacoche) => (
  <>
    <p data-testid="courrier">{ligne(p)}</p>
    {[...(p.recues ?? []), ...(p.envoyees ?? [])].map((c) => (
      <button key={c.id} type="button" onClick={() => p.ouvrir(c.id)}>{`Ouvrir ${c.id.slice(0, 2)}`}</button>
    ))}
    <button type="button" onClick={p.fermer}>
      Refermer
    </button>
    {p.panne ? (
      <button type="button" onClick={p.panne.reessayer}>
        Réessayer
      </button>
    ) : null}
  </>
)
const ObjetsDuMonde = (p: PropsObjetsDeLaSacoche) => <p data-testid="objets">{p.panne ? 'panne' : `${p.objets?.length ?? 0} objets`}</p>

const N = NEUVE.id.slice(0, 2)
const D = DEJA_LUE.id.slice(0, 2)
const E = ENVOYEE.id.slice(0, 2)
const FERMEE = `sans panne | reçues ${N} nouvelle, ${D} | envoyées ${E} | fermée`
const dit = () => screen.getByTestId('courrier').textContent
const tickets = async () => within(await within(await screen.findByRole('region', { name: 'Portefeuille' })).findByRole('list')).getAllByRole('listitem')
const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter(Boolean)
const ecrits = (requetes: string[]) => requetes.filter((r) => r.startsWith('POST'))
type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>

describe('le courrier de la sacoche, une clé sans défaut', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    remettre()
    vi.unstubAllGlobals()
  })
  const preter = (gabarits: typeof PAGES_1890.gabarits = { courrierDeLaSacoche: CourrierDuMonde }) => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = gabarits
    remettre = () => void (PAGES_1890.gabarits = avant)
  }
  /** La sacoche montée, sa boîte lue et dite par le dessin prêté : un fait de l'écran, pas le calme du cache. */
  async function monter({ routes = {}, entree = SACOCHE, attendu = FERMEE, avant }: { routes?: Routes; entree?: string | string[]; attendu?: string; avant?: (c: QueryClient) => void } = {}) {
    preter()
    const banc = monterVoyage(entree, { ...ROUTES, ...routes }, avant)
    await waitFor(() => expect(dit()).toBe(attendu))
    return banc
  }

  // Décision 1 du propriétaire : ces écrans sont de 1900 seulement. Mutation : dans `Courrier.tsx`, le
  // bloc monté sans regarder la clé (un dessin de repli à la place de `gabaritSeul`). Les routes du jeu
  // ne sont pas servies : une requête partie serait une faute du test.
  it('un monde qui ne le compose pas ne monte rien et ne lit rien : la liste entière de ses requêtes est celle d’avant', async () => {
    const { requetes } = monterVoyage(SACOCHE, { [VOYAGE]: () => json(EN_1897), [TICKETS]: () => json(DEUX_TICKETS) })
    expect(await tickets()).toHaveLength(2)
    await waitFor(() => expect(screen.getByRole('button', { name: /Coulisses/ })).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Courrier' })).toBeNull()
    expect([...requetes].sort()).toEqual(['GET /api/auth/me', VOYAGE, TICKETS].sort())
    expect(regions()).toEqual(['La sacoche du voyageur', 'Passeport', 'Portefeuille'])
  })

  // Mutations : le bloc monté après les objets trouvés dans `VoyageSacoche.tsx` ; une lecture de plus
  // dans le bloc (`lireMalle`) ; les reçues retriées par le bloc (l'ordre est celui du serveur).
  it('composé, il a sa région entre le portefeuille et les objets trouvés, ne lit que ma boîte et l’état du voyageur, et passe la boîte telle que servie', async () => {
    preter({ courrierDeLaSacoche: CourrierDuMonde, objetsDeLaSacoche: ObjetsDuMonde })
    const { requetes } = monterVoyage(SACOCHE, { ...ROUTES, [VUE_DES_OBJETS]: () => json({ rubrique: 'objet', vue_le: MARQUE.vue_le } satisfies RubriqueVue) })
    await waitFor(() => expect(dit()).toBe(FERMEE))
    await screen.findByTestId('objets')
    expect(regions()).toEqual(['La sacoche du voyageur', 'Passeport', 'Portefeuille', 'Courrier', 'Objets trouvés'])
    expect(screen.getByRole('region', { name: 'Courrier' })).toContainElement(screen.getByTestId('courrier'))
    await waitFor(() => expect(ecrits(requetes).sort()).toEqual([VUE, VUE_DES_OBJETS].sort()))
    expect(requetes.filter((r) => r.startsWith('GET') && DU_JEU.test(r)).sort()).toEqual([BOITE, VOYAGEUR].sort())
  })

  // Comme la malle et les objets : rien avant la réponse ; une boîte vide, elle, se montre, et ne
  // marque rien (rien à dater). Mutations : la garde de l'attente retirée du bloc ; la condition « une
  // carte reçue » retirée de la marque (`useVisiteDeRubrique('courrier', true)`) ; la marque partie
  // pour des envoyées seules (`recues.length + envoyees.length > 0`).
  it('tant que la boîte n’a pas répondu, la région ne paraît pas ; vide, ou sans carte reçue, elle se montre et la rubrique ne se marque pas', async () => {
    preter()
    let repondre!: (r: Response) => void
    const { requetes, client } = monterVoyage(SACOCHE, { ...ROUTES, [BOITE]: () => new Promise<Response>((r) => (repondre = r)) })
    await tickets()
    await waitFor(() => expect(typeof repondre).toBe('function'))
    await waitFor(() => expect(client.getQueryState(cles.voyageur)?.status).toBe('success'))
    expect(screen.queryByRole('region', { name: 'Courrier' })).toBeNull()
    act(() => repondre(json({ recues: [], envoyees: [], en_attente: [] } satisfies Courrier)))
    await waitFor(() => expect(dit()).toBe('sans panne | reçues aucune | envoyées aucune | fermée'))
    // Relue avec une carte envoyée, toujours sans carte reçue : la marque attend encore.
    client.setQueryData<Courrier>(cles.courrier, { recues: [], envoyees: [ENVOYEE], en_attente: [] })
    await waitFor(() => expect(dit()).toBe(`sans panne | reçues aucune | envoyées ${E} | fermée`))
    expect(ecrits(requetes)).toEqual([])
    // La première carte reçue la fait partir : la négation d'au-dessus n'était pas vraie faute de temps.
    client.setQueryData<Courrier>(cles.courrier, LA_BOITE)
    await waitFor(() => expect(ecrits(requetes)).toEqual([VUE]))
  })

  // Décision 3 : la rubrique se marque vue à l'ouverture de la sacoche, par le crochet de la malle ; le
  // cache n'apprend que la date du serveur, sur la seule rubrique `courrier`. Mutations : la rubrique
  // `objet` passée au crochet ; dans `visite.ts`, `onSuccess` remplacé par
  // `invalidateQueries({ queryKey: cles.voyage })` (la carte, les tickets et la boîte repartent).
  it('la rubrique courrier se marque vue : le cache apprend sa date, et elle seule, sans que rien soit relu', async () => {
    const { client, requetes } = await monter()
    const vues = () => client.getQueryData<Voyageur>(cles.voyageur)?.rubriques
    await waitFor(() => expect(vues()).toEqual(ETAT.rubriques.map((r) => (r.rubrique === 'courrier' ? MARQUE : r))))
    expect(ecrits(requetes)).toEqual([VUE])
    expect(requetes.filter((r) => r.startsWith('GET') && r.includes('/me/voyage')).sort()).toEqual([VOYAGE, TICKETS, VOYAGEUR, BOITE].sort())
  })

  // Règle commune 3 : une lecture en panne n'éteint que son bloc, et rien ne s'y marque. Mutations : la
  // branche de la panne retirée du bloc (il ne paraîtrait pas) ; `throwOnError` sur la lecture de la
  // boîte (la page entière tombe) ; `reessayer` qui ne relit pas.
  it('la boîte en panne se dit dans le courrier, et lui seul, sans rien marquer ; « Réessayer » la relit', async () => {
    let enPanne = true
    const { requetes } = await monter({ routes: { [BOITE]: () => (enPanne ? panne('Le courrier est en panne.')() : json(LA_BOITE)) }, attendu: 'panne | rien | rien | fermée' })
    expect(await tickets()).toHaveLength(2)
    expect(within(screen.getByRole('region', { name: 'Portefeuille' })).queryByRole('alert')).toBeNull()
    expect(ecrits(requetes)).toEqual([])
    enPanne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(dit()).toBe(FERMEE))
    await waitFor(() => expect(ecrits(requetes)).toEqual([VUE]))
  })

  // Décision 2 : une carte s'ouvre dans l'adresse de la sacoche, par son identifiant. Mutations : la
  // carte ouverte tenue dans un état du bloc (un rechargement la perdrait : le test d'après rougit).
  it('une carte s’ouvre et se referme dans l’adresse, sans quitter la sacoche ; déjà lue, elle n’écrit rien', async () => {
    const { requetes } = await monter({ entree: ['/voyage', SACOCHE] })
    fireEvent.click(screen.getByRole('button', { name: `Ouvrir ${D}` }))
    await waitFor(() => expect(dit()).toBe(`sans panne | reçues ${N} nouvelle, ${D} | envoyées ${E} | ouverte recue ${D}`))
    fireEvent.click(screen.getByRole('button', { name: 'Refermer' }))
    await waitFor(() => expect(dit()).toBe(FERMEE))
    // Refermée par le retour, la sacoche est toujours là : une seule entrée d'historique a été dépilée.
    expect(screen.getByRole('region', { name: 'La sacoche du voyageur' })).toBeInTheDocument()
    // Ni l'une ni l'autre n'était à marquer : la déjà lue ne se remarque pas.
    expect(ecrits(requetes).filter((r) => r !== VUE)).toEqual([])
  })

  // Mutations : la valeur de l'adresse ignorée (`trouver(lue, null)`) ; la première carte ouverte
  // quand l'identifiant n'est pas de la boîte.
  it.each([
    ['l’identifiant d’une carte envoyée l’ouvre, au rechargement comme au toucher', ENVOYEE.id, `sans panne | reçues ${N} nouvelle, ${D} | envoyées ${E} | ouverte envoyee ${E}`],
    ['un identifiant que la boîte ne connaît pas n’ouvre rien', '00000000-0000-4000-8000-000000000000', FERMEE],
  ])('dans l’adresse, %s, et rien ne s’écrit que la rubrique vue', async (_, id, attendu) => {
    const { requetes } = await monter({ entree: `${SACOCHE}?carte=${id}`, attendu })
    await waitFor(() => expect(ecrits(requetes)).toEqual([VUE]))
    expect(dit()).toBe(attendu)
  })

  // « Ouvrir une carte reçue la marque lue » : une fois, par la réponse du serveur, et le cache
  // n'apprend que cette carte. Mutations, dans `Courrier.tsx` : « lue » posée en cache avant la réponse
  // (`onMutate`) ; le cache laissé tel quel (`onSuccess` vidé : « nouvelle » reste après l'ouverture) ;
  // la réponse posée sur toutes les reçues (`recues.map(() => carte)`) ; `onSuccess` remplacé par
  // `invalidateQueries({ queryKey: cles.voyage })` (la carte, les tickets, l'état et la boîte repartent) ;
  // le verrou retiré (deux `POST` : le second part quand la relecture d'après rend encore `lue_le` nul).
  it('ouvrir une carte reçue la marque lue une seule fois : « nouvelle » tient jusqu’à la réponse du serveur, puis tombe, sans rien relire', async () => {
    let repondre!: (r: Response) => void
    let lecturesDeLaBoite = 0
    let relire!: (r: Response) => void
    const { client, requetes } = await monter({
      routes: {
        [LUE(NEUVE.id)]: () => new Promise<Response>((r) => (repondre = r)),
        [BOITE]: () => (++lecturesDeLaBoite === 1 ? json(LA_BOITE) : new Promise<Response>((r) => (relire = r))),
      },
    })
    await waitFor(() => expect(ecrits(requetes)).toEqual([VUE]))
    await waitFor(() => expect(client.isMutating()).toBe(0))
    const lectures = () => requetes.filter((r) => r.startsWith('GET')).length
    const avant = lectures()
    fireEvent.click(screen.getByRole('button', { name: `Ouvrir ${N}` }))
    await waitFor(() => expect(typeof repondre).toBe('function'))
    // Le `POST` est parti, le serveur n'a pas répondu : la carte est ouverte, et toujours nouvelle.
    expect(dit()).toBe(`sans panne | reçues ${N} nouvelle, ${D} | envoyées ${E} | ouverte recue ${N}`)
    // Une relecture de la boîte pendant le `POST` (une écriture d'ailleurs) rend encore `lue_le` nul :
    // la carte redevient « à marquer » au retour de la relecture, et rien ne repart.
    void client.refetchQueries({ queryKey: cles.courrier, exact: true })
    await waitFor(() => expect(lecturesDeLaBoite).toBe(2))
    await act(async () => relire(json(LA_BOITE)))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(ecrits(requetes)).toEqual([VUE, LUE(NEUVE.id)])
    act(() => repondre(json({ ...NEUVE, lue_le: LUE_LE } satisfies CartePostaleRecue)))
    await waitFor(() => expect(dit()).toBe(`sans panne | reçues ${N}, ${D} | envoyées ${E} | ouverte recue ${N}`))
    expect(client.getQueryData<Courrier>(cles.courrier)).toEqual({ ...LA_BOITE, recues: [{ ...NEUVE, lue_le: LUE_LE }, DEJA_LUE] })
    // Refermée puis rouverte : lue, elle ne se remarque pas.
    fireEvent.click(screen.getByRole('button', { name: 'Refermer' }))
    await waitFor(() => expect(dit()).toBe(`sans panne | reçues ${N}, ${D} | envoyées ${E} | fermée`))
    fireEvent.click(screen.getByRole('button', { name: `Ouvrir ${N}` }))
    await waitFor(() => expect(dit()).toContain(`ouverte recue ${N}`))
    expect(ecrits(requetes)).toEqual([VUE, LUE(NEUVE.id)])
    // Une seule relecture depuis : celle que le test a demandée. La marque n'a rien périmé.
    expect(lectures() - avant).toBe(1)
  })

  // Une relecture de la boîte partie pendant le `POST` porte la carte d'avant : atterrie après, elle
  // rendrait « nouvelle » à une carte lue. Mutation : `cancelQueries` retiré d'`onSuccess` dans `Courrier.tsx`.
  it('une relecture de la boîte partie pendant la marque et revenue après ne rend pas la carte nouvelle', async () => {
    let lectures = 0
    let relire!: (r: Response) => void
    let marquer!: (r: Response) => void
    const { client } = await monter({
      routes: { [BOITE]: () => (++lectures === 1 ? json(LA_BOITE) : new Promise<Response>((r) => (relire = r))), [LUE(NEUVE.id)]: () => new Promise<Response>((r) => (marquer = r)) },
    })
    fireEvent.click(screen.getByRole('button', { name: `Ouvrir ${N}` }))
    await waitFor(() => expect(typeof marquer).toBe('function'))
    void client.refetchQueries({ queryKey: cles.courrier, exact: true })
    await waitFor(() => expect(lectures).toBe(2))
    act(() => marquer(json({ ...NEUVE, lue_le: LUE_LE })))
    const lue = `sans panne | reçues ${N}, ${D} | envoyées ${E} | ouverte recue ${N}`
    await waitFor(() => expect(dit()).toBe(lue))
    await act(async () => relire(json(LA_BOITE)))
    await waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
    expect(dit()).toBe(lue)
  })

  // Le serveur répond `404` à qui marque une carte qu'il a envoyée, et l'expéditeur ne sait rien de sa
  // lecture. Mutations : la marque à toute ouverture, sans regarder le sens ; la marque de toute carte
  // reçue, sans regarder `lue_le`.
  it('ouvrir une carte envoyée, ou une carte reçue déjà lue, n’écrit rien', async () => {
    const { requetes } = await monter()
    await waitFor(() => expect(ecrits(requetes)).toEqual([VUE]))
    for (const [id, sens] of [[E, 'envoyee'], [D, 'recue']] as const) {
      fireEvent.click(screen.getByRole('button', { name: `Ouvrir ${id}` }))
      await waitFor(() => expect(dit()).toContain(`ouverte ${sens} ${id}`))
      fireEvent.click(screen.getByRole('button', { name: 'Refermer' }))
      await waitFor(() => expect(dit()).toBe(FERMEE))
    }
    expect(ecrits(requetes)).toEqual([VUE])
  })

  // Une panne de la marque laisse la carte nouvelle, et rejouable : sa prochaine ouverture la remarque.
  // Mutations : « lue » posée malgré l'échec (`onError` qui écrit le cache) ; le verrou gardé après
  // l'échec (`onError` retiré : la seconde ouverture n'écrit rien).
  it('la marque en panne laisse la carte nouvelle ; rouverte, elle se remarque, et tombe lue', async () => {
    let essais = 0
    const { requetes } = await monter({ routes: { [LUE(NEUVE.id)]: () => (++essais === 1 ? panne('La carte ne se marque pas.')() : json({ ...NEUVE, lue_le: LUE_LE })) } })
    fireEvent.click(screen.getByRole('button', { name: `Ouvrir ${N}` }))
    await waitFor(() => expect(essais).toBe(1))
    await waitFor(() => expect(dit()).toBe(`sans panne | reçues ${N} nouvelle, ${D} | envoyées ${E} | ouverte recue ${N}`))
    fireEvent.click(screen.getByRole('button', { name: 'Refermer' }))
    await waitFor(() => expect(dit()).toBe(FERMEE))
    expect(essais).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: `Ouvrir ${N}` }))
    await waitFor(() => expect(dit()).toBe(`sans panne | reçues ${N}, ${D} | envoyées ${E} | ouverte recue ${N}`))
    expect(ecrits(requetes).filter((r) => r !== VUE)).toEqual([LUE(NEUVE.id), LUE(NEUVE.id)])
  })

  // Une carte ouverte reste à l'écran si la relecture de la boîte tombe en panne (le dialogue ne se
  // referme pas sous le doigt), et rien ne s'y marque, ni la carte ni la rubrique : poser la réponse de
  // la carte effacerait la panne. Refermée, la panne se dit. Mutations, dans `Courrier.tsx` : `erreur`
  // lue sans regarder la carte ouverte (le dessin perd sa carte) ; `!boite.error` retiré de `aMarquer`
  // (le `POST` part après la relecture, et la panne disparaît) ; `!boite.isFetching` retiré (il part
  // pendant la relecture, même effet) ; `!boite.error` retiré de la rubrique (sa marque part).
  it('la boîte d’une visite d’avant relue en panne, une carte nouvelle ouverte : elle reste ouverte, rien ne se marque, et la panne se dit une fois refermée', async () => {
    const ouverte = `sans panne | reçues ${N} nouvelle, ${D} | envoyées ${E} | ouverte recue ${N}`
    // Périmée d'emblée (`updatedAt: 0`) : la sacoche la relit en s'ouvrant, et la relecture tombe.
    const { client, requetes } = await monter({
      routes: { [BOITE]: panne('Le courrier est en panne.') },
      entree: `${SACOCHE}?carte=${NEUVE.id}`,
      attendu: ouverte,
      avant: (c) => void c.setQueryData(cles.courrier, LA_BOITE, { updatedAt: 0 }),
    })
    await waitFor(() => expect(client.getQueryState(cles.courrier)?.status).toBe('error'))
    await waitFor(() => expect(client.getQueryState(cles.voyageur)?.status).toBe('success'))
    expect(dit()).toBe(ouverte)
    fireEvent.click(screen.getByRole('button', { name: 'Refermer' }))
    await waitFor(() => expect(dit()).toBe('panne | rien | rien | fermée'))
    expect(ecrits(requetes)).toEqual([])
  })
})
