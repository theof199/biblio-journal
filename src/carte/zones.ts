/**
 * Les zones touchables, recalculées à chaque image : le décor, les cases, l'avatar s'y
 * inscrivent pendant qu'ils se dessinent (maquette : `zone`, `zoneIci`, `trouverZone`).
 */
export interface Zone {
  id: string
  x: number
  y: number
  r: number
  data: number | null
  prio: number
  /**
   * Le rang de la section qui a inscrit la zone, dans le plan : le monde à qui elle appartient. Le
   * `y` de carte du doigt ne le dit pas : une section collante ne glisse pas, et ce que son monde
   * pose en haut de l'écran tombe sur la section d'avant.
   */
  section?: number
}

/** 44 px de diamètre : la cible tactile minimale de la spec (« Le rendu et les principes »). La maquette posait 20. */
export const RAYON_MIN = 22

export interface Matrice {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/** Un point du repère courant du contexte, en px CSS de l'écran (la matrice porte le `DPR`). */
export function ecranDe(m: Matrice, dpr: number, lx: number, ly: number) {
  return { x: (m.a * lx + m.c * ly + m.e) / dpr, y: (m.b * lx + m.d * ly + m.f) / dpr }
}

/** Un rayon du repère courant, en px CSS, jamais sous `RAYON_MIN`. */
export function rayonEcran(m: Matrice, dpr: number, lr: number) {
  return Math.max(RAYON_MIN, (lr * Math.hypot(m.a, m.b)) / dpr)
}

/** La zone touchée : la plus proche relativement à son rayon, la priorité l'emportant d'abord. */
export function trouverZone(zones: readonly Zone[], x: number, y: number): Zone | null {
  let meilleure: Zone | null = null
  let score = Infinity
  for (const z of zones) {
    const d = Math.hypot(x - z.x, y - z.y)
    if (d > z.r) continue
    const s = d / z.r - z.prio * 10
    if (s < score) {
      score = s
      meilleure = z
    }
  }
  return meilleure
}
