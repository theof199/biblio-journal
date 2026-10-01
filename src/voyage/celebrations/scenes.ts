import type { FichePrete, Progression, Recompense, Voyage } from '../../api/voyage'
import { ligneDuBas } from '../annee'
import { salleComplete } from '../salles'

/**
 * Les célébrations du Voyage (maquette 1890, écran IX), sans rendu : ce que la fiche d'une année
 * portait avant le billet, ce qu'elle porte après, et les scènes que la différence fait jouer.
 */

/** Ce qu'une fiche prête porte de quoi fêter. */
export interface EtatDeFete {
  /** Le compte de l'API (`progression.salles_completes`) : lui seul déclenche ; nul sans progression. */
  sallesCompletes: number | null
  /** Les salles complètes hors essentiels, telles que la fiche les montre : de quoi nommer celle qui vient de l'être. */
  salles: readonly { id: string; nom: string }[]
  recompense: Recompense | null
  /** L'année qu'ouvre le ticket qui attend d'être utilisé ; nul sans ticket, utilisé, ou vers une année déjà ouverte. */
  ticket: number | null
}

export type Scene =
  /** Une salle bouclée : son nom quand la fiche le dit, sinon leur compte. */
  | { type: 'salle'; noms: readonly string[]; combien: number }
  | { type: 'recompense'; annee: number; recompense: Recompense }
  /** L'année bouclée : le ticket qui ouvre `ticket` est gagné. */
  | { type: 'annee'; annee: number; recompense: Recompense | null; ticket: number }

const RANG: Record<Recompense, number> = { ours: 1, lion: 2, palme: 3 }
const rang = (r: Recompense | null): number => (r ? RANG[r] : 0)

/**
 * L'état d'une fiche prête. Le ticket suit `ligneDuBas` : celui que la fiche offre d'utiliser, lui
 * seul (un ticket vers une année que le rattrapage a déjà ouverte n'ouvre plus rien).
 */
export function etatDeFete(f: Pick<FichePrete, 'recompense' | 'ticket' | 'salles'> & { progression: Progression | null }, anneeEnCours: number): EtatDeFete {
  const ligne = ligneDuBas(f.ticket, null, anneeEnCours)
  return {
    sallesCompletes: f.progression?.salles_completes ?? null,
    salles: f.salles.filter((s) => s.cle !== 'essentiels' && salleComplete(s)).map((s) => ({ id: s.id, nom: s.nom })),
    recompense: f.recompense,
    ticket: ligne?.type === 'ticket' ? ligne.annee : null,
  }
}

/**
 * Les scènes à jouer au retour d'un billet, dans l'ordre (la salle, la récompense, puis l'année) : ce qui a été gagné entre l'avant et
 * l'après, jamais ce qui était déjà là ni un recul. Une progression inconnue d'un côté ne boucle
 * aucune salle.
 */
export function scenesDuRetour(annee: number, avant: EtatDeFete, apres: EtatDeFete): Scene[] {
  const scenes: Scene[] = []
  if (avant.sallesCompletes !== null && apres.sallesCompletes !== null && apres.sallesCompletes > avant.sallesCompletes) {
    const deja = new Set(avant.salles.map((s) => s.id))
    scenes.push({ type: 'salle', noms: apres.salles.filter((s) => !deja.has(s.id)).map((s) => s.nom), combien: apres.sallesCompletes - avant.sallesCompletes })
  }
  if (apres.recompense && rang(apres.recompense) > rang(avant.recompense)) scenes.push({ type: 'recompense', annee, recompense: apres.recompense })
  if (apres.ticket !== null && avant.ticket === null) scenes.push({ type: 'annee', annee, recompense: apres.recompense, ticket: apres.ticket })
  return scenes
}

/**
 * Le rattrapage, à l'ouverture de la carte : le ticket gagné et pas encore montré
 * (`ticket_a_montrer`) rejoue l'année bouclée, elle seule. L'année bouclée est celle d'avant le
 * ticket ; sa récompense est celle que la carte lui connaît.
 */
export function sceneDuRattrapage(v: Pick<Voyage, 'ticket_a_montrer' | 'annees'>): Extract<Scene, { type: 'annee' }> | null {
  const t = v.ticket_a_montrer
  if (!t) return null
  const annee = t.annee - 1
  return { type: 'annee', annee, recompense: v.annees.find((a) => a.annee === annee)?.recompense ?? null, ticket: t.annee }
}

/** Ce que la récompense couronne, sous son nom (les règles de `calculerCarte`, côté API). */
export function motifDeRecompense(recompense: Recompense, annee: number): string {
  if (recompense === 'ours') return `trois films de ${annee}`
  if (recompense === 'lion') return `les essentiels de ${annee}`
  return 'le Lion et deux salles complètes'
}

/** Le carton d'une salle bouclée : son nom, ou leur compte quand la fiche n'en nomme pas une seule. */
export function cartonDeSalle(scene: Extract<Scene, { type: 'salle' }>): { sur: string; titre: string } {
  if (scene.noms.length === 1) return { sur: 'Salle complète', titre: scene.noms[0]! }
  const n = Math.max(scene.combien, scene.noms.length)
  return n > 1 ? { sur: 'Salles complètes', titre: `${n} salles` } : { sur: 'Salle complète', titre: 'Une salle' }
}
