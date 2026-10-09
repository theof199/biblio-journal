import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { exemple } from './contrat'
import { json, servir } from './serveur'

// Les pages du Voyage se chargent à la demande dans l'app (`paresseux`) : sans ce chargement
// préalable, le premier test d'un fichier paierait la compilation de tout le Voyage dans le délai
// d'un `waitFor`. Le test attend toujours la page, il ne compte plus la compilation.
await Promise.all([
  import('../pages/Carte'),
  import('../pages/VoyageAnnee'),
  import('../pages/VoyageDecennie'),
  import('../pages/VoyageBoite'),
  import('../pages/VoyageRecherche'),
  import('../pages/VoyageFilm'),
  import('../pages/VoyageBillet'),
  import('../pages/VoyageSacoche'),
  import('../pages/VoyageWagonRestaurant'),
])

export const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>
type Entree = string | { pathname: string; search?: string; state?: unknown }

/**
 * Une page du Voyage dans l'app entière, sous la coque ; `avant` garnit le cache avant le montage.
 * Plusieurs entrées posent un historique : la page montée est la dernière.
 */
export function monterVoyage(entree: Entree | Entree[], routes: Routes, avant?: (client: QueryClient) => void) {
  const client = createQueryClient()
  avant?.(client)
  const requetes = servir({ 'GET /api/auth/me': () => json(SESSION), ...routes })
  const vue = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={Array.isArray(entree) ? entree : [entree]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...vue, client, requetes }
}
