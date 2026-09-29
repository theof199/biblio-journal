import { lerp } from './outils'

/**
 * La route : une Catmull-Rom échantillonnée tous les 5 px environ, et sa longueur cumulée — la
 * « PathMeasure » maison de la maquette (`construireRoute`, `pointA`). Pure : le `Path2D` se
 * construit au rendu, à partir de `pts`.
 */
export interface PointRoute {
  x: number
  y: number
  d: number
}
export interface Route {
  pts: PointRoute[]
  /** La distance le long de la route de chaque point de passage, dans l'ordre. */
  dWay: number[]
}

/** `k` : l'échelle horizontale (largeur de l'écran / 390) ; les y ne s'échelonnent pas. */
export function construireRoute(points: ReadonlyArray<readonly [number, number]>, k: number): Route {
  const P = points.map(([x, y]) => [x * k, y] as const)
  if (P.length === 0) return { pts: [], dWay: [] }
  const pts: PointRoute[] = []
  const idx: number[] = []
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]!
    const p1 = P[i]!
    const p2 = P[i + 1]!
    const p3 = P[Math.min(P.length - 1, i + 2)]!
    idx[i] = pts.length
    const n = Math.max(6, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 5))
    for (let j = 0; j < n; j++) {
      const u = j / n
      const u2 = u * u
      const u3 = u2 * u
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3)
      pts.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]), d: 0 })
    }
  }
  const dernier = P[P.length - 1]!
  idx[P.length - 1] = pts.length
  pts.push({ x: dernier[0], y: dernier[1], d: 0 })
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    b.d = a.d + Math.hypot(b.x - a.x, b.y - a.y)
  }
  return { pts, dWay: idx.map((i) => pts[i]!.d) }
}

/** Le point à la distance `d` le long de la route, bornée aux deux bouts. */
export function pointA(route: Route, d: number): { x: number; y: number } {
  const { pts } = route
  const premier = pts[0]
  const dernier = pts[pts.length - 1]
  if (!premier || !dernier) return { x: 0, y: 0 }
  if (d <= 0) return premier
  if (d >= dernier.d) return dernier
  let lo = 0
  let hi = pts.length - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (pts[m]!.d < d) lo = m
    else hi = m
  }
  const a = pts[lo]!
  const b = pts[hi]!
  const u = (d - a.d) / (b.d - a.d || 1)
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) }
}
