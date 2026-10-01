import { api } from './client'
import type { paths } from './types'

type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

/**
 * L'état de la liaison SensCritique. La lecture, la connexion et la déconnexion rendent toutes les
 * trois le même : aucune relecture après une écriture.
 */
export type EtatSensCritique = Json<paths['/me/senscritique']['get']['responses'][200]>
/** Les identifiants SensCritique : ils ne vivent que dans ce corps de requête, jamais ailleurs. */
export type IdentifiantsSensCritique = NonNullable<paths['/me/senscritique/connexion']['post']['requestBody']>['content']['application/json']

export const lireSensCritique = (signal?: AbortSignal) => api.get<EtatSensCritique>('/me/senscritique', undefined, signal)

export const relierSensCritique = (identifiants: IdentifiantsSensCritique) =>
  api.post<EtatSensCritique>('/me/senscritique/connexion', identifiants)

export const delierSensCritique = () => api.delete<EtatSensCritique>('/me/senscritique')

/** Les films dont la recherche chez SensCritique n'a pas rendu un seul candidat net, du plus ancien au plus récent. */
export type FilmsAApparier = Json<paths['/me/senscritique/a-apparier']['get']['responses'][200]>
export type FilmAApparier = FilmsAApparier['items'][number]
export type CandidatSensCritique = FilmAApparier['candidates'][number]
/** Ce que le choix a déclenché (`resultat`), et l'état qui en résulte. */
export type ChoixSensCritique = Json<paths['/me/senscritique/appariements/{mediaId}']['put']['responses'][200]>

export const lireAApparier = (signal?: AbortSignal) => api.get<FilmsAApparier>('/me/senscritique/a-apparier', undefined, signal)

/** `productId` nul : « Aucun de ceux-là », le film ne partira jamais. Un choix est mémorisé et ne se redemande pas. */
export const choisirFilmSensCritique = (mediaId: string, productId: number | null) =>
  api.put<ChoixSensCritique>(`/me/senscritique/appariements/${mediaId}`, { product_id: productId })
