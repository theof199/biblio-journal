import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { cles } from '../api/cles'
import { createQueryClient } from '../api/queryClient'
import type { Depenses, TicketUtilise, Tickets, Voyage } from '../api/voyage'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import { annee, voyage1890 } from '../test/voyage'

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

/** L'adresse affichée, telle que la barre du navigateur la montrerait. */
let adresse!: Location
function Adresse() {
  adresse = useLocation()
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

function monter(chemin = '/voyage/sacoche') {
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[chemin]}>
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

  // Mutation : `timeZone` retiré de `moisDeParis` (sous `TZ=UTC`, encore août).
  it('le mois courant des dépenses est celui de Paris : le 31 août à 23 h 30 UTC, c’est septembre', async () => {
    vi.stubEnv('TZ', 'UTC')
    vi.setSystemTime(new Date('2026-08-31T23:30:00.000Z'))
    routes()
    monter()

    await deplier()
    const depenses = await region('Dépenses')
    expect(await within(depenses).findByText('Ce mois-ci : 5 appels, environ 101,2 centimes de dollar')).toBeInTheDocument()
    expect(within(depenses).getByText('Août 2026 : 12 appels, environ 254,3 centimes de dollar')).toBeInTheDocument()
    expect(within(depenses).getByText(/estimation/i)).toBeInTheDocument()
  })

  // Mutations : une entrée sur deux (`credits.slice(0, 1)`) ; le glob borné aux images communes.
  it('les Coulisses montrent chaque entrée des CREDITS.md, son œuvre et sa source', async () => {
    const fichiers = import.meta.glob('../**/assets/CREDITS.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
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

  // Mutation : la garde `lignes === null` retirée (la ligne reste, à « … »).
  it('la ligne Dépenses se masque quand la liste est vide (un membre hors du compte IA)', async () => {
    routes({ [DEPENSES]: () => json({ mois: [] }) })
    const client = monter()

    await deplier()
    await region('Crédits des images')
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
})
