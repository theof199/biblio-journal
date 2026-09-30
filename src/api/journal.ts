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

/** La taille de page maximale de l'API (`limit`, 100) : le journal entier en le moins d'appels possible. */
const PAGE_MAX = 100

/**
 * Tout le journal, page après page, dans l'ordre de l'API — de quoi calculer le bilan et les
 * graphiques du profil (jumeau de `journalComplet()`, Android). La première page qui échoue fait
 * échouer l'ensemble : un bilan sur un journal tronqué mentirait.
 */
export async function journalComplet(signal?: AbortSignal): Promise<JournalItem[]> {
  const items: JournalItem[] = []
  let cursor: string | undefined
  do {
    const page = await lireJournal({ limit: PAGE_MAX, cursor }, signal)
    items.push(...page.items)
    cursor = curseurSuivant(page)
  } while (cursor)
  return items
}

/** `next_cursor` nul, c'est la fin : le seul signal (voir `CLAUDE.md`, « Pagination »). */
export const curseurSuivant = (page: JournalPage): string | undefined => page.next_cursor ?? undefined

/**
 * Une page de mes visionnages de films sortis de `de` à `a`, années comprises (`sortie_min`,
 * `sortie_max`, plan 2c, décision D2) : l'année de sortie est celle que porte `media.year`.
 */
export const lireJournalDesAnnees = (de: number, a: number, params: { limit?: number; cursor?: string } = {}, signal?: AbortSignal) =>
  api.get<JournalPage>('/me/journal', { ...params, sortie_min: de, sortie_max: a }, signal)

/**
 * Tous mes visionnages de films sortis de `de` à `a`, page après page, dans l'ordre de l'API : la
 * boîte à billets, la page d'une décennie. Comme `journalComplet`, une page qui échoue fait
 * échouer l'ensemble : une boîte tronquée numéroterait faux.
 */
export async function journalDesAnnees(de: number, a: number, signal?: AbortSignal): Promise<JournalItem[]> {
  const items: JournalItem[] = []
  let cursor: string | undefined
  do {
    const page = await lireJournalDesAnnees(de, a, { limit: PAGE_MAX, cursor }, signal)
    items.push(...page.items)
    cursor = curseurSuivant(page)
  } while (cursor)
  return items
}

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
 * L'entrée complète (carnet compris) d'un film déjà au journal, retrouvée par l'identifiant
 * d'entrée que porte sa ligne de filmographie ou de saga (`vu.entry_id`) — pour la fiche d'un film
 * ouverte depuis un réalisateur ou une saga suivis, qui ne connaît que cet identifiant et pas le
 * reste de l'entrée (reprise de `SuivisUi.entrees`, Android, indexé sur `entry.id`). Jamais par
 * `media.external_id` : un identifiant TMDB n'est unique qu'avec sa source, et `vu` désigne un
 * visionnage précis, pas n'importe quelle entrée du même film. Cherche dans les pages déjà chargées
 * du journal **de l'utilisateur de la session** : jamais le journal d'un autre membre — il
 * n'existe pas de `GET /me/journal/{id}`. `undefined` si l'entrée n'est pas dans ces pages.
 */
export function itemAuJournal(pages: JournalPage[], entryId: string): JournalItem | undefined {
  for (const page of pages) {
    const item = page.items.find((i) => i.entry.id === entryId)
    if (item) return item
  }
  return undefined
}
