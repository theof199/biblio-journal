import type { FichePrete, PlaceDeMalle, Progression, Recompense, Voyage } from '../../api/voyage'
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
  /**
   * Les places de la malle de la décennie, telles que le serveur les sert : avant l'écriture, celles
   * que le billet a lues en s'ouvrant ; après, celles de la relecture réussie. Absentes ou nulles (la
   * malle n'a pas été lue, ou le monde n'en fête pas) : **aucune étiquette ne se fête**, la sacoche le
   * dira. Une liste vide est une malle lue où rien n'est collé : ce n'est pas la même chose.
   */
  malle?: readonly PlaceDeMalle[] | null
}

export type Scene =
  /** Une salle bouclée : son nom quand la fiche le dit, sinon leur compte. */
  | { type: 'salle'; noms: readonly string[]; combien: number }
  | { type: 'recompense'; annee: number; recompense: Recompense }
  /**
   * Une étiquette de la malle vient de se coller (un badge : « étiquette » seul est la récompense) :
   * sa place, telle que la relecture la sert, et celles qui étaient collées avant elle, par numéro.
   */
  | { type: 'badge'; place: PlaceDeMalle; deja: readonly PlaceDeMalle[] }
  /** L'année bouclée : le ticket qui ouvre `ticket` est gagné. */
  | { type: 'annee'; annee: number; recompense: Recompense | null; ticket: number }

const RANG: Record<Recompense, number> = { ours: 1, lion: 2, palme: 3 }
const rang = (r: Recompense | null): number => (r ? RANG[r] : 0)

/**
 * L'état d'une fiche prête. Le ticket suit `ligneDuBas` : celui que la fiche offre d'utiliser, lui
 * seul (un ticket vers une année que le rattrapage a déjà ouverte n'ouvre plus rien).
 */
export function etatDeFete(
  f: Pick<FichePrete, 'recompense' | 'ticket' | 'salles'> & { progression: Progression | null },
  anneeEnCours: number,
  malle: readonly PlaceDeMalle[] | null = null,
): EtatDeFete {
  const ligne = ligneDuBas(f.ticket, null, anneeEnCours)
  return {
    // Posée seulement quand elle a été lue : l'état d'une fiche sans malle reste celui d'avant.
    ...(malle ? { malle } : {}),
    sallesCompletes: f.progression?.salles_completes ?? null,
    salles: f.salles.filter((s) => s.cle !== 'essentiels' && salleComplete(s)).map((s) => ({ id: s.id, nom: s.nom })),
    recompense: f.recompense,
    ticket: ligne?.type === 'ticket' ? ligne.annee : null,
  }
}

/**
 * Les scènes à jouer au retour d'un billet, dans l'ordre (la salle, la récompense, les étiquettes de
 * la malle, puis l'année) : ce qui a été gagné entre l'avant et l'après, jamais ce qui était déjà là
 * ni un recul. Une progression inconnue d'un côté ne boucle aucune salle ; une malle inconnue d'un
 * côté ne colle aucune étiquette.
 */
export function scenesDuRetour(annee: number, avant: EtatDeFete, apres: EtatDeFete): Scene[] {
  const scenes: Scene[] = []
  if (avant.sallesCompletes !== null && apres.sallesCompletes !== null && apres.sallesCompletes > avant.sallesCompletes) {
    const deja = new Set(avant.salles.map((s) => s.id))
    scenes.push({ type: 'salle', noms: apres.salles.filter((s) => !deja.has(s.id)).map((s) => s.nom), combien: apres.sallesCompletes - avant.sallesCompletes })
  }
  if (apres.recompense && rang(apres.recompense) > rang(avant.recompense)) scenes.push({ type: 'recompense', annee, recompense: apres.recompense })
  scenes.push(...badgesColles(avant.malle ?? null, apres.malle ?? null))
  if (apres.ticket !== null && avant.ticket === null) scenes.push({ type: 'annee', annee, recompense: apres.recompense, ticket: apres.ticket })
  return scenes
}

const collee = (p: PlaceDeMalle): boolean => p.collee_le !== null

/**
 * Les étiquettes de la malle qui viennent de se coller : collées après, et pas avant. **Collée se lit
 * sur `collee_le`, jamais sur la progression** (au seuil sans date, c'est une trace de colle pleine :
 * le serveur ne l'a pas encore constatée). Une scène par étiquette, par numéro ; chacune montre
 * celles d'avant elle, les neuves de plus petit numéro comprises. Sans l'une des deux malles, rien.
 */
export function badgesColles(avant: readonly PlaceDeMalle[] | null, apres: readonly PlaceDeMalle[] | null): Extract<Scene, { type: 'badge' }>[] {
  if (avant === null || apres === null) return []
  const deja = new Set(avant.filter(collee).map((p) => p.numero))
  const collees = apres.filter(collee).sort((a, b) => a.numero - b.numero)
  const anciennes = collees.filter((p) => deja.has(p.numero))
  const neuves = collees.filter((p) => !deja.has(p.numero))
  return neuves.map((place, i) => ({ type: 'badge', place, deja: [...anciennes, ...neuves.slice(0, i)].sort((a, b) => a.numero - b.numero) }))
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

/** Ce que la fête d'une étiquette de la malle dit en tête, et le nom de son dialogue. */
export const MOT_DU_BADGE = 'Étiquette collée'
export const nomDuBadge = (scene: Extract<Scene, { type: 'badge' }>): string => (scene.place.nom ? `${MOT_DU_BADGE} : ${scene.place.nom}` : MOT_DU_BADGE)

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
