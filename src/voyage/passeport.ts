import type { AnneeCarte, Ticket, Voyage } from '../api/voyage'
import { formatDateVisionnage } from '../ui/format'

/**
 * Le passeport d'une décennie (plan 2c), sans rendu : son tampon, et ce qui manque encore pour
 * l'obtenir. Jumeau, côté Journal, de `calculerTampons` (`apps/api/src/routes/voyage.ts`) : c'est
 * l'API qui tamponne, le Journal ne fait que dire où l'on en est.
 */

export type Tampon = Voyage['tampons'][number]

/** Le tampon d'une décennie, s'il est au passeport ; nul sinon. */
export const tamponDe = (tampons: readonly Tampon[], decennie: number): Tampon | null =>
  tampons.find((t) => t.decennie === decennie) ?? null

/** La frontière passée en entrant dans une décennie : le tampon de la décennie d'avant. */
export type Sortie = Tampon

/**
 * Le tampon de sortie d'une décennie : celui de la décennie d'avant, à sa date (`boucle_le`). Nul
 * tant qu'elle n'est pas bouclée, et pour la première décennie : rien ne se date sans tampon.
 */
export const sortieDe = (tampons: readonly Tampon[], decennie: number): Sortie | null => tamponDe(tampons, decennie - 10)

/** Je suis entré dans la décennie : mon année en cours l'a atteinte. Un ticket gagné ou gardé n'y suffit pas. */
export const entreeFaite = (anneeEnCours: number, decennie: number): boolean => anneeEnCours >= decennie

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

/**
 * Le jour d'un instant, en toutes lettres, **à Paris** : celui où une décennie a été bouclée (le
 * tampon, le passeport de la sacoche), celui où un ticket a été utilisé (le portefeuille). `boucle_le`
 * est tantôt un minuit UTC (le jour d'un visionnage, une date sans heure), tantôt l'instant où le ticket de la
 * décennie suivante a été utilisé (`calculerTampons`, la plus tardive des deux). Un minuit UTC est le
 * même jour à Paris ; un ticket utilisé à 0 h 30 à Paris l'est le jour même, pas la veille comme en
 * UTC. Jamais le fuseau de l'appareil : un téléphone réglé ailleurs reculerait d'un jour. Le jour de
 * Paris (`AAAA-MM-JJ`, que `en-CA` écrit ainsi) se dit ensuite comme un visionnage
 * (`formatDateVisionnage` : « 1er janvier 2000 », que `Intl` écrirait « 1 janvier »). Le format se
 * crée à chaque appel : les tests changent le fuseau de Node, et un format créé au chargement ne le
 * verrait pas (le retrait du fuseau passerait alors inaperçu).
 */
export function jourDeParis(iso: string): string {
  const jour = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso))
  return formatDateVisionnage(jour)
}
