// Repris de la maquette v2 (`docs/maquettes/carte-v2.html`, « Outils »), typés.
export const TAU = Math.PI * 2
export type Rgb = readonly [number, number, number]
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lisse = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const mixc = (c1: Rgb, c2: Rgb, t: number): Rgb =>
  [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))]
export const rgba = (c: Rgb, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const ressort = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
export const alea = (graine: number) => () => {
  graine = (graine + 0x6d2b79f5) | 0
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
