import type { MotsDesPages, VueBandeau } from '../../types'
import { LIEU } from '../gares'

type Mode = VueBandeau['mode']

/**
 * L'heure de la gare est son année (maquette, écran 2 : « 19 h 03 pour 1903 ») : le siècle donne
 * l'heure, les deux derniers chiffres les minutes. Les angles sont ceux des aiguilles, en degrés
 * depuis midi.
 */
export function heureDeLaGare(annee: number): { heures: number; minutes: number; libelle: string; angleDesHeures: number; angleDesMinutes: number } {
  const heures = Math.floor(annee / 100)
  const minutes = annee % 100
  return {
    heures,
    minutes,
    libelle: `${heures} h ${String(minutes).padStart(2, '0')}`,
    angleDesHeures: ((heures % 12) + minutes / 60) * 30,
    angleDesMinutes: minutes * 6,
  }
}

const RANGS = ['Première', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième', 'Septième', 'Huitième', 'Neuvième', 'Dixième'] as const

/** Le rang de la gare sur la ligne de sa décennie (maquette : « Quatrième gare » pour 1903). */
export const rangDeLaGare = (annee: number): string => `${RANGS[annee % 10]!} gare`

/**
 * Ce que la plaque dit au-dessus de l'année : le rang d'une gare ouverte, sinon l'état de la voie
 * (« Voie fermée » en attente, la plaque à développer d'une année fermée).
 */
export function mentionDeLaPlaque(mode: Mode, annee: number, mots: MotsDesPages): string {
  if (mode === 'fermee') return mots.annonce.fermee
  if (mode === 'attente') return mots.annonce.attente
  return rangDeLaGare(annee)
}

/** Le nom lu de la photographie : son lieu, puis ce que son état en fait (maquette, écrans 2, 12 et 16). */
export function libelleDeLaPhoto(mode: Mode, annee: number): string {
  const lieu = LIEU[annee] ?? `La gare de ${annee}`
  if (mode === 'fermee') return `${lieu}, la gare vers 1900, sur une plaque de verre encore négative`
  if (mode === 'attente') return `${lieu}, la gare vers 1900, assombrie : la voie n’est pas ouverte`
  return `${lieu}, la gare vers 1900`
}
