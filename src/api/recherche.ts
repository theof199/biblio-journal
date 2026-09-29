import { api } from './client'
import type { components, paths } from './types'

/** La recherche de films — alias sur les types engendrés (`schema.ts`). */
export type SearchResult = components['schemas']['SearchResult']
export type MovieSearchResult = Extract<SearchResult, { type: 'movie' }>

type SearchQuery = NonNullable<paths['/search']['get']['parameters']['query']>
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never
export type SearchPage = Json<paths['/search']['get']['responses'][200]>

/** `type=movie` : le journal ne connaît que des films. */
export const chercherFilms = (q: string, signal?: AbortSignal) =>
  api.get<SearchPage>('/search', { type: 'movie', q } satisfies SearchQuery, signal)
