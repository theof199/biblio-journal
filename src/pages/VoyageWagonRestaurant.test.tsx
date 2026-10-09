import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Table, Tables, Tickets } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { SESSION } from '../test/pageVoyage'
import { json, servir } from '../test/serveur'
import { voyage1890 } from '../test/voyage'
import type { PropsWagonRestaurant } from '../voyage/wagon/tables'

// Le wagon-restaurant est une page à part (`/voyage/wagon-restaurant`, décision 2 du propriétaire),
// dont le dessin est une clé de gabarit **sans défaut** (`wagonRestaurant`, plan des écrans des lots,
// brief 15) : dans un monde qui ne la compose pas, la page renvoie à la carte et ne lit aucune table.
// Ce fichier tient la page, sur un 1890 auquel on prête un dessin qui dit ce qu'il reçoit. Les règles
// pures : `voyage/wagon/tables.test.ts`. Ce que 1900 en dessine : `mondes/1900/pages/wagonRestaurant.test.tsx`.
const WAGON = '/voyage/wagon-restaurant'
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const TABLES = 'GET /api/me/voyage/tables'
const PLACE = (id: string) => `POST /api/me/voyage/tables/${id}/place`
const DECLINER = (id: string) => `POST /api/me/voyage/tables/${id}/decliner`

const EN_1897 = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', recompense: null, visitee: true }], { source: null, ia: true })
const DEUX_TICKETS: Tickets = { tickets: [1898, 1899].map((a) => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null })) }
/** L'exemple du contrat : alice (la session) a dressé une table pour bob, qui attend ; bob en avait dressé une pour alice, vue ensemble. */
const EXEMPLE = exemple<Tables>('/me/voyage/tables', 'get', 200)
const ALICE = EXEMPLE.tables[0]!.hote
const BOB = EXEMPLE.tables[0]!.invite
const CAROL: Table['hote'] = { ...BOB, id: '33333333-3333-4333-8333-333333333333', pseudo: 'carol' }
const CE_SOIR = '2026-10-09'
/** Bob m'invite ce soir : j'attends. */
const INVITATION: Table = { ...EXEMPLE.tables[0]!, id: 'a1000000-0000-4000-8000-000000000001', soir: CE_SOIR, hote: BOB, invite: ALICE, etat: 'attend' }
/** Carol m'invite le même soir : une invitation qui attend n'occupe pas, plusieurs peuvent attendre. */
const AUTRE: Table = { ...INVITATION, id: 'b2000000-0000-4000-8000-000000000002', hote: CAROL }
/** J'ai dressé une table pour bob, ce soir. */
const LA_MIENNE: Table = { ...EXEMPLE.tables[0]!, id: 'c3000000-0000-4000-8000-000000000003', soir: CE_SOIR }
/** La semaine passée, chez bob : vue ensemble. */
const PASSEE: Table = EXEMPLE.tables[1]!
const MES_TABLES: Tables = { tables: [INVITATION, AUTRE, LA_MIENNE, PASSEE] }
const prise = (t: Table): Table => ({ ...t, etat: 'a_pris_sa_place' })
const declinee = (t: Table): Table => ({ ...t, etat: 'a_decline' })
// `retryable: false` : une panne relancée par TanStack attendrait trois secondes avant de se dire.
const refuse = (message: string, status: number) => () => json({ code: 'CONFLICT', message, retryable: false }, status)

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>
const c = (t: Table) => t.id.slice(0, 2)

/** Le dessin prêté : une ligne par table, ce qu'il reçoit, et les seuls gestes qu'on lui offre. */
const ligne = (t: NonNullable<PropsWagonRestaurant['tables']>[number]) =>
  [c(t.table), t.role, t.table.etat, t.passee ? 'passée' : 'ce soir', t.enCours ? 'en cours' : 'au repos', t.refus ?? 'sans refus'].join(' | ')
const WagonDuMonde = (p: PropsWagonRestaurant) => (
  <>
    <h1>Le wagon prêté</h1>
    <p data-testid="moi">{p.moi}</p>
    {p.panne ? (
      <button type="button" onClick={p.panne.reessayer}>
        Réessayer
      </button>
    ) : null}
    {p.tables?.map((t) => (
      <div key={t.table.id}>
        <p data-testid="table">{ligne(t)}</p>
        {t.gestes.prendre ? <button type="button" onClick={() => p.prendre(t.table.id)}>{`Prendre ${c(t.table)}`}</button> : null}
        {t.gestes.decliner ? <button type="button" onClick={() => p.decliner(t.table.id)}>{`Décliner ${c(t.table)}`}</button> : null}
      </div>
    ))}
  </>
)

let adresse!: Location
function Adresse() {
  adresse = useLocation()
  return null
}
const dites = () => screen.getAllByTestId('table').map((p) => p.textContent)
const gestes = () => screen.queryAllByRole('button', { name: /^(Prendre|Décliner) / }).map((b) => b.textContent)
const auRepos = (t: Table, role: string, etat = t.etat, quand = 'ce soir') => `${c(t)} | ${role} | ${etat} | ${quand} | au repos | sans refus`
const TOUTES = [auRepos(INVITATION, 'invite'), auRepos(AUTRE, 'invite'), auRepos(LA_MIENNE, 'hote'), auRepos(PASSEE, 'invite', 'a_pris_sa_place', 'passée')]
const auCalme = (client: QueryClient) =>
  waitFor(() => expect(client.getQueryCache().getAll().filter((q) => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount === 0).length + client.isMutating()).toBe(0))

describe('le wagon-restaurant, une page dont le dessin est une clé sans défaut', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers({ toFake: ['Date'] })
    // Le 9 octobre 2026, 20 h à Paris.
    vi.setSystemTime(new Date('2026-10-09T18:00:00.000Z'))
  })
  afterEach(() => {
    remettre()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const preter = () => {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { wagonRestaurant: WagonDuMonde }
    remettre = () => void (PAGES_1890.gabarits = avant)
  }
  function monter(routes: Routes = {}, entree: string[] = [WAGON]) {
    const client = createQueryClient()
    const requetes = servir({ 'GET /api/auth/me': () => json(SESSION), [VOYAGE]: () => json(EN_1897), [TABLES]: () => json(MES_TABLES), ...routes })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={entree} initialIndex={entree.length - 1}>
          <Adresse />
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    return { client, requetes }
  }
  /** Le wagon monté sur le 1890 prêté, ses tables dites par le dessin : un fait de l'écran, pas le calme du cache. */
  async function monterPrete(routes: Routes = {}, attendu: string[] = TOUTES) {
    preter()
    const banc = monter(routes)
    await waitFor(() => expect(dites()).toEqual(attendu))
    return banc
  }

  // Mutations : la ligne de la route retirée d'`App.tsx`, ou déclarée `voyage/wagon` (l'adresse tombe
  // sur `voyage/:annee`, qui ramène à la carte faute d'un millésime). **Poser la route après
  // `voyage/:annee` ne rougit pas** : React Router range ses routes par précision, pas par ordre.
  it('a sa page sous l’onglet Voyage : `wagon-restaurant` n’est pas pris pour une année, et le retour vise la carte', async () => {
    const { requetes } = await monterPrete()

    expect(screen.getByRole('region', { name: 'Le wagon-restaurant' })).toBeInTheDocument()
    expect(adresse.pathname).toBe(WAGON)
    expect(screen.getByRole('link', { name: 'Retour à la carte' })).toHaveAttribute('href', '/voyage')
    expect(screen.getByRole('link', { name: 'Voyage' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('moi')).toHaveTextContent(SESSION.user.pseudo)
    // Ni fiche d'année, ni rien d'autre du Voyage que la carte et mes tables.
    expect(requetes.filter((r) => r.includes('/me/voyage')).sort()).toEqual([VOYAGE, TABLES])
  })

  // 1890 ne compose pas la clé : la page renvoie à la carte et ne lit rien. Mutations : la lecture
  // des tables remontée dans la page, avant la clé (`GET …/tables` part) ; le renvoi retiré (l'adresse
  // reste).
  it('un membre de 1890 est renvoyé à la carte, sans qu’aucune table soit lue', async () => {
    const { client, requetes } = monter({ [TICKETS]: () => json(DEUX_TICKETS) })

    await waitFor(() => expect(adresse.pathname).toBe('/voyage'))
    // La carte est là : sa liste des années, que lit un lecteur d'écran.
    await screen.findByRole('navigation', { name: 'Les années du Voyage' })
    await auCalme(client)
    expect(requetes.filter((r) => r.includes('/tables'))).toEqual([])
    expect(screen.queryByRole('region', { name: 'Le wagon-restaurant' })).toBeNull()
  })

  // Tant que la carte n'a pas répondu, aucun monde n'est connu : rien n'est lu, rien n'est renvoyé.
  // Mutation : la lecture des tables avant la clé.
  it('n’a rien lu des tables tant que la carte n’a pas dit mon année', async () => {
    let rendre!: (r: Response) => void
    preter()
    const { requetes } = monter({ [VOYAGE]: () => new Promise<Response>((r) => (rendre = r)) })

    expect(await screen.findByRole('status')).toHaveTextContent('Chargement…')
    await waitFor(() => expect(requetes).toContain(VOYAGE))
    expect(requetes.filter((r) => r.includes('/tables'))).toEqual([])
    expect(adresse.pathname).toBe(WAGON)
    await act(async () => rendre(json(EN_1897)))
    await waitFor(() => expect(dites()).toEqual(TOUTES))
  })

  // **Plusieurs invitations peuvent attendre le même soir** : toutes, dans l'ordre servi, chacune avec
  // son rôle. Mutations : la première table seule ; les tables triées par identifiant à l'envers ; le
  // rôle non regardé (`roleA` sans l'identifiant du membre : l'hôte devient invité et reçoit les deux
  // gestes) ; le pseudo passé à la place de l'identifiant.
  it('dit toutes mes tables dans l’ordre servi, et n’offre rien à l’hôte ni sur une table passée', async () => {
    await monterPrete()

    expect(dites()).toEqual(TOUTES)
    expect(gestes()).toEqual([`Prendre ${c(INVITATION)}`, `Décliner ${c(INVITATION)}`, `Prendre ${c(AUTRE)}`, `Décliner ${c(AUTRE)}`])
  })

  // À 23 h 30 de Greenwich, c'est déjà demain à Paris : la page passe l'horloge, la règle dit le jour.
  // Mutations : `maintenant` figé à zéro ; le jour pris à Greenwich dans `soirPasse`.
  it('n’offre plus rien quand le soir est passé à Paris, même si Greenwich est encore au même jour', async () => {
    vi.setSystemTime(new Date('2026-10-09T23:30:00.000Z'))
    await monterPrete({}, [auRepos(INVITATION, 'invite', 'attend', 'passée'), auRepos(AUTRE, 'invite', 'attend', 'passée'), auRepos(LA_MIENNE, 'hote', 'attend', 'passée'), TOUTES[3]!])

    expect(gestes()).toEqual([])
  })

  // Mutations : « Prendre ma place » offert tant que le soir tient (`prendre: true`) ; « Décliner »
  // retiré dès la place prise.
  it('place prise, « Décliner » reste seul ; déclinée, plus rien', async () => {
    await monterPrete({ [TABLES]: () => json({ tables: [prise(INVITATION), declinee(AUTRE)] } satisfies Tables) }, [auRepos(INVITATION, 'invite', 'a_pris_sa_place'), auRepos(AUTRE, 'invite', 'a_decline')])

    expect(gestes()).toEqual([`Décliner ${c(INVITATION)}`])
  })

  // Mutations : le verrou `envoi` retiré (deux `POST`) ; la table rendue non posée en cache (l'état
  // reste « attend ») ; posée à la place de toutes (les autres tables disparaissent) ; le préfixe
  // `voyage` périmé, ou `cles.tables` relue (un second `GET`) ; les deux routes échangées.
  it('deux touchers sur « Prendre ma place » : un seul appel, la table rendue à sa place, rien de relu', async () => {
    let rendre!: (r: Response) => void
    const { client, requetes } = await monterPrete({ [PLACE(INVITATION.id)]: () => new Promise<Response>((r) => (rendre = r)) })

    fireEvent.click(screen.getByRole('button', { name: `Prendre ${c(INVITATION)}` }))
    fireEvent.click(screen.getByRole('button', { name: `Prendre ${c(INVITATION)}` }))
    // Un autre geste pendant l'envoi ne part pas non plus.
    fireEvent.click(screen.getByRole('button', { name: `Décliner ${c(AUTRE)}` }))
    await waitFor(() => expect(dites()[0]).toBe(`${c(INVITATION)} | invite | attend | ce soir | en cours | sans refus`))
    expect(dites().slice(1)).toEqual(TOUTES.slice(1))
    await act(async () => rendre(json(prise(INVITATION))))

    await waitFor(() => expect(dites()).toEqual([auRepos(INVITATION, 'invite', 'a_pris_sa_place'), ...TOUTES.slice(1)]))
    await auCalme(client)
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual([PLACE(INVITATION.id)])
    expect(requetes.filter((r) => r === TABLES || r === VOYAGE).sort()).toEqual([VOYAGE, TABLES])
    expect(gestes()).toEqual([`Décliner ${c(INVITATION)}`, `Prendre ${c(AUTRE)}`, `Décliner ${c(AUTRE)}`])
    // Le verrou est rendu : décliner part, par sa route.
    fireEvent.click(screen.getByRole('button', { name: `Décliner ${c(INVITATION)}` }))
    await waitFor(() => expect(requetes).toContain(DECLINER(INVITATION.id)))
  })

  // Une relecture des tables partie pendant le `POST` rendrait la table d'avant. Mutation :
  // `cancelQueries` retiré (la relecture atterrit après, et la table redevient « attend »).
  it('une relecture en vol pendant le geste est annulée : elle ne rend pas la table d’avant', async () => {
    let rendre!: (r: Response) => void
    let relire!: (r: Response) => void
    let lectures = 0
    const { client } = await monterPrete({
      [TABLES]: () => (lectures++ === 0 ? json(MES_TABLES) : new Promise<Response>((r) => (relire = r))),
      [DECLINER(AUTRE.id)]: () => new Promise<Response>((r) => (rendre = r)),
    })

    fireEvent.click(screen.getByRole('button', { name: `Décliner ${c(AUTRE)}` }))
    await waitFor(() => expect(client.isMutating()).toBe(1))
    void client.invalidateQueries({ queryKey: cles.tables, exact: true })
    await waitFor(() => expect(lectures).toBe(2))
    await act(async () => rendre(json(declinee(AUTRE))))
    await waitFor(() => expect(dites()[1]).toBe(auRepos(AUTRE, 'invite', 'a_decline')))
    await act(async () => relire(json(MES_TABLES)))
    await auCalme(client)

    expect(dites()[1]).toBe(auRepos(AUTRE, 'invite', 'a_decline'))
  })

  // **Un `409` n'est pas une panne** : les tables se relisent. **La règle a changé** (relecture du
  // groupe D) : la règle commune 4 l'emporte sur le « sans message » du brief 15, le message du serveur
  // se dit sur sa table, après la relecture, et s'efface au geste suivant. Mutations : le `409` tu
  // (la garde `status !== 409` remise devant `setRefus`) ; aucune relecture ; le préfixe `voyage`
  // relu (la carte repart) ; le refus dit sur toutes les tables ; `setRefus(null)` retiré du geste
  // suivant (le refus reste sous une table qui vient de répondre).
  it('un `409` relit les tables et dit le message du serveur sur sa table, après la relecture ; le geste suivant l’efface', async () => {
    let lectures = 0
    const DITE = `${c(INVITATION)} | invite | a_decline | ce soir | au repos | Cette table ne se reprend pas.`
    const { client, requetes } = await monterPrete({
      [TABLES]: () => json(lectures++ === 0 ? MES_TABLES : ({ tables: [declinee(INVITATION), AUTRE, LA_MIENNE, PASSEE] } satisfies Tables)),
      [PLACE(INVITATION.id)]: refuse('Cette table ne se reprend pas.', 409),
      [DECLINER(AUTRE.id)]: () => json(declinee(AUTRE)),
    })

    fireEvent.click(screen.getByRole('button', { name: `Prendre ${c(INVITATION)}` }))
    await waitFor(() => expect(dites()).toEqual([DITE, ...TOUTES.slice(1)]))
    await auCalme(client)

    expect(dites()).toEqual([DITE, ...TOUTES.slice(1)])
    expect(requetes.filter((r) => r === TABLES || r === VOYAGE).sort()).toEqual([VOYAGE, TABLES, TABLES])
    // Le verrou est rendu, et le refus d'avant s'efface.
    fireEvent.click(screen.getByRole('button', { name: `Décliner ${c(AUTRE)}` }))
    await waitFor(() => expect(dites()).toEqual([auRepos(INVITATION, 'invite', 'a_decline'), auRepos(AUTRE, 'invite', 'a_decline'), ...TOUTES.slice(2)]))
  })

  // Le cas qui ne répondait rien : je suis déjà à table ce soir, une seconde invitation attend, et
  // « Prendre ma place » y reçoit un `409` que la relecture ne change pas. Mutation : le `409` tu.
  it('« Prendre ma place » sur une seconde invitation du même soir dit pourquoi le serveur refuse', async () => {
    const { client, requetes } = await monterPrete({ [PLACE(AUTRE.id)]: refuse('Tu es déjà à table ce soir.', 409) })

    fireEvent.click(screen.getByRole('button', { name: `Prendre ${c(AUTRE)}` }))
    await waitFor(() => expect(dites()[1]).toBe(`${c(AUTRE)} | invite | attend | ce soir | au repos | Tu es déjà à table ce soir.`))
    await auCalme(client)
    expect(requetes.filter((r) => r === TABLES)).toHaveLength(2)
    expect([dites()[0], ...dites().slice(2)]).toEqual([TOUTES[0], ...TOUTES.slice(2)])
  })

  // Tout autre refus se dit, par le message du serveur, sur sa table et elle seule, et se refait.
  // Mutations : un message de repli (« Réessaie ») ; le refus dit sur toutes les tables ; le verrou
  // gardé après l'échec ; le refus gardé au geste suivant ; une relecture des tables après un `500`.
  it('une panne du geste se dit sur sa table, par le message du serveur, et le geste se refait', async () => {
    let essais = 0
    const { client, requetes } = await monterPrete({
      [DECLINER(AUTRE.id)]: () => (essais++ === 0 ? refuse('Le wagon est fermé pour travaux.', 500)() : json(declinee(AUTRE))),
    })

    fireEvent.click(screen.getByRole('button', { name: `Décliner ${c(AUTRE)}` }))
    await waitFor(() => expect(dites()[1]).toBe(`${c(AUTRE)} | invite | attend | ce soir | au repos | Le wagon est fermé pour travaux.`))
    expect([dites()[0], ...dites().slice(2)]).toEqual([TOUTES[0], ...TOUTES.slice(2)])
    await auCalme(client)
    expect(requetes.filter((r) => r === TABLES)).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: `Décliner ${c(AUTRE)}` }))
    await waitFor(() => expect(dites()[1]).toBe(auRepos(AUTRE, 'invite', 'a_decline')))
    expect(requetes.filter((r) => r === DECLINER(AUTRE.id))).toHaveLength(2)
  })

  // Mutations : la panne tue (une liste vide à la place) ; « Réessayer » qui ne relit rien.
  it('des tables en panne se disent, et se relisent', async () => {
    let lectures = 0
    preter()
    monter({ [TABLES]: () => (lectures++ === 0 ? refuse('Le wagon est fermé.', 400)() : json(MES_TABLES)) })

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(dites()).toEqual(TOUTES))
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  })
})
