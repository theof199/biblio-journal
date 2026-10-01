import { jourLocal } from '../ui/format'
import { auTempo } from './tempo'

/**
 * Le billet de séance (maquette 1890, écran VI), sans rendu : le dateur à molettes, le compte des
 * cartons. Les dates sont des jours du calendrier du téléphone (`AAAA-MM-JJ`, `jourLocal`), jamais
 * des instants UTC.
 */

const MOIS_DU_DATEUR = ['JANV', 'FÉVR', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'] as const

const lire = (iso: string): Date => {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(a!, m! - 1, j!)
}

/** Le jour décalé de `n` jours, en calendrier local (les mois et les années se franchissent). */
export function decalerJour(iso: string, n: number): string {
  const d = lire(iso)
  d.setDate(d.getDate() + n)
  return jourLocal(d)
}

/** Les trois molettes : le jour sur deux chiffres, le mois en capitales d'affiche, l'année. */
export function molettes(iso: string): { jour: string; mois: string; an: string } {
  const [a, m, j] = iso.split('-')
  return { jour: j!, mois: MOIS_DU_DATEUR[Number(m) - 1]!, an: a! }
}

/** La flèche suivante s'éteint à aujourd'hui : un visionnage ne se date pas dans l'avenir (`max` du formulaire). */
export const peutAvancer = (iso: string, aujourdhui: string): boolean => iso < aujourdhui

/** Le raccourci allumé : « Aujourd'hui », « Hier », ou aucun. */
export function raccourci(iso: string, aujourdhui: string): 'aujourdhui' | 'hier' | null {
  if (iso === aujourdhui) return 'aujourdhui'
  return iso === decalerJour(aujourdhui, -1) ? 'hier' : null
}

/** « aucun carton », « 1 carton choisi », « 3 cartons choisis ». */
export const compteDesCartons = (n: number): string => (n === 0 ? 'aucun carton' : `${n} carton${n > 1 ? 's' : ''} choisi${n > 1 ? 's' : ''}`)

/** Le cachet de cire de la remarque porte l'initiale du membre. */
export const initiale = (pseudo: string): string => pseudo.trim().charAt(0).toUpperCase()

/**
 * Le compostage de l'idée 5 (décision D4), en millisecondes : le marteau descend, l'encre se pose (son
 * éclat court pendant la pause et la remontée), le marteau remonte, le numéroteur fait ses tirages,
 * une pause, puis le talon part. L'ordre et les gestes sont ceux de la maquette 1890 (`tamponner`,
 * lignes 2683 à 2708). Les valeurs de base sont celles du plan 2c (2 170 ms en tout, celles de la
 * maquette en faisaient 3 050) ; toutes passent par le tempo (`tempo.ts`), qui les double depuis le
 * 1er octobre 2026. Les feuilles du tampon et du billet jouent les mêmes durées (`billet.test.ts`).
 * `tirages` est un compte, pas une durée.
 */
export const FRAPPE = {
  descend: auTempo(360),
  pause: auTempo(140),
  remonte: auTempo(320),
  tirage: auTempo(45),
  tirages: 10,
  avantTalon: auTempo(200),
  talon: auTempo(700),
} as const

/** La vibration de la frappe, reprise au palier sur l'année : vibrer, se taire, vibrer, au tempo. */
export const VIBRATION = [18, 40, 70].map(auTempo)

/** Le compostage entier, du toucher au retour à l'année : 2 170 ms de base, au tempo. */
export const DUREE_DU_COMPOSTAGE = FRAPPE.descend + FRAPPE.pause + FRAPPE.remonte + FRAPPE.tirage * FRAPPE.tirages + FRAPPE.avantTalon + FRAPPE.talon
