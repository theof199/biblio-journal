import { api } from './client'
import type { paths } from './types'

/**
 * La recherche qui précède un suivi (`POST /me/realisateurs`, `POST /me/sagas`), et les
 * réalisateurs crédités sur un film — alias sur les types engendrés (`schema.ts`).
 */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

export type ResultatPersonne = Json<paths['/reference/personnes']['get']['responses'][200]>['results'][number]
export type ResultatSaga = Json<paths['/reference/sagas']['get']['responses'][200]>['results'][number]
export type RealisateurDuFilm = Json<
  paths['/reference/films/{tmdbId}/realisateurs']['get']['responses'][200]
>['realisateurs'][number]
export type FicheReference = Json<paths['/reference/films/{tmdbId}']['get']['responses'][200]>
export type OuRegarder = NonNullable<FicheReference['availability']>

/** Dix réalisateurs au plus, dans l'ordre de pertinence de TMDB. */
export const chercherRealisateurs = (q: string, signal?: AbortSignal) =>
  api.get<{ results: ResultatPersonne[] }>('/reference/personnes', { q }, signal)

/** Dix sagas au plus, dans l'ordre de pertinence de TMDB. */
export const chercherSagas = (q: string, signal?: AbortSignal) =>
  api.get<{ results: ResultatSaga[] }>('/reference/sagas', { q }, signal)

/** De quoi naviguer d'une fiche film vers la page d'un de ses réalisateurs. */
export const lireRealisateursDuFilm = (tmdbId: number, signal?: AbortSignal) =>
  api.get<{ realisateurs: RealisateurDuFilm[] }>(`/reference/films/${tmdbId}/realisateurs`, undefined, signal)

/** Synopsis, durée, genres, casting et où regarder un film de TMDB, qu'il soit ou non dans ma bibliothèque. */
export const lireFicheReference = (tmdbId: number, signal?: AbortSignal) =>
  api.get<FicheReference>(`/reference/films/${tmdbId}`, undefined, signal)
