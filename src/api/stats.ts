import { api } from './client'
import type { paths } from './types'

/** Le tableau de bord — alias sur les types engendrés (`schema.ts`). Seul `GET /stats` sert ici, pour le compte du fronton. */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never
export type Stats = Json<paths['/stats']['get']['responses'][200]>

export const lireStats = (signal?: AbortSignal) => api.get<Stats>('/stats', undefined, signal)
