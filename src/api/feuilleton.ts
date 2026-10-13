import { api } from './client'
import type { paths } from './types'

/**
 * Les appels du socle du Feuilleton (`/me/feuilleton/…`) : la télécommande et le « vu à deux », communs
 * au Travail et à la Maison. Alias sur les types engendrés : aucune forme n'est redéclarée à la main.
 * Leurs clés sont sous `cles.feuilleton`. Les règles : `../biblio-back/docs/frontend-integration.md`, §16.
 */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never
type Corps<T> = T extends { requestBody?: { content: { 'application/json': infer J } } } ? J : never

/** `a_confirmer` et `series`, **déjà triées** par l'API : on ne les retrie pas. */
export type Telecommande = Json<paths['/me/feuilleton/telecommande']['get']['responses'][200]>
/** La carte d'une série. « En cours » : celles qui ne sont pas `en_pause` ; « En pause » : le reste. */
export type CarteDeSerie = Telecommande['series'][number]
export type EpisodeDeCarte = NonNullable<CarteDeSerie['prochain']>
/** Une invitation « vu à deux » qui attend ma réponse (sans `pour`, `statut` ni `traite_le`). */
export type InvitationAConfirmer = Telecommande['a_confirmer'][number]

export type CorpsDePortee = Corps<paths['/me/feuilleton/episodes']['put']>
/** `episode_ids` (ce que le lot vient de cocher) et `serie`, la carte à jour ; `serie.finie` : elle a quitté « En cours ». */
export type ReponseDePortee = Json<paths['/me/feuilleton/episodes']['put']['responses'][200]>

export type CorpsDInvitation = Corps<paths['/me/feuilleton/vus-a-deux']['post']>
/** Une invitation entière, telle que la rendent l'invitation et le refus. */
export type VuADeux = Json<paths['/me/feuilleton/vus-a-deux']['post']['responses'][201]>
/** `{ invitation, serie }` : la carte de la série chez l'invité, après la coche. */
export type Confirmation = Json<paths['/me/feuilleton/vus-a-deux/{id}/confirmer']['post']['responses'][200]>

/** La réponse de la coche du suivi : elle ne porte pas la carte, la télécommande se relit. */
export type Coche = Json<paths['/episodes/{id}/watched']['put']['responses'][200]>
type Fiche = Json<paths['/media/{id}']['get']['responses'][200]>
/** Une saison telle que la fiche d'une série la résume : son identifiant et son numéro. */
export type SaisonDeFiche = NonNullable<Extract<Fiche, { seasons?: unknown }>['seasons']>[number]

export const lireLaTelecommande = (signal?: AbortSignal) => api.get<Telecommande>('/me/feuilleton/telecommande', undefined, signal)

/** Cocher (ou décocher) un épisode : la route du suivi, celle de `Library`. */
export const cocherLEpisode = (episodeId: string, vu: boolean) => api.put<Coche>(`/episodes/${episodeId}/watched`, { watched: vu })

/** « Tout jusqu'ici » et « Toute la saison » : le diffusé hors saison 0 seulement, sans redater ce qui est déjà vu. */
export const cocherUnePortee = (corps: CorpsDePortee) => api.put<ReponseDePortee>('/me/feuilleton/episodes', corps)

/** Inviter un membre : l'épisode doit déjà être coché chez moi (`409` sinon ; le message dit lequel des trois refus). */
export const inviterAVoirADeux = (corps: CorpsDInvitation) => api.post<VuADeux>('/me/feuilleton/vus-a-deux', corps)
export const confirmerLeVuADeux = (id: string) => api.post<Confirmation>(`/me/feuilleton/vus-a-deux/${id}/confirmer`)
export const refuserLeVuADeux = (id: string) => api.post<VuADeux>(`/me/feuilleton/vus-a-deux/${id}/refuser`)

/**
 * Les saisons d'une série, par sa fiche (`GET /media/{id}`). La carte de la télécommande porte le numéro
 * de la saison d'un épisode, pas son identifiant, que « Toute la saison » exige : il se lit ici, au geste.
 */
export const lireLesSaisons = async (serieId: string, signal?: AbortSignal): Promise<SaisonDeFiche[]> => {
  const fiche = await api.get<Fiche>(`/media/${serieId}`, undefined, signal)
  return ('seasons' in fiche ? fiche.seasons : null) ?? []
}
