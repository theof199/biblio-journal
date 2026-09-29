/**
 * Ce qui se relit à intervalle tant que le chroniqueur écrit : l'ouverture d'une année (`202`), le
 * carton d'un film (`202`), une fournée (« En voir plus »), une nouvelle salle, une séance, le
 * verdict de maturité. Portée d'`etatChroniqueSuivant`, `etatFourneeSuivant` et des constantes
 * d'`AnneeViewModel.kt` et `VoyageEtats.kt` (`biblio-android`, `ui/frise/`) : mêmes intervalles,
 * mêmes plafonds.
 */
export interface Relecture {
  ms: number
  plafond: number
}

export const RELECTURES = {
  /** L'ouverture d'une année : cinq secondes, trois minutes au plus (`CHRONIQUE_ANNEE_ESSAIS_MAX`). */
  annee: { ms: 5_000, plafond: 36 },
  /** Le carton d'un film : trois secondes, dix fois (`CHRONIQUE_ESSAIS_MAX`). */
  carton: { ms: 3_000, plafond: 10 },
  /** Une fournée : l'intervalle et le plafond du carton, un appel du même ordre de grandeur. */
  fournee: { ms: 3_000, plafond: 10 },
  /** Une nouvelle salle et une séance : le rythme de l'année. */
  salle: { ms: 5_000, plafond: 36 },
  seance: { ms: 5_000, plafond: 36 },
  /** Le verdict de maturité : cinq secondes, douze fois, une minute (`VERDICT_POLL_ESSAIS_MAX`). */
  verdict: { ms: 5_000, plafond: 12 },
} as const satisfies Record<string, Relecture>

export type EtatRelecture = 'fini' | 'attente' | 'abandon'

/**
 * `lectures` compte les réponses déjà reçues, toutes encore « en attente » : la `plafond`-ième
 * tranche, et aucune requête de plus ne part. Rien n'attend plus : fini, quel que soit le compte.
 */
export function etatRelecture(enAttente: boolean, lectures: number, r: Relecture): EtatRelecture {
  if (!enAttente) return 'fini'
  return lectures >= r.plafond ? 'abandon' : 'attente'
}

/** Pour `refetchInterval` (TanStack Query) : l'intervalle tant qu'on attend, `false` sinon. */
export const intervalle = (enAttente: boolean, lectures: number, r: Relecture): number | false =>
  etatRelecture(enAttente, lectures, r) === 'attente' ? r.ms : false

/**
 * Une composition de séance qui s'arrête sans rien produire de neuf le dit (décision du
 * propriétaire du 21 septembre 2026) : muette seulement si une séance de plus est apparue.
 */
export function messageEchecComposition(etat: EtatRelecture, seancesAvant: number, seancesApres: number): string | null {
  if (seancesApres > seancesAvant) return null
  if (etat === 'abandon') return 'Le chroniqueur n’a pas répondu, reviens plus tard.'
  if (etat === 'fini') return 'Le chroniqueur n’a pas pu composer ce soir, réessaie.'
  return null
}
