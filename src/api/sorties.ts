import { api } from './client'
import type { paths } from './types'

/** Les sorties en salle (l'onglet Au ciné) — alias sur les types engendrés (`schema.ts`). */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

export type Sorties = Json<paths['/reference/sorties']['get']['responses'][200]>
export type SortiesEnCours = Sorties['en_cours']
export type SortieEnCoursFilm = SortiesEnCours['films'][number]
export type SortieProchaineFilm = Sorties['prochaine']['films'][number]

/**
 * `en_cours` (mes cinémas, Allociné, calculé en tâche de fond) et `prochaine` (TMDB, la semaine
 * qui vient) — un seul appel pour les deux (reprise de `JournalApi.sorties()`, brief du
 * 14 puis 15 septembre 2026).
 */
export const lireSorties = (signal?: AbortSignal) => api.get<Sorties>('/reference/sorties', undefined, signal)
