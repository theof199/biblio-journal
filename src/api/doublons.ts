import { api } from './client'
import type { paths } from './types'

type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

/**
 * Les doublons du journal (correctif du 29 septembre 2026) : des relances de l'import Letterboxd
 * ont pu écrire deux fois la même ligne. L'aperçu ne retire rien ; le retrait rend ce qu'il a
 * retiré, et un second appel ne retire rien.
 */
export type Doublons = Json<paths['/me/journal/doublons']['get']['responses'][200]>
/** Ce qui ressemble à un doublon sans l'être sûrement (correctif du 30 septembre 2026) : montré, jamais retiré d'office. */
export type CasLimite = Doublons['cas_limites'][number]

export const apercuDoublons = () => api.get<Doublons>('/me/journal/doublons')

export const retirerDoublons = () => api.delete<Doublons>('/me/journal/doublons')
