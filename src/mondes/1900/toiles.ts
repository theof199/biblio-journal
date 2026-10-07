import type { VueMonde } from '../types'
import { clamp } from '../../carte/outils'
import { trajet, vitreALEcran, vitreOuverte } from './passage'
import { B1, E, HAUTEUR, PAS } from './trace'

/**
 * Les quatre toiles du Panorama transsibérien de 1900 (maquette, idée 50 et l. 1773-1781) : le
 * fond à 5 m/min, la campagne à 40, les gares à 120, la courroie du ballast à 300. Chaque rapport
 * est celui de sa toile au ballast.
 */
export const RAPPORTS = { fond: 1 / 60, loin: 2 / 15, gares: 2 / 5, ballast: 1 } as const

/**
 * De combien chaque toile a défilé depuis la gare de 1900, en pixels d'écran, pour une avance de
 * la caméra : `E` pixels de la toile des gares par `PAS` de geste, jusqu'à la gare de 1909. Avant
 * la gare de 1900, le train vient du quai de 1899, une gare plus tôt (maquette : `xsDe`, l. 2997) :
 * les toiles sont en retard de `E`, immobiles tant qu'on n'est pas parti, puis rattrapent ce retard
 * le long du trajet (`passage.ts`). Tout ce qui bouge dans le monde se tire d'ici, donc d'`avance` seule.
 */
export function decalages(avance: number): { fond: number; loin: number; gares: number; ballast: number } {
  const ballast = (clamp(avance - B1, 0, 9 * PAS) * (E / PAS) - E * (1 - trajet(avance))) / RAPPORTS.gares
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
 * Vrai quand le `y` d'écran tombe dans la part de l'écran où la section se voit. `ouvrir` ne coupe
 * que le dessin : une zone touchable s'inscrit hors de toute coupe, et le moteur ne la filtre pas.
 * Tout ce qui se touche (une année, une dépêche, une bobine, la voiture) passe donc par ici. Rien
 * ne se touche pendant le passage : tant que la vitre n'a pas rempli l'écran, les toiles sont
 * remontées derrière elle, ou cachées par le quai.
 */
export function dansLaFenetre(v: Pick<VueMonde, 'H' | 'avance'>, y: number): boolean {
  if (!vitreOuverte(v.avance)) return false
  const [haut, bas] = fenetre(v)
  return y >= haut && y <= bas
}

/** Le chemin d'un rectangle aux coins arrondis, par `arcTo`. */
export function arrondi(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  g.beginPath()
  g.moveTo(x + rr, y)
  g.arcTo(x + w, y, x + w, y + h, rr)
  g.arcTo(x + w, y + h, x, y + h, rr)
  g.arcTo(x, y + h, x, y, rr)
  g.arcTo(x, y, x + w, y, rr)
  g.closePath()
}

/**
 * Ouvre le dessin d'un plan du train, coupé à la fenêtre de la section ; faux quand il n'y a rien
 * à dessiner. Qui reçoit vrai rend le contexte par `restore`. Pendant le passage, le train ne se
 * voit que par la vitre du compartiment (`passage.ts`) : rien tant qu'elle n'existe pas, puis le
 * plan coupé à sa découpe, à son opacité, et remonté derrière elle.
 */
export function ouvrir(v: VueMonde): boolean {
  if (v.presence <= 0.01) return false
  const [haut, bas] = fenetre(v)
  if (bas <= haut) return false
  const vitre = vitreALEcran(v)
  if (!vitre) return false
  const g = v.ctx
  g.save()
  g.globalAlpha = v.presence * vitre.alpha
  g.beginPath()
  g.rect(0, haut, v.W, bas - haut)
  g.clip()
  if (vitre.cadre) {
    arrondi(g, vitre.x, vitre.y, vitre.w, vitre.h, vitre.rayon)
    g.clip()
    g.translate(0, vitre.dy)
  }
  return true
}
