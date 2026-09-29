import { vi } from 'vitest'

export const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status })

/**
 * Une table `MÉTHODE /chemin` → réponse, posée sur le `fetch` doublé. Toute autre requête est une
 * faute du test ; `requetes` garde l'ordre de ce qui est parti.
 */
export function servir(routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  const requetes: string[] = []
  vi.mocked(fetch).mockImplementation(async (entree, init = {}) => {
    const cle = `${init.method ?? 'GET'} ${String(entree)}`
    requetes.push(cle)
    const route = routes[cle]
    if (!route) throw new Error(`requête inattendue : ${cle}`)
    return route(init)
  })
  return requetes
}
