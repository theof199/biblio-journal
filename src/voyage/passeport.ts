import type { AnneeCarte, Ticket, Voyage } from '../api/voyage'

/**
 * Le passeport d'une décennie (plan 2c), sans rendu : son tampon, et ce qui manque encore pour
 * l'obtenir. Jumeau, côté Journal, de `calculerTampons` (`apps/api/src/routes/voyage.ts`) : c'est
 * l'API qui tamponne, le Journal ne fait que dire où l'on en est.
 */

export type Tampon = Voyage['tampons'][number]

/** Le tampon d'une décennie, s'il est au passeport ; nul sinon. */
export const tamponDe = (tampons: readonly Tampon[], decennie: number): Tampon | null =>
  tampons.find((t) => t.decennie === decennie) ?? null

/**
 * Les années qui comptent pour le tampon d'une décennie : de son début, ou du départ du Voyage s'il
 * est plus tard (les années 1890 commencent en 1895), à sa fin — jumeau de
 * `debut = Math.max(VOYAGE_DEPART, decennie)` dans `calculerTampons`.
 */
export function anneesDuTampon(decennie: number, depart: number): number[] {
  const annees: number[] = []
  for (let a = Math.max(depart, decennie); a <= decennie + 9; a += 1) annees.push(a)
  return annees
}

/** Ce qui manque au tampon : les années sans récompense, et le ticket de la décennie suivante s'il n'est pas utilisé. */
export interface Manque {
  annees: number[]
  ticket: number | null
}

/**
 * Le chemin du tampon (décisions D1 et D6) : chaque année de la décennie porte sa récompense (l'Ours
 * au moins, telle que la carte la montre), et le ticket de la première année de la décennie suivante
 * est utilisé. Une année absente de la carte (après l'année civile) n'a pas de récompense.
 */
export function ceQuiManque(annees: readonly AnneeCarte[], tickets: readonly Ticket[], decennie: number, depart: number): Manque {
  const recompensees = new Set(annees.filter((a) => a.recompense !== null).map((a) => a.annee))
  const suivante = decennie + 10
  const utilise = tickets.some((t) => t.annee === suivante && t.utilise_le !== null)
  return {
    annees: anneesDuTampon(decennie, depart).filter((a) => !recompensees.has(a)),
    ticket: utilise ? null : suivante,
  }
}

/** L'anneau du passeport : les années du tampon qui portent déjà leur récompense, sur toutes. */
export function anneauDuPasseport(annees: readonly AnneeCarte[], decennie: number, depart: number): { faites: number; total: number } {
  const liste = anneesDuTampon(decennie, depart)
  const recompensees = new Set(annees.filter((a) => a.recompense !== null).map((a) => a.annee))
  return { faites: liste.filter((a) => recompensees.has(a)).length, total: liste.length }
}

/** « 1896 », « 1896 et 1898 », « 1896, 1897 et 1898 ». */
export function enumerer(annees: readonly number[]): string {
  if (annees.length <= 1) return annees.join('')
  return `${annees.slice(0, -1).join(', ')} et ${annees[annees.length - 1]!}`
}

/**
 * La phrase du livret : ce qui manque, dit en clair ; nulle quand le tampon est posé (le livret
 * montre alors le tampon et sa date).
 */
export function phraseDuPasseport(manque: Manque, tampon: Tampon | null): string | null {
  if (tampon) return null
  const parts: string[] = []
  if (manque.annees.length > 0) parts.push(`une récompense en ${enumerer(manque.annees)}`)
  if (manque.ticket !== null) parts.push(`le ticket de ${manque.ticket}`)
  return parts.length > 0 ? `Il manque ${parts.join(', et ')}.` : null
}
