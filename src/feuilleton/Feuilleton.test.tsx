import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'

// Les trois morceaux se chargent à la demande dans l'app (`paresseux`) : chargés d'avance, aucun test
// ne paie leur compilation dans le délai d'un `findByRole` (le remède de `coque/Coque.test.tsx`).
await import('./Feuilleton')
await import('../studio/Studio')
await import('../maison/Maison')
await import('./telecommande/Panneau')

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
const TELECOMMANDE = exemple<unknown>('/me/feuilleton/telecommande', 'get', 200)

/** Octobre 2026, heure d'été : mercredi 14 à 10 h de Paris, et le même jour à 21 h. */
const HEURE_DE_TRAVAIL = new Date('2026-10-14T08:00:00Z')
const SOIR = new Date('2026-10-14T19:00:00Z')

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

const chemin = () => screen.getByTestId('chemin').textContent
const espaces = () => screen.getByRole('navigation', { name: 'Espaces du Feuilleton' })
const onglet = () => within(screen.getByRole('navigation', { name: 'Onglets' })).getByRole('link', { name: 'Feuilleton' })

describe('le Feuilleton', () => {
  let requetes: string[]
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Seule l'horloge est fausse : les délais du réseau doublé restent réels.
    vi.useFakeTimers({ toFake: ['Date'] })
    requetes = servir({ 'GET /api/auth/me': () => json(SESSION), 'GET /api/me/feuilleton/telecommande': () => json(TELECOMMANDE) })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutations, dans `Feuilleton.tsx` : `ESPACES.studio.chemin` en dur à la place de l'espace de
  // l'heure (le soir ouvrirait le Travail) ; `ESPACES.maison.chemin` en dur (la journée ouvrirait la Maison).
  it.each([
    { quand: 'en semaine, en journée', instant: HEURE_DE_TRAVAIL, titre: 'Travail', arrivee: '/feuilleton/studio' },
    { quand: 'le soir', instant: SOIR, titre: 'Maison', arrivee: '/feuilleton/maison' },
  ])('$quand, `/feuilleton` ouvre $titre', async ({ instant, titre, arrivee }) => {
    vi.setSystemTime(instant)
    monter('/feuilleton')

    expect(await screen.findByRole('heading', { level: 1, name: titre })).toBeInTheDocument()
    expect(chemin()).toBe(arrivee)
    expect(screen.getByText('En construction.')).toBeInTheDocument()
  })

  // Mutation : la redirection jouée sur toute adresse du Feuilleton (`if (espace !== espaceDeLHeure(…))`) :
  // une adresse d'espace ouverte hors de son heure serait ramenée à l'autre.
  it.each([
    { adresse: '/feuilleton/maison', instant: HEURE_DE_TRAVAIL, titre: 'Maison' },
    { adresse: '/feuilleton/studio', instant: SOIR, titre: 'Travail' },
  ])('$adresse s’ouvre telle quelle, même hors de son heure', async ({ adresse, instant, titre }) => {
    vi.setSystemTime(instant)
    monter(adresse)

    expect(await screen.findByRole('heading', { level: 1, name: titre })).toBeInTheDocument()
    expect(chemin()).toBe(adresse)
  })

  // Mutations : le lien mené vers l'espace ouvert (`ESPACES[espace]`) ; le bouton retiré de la mise en page.
  it('un seul bouton, qui passe de l’autre côté, dans les deux sens', async () => {
    vi.setSystemTime(HEURE_DE_TRAVAIL)
    monter('/feuilleton')
    await screen.findByRole('heading', { level: 1, name: 'Travail' })
    expect(within(espaces()).getAllByRole('link')).toHaveLength(1)

    fireEvent.click(within(espaces()).getByRole('link', { name: /Passer à la Maison/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Maison' })).toBeInTheDocument()
    expect(chemin()).toBe('/feuilleton/maison')
    expect(onglet()).toHaveAttribute('aria-current', 'page')

    fireEvent.click(within(espaces()).getByRole('link', { name: /Passer au Travail/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Travail' })).toBeInTheDocument()
    expect(chemin()).toBe('/feuilleton/studio')
  })

  // Mutation, dans `Feuilleton.tsx` : l'espace ouvert gardé (une variable du module, ou le stockage
  // local) et préféré à l'heure à l'arrivée sur `/feuilleton`.
  it('le choix du bouton ne vaut que pour la visite : l’onglet relit l’heure, et rien n’est écrit sur l’appareil', async () => {
    const ecrit = vi.spyOn(Storage.prototype, 'setItem')
    vi.setSystemTime(HEURE_DE_TRAVAIL)
    monter('/feuilleton')
    await screen.findByRole('heading', { level: 1, name: 'Travail' })
    fireEvent.click(within(espaces()).getByRole('link', { name: /Passer à la Maison/ }))
    await screen.findByRole('heading', { level: 1, name: 'Maison' })

    fireEvent.click(onglet())

    expect(await screen.findByRole('heading', { level: 1, name: 'Travail' })).toBeInTheDocument()
    expect(chemin()).toBe('/feuilleton/studio')

    // Et l'heure qui a tourné se relit : le soir venu, le même onglet ouvre la Maison.
    vi.setSystemTime(SOIR)
    fireEvent.click(onglet())

    expect(await screen.findByRole('heading', { level: 1, name: 'Maison' })).toBeInTheDocument()
    expect(chemin()).toBe('/feuilleton/maison')
    expect(ecrit).not.toHaveBeenCalled()
    ecrit.mockRestore()
  })

  // Les pages vides ne lisent rien ; la télécommande se lit une fois, au montage du Feuilleton (le point du
  // bouton rond en dépend), et le panneau qui s'ouvre se sert de cette lecture. Une requête de plus doit
  // passer par ici. Mutations : `useInvitationEnAttente()` ôté de `Feuilleton.tsx` (rien ne part avant
  // l'ouverture du panneau) ; une clé propre au panneau dans `useLaTelecommande` (deux lectures).
  it('une seule requête au-delà de la session : la télécommande, lue au montage, panneau fermé ; l’ouvrir et changer d’espace n’en ajoutent aucune', async () => {
    vi.setSystemTime(HEURE_DE_TRAVAIL)
    monter('/feuilleton')
    await screen.findByRole('heading', { level: 1, name: 'Travail' })
    await vi.waitFor(() => expect(requetes).toEqual(['GET /api/auth/me', 'GET /api/me/feuilleton/telecommande']))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(within(espaces()).getByRole('link', { name: /Passer à la Maison/ }))
    await screen.findByRole('heading', { level: 1, name: 'Maison' })
    fireEvent.click(screen.getByRole('button', { name: 'Télécommande' }))
    const panneau = await screen.findByRole('dialog', { name: 'Télécommande' })
    expect(await within(panneau).findByText(/a vu/)).toBeInTheDocument()
    fireEvent.click(within(panneau).getByRole('button', { name: /^En cours/ }))
    await within(panneau).findByRole('heading', { level: 2, name: 'En cours' })

    expect(requetes).toEqual(['GET /api/auth/me', 'GET /api/me/feuilleton/telecommande'])
  })

  // Mutation, dans `App.tsx` : une route `feuilleton/*` qui prendrait tout.
  it('une adresse inconnue sous `/feuilleton` n’est pas un espace', async () => {
    servir({ 'GET /api/auth/me': () => json(SESSION), ...(await import('../test/routesAccueil')).ROUTES_ACCUEIL })
    vi.setSystemTime(HEURE_DE_TRAVAIL)
    monter('/feuilleton/grenier')

    await vi.waitFor(() => expect(chemin()).toBe('/'))
  })
})
