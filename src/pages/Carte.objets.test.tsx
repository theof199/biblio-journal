import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Malle, ObjetRamasse, Voyageur } from '../api/voyage'
import { FabriqueMoteurContexte } from '../carte/CarteCanvas'
import stylesDeLaCarte from '../carte/Carte.module.css'
import { exemple } from '../test/contrat'
import { moteurFactice } from '../test/moteurFactice'
import { json, servir } from '../test/serveur'
import { COURRIER_VIDE, malleVide, voyage1890 } from '../test/voyage'
import { auTempo } from '../voyage/tempo'

/**
 * Les objets sur le quai (plan des écrans des lots, brief 4), côté page : ce que la carte lit, ce
 * qu'un toucher écrit, ce que le cache apprend, ce qui se dit, ce qui se passe au refus et en panne.
 * Le moteur est factice : le test joue son rappel `objet`. Rien ici ne regarde un dessin.
 *
 * Le registre est le vrai, 1900 compris. `essai.objets`, nul par défaut : posé, le monde de 1900 ne
 * cache que ses premiers objets, pour qu'un compte écrit en dur se voie.
 */
const essai = vi.hoisted(() => ({ objets: null as number | null }))
vi.mock('../mondes', async (original) => {
  const vrai = await original<typeof import('../mondes')>()
  return {
    ...vrai,
    creerRegistre: () => {
      const registre = vrai.creerRegistre()
      return (decennie: number) => {
        const monde = registre(decennie)
        return decennie === 1900 && essai.objets !== null ? { ...monde, objets: monde.objets.slice(0, essai.objets) } : monde
      }
    },
  }
})

const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
const LANTERNE: ObjetRamasse = { cle: 'lanterne', annee: 1900, ramasse_le: '2026-10-07T09:00:00.000Z' }
const MELON: ObjetRamasse = { cle: 'melon', annee: 1901, ramasse_le: '2026-10-08T10:00:00.000Z' }
const ETAT: Voyageur = { ...exemple<Voyageur>('/me/voyage/voyageur', 'get', 200), objets: [LANTERNE] }
const MALLE: Malle = exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)
const DIX = ['lanterne', 'melon', 'parapluie', 'montre', 'programme', 'facteur', 'longuevue', 'eventail', 'sifflet', 'valise']
const REFUS = { code: 'NOT_FOUND', message: 'Cette année est verrouillée.', retryable: false }
const LIRE = 'GET /api/me/voyage/voyageur'
const RAMASSER_LE_MELON = 'POST /api/me/voyage/objets/melon/ramasser'
const RAMASSER_LE_PARAPLUIE = 'POST /api/me/voyage/objets/parapluie/ramasser'
const PARAPLUIE: ObjetRamasse = { cle: 'parapluie', annee: 1902, ramasse_le: '2026-10-08T11:00:00.000Z' }
const OU = { x: 60, y: 520 }

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

/** La carte d'un membre en 1903, montée et donnée au moteur ; l'état du voyageur lu et le cache au calme, sauf `lu: false`. */
async function monter(routes: Routes = {}, { enCours = 1903, lu = true }: { enCours?: number; lu?: boolean } = {}) {
  const f = moteurFactice()
  const client = createQueryClient()
  const requetes = servir({
    'GET /api/auth/me': () => json(SESSION),
    'GET /api/me/voyage': () => json(voyage(enCours)),
    'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
    [LIRE]: () => json(ETAT),
    'GET /api/me/voyage/cartes-postales': () => json(COURRIER_VIDE),
    // Depuis le brief 5, la carte d'un membre de 1900 lit aussi la malle de sa décennie, pour le point rouge.
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
  if (lu) {
    await waitFor(() => expect(client.getQueryState(cles.voyageur)?.status).toBe('success'))
    await waitFor(() => expect(client.isFetching()).toBe(0))
  }
  const toucher = (cle: string) => act(() => f.rappels().objet!(cle, OU))
  /** Le temps passe à la main, sans attendre : les minuteries seules sont doublées, à partir d'ici. */
  const doubler = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const passer = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
  const dits = () => vi.mocked(f.moteur.reglerObjets).mock.calls.map((a) => a[0])
  return { ...f, client, requetes, toucher, doubler, passer, dits }
}

const calme = () => vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))
const etat = () => screen.queryByRole('status')
const enVol = () => document.querySelectorAll(`.${stylesDeLaCarte.vol}`).length

describe('les objets sur le quai, côté page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    essai.objets = null
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutations : la lecture retirée (`enabled: false`) ; la liste du moteur tirée du catalogue et non
  // de l'état lu ; `?? []` avant la réponse (les dix objets se proposeraient, les ramassés compris).
  it('lit l’état du voyageur une fois et dit au moteur ce qui est ramassé ; avant la réponse, rien ne se propose', async () => {
    let repondre: (r: Response) => void = () => undefined
    const banc = await monter({ [LIRE]: () => new Promise<Response>((fin) => (repondre = fin)) }, { lu: false })
    await waitFor(() => expect(banc.requetes).toContain(LIRE))
    expect(banc.dits().pop()).toEqual(DIX)
    await act(async () => repondre(json(ETAT)))
    await waitFor(() => expect(banc.dits().pop()).toEqual(['lanterne']))
    expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(1)
  })

  // La règle 3 du plan : sur la carte, une lecture en panne se tait, et la carte reste. Mutations :
  // `?? []` en panne ; une `Panne` rendue pour l'état du voyageur.
  it('en panne, l’état du voyageur se tait : aucun objet ne se propose, la carte reste, sans un mot', async () => {
    const banc = await monter({ [LIRE]: () => json({ code: 'INTERNAL', message: 'Panne.', retryable: false }, 500) }, { lu: false })
    await waitFor(() => expect(banc.client.getQueryState(cles.voyageur)?.status).toBe('error'))
    expect(banc.dits().pop()).toEqual(DIX)
    expect(screen.getByRole('heading', { level: 1, name: `Le Voyage de ${SESSION.user.pseudo}` })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/Réessa/)).not.toBeInTheDocument()
    expect(etat()).not.toBeInTheDocument()
  })

  // Un toucher écrit une fois ; le cache ne gagne que la ligne rendue, à sa place, et rien n'est relu
  // (ni la carte, ni les tickets, ni l'état). Mutations : `invalidateQueries({ queryKey: cles.voyage })`
  // à la place du `setQueryData` ; la réponse posée à la place de l'état ; la ligne ajoutée sans ôter
  // celle d'avant ; la ligne jamais posée (le moteur ne serait pas confirmé, le compte dirait 1).
  it('un toucher ramasse : un seul POST, le cache gagne la ligne rendue et elle seule, rien n’est relu, et le moteur l’apprend', async () => {
    calme()
    const banc = await monter({ [RAMASSER_LE_MELON]: () => json(MELON) })
    const avant = [...banc.requetes]
    banc.toucher('melon')
    await waitFor(() => expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.objets).toEqual([LANTERNE, MELON]))
    await waitFor(() => expect(banc.client.isFetching() + banc.client.isMutating()).toBe(0))
    expect(banc.client.getQueryData<Voyageur>(cles.voyageur)).toEqual({ ...ETAT, objets: [LANTERNE, MELON] })
    expect(banc.requetes).toEqual([...avant, RAMASSER_LE_MELON])
    await waitFor(() => expect(banc.dits().pop()).toEqual(['lanterne', 'melon']))
    // Rejouable côté serveur : la même ligne rendue une seconde fois ne fait pas deux places.
    banc.toucher('melon')
    await waitFor(() => expect(banc.requetes.filter((r) => r === RAMASSER_LE_MELON)).toHaveLength(2))
    await waitFor(() => expect(banc.client.isMutating()).toBe(0))
    expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.objets).toEqual([LANTERNE, MELON])
  })

  // Une lecture de l'état en vol au moment du ramassage (une écriture d'ailleurs a périmé le préfixe)
  // porte l'état d'avant : atterrie après, elle effacerait la ligne. Mutation : `cancelQueries` retiré
  // de `ramasser.onSuccess`.
  it('une lecture de l’état partie avant le ramassage et revenue après ne défait pas la ligne ramassée', async () => {
    calme()
    let lectures = 0
    let relire: (r: Response) => void = () => undefined
    const banc = await monter({ [LIRE]: () => (++lectures === 1 ? json(ETAT) : new Promise<Response>((fin) => (relire = fin))), [RAMASSER_LE_MELON]: () => json(MELON) })
    void banc.client.refetchQueries({ queryKey: cles.voyageur, exact: true })
    await waitFor(() => expect(lectures).toBe(2))
    banc.toucher('melon')
    await screen.findByText('Objet trouvé 2 sur 10')
    await act(async () => relire(json(ETAT)))
    await waitFor(() => expect(banc.client.isFetching() + banc.client.isMutating()).toBe(0))
    expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.objets).toEqual([LANTERNE, MELON])
    expect(banc.dits().pop()).toEqual(['lanterne', 'melon'])
  })

  // Le compte se dit sur le catalogue du monde de l'objet et sur ce que le cache tient, jamais sur dix.
  // Mutations : « sur 10 » écrit ; le compte pris sur la réponse (1) ou sur tout l'état sans le
  // catalogue ; la phrase du monde remplacée par la clé.
  it('la région d’état dit « Objet trouvé n sur N » sur le catalogue du monde, et la phrase de l’objet', async () => {
    calme()
    essai.objets = 3
    const banc = await monter({ [LIRE]: () => json({ ...ETAT, objets: [LANTERNE, { cle: 'inconnu', annee: 1905, ramasse_le: LANTERNE.ramasse_le }] }), [RAMASSER_LE_MELON]: () => json(MELON) })
    banc.toucher('melon')
    expect(await screen.findByRole('status')).toHaveTextContent('Objet trouvé 2 sur 3Un chapeau melon, oublié en gare de 1901 : il attend dans la sacoche.')
    // La ligne se range à son année, comme le serveur la rendrait à la relecture. Mutation : sans le tri.
    expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.objets.map((o) => o.cle)).toEqual(['lanterne', 'melon', 'inconnu'])
  })

  // Mutation : le verrou retiré (`objetsEnMain`), ou relâché avant la réponse.
  it('deux touchers du même objet avant la réponse n’écrivent qu’une fois', async () => {
    calme()
    let repondre: (r: Response) => void = () => undefined
    const banc = await monter({ [RAMASSER_LE_MELON]: () => new Promise<Response>((fin) => (repondre = fin)) })
    banc.toucher('melon')
    banc.toucher('melon')
    await waitFor(() => expect(banc.requetes).toContain(RAMASSER_LE_MELON))
    await act(async () => repondre(json(MELON)))
    await screen.findByText('Objet trouvé 2 sur 10')
    expect(banc.requetes.filter((r) => r === RAMASSER_LE_MELON)).toHaveLength(1)
  })

  // Refusé (la gare n'est pas ouverte pour le serveur) ou en panne : l'objet est rendu au moteur, qui
  // le remet sur le quai ; rien n'entre au cache, et le toucher se refait. **Refusé, la région d'état
  // dit le message du serveur, tel quel** (correction du 9 octobre 2026 : la règle d'avant le taisait) ;
  // l'API injoignable se dit par le message que `api/client.ts` lui donne. Mutations : rien n'est rendu au moteur sur l'échec ; le verrou
  // gardé après l'échec ; « Objet trouvé » dit quand même ; l'objet posé au cache avant la réponse ;
  // le refus tu (`setRefusDuRamassage` retiré) ; un repli générique à la place de `erreur.message`.
  it.each([
    ['refusé', () => json(REFUS, 404), REFUS.message],
    ['en panne', () => Promise.reject(new TypeError('réseau')), 'L’API est injoignable. Vérifie ta connexion, puis réessaie.'],
  ])('%s, l’objet revient sur le quai : rendu au moteur, rien au cache, il se retouche, et le refus se dit tel quel', async (_cas, reponse, dit) => {
    calme()
    const banc = await monter({ [RAMASSER_LE_MELON]: reponse })
    banc.toucher('melon')
    await waitFor(() => expect(banc.moteur.rendreObjet).toHaveBeenCalledWith('melon'))
    expect(banc.moteur.rendreObjet).toHaveBeenCalledTimes(1)
    expect(banc.client.getQueryData<Voyageur>(cles.voyageur)).toEqual(ETAT)
    expect(banc.dits().pop()).toEqual(['lanterne'])
    expect(etat()?.textContent).toBe(dit)
    banc.toucher('melon')
    await waitFor(() => expect(banc.requetes.filter((r) => r === RAMASSER_LE_MELON)).toHaveLength(2))
    await waitFor(() => expect(banc.moteur.rendreObjet).toHaveBeenCalledTimes(2))
  })

  // Le refus ne retombe pas seul (il n'a pas de minuterie : le temps de lecture d'un message passé, il
  // est toujours là) et s'efface au geste suivant : un doigt posé sur la carte. Mutations : le refus
  // rangé dans `message` (il retombe avec lui) ; `onPointerDownCapture` retiré de l'écran.
  it('le refus tient l’écran jusqu’au geste suivant : le temps ne l’efface pas, un doigt posé sur la carte si', async () => {
    calme()
    const banc = await monter({ [RAMASSER_LE_MELON]: () => json(REFUS, 404) })
    banc.doubler()
    banc.toucher('melon')
    await banc.passer(0)
    expect(etat()).toHaveTextContent(REFUS.message)
    await banc.passer(60_000)
    expect(etat()).toHaveTextContent(REFUS.message)
    fireEvent.pointerDown(document.querySelector(`.${stylesDeLaCarte.ecran}`)!.querySelector('h1')!)
    expect(etat()).not.toBeInTheDocument()
  })

  // Le geste suivant peut être le même objet retouché : le refus s'efface au toucher, avant la
  // réponse, et un ramassage réussi ne le laisse pas derrière lui. Mutation : `oublierLeRefus()`
  // retiré de l'entrée de `objetTouche`.
  it('le refus ne reste pas après un ramassage réussi : il s’efface dès l’objet retouché, puis « Objet trouvé » se dit seul', async () => {
    calme()
    let repondre!: (r: Response) => void
    let essais = 0
    const banc = await monter({ [RAMASSER_LE_MELON]: () => (essais++ === 0 ? json(REFUS, 404) : new Promise<Response>((fin) => (repondre = fin))) })
    banc.toucher('melon')
    await waitFor(() => expect(etat()).toHaveTextContent(REFUS.message))
    banc.toucher('melon')
    expect(etat()).not.toBeInTheDocument()
    await waitFor(() => expect(banc.requetes.filter((r) => r === RAMASSER_LE_MELON)).toHaveLength(2))
    await act(async () => repondre(json(MELON)))
    await waitFor(() => expect(etat()).toHaveTextContent(/^Objet trouvé 2 sur 10/))
    expect(screen.queryByText(REFUS.message)).toBeNull()
  })

  // Deux objets en main : le refus de l'un est à l'écran quand l'autre est accepté. Le ramassage
  // réussi l'emporte, le refus ne le cache pas. Mutation : `oublierLeRefus()` retiré du succès.
  it('un objet refusé pendant qu’un autre se ramasse : accepté, celui-ci se dit et le refus s’efface', async () => {
    calme()
    let repondre!: (r: Response) => void
    const banc = await monter({ [RAMASSER_LE_MELON]: () => json(REFUS, 404), [RAMASSER_LE_PARAPLUIE]: () => new Promise<Response>((fin) => (repondre = fin)) })
    banc.toucher('parapluie')
    banc.toucher('melon')
    await waitFor(() => expect(etat()).toHaveTextContent(REFUS.message))
    await act(async () => repondre(json(PARAPLUIE)))
    await waitFor(() => expect(etat()).toHaveTextContent('Objet trouvé 2 sur 10'))
    expect(screen.queryByText(REFUS.message)).toBeNull()
  })

  // L'envol est à la page, au tempo : l'objet vole, et la région d'état ne parle qu'à son arrivée.
  // Mutations : la durée écrite sans `auTempo` ; le message dit dès la réponse ; le vol jamais retiré.
  it('l’objet vole vers la sacoche le temps de l’envol, au tempo, puis la région d’état le dit', async () => {
    const banc = await monter({ [RAMASSER_LE_MELON]: () => json(MELON) })
    banc.doubler()
    banc.toucher('melon')
    expect(enVol()).toBe(1)
    await banc.passer(auTempo(1300) - 1)
    expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.objets).toEqual([LANTERNE, MELON])
    expect(enVol()).toBe(1)
    expect(etat()).not.toBeInTheDocument()
    await banc.passer(1)
    expect(etat()).toHaveTextContent('Objet trouvé 2 sur 10')
    expect(enVol()).toBe(0)
  })

  // Où l'objet vole : du point touché au milieu de la pastille de la sacoche, dans le repère de
  // l'écran de la carte (une règle de position, pas un tracé). Sans pastille mesurable, le coin bas
  // droit de la maquette. Mutations : `- e.left` ou `- e.top` retiré ; le coin de la pastille au lieu
  // de son milieu ; le repli pris alors que la pastille se mesure ; `--x0` posé sur la cible.
  it.each([
    ['la pastille mesurée', { left: 300, top: 600, width: 48, height: 40 }, { x: '314px', y: '600px' }],
    ['sans pastille mesurable', { left: 0, top: 0, width: 0, height: 0 }, { x: '356px', y: '670px' }],
  ])('l’envol vise le milieu de la pastille de la sacoche, dans le repère de l’écran : %s', async (_cas, pastille, cible) => {
    const banc = await monter({ [RAMASSER_LE_MELON]: () => new Promise<Response>(() => undefined) })
    const ecran = { left: 10, top: 20, width: 390, height: 760 }
    const lien = screen.getByRole('link', { name: /^Sacoche du voyageur/ })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const r = this === lien ? pastille : this.classList.contains(stylesDeLaCarte.ecran!) ? ecran : { left: 0, top: 0, width: 0, height: 0 }
      return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }
    })
    banc.toucher('melon')
    const vol = document.querySelector<HTMLElement>(`.${stylesDeLaCarte.vol}`)!
    expect({ x: vol.style.getPropertyValue('--x1'), y: vol.style.getPropertyValue('--y1') }).toEqual(cible)
    expect({ x: vol.style.getPropertyValue('--x0'), y: vol.style.getPropertyValue('--y0') }).toEqual({ x: `${OU.x}px`, y: `${OU.y}px` })
  })

  // La carte quittée pendant un ramassage. Accepté : le cache apprend la ligne quand même (`onSuccess`
  // survit au départ), et la consigne la montre. Refusé : rien n'est rendu à un moteur détruit.
  // Mutations : la ligne posée dans la suite du geste, après la garde `monte` (la consigne ne la voit
  // pas) ; `if (monte.current)` retiré devant `rendreObjet`.
  it('la carte quittée avant la réponse : accepté, la sacoche montre l’objet ; refusé, rien n’est rendu au moteur détruit', async () => {
    calme()
    let repondre: (r: Response) => void = () => undefined
    const banc = await monter({
      [RAMASSER_LE_MELON]: () => new Promise<Response>((fin) => (repondre = fin)),
      'POST /api/me/voyage/rubriques/objet/vue': () => json({ rubrique: 'objet', vue_le: '2026-10-08T11:00:00.000Z' }),
    })
    const partir = async () => {
      banc.toucher('melon')
      await waitFor(() => expect(banc.client.isMutating()).toBe(1))
      fireEvent.click(screen.getByRole('link', { name: /^Sacoche du voyageur/ }))
      return screen.findByRole('region', { name: 'Objets trouvés' })
    }
    // Refusé d'abord : l'objet n'entre pas au cache, et le moteur de la carte quittée n'est plus touché.
    await partir()
    await waitFor(() => expect(banc.moteur.detruire).toHaveBeenCalled())
    await act(async () => repondre(json(REFUS, 404)))
    await waitFor(() => expect(banc.client.isMutating()).toBe(0))
    expect(banc.moteur.rendreObjet).not.toHaveBeenCalled()
    expect(banc.client.getQueryData<Voyageur>(cles.voyageur)?.objets).toEqual([LANTERNE])
    // De retour sur la carte, le même geste, accepté cette fois après le départ.
    fireEvent.click(screen.getByRole('link', { name: 'Retour à la carte' }))
    await screen.findByRole('link', { name: /^Sacoche du voyageur/ })
    const consigne = await partir()
    await act(async () => repondre(json(MELON)))
    expect(await within(consigne).findByRole('img', { name: '1901 : un chapeau melon, dans la sacoche' })).toBeInTheDocument()
    expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(1)
  })

  // Refusé en plein vol, l'objet ne vole plus : il est déjà revenu sur le quai. Mutation : le vol
  // laissé jusqu'au bout de sa minuterie.
  it('refusé en plein vol, l’objet cesse de voler', async () => {
    const banc = await monter({ [RAMASSER_LE_MELON]: () => json(REFUS, 404) })
    banc.doubler()
    banc.toucher('melon')
    expect(enVol()).toBe(1)
    await banc.passer(0)
    expect(banc.moteur.rendreObjet).toHaveBeenCalledWith('melon')
    expect(enVol()).toBe(0)
  })

  // Au calme, rien ne vole et rien n'attend : l'objet arrive d'un coup. Mutation : `useMouvementReduit`
  // ignoré dans le geste (`calme` lu faux).
  it('au calme, aucune minuterie d’envol : rien ne vole, et la région d’état parle dès la réponse', async () => {
    calme()
    const banc = await monter({ [RAMASSER_LE_MELON]: () => json(MELON) })
    banc.doubler()
    banc.toucher('melon')
    expect(enVol()).toBe(0)
    await banc.passer(0)
    expect(etat()).toHaveTextContent('Objet trouvé 2 sur 10')
    expect(enVol()).toBe(0)
  })

  // Le point 2 des relectures : la consigne de la sacoche voit l'objet ramassé sans rien relire.
  // Mutations : la ligne non posée au cache ; l'état du voyageur périmé au ramassage (un second `GET`).
  it('la consigne de la sacoche montre l’objet ramassé sur la carte, sans relire l’état du voyageur', async () => {
    calme()
    const banc = await monter({
      [RAMASSER_LE_MELON]: () => json(MELON),
      'GET /api/me/voyage/decennies/1900/etiquettes': () => json({ ...MALLE, decennie: 1900 }),
      'POST /api/me/voyage/rubriques/etiquette/vue': () => json({ rubrique: 'etiquette', vue_le: '2026-10-08T11:00:00.000Z' }),
      'POST /api/me/voyage/rubriques/objet/vue': () => json({ rubrique: 'objet', vue_le: '2026-10-08T11:00:00.000Z' }),
    })
    banc.toucher('melon')
    await screen.findByText('Objet trouvé 2 sur 10')
    // Le point rouge est allumé (brief 5) : le nom du lien dit pourquoi, à la suite.
    fireEvent.click(screen.getByRole('link', { name: 'Sacoche du voyageur : un objet trouvé en gare' }))
    const consigne = await screen.findByRole('region', { name: 'Objets trouvés' })
    expect(within(consigne).getByRole('img', { name: '1901 : un chapeau melon, dans la sacoche' })).toBeInTheDocument()
    expect(within(consigne).getByRole('img', { name: '1903 : un objet à trouver en gare' })).toBeInTheDocument()
    expect(banc.requetes.filter((r) => r === LIRE)).toHaveLength(1)
  })
})

describe('1900 seulement', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
    essai.objets = null
  })
  afterEach(() => vi.unstubAllGlobals())

  // Un membre en 1899, ticket ou non : 1900 est caché, la carte ne montre aucun monde qui cache des
  // objets, et ne lit rien de neuf. Mutations : la lecture sans `enabled` ; les objets tirés de toutes
  // les années du Voyage et non des années montrées.
  it('en 1899, les années de 1900 dans le Voyage, la carte ne lit pas l’état du voyageur et ne dit aucun objet au moteur', async () => {
    const banc = await monter({}, { enCours: 1899, lu: false })
    await waitFor(() => expect(banc.client.isFetching()).toBe(0))
    expect(banc.etats[banc.etats.length - 1]!.cases.map((c) => c.annee)).toEqual([1895, 1896, 1897, 1898, 1899])
    expect([...banc.requetes].sort()).toEqual(['GET /api/auth/me', 'GET /api/me/voyage', 'GET /api/me/voyage/tickets'])
    expect(banc.dits()).toEqual([[]])
  })
})
