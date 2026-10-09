import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { BobineRamassee, Voyageur } from '../api/voyage'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import { exemple } from '../test/contrat'
import { moteurFactice } from '../test/moteurFactice'
import { json, servir } from '../test/serveur'
import { COURRIER_VIDE, malleVide, voyage1890 } from '../test/voyage'
import { NOM_DE_LA_SACOCHE } from '../voyage/voyageur'

/**
 * Les bobines perdues suivent le compte (9 octobre 2026), côté page : qui fait foi, ce qu'un toucher
 * écrit, ce que le cache apprend, le versement de l'appareil au compte, et 1890 qui ne lit rien de
 * plus. Le registre est le vrai : trois bobines en 1890, trois en 1900. Le moteur est factice : le
 * test joue ses rappels `bobine` et `bobineArrivee`. Rien ici ne regarde un dessin.
 */
const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const CLE_DE_L_APPAREIL = `journal.carte.bobines.${SESSION.user.id}`
const LE = '2026-10-09T09:00:00.000Z'
const DIABLES: BobineRamassee = { cle: 'les_quatre_diables', ramasse_le: '2026-10-04T20:41:09.000Z' }
const HAMLET: BobineRamassee = { cle: 'hamlet', ramasse_le: '2026-10-07T21:15:40.000Z' }
/** L'exemple du contrat, ses rubriques toutes vues sauf `bobine`, jamais ouverte ; le compte tient `bobines`. */
const etatDuCompte = (bobines: BobineRamassee[]): Voyageur => {
  const base = exemple<Voyageur>('/me/voyage/voyageur', 'get', 200)
  return { ...base, bobines, controleur: { attend: false, billet: null }, rubriques: base.rubriques.map((r) => ({ ...r, vue_le: r.rubrique === 'bobine' ? null : '2026-10-08T00:00:00.000Z' })) }
}
const LES_SIX = ['les-quatre-diables', 'la-tete-de-janus', 'londres-apres-minuit', 'soldiers', 'hamlet', 'fairylogue']
const LIRE = 'GET /api/me/voyage/voyageur'
const ranger = (cle: string) => `POST /api/me/voyage/bobines/${cle}/ramasser`
const ligne = (cle: string): BobineRamassee => ({ cle, ramasse_le: LE })
const REFUS = { code: 'NOT_FOUND', message: 'Cette bobine n’existe pas.', retryable: false }
const PANNE = { code: 'INTERNAL', message: 'Une erreur est survenue.', retryable: true }
const OUVERTURE_DE_1890 = ['GET /api/auth/me', 'GET /api/me/voyage', 'GET /api/me/voyage/tickets']

/** Un Voyage de 1895 à 1909, toutes les années ouvertes jusqu'à `enCours`. */
const voyage = (enCours: number) =>
  voyage1890(
    enCours,
    Array.from({ length: 1909 - 1895 + 1 }, (_, i) => {
      const annee = 1895 + i
      return annee < enCours
        ? { annee, statut: 'ouverte' as const, visitee: true, recompense: null, progression: null }
        : { annee, statut: annee === enCours ? ('en_cours' as const) : ('verrouillee' as const), visitee: false, recompense: null, progression: null, profondeur: 0 }
    }),
  )

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>
const appareil = (cles?: string[]) => (cles ? localStorage.setItem(CLE_DE_L_APPAREIL, JSON.stringify(cles)) : (JSON.parse(localStorage.getItem(CLE_DE_L_APPAREIL) ?? 'null') as string[] | null))
/** Les promesses en cours vont au bout, sans qu'aucune horloge avance. */
const repos = () =>
  act(async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve()
  })

/** La carte d'un membre, montée et donnée au moteur. En 1903 (le défaut), l'état du voyageur est lu, sauf `lu: false`. */
async function monter(compte: Voyageur, routes: Routes = {}, { enCours = 1903, lu = true }: { enCours?: number; lu?: boolean } = {}) {
  const f = moteurFactice()
  const client = createQueryClient()
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(voyage(enCours)),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    [LIRE]: () => json(compte),
    'GET /api/me/voyage/cartes-postales': () => json(COURRIER_VIDE),
    'GET /api/me/voyage/decennies/1900/etiquettes': () => json(malleVide(1900)),
    ...routes,
  })
  render(
    <QueryClientProvider client={client}>
      <FabriqueMoteurContexte.Provider value={f.fabrique}>
        <MemoryRouter initialEntries={['/voyage']}>
          <App />
        </MemoryRouter>
      </FabriqueMoteurContexte.Provider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(f.etats.length).toBeGreaterThan(0))
  if (lu && enCours >= 1900) await waitFor(() => expect(client.getQueryState(cles.voyageur)?.status).toBe('success'))
  if (lu) {
    await waitFor(() => expect(client.isFetching()).toBe(0))
    await repos()
  }
  /** Ce que la page dit au moteur de ne pas proposer, à l'instant. */
  const tues = () => vi.mocked(f.moteur.reglerBobines).mock.calls.slice(-1)[0]?.[0]
  const toucher = (cle: string) => act(() => f.rappels().bobine(cle))
  const arriver = (cle: string) => act(() => f.rappels().bobineArrivee(cle))
  const rangees = () => requetes.filter((r) => r.includes('/bobines/'))
  const auCache = () => client.getQueryData<Voyageur>(cles.voyageur)
  return { ...f, client, requetes, tues, toucher, arriver, rangees, auCache }
}

const etat = () => screen.queryByRole('status')

describe('les bobines perdues, là où le compte fait foi (un membre arrivé en 1900)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Un autre appareil : son stockage est vide, le compte tient deux bobines. Mutations : la carte qui
  // lit encore l'appareil seul ; `cleDeBobineDuMonde` oubliée à la lecture (le moteur recevrait
  // `les_quatre_diables`, qu'aucun monde ne connaît, et la bobine se proposerait) ; avant la réponse,
  // la liste de l'appareil dite au moteur (tout se proposerait, les bobines du compte comprises).
  it('une bobine que le compte tient ne se propose pas sur un appareil qui ne l’a jamais vue ; avant la réponse, aucune ne se propose', async () => {
    let repondre: (r: Response) => void = () => undefined
    const banc = await monter(etatDuCompte([DIABLES, HAMLET]), { [LIRE]: () => new Promise<Response>((fin) => (repondre = fin)) }, { lu: false })
    await waitFor(() => expect(banc.requetes).toContain(LIRE))
    expect(banc.tues()).toEqual(LES_SIX)
    await act(async () => repondre(json(etatDuCompte([DIABLES, HAMLET]))))
    await waitFor(() => expect(banc.tues()).toEqual(['les-quatre-diables', 'hamlet']))
    act(() => banc.rappels().presences([], 1890))
    expect(screen.getByText(/^Bobines retrouvées/)).toHaveTextContent('Bobines retrouvées 1/3')
    expect(banc.rangees()).toEqual([])
  })

  // En panne sans rien en cache, comme pour les objets : rien ne se propose, sans un mot.
  // Mutation : `bobines.lues` qui ne regarde que `faitFoi`.
  it('l’état du voyageur en panne : aucune bobine ne se propose, la carte reste, sans un mot', async () => {
    const banc = await monter(etatDuCompte([]), { [LIRE]: () => json({ ...PANNE, retryable: false }, 500) }, { lu: false })
    await waitFor(() => expect(banc.client.getQueryState(cles.voyageur)?.status).toBe('error'))
    expect(banc.tues()).toEqual(LES_SIX)
    expect(etat()).not.toBeInTheDocument()
  })

  // Mutations : la clé du monde envoyée telle quelle ; la réponse posée à la place de l'état (les
  // objets, les rubriques, les poinçons effacés) ; le préfixe `voyage` périmé (la carte et l'état
  // relus) ; l'appareil encore écrit ; la trouvaille dite avant la réponse du compte.
  it('un toucher range la bobine au compte : un seul POST à tirets bas, le cache n’apprend que son champ, rien n’est relu, l’appareil n’écrit plus', async () => {
    let repondre: (r: Response) => void = () => undefined
    const compte = etatDuCompte([HAMLET])
    const banc = await monter(compte, { [ranger('les_quatre_diables')]: () => new Promise<Response>((fin) => (repondre = fin)) })
    const avant = [...banc.requetes]
    banc.toucher('les-quatre-diables')
    banc.arriver('les-quatre-diables')
    await waitFor(() => expect(banc.rangees()).toEqual([ranger('les_quatre_diables')]))
    await repos()
    expect(etat()).not.toBeInTheDocument()
    expect(banc.tues()).toEqual(['hamlet', 'les-quatre-diables'])
    await act(async () => repondre(json(ligne('les_quatre_diables'))))
    await waitFor(() => expect(etat()).toHaveTextContent('Bobine retrouvée 1/3« Les Quatre Diables », F. W. Murnau, 1928 : un film perdu.'))
    await waitFor(() => expect(banc.client.isFetching() + banc.client.isMutating()).toBe(0))
    expect(banc.auCache()).toEqual({ ...compte, bobines: [HAMLET, ligne('les_quatre_diables')] })
    expect(banc.requetes).toEqual([...avant, ranger('les_quatre_diables')])
    expect(banc.tues()).toEqual(['hamlet', 'les-quatre-diables'])
    expect(appareil()).toBeNull()
  })

  // Le rappel du moteur rejoué pour la même bobine, avant la réponse puis après. Mutation : la garde
  // de `ramasser` (`connues`) retirée.
  it('deux touchers de la même bobine n’écrivent qu’une fois, avant la réponse comme après', async () => {
    let repondre: (r: Response) => void = () => undefined
    const banc = await monter(etatDuCompte([]), { [ranger('soldiers')]: () => new Promise<Response>((fin) => (repondre = fin)) })
    banc.toucher('soldiers')
    banc.toucher('soldiers')
    banc.arriver('soldiers')
    await waitFor(() => expect(banc.rangees()).toHaveLength(1))
    await act(async () => repondre(json(ligne('soldiers'))))
    await waitFor(() => expect(etat()).toHaveTextContent('Bobine retrouvée 1/3'))
    banc.toucher('soldiers')
    await repos()
    expect(banc.rangees()).toEqual([ranger('soldiers')])
    expect(banc.auCache()?.bobines).toEqual([ligne('soldiers')])
  })

  // Une lecture de l'état en vol au moment du ramassage porte l'état d'avant : atterrie après, elle
  // effacerait la ligne. Mutation : `cancelQueries` retiré de `rangerAuCompte`.
  it('une lecture de l’état partie avant le ramassage et revenue après ne défait pas la bobine rangée', async () => {
    let lectures = 0
    let relire: (r: Response) => void = () => undefined
    const compte = etatDuCompte([])
    const banc = await monter(compte, { [LIRE]: () => (++lectures === 1 ? json(compte) : new Promise<Response>((fin) => (relire = fin))), [ranger('hamlet')]: () => json(ligne('hamlet')) })
    void banc.client.refetchQueries({ queryKey: cles.voyageur, exact: true })
    await waitFor(() => expect(lectures).toBe(2))
    banc.toucher('hamlet')
    banc.arriver('hamlet')
    await waitFor(() => expect(etat()).toHaveTextContent('Bobine retrouvée 1/3'))
    await act(async () => relire(json(compte)))
    await waitFor(() => expect(banc.client.isFetching()).toBe(0))
    expect(banc.auCache()?.bobines).toEqual([ligne('hamlet')])
    expect(banc.tues()).toEqual(['hamlet'])
  })

  // Le refus se dit comme celui d'un objet, tel quel, et la bobine revient dans le décor : elle n'est
  // plus tue au moteur, et se retouche. Mutations : le refus tu ; la bobine gardée en main après le
  // refus ; « Bobine retrouvée » dite quand même ; la ligne posée au cache avant la réponse.
  it.each([
    ['refusée', () => json(REFUS, 404), REFUS.message],
    ['en panne', () => Promise.reject(new TypeError('réseau')), 'L’API est injoignable. Vérifie ta connexion, puis réessaie.'],
  ])('%s, la bobine revient dans le décor : rien au cache, le refus se dit tel quel, jamais la trouvaille, et elle se retouche', async (_cas, reponse, dit) => {
    const compte = etatDuCompte([HAMLET])
    const banc = await monter(compte, { [ranger('fairylogue')]: reponse })
    banc.toucher('fairylogue')
    banc.arriver('fairylogue')
    await waitFor(() => expect(etat()?.textContent).toBe(dit))
    expect(banc.tues()).toEqual(['hamlet'])
    expect(banc.auCache()).toEqual(compte)
    expect(appareil()).toBeNull()
    banc.toucher('fairylogue')
    await waitFor(() => expect(banc.rangees()).toHaveLength(2))
  })

  // Le moteur garde hors du décor la bobine qui vole (`reglerBobines`) : la lui rendre en plein vol
  // la laisserait cachée après l'atterrissage. Mutation : `rendre` appelé dès le refus.
  it('refusée en plein vol, la bobine n’est rendue au moteur qu’à son arrivée', async () => {
    const banc = await monter(etatDuCompte([]), { [ranger('fairylogue')]: () => json(REFUS, 404) })
    banc.toucher('fairylogue')
    await waitFor(() => expect(etat()?.textContent).toBe(REFUS.message))
    expect(banc.tues()).toEqual(['fairylogue'])
    banc.arriver('fairylogue')
    expect(banc.tues()).toEqual([])
    expect(etat()?.textContent).toBe(REFUS.message)
  })

  // Aucun écran de la sacoche ne montre les bobines : rien n'éteindrait leur point. Mutation :
  // `bobine` ajoutée à `RUBRIQUES_DE_LA_PASTILLE` ; une marque « vue » envoyée après le versement.
  it('des bobines au compte, la rubrique jamais ouverte : pas de point, et aucune rubrique n’est marquée vue par la carte', async () => {
    appareil(['soldiers'])
    const banc = await monter(etatDuCompte([DIABLES, HAMLET]), { [ranger('soldiers')]: () => json(ligne('soldiers')) })
    await waitFor(() => expect(banc.auCache()?.bobines).toHaveLength(3))
    await repos()
    expect(screen.getByRole('link', { name: new RegExp(`^${NOM_DE_LA_SACOCHE}`) })).toHaveAttribute('aria-label', NOM_DE_LA_SACOCHE)
    expect(banc.requetes.filter((r) => r.includes('/rubriques/'))).toEqual([])
  })
})

describe('le versement de l’appareil au compte', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : tout l'appareil versé, la clé déjà au compte comprise ; deux écritures parties
  // ensemble ; une clé à tirets envoyée ; la réponse posée à la place de l'état ; un message montré ;
  // la clé réglée gardée sur l'appareil.
  it('verse une à une les clés que le compte n’a pas, et elles seules, sans rien montrer ; réglée, une clé quitte l’appareil', async () => {
    appareil(['les-quatre-diables', 'hamlet', 'soldiers'])
    const reponses: Array<(r: Response) => void> = []
    const attendre = () => new Promise<Response>((fin) => reponses.push(fin))
    const compte = etatDuCompte([HAMLET])
    const banc = await monter(compte, { [ranger('les_quatre_diables')]: attendre, [ranger('soldiers')]: attendre })
    // Ce que le compte tient déjà quitte l'appareil d'abord ; le reste attend sa réponse, et reste trouvé.
    expect(banc.rangees()).toEqual([ranger('les_quatre_diables')])
    expect(appareil()).toEqual(['les-quatre-diables', 'soldiers'])
    expect(banc.tues()).toEqual(['hamlet', 'les-quatre-diables', 'soldiers'])
    await act(async () => reponses[0]!(json(ligne('les_quatre_diables'))))
    await waitFor(() => expect(banc.rangees()).toEqual([ranger('les_quatre_diables'), ranger('soldiers')]))
    expect(appareil()).toEqual(['soldiers'])
    await act(async () => reponses[1]!(json(ligne('soldiers'))))
    await waitFor(() => expect(appareil()).toEqual([]))
    await repos()
    expect(banc.auCache()).toEqual({ ...compte, bobines: [HAMLET, ligne('les_quatre_diables'), ligne('soldiers')] })
    expect(banc.requetes.filter((r) => r === LIRE || r === 'GET /api/me/voyage')).toEqual(['GET /api/me/voyage', LIRE])
    expect(banc.rangees()).toHaveLength(2)
    expect(etat()).not.toBeInTheDocument()
    expect([...banc.tues()!].sort()).toEqual(['hamlet', 'les-quatre-diables', 'soldiers'])
  })

  // Mutations : `resteAVerser` qui rend tout l'appareil ; le versement rejoué sans regarder le compte.
  it('le compte a déjà tout : rien n’est versé, à cette visite ni à la suivante, et l’appareil est vidé', async () => {
    appareil(['les-quatre-diables', 'hamlet'])
    const banc = await monter(etatDuCompte([DIABLES, HAMLET]))
    expect(appareil()).toEqual([])
    expect(banc.rangees()).toEqual([])
    cleanup()
    const suivante = await monter(etatDuCompte([DIABLES, HAMLET]))
    expect(suivante.rangees()).toEqual([])
    expect(suivante.tues()).toEqual(['les-quatre-diables', 'hamlet'])
  })

  // Une clé que le serveur refuse pour elle-même (`404` hors de son catalogue, `400` mal formée) est
  // abandonnée : elle quitte l'appareil, les suivantes sont versées, et la visite suivante ne la
  // rejoue pas. Mutations : `cleRefusee` toujours fausse (le versement s'arrête, et boucle à chaque
  // visite) ; la clé refusée gardée sur l'appareil.
  it.each([
    ['404', 404],
    ['400', 400],
  ])('une clé refusée (%s) est abandonnée sans boucle : les suivantes sont versées, la visite suivante ne la rejoue pas', async (_cas, statut) => {
    appareil(['perdue-pour-de-bon', 'soldiers'])
    const refuser = { [ranger('perdue_pour_de_bon')]: () => json({ ...REFUS, code: statut === 400 ? 'VALIDATION' : 'NOT_FOUND' }, statut) }
    const banc = await monter(etatDuCompte([]), { ...refuser, [ranger('soldiers')]: () => json(ligne('soldiers')) })
    await waitFor(() => expect(appareil()).toEqual([]))
    expect(banc.rangees()).toEqual([ranger('perdue_pour_de_bon'), ranger('soldiers')])
    expect(etat()).not.toBeInTheDocument()
    cleanup()
    const suivante = await monter(etatDuCompte([ligne('soldiers')]), refuser)
    expect(suivante.rangees()).toEqual([])
  })

  // Interrompu (une panne du serveur, l'API injoignable), le versement s'arrête là, sans rien régler :
  // la clé reste sur l'appareil, reste trouvée, et la visite suivante reprend. Mutations : la panne
  // prise pour un refus (la clé abandonnée, la bobine perdue) ; le versement poursuivi après la panne.
  it.each([
    ['le serveur en panne', () => json(PANNE, 500)],
    ['l’API injoignable', () => Promise.reject(new TypeError('réseau'))],
  ])('interrompu (%s), il s’arrête sans rien régler, les bobines restent trouvées, et il se reprend à la visite suivante', async (_cas, panne) => {
    appareil(['les-quatre-diables', 'soldiers'])
    const banc = await monter(etatDuCompte([]), { [ranger('les_quatre_diables')]: panne })
    expect(banc.rangees()).toEqual([ranger('les_quatre_diables')])
    expect(appareil()).toEqual(['les-quatre-diables', 'soldiers'])
    expect(banc.tues()).toEqual(['les-quatre-diables', 'soldiers'])
    expect(etat()).not.toBeInTheDocument()
    cleanup()
    const suivante = await monter(etatDuCompte([]), { [ranger('les_quatre_diables')]: () => json(ligne('les_quatre_diables')), [ranger('soldiers')]: () => json(ligne('soldiers')) })
    await waitFor(() => expect(appareil()).toEqual([]))
    expect(suivante.rangees()).toEqual([ranger('les_quatre_diables'), ranger('soldiers')])
  })
})

describe('en 1890, l’appareil fait foi et la carte ne lit rien de plus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // La règle du dépôt : aucune requête de plus en 1890. Mutations : l'état du voyageur lu pour les
  // bobines (`enabled` élargi) ; le versement lancé sans lecture, sur l'appareil seul.
  it('à l’ouverture, la carte ne lit que la session, la carte et les tickets, ne verse rien, et tait au moteur les bobines de l’appareil', async () => {
    appareil(['les-quatre-diables', 'la-tete-de-janus'])
    const banc = await monter(etatDuCompte([]), {}, { enCours: 1899 })
    expect([...banc.requetes].sort()).toEqual(OUVERTURE_DE_1890)
    expect(banc.tues()).toEqual(['les-quatre-diables', 'la-tete-de-janus'])
    expect(appareil()).toEqual(['les-quatre-diables', 'la-tete-de-janus'])
  })

  // Une écriture au geste n'est pas une lecture. Mutations : le ramassage de 1890 qui n'écrit plus au
  // compte ; qui n'écrit plus sur l'appareil ; une clé à tirets envoyée ; deux écritures pour deux touchers.
  it('un toucher écrit sur l’appareil et range au compte, d’un seul POST à tirets bas, sans rien lire', async () => {
    const banc = await monter(etatDuCompte([]), { [ranger('la_tete_de_janus')]: () => json(ligne('la_tete_de_janus')) }, { enCours: 1899 })
    banc.toucher('la-tete-de-janus')
    banc.toucher('la-tete-de-janus')
    banc.arriver('la-tete-de-janus')
    expect(etat()).toHaveTextContent('Bobine retrouvée 1/3')
    expect(appareil()).toEqual(['la-tete-de-janus'])
    await repos()
    expect([...banc.requetes].sort()).toEqual([...OUVERTURE_DE_1890, ranger('la_tete_de_janus')].sort())
    expect(banc.auCache()).toBeUndefined()
  })

  // L'appareil la tient : l'échec de l'écriture au compte se tait, et le versement la reprendra en
  // 1900. Mutation : le refus dit, ou la bobine rendue au décor, comme là où le compte fait foi.
  it.each([
    ['refusée', () => json(REFUS, 404)],
    ['en panne', () => Promise.reject(new TypeError('réseau'))],
  ])('l’écriture au compte %s : la bobine reste trouvée sur l’appareil, sans un mot de refus', async (_cas, reponse) => {
    const banc = await monter(etatDuCompte([]), { [ranger('londres_apres_minuit')]: reponse }, { enCours: 1899 })
    banc.toucher('londres-apres-minuit')
    banc.arriver('londres-apres-minuit')
    await repos()
    expect(banc.rangees()).toEqual([ranger('londres_apres_minuit')])
    expect(etat()?.textContent).toBe('Bobine retrouvée 1/3« Londres après minuit », Tod Browning, 1927 : un film perdu.')
    expect(banc.tues()).toEqual(['londres-apres-minuit'])
    expect(appareil()).toEqual(['londres-apres-minuit'])
  })
})
