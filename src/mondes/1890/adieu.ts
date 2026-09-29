import type { VueMonde } from '../types'
import { hash, lisse } from '../../carte/outils'
import { poly, rr } from './moyen'
import { imageDu1890 } from './images'

const F_P = '"Stardos Stencil", Georgia, serif'
const F_T = "'Fraunces', Georgia, serif"
const F_C = "'Manrope', system-ui, sans-serif"

/** Un Park-Miller (maquette : `alea`), la graine refaite à chaque image : l'affiche ne bouge pas. */
const alea = (graine: number) => {
  let s = (Math.abs(Math.floor(graine)) % 2147483646) + 1
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

/**
 * L'affiche au pochoir de 1900 (maquette : `affiche1900`), dessinée à même `v.ctx`, hors de la
 * rampe (« la couleur arrive ») : jamais dans un canvas caché (un monde ne touche pas au DOM). La
 * Lune de Méliès s'y pose si l'archive est décodée ; sans elle, le panneau reste bleu.
 */
function dessinerAffiche(g: CanvasRenderingContext2D, w: number, h: number, lune: CanvasImageSource | null): void {
  const r = alea(19)
  const reg = (dx: number, dy: number, f: () => void) => {
    g.save(); g.translate(dx, dy); f(); g.restore()
  }
  const etoile = (cx: number, cy: number, R: number) => {
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const an = -Math.PI / 2 + (i * Math.PI) / 5
      const rr2 = i % 2 ? R * 0.42 : R
      g.lineTo(cx + Math.cos(an) * rr2, cy + Math.sin(an) * rr2)
    }
    g.closePath(); g.fill()
  }
  g.fillStyle = '#efe2c4'; g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(120,90,50,.1)'
  for (let i = 0; i < 700; i++) g.fillRect(r() * w, r() * h, 1.2, 1.2)
  reg(1.5, -1, () => { g.fillStyle = '#2f4f7f'; g.fillRect(16, 16, w - 32, 262) })
  reg(-1, 1, () => { g.fillStyle = '#e0a92e'; for (let i = 0; i < 16; i++) etoile(28 + r() * (w - 56), 30 + r() * 230, 3 + r() * 5) })
  // La Lune de Méliès en pochoir, posée sur le panneau bleu (ses étoiles passent par le ciel transparent).
  if (lune) g.drawImage(lune, 16, 16, w - 32, 262)
  g.strokeStyle = '#2f4f7f'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16)
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'
  reg(1, 1, () => { g.fillStyle = '#2f4f7f'; g.font = `700 15px ${F_P}`; g.fillText('CHAPITRE II  ·  ANNÉES 1900', w / 2, 308) })
  reg(2.5, 2, () => { g.fillStyle = '#2f4f7f'; g.font = `700 52px ${F_P}`; g.fillText('LA FÉERIE', w / 2, 366) })
  g.fillStyle = '#c9432c'; g.font = `700 52px ${F_P}`; g.fillText('LA FÉERIE', w / 2, 366)
  g.fillStyle = '#2a1f14'; g.font = `italic 500 18px ${F_T}`; g.fillText('Méliès et les forains', w / 2, 396)
  reg(-2, 1.5, () => { g.fillStyle = '#e0a92e'; g.font = `700 46px ${F_P}`; g.fillText('1900', w / 2, 448) })
  g.fillStyle = '#2f6f62'; g.font = `700 46px ${F_P}`; g.fillText('1900', w / 2, 448)
  g.fillStyle = '#2a1f14'; g.font = `600 7px ${F_C}`; g.fillText('IMPRIMERIE DU VOYAGE · AFFICHAGE AUTORISÉ', w / 2, 466)
}

/**
 * La cinématique de 1900 (maquette : `cinematique`) : le voile qui s'assombrit, l'affiche qui
 * descend et se déplie, le rai de lumière et le talon de billet qui tombent, en coordonnées
 * d'écran (la maquette les tient pour celles de sa carte, qui fait un écran).
 */
export function dessinerAdieu(v: VueMonde): void {
  if (v.adieu < 0) return
  const g = v.ctx
  const u = v.adieu
  if (u < 2.2) return
  g.fillStyle = `rgba(10,7,4,${(0.55 * lisse(2.2, 3, u)).toFixed(3)})`
  g.fillRect(-8, -8, v.W + 16, v.H + 16)
  const px = 24, py = 60, pw = 342, ph = 480
  const k = lisse(2.8, 4.6, u)
  const hh = ph * k
  if (hh < 1) return
  g.fillStyle = 'rgba(0,0,0,.45)'
  g.fillRect(px + 5, py + 7, pw, hh)
  g.save(); g.beginPath(); g.rect(px, py, pw, hh); g.clip()
  const url = imageDu1890('lune.webp')
  const lune = url ? v.image(url) : null
  g.save(); g.translate(px, py); dessinerAffiche(g, pw, ph, lune); g.restore()
  const pli = 1 - lisse(5, 6.8, u)
  if (pli > 0) {
    g.strokeStyle = `rgba(60,40,20,${(0.18 * pli).toFixed(3)})`
    g.lineWidth = 1
    for (let i = 0; i < 7; i++) {
      const xx = px + 30 + i * 46 + hash(i) * 12
      g.beginPath(); g.moveTo(xx, py); g.bezierCurveTo(xx + 8, py + 150, xx - 8, py + 320, xx + 4, py + ph); g.stroke()
    }
  }
  if (u > 4.4 && u < 6.2) {
    const b = (u - 4.4) / 1.8
    const bx = px - 100 + b * (pw + 200)
    g.fillStyle = 'rgba(255,250,235,.2)'
    poly(g, [[bx, py], [bx + 46, py], [bx - 34, py + ph], [bx - 80, py + ph]]); g.fill()
  }
  g.restore()
  if (k < 1) {
    const y = py + hh
    const gr = g.createLinearGradient(0, y - 6, 0, y + 10)
    gr.addColorStop(0, '#8a7652'); gr.addColorStop(0.45, '#efe2c4'); gr.addColorStop(1, '#6b5a3a')
    g.fillStyle = gr
    rr(g, px - 4, y - 6, pw + 8, 16, 7); g.fill()
  }
  if (u > 4.4 && u < 6.2) {
    const b = (u - 4.4) / 1.8
    const bx = px - 60 + b * (pw + 120)
    const by = py + 140 + Math.sin(b * 9) * 20
    g.save(); g.translate(bx, by); g.rotate(0.5)
    g.fillStyle = '#5a3e26'; g.fillRect(-4, -70, 8, 60)
    g.fillStyle = '#9a8f7c'; g.fillRect(-16, -12, 32, 8)
    g.fillStyle = '#e9dcc0'; g.fillRect(-16, -4, 32, 18)
    g.restore()
  }
}
