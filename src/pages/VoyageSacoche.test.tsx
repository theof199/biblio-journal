import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Depenses, TicketUtilise, Tickets, Voyage } from '../api/voyage'
import { FICHIERS_DE_CREDITS } from '../voyage/sacoche'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import { annee, voyage1890 } from '../test/voyage'

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
    await new Promise((r) => setTimeout(r, 50))

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

  // Mutation : « Aucun tampon encore » / « Aucun ticket » dits sans réponse.
  it('« … » tant que la carte et les tickets n’ont pas répondu ; « Aucun tampon encore » et « Aucun ticket » après une réponse vide', async () => {
    let carte!: (r: Response) => void
    let tickets!: (r: Response) => void
    routes({
      [VOYAGE]: () => new Promise<Response>((r) => (carte = r)),
      [TICKETS]: () => new Promise<Response>((r) => (tickets = r)),
    })
    monter()

    const passeport = await region('Passeport')
    const portefeuille = await region('Portefeuille')
    await waitFor(() => expect([typeof carte, typeof tickets]).toEqual(['function', 'function']))
    expect(within(passeport).getByText('…')).toBeInTheDocument()
    expect(within(portefeuille).getByText('…')).toBeInTheDocument()
    expect(passeport).not.toHaveTextContent(/Aucun|0/)
    expect(portefeuille).not.toHaveTextContent(/Aucun|0/)

    act(() => carte(json(VOYAGE_NEUF)))
    act(() => tickets(json({ tickets: [] })))
    expect(await within(passeport).findByText('Aucun tampon encore')).toBeInTheDocument()
    expect(await within(portefeuille).findByText('Aucun ticket')).toBeInTheDocument()
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
    monter()

    const coulisses = await region('Coulisses')
    await ticketDe(1898)
    await new Promise((r) => setTimeout(r, 50))
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
