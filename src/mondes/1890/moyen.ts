import type { VueMonde } from '../types'
import { c } from './couleur'
import { clamp, ease, hash, lisse, TAU } from '../../carte/outils'
import { chantier, avancement, ELEMENTS } from './chantier'
import { quantites, remplissage, ampoules as ampoulesDe } from './foire'
import { imageDu1890 } from './images'

const F_A = "Limelight, Didot, Georgia, serif"
const LUM = 1.15
/**
 * La largeur de la section en coordonnées locales. Le moteur pose `x × k` avec `k = W / 390` :
 * la maquette, qui faisait 390 de large, écrivait `W` pour elle ; ici, `v.W` est l'écran.
 */
export const LARGEUR = 390
/**
 * Pendant l'adieu, tout ce qui s'allume s'éteint (maquette : `EXTINCTION`, lue par `lampion` et
 * `lanterneMagique`) : les guirlandes, la baraque, ses ampoules, le manège, la lanterne magique.
 */
export const extinction = (v: VueMonde): number => (v.adieu < 0 ? 1 : 1 - lisse(0, 1.6, v.adieu))
/** Le moment où le manège de 1898 est assez monté pour s'emballer (maquette : `D.carrV = 0` tant que `k98` < 0,93). */
const MANEGE_PRET = 0.93 * (ELEMENTS.find((e) => e.annee === 1898)?.duree ?? 0)
const LAMPIONS: readonly string[] = ['#E6B94A', '#DE7A45', '#F2E8D5']
const FANIONS: readonly string[] = ['#A8452F', '#D9B382', '#E6B94A', '#3E5360']
const TYPES: readonly string[] = ['homme', 'femme', 'enfant', 'homme', 'ombrelle', 'femme', 'homme']

/** La baraque foraine (coordonnées de la section 1890 : maquette, `B_TOP`, `B_SOL`, `B_X0`, `B_X1`, `B_CX`). */
const B_TOP = 96
const B_SOL = 214
const B_X0 = 217
const B_X1 = 383
const B_CX = 300
/** Le fronton des cinq ampoules (`top + 46`) : où se pose le billet volant de `proches.ts`. */
export const AMPOULE_Y = B_TOP + 46

const PL = { n: 64, col: 8, w: 256, h: 196 }

// ---------- Primitives (maquette : « Primitives », recopiées dans chaque fichier qui en a besoin) ----------
export const cercle = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  g.beginPath()
  g.arc(x, y, Math.max(0, r), 0, TAU)
  g.fill()
}
export const poly = (g: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>): void => {
  g.beginPath()
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
}
export const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  g.beginPath()
  g.moveTo(x + r, y)
  g.lineTo(x + w - r, y)
  g.quadraticCurveTo(x + w, y, x + w, y + r)
  g.lineTo(x + w, y + h - r)
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  g.lineTo(x + r, y + h)
  g.quadraticCurveTo(x, y + h, x, y + h - r)
  g.lineTo(x, y + r)
  g.quadraticCurveTo(x, y, x + r, y)
  g.closePath()
}
export const ombre = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.4): void => {
  g.fillStyle = `rgba(0,0,0,${a})`
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, TAU)
  g.fill()
}
export const halo = (g: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a: number): void => {
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
export const texte = (g: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, coul: string, align: CanvasTextAlign = 'center'): void => {
  g.font = font
  g.fillStyle = coul
  g.textAlign = align
  g.textBaseline = 'alphabetic'
  g.fillText(s, x, y)
}
/** La plaque d'une année ou d'un écriteau (maquette : `plaque`). */
export function plaque(g: CanvasRenderingContext2D, x: number, y: number, s: string, fond: string, encre: string, bord?: string): void {
  g.font = "600 11.5px 'Fraunces', Georgia, serif"
  const w = Math.max(40, g.measureText(s).width + 16)
  g.fillStyle = 'rgba(0,0,0,.35)'
  rr(g, x - w / 2 + 1, y + 2, w, 18, 9)
  g.fill()
  g.fillStyle = fond
  rr(g, x - w / 2, y, w, 18, 9)
  g.fill()
  if (bord) {
    g.strokeStyle = bord
    g.lineWidth = 1
    g.stroke()
  }
  texte(g, s, x, y + 13, g.font, encre)
}

function corps(g: CanvasRenderingContext2D, type: string, sw: number, bob: number): void {
  const y = -bob
  if (type === 'femme' || type === 'ombrelle') {
    poly(g, [[-4.4 + sw * 0.5, 0], [4.4 + sw * 0.5, 0], [1.9, -9 + y], [-1.9, -9 + y]])
    g.fill()
    poly(g, [[-1.9, -9 + y], [1.9, -9 + y], [1.5, -14 + y], [-1.5, -14 + y]])
    g.fill()
    cercle(g, 0, -15.8 + y, 1.9)
    g.beginPath(); g.ellipse(0.3, -17.2 + y, 3.4, 0.9, -0.1, 0, TAU); g.fill()
    g.beginPath(); g.moveTo(1.2, -12.5 + y); g.lineTo(3 + sw, -8 + y); g.stroke()
    if (type === 'ombrelle') {
      g.lineWidth = 0.8
      g.beginPath(); g.moveTo(1.4, -12 + y); g.lineTo(3.4, -25 + y); g.stroke()
      g.beginPath(); g.arc(3.4, -24 + y, 6.4, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill()
    }
    return
  }
  g.beginPath(); g.moveTo(-0.5, -7.5 + y); g.lineTo(-0.5 - sw * 2.6, 0); g.moveTo(0.5, -7.5 + y); g.lineTo(0.5 + sw * 2.6, 0); g.stroke()
  poly(g, [[-2.6, -7.2 + y], [2.6, -7.2 + y], [3, -14.3 + y], [-3, -14.3 + y]])
  g.fill()
  cercle(g, 0, -16.3 + y, 1.9)
  if (type === 'penche') {
    g.beginPath(); g.moveTo(1.5, -13 + y); g.lineTo(5.5, -9 + y); g.stroke()
    return
  }
  g.beginPath(); g.moveTo(0, -13.4 + y); g.lineTo(-sw * 2.2, -8.4 + y); g.stroke()
  if (type === 'homme') { g.fillRect(-1.6, -21.6 + y, 3.2, 4); g.fillRect(-2.7, -18.4 + y, 5.4, 0.9) }
  else if (type === 'enfant') g.fillRect(-2, -18.2 + y, 3.8, 1.3)
}

/** Une silhouette (maquette : `silhouette`) : un rehaut chaud la nuit, sous sa couleur pleine. */
export function silhouette(g: CanvasRenderingContext2D, v: VueMonde, x: number, y: number, h: number, type: string, ph: number, marche: boolean, dir: number, coul = '#0c0806'): void {
  const s = h / 18
  g.save(); g.translate(x, y)
  ombre(g, 0, 0, 5 * s, 1.5 * s, 0.38)
  g.scale(dir * s, s)
  const sw = marche ? Math.sin(ph) : 0
  const bob = marche ? Math.abs(Math.cos(ph)) * 0.7 : 0
  g.lineCap = 'round'
  g.lineWidth = 1.5
  g.save(); g.translate(-0.8, -0.5); g.fillStyle = g.strokeStyle = c('#F6E2BA', 0.3 * (0.4 + 0.6 * v.nuit)); corps(g, type, sw, bob); g.restore()
  g.fillStyle = g.strokeStyle = c(coul)
  corps(g, type, sw, bob)
  g.restore()
}

function cheval(g: CanvasRenderingContext2D, ph: number): void {
  const b = Math.sin(ph * 2) * 0.8
  g.lineWidth = 1.4
  g.lineCap = 'round'
  g.beginPath(); g.ellipse(0, b, 8.5, 3.4, 0, 0, TAU); g.fill()
  poly(g, [[5, -1 + b], [9.5, -8 + b], [12, -7 + b], [8.5, 1 + b]]); g.fill()
  g.beginPath(); g.ellipse(12.8, -7 + b, 3.4, 1.6, 0.45, 0, TAU); g.fill()
  g.beginPath(); g.moveTo(-8, -1 + b); g.quadraticCurveTo(-12, -1, -12.5, 4 + b); g.stroke()
  for (const [hx, p] of [[-5.5, 0], [-4, 1.7], [5, 3.1], [6.5, 4.8]] as const) {
    const an = Math.sin(ph + p) * 0.75
    g.beginPath(); g.moveTo(hx, 2 + b); g.lineTo(hx + Math.sin(an) * 7.5, 2 + b + Math.cos(an) * 7.5); g.stroke()
  }
}

/** Un groupe de figurants (maquette : `foule`). */
export function foule(g: CanvasRenderingContext2D, v: VueMonde, n: number, x0: number, x1: number, y0: number, graine: number, taille = 13): void {
  for (let j = 0; j < n; j++) {
    const x = x0 + (x1 - x0) * hash(j * 3.7 + graine)
    const y = y0 + hash(j * 5.3 + graine) * 10
    const ty = TYPES[(j + graine) % 7]!
    const pi = v.vivant ? Math.sin(v.t * 1.3 + j * 2.1) * 0.7 : 0
    silhouette(g, v, x + pi, y, ty === 'enfant' ? taille * 0.72 : taille, ty, 0, false, hash(j + graine) < 0.5 ? -1 : 1)
  }
}

/** Une guirlande de fanions ou de lampions (maquette : `guirlande`). */
export function guirlande(g: CanvasRenderingContext2D, v: VueMonde, x0: number, y0: number, x1: number, y1: number, creux: number, n: number, type: 'fanion' | 'lampion', on: number): void {
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2 + creux
  const q = (u: number): [number, number] => [
    (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1,
    (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1,
  ]
  g.strokeStyle = c('#080604', 0.95)
  g.lineWidth = 1.1
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke()
  for (let i = 1; i <= n; i++) {
    const [px, py] = q(i / (n + 1))
    if (type === 'fanion') {
      const sw = v.vivant ? Math.sin(v.t * 2.2 + i * 0.8) * 2.4 : 0
      g.fillStyle = c(FANIONS[i % 4]!)
      poly(g, [[px - 5.5, py - 1], [px + 5.5, py - 1], [px + sw, py + 13]]); g.fill()
      g.fillStyle = 'rgba(0,0,0,.25)'
      poly(g, [[px + 0.5, py - 1], [px + 5.5, py - 1], [px + sw, py + 13]]); g.fill()
    } else {
      g.fillStyle = c('#0a0806')
      g.fillRect(px - 0.5, py, 1, 3)
      lampion(g, v, px, py + 6, 3, i, null, on)
    }
  }
}

/**
 * Un lampion (maquette : `lampion`) : sa lueur chaude la nuit, éteinte pendant l'adieu
 * (`extinction`). `nuitMin` : une ampoule de la baraque brille même le jour (maquette :
 * `NK = Math.max(NK, .55)`).
 */
export function lampion(g: CanvasRenderingContext2D, v: VueMonde, x: number, y: number, r: number, i: number, pal: readonly string[] | null, on: number, nuitMin = 0): void {
  const L = Math.max(v.nuit, nuitMin) * on * extinction(v)
  const tw = v.vivant ? 0.55 + 0.45 * Math.sin(v.t * 2.6 + i * 1.9) : 0.85
  const col = (pal ?? LAMPIONS)[i % 3]!
  const ba = g.globalAlpha
  g.fillStyle = c(col)
  if (L > 0.02) {
    g.globalCompositeOperation = 'lighter'
    g.globalAlpha = Math.min(1, ba * tw * 0.24 * LUM * L)
    cercle(g, x, y, r * 2.8)
    g.globalCompositeOperation = 'source-over'
  }
  g.globalAlpha = Math.min(1, ba * ((0.55 + 0.45 * tw) * L + (1 - L) * 0.62))
  cercle(g, x, y, r)
  if (L < 0.5) {
    g.globalAlpha = ba * 0.5
    g.strokeStyle = c('#3a2819')
    g.lineWidth = 0.6
    g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.stroke()
  }
  g.globalAlpha = ba
}

function bonimenteur(g: CanvasRenderingContext2D, v: VueMonde, x: number, y: number, sc = 1.3): void {
  g.save(); g.translate(x, y); g.scale(sc, sc)
  ombre(g, 0, 0, 6, 1.6, 0.38)
  g.fillStyle = g.strokeStyle = c('#0c0806')
  g.lineCap = 'round'
  g.lineWidth = 1.6
  g.beginPath(); g.moveTo(-1.5, -8); g.lineTo(-2.5, 0); g.moveTo(1.5, -8); g.lineTo(2.5, 0); g.stroke()
  poly(g, [[-3.6, -7], [3.6, -7], [3, -17], [-3, -17]]); g.fill()
  cercle(g, 0, -19.5, 2.2)
  g.fillRect(-2, -27.5, 4, 6)
  g.fillRect(-3.4, -22, 6.8, 1)
  g.lineWidth = 0.9
  g.beginPath(); g.moveTo(-3, -13); g.lineTo(-6, 0); g.stroke()
  // Le bras au repos : ce qui montre la case touchée (`D.pointe`) n'est pas porté (l'aperçu de la page en tient lieu).
  const an = -1.9 + (v.vivant ? Math.sin(v.t * 2.4) * 0.45 : 0)
  g.lineWidth = 1.5
  g.beginPath(); g.moveTo(1.5, -15.5); g.lineTo(1.5 + Math.cos(an) * 8, -15.5 + Math.sin(an) * 8); g.stroke()
  g.restore()
}

/** Le cycle du rideau : reparti à zéro par un toucher récent (`v.age('rideau')`), sinon continu. */
const cycleRideau = (v: VueMonde): number => {
  if (!v.vivant) return 4.5
  const age = v.age('rideau')
  return age < 99 ? (age + 1) % 9 : (((v.t + 1.5) % 9) + 9) % 9
}
const rideauOuverture = (v: VueMonde): number => {
  if (!v.vivant) return 0.9
  const cy = cycleRideau(v)
  return lisse(1, 2, cy) * (1 - lisse(7, 8, cy))
}

/** Le dessin à la main du train, le temps que la planche se décode (maquette : `trainDessine`). */
function trainDessine(g: CanvasRenderingContext2D, v: VueMonde, sx: number, sy: number, sw: number, sh: number, k: number, fond: boolean): void {
  const frame = Math.floor(v.t * 16)
  const fl = v.vivant ? 0.9 + 0.1 * hash(frame * 2.3) : 1
  if (fond) { g.fillStyle = c('#E8DFC8', fl); g.fillRect(sx, sy, sw, sh) }
  const vx = sx + sw * 0.74
  const vy = sy + sh * 0.4
  g.strokeStyle = c('#5a5040', 0.8)
  g.lineWidth = Math.max(0.8, sw / 90)
  g.beginPath(); g.moveTo(vx, vy); g.lineTo(sx + sw * 0.1, sy + sh); g.moveTo(vx, vy); g.lineTo(sx + sw * 0.48, sy + sh); g.moveTo(vx + 2, vy); g.lineTo(sx + sw, sy + sh * 0.72); g.stroke()
  g.fillStyle = c('#8a8070', 0.7)
  poly(g, [[vx + 2, vy], [sx + sw, sy + sh * 0.62], [sx + sw, sy + sh * 0.72]]); g.fill()
  for (let i = 0; i < 4; i++) {
    const u = 0.15 + i * 0.2
    g.fillStyle = c('#3a3026', 0.7)
    g.fillRect(vx + 4 + (sx + sw * 0.98 - (vx + 4)) * u, vy - 2 + (sy + sh * 0.5 - (vy - 2)) * u - (16 * u * sh) / 46, 1.4, (16 * u * sh) / 46)
  }
  const s = (0.16 + k * k * 1.25) * (sw / 76)
  const x = vx - 2 + (sx + sw * 0.3 - (vx - 2)) * k
  const y = vy + (sy + sh * 0.84 - vy) * k
  g.save(); g.translate(x, y); g.scale(s, s)
  g.fillStyle = c('#2a241c'); rr(g, -22, -30, 30, 26, 3); g.fill()
  g.fillRect(4, -22, 16, 18)
  g.fillRect(-18, -40, 7, 11)
  g.fillStyle = c('#15120e'); cercle(g, -14, -3, 5); cercle(g, 0, -3, 5); cercle(g, 12, -3, 4)
  g.fillStyle = c('#F2E8D5', 0.8); g.fillRect(8, -19, 7, 6)
  g.restore()
  for (let j = 0; j < 3; j++) {
    const u = (k * 3 + j * 0.33) % 1
    g.fillStyle = c('#FFFFFF', 0.5 * (1 - u) * (k > 0 ? 1 : 0))
    cercle(g, x - 14 * s + u * 10, y - 42 * s - u * 16, (3 + u * 9) * Math.max(0.4, s))
  }
}

/** L'écran de la baraque (maquette : `projectionTrain`) : la planche du train si elle est décodée, sinon `trainDessine`. */
function projectionTrain(g: CanvasRenderingContext2D, v: VueMonde, sx: number, sy: number, sw: number, sh: number, k: number, fond = true): void {
  const url = imageDu1890('train.webp')
  const planche = url ? v.image(url) : null
  if (!planche) { trainDessine(g, v, sx, sy, sw, sh, k, fond); return }
  const frame = Math.floor(v.t * 16)
  const ga = g.globalAlpha
  const e = sw / 242
  const fl = v.vivant ? 0.9 + 0.1 * hash(frame * 2.3) : 1
  const i = Math.round(clamp(k, 0, 1) * (PL.n - 1))
  const ar = sw / sh
  const far = PL.w / PL.h
  let cw = PL.w - 2
  let ch = PL.h - 2
  if (ar > far) ch = cw / ar
  else cw = ch * ar
  const ox = (i % PL.col) * PL.w + 1 + (PL.w - 2 - cw) * 0.42
  const oy = Math.floor(i / PL.col) * PL.h + 1 + (PL.h - 2 - ch) * 0.3
  const saut = v.vivant && fond
  const jx = saut ? (hash(frame * 5.3) - 0.5) * 0.8 * e : 0
  const jy = saut ? (hash(frame * 6.1) - 0.5) * 1.6 * e : 0
  g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip()
  g.fillStyle = c('#0b0806'); g.fillRect(sx, sy, sw, sh)
  g.drawImage(planche, ox, oy, cw, ch, sx + jx, sy + jy - 1 * e, sw, sh + 2 * e)
  // le sépia de la planche, posé au dessin (règle de la tâche 6, « Comment ») : elle n'est pas virée.
  g.globalCompositeOperation = 'multiply'; g.fillStyle = c('#EADFC6'); g.fillRect(sx, sy, sw, sh)
  g.globalCompositeOperation = 'screen'; g.fillStyle = c('#1a120b'); g.fillRect(sx, sy, sw, sh)
  g.globalCompositeOperation = 'source-over'
  if (fond) {
    const mx = sx + sw * 0.5
    const my = sy + sh * 0.48
    let d = g.createRadialGradient(mx, my, 0, mx, my, Math.max(sw, sh) * 0.6)
    d.addColorStop(0, c('#FFF4DA', 0.1 * fl))
    d.addColorStop(1, c('#FFF4DA', 0))
    g.globalCompositeOperation = 'lighter'; g.fillStyle = d; g.fillRect(sx, sy, sw, sh); g.globalCompositeOperation = 'source-over'
    d = g.createRadialGradient(mx, my, Math.min(sw, sh) * 0.38, mx, my, Math.hypot(sw, sh) * 0.58)
    d.addColorStop(0, 'rgba(10,6,3,0)')
    d.addColorStop(1, 'rgba(10,6,3,.55)')
    g.fillStyle = d; g.fillRect(sx, sy, sw, sh)
    if (v.vivant) {
      g.fillStyle = `rgba(12,8,4,${((1 - fl) * 1.5).toFixed(3)})`
      g.fillRect(sx, sy, sw, sh)
      for (let j = 0; j < 3; j++) {
        if (hash(frame * 1.9 + j * 7) > 0.5) continue
        const x = sx + hash(frame * 3.1 + j) * sw
        const y = sy + hash(frame * 4.3 + j * 3) * sh
        g.fillStyle = hash(frame + j * 5) < 0.7 ? 'rgba(20,12,6,.75)' : c('#F6ECD6', 0.7)
        cercle(g, x, y, (0.45 + hash(frame * 2 + j) * 1.2) * e)
      }
      if (hash(frame * 0.61) < 0.08) {
        const x = sx + hash(frame * 0.9) * sw
        const y = sy + hash(frame * 1.7) * sh
        const l = (10 + hash(frame) * 16) * e
        g.strokeStyle = 'rgba(20,12,6,.6)'
        g.lineWidth = Math.max(0.5, 0.6 * e)
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.4, y - l * 0.5, x + l * 0.6, y + l * 0.6, x + l, y + l * 0.1); g.stroke()
      }
      const cyc = Math.floor(v.t / 1.9)
      if (hash(cyc * 5.3) < 0.7) {
        const x = sx + (0.12 + 0.76 * hash(cyc * 2.9)) * sw + (hash(frame) - 0.5) * 1.4 * e
        g.fillStyle = c('#F6ECD6', 0.16 + 0.12 * hash(frame * 1.3))
        g.fillRect(x, sy, Math.max(0.6, 0.7 * e), sh)
      }
    }
  }
  g.restore()
  g.globalAlpha = ga
}

/** La façade de la baraque, ouverte (maquette : `baraqueFacade`, sans ses deux états fermés : plan 2b). */
function baraqueFacade(g: CanvasRenderingContext2D, v: VueMonde, opts: { ampoules: readonly boolean[]; file: number; lampes: number; sansBoni: boolean }): void {
  const x0 = B_X0, x1 = B_X1, cx = B_CX, top = B_TOP, s0 = B_SOL
  ombre(g, cx, s0 + 4, 98, 9)
  g.strokeStyle = c('#2b1c14'); g.lineWidth = 2
  g.beginPath(); g.moveTo(cx, top - 24); g.lineTo(cx, 38); g.stroke()
  const w = v.vivant ? Math.sin(v.t * 5) * 2.5 : 0
  g.fillStyle = c('#A8452F')
  g.beginPath(); g.moveTo(cx, 38); g.quadraticCurveTo(cx + 9, 40 + w, cx + 18, 43 + w * 1.4); g.quadraticCurveTo(cx + 9, 47 + w, cx, 49); g.fill()
  g.fillStyle = c('#4a3321'); g.fillRect(x0, top + 6, x1 - x0, s0 - top - 6)
  g.strokeStyle = c('#2e2014', 0.8); g.lineWidth = 1
  for (let x = x0 + 8; x < x1; x += 11) { g.beginPath(); g.moveTo(x, top + 44); g.lineTo(x, s0 - 18); g.stroke() }
  const n = 9
  const wd = (x1 - x0 + 20) / n
  const toit = () => {
    g.beginPath(); g.moveTo(x0 - 10, top + 8); g.quadraticCurveTo(cx, top - 62, x1 + 10, top + 8)
    for (let i = 0; i < n; i++) { const xa = x1 + 10 - i * wd; g.quadraticCurveTo(xa - wd / 2, top + 22, xa - wd, top + 8) }
    g.closePath()
  }
  toit(); g.fillStyle = c('#E9DCC0'); g.fill()
  g.save(); toit(); g.clip(); g.fillStyle = c('#A8452F')
  for (let i = 0; i < 12; i += 2) {
    const a0 = x0 - 10 + (i * (x1 - x0 + 20)) / 12
    const a1 = a0 + (x1 - x0 + 20) / 12
    poly(g, [[cx, top - 44], [a0, top + 26], [a1, top + 26]]); g.fill()
  }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0 - 12, top + 2, x1 - x0 + 24, 30); g.restore()
  g.fillStyle = c('#20150d'); rr(g, x0 + 10, top + 12, x1 - x0 - 20, 26, 4); g.fill()
  g.strokeStyle = c('#E6B94A', 0.7); g.lineWidth = 1; g.stroke()
  texte(g, 'CINÉMATOGRAPHE', cx, top + 30, `13px ${F_A}`, c('#E6B94A'))
  for (let i = 0; i < 5; i++) {
    const bx = 270 + i * 15
    const by = top + 46
    g.fillStyle = c('#20150d')
    cercle(g, bx, by, 3.6)
    if (opts.ampoules[i]) lampion(g, v, bx, by, 2.5, 0, ['#F6D98A'], 1, 0.55)
    else { g.fillStyle = c('#F2E8D5', 0.16); cercle(g, bx, by, 2) }
  }
  const sx = 262, sy = top + 54, sw = 76, sh = 46
  const o = rideauOuverture(v)
  g.fillStyle = c('#0b0806'); g.fillRect(sx - 3, sy - 3, sw + 6, sh + 6)
  if (o > 0) {
    g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip()
    projectionTrain(g, v, sx, sy, sw, sh, clamp((cycleRideau(v) - 2) / 5, 0, 1))
    g.restore()
    halo(g, cx, sy + sh / 2, 70, '#F2E2BE', 0.14 * o * (0.4 + 0.6 * v.nuit))
  }
  const moitie = (sw / 2) * (1 - o * 0.92)
  for (const cote of [-1, 1] as const) {
    const bx = cote < 0 ? sx : sx + sw - moitie
    g.fillStyle = c('#8a2a20'); g.fillRect(bx, sy, moitie, sh)
    g.strokeStyle = c('#4a120e', 0.7); g.lineWidth = 1.2
    for (let k = 3; k < moitie; k += 5) { g.beginPath(); g.moveTo(bx + k, sy); g.lineTo(bx + k + cote * (1 - o) * 1.5, sy + sh); g.stroke() }
  }
  g.fillStyle = c('#7A1F1A')
  for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(sx + sw / 14 + (i * sw) / 7, sy - 1, sw / 14, 0, Math.PI); g.fill() }
  g.fillStyle = c('#5a3e26'); g.fillRect(x0 - 4, s0 - 18, x1 - x0 + 8, 18)
  g.fillStyle = c('#2e2014'); g.fillRect(x0 - 4, s0 - 18, x1 - x0 + 8, 3)
  g.fillStyle = c('#3a2819')
  for (let k = 0; k < 3; k++) g.fillRect(x0 - 16 + k * 4, s0 - 6 * (k + 1), 14, 6)
  for (let i = 0; i <= 9; i++) lampion(g, v, x0 - 10 + i * wd, top + 9, 2, i, null, clamp(opts.lampes * 10 - i, 0, 1))
  if (!opts.sansBoni) bonimenteur(g, v, 240, s0 - 18)
  for (let j = 0; j < opts.file; j++) {
    const bx = 228 + (j % 6) * 12 + (j >= 6 ? 6 : 0)
    const by = 232 + (j >= 6 ? 11 : 0) + (j % 2) * 3
    const ty = TYPES[j % 7]!
    const pi = v.vivant ? Math.sin(v.t * 1.4 + j * 2) * 0.8 : 0
    silhouette(g, v, bx + pi, by, ty === 'enfant' ? 10 : 13.5, ty, 0, false, -1)
  }
}

function echafaudage(g: CanvasRenderingContext2D, x0: number, x1: number, haut: number, s0: number, e: number): void {
  if (e <= 0.01) return
  const n = Math.max(2, Math.round((x1 - x0) / 30))
  const top = s0 - (s0 - haut) * e
  g.save(); g.lineCap = 'butt'
  g.strokeStyle = c('#8a6a44', 0.7); g.lineWidth = 0.8
  g.beginPath()
  for (let i = 0; i < n; i++) for (let y = s0, j = 0; y - 24 >= top; y -= 24, j++) {
    const xa = x0 + ((x1 - x0) * i) / n
    const xb = x0 + ((x1 - x0) * (i + 1)) / n
    if ((i + j) % 2) { g.moveTo(xa, y); g.lineTo(xb, y - 24) } else { g.moveTo(xb, y); g.lineTo(xa, y - 24) }
  }
  g.stroke()
  for (let y = s0 - 24; y > top + 3; y -= 24) { g.fillStyle = c('#5a3e26'); g.fillRect(x0 - 4, y - 2.5, x1 - x0 + 8, 3) }
  g.strokeStyle = c('#9a7a50'); g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; g.moveTo(x, s0); g.lineTo(x, top) }
  g.stroke()
  g.fillStyle = c('#2b1c14')
  for (let i = 0; i <= n; i++) for (let y = s0 - 24; y > top + 3; y -= 24) g.fillRect(x0 + ((x1 - x0) * i) / n - 1.5, y - 1.5, 3, 3)
  g.restore()
}

function echelle(g: CanvasRenderingContext2D, x: number, s0: number, h: number, e: number): void {
  if (e <= 0.01) return
  const hh = h * e
  const pen = 6 * e
  g.strokeStyle = c('#9a7a50'); g.lineWidth = 1.3
  g.beginPath()
  g.moveTo(x - 3, s0); g.lineTo(x - 3 - pen, s0 - hh); g.moveTo(x + 3, s0); g.lineTo(x + 3 - pen, s0 - hh)
  for (let y = 6; y < hh; y += 6) { const d = (pen * y) / hh; g.moveTo(x - 3 - d, s0 - y); g.lineTo(x + 3 - d, s0 - y) }
  g.stroke()
}

function ouvrier(g: CanvasRenderingContext2D, v: VueMonde, x: number, y: number, ph: number, geste: 'marche' | 'marteau' | 'porte' | 'tire', dir = 1): void {
  silhouette(g, v, x, y, 14, 'homme', ph, (geste === 'marche' || geste === 'porte') && v.vivant, dir)
  const s = 14 / 18
  g.save(); g.translate(x, y); g.scale(dir * s, s)
  g.strokeStyle = g.fillStyle = c('#0c0806')
  g.lineWidth = 1.5
  g.lineCap = 'round'
  if (geste === 'marteau') {
    const an = v.vivant ? -2.1 + Math.pow(Math.abs(Math.sin(v.t * 4 + ph)), 4) * 1.9 : -1.3
    const hx = Math.cos(an) * 7
    const hy = -13.4 + Math.sin(an) * 7
    g.beginPath(); g.moveTo(0.5, -13.4); g.lineTo(hx, hy); g.lineTo(hx + Math.cos(an) * 3, hy + Math.sin(an) * 3); g.stroke()
    g.save(); g.translate(hx + Math.cos(an) * 3, hy + Math.sin(an) * 3); g.rotate(an); g.fillRect(-1.2, -2.6, 2.4, 5.2); g.restore()
  } else if (geste === 'porte') {
    g.beginPath(); g.moveTo(0.5, -13.4); g.lineTo(3, -17); g.stroke()
    g.fillStyle = c('#8a6a44'); g.fillRect(-12, -18.6, 26, 2.4)
  } else if (geste === 'tire') {
    const b = v.vivant ? Math.sin(v.t * 3 + ph) * 2 : 0
    g.beginPath(); g.moveTo(0.5, -13.4); g.lineTo(3.5, -22 + b); g.moveTo(-0.5, -13.4); g.lineTo(1.5, -21 - b); g.stroke()
  }
  g.restore()
}

/** Une équipe d'ouvriers : elle arrive, grimpe à son poste, travaille, redescend et s'en va (sauf `reste`, tâche permanente). */
function equipe(g: CanvasRenderingContext2D, v: VueMonde, k: number, liste: ReadonlyArray<readonly [number, number, 'marteau' | 'porte' | 'tire', number]>, s0: number, reste = false): void {
  if (k <= 0 || (k >= 1 && !reste)) return
  liste.forEach(([x, y, geste, dir], j) => {
    const haut = s0 - y
    const a1 = lisse(0, 0.07, k)
    const a2 = lisse(0.07, 0.14, k)
    const d1 = reste ? 0 : lisse(0.86, 0.93, k)
    const d2 = reste ? 0 : lisse(0.93, 1, k)
    let xx = x - dir * (1 - a1 + d2) * 70
    const yy = s0 + (y - s0) * (a2 * (1 - d1))
    let sens = d1 > 0 ? -dir : dir
    const bouge = a1 < 1 || (haut > 0 && ((a2 > 0 && a2 < 1) || (d1 > 0 && d1 < 1))) || d2 > 0
    if (!bouge && geste === 'porte') {
      const u = v.t * 0.18 + j * 0.37
      const tri = 1 - Math.abs(((u % 1) + 1) % 1 * 2 - 1)
      xx += (tri - 0.5) * 36
      sens = ((u % 1) + 1) % 1 < 0.5 ? 1 : -1
    }
    ouvrier(g, v, xx, yy, v.t * 7 + j * 1.7, bouge ? 'marche' : geste, sens)
  })
}

/** La chute qui se pose : -1 en haut, 0 posé, un petit rebond à la fin (maquette : `posee`). */
const posee = (u: number): number => (u >= 1 ? 0 : u < 0.7 ? (u / 0.7) * (u / 0.7) - 1 : -Math.sin(((u - 0.7) / 0.3) * Math.PI) * 0.08)

/** 1895 : le drap tendu entre deux poteaux, le Cinématographe sur son trépied, quelques chaises. */
function seancePleinAir(g: CanvasRenderingContext2D, v: VueMonde, k: number, k96: number, file: number): void {
  const s0 = B_SOL, sx = 262, sy = 150, sw = 76, sh = 46
  const pot = lisse(0.08, 0.3, k)
  const drap = lisse(0.3, 0.55, k)
  const tre = lisse(0.45, 0.58, k)
  const boite = lisse(0.54, 0.66, k)
  const lampe = lisse(0.78, 0.88, k) * (1 - lisse(0.02, 0.12, k96))
  const range = lisse(0.02, 0.22, k96)
  if (pot > 0) {
    const hp = 70 * ease(pot)
    ombre(g, sx - 4, s0 + 1, 5, 1.6); ombre(g, sx + sw + 4, s0 + 1, 5, 1.6)
    g.strokeStyle = c('#2b1c14'); g.lineWidth = 2.5
    g.beginPath(); g.moveTo(sx - 4, s0); g.lineTo(sx - 4, s0 - hp); g.moveTo(sx + sw + 4, s0); g.lineTo(sx + sw + 4, s0 - hp); g.stroke()
  }
  if (drap > 0) {
    g.strokeStyle = c('#1c140c'); g.lineWidth = 0.8
    g.beginPath(); g.moveTo(sx - 4, sy - 4); g.lineTo(sx + sw + 4, sy - 4); g.stroke()
    const hh = sh * drap
    const w = v.vivant ? Math.sin(v.t * 1.7) * 1.6 : 0
    g.save()
    g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(sx + sw, sy - 3); g.lineTo(sx + sw, sy + hh); g.quadraticCurveTo(sx + sw / 2, sy + hh + w, sx, sy + hh); g.closePath(); g.clip()
    g.fillStyle = c('#E8DFC8'); g.fillRect(sx, sy - 3, sw, sh + 6)
    if (lampe > 0) { g.globalAlpha = lampe; projectionUsine(g, v, sx, sy, sw, sh); g.globalAlpha = 1 }
    g.strokeStyle = c('#8a7a60', 0.3); g.lineWidth = 1
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(sx + (i * sw) / 5, sy - 3); g.lineTo(sx + (i * sw) / 5 + w, sy + hh); g.stroke() }
    g.restore()
    if (drap < 1) { g.fillStyle = c('#cfc2a4'); rr(g, sx - 3, sy + hh - 3, sw + 6, 6, 3); g.fill(); g.fillStyle = c('#8a7a60'); g.fillRect(sx - 3, sy + hh - 0.5, sw + 6, 1) }
    g.fillStyle = c('#1c140c'); cercle(g, sx, sy - 3, 1.3); cercle(g, sx + sw, sy - 3, 1.3)
  }
  if (range < 1) {
    const PL2: ReadonlyArray<readonly [number, number]> = [[272, 223], [287, 223], [302, 223], [317, 223], [332, 223], [279, 231], [294, 231], [309, 231], [324, 231]]
    const assis = k >= 0.9 && range === 0 ? Math.min(PL2.length, file) : 0
    g.save(); g.globalAlpha = 1 - range
    PL2.forEach(([x, y], j) => {
      const u = clamp((k - 0.6 - j * 0.022) / 0.07, 0, 1)
      if (u <= 0) return
      const cx = x + (300 - x) * range
      const cy = y + (s0 - y) * range + posee(u) * 14
      if (j < assis) { const ty = TYPES[(j + 1) % 7]!; silhouette(g, v, cx, cy - 4, ty === 'enfant' ? 9 : 11.5, ty, 0, false, 1) }
      g.strokeStyle = c('#2b1c14'); g.lineWidth = 1.1
      g.beginPath()
      g.moveTo(cx - 3, cy); g.lineTo(cx - 3, cy - 11); g.moveTo(cx + 3, cy); g.lineTo(cx + 3, cy - 11); g.moveTo(cx - 3, cy - 5); g.lineTo(cx + 3, cy - 5); g.moveTo(cx - 3, cy - 8.5); g.lineTo(cx + 3, cy - 8.5)
      g.stroke()
      g.beginPath(); g.arc(cx, cy - 11, 3, Math.PI, 0); g.stroke()
    })
    if (tre > 0) {
      const px = 232 + (298 - 232) * range
      const py = s0
      g.save(); g.translate(px, py); g.scale(1 - range * 0.5, 1 - range * 0.5)
      const ec = 7 * ease(tre)
      g.strokeStyle = c('#2b1c14'); g.lineWidth = 1.3
      g.beginPath(); g.moveTo(0, -16); g.lineTo(-ec, 0); g.moveTo(0, -16); g.lineTo(ec, 0); g.moveTo(0, -16); g.lineTo(ec * 0.3, 0); g.stroke()
      if (boite > 0) {
        g.save(); g.translate(0, posee(boite) * 26)
        g.fillStyle = c('#2b1f14'); g.fillRect(-13, -27, 7, 10); g.fillRect(-11, -31, 3, 4)
        g.fillStyle = c('#8a5a30'); rr(g, -6, -26, 13, 10, 1.2); g.fill(); g.strokeStyle = c('#3a2414'); g.lineWidth = 0.8; g.stroke()
        g.fillStyle = c('#B8862B'); g.fillRect(7, -23, 4, 4)
        const an = v.vivant && lampe > 0.5 ? v.t * 9 : 0.6
        g.strokeStyle = c('#1c140c'); g.lineWidth = 1
        g.beginPath(); g.moveTo(0.5, -21); g.lineTo(0.5 + Math.cos(an) * 3.5, -21 + Math.sin(an) * 3.5); g.stroke()
        if (lampe > 0.01) { g.fillStyle = c('#FADEA0', lampe); g.fillRect(-12, -24, 5, 3) }
        g.restore()
      }
      g.restore()
      if (k > 0.6) {
        const arr = lisse(0.6, 0.72, k)
        const ox = 180 + (222 - 180) * arr + range * 60
        silhouette(g, v, ox, s0, 13.5, 'homme', v.t * 7, arr < 1 && v.vivant, 1)
        if (arr >= 1 && range === 0) {
          const an = v.vivant && lampe > 0.5 ? v.t * 9 : 0.6
          const s = 13.5 / 18
          g.strokeStyle = c('#0c0806'); g.lineWidth = 1.5 * s; g.lineCap = 'round'
          g.beginPath(); g.moveTo(ox + 0.5 * s, s0 - 13.4 * s); g.lineTo(232.5 + Math.cos(an) * 3.5, s0 - 21 + Math.sin(an) * 3.5); g.stroke()
        }
      }
    }
    g.restore()
  }
  if (lampe > 0.01 && drap > 0.95) {
    const lx = 243, ly = s0 - 21
    g.save(); g.globalCompositeOperation = 'lighter'
    const gr = g.createLinearGradient(lx, ly, sx + sw / 2, sy + sh / 2)
    gr.addColorStop(0, c('#F2D7A0', 0.34 * lampe)); gr.addColorStop(1, c('#F2D7A0', 0.05 * lampe))
    g.fillStyle = gr
    poly(g, [[lx, ly - 1.5], [sx + sw, sy], [sx, sy], [sx, sy + sh], [lx, ly + 1.5]]); g.fill()
    g.restore()
    halo(g, sx + sw / 2, sy + sh / 2, 64, '#F2E2BE', 0.12 * lampe * (0.4 + 0.6 * v.nuit))
    halo(g, 222, s0 - 22, 16, '#F2CD8C', 0.3 * lampe * (0.3 + 0.7 * v.nuit))
  }
  echelle(g, 352, s0, 62, lisse(0.05, 0.2, k) * (1 - lisse(0.84, 0.92, k)))
  equipe(g, v, k, [[250, s0, 'marteau', 1], [352, s0 - 30, 'tire', -1]], s0)
}

function projectionUsine(g: CanvasRenderingContext2D, v: VueMonde, sx: number, sy: number, sw: number, sh: number): void {
  const fl = v.vivant ? 0.9 + 0.1 * hash(Math.floor(v.t * 16) * 2.3) : 1
  g.fillStyle = c('#E8DFC8', fl); g.fillRect(sx, sy, sw, sh)
  g.fillStyle = c('#9a8f7c'); g.fillRect(sx, sy, sw, sh * 0.66)
  g.fillStyle = c('#6f6554')
  for (let i = 0; i < 6; i++) g.fillRect(sx + 4 + (i * sw) / 6, sy + 4, sw / 9, sh * 0.16)
  g.fillStyle = c('#2a241c'); g.fillRect(sx + sw * 0.36, sy + sh * 0.26, sw * 0.28, sh * 0.4)
  for (let i = 0; i < 8; i++) {
    const u = ((v.vivant ? v.t * 0.09 : 0.3) + i / 8) % 1
    const dir = i % 2 ? 1 : -1
    const x = sx + sw * 0.5 + dir * u * sw * 0.56
    const y = sy + sh * (0.68 + u * 0.22)
    silhouette(g, v, x, y, 4 + u * 6, i % 3 ? 'femme' : 'homme', v.t * 5 + i, v.vivant, dir, '#2a241c')
  }
}

/** 1896 : l'échafaudage, les planches qui montent, le toit qui se pose, puis les lampions. */
function baraqueChantier(g: CanvasRenderingContext2D, v: VueMonde, k: number, opts: { ampoules: readonly boolean[]; file: number }): void {
  const x0 = B_X0, x1 = B_X1, top = B_TOP, s0 = B_SOL, lim = top + 40, bas = s0 + 26
  const murs = lisse(0.12, 0.55, k)
  const toit = lisse(0.55, 0.7, k)
  const rangs = Math.floor(murs * 9 + 1e-6)
  const hMur = ((bas - lim) * rangs) / 9
  // Les murs comme le toit qui se pose : la façade du chantier, ses lampions allumés à la fin
  // seulement, ses ampoules passé 0,8 (maquette : `D.lampes`, `D.ampoules`, posés pour les deux).
  const facade = { ampoules: k < 0.8 ? [] : opts.ampoules, file: k < 0.74 ? 0 : Math.round(opts.file * lisse(0.74, 0.95, k)), lampes: lisse(0.76, 0.9, k), sansBoni: k < 0.74 }
  if (hMur > 0) { g.save(); g.beginPath(); g.rect(x0 - 40, bas - hMur, x1 - x0 + 60, hMur); g.clip(); baraqueFacade(g, v, facade); g.restore() }
  if (murs > 0 && murs < 1) {
    const u = murs * 9 - rangs
    const yy = bas - hMur - 9
    const by = s0 + 4 + (yy - (s0 + 4)) * ease(u)
    g.strokeStyle = c('#1c140c'); g.lineWidth = 0.7
    g.beginPath(); g.moveTo(x1 - 18, top - 4); g.lineTo(x1 - 18, by); g.stroke()
    g.fillStyle = c('#6b4a2a'); g.fillRect(x1 - 40, by, 44, 8)
    g.fillStyle = c('#2e2014'); g.fillRect(x1 - 40, by + 6.5, 44, 1.5)
  }
  if (toit > 0) {
    if (toit >= 0.7 && v.age(`chantier:1896:toit`) === 99) { v.marquer('chantier:1896:toit'); v.fumee(B_CX * v.k, v.ecranY(top + 34, 1), 8, 150) }
    g.save(); g.translate(0, posee(toit) * 150); g.beginPath(); g.rect(-8, -80, LARGEUR + 16, lim + 80); g.clip()
    baraqueFacade(g, v, facade)
    g.restore()
  }
  echafaudage(g, x0 - 6, x1 + 6, top - 8, s0, lisse(0, 0.14, k) * (1 - lisse(0.86, 0.98, k)))
  equipe(g, v, k, [[236, s0 - 48, 'marteau', 1], [362, s0 - 72, 'marteau', -1], [196, s0, 'porte', 1]], s0)
}

/** 1897 : le guichet, planches, auvent, enseigne, puis la lampe s'allume (maquette : `guichet`, `guichetChantier`). */
function guichet(g: CanvasRenderingContext2D, v: VueMonde, penche = 0, lampe = 1): void {
  const x = 84, y = 608
  ombre(g, x + 3, y + 3, 44, 6)
  g.fillStyle = c('#5a3e26'); g.fillRect(x - 34, y - 58, 68, 58)
  g.strokeStyle = c('#2e2014', 0.8); g.lineWidth = 1
  for (let k = x - 28; k < x + 34; k += 9) { g.beginPath(); g.moveTo(k, y - 16); g.lineTo(k, y); g.stroke() }
  const fl = (v.vivant ? 0.8 + 0.2 * Math.sin(v.t * 7.3) * Math.sin(v.t * 2.9) : 0.9) * lampe
  g.fillStyle = c('#F2CD8C', Math.min(1, 0.55 + 0.35 * fl)); g.fillRect(x - 20, y - 46, 40, 24)
  g.save(); g.translate(x - 2, y - 22); g.rotate(penche * 0.35)
  g.fillStyle = c('#0c0806'); cercle(g, 0, -10, 4)
  poly(g, [[-7, 0], [7, 0], [5, -7], [-5, -7]]); g.fill()
  g.beginPath(); g.ellipse(0, -14.5, 5, 1.6, 0, 0, TAU); g.fill()
  g.restore()
  g.strokeStyle = c('#20150d'); g.lineWidth = 1.5
  g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x, y - 22); g.moveTo(x - 20, y - 34); g.lineTo(x + 20, y - 34); g.stroke()
  g.fillStyle = c('#3a2819'); g.fillRect(x - 38, y - 22, 76, 5)
  g.fillStyle = c('#A8452F'); poly(g, [[x - 42, y - 58], [x + 42, y - 58], [x + 30, y - 76], [x - 30, y - 76]]); g.fill()
  g.fillStyle = c('#E9DCC0')
  for (let k = 0; k < 4; k++) { poly(g, [[x - 42 + k * 24 + 12, y - 58], [x - 42 + k * 24 + 24, y - 58], [x - 30 + k * 18 + 18, y - 76], [x - 30 + k * 18 + 9, y - 76]]); g.fill() }
  g.fillStyle = c('#20150d'); rr(g, x - 32, y - 94, 64, 17, 3); g.fill()
  g.strokeStyle = c('#E6B94A', 0.6); g.lineWidth = 0.8; g.stroke()
  texte(g, 'ENTRÉE · 1 FR', x, y - 82, `9px ${F_A}`, c('#E6B94A'))
  g.strokeStyle = c('#20150d'); g.lineWidth = 1.2
  g.beginPath(); g.moveTo(x + 34, y - 52); g.lineTo(x + 46, y - 52); g.lineTo(x + 46, y - 46); g.stroke()
  g.fillStyle = c('#FCE2AA', Math.min(1, 0.5 + 0.5 * fl)); cercle(g, x + 46, y - 42, 3)
  halo(g, x + 46, y - 42, 22 * Math.max(1, lampe), '#F2CD8C', 0.3 * fl * LUM * (0.3 + 0.7 * v.nuit))
  silhouette(g, v, x + 46, y + 4, 14, 'homme', 0, false, -1)
}

function guichetChantier(g: CanvasRenderingContext2D, v: VueMonde, k: number): void {
  const x = 84, y = 608, lim = y - 58, bas = y + 8
  const murs = lisse(0.12, 0.45, k)
  const auvent = lisse(0.45, 0.6, k)
  const ens = lisse(0.6, 0.72, k)
  const lampe = lisse(0.74, 0.86, k)
  if (k >= 0.74) guichet(g, v, 0, lampe)
  else {
    const rangs = Math.floor(murs * 6 + 1e-6)
    const hh = ((bas - lim) * rangs) / 6
    if (hh > 0) { g.save(); g.beginPath(); g.rect(x - 44, bas - hh, 82, hh); g.clip(); guichet(g, v, 0, 0); g.restore() }
    if (auvent > 0) {
      const w = 88 * auvent
      g.save(); g.beginPath(); g.rect(x - 44, y - 77, w, 19.5); g.clip(); guichet(g, v, 0, 0); g.restore()
      if (auvent < 1) { g.fillStyle = c('#cfc2a4'); rr(g, x - 46 + w, y - 78, 5, 21, 2.5); g.fill() }
    }
    if (ens > 0) {
      if (ens >= 0.7 && v.age('chantier:1897:enseigne') === 99) { v.marquer('chantier:1897:enseigne'); v.fumee(x * v.k, v.ecranY(y - 76, 1), 4, 50) }
      const sw = (1 - ens) * Math.sin(ens * 16) * 0.25
      g.save(); g.translate(x, y - 94 + posee(ens) * 50); g.rotate(sw); g.translate(-x, -(y - 94))
      g.strokeStyle = c('#1c140c'); g.lineWidth = 0.7
      g.beginPath(); g.moveTo(x - 26, y - 94); g.lineTo(x - 22, y - 150); g.moveTo(x + 26, y - 94); g.lineTo(x + 22, y - 150); g.stroke()
      g.beginPath(); g.rect(x - 34, y - 96, 68, 19.5); g.clip(); guichet(g, v, 0, 0); g.restore()
    }
  }
  echafaudage(g, x - 50, x + 50, y - 104, y, lisse(0, 0.14, k) * (1 - lisse(0.86, 0.98, k)))
  equipe(g, v, k, [[x - 30, y - 48, 'tire', 1], [x + 30, y - 24, 'marteau', -1], [x + 70, y + 2, 'porte', -1]], y + 2)
}

/** Le guichet, en chantier ou fini (maquette : `guichetEtat`) ; brume.ts le rappelle pour percer la brume. */
export function guichetEtat(g: CanvasRenderingContext2D, v: VueMonde, k97: number): void {
  if (k97 < 1) guichetChantier(g, v, k97)
  else guichet(g, v)
}

/** 1898 : le plancher et le mât, le chapiteau, un cheval après l'autre, puis les lampions et le premier tour. */
function manegeChantier(g: CanvasRenderingContext2D, v: VueMonde, k: number, a: number): void {
  const cx = 78, base = 344, R = 44, top = 264, lim = top + 37
  const pied = lisse(0.1, 0.3, k)
  const toit = lisse(0.3, 0.46, k)
  const chevaux = lisse(0.46, 0.86, k)
  const lampes = lisse(0.86, 0.93, k)
  const montes = Math.min(6, Math.floor(chevaux * 6 + 1e-6))
  if (pied > 0) {
    const hh = (base + 16 - lim) * (pied < 0.5 ? 4 * pied ** 3 : 1 - Math.pow(-2 * pied + 2, 3) / 2)
    g.save(); g.beginPath(); g.rect(-8, base + 16 - hh, 190, hh); g.clip(); carrousel(g, v, cx, base, R, top, a, 6, lampes, montes); g.restore()
  }
  if (toit > 0) {
    if (toit >= 0.7 && v.age('chantier:1898:chapiteau') === 99) { v.marquer('chantier:1898:chapiteau'); v.fumee(cx * v.k, v.ecranY(lim, 1), 6, 90) }
    g.save(); g.translate(0, posee(toit) * 120); g.beginPath(); g.rect(-8, -60, 190, lim + 60); g.clip(); carrousel(g, v, cx, base, R, top, a, 6, lampes, montes); g.restore()
  }
  if (chevaux > 0 && montes < 6) {
    const j = montes
    const u = chevaux * 6 - j
    const b = a + (j * TAU) / 6
    const z = Math.sin(b)
    const tx = cx + Math.cos(b) * R
    const ty = base - 20 + z * 7
    const e = clamp(u / 0.8, 0, 1)
    const ee = ease(e)
    const hx = -26 + (tx - -26) * ee
    const hy = base + 4 + (ty - (base + 4)) * ee - Math.sin(ee * Math.PI) * 16
    if (ee < 1) ouvrier(g, v, -34 + (tx - 12 - -34) * ee, base + 8, v.t * 7 + j, 'marche', 1)
    g.save(); g.translate(hx, hy); g.scale(0.95, 0.95)
    g.fillStyle = g.strokeStyle = c(j % 2 ? '#E9DCC0' : '#A8452F')
    cheval(g, 1.1 + j * 0.3)
    g.restore()
    if (u >= 0.8 && v.age(`chantier:1898:cheval${j}`) === 99) { v.marquer(`chantier:1898:cheval${j}`); v.etincelles(tx * v.k, v.ecranY(ty - 4, 1), 10, c('#F6D98A')) }
  }
  echafaudage(g, cx - R - 16, cx + R + 16, top - 8, base + 8, lisse(0, 0.12, k) * (1 - lisse(0.88, 0.98, k)))
  equipe(g, v, k, [[cx - 22, base + 8 - 48, 'marteau', 1], [cx + R + 30, base + 10, 'tire', -1]], base + 10)
}

/** Le manège (maquette : `carrousel`). */
function carrousel(g: CanvasRenderingContext2D, v: VueMonde, cx: number, base: number, R: number, top: number, a: number, nch = 6, enAllume = 1, montes = nch): void {
  ombre(g, cx + 3, base + 5, R + 10, 10)
  g.fillStyle = c('#3a2819'); g.beginPath(); g.ellipse(cx, base, R + 6, 11, 0, 0, TAU); g.fill()
  g.fillStyle = c('#5a3e26'); g.beginPath(); g.ellipse(cx, base - 3, R + 6, 11, 0, 0, TAU); g.fill()
  const ch: { b: number; z: number; i: number }[] = []
  for (let i = 0; i < nch; i++) { const b = a + (i * TAU) / nch; ch.push({ b, z: Math.sin(b), i }) }
  ch.sort((p, q) => p.z - q.z)
  const eave = top + 26
  const dessinerCheval = (h: { b: number; z: number; i: number }) => {
    if (h.i >= montes) return
    const x = cx + Math.cos(h.b) * R
    const yb = base - 20 + h.z * 7
    const bob = Math.sin(h.b * 3 + h.i) * 4
    const sc = 0.9 + (0.15 * (h.z + 1)) / 2
    g.strokeStyle = c('#B8862B'); g.lineWidth = 1.3
    g.beginPath(); g.moveTo(x, eave + h.z * 6); g.lineTo(x, base - 3 + h.z * 9); g.stroke()
    g.save(); g.translate(x, yb + bob); g.scale((h.z > 0 ? -1 : 1) * sc, sc)
    g.fillStyle = g.strokeStyle = c(h.i % 2 ? '#E9DCC0' : '#A8452F')
    cheval(g, 1.1 + h.i * 0.3)
    g.restore()
  }
  ch.filter((h) => h.z < 0).forEach(dessinerCheval)
  g.fillStyle = c('#6b4a2a'); g.fillRect(cx - 9, eave, 18, base - eave - 3)
  g.fillStyle = c('#F2E2BE', 0.2 + 0.2 * v.nuit)
  for (let k = 0; k < 4; k++) g.fillRect(cx - 6, eave + 8 + k * 11, 12, 5)
  ch.filter((h) => h.z >= 0).forEach(dessinerCheval)
  const n = 12
  const pts2: { b: number; x: number; y: number }[] = []
  for (let i = 0; i <= n; i++) { const b = a * 0.999 + (i * TAU) / n; pts2.push({ b, x: cx + Math.cos(b) * (R + 10), y: eave + Math.sin(b) * 6 }) }
  const coins: Array<[{ b: number; x: number; y: number }, { b: number; x: number; y: number }, number]> = []
  for (let i = 0; i < n; i++) coins.push([pts2[i]!, pts2[i + 1]!, i])
  coins.sort((p, q) => Math.sin((p[0].b + p[1].b) / 2) - Math.sin((q[0].b + q[1].b) / 2))
  for (const [p, q, i] of coins) { g.fillStyle = c(i % 2 ? '#E9DCC0' : '#A8452F'); poly(g, [[cx, top], [p.x, p.y], [q.x, q.y]]); g.fill() }
  g.fillStyle = c('#7A1F1A')
  for (let i = 0; i < 10; i++) { const x = cx - R - 10 + (i + 0.5) * ((2 * R + 20) / 10); g.beginPath(); g.arc(x, eave + 5, (2 * R + 20) / 20, 0, Math.PI); g.fill() }
  g.strokeStyle = c('#2b1c14'); g.lineWidth = 1.4
  g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, top - 12); g.stroke()
  const w = v.vivant ? Math.sin(v.t * 5 + 1) * 2 : 0
  g.fillStyle = c('#E6B94A'); poly(g, [[cx, top - 12], [cx + 11, top - 9 + w], [cx, top - 6]]); g.fill()
  for (let i = 0; i < 8; i++) { const b = a + (i * TAU) / 8; if (Math.sin(b) < -0.2) continue; lampion(g, v, cx + Math.cos(b) * (R + 10), eave + Math.sin(b) * 6 + 3, 2, i, null, enAllume) }
}

function vueFondante(g: CanvasRenderingContext2D, v: VueMonde, m: number, cx: number, cy: number): void {
  g.strokeStyle = g.fillStyle = c('#3a2e22', 0.85)
  g.lineWidth = 1.4
  g.lineCap = 'round'
  if (m === 0) {
    g.beginPath(); g.arc(cx, cy, 15, 0, TAU); g.stroke()
    g.beginPath(); g.arc(cx - 5, cy - 3, 2.5, Math.PI * 0.1, Math.PI * 0.9); g.stroke()
    g.beginPath(); g.arc(cx + 5, cy - 3, 2.5, Math.PI * 0.1, Math.PI * 0.9); g.stroke()
    g.beginPath(); g.arc(cx, cy + 3, 6, 0.2, Math.PI - 0.2); g.stroke()
  } else {
    g.fillRect(cx - 5, cy - 4, 10, 20)
    poly(g, [[cx - 7, cy - 4], [cx + 7, cy - 4], [cx, cy - 11]]); g.fill()
    const r = v.vivant ? v.t * 1.6 : 0.4
    for (let k = 0; k < 4; k++) {
      const b = r + (k * TAU) / 4
      g.save(); g.translate(cx, cy - 6); g.rotate(b); g.fillRect(-1.5, 0, 3, 16); g.restore()
    }
  }
}

/** La lanterne magique, hors de toute année, dès le départ (maquette : `lanterneMagique`). */
function lanterneMagique(g: CanvasRenderingContext2D, v: VueMonde): void {
  const lx = 362, ly = 490, sx = 238, sy = 366, sw = 82, sh = 48
  g.strokeStyle = c('#2b1c14'); g.lineWidth = 2.5
  g.beginPath(); g.moveTo(sx - 3, sy - 6); g.lineTo(sx - 3, sy + sh + 24); g.moveTo(sx + sw + 3, sy - 6); g.lineTo(sx + sw + 3, sy + sh + 24); g.stroke()
  ombre(g, sx - 2, sy + sh + 25, 6, 2); ombre(g, sx + sw + 4, sy + sh + 25, 6, 2)
  const f = (v.vivant ? 0.82 + 0.18 * Math.sin(v.t * 9) * Math.sin(v.t * 3.1) : 0.9) * extinction(v)
  g.fillStyle = c('#DCCFB4'); g.fillRect(sx, sy, sw, sh)
  const cyc = v.vivant ? v.t / 5 : 0.3
  const k = cyc % 1
  const m = Math.floor(cyc) % 2
  const fd = lisse(0.72, 1, k)
  g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip()
  g.globalAlpha = 1 - fd; vueFondante(g, v, m, sx + sw / 2, sy + sh / 2)
  g.globalAlpha = fd; vueFondante(g, v, 1 - m, sx + sw / 2, sy + sh / 2)
  g.globalAlpha = 1; g.restore()
  g.save(); g.globalCompositeOperation = 'lighter'
  const gr = g.createLinearGradient(lx - 16, ly - 22, sx + sw / 2, sy + sh / 2)
  gr.addColorStop(0, c('#F2D7A0', 0.3 * f)); gr.addColorStop(1, c('#F2D7A0', 0.06 * f))
  g.fillStyle = gr
  poly(g, [[lx - 26, ly - 25], [sx + sw, sy], [sx, sy], [sx, sy + sh], [lx - 26, ly - 19]]); g.fill()
  g.restore()
  g.fillStyle = c('#2b1c14'); g.fillRect(lx - 11, ly - 4, 3, 16); g.fillRect(lx + 8, ly - 4, 3, 16)
  ombre(g, lx, ly + 12, 16, 3)
  g.fillStyle = c('#3a2a1a'); rr(g, lx - 14, ly - 34, 28, 30, 3); g.fill()
  g.strokeStyle = c('#D9B382', 0.35); g.lineWidth = 1; g.stroke()
  g.fillStyle = c('#2b1f14'); g.fillRect(lx - 4, ly - 46, 8, 12); g.fillRect(lx - 7, ly - 49, 14, 4); g.fillRect(lx - 28, ly - 27, 14, 10)
  g.fillStyle = c('#FADEA0', Math.min(1, 0.9 * f)); cercle(g, lx - 28, ly - 22, 4.5)
  silhouette(g, v, lx + 20, ly + 12, 14, 'homme', 0, false, -1)
}

/** La grande baraque « Prochainement » de 1899, en chantier : elle sera le décor des années 1900. */
function prochainement(g: CanvasRenderingContext2D, v: VueMonde, k = 1): void {
  const x = 322, y = 748, x0 = x - 55, x1 = x + 55, top = y - 64, pic = y - 106
  const fond = lisse(0, 0.15, k)
  const poteaux = lisse(0.12, 0.42, k)
  const ferme = lisse(0.38, 0.56, k)
  const bache = lisse(0.56, 0.72, k)
  const planches = lisse(0.6, 0.85, k)
  const ens = lisse(0.78, 0.92, k)
  ombre(g, x, y + 3, 62 * fond, 6)
  g.fillStyle = c('#2b1c14'); g.fillRect(x0 - 4, y - 5, (x1 - x0 + 8) * fond, 5)
  if (planches > 0) {
    const rangs = Math.ceil(planches * 6)
    for (let j = 0; j < rangs; j++) {
      const u = j < rangs - 1 ? 1 : planches * 6 - j
      g.fillStyle = c(j % 2 ? '#4a3321' : '#553b26')
      g.fillRect(x0, y - 5 - (j + 1) * 9.8, (x1 - x0) * (0.64 - j * 0.045) * u, 9.2)
    }
    g.strokeStyle = c('#2e2014', 0.7); g.lineWidth = 1
    for (let px = x0 + 9; px < x0 + (x1 - x0) * 0.64; px += 11) { g.beginPath(); g.moveTo(px, y - 6); g.lineTo(px, y - 5 - rangs * 9.8); g.stroke() }
  }
  g.strokeStyle = c('#6b4a2a'); g.lineWidth = 3
  g.beginPath()
  for (let i = 0; i <= 5; i++) {
    const u = clamp(poteaux * 6 - i, 0, 1)
    if (u > 0) {
      const px = x0 + ((x1 - x0) * i) / 5
      g.moveTo(px, y - 5); g.lineTo(px, y - 5 - (y - 5 - top) * ease(u))
    }
  }
  g.stroke()
  if (ferme > 0) {
    g.lineWidth = 2.5
    g.beginPath(); g.moveTo(x0 - 4, top); g.lineTo(x0 - 4 + (x1 + 4 - (x0 - 4)) * clamp(ferme * 2, 0, 1), top); g.stroke()
    const f2 = clamp(ferme * 2 - 1, 0, 1)
    if (f2 > 0) {
      if (bache > 0) {
        g.save(); poly(g, [[x0 - 6, top], [x, pic], [x1 + 6, top]]); g.clip()
        const w = (x1 - x0 + 12) * bache
        for (let i = 0; i < 12; i++) {
          const a0 = x0 - 6 + (i * (x1 - x0 + 12)) / 12
          if (a0 > x0 - 6 + w) break
          g.fillStyle = c(i % 2 ? '#E9DCC0' : '#A8452F', 0.92)
          g.fillRect(a0, pic, Math.min((x1 - x0 + 12) / 12, x0 - 6 + w - a0), top - pic)
        }
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0 - 6, top - 8, w, 8); g.restore()
        if (bache < 1) { g.fillStyle = c('#cfc2a4'); rr(g, x0 - 8 + w, top + (pic - top) * 0.5 - 2, 5, top - (top + (pic - top) * 0.5) + 2, 2); g.fill() }
      }
      g.strokeStyle = c('#6b4a2a'); g.lineWidth = 2.5
      g.beginPath()
      g.moveTo(x0 - 6, top); g.lineTo(x0 - 6 + (x - (x0 - 6)) * f2, top + (pic - top) * f2)
      g.moveTo(x1 + 6, top); g.lineTo(x1 + 6 + (x - (x1 + 6)) * f2, top + (pic - top) * f2)
      g.moveTo(x, top); g.lineTo(x, top + (pic - top) * f2)
      g.stroke()
      g.lineWidth = 1.4
      g.beginPath()
      g.moveTo(x, top - 6); g.lineTo(x + (x - 30 - x) * f2, top - 6 + (top - 22 - (top - 6)) * f2)
      g.moveTo(x, top - 6); g.lineTo(x + (x + 30 - x) * f2, top - 6 + (top - 22 - (top - 6)) * f2)
      g.stroke()
    }
  }
  echafaudage(g, x0 - 10, x1 + 10, pic + 10, y, lisse(0.04, 0.24, k))
  if (ens > 0) {
    const dy = posee(ens) * 44
    const sw = v.vivant ? Math.sin(v.t * 1.4) * 0.035 + (1 - ens) * Math.sin(ens * 18) * 0.2 : 0
    g.save(); g.translate(x, top - 18 + dy); g.rotate(sw)
    g.strokeStyle = c('#1c140c'); g.lineWidth = 0.8
    g.beginPath(); g.moveTo(-40, 0); g.lineTo(-36, -22 - dy); g.moveTo(40, 0); g.lineTo(36, -22 - dy); g.stroke()
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, -45, 2, 92, 16, 2); g.fill()
    g.fillStyle = c('#E9DCC0'); rr(g, -46, 0, 92, 16, 2); g.fill()
    texte(g, 'PROCHAINEMENT', 0, 12, `9.5px ${F_A}`, c('#20150d'))
    g.restore()
  }
}

/**
 * Le plan moyen : la baraque foraine, sa foire, le manège, la lanterne magique — chacun bâti par
 * son propre chantier (idée 8), sous la brume tant que son année n'est pas ouverte.
 */
export function dessinerMoyen(v: VueMonde): void {
  if (v.presence <= 0.01) return
  const g = v.ctx
  const r = remplissage(v.cases, v.bouclee)
  const qte = quantites(r)
  const ampBool = ampoulesDe(v.bati.n, v.bouclee)
  const k95 = avancement(chantier(1895, v.ouverte, v.t, v.vivant))
  const k96 = avancement(chantier(1896, v.ouverte, v.t, v.vivant))
  const k97 = avancement(chantier(1897, v.ouverte, v.t, v.vivant))
  const k98 = avancement(chantier(1898, v.ouverte, v.t, v.vivant))
  const k99 = avancement(chantier(1899, v.ouverte, v.t, v.vivant))
  const k1 = v.adieu < 0 ? 0 : lisse(0.3, 2.6, v.adieu)
  if (v.adieu > 0.8 && v.age('adieu:fumee1') === 99) { v.marquer('adieu:fumee1'); v.fumee(300 * v.k, v.ecranY(200, 1), 10, 120) }
  if (v.adieu > 1.8 && v.age('adieu:fumee2') === 99) { v.marquer('adieu:fumee2'); v.fumee(300 * v.k, v.ecranY(214, 1), 12, 150); v.fumee(78 * v.k, v.ecranY(330, 1), 6, 60) }
  // L'angle du manège : la vitesse 5 de la maquette, retombée vers 1 au taux 0,5 par seconde, intégrée (idée 2).
  // Un toucher d'avant que le manège soit monté est perdu (maquette : `D.carrV = 0` tant que `k98` < 0,93).
  const ageCarrousel = v.age('carrousel')
  const manegePret = v.ouverte.annee === 1898 && v.ouverte.t0 >= 0 ? v.ouverte.t0 + MANEGE_PRET : -Infinity
  const emballe = ageCarrousel < 99 && v.t - ageCarrousel >= manegePret
  const angleManege = emballe ? 0.8 * v.t + 6.4 * (1 - Math.exp(-0.5 * ageCarrousel)) : 0.8 * v.t

  g.save(); g.translate(0, v.ecranY(0, 1)); g.scale(v.k, 1)
  if (k96 > 0.66) {
    const f = lisse(0.66, 0.8, k96)
    g.save(); g.globalAlpha = 1 - k1
    g.beginPath(); g.rect(300 - 320 * f, 0, 320 * f + 12, 160); g.clip()
    guirlande(g, v, 300, 38, -8, 82, 26 + k1 * 140, 4 + Math.round(r * 6), 'fanion', 1)
    g.restore()
  }
  if (k96 < 1) seancePleinAir(g, v, k95, k96, qte.file)
  if (k96 > 0) {
    g.save()
    g.translate(B_CX, B_SOL); g.rotate(k1 * 0.07 * Math.sin(k1 * 9)); g.scale(1 + k1 * 0.05, 1 - k1 * 0.94); g.translate(-B_CX, -B_SOL)
    g.globalAlpha = 1 - lisse(0.7, 1, k1)
    if (k96 < 1) baraqueChantier(g, v, k96, { ampoules: ampBool, file: qte.file })
    else baraqueFacade(g, v, { ampoules: ampBool, file: qte.file, lampes: 1, sansBoni: false })
    g.restore()
  }
  if (k98 > 0) {
    g.save(); g.translate(-k1 * 320, 0)
    if (k98 < 1) manegeChantier(g, v, k98, angleManege)
    else carrousel(g, v, 78, 344, 44, 264, angleManege + k1 * 6, 6)
    if (k1 < 0.3 && k98 >= 1) foule(g, v, Math.round(r * 7), 18, 150, 362, 5)
    g.restore()
  }
  // Le ballon de l'enfant (maquette : `dessinCarte`, en 24, 404).
  const ex = 24, ey = 404
  const bb = v.vivant ? Math.sin(v.t * 1.3) * 3 : 0
  g.strokeStyle = c('#0c0806', 0.8); g.lineWidth = 0.7
  g.beginPath(); g.moveTo(ex + 2, ey - 14); g.quadraticCurveTo(ex + 8, ey - 30, ex + 6, ey - 44 + bb); g.stroke()
  const bg = g.createRadialGradient(ex + 4, ey - 52 + bb, 1, ex + 6, ey - 49 + bb, 8)
  bg.addColorStop(0, c('#F08A70')); bg.addColorStop(1, c('#A8452F'))
  g.fillStyle = bg
  g.beginPath(); g.ellipse(ex + 6, ey - 50 + bb, 6.5, 7.8, 0, 0, TAU); g.fill()
  silhouette(g, v, ex, ey, 10, 'enfant', 0, false, 1)
  lanterneMagique(g, v)
  foule(g, v, Math.round(r * 5), 236, 326, 440, 9, 12)
  if (k97 > 0) guichetEtat(g, v, k97)
  if (k99 > 0) { prochainement(g, v, k99); equipe(g, v, k99, [[292, 700, 'marteau', 1], [358, 724, 'marteau', -1], [236, 750, 'porte', 1]], 750, true) }
  if (k98 > 0) v.zone('carrousel', 78, 310, 56)
  v.zone('rideau', 300, 175, 45)
  g.restore()
}
