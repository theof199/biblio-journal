import { clamp, lerp, lisse } from './outils'

/**
 * La part du voile de nuit que le moteur pose, de 0 à 1 : le poids de mélange (`poidsSections`) des
 * mondes qui ne portent pas leur propre heure (`Monde.porteSonHeure`). 1 sur la foire, 0 dans le
 * train de 1900, et entre les deux la part de l'écran que la foire tient encore : le voile se lève
 * à mesure que le train entre, sans saut.
 */
export function partDuVoileDeNuit(poids: readonly number[], porteSonHeure: readonly boolean[]): number {
  return clamp(poids.reduce((somme, p, i) => (porteSonHeure[i] ? somme : somme + p), 0), 0, 1)
}

/** La lumière selon l'heure du visiteur, de 0 à 24 (maquette : `calculerHeure`). */
export function ambianceDeLHeure(h: number) {
  const nuit = h < 5 ? 1 : h < 8 ? 1 - lisse(5, 8, h) : h < 17.5 ? 0 : h < 21.5 ? lisse(17.5, 21.5, h) : 1
  const crep = clamp(Math.max(0, 1 - Math.abs(h - 19.3) / 1.7) + 0.7 * Math.max(0, 1 - Math.abs(h - 6.5) / 1.3), 0, 1)
  return { nuit, crep, nuitF: lisse(0.5, 1, nuit), jourF: lisse(0.5, 0, nuit), lum: lerp(0.45, 1.3, nuit) }
}
