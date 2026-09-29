import type { Rgb } from './outils'

/**
 * La rampe d'un monde (maquette du 29 septembre 2026 : `SEP`, `rgb`, `C`). Chaque couleur du
 * dessin y passe : sa luminance choisit une teinte sur quatre paliers, mêlée à `part`, le reste
 * gardant la couleur d'origine. Le corail n'y passe jamais : le moteur le pose tel quel, en
 * dernier (spec, « Le rendu »).
 */
export type Paliers = readonly [Rgb, Rgb, Rgb, Rgb]

export interface Rampe {
  /** `#rrggbb` au goût du monde, en `rgb(…)` ou, sous une opacité de 1, en `rgba(…)`. */
  couleur: (hex: string, alpha?: number) => string
  /** La même, en composantes : les dégradés que le moteur mêle d'un monde à l'autre. */
  rgb: (hex: string) => Rgb
}

const hexVersRgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

export function creerRampe(paliers: Paliers, part: number): Rampe {
  const cache = new Map<string, Rgb>()
  const rgb = (hex: string): Rgb => {
    const deja = cache.get(hex)
    if (deja) return deja
    const o = hexVersRgb(hex)
    const L = (0.2126 * o[0] + 0.7152 * o[1] + 0.0722 * o[2]) / 255
    const p = L * 3
    const i = Math.min(2, Math.floor(p))
    const f = p - i
    const bas = paliers[i]!
    const haut = paliers[i + 1]!
    const v = [0, 1, 2].map((k) => Math.round((bas[k]! + (haut[k]! - bas[k]!) * f) * part + o[k]! * (1 - part)))
    const r: Rgb = [v[0]!, v[1]!, v[2]!]
    cache.set(hex, r)
    return r
  }
  return {
    rgb,
    couleur: (hex, alpha = 1) => {
      const v = rgb(hex)
      return alpha >= 1 ? `rgb(${v.join(',')})` : `rgba(${v.join(',')},${Math.max(0, alpha)})`
    },
  }
}
