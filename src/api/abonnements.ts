import { api } from './client'
import type { paths } from './types'

/**
 * Les membres que je suis (`GET /users/me/following`, le raccourci de `/users/{id}/following` vers la
 * session ; plan des écrans des lots, brief 14). Les types par alias sur le contrat (`schema.ts`).
 * Deux écrans du Voyage y choisissent « un membre que je suis » : la carte postale à écrire et la
 * table à dresser. **Une fonction, une clé** (`cles.abonnements`, hors du préfixe `voyage` : un billet
 * composté ne change pas qui je suis).
 */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never
type PageDAbonnements = Json<paths['/users/{id}/following']['get']['responses'][200]>

/** Un membre que je suis, au format `PublicUser` : son identifiant, son pseudo, et `deactivated`, que l'appli ne filtre pas (le serveur refuse). */
export type Abonnement = PageDAbonnements['items'][number]['user']

/** Le plus que le serveur accepte par page (le défaut est 40). */
const PAR_PAGE = 100

/**
 * **Tous** mes abonnements, du plus récent au plus ancien, dans l'ordre servi. La route est paginée :
 * les pages se suivent par leur curseur, renvoyé **tel quel** (il est opaque), jusqu'à ce que
 * `next_cursor` soit nul. Un membre de la deuxième page se choisit comme un autre. Ce `GET` n'écrit
 * rien.
 */
export async function lireMesAbonnements(signal?: AbortSignal): Promise<Abonnement[]> {
  const membres: Abonnement[] = []
  let cursor: string | null = null
  do {
    const page: PageDAbonnements = await api.get<PageDAbonnements>('/users/me/following', { limit: PAR_PAGE, cursor }, signal)
    membres.push(...page.items.map((i) => i.user))
    cursor = page.next_cursor
  } while (cursor !== null)
  return membres
}
