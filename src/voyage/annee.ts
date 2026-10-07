import type { JournalItem } from '../api/journal'
import type { Maturite, Progression, Recompense, TicketDeLAnnee } from '../api/voyage'
import { OURS_FILMS_MIN } from './regles'

/**
 * Les règles de la fiche d'une année (plan 2b), sans rendu. Portées de `AnneeViewModel.kt` et
 * `VoyageEtats.kt` (`biblio-android`, `ui/frise/`) ; chaque écart est dit là où il est.
 */

export type StatutAnnee = 'ouverte' | 'en_cours' | 'verrouillee'

/**
 * Le statut d'une année d'après la seule `annee_en_cours` de la carte : jumeau de la formule du
 * back (`calculerCarte`, `routes/voyage.ts`). La fiche elle-même ne distingue pas « ouverte »
 * d'« en cours » (portée de `statutVoyageDepuisAnneeEnCours`).
 */
export function statutDeLAnnee(annee: number, anneeEnCours: number): StatutAnnee {
  if (annee < anneeEnCours) return 'ouverte'
  return annee === anneeEnCours ? 'en_cours' : 'verrouillee'
}

export type CleBillet = 'films' | 'essentiels' | 'salles'

/** Un billet de la corde, en tête de fiche : sa valeur, son total s'il en a un, et ce qu'il compte. */
export interface Billet {
  cle: CleBillet | 'aucun-essentiel'
  valeur: number | null
  total: number | null
  libelle: string
}

/**
 * Les billets de progression (portée de `pastillesProgression`) : les films, toujours ; les
 * essentiels et les salles complètes, dès que `progression` est connue ; un seul billet « Aucun
 * essentiel encore » quand l'année n'en a pas, jamais « 0 essentiel sur 0 ».
 */
export function billetsDeProgression(profondeur: number, progression: Progression | null): Billet[] {
  const films: Billet = { cle: 'films', valeur: profondeur, total: null, libelle: profondeur > 1 ? 'films vus' : 'film vu' }
  if (!progression) return [films]
  if (progression.essentiels_total === 0) return [films, { cle: 'aucun-essentiel', valeur: null, total: null, libelle: 'Aucun essentiel encore' }]
  const e = progression.essentiels_vus
  const s = progression.salles_completes
  return [
    films,
    { cle: 'essentiels', valeur: e, total: progression.essentiels_total, libelle: e > 1 ? 'essentiels' : 'essentiel' },
    { cle: 'salles', valeur: s, total: progression.salles_autres, libelle: s > 1 ? 'salles complètes' : 'salle complète' },
  ]
}

/** Deux salles complètes donnent la Palme (le palier des salles, `estUnPalier`). */
export const PALME_SALLES_MIN = 2

/**
 * Une arrivée : un objectif de l'année que la fiche sait compter, et s'il est atteint. `valeur` et
 * `total` sont nuls quand il n'y a rien à compter : le ticket, et les essentiels d'une année qui n'en
 * a pas (jamais « 0 sur 0 »).
 */
export interface Arrivee {
  cle: CleBillet | 'ticket'
  arrivee: boolean
  valeur: number | null
  total: number | null
}

/**
 * Les arrivées d'une année (plan des pages 1900, décision 2) : les films vus et l'Ours, les essentiels
 * et le Lion, les salles complètes et la Palme, le ticket. Rien d'autre : ce que `prochainPas` promet,
 * dit en lignes qui restent une fois atteintes. Une ligne est arrivée là où `prochainPas` se tait :
 * par la récompense que l'API a donnée (le Lion compte des introuvables que `essentiels_vus` ignore),
 * sinon par le compte. Sans progression, seuls les films et le ticket se disent.
 */
export function arriveesDeLAnnee(profondeur: number, progression: Progression | null, recompense: Recompense | null, ticket: TicketDeLAnnee | null): Arrivee[] {
  const lion = recompense === 'lion' || recompense === 'palme'
  const liste: Arrivee[] = [{ cle: 'films', arrivee: recompense !== null || profondeur >= OURS_FILMS_MIN, valeur: profondeur, total: OURS_FILMS_MIN }]
  if (progression) {
    const { essentiels_vus: e, essentiels_total: t, salles_completes: s } = progression
    liste.push(t === 0 ? { cle: 'essentiels', arrivee: lion, valeur: null, total: null } : { cle: 'essentiels', arrivee: lion || e >= t, valeur: e, total: t })
    liste.push({ cle: 'salles', arrivee: recompense === 'palme' || s >= PALME_SALLES_MIN, valeur: s, total: PALME_SALLES_MIN })
  }
  liste.push({ cle: 'ticket', arrivee: ticket !== null, valeur: null, total: null })
  return liste
}

/**
 * Une année est bouclée quand le ticket de l'année suivante est émis (réponse du propriétaire, 7
 * octobre 2026), utilisé ou non ; une année déjà derrière soi l'est aussi, même ouverte sans ticket
 * par le rattrapage du Voyage suivi.
 */
export const estBouclee = (statut: StatutAnnee, ticket: TicketDeLAnnee | null): boolean => statut === 'ouverte' || ticket !== null

export interface Avancee {
  cle: CleBillet
  avant: number
  apres: number
}

/**
 * Ce qui a bougé entre deux lectures (portée de `deltasProgression`) : les billets qui ont gagné,
 * de combien, jamais un billet qui n'a pas bougé ni un recul. Une progression inconnue d'un côté
 * ne compte pour rien.
 */
export function avancees(
  avant: { profondeur: number; progression: Progression | null },
  apres: { profondeur: number; progression: Progression | null },
): Avancee[] {
  const liste: Avancee[] = []
  if (apres.profondeur > avant.profondeur) liste.push({ cle: 'films', avant: avant.profondeur, apres: apres.profondeur })
  const a = avant.progression
  const b = apres.progression
  if (a && b) {
    if (b.essentiels_vus > a.essentiels_vus) liste.push({ cle: 'essentiels', avant: a.essentiels_vus, apres: b.essentiels_vus })
    if (b.salles_completes > a.salles_completes) liste.push({ cle: 'salles', avant: a.salles_completes, apres: b.salles_completes })
  }
  return liste
}

/** Un palier franchi (portée d'`estPalierProgression`) : l'Ours, le Lion ou la Palme, selon le billet. */
export function estUnPalier(cle: CleBillet, valeur: number, progression: Progression | null): boolean {
  if (cle === 'films') return valeur === OURS_FILMS_MIN
  if (cle === 'essentiels') return !!progression && progression.essentiels_total > 0 && valeur === progression.essentiels_total
  return valeur === 2
}

/**
 * La ligne du bas (portée de `ligneBasAnnee`, plus le billet utilisé de la maquette 1890, écran II) :
 * le ticket qui attend prime, puis le billet déjà utilisé, puis le verdict « pas encore mûre ».
 * Un ticket vers une année déjà ouverte (le membre qui rattrape le Voyage suivi l'a dépassée) n'a
 * plus rien à ouvrir : il ne s'offre pas — jumeau du filtre `annee > effective` de `ticketAMontrer`
 * (`routes/voyage.ts`, chantier du rattrapage).
 */
export type LigneDuBas =
  | { type: 'ticket'; annee: number }
  | { type: 'billet'; annee: number; utiliseLe: string }
  | { type: 'jury'; motif: string }
  | null

export function ligneDuBas(ticket: TicketDeLAnnee | null, maturite: Maturite | null, anneeEnCours: number): LigneDuBas {
  if (ticket && ticket.utilise_le === null && ticket.annee > anneeEnCours) return { type: 'ticket', annee: ticket.annee }
  if (ticket && ticket.utilise_le !== null) return { type: 'billet', annee: ticket.annee, utiliseLe: ticket.utilise_le }
  if (maturite && !maturite.mure) return { type: 'jury', motif: maturite.motif }
  return null
}

/**
 * Le verdict a-t-il répondu depuis le début du guet (portée de `verdictAChange`) : `jugee_le` a
 * changé (de nul à non nul compris), ou un ticket est apparu. Un verdict identique n'arrête rien.
 */
export const verdictAChange = (avant: string | null, relu: string | null, ticket: TicketDeLAnnee | null): boolean =>
  ticket !== null || relu !== avant

/**
 * Guetter le verdict après un enregistrement ? Jumeau des gardes de l'API (`routes/carnet.ts`,
 * `POST /me/journal`, et `doitEnfilerMaturite`, `chroniques/file.ts`) : seulement à la **création**
 * d'une entrée, pour le compte IA, et quand le film est sorti l'année en cours du membre — l'année
 * de sortie que l'API lit est `media.year` de l'entrée rendue (`getUTCFullYear` de la même date).
 */
export const doitGuetterVerdict = (o: { ia: boolean; creation: boolean; anneeDuFilm: number | null; anneeEnCours: number }): boolean =>
  o.ia && o.creation && o.anneeDuFilm !== null && o.anneeDuFilm === o.anneeEnCours

/** « Le générique de fin » n'existe qu'avec le ticket de l'année, utilisé ou non (`409` sans lui). */
export const afficherGenerique = (ticket: TicketDeLAnnee | null): boolean => ticket !== null

/** Les années du chemin d'une année fermée : de l'année en cours à elle, bornes comprises. */
export function chemin(annee: number, anneeEnCours: number): number[] {
  const annees: number[] = []
  for (let a = anneeEnCours; a <= annee; a += 1) annees.push(a)
  return annees
}

/**
 * Ce qu'il manque pour ouvrir une année fermée (maquette 1890, écran III). `rattrape` : le pseudo du
 * Voyage suivi quand le membre a choisi de le rattraper (son année ouvre alors aussi les siennes) ;
 * nul sinon. Le jury n'est promis qu'au compte IA ; les deux ne vont jamais ensemble.
 */
export function phraseDuChemin(annee: number, anneeEnCours: number, o: { ia: boolean; rattrape: string | null }): string {
  const manque = annee - anneeEnCours
  const suivi = o.rattrape ? `, ou dès que ${o.rattrape} y arrive` : ''
  if (manque <= 1) return `Encore un ticket : le Lion de ${anneeEnCours}${suivi || (o.ia ? ', ou plus tôt si le jury le décide' : '')}.`
  return `Encore ${manque} tickets, un par année, depuis ${anneeEnCours}${suivi}.`
}

/**
 * Les films de mon journal sortis cette année-là — « vus en avance » sur une année fermée ou en
 * attente. Un film vu deux fois n'y est qu'une fois, à son visionnage le plus récent (le journal
 * arrive du plus récent au plus ancien). Jamais une série : le Voyage ne compte que des films.
 */
export function vusEnAvance(items: readonly JournalItem[], annee: number): JournalItem[] {
  const vus = new Set<string>()
  const liste: JournalItem[] = []
  for (const item of items) {
    if (item.media.type !== 'movie' || item.media.year !== annee || vus.has(item.media.id)) continue
    vus.add(item.media.id)
    liste.push(item)
  }
  return liste
}
