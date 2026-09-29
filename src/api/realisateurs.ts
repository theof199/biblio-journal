import { api } from './client'
import type { paths } from './types'

/**
 * Les réalisateurs suivis : la liste compacte (`/me/realisateurs`), et la page complète d'une
 * personne — fiche et filmographie mêlées, films et séries — (`/me/realisateurs/{tmdbId}/page`).
 * Alias sur les types engendrés : aucune forme n'est redéclarée à la main (`schema.ts`).
 */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

export type Realisateur = Json<paths['/me/realisateurs']['get']['responses'][200]>[number]
/** Nommé `RealisateurPage`, pas `PageRealisateur` : ce dernier nom est déjà pris par le composant `pages/PageRealisateur.tsx`. */
export type RealisateurPage = Json<paths['/me/realisateurs/{tmdbId}/page']['get']['responses'][200]>
export type FilmRealisateur = RealisateurPage['films'][number]

/** Mes réalisateurs suivis, du plus récemment ajouté au plus ancien — sans pagination (README, « Suivis »). */
export const lireRealisateurs = (signal?: AbortSignal) =>
  api.get<Realisateur[]>('/me/realisateurs', undefined, signal)

/**
 * Suivre un réalisateur. Idempotent côté API (200 si déjà suivi, 201 sinon) : le client n'a pas à
 * distinguer les deux, la ligne rendue est la même.
 */
export const suivreRealisateur = (tmdbId: number) => api.post<Realisateur>('/me/realisateurs', { tmdb_id: tmdbId })

/** Ne plus suivre. `204` — `404` si ce réalisateur n'était pas suivi. */
export const neplusSuivreRealisateur = (tmdbId: number) => api.delete<void>(`/me/realisateurs/${tmdbId}`)

/**
 * La page d'un réalisateur — fiche et filmographie complète, qu'il soit suivi ou non (`suivi` le
 * dit). Pensée pour un seul appel : aucune requête annexe n'est nécessaire pour l'écran.
 */
export const lirePageRealisateur = (tmdbId: number, signal?: AbortSignal) =>
  api.get<RealisateurPage>(`/me/realisateurs/${tmdbId}/page`, undefined, signal)
