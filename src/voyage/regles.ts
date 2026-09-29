import type { AnneeCarte, FichePrete, Progression, Recompense } from '../api/voyage'

/** Jumeau d'`OURS_FILMS_MIN` (`packages/shared/src/voyage.ts`) : trois films vus donnent l'Ours. */
export const OURS_FILMS_MIN = 3

/**
 * Les récompenses que compte le HUD : jamais celles d'une année postérieure à l'année en cours
 * (un film vu en avance peut y valoir l'Ours). Portée de `recompensesJusquaAnneeEnCours`
 * (`biblio-android`, `ui/frise/VoyageCarte.kt`).
 */
export function recompensesJusquaAnneeEnCours(annees: readonly AnneeCarte[], anneeEnCours: number): Recompense[] {
  return annees.filter((a) => a.annee <= anneeEnCours).flatMap((a) => (a.recompense ? [a.recompense] : []))
}

export function compterRecompenses(recompenses: readonly Recompense[]): Record<Recompense, number> {
  const compte: Record<Recompense, number> = { palme: 0, lion: 0, ours: 0 }
  for (const r of recompenses) compte[r] += 1
  return compte
}

/**
 * Le bandeau « Prochain pas » (portée de `prochainPas`, `AnneeViewModel.kt`). Deux écarts
 * assumés : `ia` (un membre hors IA n'a pas de jury, son ticket vient du Lion seul — spec du
 * Voyage à deux, « Le Lion sans IA ») et `ticketConnu` au lieu du ticket lui-même (seule son
 * existence compte). `essentiels_vus` ne compte pas les introuvables, qui comptent pourtant pour
 * le Lion : la ligne du Lion se tait dès que le Lion est acquis, jamais d'après un compte.
 */
export function prochainPas(
  profondeur: number,
  progression: Progression | null,
  recompense: Recompense | null,
  ticketConnu: boolean,
  ia: boolean,
): string[] {
  if (!progression) return []
  const etapes: string[] = []
  if (recompense === null) {
    const reste = Math.max(0, OURS_FILMS_MIN - profondeur)
    if (reste > 0) etapes.push(`Ours : encore ${reste} film${reste > 1 ? 's' : ''}`)
  }
  if (recompense !== 'lion' && recompense !== 'palme') {
    const reste = Math.max(0, progression.essentiels_total - progression.essentiels_vus)
    if (reste > 0) etapes.push(`Lion : encore ${reste} essentiel${reste > 1 ? 's' : ''}`)
  }
  if (recompense !== 'palme') {
    const reste = Math.max(0, 2 - progression.salles_completes)
    if (reste > 0) etapes.push(`Palme : ${reste} salle${reste > 1 ? 's' : ''} de plus`)
  }
  if (!ticketConnu) etapes.push(ia ? 'Ticket : au Lion, ou plus tôt si le jury le décide' : 'Ticket : au Lion')
  return etapes
}

/** La jauge corail du HUD et de la case en cours : vers le Lion tant qu'il manque, puis vers la Palme. */
export function jauge(progression: Progression | null, recompense: Recompense | null): { vus: number; total: number } | null {
  if (!progression) return null
  if (recompense !== 'lion' && recompense !== 'palme') {
    if (progression.essentiels_total === 0) return null
    return { vus: Math.min(progression.essentiels_vus, progression.essentiels_total), total: progression.essentiels_total }
  }
  return { vus: recompense === 'palme' ? 2 : Math.min(progression.salles_completes, 2), total: 2 }
}

export type EtatCase = 'palme' | 'lion' | 'ours' | 'encours' | 'passee' | 'verrou'

/**
 * L'état d'une case. `attente` : pour un membre hors IA, une année lisible que le Voyage suivi
 * n'a pas encore ouverte (spec du Voyage à deux, « L'option A ») — non verrouillée et
 * `visitee: false`. Jamais vraie pour le compte IA : chez lui, la même année s'ouvre à la visite.
 */
export function etatDeCase(a: AnneeCarte, ia: boolean): { etat: EtatCase; attente: boolean } {
  const attente = !ia && a.statut !== 'verrouillee' && !a.visitee
  if (a.statut === 'verrouillee') return { etat: 'verrou', attente }
  if (a.statut === 'en_cours') return { etat: 'encours', attente }
  return { etat: a.recompense ?? 'passee', attente }
}

/**
 * Faut-il lire la fiche pour l'aperçu d'une année ? Seulement si elle est déjà écrite
 * (`visitee`) et non verrouillée : sur une année non visitée, `GET /me/voyage/annees/{annee}`
 * enfile l'ouverture chez le chroniqueur — un appui long ne doit jamais coûter un appel IA.
 */
export const apercuLitLaFiche = (a: AnneeCarte): boolean => a.visitee && a.statut !== 'verrouillee'

/**
 * Les affiches d'une colonne Morris, quatre au plus : le podium d'abord, puis les meilleures
 * notes des films vus des salles, sans doublon ; sans fiche en cache, la seule affiche que la
 * carte connaisse (`affiche_url`, le n°1 du podium).
 */
export function affichesDeColonne(a: AnneeCarte, fiche: FichePrete | undefined): string[] {
  if (!fiche) return a.affiche_url ? [a.affiche_url] : []
  const vues = new Set<string>()
  const retenir = (url: string | null) => {
    if (url && !vues.has(url) && vues.size < 4) vues.add(url)
  }
  for (const marche of fiche.podium) retenir(marche?.cover_url ?? null)
  const films = fiche.salles
    .flatMap((s) => s.films)
    .filter((f) => f.etat === 'vu')
    .sort((x, y) => (y.note ?? 0) - (x.note ?? 0))
  for (const f of films) retenir(f.cover_url)
  return [...vues]
}

export interface FrontiereAvancee {
  anneeQuittee: number
  decennieQuittee: number | null
}

export const decennieDe = (annee: number) => Math.floor(annee / 10) * 10

/**
 * Ce qu'une frontière qui avance vient de quitter (portée de `detecterFrontiereAvancee`,
 * `VoyageCarte.kt`) : `avant` est l'année en cours mémorisée, `apres` celle que la carte vient
 * de rendre. `avant` nul (première ouverture sur cet appareil) ne rejoue rien.
 */
export function detecterFrontiereAvancee(avant: number | null, apres: number): FrontiereAvancee | null {
  if (avant === null || apres <= avant) return null
  return { anneeQuittee: avant, decennieQuittee: decennieDe(avant) !== decennieDe(apres) ? decennieDe(avant) : null }
}
