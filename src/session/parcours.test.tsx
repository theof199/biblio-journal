import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { cles } from '../api/cles'
import { ROUTES_ACCUEIL } from '../test/routesAccueil'

const ALICE = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    pseudo: 'alice',
    avatar_url: null,
    identity_color: '#E4572E',
    role: 'admin',
    deactivated: false,
  },
}
const NON_CONNECTE = { code: 'UNAUTHENTICATED', message: 'Tu dois être connecté pour faire ça.', retryable: false }
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status })

/** Une table `MÉTHODE /chemin` → réponse. Toute autre requête est une faute du test. */
function servir(routes: Record<string, (init: RequestInit) => Response>) {
  vi.mocked(fetch).mockImplementation(async (entree, init = {}) => {
    const cle = `${init.method ?? 'GET'} ${String(entree)}`
    const route = routes[cle]
    if (!route) throw new Error(`requête inattendue : ${cle}`)
    return route(init)
  })
}

function monter(chemin: string, client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[chemin]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function saisir(pseudo: string, motDePasse: string) {
  fireEvent.change(screen.getByLabelText('Pseudo'), { target: { value: pseudo } })
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: motDePasse } })
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('la garde et la connexion', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sans session, l’accueil mène à la connexion', async () => {
    servir({ 'GET /api/auth/me': () => json(NON_CONNECTE, 401) })
    monter('/')

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.queryByText(/Bonjour/)).not.toBeInTheDocument()
  })

  it('avec une session, l’accueil du journal s’affiche', async () => {
    servir({ 'GET /api/auth/me': () => json(ALICE), ...ROUTES_ACCUEIL })
    monter('/')

    expect(await screen.findByText('La vitrine attend sa première affiche.')).toBeInTheDocument()
  })

  it('une session ouverte ne revoit pas la connexion', async () => {
    servir({ 'GET /api/auth/me': () => json(ALICE), ...ROUTES_ACCUEIL })
    monter('/connexion')

    expect(await screen.findByText('La vitrine attend sa première affiche.')).toBeInTheDocument()
  })

  it('se connecter envoie pseudo et mot de passe, puis mène à l’accueil', async () => {
    const envoye: unknown[] = []
    servir({
      'GET /api/auth/me': () => json(NON_CONNECTE, 401),
      'POST /api/auth/login': (init) => {
        envoye.push(JSON.parse(String(init.body)))
        return json(ALICE)
      },
      ...ROUTES_ACCUEIL,
    })
    monter('/')
    await screen.findByRole('heading', { name: 'Connexion' })
    saisir('alice', 'secret')

    expect(await screen.findByText('La vitrine attend sa première affiche.')).toBeInTheDocument()
    expect(envoye).toEqual([{ pseudo: 'alice', password: 'secret' }])
  })

  it.each([
    [401, { code: 'UNAUTHENTICATED', message: 'Pseudo ou mot de passe incorrect.', retryable: false }],
    [429, { code: 'RATE_LIMITED', message: 'Trop de requêtes d’affilée. Patiente quelques instants.', retryable: true }],
  ])('un refus %i s’affiche tel que l’API l’a écrit', async (status, corps) => {
    servir({
      'GET /api/auth/me': () => json(NON_CONNECTE, 401),
      'POST /api/auth/login': () => json(corps, status),
    })
    monter('/')
    await screen.findByRole('heading', { name: 'Connexion' })
    saisir('alice', 'faux')

    expect(await screen.findByRole('alert')).toHaveTextContent(corps.message)
  })

  it('se déconnecter depuis le profil ferme la session côté API et ramène à la connexion', async () => {
    let ferme = false
    servir({
      'GET /api/auth/me': () => (ferme ? json(NON_CONNECTE, 401) : json(ALICE)),
      'POST /api/auth/logout': () => {
        ferme = true
        return new Response(null, { status: 204 })
      },
    })
    monter('/profil')
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(ferme).toBe(true)
  })

  /**
   * Vider tout le cache (`clear()`, ou `removeQueries()` sans filtre) après
   * avoir posé `null` retire aussi la requête de session : la garde repasse
   * par « Chargement… » et relit `/auth/me`, et une API injoignable à cet
   * instant montrerait la panne au lieu de la connexion.
   */
  it('se déconnecter vide le cache du membre sans relire la session', async () => {
    const requetes: string[] = []
    let ferme = false
    const client = createQueryClient()
    client.setQueryData(['journal'], [{ id: 'une-entree' }])
    servir({
      'GET /api/auth/me': () => {
        requetes.push('GET /api/auth/me')
        return ferme ? json(NON_CONNECTE, 401) : json(ALICE)
      },
      'POST /api/auth/logout': () => {
        requetes.push('POST /api/auth/logout')
        ferme = true
        return new Response(null, { status: 204 })
      },
    })
    monter('/profil', client)
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    await screen.findByRole('heading', { name: 'Connexion' })

    expect(requetes).toEqual(['GET /api/auth/me', 'POST /api/auth/logout'])
    expect(client.getQueryData(cles.session)).toBeNull()
    expect(client.getQueryData(['journal'])).toBeUndefined()
  })

  it('API injoignable au lancement : une panne, pas l’écran de connexion', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    monter('/')

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Connexion' })).not.toBeInTheDocument()
  })
})
