import type { VueMonde } from '../types'
import { clamp, lerp, lisse } from '../../carte/outils'
import { A1, MONTEE, T_ASSIS, T_DEPART } from './trace'

/**
 * Les règles du passage de la foire au train (maquette « Voyage immobile 1900 », `rendre`,
 * l. 3012-3051) : cinq moments, tous fonctions de la seule avance de la caméra. Ni l'horloge du
 * décor ni l'âge du passage joué (`VueMonde.t`, `VueMonde.entree`) n'entrent ici : la même avance
 * donne la même image, que le passage se joue, se rejoue à l'envers ou soit posé d'un coup. Le
 * dessin (`montee.ts`, `toiles.ts`, `gares.ts`) lit ces fonctions et ne décide rien.
 */
type Ecran = Pick<VueMonde, 'W' | 'H' | 'avance'>

/** La montée, de 0 (le quai remplit l'écran) à 1 (la gare de 1900) ; maquette : `tDe`. */
export const montee = (avance: number): number => clamp((avance - A1) / MONTEE, 0, 1)
/** Le trajet du quai de 1899 à la gare de 1900, de 0 (à quai) à 1 (en gare) ; maquette : `trajetDe`. */
export const trajet = (avance: number): number => clamp((montee(avance) - T_DEPART) / (1 - T_DEPART), 0, 1)
/** De 0 (sur le quai) à 1 (assis dans le compartiment). */
export const assise = (avance: number): number => lisse(0.27, 0.42, montee(avance))
/** De 0 (la vitre dans sa cloison) à 1 (la vitre a rempli l'écran). */
export const ouverture = (avance: number): number => lisse(0.58, 0.92, montee(avance))
/** La bouffée qui porte la montée en voiture, de 0 à 1 : elle monte, couvre le changement d'image, se dissipe. */
export function bouffee(avance: number): number {
  const t = montee(avance)
  return lisse(0.12, 0.28, t) * (1 - lisse(0.33, 0.47, t))
}

/**
 * La jonction sous la carte de 1890 : son haut à l'écran. Elle glisse avec la foire, et n'est plus
 * là dès que le quai remplit l'écran.
 */
export const jonctionALEcran = (v: Pick<Ecran, 'H' | 'avance'>): { y: number } | null => (v.avance > A1 + 2 || v.avance <= -v.H ? null : { y: -v.avance })

/**
 * Le quai de 1899 : son haut à l'écran (il entre par le bas, sous la jonction, puis remplit
 * l'écran), son grossissement vers la voiture, et l'opacité de ses mots (la plaque, la légende).
 * Nul avant qu'il n'entre, et dès qu'on est assis.
 */
export function quaiALEcran(v: Pick<Ecran, 'H' | 'avance'>): { y: number; zoom: number; mots: number } | null {
  const t = montee(v.avance)
  if (A1 - v.avance >= v.H || t >= T_ASSIS) return null
  return { y: Math.max(0, A1 - v.avance), zoom: 1 + 1.3 * lisse(0, 0.4, t), mots: 1 - lisse(0.1, 0.24, t) }
}

/** Le compartiment : son opacité et son grossissement (il recule quand on s'assied, puis la vitre l'emporte). Nul tant qu'on n'y est pas, et la vitre grande ouverte. */
export function interieurALEcran(avance: number): { alpha: number; echelle: number } | null {
  const a = assise(avance)
  const o = ouverture(avance)
  const alpha = a * (1 - lisse(0.78, 1, o))
  return alpha <= 0.001 ? null : { alpha, echelle: lerp(1.18, 1, a) + o * 0.9 }
}

/** La vitre dans sa cloison, en parts de l'écran (maquette : `r0`, l. 2961), et l'épaisseur de son cadre de bois. */
export const VITRE = { x: 0.07, y: 0.115, w: 0.86, h: 0.5, bois: 16 } as const

/**
 * La vitre, par où l'on voit les quatre toiles. Nulle tant qu'on n'est pas assis : rien du train ne
 * se dessine. Sinon la découpe à l'écran et son arrondi, l'opacité, de combien les toiles sont
 * remontées derrière elle (`dy` : le paysage se cadre dans une vitre haute de la moitié de
 * l'écran), et son cadre (le coin, l'échelle), nul quand il est sorti de l'écran.
 */
export function vitreALEcran(v: Ecran): { x: number; y: number; w: number; h: number; rayon: number; alpha: number; dy: number; cadre: { x: number; y: number; sx: number; sy: number } | null } | null {
  const alpha = assise(v.avance)
  if (alpha <= 0.001) return null
  const o = ouverture(v.avance)
  if (o >= 0.999) return { x: 0, y: 0, w: v.W, h: v.H, rayon: 0, alpha, dy: 0, cadre: null }
  const w0 = v.W * VITRE.w
  const h0 = v.H * VITRE.h
  const sx1 = v.W / (w0 - 2 * VITRE.bois)
  const sy1 = v.H / (h0 - 2 * VITRE.bois)
  const sx = lerp(1, sx1, o)
  const sy = lerp(1, sy1, o)
  const cx = lerp(v.W * VITRE.x, -VITRE.bois * sx1, o)
  const cy = lerp(v.H * VITRE.y, -VITRE.bois * sy1, o)
  const x = Math.max(0, cx)
  const y = Math.max(0, cy)
  return { x, y, w: Math.min(v.W, cx + w0 * sx) - x, h: Math.min(v.H, cy + h0 * sy) - y, rayon: lerp(14, 0, o), alpha, dy: lerp(-v.H * 0.3, 0, o), cadre: { x: cx, y: cy, sx, sy } }
}

/**
 * Vrai quand la vitre a rempli l'écran : les toiles sont à leur place, et ce qu'elles portent peut
 * se toucher. Avant, une gare se voit derrière la vitre, remontée et découpée : sa zone tomberait
 * à côté d'elle, ou sous le quai.
 */
export const vitreOuverte = (avance: number): boolean => ouverture(avance) >= 0.999

/**
 * Vrai quand ce qui est sous la vitre (la jonction, le quai, le compartiment) se dessine après tous
 * les plans : tant qu'il n'y a pas de vitre, rien du train n'est dessiné, et il faut couvrir ce que
 * la foire laisse déborder sous sa section. Dès que la vitre existe, il se dessine avant les toiles.
 */
export const dessousDevant = (v: Ecran): boolean => vitreALEcran(v) === null

/**
 * Le cadrage du quai sur l'écran (maquette : `.quai .photo`, l. 70) : la photographie couvre
 * l'écran, calée à 10 % de sa largeur, et son haut se fond sur 14 % de l'écran. `fondu` : où ce
 * fondu commence et finit, en parts de la hauteur de la photographie.
 */
export function cadrageDuQuai(W: number, H: number, taille: readonly [number, number]): { x: number; y: number; w: number; h: number; fondu: readonly [number, number] } {
  const e = Math.max(W / taille[0], H / taille[1])
  const w = taille[0] * e
  const h = taille[1] * e
  const y = (H - h) / 2
  return { x: (W - w) * 0.1, y, w, h, fondu: [-y / h, (-y + H * 0.14) / h] }
}
