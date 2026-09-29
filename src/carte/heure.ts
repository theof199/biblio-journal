import { clamp, lerp, lisse } from './outils'

/** La lumière selon l'heure du visiteur, de 0 à 24 (maquette : `calculerHeure`). */
export function ambianceDeLHeure(h: number) {
  const nuit = h < 5 ? 1 : h < 8 ? 1 - lisse(5, 8, h) : h < 17.5 ? 0 : h < 21.5 ? lisse(17.5, 21.5, h) : 1
  const crep = clamp(Math.max(0, 1 - Math.abs(h - 19.3) / 1.7) + 0.7 * Math.max(0, 1 - Math.abs(h - 6.5) / 1.3), 0, 1)
  return { nuit, crep, nuitF: lisse(0.5, 1, nuit), jourF: lisse(0.5, 0, nuit), lum: lerp(0.45, 1.3, nuit) }
}
