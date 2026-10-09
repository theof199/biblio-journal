import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'
import type { Abonnement } from '../api/abonnements'
import { cles } from '../api/cles'
import type { CartePostaleEnvoyee, Courrier, Tickets, Voyageur } from '../api/voyage'
import { PAGES_1890 } from '../mondes/1890/pages'
import { exemple } from '../test/contrat'
import { monterVoyage } from '../test/pageVoyage'
import { json } from '../test/serveur'
import { voyage1890 } from '../test/voyage'
import type { PropsCourrierDeLaSacoche } from '../voyage/sacoche/Courrier'
import { MOT_MAX } from '../voyage/sacoche/mot'

// Écrire une carte postale (plan des écrans des lots, brief 14) : ce que le bloc lecteur du courrier
// tient, sur un 1890 auquel on prête un dessin qui dit ce qu'il reçoit et pose les gestes. Ce que 1900
// en dessine (le champ, le compte, la confirmation) : `mondes/1900/pages/courrierDeLaSacoche.test.tsx`.
// `VoyageSacoche.courrier.test.tsx` tient le courrier reçu, et qu'un monde sans dessin ne lit rien.
const SACOCHE = '/voyage/sacoche'
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const VOYAGEUR = 'GET /api/me/voyage/voyageur'
const BOITE = 'GET /api/me/voyage/cartes-postales'
const POSTER = 'POST /api/me/voyage/cartes-postales'
const ABONNEMENTS = 'GET /api/users/me/following?limit=100'
const SUITE = 'GET /api/users/me/following?limit=100&cursor=suite'

const EN_1897 = voyage1890(1897, [{ annee: 1897, statut: 'en_cours', recompense: null, visitee: true }], { source: null, ia: true })
const DEUX_TICKETS: Tickets = { tickets: [1898, 1899].map((a) => ({ annee: a, motif: `Vers ${a}.`, emis_le: '2026-09-01T18:00:00.000Z', montre_le: null, utilise_le: null })) }
/** L'exemple du contrat : une carte envoyée à bob, de ma gare de 1901. Deux gares attendent la leur, pas 1901. */
const ENVOYEE: CartePostaleEnvoyee = exemple<Courrier>('/me/voyage/cartes-postales', 'get', 200).envoyees[0]!
const LA_BOITE: Courrier = { recues: [], envoyees: [ENVOYEE], en_attente: [1900, 1902] }
type Page = { items: { user: Abonnement }[]; next_cursor: string | null }
const [LIGNE_DE_BOB, LIGNE_DE_CAMILLE] = exemple<Page>('/users/{id}/following', 'get', 200).items as [Page['items'][number], Page['items'][number]]
const BOB = LIGNE_DE_BOB.user
const MOT = 'Bien arrivé à Paris.'
/** Ce que le serveur rend : la gare du destinataire, la date et l'expéditeur sont les siens. */
const POSTEE: CartePostaleEnvoyee = { ...ENVOYEE, id: '7f3e9c62-2b6e-4f93-a0d8-9e3b1c6f7a54', annee: 1900, gare_destinataire: 1903, mot: MOT, postee_le: '2026-10-09T08:00:00.000Z' }
const refuse = (status: number, message: string) => () => json({ code: status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR', message, retryable: false }, status)
type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>
const ROUTES: Routes = {
  [VOYAGE]: () => json(EN_1897),
  [TICKETS]: () => json(DEUX_TICKETS),
  [VOYAGEUR]: () => json(exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)),
  [BOITE]: () => json(LA_BOITE),
  // Deux pages : camille n'est que sur la seconde.
  [ABONNEMENTS]: () => json({ items: [LIGNE_DE_BOB], next_cursor: 'suite' }),
  [SUITE]: () => json({ items: [LIGNE_DE_CAMILLE], next_cursor: null }),
  [POSTER]: () => json(POSTEE, 201),
}

/** Le dessin prêté : ce qu'il reçoit, en une ligne (jamais un mot de carte), et un bouton par geste. */
const ligne = (p: PropsCourrierDeLaSacoche) => {
  const e = p.aEcrire
  return [
    p.enAttente ? `à écrire ${p.enAttente.join(', ') || 'aucune'}` : 'rien',
    p.envoyees ? `envoyées ${p.envoyees.map((c) => c.annee).join(', ') || 'aucune'}` : 'rien',
    p.ouverte
      ? `ouverte ${p.ouverte.sens} ${p.ouverte.carte.annee}${p.vientDePartir ? ' qui vient de partir' : ''}`
      : e
        ? `écrit ${e.annee}, signé ${e.moi}, à ${e.abonnements ? `[${e.abonnements.map((a) => a.pseudo).join(', ')}]` : 'personne encore'}${e.panne ? ', en panne' : ''}${e.enCours ? ', en cours' : ''}${e.refus ? `, refus « ${e.refus} »` : ''}`
        : 'fermée',
    p.refus ? `refus « ${p.refus} »` : 'sans refus',
  ].join(' | ')
}
/** L'adresse de la sacoche, et le bouton « suivant » du navigateur. */
function Historique() {
  const naviguer = useNavigate()
  return (
    <>
      <p data-testid="adresse">{useLocation().search}</p>
      <button type="button" onClick={() => naviguer(1)}>
        Suivant
      </button>
    </>
  )
}
const CourrierDuMonde = (p: PropsCourrierDeLaSacoche) => (
  <>
    <Historique />
    <p data-testid="courrier">{ligne(p)}</p>
    {/* Le brouillon ne vit que dans le dessin, le temps de sa carte à écrire : démontée, il est perdu. */}
    {p.aEcrire ? <input aria-label="Brouillon" defaultValue="" /> : null}
    {[1900, 1901, 1902].map((a) => (
      <button key={a} type="button" onClick={() => p.ecrire(a)}>{`Écrire ${a}`}</button>
    ))}
    <button type="button" onClick={() => p.aEcrire?.poster(BOB.id, MOT)}>
      Poster
    </button>
    <button
      type="button"
      onClick={() => {
        p.aEcrire?.poster(BOB.id, MOT)
        p.aEcrire?.poster(BOB.id, MOT)
      }}
    >
      Poster deux fois
    </button>
    <button type="button" onClick={() => p.aEcrire?.poster(BOB.id, '   ')}>
      Poster du vide
    </button>
    <button type="button" onClick={() => p.aEcrire?.poster(BOB.id, 'm'.repeat(MOT_MAX + 1))}>
      Poster trop long
    </button>
    <button type="button" onClick={p.fermer}>
      Refermer
    </button>
    {p.aEcrire?.panne ? (
      <button type="button" onClick={p.aEcrire.panne.reessayer}>
        Réessayer
      </button>
    ) : null}
  </>
)

const FERMEE = 'à écrire 1900, 1902 | envoyées 1901 | fermée | sans refus'
const A_ECRIRE = 'à écrire 1900, 1902 | envoyées 1901 | écrit 1900, signé alice, à [bob, camille] | sans refus'
const dit = () => screen.getByTestId('courrier').textContent
const toucher = (nom: string) => fireEvent.click(screen.getByRole('button', { name: nom }))
const parties = (requetes: string[], route: string) => requetes.filter((r) => r === route).length
const auCalme = (client: QueryClient) => waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))

describe('écrire une carte postale, dans le bloc du courrier', () => {
  let remettre = () => undefined as void
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    remettre()
    vi.unstubAllGlobals()
  })
  /** La sacoche montée sur le dessin prêté, la boîte lue ; `corps` garde ce que chaque `POST` de carte a porté. */
  async function monter({ routes = {}, entree = SACOCHE, attendu = FERMEE }: { routes?: Routes; entree?: string | string[]; attendu?: string } = {}) {
    const avant = PAGES_1890.gabarits
    PAGES_1890.gabarits = { courrierDeLaSacoche: CourrierDuMonde }
    remettre = () => void (PAGES_1890.gabarits = avant)
    const corps: unknown[] = []
    const poster = routes[POSTER] ?? ROUTES[POSTER]!
    const banc = monterVoyage(entree, {
      ...ROUTES,
      ...routes,
      [POSTER]: (init) => {
        corps.push(JSON.parse(String(init.body)))
        return poster(init)
      },
    })
    await waitFor(() => expect(dit()).toBe(attendu))
    return { ...banc, corps }
  }

  // « Une entrée par gare de `en_attente`, et pour elles seules. » 1901 a déjà envoyé sa carte.
  // Mutations, dans `Courrier.tsx` : la garde `en_attente.includes` retirée (toute année de l'adresse
  // ouvre une carte à écrire : toutes mes gares bouclées, et les autres) ; `enAttente` complété des
  // gares des cartes envoyées ; mes abonnements lus au montage du bloc (`enabled` retiré).
  it('passe `en_attente` telle que servie ; une gare qui n’attend pas de carte n’ouvre rien, par le geste comme par l’adresse, et rien n’est lu de mes abonnements', async () => {
    const { requetes, client } = await monter({ entree: `${SACOCHE}?ecrire=1901` })
    await auCalme(client)
    toucher('Écrire 1901')
    await auCalme(client)
    expect(dit()).toBe(FERMEE)
    expect(requetes.filter((r) => r.includes('/following') || r === POSTER)).toEqual([])
  })

  // Le calque d'écriture est dans l'adresse, comme celui d'une carte : le retour le referme, un
  // rechargement le rouvre. Mutations : la carte à écrire tenue dans un état du bloc (l'adresse ne
  // l'ouvre plus) ; la première page de mes abonnements seule (`[bob]`) ; le pseudo de la session
  // remplacé par celui d'un abonné.
  it('l’adresse qui porte l’année d’une gare en attente ouvre sa carte à écrire : mes abonnements se lisent alors, toutes pages, et le retour la referme sans quitter la sacoche', async () => {
    const { requetes } = await monter({ entree: ['/voyage', SACOCHE] })
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
    expect(requetes.filter((r) => r.includes('/following'))).toEqual([ABONNEMENTS, SUITE])
    toucher('Refermer')
    await waitFor(() => expect(dit()).toBe(FERMEE))
    expect(screen.getByRole('region', { name: 'La sacoche du voyageur' })).toBeInTheDocument()
    expect(parties(requetes, POSTER)).toBe(0)
  })
  it('un rechargement rouvre la carte à écrire', async () => {
    await monter({ entree: `${SACOCHE}?ecrire=1900`, attendu: A_ECRIRE })
  })

  // Une carte ne se corrige ni ne se retire : deux touchers ne font qu'un envoi. Le corps est strict
  // côté serveur. Postée, la gare quitte `en_attente` et la carte passe aux envoyées, rangée par gare,
  // sans que rien soit relu. Mutations : le verrou retiré (`envoi.current` jamais posé : deux `POST`) ;
  // un champ de plus au corps (`postee_le`, `expediteur_id`) ; `onSuccess` vidé (ni cache ni
  // relecture : la gare reste proposée, la carte à écrire aussi) ; `en_attente` laissée telle quelle ;
  // la carte posée en tête des envoyées ; le préfixe `voyage` périmé (la carte et les tickets relus) ;
  // `invalidateQueries` de la boîte après le `201` (une lecture de plus).
  it('poster part une seule fois pour deux touchers, avec `annee`, `destinataire_id` et `mot`, rien d’autre ; la carte rendue s’ouvre tamponnée, passe aux envoyées et sa gare quitte la liste, sans rien relire', async () => {
    const { requetes, corps, client } = await monter({ entree: `${SACOCHE}?ecrire=1900`, attendu: A_ECRIRE })
    toucher('Poster deux fois')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | ouverte envoyee 1900 qui vient de partir | sans refus'))
    await auCalme(client)
    expect(corps).toEqual([{ annee: 1900, destinataire_id: BOB.id, mot: MOT }])
    expect([VOYAGE, TICKETS, BOITE, VOYAGEUR].map((r) => parties(requetes, r))).toEqual([1, 1, 1, 1])
    toucher('Refermer')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | fermée | sans refus'))
    // Sa gare n'attend plus rien : son adresse ne rouvre ni carte à écrire ni la carte postée (**la
    // règle a changé**, relecture du groupe D : son calque quitté, elle ne se remontre plus), et rien
    // ne repart.
    toucher('Écrire 1900')
    await waitFor(() => expect(screen.getByTestId('adresse').textContent).toBe('?ecrire=1900'))
    expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | fermée | sans refus')
    toucher('Poster')
    await auCalme(client)
    expect(parties(requetes, POSTER)).toBe(1)
  })

  // La carte postée ne se remontre que tant que son calque n'a pas été quitté : refermée, le bouton
  // « suivant » du navigateur ramène l'adresse de sa gare, pas la carte « qui vient de partir ».
  // Mutation, dans `Courrier.tsx` : l'effet qui oublie l'envoi retiré (`oublier()`).
  it('la carte postée, refermée, ne revient pas par le bouton « suivant » du navigateur', async () => {
    await monter({ entree: ['/voyage', SACOCHE] })
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
    toucher('Poster')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | ouverte envoyee 1900 qui vient de partir | sans refus'))
    toucher('Refermer')
    await waitFor(() => expect(screen.getByTestId('adresse').textContent).toBe(''))
    expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | fermée | sans refus')
    toucher('Suivant')
    await waitFor(() => expect(screen.getByTestId('adresse').textContent).toBe('?ecrire=1900'))
    expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | fermée | sans refus')
  })

  // **Une gare de `en_attente` montre toujours sa carte à écrire** : le compte du destinataire
  // supprimé rouvre la gare de l'expéditeur, et la carte « qui vient de partir », encore à l'écran, ne
  // doit pas masquer celle qui est à réécrire. Mutation : `!lue?.en_attente.includes(gare)` retiré de
  // `partie` (la carte partie reste à l'écran, la gare ne se réécrit pas tant que la sacoche est montée).
  it('une gare revenue dans `en_attente` montre sa carte à écrire, même sous la carte qui vient de partir', async () => {
    let boite = LA_BOITE
    const { client } = await monter({ entree: `${SACOCHE}?ecrire=1900`, attendu: A_ECRIRE, routes: { [BOITE]: () => json(boite) } })
    toucher('Poster')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | ouverte envoyee 1900 qui vient de partir | sans refus'))
    await auCalme(client)
    // Le serveur a rouvert la gare : la boîte relue ne connaît plus la carte, et attend celle de 1900.
    boite = { ...LA_BOITE }
    await act(async () => void client.invalidateQueries({ queryKey: cles.courrier, exact: true }))
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
  })

  // Une relecture de la boîte partie pendant le `POST`, donc plus ancienne que la carte postée,
  // rendrait la gare à `en_attente` et retirerait la carte des envoyées. Mutation : `cancelQueries`
  // retiré de `onSuccess` (la relecture atterrit après, et la carte redevient à écrire).
  it('une relecture de la boîte en vol pendant l’envoi est annulée : elle n’écrase pas la carte postée', async () => {
    let rendre!: (r: Response) => void
    let relire!: (r: Response) => void
    let lectures = 0
    const { client } = await monter({
      entree: `${SACOCHE}?ecrire=1900`,
      attendu: A_ECRIRE,
      routes: {
        [BOITE]: () => (lectures++ === 0 ? json(LA_BOITE) : new Promise<Response>((r) => (relire = r))),
        [POSTER]: () => new Promise<Response>((r) => (rendre = r)),
      },
    })
    await auCalme(client)
    toucher('Poster')
    await waitFor(() => expect(client.isMutating()).toBe(1))
    void client.invalidateQueries({ queryKey: cles.courrier, exact: true })
    await waitFor(() => expect(lectures).toBe(2))
    await act(async () => rendre(json(POSTEE, 201)))
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | ouverte envoyee 1900 qui vient de partir | sans refus'))
    await act(async () => relire(json(LA_BOITE)))
    await auCalme(client)
    expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | ouverte envoyee 1900 qui vient de partir | sans refus')
  })

  // Aucune page hors Voyage ne périme mes abonnements : ils se relisent à chaque ouverture d'une carte
  // à écrire, et un abonnement pris entre deux ouvertures paraît. Mutation : `staleTime: 0` retiré
  // (trente secondes de fraîcheur par défaut : la seconde ouverture ne lit rien, dan manque).
  it('mes abonnements se relisent à chaque ouverture : un membre suivi entre deux cartes paraît', async () => {
    const DAN = { ...LIGNE_DE_CAMILLE, user: { ...LIGNE_DE_CAMILLE.user, id: '44444444-4444-4444-8444-444444444444', pseudo: 'dan' } }
    let suite = [LIGNE_DE_CAMILLE]
    const { requetes } = await monter({ entree: ['/voyage', SACOCHE], routes: { [SUITE]: () => json({ items: suite, next_cursor: null }) } })
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
    toucher('Refermer')
    await waitFor(() => expect(dit()).toBe(FERMEE))
    suite = [LIGNE_DE_CAMILLE, DAN]
    toucher('Écrire 1902')
    await waitFor(() => expect(dit()).toBe('à écrire 1900, 1902 | envoyées 1901 | écrit 1902, signé alice, à [bob, camille, dan] | sans refus'))
    expect(requetes.filter((r) => r.includes('/following'))).toEqual([ABONNEMENTS, SUITE, ABONNEMENTS, SUITE])
  })

  // Le serveur refuse par `409` une carte pour un compte désactivé, et ce `409` ferme la carte en
  // perdant le brouillon : un membre désactivé n'est pas proposé (`api/abonnements.ts`, la règle des
  // deux écrans) ; s'il ne reste personne, la liste est vide, comme sans abonnement. Mutation : le
  // filtre retiré de `lireMesAbonnements`.
  it('un membre désactivé n’est pas proposé ; s’il ne reste personne, la carte n’offre personne', async () => {
    const eteint = (l: Page['items'][number]) => ({ ...l, user: { ...l.user, deactivated: true } })
    let suite = [LIGNE_DE_CAMILLE]
    await monter({
      entree: ['/voyage', SACOCHE],
      routes: { [ABONNEMENTS]: () => json({ items: [eteint(LIGNE_DE_BOB)], next_cursor: 'suite' }), [SUITE]: () => json({ items: suite, next_cursor: null }) },
    })
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe('à écrire 1900, 1902 | envoyées 1901 | écrit 1900, signé alice, à [camille] | sans refus'))
    toucher('Refermer')
    await waitFor(() => expect(dit()).toBe(FERMEE))
    suite = [eteint(LIGNE_DE_CAMILLE)]
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe('à écrire 1900, 1902 | envoyées 1901 | écrit 1900, signé alice, à [] | sans refus'))
  })

  // « L'appli borne la longueur et refuse le vide », et rien de plus. Mutations : `motPostable` retiré
  // de `poster` (le mot d'espaces part) ; sa borne retirée (`mot.length <= MOT_MAX`).
  it('un mot vide ou de plus de 140 signes ne part pas', async () => {
    const { corps, client } = await monter({ entree: `${SACOCHE}?ecrire=1900`, attendu: A_ECRIRE })
    toucher('Poster du vide')
    await auCalme(client)
    toucher('Poster trop long')
    await auCalme(client)
    expect(corps).toEqual([])
    expect(dit()).toBe(A_ECRIRE)
  })

  // Règle commune 4 : le message du serveur, tel quel. Un `400` laisse la carte à écrire et relit la
  // boîte ; une panne ne relit rien ; le verrou est rendu, la carte repart. Mutations : le repli
  // (« Réessaie. » à la place de `e.message`) ; la carte refermée sur toute erreur ; la relecture
  // retirée de `onError` ; la relecture pour toute erreur ; le verrou gardé après un refus
  // (`onSettled` retiré : le second envoi ne part pas).
  it.each([
    [400, 'Le mot tient sur une ligne.', 2],
    [500, 'Le bureau de poste est fermé.', 1],
  ])('un `%i` se dit sur la carte avec le message du serveur, la carte reste à écrire, et elle repart', async (status, message, lectures) => {
    let refus = true
    const { requetes, corps, client } = await monter({ entree: `${SACOCHE}?ecrire=1900`, attendu: A_ECRIRE, routes: { [POSTER]: () => (refus ? refuse(status, message)() : json(POSTEE, 201)) } })
    toucher('Poster')
    await waitFor(() => expect(dit()).toBe(`à écrire 1900, 1902 | envoyées 1901 | écrit 1900, signé alice, à [bob, camille], refus « ${message} » | sans refus`))
    await auCalme(client)
    expect(parties(requetes, BOITE)).toBe(lectures)
    expect(parties(requetes, VOYAGE)).toBe(1)
    refus = false
    toucher('Poster')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | ouverte envoyee 1900 qui vient de partir | sans refus'))
    expect(corps).toHaveLength(2)
  })

  // Un `409` n'est pas une panne, et il a deux causes (la règle a changé le 9 octobre 2026 : ce test
  // tenait « un `409` referme la carte », quelle qu'en soit la cause). **La gare a déjà sa carte**
  // (postée d'un autre appareil) : la boîte relue ne l'attend plus, la carte se referme, le message
  // se dit sur la rubrique. La boîte d'avant, en cache, attendait encore 1900 : la décision se prend
  // sur la boîte relue. Mutations : la carte jamais refermée (le `409` traité comme un `400`) ; la
  // décision prise avant la relecture (la promesse non rendue par `onError` : la carte reste) ; la
  // fermeture sans relecture ; le message perdu à la fermeture (`setRefus` retiré du conflit).
  it('un `409` dont la gare n’attend plus sa carte dans la boîte relue referme la carte et dit le message du serveur sur la rubrique, sans quitter la sacoche ; écrire une autre carte l’efface', async () => {
    let boite = LA_BOITE
    const { requetes } = await monter({ entree: ['/voyage', SACOCHE], routes: { [BOITE]: () => json(boite), [POSTER]: refuse(409, 'La carte de cette gare est déjà partie.') } })
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
    boite = { ...LA_BOITE, envoyees: [ENVOYEE, POSTEE], en_attente: [1902] }
    toucher('Poster')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | fermée | refus « La carte de cette gare est déjà partie. »'))
    expect(screen.getByRole('region', { name: 'La sacoche du voyageur' })).toBeInTheDocument()
    expect(parties(requetes, BOITE)).toBe(2)
    toucher('Écrire 1902')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | écrit 1902, signé alice, à [bob, camille] | sans refus'))
  })

  // **La gare attend encore sa carte** dans la boîte relue (le destinataire que je ne suis plus) : la
  // carte reste ouverte, le brouillon intact, le message du serveur se dit sur elle comme un `400`, et
  // mes abonnements se relisent : bob, refusé, n'est plus proposé. L'adresse ne bouge pas, la carte
  // repart. Mutations : la carte toujours refermée sur un `409` ; le brouillon vidé (la carte à
  // écrire retirée le temps de la relecture de la boîte : son dessin se démonte) ; mes abonnements non
  // relus ; le refus dit sur la rubrique.
  it('un `409` dont la gare attend encore sa carte laisse la carte ouverte, le brouillon intact, dit le message du serveur sur elle et relit mes abonnements', async () => {
    let suivis = [LIGNE_DE_BOB, LIGNE_DE_CAMILLE]
    let refus = true
    // La relecture de la boîte est retenue : la carte et son brouillon se regardent pendant qu'elle court.
    let relire: (() => void) | null = null
    let lectures = 0
    const { requetes, client, corps } = await monter({
      entree: ['/voyage', SACOCHE],
      routes: {
        [BOITE]: () => (++lectures === 1 ? json(LA_BOITE) : new Promise<Response>((r) => void (relire = () => r(json(LA_BOITE))))),
        [ABONNEMENTS]: () => json({ items: suivis, next_cursor: null }),
        [POSTER]: () => (refus ? refuse(409, 'Tu ne suis plus ce membre.')() : json(POSTEE, 201)),
      },
    })
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
    fireEvent.change(screen.getByRole('textbox', { name: 'Brouillon' }), { target: { value: MOT } })
    suivis = [LIGNE_DE_CAMILLE]
    toucher('Poster')
    await waitFor(() => expect(relire).not.toBeNull())
    // La relecture en vol : la carte ne quitte pas l'écran, l'envoi reste en cours.
    expect(dit()).toBe('à écrire 1900, 1902 | envoyées 1901 | écrit 1900, signé alice, à [bob, camille], en cours | sans refus')
    expect(screen.getByRole('textbox', { name: 'Brouillon' })).toHaveValue(MOT)
    await act(async () => relire!())
    await waitFor(() => expect(dit()).toBe('à écrire 1900, 1902 | envoyées 1901 | écrit 1900, signé alice, à [camille], refus « Tu ne suis plus ce membre. » | sans refus'))
    await auCalme(client)
    expect(screen.getByRole('textbox', { name: 'Brouillon' })).toHaveValue(MOT)
    expect(screen.getByTestId('adresse')).toHaveTextContent('?ecrire=1900')
    expect(parties(requetes, BOITE)).toBe(2)
    expect(parties(requetes, ABONNEMENTS)).toBe(2)
    expect(parties(requetes, VOYAGE)).toBe(1)
    refus = false
    toucher('Poster')
    await waitFor(() => expect(dit()).toBe('à écrire 1902 | envoyées 1901, 1900 | ouverte envoyee 1900 qui vient de partir | sans refus'))
    expect(corps).toHaveLength(2)
  })

  // Le rappel d'un envoi court après le rendu qui l'a lancé : la carte refermée pendant l'envoi, son
  // calque d'alors se croit encore ouvert, et le refermer reculerait d'une entrée de trop. Mutation :
  // `ecriture.fermer()` appelé tel quel sur un `409`, sans relire le dernier calque rendu (la sacoche
  // est quittée pour la carte). **Il ne la rouvre pas non plus**, même si sa gare attend encore sa
  // carte (la boîte relue la sert toujours) : le refus se dit sur la rubrique, où on le lit. Mutation :
  // la garde `ouverteIci` retirée de la branche qui garde la carte (le refus, rangé sur une carte
  // fermée, n'est dit nulle part).
  it('un `409` arrivé après que la carte a été refermée ne quitte pas la sacoche, ne rouvre pas la carte, et se dit quand même', async () => {
    let repondre = () => undefined as void
    const { client } = await monter({ entree: ['/voyage', SACOCHE], routes: { [POSTER]: () => new Promise<Response>((r) => void (repondre = () => r(refuse(409, 'La carte de cette gare est déjà partie.')()))) } })
    toucher('Écrire 1900')
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
    toucher('Poster')
    await waitFor(() => expect(dit()).toContain('en cours'))
    toucher('Refermer')
    await waitFor(() => expect(dit()).toBe(FERMEE))
    repondre()
    await waitFor(() => expect(dit()).toBe('à écrire 1900, 1902 | envoyées 1901 | fermée | refus « La carte de cette gare est déjà partie. »'))
    await auCalme(client)
    expect(screen.getByRole('region', { name: 'La sacoche du voyageur' })).toBeInTheDocument()
    expect(dit()).toContain('fermée')
    expect(screen.getByTestId('adresse')).toHaveTextContent(/^$/)
    expect(screen.queryByRole('textbox', { name: 'Brouillon' })).toBeNull()
  })

  // Règle commune 3 : une lecture en panne n'éteint que son bloc. Mutation : la panne de mes
  // abonnements tue (`panne: null` : la carte attendrait sans fin) ; une liste vide passée à sa place
  // (« tu ne suis personne », faux).
  it('mes abonnements en panne : la carte à écrire le dit, n’offre personne, et « Réessayer » les relit', async () => {
    let enPanne = true
    await monter({
      entree: `${SACOCHE}?ecrire=1900`,
      attendu: 'à écrire 1900, 1902 | envoyées 1901 | écrit 1900, signé alice, à personne encore, en panne | sans refus',
      routes: { [ABONNEMENTS]: () => (enPanne ? refuse(400, 'Les abonnements sont en panne.')() : json({ items: [LIGNE_DE_BOB], next_cursor: 'suite' })) },
    })
    enPanne = false
    toucher('Réessayer')
    await waitFor(() => expect(dit()).toBe(A_ECRIRE))
  })
})
