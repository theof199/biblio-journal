import { api } from './client'
import type { paths } from './types'

type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

/**
 * L'état de la liaison Cinoche. La lecture, la connexion et la déconnexion rendent toutes les
 * trois le même : aucune relecture après une écriture.
 */
export type EtatCinoche = Json<paths['/me/cinoche']['get']['responses'][200]>
/** Les identifiants Cinoche : ils ne vivent que dans ce corps de requête, jamais ailleurs. */
export type IdentifiantsCinoche = NonNullable<paths['/me/cinoche/connexion']['post']['requestBody']>['content']['application/json']

export const lireCinoche = (signal?: AbortSignal) => api.get<EtatCinoche>('/me/cinoche', undefined, signal)

export const relierCinoche = (identifiants: IdentifiantsCinoche) => api.post<EtatCinoche>('/me/cinoche/connexion', identifiants)

export const delierCinoche = () => api.delete<EtatCinoche>('/me/cinoche')
