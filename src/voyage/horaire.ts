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
  const semaine = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${echeance}T00:00:00Z`))
  return `${semaine} ${formatDateVisionnage(echeance)}`
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
