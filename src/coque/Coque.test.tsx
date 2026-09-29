import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import Coque from './Coque'
import { createQueryClient } from '../api/queryClient'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
const NON_CONNECTE = { code: 'UNAUTHENTICATED', message: 'Tu dois être connecté pour faire ça.', retryable: false }

/**
 * Les onglets de l'appli Android (`Navigation.kt`, `BottomTab`), leur chemin, l'icône Tabler
 * choisie par le propriétaire, et le titre de la page qu'ils ouvrent.
 */
const ATTENDUS = [
  { libelle: 'Accueil', chemin: '/', icone: 'building-pavilion', titre: `Bonjour ${SESSION.user.pseudo}` },
  { libelle: 'Voyage', chemin: '/voyage', icone: 'route', titre: 'Voyage' },
  { libelle: 'Suivis', chemin: '/suivis', icone: 'chair-director', titre: 'Suivis' },
  { libelle: 'Au ciné', chemin: '/au-cine', icone: 'ticket', titre: 'Au ciné' },
  { libelle: 'Profil', chemin: '/profil', icone: 'armchair', titre: SESSION.user.pseudo },
] as const

/** Le chemin courant, lu par le test : une redirection se constate, elle ne se devine pas. */
function Ou() {
  return <output data-testid="chemin">{useLocation().pathname}</output>
}

function monter(chemin: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[chemin]}>
        <App />
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const barre = () => screen.getByRole('navigation', { name: 'Onglets' })
const chemin = () => screen.getByTestId('chemin').textContent

describe('la coque à onglets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(ATTENDUS)('sur $chemin, la barre montre les cinq onglets et marque $libelle seul', async (courant) => {
    servir({ 'GET /api/auth/me': () => json(SESSION) })
    monter(courant.chemin)

    expect(await screen.findByRole('heading', { level: 1, name: courant.titre })).toBeInTheDocument()
    const liens = within(barre()).getAllByRole('link')
    expect(liens.map((l) => l.textContent)).toEqual(ATTENDUS.map((o) => o.libelle))
    for (const [i, lien] of liens.entries()) {
      const attendu = ATTENDUS[i]!
      expect(lien).toHaveAttribute('href', attendu.chemin)
      expect(lien.querySelector('svg')).toHaveClass(`tabler-icon-${attendu.icone}`)
      if (attendu === courant) expect(lien).toHaveAttribute('aria-current', 'page')
      else expect(lien).not.toHaveAttribute('aria-current')
    }
  })

  it.each(ATTENDUS)('un clic sur $libelle mène à sa page', async (cible) => {
    // Depuis un autre onglet : un clic sur l'onglet déjà ouvert ne prouverait rien.
    const depart = cible.chemin === '/profil' ? '/suivis' : '/profil'
    servir({ 'GET /api/auth/me': () => json(SESSION) })
    monter(depart)
    await within(await screen.findByRole('navigation', { name: 'Onglets' })).findAllByRole('link')

    fireEvent.click(within(barre()).getByRole('link', { name: cible.libelle }))

    expect(await screen.findByRole('heading', { level: 1, name: cible.titre })).toBeInTheDocument()
    expect(chemin()).toBe(cible.chemin)
    expect(within(barre()).getByRole('link', { name: cible.libelle })).toHaveAttribute('aria-current', 'page')
  })

  // Aucune sous-page n'existe encore dans `App.tsx` : la coque se monte seule, sous une route qui
  // prend tout, comme le fera `voyage/:annee`.
  it.each(ATTENDUS.filter((o) => o.chemin !== '/'))('sur une sous-page de $chemin, $libelle reste seul marqué', (parent) => {
    render(
      <MemoryRouter initialEntries={[`${parent.chemin}/sous-page`]}>
        <Routes>
          <Route element={<Coque />}>
            <Route path="*" element={<h1>Sous-page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const marques = within(barre())
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
      .map((lien) => lien.textContent)
    expect(marques).toEqual([parent.libelle])
  })

  it.each(['/nulle-part', '/voyage/1898', '/profil/reglages'])('une route inconnue (%s) ramène à l’accueil', async (inconnue) => {
    servir({ 'GET /api/auth/me': () => json(SESSION) })
    monter(inconnue)

    expect(await screen.findByRole('heading', { level: 1, name: ATTENDUS[0].titre })).toBeInTheDocument()
    expect(chemin()).toBe('/')
  })

  it.each(ATTENDUS)('sans session, $chemin mène à la connexion', async ({ chemin: route }) => {
    servir({ 'GET /api/auth/me': () => json(NON_CONNECTE, 401) })
    monter(route)

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(chemin()).toBe('/connexion')
    expect(screen.queryByRole('navigation', { name: 'Onglets' })).not.toBeInTheDocument()
  })
})
