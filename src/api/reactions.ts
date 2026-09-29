import { api } from './client'
import type { paths } from './types'

/** Le catalogue des réactions du carnet — alias sur les types engendrés (`schema.ts`). */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never
export type ReactionsCatalogue = Json<paths['/reference/reactions']['get']['responses'][200]>
export type Reaction = ReactionsCatalogue['reactions'][number]

/** Douze au plus, sans doublon — même limite que l'appli Android et que l'API (`MAX_REACTIONS`). */
export const MAX_REACTIONS = 12

export const lireReactions = (signal?: AbortSignal) =>
  api.get<ReactionsCatalogue>('/reference/reactions', undefined, signal)

/**
 * Coche ou décoche une réaction, sans dépasser la limite — fonction pure, testée par sa mutation.
 * Le tableau garde l'ordre du catalogue plutôt que l'ordre de saisie.
 */
export function basculerReaction(cochees: string[], cle: string, ordre: string[], max = MAX_REACTIONS): string[] {
  if (cochees.includes(cle)) return cochees.filter((c) => c !== cle)
  if (cochees.length >= max) return cochees
  return ordre.filter((c) => cochees.includes(c) || c === cle)
}
