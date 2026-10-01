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
/** Mes appels au chroniqueur, mois par mois (du plus ancien au plus récent) ; vide hors du compte IA. */
export type Depenses = Json<paths['/me/voyage/depenses']['get']['responses'][200]>
export type DepenseDuMois = Depenses['mois'][number]
export type TicketUtilise = Json<paths['/me/voyage/tickets/{annee}/utiliser']['post']['responses'][200]>

/** Les quatre formes du `200` et celle du `202` (« en préparation »), distinguées par `statut`. */
export type FicheAnnee =
  | Json<paths['/me/voyage/annees/{annee}']['get']['responses'][200]>
  | Json<paths['/me/voyage/annees/{annee}']['get']['responses'][202]>
export type FichePrete = Extract<FicheAnnee, { statut: 'prete' }>
export type FicheVerrouillee = Extract<FicheAnnee, { statut: 'verrouillee' }>
export type FicheEnAttente = Extract<FicheAnnee, { statut: 'en_attente' }>
export type FicheEnPreparation = Extract<FicheAnnee, { statut: 'en_preparation' }>

// La fiche d'une année, ses salles, son podium, sa séance, le carton d'un film (plan 2b).
type Corps<T> = T extends { requestBody?: { content: { 'application/json': infer J } } } ? J : never

export type Salle = FichePrete['salles'][number]
export type FilmDeSalle = Salle['films'][number]
export type EtatFilm = FilmDeSalle['etat']
export type Bobine = NonNullable<FilmDeSalle['programme']>['bobines'][number]
export type Podium = FichePrete['podium']
export type Marche = NonNullable<Podium[number]>
export type Piste = FichePrete['pistes'][number]
export type Maturite = NonNullable<FichePrete['maturite']>
export type TicketDeLAnnee = NonNullable<FichePrete['ticket']>
export type DemandeSalle = NonNullable<FichePrete['demande_salle']>
export type Seance = FichePrete['seances'][number]
export type FilmSeance = Seance['long']

export type CorpsPodium = Corps<paths['/me/voyage/annees/{annee}/podium/{place}']['put']>
export type CorpsRemplacement = Corps<paths['/me/voyage/seances/{id}/remplacer']['post']>
export type CorpsNouvelleSalle = Corps<paths['/me/voyage/annees/{annee}/salles']['post']>
export type ReponsePodium = Json<paths['/me/voyage/annees/{annee}/podium/{place}']['put']['responses'][200]>
/** « En voir plus » : `202` enfilée (ou déjà en cours), `200` salle épuisée sans rien enfiler. */
export type ReponseVoirPlus =
  | Json<paths['/me/voyage/salles/{salleId}/plus']['post']['responses'][200]>
  | Json<paths['/me/voyage/salles/{salleId}/plus']['post']['responses'][202]>
export type ReponseNouvelleSalle = Json<paths['/me/voyage/annees/{annee}/salles']['post']['responses'][202]>
export type ReponseSeance = Json<paths['/me/voyage/seances/{id}/prendre']['post']['responses'][200]>

/** Le carton d'un film : prêt, `{ configure: false }`, ou en préparation (`202`, au compte IA seulement). */
export type Carton =
  | Json<paths['/reference/chroniques/films/{tmdbId}']['get']['responses'][200]>
  | Json<paths['/reference/chroniques/films/{tmdbId}']['get']['responses'][202]>

/**
 * Les trois appels **synchrones** au chroniqueur (contexte d'une salle, pistes, générique) :
 * l'API ne borne pas le client Anthropic (`new Anthropic({ apiKey })`,
 * `apps/api/src/chroniqueur/anthropic.ts`), et le nginx du front coupe à 75 s
 * (`proxy_read_timeout`, `Library/nginx.nas.conf`). Le délai d'écriture de 45 s couperait un texte
 * en cours d'écriture ; au-delà de 80 s, le nginx a déjà répondu.
 */
export const DELAI_CHRONIQUEUR_MS = 80_000

export const lireVoyage = (signal?: AbortSignal) => api.get<Voyage>('/me/voyage', undefined, signal)
export const lireTickets = (signal?: AbortSignal) => api.get<Tickets>('/me/voyage/tickets', undefined, signal)
/** N'agrège que des appels déjà passés : aucune lecture ici n'enfile rien chez le chroniqueur. */
export const lireDepenses = (signal?: AbortSignal) => api.get<Depenses>('/me/voyage/depenses', undefined, signal)

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

/**
 * Une année qui n'a pas (encore) de salles à servir : verrouillée (après mon année en cours, ticket
 * gagné en main ou non, même quand son ouverture existe déjà chez le compte IA), en attente du Voyage
 * suivi, ou en préparation chez le chroniqueur. La fiche d'un film ou son billet, ouverts par une
 * adresse tapée, renvoient alors à la page de l'année, qui dit pourquoi.
 */
export const anneeSansSalles = (f: FicheAnnee | undefined): boolean =>
  !!f && 'statut' in f && (f.statut === 'verrouillee' || f.statut === 'en_attente' || f.statut === 'en_preparation')

export const poserSurLePodium = (annee: number, place: number, corps: CorpsPodium) =>
  api.put<ReponsePodium>(`/me/voyage/annees/${annee}/podium/${place}`, corps)

/** Idempotent côté API (`204` que la marche porte quelque chose ou non). */
export const viderLaMarche = (annee: number, place: number) => api.delete<void>(`/me/voyage/annees/${annee}/podium/${place}`)

export const voirPlus = (salleId: string) => api.post<ReponseVoirPlus>(`/me/voyage/salles/${salleId}/plus`)

export const lireContexte = (annee: number, salleId: string) =>
  api.post<{ contexte: string }>(`/me/voyage/annees/${annee}/salles/${salleId}/contexte`, undefined, DELAI_CHRONIQUEUR_MS)

export const ouvrirUneSalle = (annee: number, corps: CorpsNouvelleSalle) =>
  api.post<ReponseNouvelleSalle>(`/me/voyage/annees/${annee}/salles`, corps)

export const renouvelerLesPistes = (annee: number) =>
  api.post<{ pistes: Piste[] }>(`/me/voyage/annees/${annee}/pistes`, undefined, DELAI_CHRONIQUEUR_MS)

/** Un refus de salle se marque vu une fois montré (`204`). */
export const refusVu = (demandeId: string) => api.post<void>(`/me/voyage/demandes-salles/${demandeId}/vue`)

export const composerUneSeance = (annee: number) => api.post<{ statut: 'en_preparation' }>(`/me/voyage/annees/${annee}/seances`)
export const prendreLaSeance = (id: string) => api.post<ReponseSeance>(`/me/voyage/seances/${id}/prendre`)
export const ignorerLaSeance = (id: string) => api.post<ReponseSeance>(`/me/voyage/seances/${id}/ignorer`)
export const remplacerDansLaSeance = (id: string, corps: CorpsRemplacement) =>
  api.post<ReponseSeance>(`/me/voyage/seances/${id}/remplacer`, corps)

export const lireGenerique = (annee: number) =>
  api.post<{ generique: string }>(`/me/voyage/annees/${annee}/generique`, undefined, DELAI_CHRONIQUEUR_MS)

/**
 * Le carton d'un film. **Au compte IA, un carton manquant s'enfile à la lecture** (`202`) : ne
 * s'appelle que sur un geste du membre (« Le film »), jamais à l'ouverture d'une fiche.
 */
export const lireCarton = (tmdbId: number, signal?: AbortSignal) =>
  api.get<Carton>(`/reference/chroniques/films/${tmdbId}`, undefined, signal)
