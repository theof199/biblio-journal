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

/** `{ serie }` : la carte de la série reprise (`en_pause` faux, `repere` à `reprise`). */
export type Reprise = Json<paths['/me/feuilleton/series/{id}/reprendre']['post']['responses'][200]>

/** La réponse de la coche du suivi : elle ne porte pas la carte, la télécommande se relit. */
export type Coche = Json<paths['/episodes/{id}/watched']['put']['responses'][200]>
type Fiche = Json<paths['/media/{id}']['get']['responses'][200]>
/** La fiche d'une série : l'en-tête, `next_up` (le prochain épisode du suivi) et ses saisons, chacune avec ma progression. */
export type FicheDeSerie = Extract<Fiche, { type: 'tv' }>
export type SaisonDeFiche = NonNullable<FicheDeSerie['seasons']>[number]
type PageDEpisodes = Json<paths['/seasons/{id}/episodes']['get']['responses'][200]>
/** Un épisode d'une saison : `watched.me`, et `air_date` (`AAAA-MM-JJ`, ou `null` : date inconnue, tenu pour diffusé comme côté API). */
export type EpisodeDeSaison = PageDEpisodes['items'][number]
type PageDeRecherche = Json<paths['/search']['get']['responses'][200]>
/** Une série trouvée par la recherche ; `media_id` : son identifiant ici, si quelqu'un l'a déjà ajoutée. */
export type SerieTrouvee = Extract<PageDeRecherche['items'][number], { type: 'tv' }>
export type CorpsDAjout = Corps<paths['/media']['post']>
/** `{ created, media }` : `201` ou `200`, la série y était déjà. Les deux se traitent de même. */
export type Ajout = Json<paths['/media']['post']['responses'][201]>

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
 * « Reprendre » : la série sort de la pause **sans qu'aucun épisode soit coché**. Idempotente ; `404` quand
 * la série n'est plus sur la télécommande (finie, ou plus suivie). Sans corps.
 */
export const reprendreLaSerie = (serieId: string) => api.post<Reprise>(`/me/feuilleton/series/${serieId}/reprendre`)

const PAS_UNE_SERIE = 'Cette fiche n’est pas celle d’une série.'

/** La fiche d'une série (`GET /media/{id}`). Rien à voir avec une fiche d'année du Voyage : cette lecture est anodine. */
export const lireLaFiche = async (serieId: string, signal?: AbortSignal): Promise<FicheDeSerie> => {
  const fiche = await api.get<Fiche>(`/media/${serieId}`, undefined, signal)
  if (fiche.type !== 'tv') throw new Error(PAS_UNE_SERIE)
  return fiche
}

/** Le rafraîchissement interroge la source, une requête par saison : il peut durer bien plus qu'une écriture ordinaire. */
const DELAI_DU_RAFRAICHISSEMENT = 60_000

/**
 * Reprendre la fiche à sa source (`POST /media/{id}/refresh`, sans corps) : saisons et épisodes neufs,
 * métadonnées, jamais le suivi. La réponse (`changes`, `divergences`, `media` au format des listes) n'est
 * pas lue : la fiche se relit. `429` (la source limite), `503` (source non configurée ou en panne).
 */
export const rafraichirLaFiche = (serieId: string) => api.post<unknown>(`/media/${serieId}/refresh`, undefined, DELAI_DU_RAFRAICHISSEMENT)

/** Le plus que le serveur accepte par page (le défaut est 40). */
const EPISODES_PAR_PAGE = 100

/** Tous les épisodes d'une saison (`GET /seasons/{id}/episodes`), dans l'ordre servi : la route est paginée, les pages se suivent par leur curseur. */
export async function lireLesEpisodes(saisonId: string, signal?: AbortSignal): Promise<EpisodeDeSaison[]> {
  const episodes: EpisodeDeSaison[] = []
  let cursor: string | null = null
  do {
    const page: PageDEpisodes = await api.get<PageDEpisodes>(`/seasons/${saisonId}/episodes`, { limit: EPISODES_PAR_PAGE, cursor }, signal)
    episodes.push(...page.items)
    cursor = page.next_cursor
  } while (cursor !== null)
  return episodes
}

/** `GET /search?type=tv&q=…` : la première page suffit à choisir. */
export const chercherDesSeries = async (q: string, signal?: AbortSignal): Promise<SerieTrouvee[]> => {
  const page = await api.get<PageDeRecherche>('/search', { type: 'tv', q }, signal)
  return page.items.filter((resultat): resultat is SerieTrouvee => resultat.type === 'tv')
}

/** L'import d'une série fait une requête TMDB par saison : il peut durer bien plus qu'une écriture ordinaire. */
const DELAI_DE_L_AJOUT = 60_000

/**
 * Ajouter une série : un seul appel crée la fiche, ses saisons, ses épisodes, et rattache mon suivi.
 * **Idempotent** : ajouter une série déjà là répond `200` sans rien écraser d'un suivi commencé.
 */
export const ajouterUneSerie = (externalId: string) =>
  api.post<Ajout>('/media', { source: 'tmdb', external_id: externalId, type: 'tv' } satisfies CorpsDAjout, DELAI_DE_L_AJOUT)

type PageDeMembres = Json<paths['/users']['get']['responses'][200]>
/** Un membre, au format `PublicUser` : son identifiant, son pseudo, sa couleur d'identité. */
export type Membre = PageDeMembres['items'][number]['user']

/** Le plus que le serveur accepte par page (le défaut est 40). */
const MEMBRES_PAR_PAGE = 100

/**
 * Tous les membres (`GET /users`), dans l'ordre servi. La route est paginée : les pages se suivent par
 * leur curseur, renvoyé tel quel, jusqu'à ce que `next_cursor` soit nul. Les comptes désactivés sont
 * exclus par le serveur (on ne demande pas `include_deactivated`) et écartés ici s'il en passait un :
 * l'inviter répond `404`. L'appelant y figure : c'est à qui s'en sert de le retirer.
 */
export async function lireLesMembres(signal?: AbortSignal): Promise<Membre[]> {
  const membres: Membre[] = []
  let cursor: string | null = null
  do {
    const page: PageDeMembres = await api.get<PageDeMembres>('/users', { limit: MEMBRES_PAR_PAGE, cursor }, signal)
    membres.push(...page.items.map((item) => item.user).filter((membre) => !membre.deactivated))
    cursor = page.next_cursor
  } while (cursor !== null)
  return membres
}
