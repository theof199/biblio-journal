import type { VueMonde } from '../types'
import { clamp } from '../../carte/outils'
import { B1, E, HAUTEUR, PAS } from './trace'

/**
 * Les quatre toiles du Panorama transsibérien de 1900 (maquette, idée 50 et l. 1773-1781) : le
 * fond à 5 m/min, la campagne à 40, les gares à 120, la courroie du ballast à 300. Chaque rapport
 * est celui de sa toile au ballast.
 */
export const RAPPORTS = { fond: 1 / 60, loin: 2 / 15, gares: 2 / 5, ballast: 1 } as const

/**
 * De combien chaque toile a défilé, en pixels d'écran, pour une avance de la caméra : rien avant
 * la gare de 1900, puis `E` pixels de la toile des gares par `PAS` de geste, jusqu'à la gare de
 * 1909. Tout ce qui bouge dans le monde se tire d'ici, donc d'`avance` seule.
 */
export function decalages(avance: number): { fond: number; loin: number; gares: number; ballast: number } {
  const ballast = (clamp(avance - B1, 0, 9 * PAS) * (E / PAS)) / RAPPORTS.gares
  return { fond: ballast * RAPPORTS.fond, loin: ballast * RAPPORTS.loin, gares: ballast * RAPPORTS.gares, ballast }
}

/**
 * La part de l'écran où la section se voit, du haut au bas : la scène est collée à l'écran, mais
 * elle ne couvre ni le bas de la section d'avant tant qu'il s'y voit, ni le haut de la suivante.
 */
export function fenetre(v: Pick<VueMonde, 'H' | 'avance'>): readonly [number, number] {
  return [Math.max(0, -v.avance), Math.min(v.H, HAUTEUR - v.avance)]
}

/**
 * Ouvre le dessin d'un plan, coupé à la fenêtre de la section ; faux quand il n'y a rien à
 * dessiner. Qui reçoit vrai rend le contexte par `restore`.
 */
export function ouvrir(v: VueMonde): boolean {
  if (v.presence <= 0.01) return false
  const [haut, bas] = fenetre(v)
  if (bas <= haut) return false
  const g = v.ctx
  g.save()
  g.globalAlpha = v.presence
  g.beginPath()
  g.rect(0, haut, v.W, bas - haut)
  g.clip()
  return true
}
