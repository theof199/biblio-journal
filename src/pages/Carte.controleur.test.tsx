import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { JournalPage } from '../api/journal'
import type { PassageDuControleur, Poincon, Voyage, Voyageur } from '../api/voyage'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import { PAGES_1890 } from '../mondes/1890/pages'
import { PAGES_1900 } from '../mondes/1900/pages'
import type { HabillagePages } from '../mondes/types'
import { exemple } from '../test/contrat'
import { visionnage } from '../test/journal'
import { moteurFactice } from '../test/moteurFactice'
import { SESSION } from '../test/pageVoyage'
import { json, servir } from '../test/serveur'
import { ROUTES_DU_JEU, voyage1890 } from '../test/voyage'
import type { PropsControleurDeLaCarte } from '../voyage/controleur/Controleur'

// Le contrôleur des billets passe sur la carte (plan des écrans des lots, brief 7) par une clé de
// gabarit **sans défaut**, `controleurDeLaCarte`, la seule que lit `pages/Carte.tsx`. Aucun monde ne la
// remplit dans ce fichier : il tient le bloc lecteur et les gardes de la page sur un 1890 (une fois,
// un 1900) auquel on prête un dessin qui dit ce qu'il reçoit. `Carte.objets.test.tsx` et
// `Carte.point.test.tsx` tiennent déjà qu'un membre de 1899 ne lit que la session, la carte et les
// tickets ; le premier test d'ici le redit devant un contrôleur qui attend.
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const LIRE = 'GET /api/me/voyage/voyageur'
const JOURNAL = 'GET /api/me/journal?limit=20'
const REPONDRE = 'POST /api/me/voyage/controleur/reponse'
const MONTRE = 'POST /api/me/voyage/tickets/1899/montre'
const UTILISER = 'POST /api/me/voyage/tickets/1899/utiliser'
const RAMASSER_LE_MELON = 'POST /api/me/voyage/objets/melon/ramasser'

const EN_1898 = voyage1890(1898, [
  { annee: 1895, statut: 'ouverte', visitee: true, recompense: 'palme', progression: null },
  { annee: 1896, statut: 'ouverte', visitee: true, recompense: 'lion', progression: null },
  { annee: 1897, statut: 'ouverte', visitee: true, recompense: 'ours', progression: null, profondeur: 4 },
  { annee: 1898, statut: 'en_cours', visitee: false, recompense: null, progression: null, profondeur: 0 },
  { annee: 1899, statut: 'verrouillee', visitee: false, recompense: null, progression: null },
])
/** Un Voyage de 1895 à `fin`, toutes les années ouvertes jusqu'à `enCours`. */
const jusqua = (enCours: number, fin = 1909) =>
  voyage1890(
    enCours,
    Array.from({ length: fin - 1895 + 1 }, (_, i) => {
      const annee = 1895 + i
      return annee < enCours
        ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
        : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 }
    }),
  )
/** La carte montre 1900. */
const EN_1903 = jusqua(1903)
/** Mon année en cours dans le monde « à venir », qui ne compose pas le contrôleur ; la carte montre 1900 et ses objets. */
const EN_1910 = jusqua(1910, 1910)
/** Le ticket de 1899 encaissé : la carte relue. */
const EN_1899: Voyage = { ...EN_1898, annee_en_cours: 1899, annees: EN_1898.annees.map((a) => (a.annee === 1898 ? { ...a, statut: 'ouverte', visitee: true } : a.annee === 1899 ? { ...a, statut: 'en_cours', profondeur: 0 } : a)) }
const TICKET_DE_1899 = { annee: 1899, motif: '1898 t’a bien occupé.', emis_le: '2026-09-28T10:00:00.000Z', montre_le: null, utilise_le: null }

const BILLET = { log_entry_id: 'b0000000-0000-4000-8000-000000000002', media_id: 'd0000000-0000-4000-8000-000000000007' }
const BASE = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
const IL_ATTEND: Voyageur = { ...BASE, controleur: { attend: true, billet: BILLET } }
const AU_REPOS: Voyageur = { ...BASE, controleur: { attend: false, billet: null } }
const POINCON: Poincon = { ...BILLET, poinconne_le: '2026-10-08T18:00:00.000Z' }
const PRESENTE: PassageDuControleur = { reponse: 'presente', poincon: POINCON }
const REFUSE: PassageDuControleur = { reponse: 'refuse', poincon: null }

/**
 * Mon journal, le plus récent d'abord. Le billet demandé est une seconde séance du même film : une
 * première, plus ancienne, porte le même `media_id` et une autre date.
 */
const PAGE = exemple<JournalPage>('/me/journal', 'get', 200)
const UN_AUTRE = visionnage({ id: 'b0000000-0000-4000-8000-000000000003', titre: 'L’Arroseur arrosé', annee: 1895, date: '2026-10-07' })
const LE_BILLET = visionnage({ id: BILLET.log_entry_id, media: BILLET.media_id, titre: 'Le Manoir du diable', annee: 1896, date: '2026-10-06', note: 8 })
const LA_PREMIERE_SEANCE = visionnage({ id: 'b0000000-0000-4000-8000-000000000001', media: BILLET.media_id, titre: 'Le Manoir du diable', annee: 1896, date: '2026-09-01', note: 6 })
const journal = (items = [UN_AUTRE, LE_BILLET, LA_PREMIERE_SEANCE], next: string | null = null): JournalPage => ({ ...PAGE, items, next_cursor: next })

const panne = (status: number, message: string) => () => json({ code: status === 409 ? 'CONFLICT' : 'INTERNAL', message, retryable: false }, status)

/** Le dessin prêté : ce qu'il reçoit, en une ligne, et ses gestes. */
const Dessin = (p: PropsControleurDeLaCarte) => (
  <div role="dialog" aria-modal="true" aria-label="Le contrôleur">
    <p data-testid="controle">{`${p.etat} | ${p.billet ? `${p.billet.item.media.title}, le ${p.billet.item.entry.finished_at}, ${p.billet.numero === null ? 'sans numéro' : `numéro ${p.billet.numero}`}` : 'sans carton'} | ${p.panne ?? 'sans panne'}`}</p>
    {p.etat === 'demande' ? (
      <>
        <button ref={p.premier} type="button" onClick={p.presenter}>
          Présenter
        </button>
        <button type="button" onClick={p.refuser}>
          Refuser
        </button>
        <button type="button" onClick={p.fermer}>
          Laisser
        </button>
      </>
    ) : (
      <button ref={p.premier} type="button" onClick={p.fermer}>
        Refermer
      </button>
    )}
  </div>
)

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>
interface Options {
  voyage?: Voyage
  client?: QueryClient
  moteur?: ReturnType<typeof moteurFactice>
}

/** La carte d'un membre, montée et donnée au moteur ; `calme` attend que plus rien ne se lise ni ne s'écrive. */
async function monter(voyageur: Voyageur, routes: Routes = {}, { voyage = EN_1898, client = createQueryClient(), moteur: f = moteurFactice() }: Options = {}) {
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    [VOYAGE]: () => json(voyage),
    [TICKETS]: () => json({ tickets: [] }),
    [LIRE]: () => json(voyageur),
    [JOURNAL]: () => json(journal()),
    ...routes,
  })
  const rendu = render(
    <QueryClientProvider client={client}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(f.etats.length).toBeGreaterThan(0))
  const calme = () => waitFor(() => expect(client.isFetching() + client.isMutating()).toBe(0))
  return { ...f, client, requetes, calme, quitter: rendu.unmount }
}

const portiere = () => screen.findByRole('dialog', { name: 'Le contrôleur' })
const pasDePortiere = () => expect(screen.queryByRole('dialog')).toBeNull()
const dit = () => screen.getByTestId('controle').textContent
const bouton = (nom: string) => screen.getByRole('button', { name: nom })
const etatEnCache = (client: QueryClient) => client.getQueryData<Voyageur>(cles.voyageur)
const corps = (init: RequestInit) => JSON.parse(String(init.body)) as unknown
/** Une promesse que le test tient : rien n'attend une durée. */
function retenue<T>() {
  let lacher!: (valeur: T) => void
  let echouer!: (raison: unknown) => void
  const promesse = new Promise<T>((fin, echec) => ((lacher = fin), (echouer = echec)))
  echecs.set(promesse, echouer)
  return { promesse, lacher }
}
const echecs = new WeakMap<Promise<unknown>, (raison: unknown) => void>()
const lacherEnEchec = (promesse: Promise<unknown>) => echecs.get(promesse)!(new Error('le passage a échoué'))

describe('le contrôleur sur la carte, une clé sans défaut', () => {
  let remettre: Array<() => void> = []
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Au calme : la fête du rattrapage offre son choix sans attendre ses pas.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    remettre.forEach((r) => r())
    remettre = []
    vi.unstubAllGlobals()
  })
  const preter = (pages: HabillagePages = PAGES_1890) => {
    const avant = pages.gabarits
    pages.gabarits = { ...avant, controleurDeLaCarte: Dessin }
    remettre.push(() => void (pages.gabarits = avant))
  }

  // Décision 1 du propriétaire : 1900 seulement. `servir` refuse toute route qu'il ne nomme pas, et la
  // liste est entière. Mutations : dans `Carte.tsx`, l'état du voyageur lu sans regarder la clé
  // (`enabled: true`) ; un dessin de repli à la place de `gabaritSeul`.
  it('sans la clé, un contrôleur qui attend n’est ni lu ni montré : la carte de 1898 ne lit que la session, la carte et les tickets', async () => {
    const banc = await monter(IL_ATTEND)
    await banc.calme()
    expect([...banc.requetes].sort()).toEqual(['GET /api/auth/me', VOYAGE, TICKETS])
    pasDePortiere()
  })

  // Mutations : il entre sans regarder `attend` (`voyageur.data?.controleur.billet` seul ne suffit pas
  // à le prouver : le test sert un billet avec `attend` faux) ; la référence du premier bouton
  // remplacée par une référence neuve (le focus reste au document) ; les deux enveloppes laissées
  // vivantes sous le dialogue.
  it('la clé prêtée : il entre seul quand le serveur dit qu’il attend, le focus sur le premier bouton, la carte inerte dessous', async () => {
    preter()
    const banc = await monter(IL_ATTEND)
    await portiere()
    await banc.calme()
    expect(bouton('Présenter')).toHaveFocus()
    expect(dit()).toBe('demande | Le Manoir du diable, le 2026-10-06, sans numéro | sans panne')
    expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(1)
    expect(banc.requetes.filter((r) => r === JOURNAL)).toHaveLength(1)
    const titre = screen.getByRole('heading', { level: 1, hidden: true })
    expect(titre.parentElement!.querySelectorAll(':scope > [inert]')).toHaveLength(2)
  })

  it('il n’attend pas : pas de portière, et mon journal n’est pas lu, même si un billet est servi', async () => {
    preter()
    const banc = await monter({ ...AU_REPOS, controleur: { attend: false, billet: BILLET } })
    await banc.calme()
    expect(banc.requetes).toContain(LIRE)
    pasDePortiere()
    expect(banc.requetes.filter((r) => r.includes('/me/journal'))).toEqual([])
    expect(screen.getByRole('heading', { level: 1 }).parentElement!.querySelectorAll(':scope > [inert]')).toHaveLength(0)
  })

  // Règle 3 du plan : sur la carte, une lecture en panne se tait. Mutation : une `Panne` ou un
  // « Chargement… » rendus pour l'état du voyageur.
  it('l’état du voyageur en panne : ni contrôleur ni alerte, la carte reste', async () => {
    preter()
    const banc = await monter(IL_ATTEND, { [LIRE]: panne(500, 'Panne.') })
    await banc.calme()
    pasDePortiere()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
  })

  describe('le billet qu’il montre (décision 6)', () => {
    // Mutations : le billet cherché par `media_id` (la première séance du 1er septembre sortirait, si on
    // l'ordonne devant) ; la boîte lue au lieu d'être consultée en cache (une requête `sortie_min`
    // partirait) ; le numéro pris au rang dans le journal ; le départ du Voyage non passé à la règle du
    // casier (`0` à la place de `depart` : le film de 1892, vu le premier, décalerait le numéro à 3).
    it('le carton se remplit de la première page de mon journal, par l’entrée et non par le film ; le numéro vient de la boîte si elle est en cache', async () => {
      preter()
      const client = createQueryClient()
      // La boîte des années 1890, déjà lue : trois billets, celui qu'il demande est le deuxième vu.
      // Un film d'avant le départ (1895) y est aussi, vu avant tous les autres : il n'a ni billet ni numéro.
      const AVANT_LE_DEPART = visionnage({ id: 'b0000000-0000-4000-8000-000000000004', titre: 'Pauvre Pierrot', annee: 1892, date: '2026-01-01' })
      expect(EN_1898.depart).toBe(1895)
      client.setQueryData(cles.journalDesAnnees(1890, 1899), [UN_AUTRE, LE_BILLET, LA_PREMIERE_SEANCE, AVANT_LE_DEPART])
      const banc = await monter(IL_ATTEND, { [JOURNAL]: () => json(journal([LA_PREMIERE_SEANCE, UN_AUTRE, LE_BILLET])) }, { client })
      await portiere()
      await banc.calme()
      expect(dit()).toBe('demande | Le Manoir du diable, le 2026-10-06, numéro 2 | sans panne')
      expect(banc.requetes.filter((r) => r.includes('sortie_min'))).toEqual([])
    })

    // Mutations : la page suivante lue tant que le billet manque (comme `VoyageFilm.tsx`) ; la portière
    // refermée, ou une panne dite, quand le journal ne répond pas.
    it.each([
      ['absent de la première page', () => json(journal([UN_AUTRE], 'suite'))],
      ['mon journal en panne', panne(500, 'Journal en panne.')],
    ])('%s : la portière sans carton, sans un mot, et jamais la page suivante', async (_cas, route) => {
      preter()
      const banc = await monter(IL_ATTEND, { [JOURNAL]: route })
      await portiere()
      await banc.calme()
      expect(dit()).toBe('demande | sans carton | sans panne')
      expect(screen.queryByRole('alert')).toBeNull()
      expect(banc.requetes.filter((r) => r.includes('/me/journal'))).toEqual([JOURNAL])
    })
  })

  // Mon journal déjà en cache, trois pages, vieilli d'une heure : il suffit au carton (le billet est
  // sur la deuxième page) et rien n'en est relu. Absent du cache, il se lit une fois, sa première page
  // seule : les tests du carton, plus haut, le tiennent. Mutation : `staleTime: Infinity` retiré de
  // l'observateur du contrôleur (les trois pages seraient relues).
  it('mon journal déjà en cache n’est pas relu, même vieilli', async () => {
    preter()
    const client = createQueryClient()
    client.setQueryData(
      cles.journal,
      { pages: [journal([UN_AUTRE], 'c1'), journal([LE_BILLET], 'c2'), journal([LA_PREMIERE_SEANCE])], pageParams: [undefined, 'c1', 'c2'] },
      { updatedAt: Date.now() - 3_600_000 },
    )
    const banc = await monter(IL_ATTEND, {}, { client })
    await portiere()
    await banc.calme()
    expect(dit()).toBe('demande | Le Manoir du diable, le 2026-10-06, sans numéro | sans panne')
    expect(banc.requetes.filter((r) => r.includes('/me/journal'))).toEqual([])
  })

  describe('répondre', () => {
    // Le billet supprimé ou redaté avant la réponse : le serveur en poinçonne un autre, et le dit. Le
    // carton montré ne se perce pas à sa place : la portière montre celui qui l'est s'il est sur les
    // pages en cache, aucun sinon. Mutations : le carton laissé à celui qu'il annonçait (`perce` non
    // retenu) ; le carton d'avant gardé quand le bon manque (`?? billet.log_entry_id` en repli de la recherche).
    it.each([
      ['un autre billet de mon journal', UN_AUTRE.entry.id, 'presente | L’Arroseur arrosé, le 2026-10-07, sans numéro | sans panne'],
      ['un billet que mon journal en cache n’a pas', 'b0000000-0000-4000-8000-0000000000ff', 'presente | sans carton | sans panne'],
    ])('le serveur a poinçonné %s : le carton annoncé ne se montre pas percé', async (_cas, id, attendu) => {
      preter()
      const banc = await monter(IL_ATTEND, { [REPONDRE]: () => json({ reponse: 'presente', poincon: { ...POINCON, log_entry_id: id } } satisfies PassageDuControleur) })
      await portiere()
      await banc.calme()
      expect(dit()).toBe('demande | Le Manoir du diable, le 2026-10-06, sans numéro | sans panne')
      fireEvent.click(bouton('Présenter'))
      await waitFor(() => expect(dit()).toBe(attendu))
      await banc.calme()
      expect(etatEnCache(banc.client)?.poincons.map((p) => p.log_entry_id)).toContain(id)
      expect(banc.requetes.filter((r) => r.includes('/me/journal'))).toEqual([JOURNAL])
    })

    // Mutations : le cache laissé tel quel (`setQueryData` retiré) ; la réponse posée à la place de
    // l'état (les objets et les rubriques s'effacent) ; le préfixe `voyage` périmé (la carte et les
    // tickets seraient relus) ; le poinçon non ajouté ; le focus laissé au bouton disparu (l'effet sur
    // `etat` retiré).
    it('« présenter » écrit `presente` : le cache apprend qu’il n’attend plus et le poinçon rendu, champ par champ, sans rien relire', async () => {
      preter()
      const envoyes: unknown[] = []
      const banc = await monter(IL_ATTEND, { [REPONDRE]: (init) => (envoyes.push(corps(init)), json(PRESENTE)) })
      await portiere()
      await banc.calme()
      const avant = [...banc.requetes]
      fireEvent.click(bouton('Présenter'))
      await waitFor(() => expect(dit()).toMatch(/^presente \|/))
      await banc.calme()
      expect(envoyes).toEqual([{ reponse: 'presente' }])
      expect(etatEnCache(banc.client)).toEqual({ ...IL_ATTEND, controleur: { attend: false, billet: null }, poincons: [...BASE.poincons, POINCON] })
      expect(BASE.objets.length + BASE.rubriques.length + BASE.poincons.length).toBeGreaterThan(5)
      expect(banc.requetes).toEqual([...avant, REPONDRE])
      expect(bouton('Refermer')).toHaveFocus()
      fireEvent.click(bouton('Refermer'))
      pasDePortiere()
      expect(banc.requetes).toEqual([...avant, REPONDRE])
    })

    // Mutations : `refuser` branché sur `presente` ; un poinçon inventé au refus ; `attend` laissé vrai.
    it('« pas ce soir » écrit `refuse` : il n’attend plus, aucun poinçon de plus', async () => {
      preter()
      const envoyes: unknown[] = []
      const banc = await monter(IL_ATTEND, { [REPONDRE]: (init) => (envoyes.push(corps(init)), json(REFUSE)) })
      await portiere()
      await banc.calme()
      fireEvent.click(bouton('Refuser'))
      await waitFor(() => expect(dit()).toMatch(/^refuse \|/))
      expect(envoyes).toEqual([{ reponse: 'refuse' }])
      expect(etatEnCache(banc.client)).toEqual({ ...IL_ATTEND, controleur: { attend: false, billet: null } })
    })

    // Deux touchers dans le même instant, puis l'autre réponse pendant que la première vole. Mutation :
    // le verrou retiré (`isPending` ne se voit qu'au rendu suivant).
    it('deux touchers ne répondent qu’une fois, et l’autre réponse ne part pas pendant la première', async () => {
      preter()
      const reponse = retenue<Response>()
      const banc = await monter(IL_ATTEND, { [REPONDRE]: () => reponse.promesse })
      await portiere()
      await banc.calme()
      const presenter = bouton('Présenter')
      act(() => {
        presenter.click()
        presenter.click()
      })
      fireEvent.click(bouton('Refuser'))
      await waitFor(() => expect(banc.requetes).toContain(REPONDRE))
      await act(async () => reponse.lacher(json(PRESENTE)))
      await waitFor(() => expect(dit()).toMatch(/^presente \|/))
      await banc.calme()
      expect(banc.requetes.filter((r) => r === REPONDRE)).toHaveLength(1)
    })

    // Mutation : le cache écrit dans le rappel du geste (`mutate`), que TanStack tait une fois la page
    // démontée : le casier, ouvert ensuite, le croirait encore attendu.
    it('la carte quittée avant la réponse : le cache l’apprend quand même', async () => {
      preter()
      const reponse = retenue<Response>()
      const banc = await monter(IL_ATTEND, { [REPONDRE]: () => reponse.promesse })
      await portiere()
      await banc.calme()
      fireEvent.click(bouton('Présenter'))
      await waitFor(() => expect(banc.requetes).toContain(REPONDRE))
      banc.quitter()
      await act(async () => reponse.lacher(json(PRESENTE)))
      await waitFor(() => expect(etatEnCache(banc.client)?.controleur.attend).toBe(false))
      expect(etatEnCache(banc.client)?.poincons).toContainEqual(POINCON)
    })

    // Une lecture de l'état partie avant la réponse et revenue après rendrait l'état d'avant. Mutation :
    // `cancelQueries` retiré avant l'écriture du cache.
    it('une lecture de l’état en vol, revenue après la réponse, ne le fait pas attendre de nouveau', async () => {
      preter()
      let lectures = 0
      const tardive = retenue<Response>()
      const banc = await monter(IL_ATTEND, { [LIRE]: () => ((lectures += 1), lectures === 1 ? json(IL_ATTEND) : tardive.promesse), [REPONDRE]: () => json(PRESENTE) })
      await portiere()
      await banc.calme()
      void banc.client.refetchQueries({ queryKey: cles.voyageur, exact: true })
      await waitFor(() => expect(lectures).toBe(2))
      fireEvent.click(bouton('Présenter'))
      await waitFor(() => expect(dit()).toMatch(/^presente \|/))
      await act(async () => tardive.lacher(json(IL_ATTEND)))
      await banc.calme()
      expect(etatEnCache(banc.client)?.controleur).toEqual({ attend: false, billet: null })
      expect(etatEnCache(banc.client)?.poincons).toContainEqual(POINCON)
    })

    // « Qu'il revienne après la réponse, dans la même visite. » La carte quittée puis rouverte, le
    // cache encore frais : rien n'est relu, et le cache dit qu'il n'attend plus. Mutation : le cache
    // laissé tel quel après la réponse (il entrerait de nouveau).
    it('après la réponse, la carte rouverte sur le même cache ne le revoit pas', async () => {
      preter()
      const banc = await monter(IL_ATTEND, { [REPONDRE]: () => json(REFUSE) })
      await portiere()
      await banc.calme()
      fireEvent.click(bouton('Refuser'))
      await waitFor(() => expect(dit()).toMatch(/^refuse \|/))
      fireEvent.click(bouton('Refermer'))
      banc.quitter()
      const retour = await monter(IL_ATTEND, {}, { client: banc.client })
      await retour.calme()
      await act(async () => undefined)
      pasDePortiere()
      expect(retour.requetes.filter((r) => r === LIRE)).toEqual([])
    })
  })

  describe('refermer n’est pas refuser (décision 5)', () => {
    // Mutations : la fermeture branchée sur « pas ce soir » (`fermer` appelle `dire('refuse')`) ;
    // Échap sourd (`useDialogue` retiré) ; `controleurPasse` retiré (la vue d'ensemble ouverte puis
    // refermée relance la garde, et il rentrerait dans la même visite).
    it.each([
      ['Échap', () => fireEvent.keyDown(document, { key: 'Escape' })],
      ['le bouton qui referme', () => fireEvent.click(bouton('Laisser'))],
    ])('%s referme sans rien écrire, il attend toujours, et il ne rentre pas deux fois dans la même visite', async (_geste, refermer) => {
      preter()
      const banc = await monter(IL_ATTEND)
      await portiere()
      await banc.calme()
      const avant = [...banc.requetes]
      refermer()
      pasDePortiere()
      await banc.calme()
      expect(banc.requetes).toEqual(avant)
      expect(etatEnCache(banc.client)?.controleur).toEqual({ attend: true, billet: BILLET })
      // L'état relu dit toujours qu'il attend : il est déjà passé, il ne rentre pas.
      await act(async () => {
        await banc.client.refetchQueries({ queryKey: cles.voyageur, exact: true })
      })
      await banc.calme()
      expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(2)
      act(() => banc.rappels().ensemble(true))
      act(() => banc.rappels().ensemble(false))
      await act(async () => undefined)
      pasDePortiere()
    })

    // « Rien sur l'appareil. » Mutations : un « déjà passé » gardé hors du composant (une variable de
    // module, `sessionStorage`, `localStorage`) : la carte remontée ne le reverrait pas.
    it('la carte remontée avec un contrôleur qui attend le fait entrer de nouveau : rien n’est retenu sur l’appareil', async () => {
      preter()
      const premiere = await monter(IL_ATTEND)
      await portiere()
      await premiere.calme()
      fireEvent.keyDown(document, { key: 'Escape' })
      pasDePortiere()
      const ecrit = () => [...Array(localStorage.length).keys()].map((i) => localStorage.key(i)).concat([...Array(sessionStorage.length).keys()].map((i) => sessionStorage.key(i)))
      expect(ecrit().filter((cle) => /contr/i.test(cle ?? ''))).toEqual([])
      premiere.quitter()
      cleanup()
      const seconde = await monter(IL_ATTEND)
      await portiere()
      await seconde.calme()
      expect(bouton('Présenter')).toHaveFocus()
    })
  })

  describe('le focus, la portière refermée', () => {
    // Il entre seul : rien n'avait le focus, `useDialogue` n'a rien à qui le rendre. Mutation : l'effet
    // qui rend le focus au titre retiré (il tombe au document).
    it('rien n’avait le focus : il revient au titre de la carte, pas au document', async () => {
      preter()
      const banc = await monter(IL_ATTEND)
      await portiere()
      await banc.calme()
      fireEvent.click(bouton('Laisser'))
      pasDePortiere()
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    })

    // Mutation : le titre prend le focus sans regarder s'il est tombé au document.
    it('un bouton de la carte l’avait : il lui revient, le titre ne le prend pas', async () => {
      preter()
      const lecture = retenue<Response>()
      const banc = await monter(IL_ATTEND, { [LIRE]: () => lecture.promesse })
      await waitFor(() => expect(banc.requetes).toContain(LIRE))
      act(() => bouton('Vue d’ensemble').focus())
      await act(async () => lecture.lacher(json(IL_ATTEND)))
      await portiere()
      await banc.calme()
      expect(bouton('Présenter')).toHaveFocus()
      fireEvent.click(bouton('Laisser'))
      pasDePortiere()
      expect(bouton('Vue d’ensemble')).toHaveFocus()
    })
  })

  describe('ce que le serveur refuse', () => {
    // Le `409` : il n'attendait plus (répondu ailleurs, le billet supprimé). Mutations : le `409` dit
    // comme une panne (le message du serveur, ou le générique, dans le dialogue resté ouvert) ; l'état
    // non relu ; le préfixe `voyage` périmé à la place de la clé exacte.
    it('un 409 referme la portière et relit l’état, sans rien dire', async () => {
      preter()
      let lectures = 0
      const banc = await monter(IL_ATTEND, {
        [LIRE]: () => ((lectures += 1), json(lectures === 1 ? IL_ATTEND : AU_REPOS)),
        [REPONDRE]: panne(409, 'Le contrôleur n’attend pas de réponse cette semaine.'),
      })
      await portiere()
      await banc.calme()
      fireEvent.click(bouton('Présenter'))
      await waitFor(pasDePortiere)
      await banc.calme()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByText(/n’attend pas|Réessaie/)).toBeNull()
      expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(2)
      expect(banc.requetes.filter((r) => r === VOYAGE || r === TICKETS)).toHaveLength(2)
      expect(etatEnCache(banc.client)?.controleur.attend).toBe(false)
    })

    // Une panne se dit dans le dialogue, qui reste sur sa demande ; la réponse se refait. Mutations :
    // le message du serveur remplacé par le générique ; le verrou jamais rendu (`onSettled` retiré) ;
    // la panne laissée à l'écran après la réponse acceptée ; le cache écrit malgré la panne.
    it('une panne se dit dans le dialogue, telle que le serveur la dit, et la réponse se refait', async () => {
      preter()
      let essais = 0
      const banc = await monter(IL_ATTEND, { [REPONDRE]: () => ((essais += 1), essais === 1 ? panne(500, 'Le serveur est en panne.')() : json(PRESENTE)) })
      await portiere()
      await banc.calme()
      fireEvent.click(bouton('Présenter'))
      await waitFor(() => expect(dit()).toBe('demande | Le Manoir du diable, le 2026-10-06, sans numéro | Le serveur est en panne.'))
      expect(etatEnCache(banc.client)?.controleur.attend).toBe(true)
      expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(1)
      fireEvent.click(bouton('Présenter'))
      await waitFor(() => expect(dit()).toBe('presente | Le Manoir du diable, le 2026-10-06, sans numéro | sans panne'))
      expect(essais).toBe(2)
    })
  })

  describe('jamais par-dessus autre chose', () => {
    // L'appareil a montré 1897, mon année en cours est 1898 : la marche joue. L'avatar n'est rendu à
    // mon année qu'à la fin de l'avancée. Mutation : `anneeAvatar !== v.annee_en_cours` retiré de la
    // garde, ou remplacé par `avancee` (nulle encore dans la passe d'effets qui la pose).
    it('pendant une avancée il n’entre pas ; elle finie, il entre', async () => {
      preter()
      localStorage.setItem(`journal.carte.annee-vue.${SESSION.user.id}`, '1897')
      const f = moteurFactice()
      const marche = retenue<void>()
      vi.mocked(f.moteur.marcher).mockImplementationOnce(() => marche.promesse)
      const banc = await monter(IL_ATTEND, {}, { moteur: f })
      await waitFor(() => expect(f.moteur.marcher).toHaveBeenCalledWith(1898))
      await waitFor(() => expect(etatEnCache(banc.client)?.controleur.attend).toBe(true))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => marche.lacher())
      await portiere()
    })

    // Le ticket à montrer et le contrôleur, tous deux déjà en cache : le même rendu les décide.
    // Mutations : la fête retirée de `pleinEcranOccupe` ; `feteAVenir` seule retirée (l'effet du
    // contrôleur suit celui de la fête dans la même passe, et lirait `fete` encore nul).
    it('pendant la fête du rattrapage il n’entre pas ; elle finie, il entre', async () => {
      preter()
      const aMontrer: Voyage = { ...EN_1898, ticket_a_montrer: { annee: 1899, motif: 'Tu as fait le tour de 1898.', emis_le: '2026-09-21T21:00:00.000Z' } }
      const client = createQueryClient()
      client.setQueryData(cles.voyage, aMontrer)
      client.setQueryData(cles.tickets, { tickets: [] })
      client.setQueryData(cles.voyageur, IL_ATTEND)
      const banc = await monter(IL_ATTEND, { [MONTRE]: () => new Response(null, { status: 204 }) }, { voyage: aMontrer, client })
      expect(await screen.findByRole('dialog', { name: '1898 est bouclée' })).toBeInTheDocument()
      await banc.calme()
      await act(async () => undefined)
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(screen.queryByTestId('controle')).toBeNull()
      fireEvent.click(bouton('Le garder'))
      await portiere()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })

    // Mutation : `ensemble` retiré de la garde.
    it('sous la vue d’ensemble il n’entre pas ; refermée, il entre', async () => {
      preter()
      const lecture = retenue<Response>()
      const banc = await monter(IL_ATTEND, { [LIRE]: () => lecture.promesse })
      await waitFor(() => expect(banc.requetes).toContain(LIRE))
      act(() => banc.rappels().ensemble(true))
      await act(async () => lecture.lacher(json(IL_ATTEND)))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      act(() => banc.rappels().ensemble(false))
      await portiere()
    })

    // Le passage au geste ne s'offre qu'à qui a atteint 1900 : le dessin est prêté à 1900. Mutations :
    // `passage` retiré de la garde ; `setPassage(true)` retiré du bouton ; la fin du passage non dite
    // (il n'entrerait jamais).
    it('pendant un passage au geste il n’entre pas ; le passage fini, il entre', async () => {
      preter(PAGES_1900)
      const f = moteurFactice()
      const bonjour = retenue<void>()
      vi.mocked(f.moteur.direBonjour).mockImplementationOnce(() => bonjour.promesse)
      const lecture = retenue<Response>()
      const banc = await monter(IL_ATTEND, { ...ROUTES_DU_JEU, [LIRE]: () => lecture.promesse }, { voyage: EN_1903, moteur: f })
      await waitFor(() => expect(banc.requetes).toContain(LIRE))
      act(() => banc.rappels().entreeProche?.(1900))
      fireEvent.click(bouton('Prendre le train pour 1900'))
      expect(f.moteur.direBonjour).toHaveBeenCalledWith(1900, 'endroit')
      await act(async () => lecture.lacher(json(IL_ATTEND)))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => bonjour.lacher())
      await portiere()
    })

    // Un passage qui échoue rend la main comme un passage fini. Mutation : `.then(fin)` sans le second
    // rappel (il n'entrerait plus de la visite).
    it('un passage au geste en échec ne le retient pas : il entre', async () => {
      preter(PAGES_1900)
      const f = moteurFactice()
      const bonjour = retenue<void>()
      vi.mocked(f.moteur.direBonjour).mockImplementationOnce(() => bonjour.promesse)
      const banc = await monter(IL_ATTEND, { ...ROUTES_DU_JEU, [LIRE]: () => json(AU_REPOS) }, { voyage: EN_1903, moteur: f })
      await banc.calme()
      act(() => banc.rappels().entreeProche?.(1900))
      fireEvent.click(bouton('Prendre le train pour 1900'))
      act(() => banc.client.setQueryData(cles.voyageur, IL_ATTEND))
      await act(async () => undefined)
      expect(screen.queryByTestId('controle')).toBeNull()
      await act(async () => {
        lacherEnEchec(bonjour.promesse)
        await Promise.resolve()
      })
      await portiere()
    })

    // Le bouton n'est pas seul à lancer un passage : la halte au bout de la foire le lance depuis le
    // moteur, le repos d'un défilement aussi, et la page ne l'apprend que du rappel `passage`.
    // Mutations : `passage: setPassage` retiré des rappels de la page ; son relais retiré de `CarteCanvas`.
    it('pendant un passage que le moteur joue sans le bouton il n’entre pas ; le moteur le dit fini, il entre', async () => {
      preter(PAGES_1900)
      const lecture = retenue<Response>()
      const banc = await monter(IL_ATTEND, { ...ROUTES_DU_JEU, [LIRE]: () => lecture.promesse }, { voyage: EN_1903 })
      await waitFor(() => expect(banc.requetes).toContain(LIRE))
      act(() => banc.rappels().passage?.(true))
      await act(async () => lecture.lacher(json(IL_ATTEND)))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      act(() => banc.rappels().passage?.(false))
      await portiere()
    })

    // Le blocage de la relecture du groupe B : « L’utiliser » ferme la fête dans le geste qui encaisse.
    // Le ticket en vol, puis la carte en relecture, puis l'avancée que la carte relue pose : il n'entre
    // à aucun de ces temps. Mutations, une par constat : `utiliser.isPending` retiré de
    // `pleinEcranOccupe` (il entre sitôt la fête fermée) ; `voyage.isFetching` retiré (il entre à la
    // réponse du ticket).
    it('« L’utiliser » à la fête : il n’entre qu’après l’avancée', async () => {
      preter()
      const aMontrer: Voyage = { ...EN_1898, ticket_a_montrer: { annee: 1899, motif: 'Tu as fait le tour de 1898.', emis_le: '2026-09-21T21:00:00.000Z' } }
      const client = createQueryClient()
      client.setQueryData(cles.voyage, aMontrer)
      client.setQueryData(cles.tickets, { tickets: [] })
      client.setQueryData(cles.voyageur, IL_ATTEND)
      const f = moteurFactice()
      const marche = retenue<void>()
      vi.mocked(f.moteur.marcher).mockImplementation(() => marche.promesse)
      // Trois temps que le test tient : le ticket montré (sa réponse relit la carte, encore en 1898),
      // le ticket encaissé, la carte relue en 1899. Chaque lecture rend une réponse neuve.
      const montre = retenue<void>()
      const encaisse = retenue<void>()
      const relue = retenue<void>()
      let cartes = 0
      const banc = await monter(
        IL_ATTEND,
        {
          [MONTRE]: () => montre.promesse.then(() => new Response(null, { status: 204 })),
          [UTILISER]: () => encaisse.promesse.then(() => json({ annee: 1899 })),
          [VOYAGE]: () => (cartes++ === 0 ? json(EN_1898) : relue.promesse.then(() => json(EN_1899))),
        },
        { voyage: aMontrer, client, moteur: f },
      )
      expect(await screen.findByRole('dialog', { name: '1898 est bouclée' })).toBeInTheDocument()
      await banc.calme()
      const sansLecture = () => waitFor(() => expect(banc.client.isFetching()).toBe(0))
      fireEvent.click(bouton('L’utiliser'))
      await waitFor(() => expect(banc.requetes).toContain(UTILISER))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '1898 est bouclée' })).toBeNull())
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => montre.lacher())
      await waitFor(() => expect(banc.requetes.filter((r) => r === VOYAGE)).toHaveLength(1))
      await sansLecture()
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => encaisse.lacher())
      await waitFor(() => expect(banc.requetes.filter((r) => r === VOYAGE)).toHaveLength(2))
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => relue.lacher())
      await waitFor(() => expect(f.moteur.marcher).toHaveBeenCalledWith(1899))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => marche.lacher())
      await portiere()
    })

    // La même fenêtre sans fête : le ticket touché avant que l'état du voyageur n'arrive. Mêmes mutations.
    it('« Utiliser le ticket » touché avant l’état du voyageur : il n’entre qu’après l’avancée', async () => {
      preter()
      const f = moteurFactice()
      const marche = retenue<void>()
      vi.mocked(f.moteur.marcher).mockImplementation(() => marche.promesse)
      const lecture = retenue<void>()
      const encaisse = retenue<void>()
      const relue = retenue<void>()
      let cartes = 0
      const banc = await monter(
        IL_ATTEND,
        {
          [TICKETS]: () => json({ tickets: [TICKET_DE_1899] }),
          [LIRE]: () => lecture.promesse.then(() => json(IL_ATTEND)),
          [UTILISER]: () => encaisse.promesse.then(() => json({ annee: 1899 })),
          [VOYAGE]: () => (cartes++ === 0 ? json(EN_1898) : relue.promesse.then(() => json(EN_1899))),
        },
        { moteur: f },
      )
      fireEvent.click(await screen.findByRole('button', { name: /Utiliser le ticket/ }))
      await waitFor(() => expect(banc.requetes).toContain(UTILISER))
      await act(async () => lecture.lacher())
      await waitFor(() => expect(etatEnCache(banc.client)?.controleur.attend).toBe(true))
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => encaisse.lacher())
      await waitFor(() => expect(banc.requetes.filter((r) => r === VOYAGE)).toHaveLength(2))
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => relue.lacher())
      await waitFor(() => expect(f.moteur.marcher).toHaveBeenCalledWith(1899))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      await act(async () => marche.lacher())
      await portiere()
    })

    // Ce qui est déjà ouvert. Mutation : `date !== null` retiré de `pleinEcranOccupe`.
    it('l’affiche d’une date ouverte : il n’entre qu’une fois refermée', async () => {
      preter()
      const lecture = retenue<Response>()
      const banc = await monter(IL_ATTEND, { [LIRE]: () => lecture.promesse })
      await waitFor(() => expect(banc.requetes).toContain(LIRE))
      act(() => banc.rappels().date({ an: 1895, x: 38, y: 112, court: '22 mars', lieu: 'Paris', titre: 'La première projection', jour: 'Vendredi 22 mars 1895', texte: 'Un texte.', image: null }))
      await act(async () => lecture.lacher(json(IL_ATTEND)))
      await banc.calme()
      await act(async () => undefined)
      expect(screen.getByRole('dialog', { name: 'La première projection' })).toBeInTheDocument()
      expect(screen.queryByTestId('controle')).toBeNull()
      fireEvent.click(bouton('Refermer'))
      await portiere()
    })

    // Le message d'un objet ramassé tient trois secondes (minuteries simulées : rien n'attend).
    // Mutation : `message !== null` retiré de `pleinEcranOccupe`.
    it('« Objet trouvé » à l’écran : il n’entre qu’après le message', async () => {
      preter(PAGES_1900)
      const banc = await monter(AU_REPOS, { ...ROUTES_DU_JEU, [LIRE]: () => json(AU_REPOS), [RAMASSER_LE_MELON]: () => json({ cle: 'melon', annee: 1901, ramasse_le: '2026-10-08T10:00:00.000Z' }) }, { voyage: EN_1903 })
      await banc.calme()
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const passer = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
        act(() => banc.rappels().objet?.('melon', { x: 60, y: 520 }))
        await passer(1)
        expect(screen.getByText(/^Objet trouvé/)).toBeInTheDocument()
        act(() => banc.client.setQueryData(cles.voyageur, { ...IL_ATTEND, objets: etatEnCache(banc.client)!.objets }))
        await passer(1)
        expect(screen.queryByTestId('controle')).toBeNull()
        await passer(2998)
        expect(screen.queryByTestId('controle')).toBeNull()
        await passer(10)
        expect(screen.queryByText(/^Objet trouvé/)).toBeNull()
        expect(screen.getByTestId('controle')).toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('la portière ouverte : le billet retenu et le dessin du monde, un seul fait', () => {
    const vivante = () => expect(screen.getByRole('heading', { level: 1 }).parentElement!.querySelectorAll(':scope > [inert]')).toHaveLength(0)

    // Le monde « à venir » ne compose pas la clé, et la carte lit l'état du voyageur pour les objets de
    // 1900 : un contrôleur qui attend n'y ouvre rien et ne rend rien inerte. La carte relue me ramène
    // en 1903 sous la vue d'ensemble : il n'a rien retenu de 1910 et n'entre qu'une fois celle-ci
    // refermée. Mutations : `DessinDuControleur &&` retiré de `billetDemande` (le billet retenu en 1910
    // ouvre la portière sous la vue d'ensemble) ; avec elle, l'inertie lue sur `controle` seul (deux
    // enveloppes inertes en 1910, sans dialogue).
    it('un monde sans la clé qui montre 1900 : ni portière ni carte inerte, et rien n’est retenu pour le monde d’après', async () => {
      preter(PAGES_1900)
      const banc = await monter(IL_ATTEND, { ...ROUTES_DU_JEU, [LIRE]: () => json(IL_ATTEND) }, { voyage: EN_1910 })
      await banc.calme()
      await act(async () => undefined)
      expect(etatEnCache(banc.client)?.controleur.attend).toBe(true)
      pasDePortiere()
      vivante()
      act(() => banc.rappels().ensemble(true))
      act(() => banc.client.setQueryData(cles.voyage, EN_1903))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      act(() => banc.rappels().ensemble(false))
      await portiere()
    })

    // La portière ouverte, la carte relue me pose dans un monde sans la clé : le dialogue part, la
    // carte ne reste pas inerte. Mutation : l'inertie des enveloppes lue sur `controle` seul.
    it('portière ouverte, mon année en cours passe à un monde sans la clé : la carte ne reste pas inerte', async () => {
      preter(PAGES_1900)
      const banc = await monter(IL_ATTEND, { ...ROUTES_DU_JEU, [LIRE]: () => json(IL_ATTEND) }, { voyage: EN_1903 })
      await portiere()
      await banc.calme()
      act(() => banc.client.setQueryData(cles.voyage, jusqua(1899)))
      await banc.calme()
      await act(async () => undefined)
      pasDePortiere()
      vivante()
    })
  })
})
