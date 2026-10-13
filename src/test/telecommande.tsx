import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import type { CarteDeSerie, Telecommande } from '../api/feuilleton'
import { createQueryClient } from '../api/queryClient'
import { exemple } from './contrat'
import { json, servir } from './serveur'

/**
 * Le banc des tests de la télécommande du Feuilleton (l'ajout, la fiche, les finitions) : l'app montée
 * sur une adresse, le `fetch` doublé, ce que chaque écriture a envoyé, et le retour du téléphone.
 */
export const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)
export const EXEMPLE = exemple<Telecommande>('/me/feuilleton/telecommande', 'get', 200)
/** Mercredi 14 octobre 2026, 21 h à Paris. */
export const SOIR = new Date('2026-10-14T19:00:00Z')
/** Dark : S2 E5 à voir, S2 E6 ensuite, regardée le 12 au soir. Severance : en pause, à jour. */
export const DARK = EXEMPLE.series[0]!
export const SEVERANCE = EXEMPLE.series[1]!
export const serie = (id: string, titre: string, le: string, autres: Partial<CarteDeSerie> = {}): CarteDeSerie => ({ ...DARK, id, titre, vignette: null, dernier_visionnage_le: le, ...autres })
export const ANDOR = serie('d0000000-0000-4000-8000-0000000000a1', 'Andor', '2026-10-10T19:00:00.000Z', {
  prochain: { ...DARK.prochain!, id: 'aaaaaaaa-0000-4000-8000-0000000000b1', saison: 1, numero: 3 },
  ensuite: { ...DARK.ensuite!, id: 'aaaaaaaa-0000-4000-8000-0000000000b2', saison: 1, numero: 4 },
})
/** Deux séries en cours (Dark, Andor), une en pause entre elles, aucune invitation. */
export const DEUX: Telecommande = { a_confirmer: [], series: [DARK, SEVERANCE, ANDOR] }

export const LIRE = 'GET /api/me/feuilleton/telecommande'
export const refus = (status: number, message: string, code = status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INTERNAL') => json({ code, message, retryable: false }, status)

let naviguer!: NavigateFunction
function Ou() {
  const { pathname, search } = useLocation()
  naviguer = useNavigate()
  return <output data-testid="adresse">{pathname + search}</output>
}
export const adresse = () => screen.getByTestId('adresse').textContent
/** Le retour du téléphone : `historique(-1)`. */
export const historique = (pas: number) => naviguer(pas)

export type Routes = Parameters<typeof servir>[0]
/** Monte l'app sur `/feuilleton/maison?telecommande=<vue>`. `corps` garde ce que chaque écriture a envoyé. */
export function monter(routes: Routes, vue = 'telecommande') {
  const corps: unknown[] = []
  const noter: Routes = Object.fromEntries(
    Object.entries(routes).map(([cle, route]) => [
      cle,
      (init: RequestInit) => {
        if (init.body) corps.push(JSON.parse(String(init.body)))
        return route(init)
      },
    ]),
  )
  const requetes = servir({ 'GET /api/auth/me': () => json(SESSION), ...noter })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/feuilleton/maison?telecommande=${vue}`]}>
        <App />
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { requetes, corps, ecritures: () => requetes.filter((requete) => !requete.startsWith('GET ')), combien: (cle: string) => requetes.filter((requete) => requete === cle).length }
}

export const ecran = () => document.querySelector<HTMLElement>('[data-piece="ecran"]')!
export const message = () => document.querySelector<HTMLElement>('[data-piece="message"]')
export const touche = (name: string | RegExp) => screen.getByRole('button', { name })
/** Une réponse retenue : la requête est partie, rien n'est revenu. */
export function retenue() {
  let rendre!: (reponse: Response) => void
  const promesse = new Promise<Response>((resolve) => (rendre = resolve))
  return { promesse, rendre }
}
