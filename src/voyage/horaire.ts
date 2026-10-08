import { formatDateVisionnage } from '../ui/format'
import { jourDeParis } from './passeport'

/**
 * Les mots de date de l'horaire d'une gare (plan des écrans des lots, briefs 10 et 11). **Le serveur
 * décide de l'échéance** : rien ne se calcule ici, la date servie se dit telle quelle, et son jour de
 * la semaine se lit dans la date, jamais écrit d'avance (la base ne tient pas « un dimanche »).
 */

/**
 * « dimanche 11 octobre 2026 » : une échéance (`AAAA-MM-JJ`, un jour du calendrier **sans heure**).
 * Elle ne passe pas par le fuseau de l'appareil : `new Date('2026-10-11')` est minuit à Greenwich,
 * donc la veille à l'ouest. Le jour de la semaine se lit à Greenwich sur ce minuit de Greenwich, les
 * chiffres se disent découpés (`formatDateVisionnage`).
 */
export function jourDeLEcheance(echeance: string): string {
  return `${semaineDeLEcheance(echeance)} ${formatDateVisionnage(echeance)}`
}

/**
 * « dimanche » : le jour de la semaine d'une échéance, seul, lu dans la date servie comme le fait
 * `jourDeLEcheance` (un jour du calendrier sans heure, le même à Paris et partout). Rien d'autre ne
 * se calcule : ni « demain », ni un nombre de jours. Le format se crée à chaque appel, comme les
 * autres : les tests changent le fuseau de Node.
 */
export function semaineDeLEcheance(echeance: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${echeance}T00:00:00Z`))
}

/** La mention d'un horaire tenu, sur la plaque d'une gare (maquette « Voyage immobile 1900 », `.emaillee em`). */
export const A_L_HEURE = 'à l’heure'

/** Ce que la plaque d'une gare dit de son horaire : sa mention, et `tenu` pour le filet doré. */
export interface HoraireDePlaque {
  mention: string
  tenu: boolean
}

/**
 * Ce que la plaque d'une gare dit de l'horaire de son année, sur la carte (plan des écrans des lots,
 * brief 11) : tenu, « à l'heure » et le filet doré ; accepté, « avant » et le jour de l'échéance
 * servie, jamais « dimanche » écrit d'avance ; **manqué, rien** (décision 7 du propriétaire), comme
 * sans horaire. Une plaque `fermee` ne dit rien : l'année n'est pas ouverte. Une seule règle pour le
 * dessin d'un monde et pour la liste des années que lit un lecteur d'écran (`pages/Carte.tsx`).
 */
export function horaireDePlaque(horaire: { etat: 'accepte' | 'tenu' | 'manque'; echeance: string } | null | undefined, fermee: boolean): HoraireDePlaque | null {
  if (!horaire || fermee) return null
  if (horaire.etat === 'tenu') return { mention: A_L_HEURE, tenu: true }
  if (horaire.etat === 'accepte') return { mention: `avant ${semaineDeLEcheance(horaire.echeance)}`, tenu: false }
  return null
}

/**
 * « samedi 10 octobre 2026 » : le jour où la gare a été bouclée, un **instant** dit à Paris, comme le
 * serveur le compte (un ticket émis un samedi à 23 h 30 de Greenwich l'est un dimanche). Le format se
 * crée à chaque appel, comme celui de `jourDeParis` : les tests changent le fuseau de Node.
 */
export function jourDArrivee(iso: string): string {
  const semaine = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' }).format(new Date(iso))
  return `${semaine} ${jourDeParis(iso)}`
}
