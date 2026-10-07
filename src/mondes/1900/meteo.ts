import type { VueMonde } from '../types'
import { lerp } from '../../carte/outils'
import { METEO, type Temps } from './donnees'
import { AVERSE, DECALAGE_DES_GOUTTES, FLOCONS_LOIN, FLOCONS_MOYENS, FLOCONS_PROCHES, RUISSELLEMENT_LENT, RUISSELLEMENT_VIF } from './durees'
import { alea, lisse, rangSurLaLigne, voileDuLaboratoire } from './habillage'
import { ANNEES, B1 } from './trace'

/**
 * Les règles de la météo par la vitre (idée 70, sans la buée ; maquette : `rendreDecor`,
 * l. 3721-3729) : des fonctions pures, que le trait (`intemperies.ts`) lit et que les tests gardent.
 * Combien il pleut ou neige se tire d'`avance` seule ; seul ce qui tombe lit l'horloge du décor, et
 * jamais quand le visiteur demande moins d'animations.
 */

type Table = Readonly<Record<number, Temps>>

/** Le temps qu'il fait en gare de `annee` ; nul pour une gare sans météo. */
export const tempsDeLaGare = (annee: number, table: Table = METEO): Temps | null => table[annee] ?? null

/**
 * La force de chaque temps, de 0 à 1 : pleine en gare, elle s'efface de 30 % à 56 % du chemin vers
 * la gare voisine (maquette, l. 3722-3723). Nulle pendant tout le passage de la foire au train
 * (avant la gare de 1900), quelle que soit la table : rien de ce qui suit l'horloge ne s'y montre.
 */
export function forceDuTemps(avance: number, table: Table = METEO): Record<Temps, number> {
  const force: Record<Temps, number> = { pluie: 0, neige: 0 }
  if (avance < B1) return force
  const pg = rangSurLaLigne(avance)
  for (const [annee, temps] of Object.entries(table)) {
    // Une année hors de la ligne a le rang -1, à une gare au moins du train : elle ne donne rien.
    const i = ANNEES.indexOf(Number(annee))
    force[temps] = Math.max(force[temps], 1 - lisse(0.3, 0.56, Math.abs(pg - i)))
  }
  return force
}

/**
 * Ce que la météo montre, chaque part de 0 à 1 : ce qui tombe (`pluie`, `neige`) garde sa force sous
 * la lanterne rouge ; le voile de pluie y perd la moitié (maquette, l. 3725). **Écart à la
 * maquette**, qui laisse 20 % du voile de neige et du sol blanchi sous la lanterne (l. 3727) : ici
 * rien, pour ne pas ajouter une passe plein écran là où la fluidité est à juger.
 */
export function partsDuTemps(v: Pick<VueMonde, 'avance' | 'cases' | 'ouverte' | 't' | 'vivant'>, table: Table = METEO): { pluie: number; voileDePluie: number; neige: number; voileDeNeige: number } {
  const force = forceDuTemps(v.avance, table)
  if (force.pluie <= 0 && force.neige <= 0) return { pluie: 0, voileDePluie: 0, neige: 0, voileDeNeige: 0 }
  const voile = voileDuLaboratoire(v)
  return { pluie: force.pluie, voileDePluie: force.pluie * (1 - 0.5 * voile), neige: force.neige, voileDeNeige: force.neige * (1 - voile) }
}

/** Un motif répété qui glisse : sa tuile, de combien elle glisse par boucle, et la durée d'une boucle en millisecondes. */
export interface Plan {
  l: number
  h: number
  dx: number
  dy: number
  duree: number
}

/** La pluie (maquette : `.m-pluie`, `m-tombe`, l. 1080-1081). */
export const PLUIE: Plan = { l: 120, h: 160, dx: -30, dy: 160, duree: AVERSE }
/** Les trois plans de neige, du plus lointain au plus proche (maquette : `.m-neige`, l. 1082-1087). */
export const NEIGE: readonly Plan[] = [
  { l: 80, h: 160, dx: -80, dy: 160, duree: FLOCONS_LOIN },
  { l: 110, h: 220, dx: -110, dy: 220, duree: FLOCONS_MOYENS },
  { l: 160, h: 320, dx: -160, dy: 320, duree: FLOCONS_PROCHES },
]

const part = (x: number): number => ((x % 1) + 1) % 1

/**
 * De combien le motif d'un plan a glissé, en pixels. Au calme, rien : le motif est posé, il ne
 * tombe pas. Vivant, il suit l'horloge du décor et reprend à zéro à chaque boucle.
 */
export function glissement(plan: Plan, v: Pick<VueMonde, 't' | 'vivant'>): { dx: number; dy: number } {
  if (!v.vivant) return { dx: 0, dy: 0 }
  const p = part((v.t * 1000) / plan.duree)
  return { dx: plan.dx * p, dy: plan.dy * p }
}

/**
 * Les onze gouttes de la vitre (maquette, l. 3566-3570) : où chacune se tient, en parts de l'écran
 * (la maquette pose `--y` en pixels d'un écran de 760), sa durée, son décalage, sa traînée.
 */
export const GOUTTES: ReadonlyArray<{ x: number; y: number; duree: number; decalage: number; trainee: number }> = Array.from({ length: 11 }, (_, k) => ({
  x: (4 + alea(k + 500) * 90) / 100,
  y: Math.round(150 + alea(k + 520) * 380) / 760,
  duree: lerp(RUISSELLEMENT_VIF, RUISSELLEMENT_LENT, alea(k + 540)),
  decalage: alea(k + 560) * DECALAGE_DES_GOUTTES,
  trainee: Math.round(30 + alea(k + 580) * 60),
}))

/** Le moment du ruissellement où la goutte se tient à sa place (maquette : `m-ruisselle`, 58 %). */
const REPOS = 0.58

/**
 * La goutte de rang `k` à l'écran (maquette : `m-ruisselle`, l. 1091-1098) : elle entre par le
 * haut, hésite à mi-chemin, se tient à sa place, puis file sous l'écran et recommence. Au calme,
 * elle se tient à sa place, à tout instant : elle se voit, elle ne coule pas. Entre deux moments,
 * une droite : la maquette y met une courbe d'accélération, que le trait ne reprend pas.
 */
export function goutteALEcran(v: Pick<VueMonde, 'W' | 'H' | 't' | 'vivant'>, k: number): { x: number; y: number; trainee: number } {
  const g = GOUTTES[k]!
  const y = g.y * v.H
  const p = v.vivant ? part((v.t * 1000 + g.decalage) / g.duree) : REPOS
  const moments: ReadonlyArray<readonly [number, number, number]> = [[0, -70, 0], [0.22, 0.5 * y, 2], [0.34, 0.54 * y, 2], [REPOS, y, -3], [0.66, y + 10, -3], [1, v.H + 80, 3]]
  const i = Math.max(1, moments.findIndex((m) => m[0] >= p))
  const a = moments[i - 1]!
  const b = moments[i]!
  const f = (p - a[0]) / (b[0] - a[0])
  return { x: g.x * v.W + lerp(a[2], b[2], f), y: lerp(a[1], b[1], f), trainee: g.trainee }
}
