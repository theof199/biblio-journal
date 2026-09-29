import type { VueMonde } from '../types'
import { c } from './couleur'
import { LARGEUR } from './moyen'
import { hash, TAU } from '../../carte/outils'

/** La hauteur de la section 1890 (`trace1890`) : le dégradé du ciel la couvre en entier. */
const HAUTEUR = 1240
/** Jusqu'où le ciel monte au-dessus de sa section : plus que le vide que la carte laisse en haut (`MARGE_HAUT`). */
const VIDE_DU_HAUT = 400

const CIEL_N: readonly [string, string, string] = ['#1b1116', '#3a2a1e', '#2e2117']
const CIEL_J: readonly [string, string, string] = ['#b9a27e', '#a58a64', '#6e5a40']
const ETOILES = Array.from({ length: 46 }, (_, i) => ({
  x: hash(i * 3.1),
  y: hash(i * 7.7 + 1),
  r: 0.5 + hash(i * 1.3) * 1.1,
  p: hash(i * 5.5) * TAU,
  v: 0.6 + hash(i * 2.2) * 1.6,
}))

const cercle = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  g.beginPath()
  g.arc(x, y, Math.max(0, r), 0, TAU)
  g.fill()
}
const halo = (g: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a: number): void => {
  if (a <= 0.005) return
  g.save()
  g.globalCompositeOperation = 'lighter'
  const h = g.createRadialGradient(x, y, 0, x, y, r)
  h.addColorStop(0, c(hex, a))
  h.addColorStop(1, c(hex, 0))
  g.fillStyle = h
  cercle(g, x, y, r)
  g.restore()
}

/** Le soleil ou la lune, selon l'heure (maquette : `astre`). */
export function astre(g: CanvasRenderingContext2D, v: VueMonde, x: number, y: number, r: number): void {
  const nk = v.nuit
  if (nk < 0.99) {
    g.globalAlpha = 1 - nk
    halo(g, x, y, r * 3.2, '#FFF1CC', 0.35)
    const d = g.createRadialGradient(x - r * 0.2, y - r * 0.2, 1, x, y, r)
    d.addColorStop(0, c('#FFFBEF')); d.addColorStop(1, c('#EBD6A8'))
    g.fillStyle = d
    cercle(g, x, y, r * 0.9)
    g.globalAlpha = 1
  }
  if (nk > 0.01) {
    g.globalAlpha = nk
    halo(g, x, y, r * 2.6, '#F2E2BE', 0.16)
    const d = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
    d.addColorStop(0, c('#F6ECD4')); d.addColorStop(1, c('#BDA57B'))
    g.fillStyle = d
    cercle(g, x, y, r)
    g.fillStyle = c('#6E583A', 0.22)
    for (const [ux, uy, s] of [[-0.4, 0.35, 0.16], [0.35, 0.45, 0.12], [0.1, -0.5, 0.1]] as const) cercle(g, x + ux * r, y + uy * r, s * r)
    g.fillStyle = c(CIEL_N[0], 0.9)
    cercle(g, x + r * 0.55, y - r * 0.2, r * 0.92)
    g.globalAlpha = 1
  }
}

/** Le ciel : le dégradé jour/nuit de la baraque foraine, les étoiles, la poussière, le soleil ou la lune. */
export function dessinerCiel(v: VueMonde): void {
  if (v.presence <= 0.01) return
  const g = v.ctx
  g.save(); g.translate(0, v.ecranY(0, 1)); g.scale(v.k, 1)
  for (const [cols, a] of [[CIEL_J, 1], [CIEL_N, v.nuit]] as const) {
    if (a <= 0.01) continue
    const gr = g.createLinearGradient(0, 0, 0, HAUTEUR)
    gr.addColorStop(0, c(cols[0]))
    gr.addColorStop(Math.min(0.5, 260 / HAUTEUR), c(cols[1]))
    gr.addColorStop(1, c(cols[2]))
    g.globalAlpha = a
    g.fillStyle = gr
    // Le dégradé déborde au-dessus de la section : la carte laisse un vide en haut du Voyage, que le ciel remplit (son premier arrêt se prolonge).
    g.fillRect(-8, -VIDE_DU_HAUT, LARGEUR + 16, HAUTEUR + VIDE_DU_HAUT + 8)
  }
  g.globalAlpha = 1
  if (v.nuit > 0.05) {
    for (const e of ETOILES) {
      g.globalAlpha = v.nuit * (1 - e.y) * 0.6 * (v.vivant ? 0.55 + 0.45 * Math.sin(v.t * e.v + e.p) : 0.8)
      g.fillStyle = c('#F2E8D5')
      g.fillRect(e.x * LARGEUR, e.y * 150, e.r, e.r)
    }
  }
  g.globalAlpha = 1
  // Les soixante-dix traits de poussière du sol (maquette : `dessinCarte`).
  g.fillStyle = c('#000000', 0.16)
  for (let i = 0; i < 70; i++) {
    const x = hash(i * 9.1 + 3) * LARGEUR
    const y = 200 + hash(i * 4.3 + 3) * (HAUTEUR - 200)
    g.fillRect(x, y, 3 + hash(i) * 5, 1.2)
  }
  astre(g, v, 40, 46, 14)
  g.restore()
}
