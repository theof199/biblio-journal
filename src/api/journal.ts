import { api } from './client'
import type { paths } from './types'

/**
 * Le journal des films et sa partie privée (le carnet). Alias sur les types engendrés : aucune
 * forme n'est redéclarée à la main (`schema.ts`).
 */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

export type JournalPage = Json<paths['/me/journal']['get']['responses'][200]>
export type JournalItem = JournalPage['items'][number]

export type JournalCreateBody = NonNullable<
  paths['/me/journal']['post']['requestBody']
>['content']['application/json']

export type JournalPatchBody = NonNullable<
  paths['/me/journal/{id}']['patch']['requestBody']
>['content']['application/json']

export type AddMediaBody = NonNullable<paths['/media']['post']['requestBody']>['content']['application/json']
export type AddMediaResponse = Json<paths['/media']['post']['responses'][200]>
export type MediaItem = AddMediaResponse['media']

/** Page de mon journal, la plus récente d'abord. */
export const lireJournal = (params: { limit?: number; cursor?: string } = {}, signal?: AbortSignal) =>
  api.get<JournalPage>('/me/journal', params, signal)

/** La réaction qui marque une entrée comme vue au cinéma — reprise de `Reactions.EN_SALLE` (Android). */
export const REACTION_EN_SALLE = 'en_salle'

/**
 * « Tes séances » (l'onglet Au ciné, brief du 14 septembre 2026) : le journal filtré sur la
 * réaction `en_salle`, même pagination que `lireJournal`.
 */
export const lireSeances = (params: { limit?: number; cursor?: string } = {}, signal?: AbortSignal) =>
  api.get<JournalPage>('/me/journal', { ...params, reaction: REACTION_EN_SALLE }, signal)

/** `next_cursor` nul, c'est la fin : le seul signal (voir `CLAUDE.md`, « Pagination »). */
export const curseurSuivant = (page: JournalPage): string | undefined => page.next_cursor ?? undefined

/**
 * « J'ai vu ce film », sur un film qui n'est pas encore dans la bibliothèque : deux appels, dans
 * l'ordre — l'ajout à la bibliothèque commune, puis le visionnage. Jamais l'inverse : le second
 * appel a besoin de l'identifiant rendu par le premier.
 */
export async function creerVisionnage(
  media: AddMediaBody,
  visionnage: Omit<JournalCreateBody, 'media_id'>,
): Promise<JournalItem> {
  const { media: fiche } = await api.post<AddMediaResponse>('/media', media)
  return api.post<JournalItem>('/me/journal', { ...visionnage, media_id: fiche.id })
}

export const corrigerVisionnage = (id: string, corps: JournalPatchBody) =>
  api.patch<JournalItem>(`/me/journal/${id}`, corps)

export const supprimerVisionnage = (id: string) => api.delete<void>(`/me/journal/${id}`)

/**
 * `tmdb_id` (`media.external_id`) → ma note, sur des pages déjà chargées du journal — jumeau de
 * `dejaAuJournalPourRecherche` (`SearchRoute.kt`). Aucun appel réseau : la recherche lit
 * l'opportunité offerte par le cache déjà rempli par l'accueil, jamais vide sur un accès direct.
 */
export function dejaAuJournal(pages: JournalPage[]): Map<string, number | null> {
  const table = new Map<string, number | null>()
  for (const page of pages) {
    for (const item of page.items) {
      if (!table.has(item.media.external_id)) table.set(item.media.external_id, item.entry.rating)
    }
  }
  return table
}

/**
 * L'entrée complète (carnet compris) d'un film déjà au journal, retrouvée par son `tmdb_id` —
 * pour la fiche d'un film ouverte depuis un réalisateur ou une saga suivis, qui ne connaît que
 * `vu.entry_id` et pas le reste de l'entrée. Cherche dans les pages déjà chargées du journal **de
 * l'utilisateur de la session** : jamais un appel réseau, jamais le journal d'un autre membre — il
 * n'existe pas de `GET /me/journal/{id}`. `undefined` si l'entrée n'est pas dans les pages déjà lues
 * (journal pas encore chargé, ou entrée plus ancienne qu'une page non atteinte) : la fiche se prive
 * alors de « Corriger » et des réactions plutôt que de deviner.
 */
export function itemAuJournal(pages: JournalPage[], externalId: string): JournalItem | undefined {
  for (const page of pages) {
    const item = page.items.find((i) => i.media.external_id === externalId)
    if (item) return item
  }
  return undefined
}
