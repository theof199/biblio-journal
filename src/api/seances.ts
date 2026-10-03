import { api } from './client'
import type { paths } from './types'

/** Les séances du jour dans mes cinémas (l'onglet Au ciné, la fiche d'un film) — alias sur les types engendrés. */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

export type SeancesDuJour = Json<paths['/me/cinema/seances']['get']['responses'][200]>
export type SeanceDuJour = SeancesDuJour['seances'][number]
export type CinemaDuJour = SeancesDuJour['cinemas'][number]
export type SeancesDuFilm = Json<paths['/reference/films/{tmdbId}/seances']['get']['responses'][200]>
export type CinemaDuFilm = SeancesDuFilm['cinemas'][number]

/**
 * Les séances pas encore commencées d'aujourd'hui, pour les nouveautés et les suivis du membre. Lues
 * dans le programme que le back tient déjà : aucun paramètre, et surtout pas la position du membre,
 * dont les distances se calculent sur le téléphone (`cinema/distance.ts`).
 */
export const lireProchainesSeances = (signal?: AbortSignal) =>
  api.get<SeancesDuJour>('/me/cinema/seances', undefined, signal)

/** Les séances d'aujourd'hui d'un film, cinéma par cinéma, quel que soit son suivi. */
export const lireSeancesDuFilm = (tmdbId: number, signal?: AbortSignal) =>
  api.get<SeancesDuFilm>(`/reference/films/${tmdbId}/seances`, undefined, signal)
