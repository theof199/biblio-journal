import { api } from './client'
import type { paths } from './types'

/** Le Plex du propriétaire, pour le carrousel « Ensuite » de l'accueil — alias sur les types engendrés. */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never
export type Plex = Json<paths['/reference/plex']['get']['responses'][200]>
export type PlexFilm = Plex['films'][number]

export const lirePlex = (signal?: AbortSignal) => api.get<Plex>('/reference/plex', undefined, signal)
