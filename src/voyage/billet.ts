import { jourLocal } from '../ui/format'

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
