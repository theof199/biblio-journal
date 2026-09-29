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
/** Le bilan d'un import : importés, déjà présents, non reconnus (avec leurs candidats), erreurs. */
export type RapportImport = TacheImport['rapport']
export type LigneNonReconnue = RapportImport['non_reconnus'][number]
export type CandidatImport = LigneNonReconnue['candidats'][number]

/** Toutes les deux secondes, comme le conseille le contrat. */
export const INTERVALLE_SUIVI = 2_000

/** `csv` : le contenu de `diary.csv`, tel quel, envoyé en JSON (jamais en `text/csv`). */
export const lancerImport = (csv: string) => api.post<TacheImport>('/me/journal/import/letterboxd', { csv })

export const lireImport = (id: string, signal?: AbortSignal) =>
  api.get<TacheImport>(`/me/journal/import/letterboxd/${id}`, undefined, signal)
