import { api } from './client'
import type { paths } from './types'

/**
 * Les sagas suivies : la liste compacte (`/me/sagas`), et ses films (`/me/sagas/{tmdbId}/films`) —
 * ceux de la collection TMDB, plus ceux ajoutés à la main. Alias sur les types engendrés (`schema.ts`).
 */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

export type Saga = Json<paths['/me/sagas']['get']['responses'][200]>[number]
export type FilmsSaga = Json<paths['/me/sagas/{tmdbId}/films']['get']['responses'][200]>
export type FilmSaga = FilmsSaga['films'][number]

/** Mes sagas suivies, de la plus récemment ajoutée à la plus ancienne — sans pagination. */
export const lireSagas = (signal?: AbortSignal) => api.get<Saga[]>('/me/sagas', undefined, signal)

/** Suivre une saga. Idempotent côté API (200 si déjà suivie, 201 sinon). */
export const suivreSaga = (tmdbId: number) => api.post<Saga>('/me/sagas', { tmdb_id: tmdbId })

/** Ne plus suivre. `204` — `404` si cette saga n'était pas suivie. */
export const neplusSuivreSaga = (tmdbId: number) => api.delete<void>(`/me/sagas/${tmdbId}`)

/** Ses films, de la plus ancienne sortie à la plus récente — `404` si cette saga n'est pas suivie. */
export const lireFilmsSaga = (tmdbId: number, signal?: AbortSignal) =>
  api.get<FilmsSaga>(`/me/sagas/${tmdbId}/films`, undefined, signal)

/**
 * Ajouter à la main un film que la collection TMDB ne porte pas (`filmId` est celui du **film**,
 * `tmdbId` celui de la collection). Idempotent, `204` — `404` si cette saga n'est pas suivie.
 */
export const ajouterFilmSaga = (tmdbId: number, filmId: number) =>
  api.put<void>(`/me/sagas/${tmdbId}/films/${filmId}`)

/** L'inverse : ne touche jamais aux films de la collection, seulement à ceux ajoutés. `204` dans tous les cas. */
export const retirerFilmSaga = (tmdbId: number, filmId: number) =>
  api.delete<void>(`/me/sagas/${tmdbId}/films/${filmId}`)
