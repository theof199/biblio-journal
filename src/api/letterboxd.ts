import { api } from './client'
import type { paths } from './types'

type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

/**
 * L'import suivi (correctif du 29 septembre 2026) : le `POST` rend la tâche aussitôt, `GET
 * …/{id}` en donne l'avancement puis le rapport. La route répondait à la fin du traitement, et le
 * relais du NAS coupait à 75 s un import qui continuait côté API : un message d'erreur sur un
 * import qui réussissait.
 */
export type TacheImport = Json<paths['/me/journal/import/letterboxd']['post']['responses'][202]>
/** Le bilan d'un import : importés, déjà présents, vus sans date, non reconnus (avec leurs candidats), erreurs. */
export type RapportImport = TacheImport['rapport']
export type LigneNonReconnue = RapportImport['non_reconnus'][number]
export type CandidatImport = LigneNonReconnue['candidats'][number]
/** Le corps de l'envoi : `diary.csv`, et `watched.csv` et `ratings.csv` s'ils sont dans l'export. */
export type CorpsImport = NonNullable<paths['/me/journal/import/letterboxd']['post']['requestBody']>['content']['application/json']

/** Toutes les deux secondes, comme le conseille le contrat. */
export const INTERVALLE_SUIVI = 2_000

/** Les CSV de l'export, tels quels, envoyés en JSON (jamais en `text/csv`). */
export const lancerImport = (fichiers: CorpsImport) => api.post<TacheImport>('/me/journal/import/letterboxd', fichiers)

export const lireImport = (id: string, signal?: AbortSignal) =>
  api.get<TacheImport>(`/me/journal/import/letterboxd/${id}`, undefined, signal)

/** La clé d'une ligne du rapport : son fichier et son numéro, qui ne se répètent jamais ensemble. */
export const cleLigne = (ligne: Pick<LigneNonReconnue, 'fichier' | 'ligne'>) => `${ligne.fichier}:${ligne.ligne}`
