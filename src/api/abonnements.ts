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

/** Un membre que je suis, au format `PublicUser` : son identifiant, son pseudo, et `deactivated` (la route sert aussi les comptes désactivés). */
export type Abonnement = PageDAbonnements['items'][number]['user']

/** Le plus que le serveur accepte par page (le défaut est 40). */
const PAR_PAGE = 100

/**
 * Mes abonnements **à qui l'on peut écrire ou dresser une table**, du plus récent au plus ancien, dans
 * l'ordre servi. La route est paginée : les pages se suivent par leur curseur, renvoyé **tel quel** (il
 * est opaque), jusqu'à ce que `next_cursor` soit nul. Un membre de la deuxième page se choisit comme
 * un autre. **Un compte désactivé n'est pas rendu** : la route le sert, mais le serveur refuse par
 * `409` une carte ou une table pour lui, et ce refus fermerait la carte en perdant le brouillon. La
 * règle est écrite ici, une fois, pour les deux écrans ; s'il ne reste personne, la liste est vide.
 * Ce `GET` n'écrit rien.
 */
export async function lireMesAbonnements(signal?: AbortSignal): Promise<Abonnement[]> {
  const membres: Abonnement[] = []
  let cursor: string | null = null
  do {
    const page: PageDAbonnements = await api.get<PageDAbonnements>('/users/me/following', { limit: PAR_PAGE, cursor }, signal)
    membres.push(...page.items.map((i) => i.user).filter((m) => !m.deactivated))
    cursor = page.next_cursor
  } while (cursor !== null)
  return membres
}
