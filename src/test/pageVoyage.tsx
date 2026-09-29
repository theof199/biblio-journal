import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { exemple } from './contrat'
import { json, servir } from './serveur'

export const SESSION = exemple<{ user: { id: string; pseudo: string } }>('/auth/me', 'get', 200)

type Routes = Record<string, (init: RequestInit) => Response | Promise<Response>>
type Entree = string | { pathname: string; search?: string; state?: unknown }

/** Une page du Voyage dans l'app entière, sous la coque ; `avant` garnit le cache avant le montage. */
export function monterVoyage(entree: Entree, routes: Routes, avant?: (client: QueryClient) => void) {
  const client = createQueryClient()
  avant?.(client)
  const requetes = servir({ 'GET /api/auth/me': () => json(SESSION), ...routes })
  const vue = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entree]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...vue, client, requetes }
}
