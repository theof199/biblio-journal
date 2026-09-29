import { api } from './client'
import type { paths } from './types'

/**
 * Les routes du Voyage que lit et écrit la carte. Alias sur les types engendrés : aucune forme
 * n'est redéclarée à la main (`schema.ts`).
 */
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never

export type Voyage = Json<paths['/me/voyage']['get']['responses'][200]>
export type AnneeCarte = Voyage['annees'][number]
export type Progression = NonNullable<AnneeCarte['progression']>
export type Recompense = NonNullable<AnneeCarte['recompense']>
/** La séance prise, tant que son long n'est pas encore vu — nulle sinon (`GET /me/voyage`, pour la carte « Ce soir » de l'accueil). */
export type SeancePrise = NonNullable<Voyage['seance_prise']>
export type Tickets = Json<paths['/me/voyage/tickets']['get']['responses'][200]>
export type Ticket = Tickets['tickets'][number]
/** « Rattraper le Voyage suivi » : ouvre toutes les années jusqu'à celle de la source, jamais au-delà. Réversible. */
export type Reglages = Json<paths['/me/voyage/reglages']['patch']['responses'][200]>
export type TicketUtilise = Json<paths['/me/voyage/tickets/{annee}/utiliser']['post']['responses'][200]>

/** Les quatre formes du `200` et celle du `202` (« en préparation »), distinguées par `statut`. */
export type FicheAnnee =
  | Json<paths['/me/voyage/annees/{annee}']['get']['responses'][200]>
  | Json<paths['/me/voyage/annees/{annee}']['get']['responses'][202]>
export type FichePrete = Extract<FicheAnnee, { statut: 'prete' }>

export const lireVoyage = (signal?: AbortSignal) => api.get<Voyage>('/me/voyage', undefined, signal)
export const lireTickets = (signal?: AbortSignal) => api.get<Tickets>('/me/voyage/tickets', undefined, signal)

/**
 * `202` n'est pas une erreur (`client.ts` rend son corps) : l'appelant distingue par `statut`.
 * **Ne jamais appeler sur une année non visitée d'un membre dans l'IA** : la première visite
 * enfile l'ouverture chez le chroniqueur (`routes/voyage.ts`, `GET /me/voyage/annees/:annee`).
 */
export const lireAnnee = (annee: number, signal?: AbortSignal) =>
  api.get<FicheAnnee>(`/me/voyage/annees/${annee}`, undefined, signal)

export const utiliserTicket = (annee: number) => api.post<TicketUtilise>(`/me/voyage/tickets/${annee}/utiliser`)

export const regler = (rattrapeLaSource: boolean) =>
  api.patch<Reglages>('/me/voyage/reglages', { rattrape_la_source: rattrapeLaSource })

/** `{ configure: false }` n'a pas de `statut` : la seule façon sûre de reconnaître une fiche prête. */
export const estPrete = (f: FicheAnnee | undefined): f is FichePrete => !!f && 'statut' in f && f.statut === 'prete'
