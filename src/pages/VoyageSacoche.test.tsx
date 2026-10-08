import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Depenses, TicketUtilise, Tickets, Voyage } from '../api/voyage'
import { PAGES_1900 } from '../mondes/1900/pages'
import { MOTS_DE_LA_SACOCHE } from '../mondes/1900/pages/sacoche'
import { FICHIERS_DE_CREDITS } from '../voyage/sacoche'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import { ROUTES_DU_JEU, annee, voyage1890 } from '../test/voyage'

// La page se charge à la demande dans l'app (`paresseux`) : sans ce chargement préalable, le premier
// test qui la monte paierait sa compilation dans le délai d'un `findByRole` (le remède de
// `test/pageVoyage.tsx`, que ce fichier n'emploie pas : il monte l'app avec sa propre sonde d'adresse).
await import('./VoyageSacoche')

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
const VOYAGE = 'GET /api/me/voyage'
const TICKETS = 'GET /api/me/voyage/tickets'
const DEPENSES = 'GET /api/me/voyage/depenses'

/** Un Voyage à son début : rien de tamponné. */
const VOYAGE_NEUF = voyage1890(1895, [{ annee: 1895, statut: 'en_cours', recompense: null }], { source: null })
/** Trois années de 1890 récompensées : l'anneau de la décennie dit 3 sur 5. */
const EN_1897 = voyage1890(
  1897,
  [
    { annee: 1895, statut: 'ouverte', recompense: 'ours', visitee: true },
    { annee: 1896, statut: 'ouverte', recompense: 'lion', visitee: true },
    { annee: 1897, statut: 'en_cours', recompense: 'ours', visitee: true },
    { annee: 1898, statut: 'verrouillee', recompense: null, visitee: false },
  ],
  { source: null, ia: true },
)
/** Les années 1890 bouclées et tamponnées, deux années de 1900 : la sacoche est à 1900. */
const EN_1901: Voyage = {
  ...EN_1897,
  annee_en_cours: 1901,
  annees: [...EN_1897.annees, annee({ annee: 1900, statut: 'ouverte', recompense: 'ours' }), annee({ annee: 1901, statut: 'en_cours', recompense: null })],
  tampons: [{ decennie: 1890, boucle_le: '2026-03-14T12:00:00.000Z' }],
}
const ticket = (a: number, utiliseLe: string | null = null): Tickets['tickets'][number] => ({
  annee: a,
  motif: `${a - 1} t’a bien occupé, ${a} t’attend.`,
  emis_le: '2026-09-01T18:00:00.000Z',
  montre_le: null,
  utilise_le: utiliseLe,
})
/** 1897 utilisé, 1898 offert (l'année qui suit 1897), 1899 qui attend son tour. */
const TROIS_TICKETS: Tickets = { tickets: [ticket(1897, '2026-08-30T23:30:00.000Z'), ticket(1898), ticket(1899)] }
const DEPENSES_IA: Depenses = exemple<Depenses>('/me/voyage/depenses', 'get', 200)

const erreurApi = (message: string, status = 400) => json({ code: 'VALIDATION_ERROR', message, retryable: false }, status)

/** L'adresse affichée, telle que la barre du navigateur la montrerait ; `naviguer(-1)` est le retour du téléphone. */
let adresse!: Location
let naviguer!: ReturnType<typeof useNavigate>
function Adresse() {
  adresse = useLocation()
  naviguer = useNavigate()
  return null
}

function routes(extra: Record<string, (init: RequestInit) => Response | Promise<Response>> = {}) {
  return servir({
    'GET /api/auth/me': () => json(SESSION),
    [VOYAGE]: () => json(EN_1897),
    [TICKETS]: () => json(TROIS_TICKETS),
    [DEPENSES]: () => json(DEPENSES_IA),
    ...extra,
  })
}

/** `historique` : les entrées du routeur, la dernière affichée (la sacoche ouverte de la carte : `['/voyage', '/voyage/sacoche']`). */
function monter(historique: string[] = ['/voyage/sacoche']) {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={historique} initialIndex={historique.length - 1}>
        <Adresse />
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

const region = (nom: string) => screen.findByRole('region', { name: nom })
/** Pas de pause : plus aucune lecture en vol qui n'ait déjà été refusée, plus aucune écriture. */
const auCalme = (client: QueryClient) =>
  waitFor(() => expect(client.getQueryCache().getAll().filter((q) => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount === 0).length + client.isMutating()).toBe(0))
/** Les régions de la page, par leur nom, dans l'ordre : elles se nomment, elles ne se comptent pas. */
const regionsDe = (page: HTMLElement) => within(page).getAllByRole('region').map((r) => r.getAttribute('aria-label') ?? document.getElementById(r.getAttribute('aria-labelledby') ?? '')?.textContent?.replace(/[▸▾]$/, '') ?? '')
const deplier = async () => fireEvent.click(within(await region('Coulisses')).getByRole('button', { name: /Coulisses/ }))
/** Le texte d'un ticket du portefeuille, l'année d'abord. */
const ticketDe = async (a: number) => {
  const portefeuille = await region('Portefeuille')
  return waitFor(() => {
    const li = within(portefeuille).getAllByRole('listitem').find((l) => l.textContent?.startsWith(`Ticket pour${a}`))
    expect(li).toBeDefined()
    return li!
  })
}

describe('la sacoche du voyageur', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-29T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    // Rend `TZ` tel qu'il était : Node le relit à chaque affectation.
    vi.unstubAllEnvs()
  })

  // Mutation : la route déclarée `voyage/sacoches` (l'adresse tombe sur `voyage/:annee`, qui ramène
  // à la carte faute d'un millésime).
  it('a sa page sous l’onglet Voyage : `sacoche` n’est pas pris pour une année, et le retour vise la carte', async () => {
    const requetes = routes()
    monter()

    expect(await screen.findByRole('heading', { level: 1, name: 'La sacoche du voyageur' })).toBeInTheDocument()
    expect(adresse.pathname).toBe('/voyage/sacoche')
    expect(screen.getByRole('link', { name: 'Retour à la carte' })).toHaveAttribute('href', '/voyage')
    expect(within(screen.getByRole('navigation', { name: 'Onglets' })).getByRole('link', { name: 'Voyage' })).toHaveAttribute('aria-current', 'page')
    expect(requetes.filter((r) => r.includes('/annees'))).toEqual([])
  })

  // Mutation : une `useQuery` de `cles.annee(v.annee_en_cours)` sur `lireAnnee` dans le passeport.
  it('ne lit aucune fiche d’année, Coulisses dépliées comprises : la carte, les tickets, les dépenses', async () => {
    const requetes = routes()
    const client = monter()

    await within(await region('Passeport')).findByText('3 années sur 5')
    await ticketDe(1898)
    await deplier()
    await waitFor(() => expect(client.getQueryState(cles.depenses)?.status).toBe('success'))
    await auCalme(client)

    const duVoyage = requetes.filter((r) => r.includes('/me/voyage'))
    expect(duVoyage.filter((r) => r.includes('/annees'))).toEqual([])
    expect(new Set(duVoyage)).toEqual(new Set([VOYAGE, TICKETS, DEPENSES]))
  })

  // Mutations : le bouton sur tout ticket non utilisé (1899 en gagne un) ; sur tout ticket (1897 aussi).
  it('« Utiliser » ne s’offre que sur le ticket de l’année qui suit, jamais sur un utilisé ni sur une autre année', async () => {
    routes()
    monter()

    const portefeuille = await region('Portefeuille')
    await ticketDe(1898)
    await waitFor(() => expect(within(portefeuille).getAllByRole('button', { name: /Utiliser/ })).toHaveLength(1))
    expect(within(portefeuille).getByRole('button', { name: /Utiliser/ })).toHaveAccessibleName('Utiliser le ticket pour 1898')
    // Les tickets à utiliser d'abord, l'utilisé en dessous.
    expect(within(portefeuille).getAllByRole('listitem').map((li) => li.textContent?.match(/^Ticket pour(\d{4})/)?.[1])).toEqual([
      '1898',
      '1899',
      '1897',
    ])
  })

  // Mutations : le verrou `envoi` retiré (deux POST) ; la navigation retirée du rappel de `mutate`.
  it('deux touchers sur « Utiliser » : une seule requête, puis la carte', async () => {
    let liberer!: (r: Response) => void
    const requetes = routes({
      'POST /api/me/voyage/tickets/1898/utiliser': () => new Promise<Response>((r) => (liberer = r)),
    })
    monter()

    const bouton = await within(await region('Portefeuille')).findByRole('button', { name: 'Utiliser le ticket pour 1898' })
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    await waitFor(() => expect(typeof liberer).toBe('function'))
    act(() => liberer(json(exemple<TicketUtilise>('/me/voyage/tickets/{annee}/utiliser', 'post', 200))))

    await waitFor(() => expect(adresse.pathname).toBe('/voyage'))
    expect(requetes.filter((r) => r.startsWith('POST'))).toEqual(['POST /api/me/voyage/tickets/1898/utiliser'])
  })

  // Mutation : `timeZone` retiré de `jourDeParis` (sous `TZ=UTC`, le 14 mars et le 30 août).
  it('dit à Paris le jour d’un tampon bouclé à 23 h 30 UTC, et celui d’un ticket utilisé à la même heure : le lendemain', async () => {
    vi.stubEnv('TZ', 'UTC')
    routes({
      [VOYAGE]: () => json({ ...EN_1897, tampons: [{ decennie: 1890, boucle_le: '2026-03-14T23:30:00.000Z' }] }),
    })
    monter()

    const passeport = await region('Passeport')
    const jour = await within(passeport).findByText('15 mars 2026')
    const page = jour.closest('a')!
    expect(page).toHaveAttribute('href', '/voyage/decennies/1890')
    expect(page).toHaveTextContent('Spectateur des origines')
    expect(page).toHaveTextContent('bouclée')
    expect(within(await ticketDe(1897)).getByText('31 août 2026')).toBeInTheDocument()
  })

  // La règle a changé (la relecture des pages 1900) : avant la réponse de la carte, la page n'habille
  // plus rien du monde du départ, le passeport ne dit donc plus « … » ; le portefeuille le dit
  // toujours, la carte arrivée, tant que les tickets manquent.
  // Mutations : « Aucun tampon encore » / « Aucun ticket » dits sans réponse ; l'attente du
  // portefeuille retirée.
  it('rien avant la carte ; « … » au portefeuille tant que les tickets n’ont pas répondu ; « Aucun tampon encore » et « Aucun ticket » après une réponse vide', async () => {
    let carte!: (r: Response) => void
    let tickets!: (r: Response) => void
    routes({
      [VOYAGE]: () => new Promise<Response>((r) => (carte = r)),
      [TICKETS]: () => new Promise<Response>((r) => (tickets = r)),
    })
    monter()

    const page = await region('La sacoche du voyageur')
    await waitFor(() => expect([typeof carte, typeof tickets]).toEqual(['function', 'function']))
    expect(page).not.toHaveTextContent(/Aucun|0|…./)

    act(() => carte(json(VOYAGE_NEUF)))
    const passeport = await region('Passeport')
    const portefeuille = await region('Portefeuille')
    expect(await within(passeport).findByText('Aucun tampon encore')).toBeInTheDocument()
    expect(within(portefeuille).getByText('…')).toBeInTheDocument()
    expect(portefeuille).not.toHaveTextContent(/Aucun|0/)

    act(() => tickets(json({ tickets: [] })))
    expect(await within(portefeuille).findByText('Aucun ticket')).toBeInTheDocument()
  })

  // La sacoche ouverte par un lien direct : tant que la carte n'a pas répondu, aucun monde ne
  // l'habille (un voyageur de 1900 voyait celle de la foire, puis toute la composition basculer).
  // Les trois blocs sont déjà là, cachés et sans dessin : les tickets se lisent avec la carte, et
  // les régions sont les mêmes nœuds quand elle arrive.
  // Mutations : le monde du départ pris en attendant (`?? DEPART`) ; l'attente rendue sans les blocs
  // (un `return` anticipé : les tickets ne partent qu'après la carte, les régions naissent à son
  // arrivée) ; `key={monde?.nom}` sur un bloc (la région se remonte).
  it('ouverte par un lien direct, n’habille rien tant que la carte n’a pas répondu, puis prend le monde de mon année sans remonter ses trois régions', async () => {
    let carte!: (r: Response) => void
    // 1900 monte la malle et les objets trouvés : leurs routes sont servies (une malle vide ne paraît
    // pas, une consigne vide si), et l'on attend le calme du cache avant de regarder les régions.
    const requetes = routes({ ...ROUTES_DU_JEU, [VOYAGE]: () => new Promise<Response>((r) => (carte = r)) })
    const client = monter()

    const page = await region('La sacoche du voyageur')
    await waitFor(() => expect(typeof carte).toBe('function'))
    await waitFor(() => expect(requetes).toContain(TICKETS))
    expect(within(page).getByRole('status')).toHaveTextContent('Chargement…')
    // Ni jeton d'un monde sur la racine, ni titre, ni rubrique : le retour seul.
    expect(page.getAttribute('style') ?? '').toBe('')
    expect(screen.queryByRole('heading')).toBeNull()
    expect(within(page).getByRole('link', { name: 'Retour à la carte' })).toBeInTheDocument()
    const blocs = [...page.querySelectorAll(':scope > section')]
    expect(blocs).toHaveLength(3)
    for (const bloc of blocs) {
      expect(bloc).not.toBeVisible()
      expect(bloc).toBeEmptyDOMElement()
    }

    act(() => carte(json(EN_1901)))
    expect(await screen.findByRole('heading', { level: 1, name: MOTS_DE_LA_SACOCHE.titre })).toBeInTheDocument()
    expect(within(page).queryByRole('status')).toBeNull()
    expect(page.style.getPropertyValue('--m-tel')).toBe(PAGES_1900.jetons['--m-tel'])
    await auCalme(client)
    // Les trois régions d'avant, chacune par son nom, sont les mêmes nœuds ; ce que le jeu de 1900
    // ajoute entre elles se nomme aussi.
    const apres = [screen.getByRole('region', { name: 'Passeport' }), screen.getByRole('region', { name: 'Portefeuille' }), screen.getByRole('region', { name: MOTS_DE_LA_SACOCHE.coulisses.titre })]
    for (const [i, bloc] of apres.entries()) {
      expect(bloc).toBe(blocs[i])
      expect(bloc).toBeVisible()
      expect(bloc).not.toBeEmptyDOMElement()
    }
    expect(regionsDe(page)).toEqual(['Passeport', 'Portefeuille', 'Objets trouvés', MOTS_DE_LA_SACOCHE.coulisses.titre])
  })

  // La carte en panne, la page prend le monde du départ et chaque bloc dit ce qu'il a ; « Réessayer »
  // relit la carte, la page attend de nouveau sans monde, puis prend celui de mon année : les
  // Coulisses dépliées pendant la panne le sont toujours, dans la même région, et leurs dépenses
  // n'ont été lues qu'une fois.
  // Mutations : `<Coulisses key={monde?.nom} …>` (le pli se perd au changement de monde) ; les blocs
  // démontés pendant l'attente (`{monde ? <Coulisses … /> : null}`) ; l'attente qui garde le monde du
  // départ pendant la relecture.
  it('le pli des Coulisses survit à l’attente et au changement de monde : dépliées carte en panne, elles le restent quand elle répond en 1901', async () => {
    let carte!: (r: Response) => void
    let lectures = 0
    const requetes = routes({
      ...ROUTES_DU_JEU,
      [VOYAGE]: () => {
        lectures += 1
        return lectures === 1 ? erreurApi('La carte est en panne.', 500) : new Promise<Response>((r) => (carte = r))
      },
    })
    const client = monter()

    const page = await region('La sacoche du voyageur')
    const passeport = await region('Passeport')
    expect(await within(passeport).findByRole('alert')).toHaveTextContent('La carte est en panne.')
    await deplier()
    const coulisses = await region('Coulisses')
    expect(await within(coulisses).findByRole('region', { name: 'Dépenses' })).toBeInTheDocument()

    fireEvent.click(within(passeport).getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(typeof carte).toBe('function'))
    expect(await within(page).findByRole('status')).toHaveTextContent('Chargement…')
    expect(page.getAttribute('style') ?? '').toBe('')
    expect(coulisses).not.toBeVisible()

    act(() => carte(json(EN_1901)))
    expect(await screen.findByRole('heading', { level: 1, name: MOTS_DE_LA_SACOCHE.titre })).toBeInTheDocument()
    await auCalme(client)
    // Par son nom, jamais par son rang : 1900 monte ses blocs du jeu avant elle.
    expect(screen.getByRole('region', { name: MOTS_DE_LA_SACOCHE.coulisses.titre })).toBe(coulisses)
    expect(regionsDe(page)).toEqual(['Passeport', 'Portefeuille', 'Objets trouvés', MOTS_DE_LA_SACOCHE.coulisses.titre, 'Dépenses', 'Crédits des images'])
    expect(coulisses).toBeVisible()
    expect(within(coulisses).getByRole('button', { expanded: true })).toBeInTheDocument()
    expect(within(coulisses).queryByRole('button', { expanded: false })).toBeNull()
    expect(requetes.filter((r) => r === DEPENSES)).toHaveLength(1)
  })

  // L'API range les dépenses par mois dans le fuseau du serveur, UTC (`to_char(appele_le, 'YYYY-MM')`).
  // Mutations : `moisEnUTC` rendu au mois de Paris (`timeZone: 'Europe/Paris'`) ; au fuseau de
  // l'appareil (`getFullYear` / `getMonth`, ici Paris) : « Ce mois-ci : aucun appel », septembre relégué.
  it('le mois courant des dépenses est celui du serveur, en UTC : le 30 septembre à 22 h 30 UTC, déjà octobre à Paris, c’est encore septembre', async () => {
    vi.stubEnv('TZ', 'Europe/Paris')
    vi.setSystemTime(new Date('2026-09-30T22:30:00.000Z'))
    routes()
    monter()

    await deplier()
    const depenses = await region('Dépenses')
    expect(await within(depenses).findByText('Ce mois-ci : 5 appels, environ 101,2 centimes de dollar')).toBeInTheDocument()
    expect(within(depenses).getByText('Août 2026 : 12 appels, environ 254,3 centimes de dollar')).toBeInTheDocument()
    expect(within(depenses).queryByText(/Septembre/)).not.toBeInTheDocument()
    expect(within(depenses).getByText(/estimation/i)).toBeInTheDocument()
  })

  // Mutations : une entrée sur deux (`credits.slice(0, 1)`) ; le glob de `sacoche.ts` borné aux
  // images communes (`../carte/**`) ou aux mondes (`../mondes/**`) : le second ne perd aujourd'hui
  // aucune entrée (le `CREDITS.md` de `carte/assets/` n'en a pas), seule la liste des fichiers lus le voit.
  it('les Coulisses lisent tous les CREDITS.md de src/ et montrent chaque entrée, son œuvre et sa source', async () => {
    const fichiers = import.meta.glob('../**/assets/CREDITS.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    // `src/pages/` et `src/voyage/` sont à la même profondeur : les deux globs écrivent les mêmes chemins.
    expect(FICHIERS_DE_CREDITS).toEqual(Object.keys(fichiers).sort())
    expect(FICHIERS_DE_CREDITS).toContain('../carte/assets/CREDITS.md')
    const entrees = Object.values(fichiers).flatMap((texte) =>
      texte
        .split(/^## /m)
        .slice(1)
        .map((e) => ({
          oeuvre: /^- Œuvre : (.+)$/m.exec(e)![1]!.replace(/\*/g, '').trim(),
          source: /^- Source : (\S+)/m.exec(e)![1]!,
        })),
    )
    // Un plancher : un glob qui ne trouverait plus rien rendrait la garde muette.
    expect(entrees.length).toBeGreaterThanOrEqual(2)
    routes()
    monter()

    await deplier()
    const credits = await region('Crédits des images')
    const liens = within(credits)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
    for (const e of entrees) {
      expect(within(credits).getByText(e.oeuvre)).toBeInTheDocument()
      expect(liens).toContain(e.source)
    }
  })

  // Mutations : `useState(true)` ; la lecture des dépenses montée avec les Coulisses repliées.
  it('les Coulisses sont repliées au premier rendu, et rien ne lit les dépenses avant le dépli', async () => {
    const requetes = routes()
    const client = monter()

    const coulisses = await region('Coulisses')
    await ticketDe(1898)
    await auCalme(client)
    expect(within(coulisses).getByRole('button', { name: /Coulisses/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Dépenses' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Crédits des images' })).not.toBeInTheDocument()
    expect(requetes).not.toContain(DEPENSES)

    await deplier()
    expect(within(coulisses).getByRole('button', { name: /Coulisses/ })).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(requetes).toContain(DEPENSES))
  })

  // Mutations : la section rendue à « … » tant que `depenses.data` manque (la ligne d'avant, qui
  // paraissait puis disparaissait) ; la garde de la liste vide retirée (« Ce mois-ci : aucun appel »).
  it('la ligne Dépenses ne paraît ni avant la réponse ni pour une liste vide (un membre hors du compte IA)', async () => {
    let repondre!: (r: Response) => void
    routes({ [DEPENSES]: () => new Promise<Response>((r) => (repondre = r)) })
    const client = monter()

    await deplier()
    await region('Crédits des images')
    await waitFor(() => expect(typeof repondre).toBe('function'))
    expect(screen.queryByRole('region', { name: 'Dépenses' })).not.toBeInTheDocument()

    act(() => repondre(json({ mois: [] })))
    await waitFor(() => expect(client.getQueryState(cles.depenses)?.status).toBe('success'))
    expect(screen.queryByRole('region', { name: 'Dépenses' })).not.toBeInTheDocument()
  })

  // Mutation : la décennie sans tampon rendue sans son anneau (ni compte, ni dessin).
  it('une page par décennie du départ à celle en cours ; la décennie en cours, non bouclée, montre son anneau', async () => {
    routes({
      [VOYAGE]: () =>
        json({
          ...EN_1897,
          annee_en_cours: 1901,
          annees: [...EN_1897.annees, annee({ annee: 1900, statut: 'ouverte', recompense: 'ours' }), annee({ annee: 1901, statut: 'en_cours', recompense: null })],
          tampons: [{ decennie: 1890, boucle_le: '2026-03-14T12:00:00.000Z' }],
        } satisfies Voyage),
      [TICKETS]: () => json({ tickets: [] }),
    })
    monter()

    const passeport = await region('Passeport')
    const compte = await within(passeport).findByText('1 année sur 10')
    const page = compte.closest('a')!
    expect(page).toHaveAttribute('href', '/voyage/decennies/1900')
    expect(page).toHaveTextContent('Années 1900')
    expect(page.querySelectorAll('circle')).toHaveLength(2)
    expect(within(passeport).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/voyage/decennies/1890', '/voyage/decennies/1900'])
    expect(within(passeport).queryByText('Aucun tampon encore')).not.toBeInTheDocument()
  })

  // Mutation : la panne des tickets remontée au passeport (il s'éteint avec elle).
  it('une panne des tickets n’éteint que le portefeuille', async () => {
    routes({ [TICKETS]: () => erreurApi('Le portefeuille est en panne.', 500) })
    monter()

    const portefeuille = await region('Portefeuille')
    expect(await within(portefeuille).findByRole('alert')).toHaveTextContent('Le portefeuille est en panne.')
    expect(await within(await region('Passeport')).findByText('3 années sur 5')).toBeInTheDocument()
  })

  // Mutation : la branche `voyage.error` du passeport retirée (il reste à « … »), ou la panne de la
  // carte prise pour celle des tickets dans le portefeuille.
  it('une panne de la carte n’éteint que le passeport : le portefeuille montre ses tickets', async () => {
    routes({ [VOYAGE]: () => erreurApi('La carte est en panne.', 500) })
    monter()

    expect(await within(await region('Passeport')).findByRole('alert')).toHaveTextContent('La carte est en panne.')
    const portefeuille = await region('Portefeuille')
    await ticketDe(1898)
    expect(within(portefeuille).queryByRole('alert')).not.toBeInTheDocument()
    // Sans la carte, le portefeuille ne sait pas quel ticket s'offre : aucun « Utiliser ».
    expect(within(portefeuille).queryByRole('button', { name: /Utiliser/ })).not.toBeInTheDocument()
  })

  // Mutation : la branche `depenses.error` retirée (la section se tait : plus rien ne dit la panne).
  it('une panne des dépenses se dit dans les Coulisses, et les crédits restent', async () => {
    routes({ [DEPENSES]: () => erreurApi('Les dépenses sont en panne.', 500) })
    monter()

    await deplier()
    expect(await within(await region('Dépenses')).findByRole('alert')).toHaveTextContent('Les dépenses sont en panne.')
    expect(within(await region('Crédits des images')).getAllByRole('link').length).toBeGreaterThan(0)
    expect(within(await region('Passeport')).queryByRole('alert')).not.toBeInTheDocument()
  })

  // Mutation : le paragraphe `role="alert"` de `utiliser.error` retiré.
  it('un « Utiliser » refusé le dit dans le portefeuille, et la sacoche reste ouverte', async () => {
    routes({
      'POST /api/me/voyage/tickets/1898/utiliser': () => json({ code: 'NOT_FOUND', message: 'Ce ticket a déjà servi.', retryable: false }, 404),
    })
    monter()

    const portefeuille = await region('Portefeuille')
    fireEvent.click(await within(portefeuille).findByRole('button', { name: 'Utiliser le ticket pour 1898' }))
    expect(await within(portefeuille).findByRole('alert')).toHaveTextContent('Ce ticket a déjà servi.')
    expect(adresse.pathname).toBe('/voyage/sacoche')
  })

  // Le cache garde la carte trente secondes (`staleTime`) : sans péremption, la carte retrouvée
  // garderait l'année d'avant et ne jouerait pas l'avancée. Mutations : `onSuccess: () => undefined`
  // dans le `useMutation` ; la péremption bornée à `cles.tickets` (la carte n'est pas relue).
  it('après l’encaissement, la carte et les tickets sont relus', async () => {
    const requetes = routes({
      'POST /api/me/voyage/tickets/1898/utiliser': () => json(exemple<TicketUtilise>('/me/voyage/tickets/{annee}/utiliser', 'post', 200)),
    })
    monter(['/voyage', '/voyage/sacoche'])

    fireEvent.click(await within(await region('Portefeuille')).findByRole('button', { name: 'Utiliser le ticket pour 1898' }))
    await waitFor(() => expect(adresse.pathname).toBe('/voyage'))
    const apres = () => requetes.slice(requetes.indexOf('POST /api/me/voyage/tickets/1898/utiliser') + 1)
    await waitFor(() => expect(apres()).toContain(VOYAGE))
    await waitFor(() => expect(apres()).toContain(TICKETS))
  })

  // Mutation : `naviguer('/voyage')` (une entrée empilée) : le retour du téléphone ramène à la sacoche,
  // ouverte de la carte comme d'un lien.
  it.each([
    ['ouverte de la carte', ['/voyage', '/voyage/sacoche']],
    ['ouverte d’un lien', ['/voyage/sacoche']],
  ])('après l’encaissement (sacoche %s), le retour du téléphone ne ramène pas à la sacoche', async (_, historique) => {
    routes({
      'POST /api/me/voyage/tickets/1898/utiliser': () => json(exemple<TicketUtilise>('/me/voyage/tickets/{annee}/utiliser', 'post', 200)),
    })
    monter(historique)

    fireEvent.click(await within(await region('Portefeuille')).findByRole('button', { name: 'Utiliser le ticket pour 1898' }))
    await waitFor(() => expect(adresse.pathname).toBe('/voyage'))
    act(() => void naviguer(-1))
    expect(adresse.pathname).not.toBe('/voyage/sacoche')
  })
})
