import { api } from './client'
import type { paths } from './types'

type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

/** Le bilan d'un import : importés, déjà présents, non reconnus (avec leurs candidats), erreurs. */
export type RapportImport = Json<paths['/me/journal/import/letterboxd']['post']['responses'][200]>
export type LigneNonReconnue = RapportImport['non_reconnus'][number]
export type CandidatImport = LigneNonReconnue['candidats'][number]

/**
 * Cinq minutes, comme Android : la réponse n'arrive qu'une fois le fichier entièrement traité
 * (environ deux minutes pour 500 lignes, le contrat demande « au moins cinq minutes »).
 */
export const DELAI_IMPORT = 5 * 60_000

/** `csv` : le contenu de `diary.csv`, tel quel, envoyé en JSON (jamais en `text/csv`). */
export const importerLetterboxd = (csv: string) =>
  api.post<RapportImport>('/me/journal/import/letterboxd', { csv }, DELAI_IMPORT)
