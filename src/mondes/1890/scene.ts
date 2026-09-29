import type { VueScene } from '../types'
import { c } from './couleur'
import { vuePage } from './vuePage'
import { cercle, lampion, poly } from './moyen'
import { clamp, ease, hash, lerp, lisse, TAU } from '../../carte/outils'

/** L'écran de la baraque, en unités de la toile (maquette : `sx`, `sy`, `sw`, `sh`). */
const ECRAN = { x: 74, y: 60, w: 242, h: 146 }

/**
 * La projection (décision D1 du plan 2b) : l'image du film posée en « cover » sous le `clip` de
 * l'écran, agrandie de 1 à 1,25 à mesure que le train de la maquette approche (`k`), puis virée au
 * sépia par composition (`color` : la luminance de l'image, la teinte de l'aplat). **Jamais**
 * `getImageData`, `toDataURL` ni `toBlob` : l'image vient de TMDB, sans CORS, et la toile en est
 * teintée ; la lire lèverait. Sans image, l'écran reste blanc de lumière.
 */
function projection(g: CanvasRenderingContext2D, image: CanvasImageSource | null, k: number): void {
  const { x: sx, y: sy, w: sw, h: sh } = ECRAN
  g.save()
  g.beginPath()
  g.rect(sx, sy, sw, sh)
  g.clip()
  if (image) {
    // `CanvasImageSource` ne promet pas de dimensions (une image, une vidéo, une toile les ont) : sans elles, le rapport de l'écran.
    const src = image as unknown as { width?: number; height?: number }
    const iw = src.width || sw
    const ih = src.height || sh
    const echelle = Math.max(sw / iw, sh / ih) * (1 + 0.25 * ease(k))
    const dw = iw * echelle
    const dh = ih * echelle
    g.drawImage(image, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh)
    g.globalCompositeOperation = 'color'
    g.fillStyle = c('#8a6a44')
    g.fillRect(sx, sy, sw, sh)
    g.globalCompositeOperation = 'source-over'
  } else {
    g.fillStyle = c('#F2E8D5', 0.9)
    g.fillRect(sx, sy, sw, sh)
  }
  g.restore()
}

/**
 * La scène de la fiche d'un film (maquette 1890 : `dessinTheatre`, lignes 2000 à 2037) : l'écran
 * dans son cadre doré, le faisceau et sa poussière, les rideaux de velours, les lampions, et trois
 * rangs de public qui reculent quand le film fonce sur la salle, un chapeau qui s'envole. Toucher
 * la scène (`touche`) relance le cycle de neuf secondes.
 */
export function dessinerScene(v: VueScene): void {
  const g = v.ctx
  const W = v.W
  const h = v.H
  // La salle est noire à toute heure : ses lampions brillent comme la nuit.
  const vm = vuePage({ ctx: g, W, H: h, t: v.t, vivant: v.vivant, nuit: 1, touche: v.touche, annee: 0 })
  const frame = Math.floor(v.t * 16)
  const { x: sx, y: sy, w: sw, h: sh } = ECRAN

  const fond = g.createLinearGradient(0, 0, 0, h)
  fond.addColorStop(0, c('#2a1510'))
  fond.addColorStop(1, c('#120a07'))
  g.fillStyle = fond
  g.fillRect(-8, -8, W + 16, h + 16)
  const cycle = v.vivant ? (((v.t - Math.max(0, v.touche)) % 9) + 9) % 9 : 6.2
  const k = clamp((cycle - 1.2) / 6, 0, 1)
  const fl = v.vivant ? 0.88 + 0.12 * hash(frame * 2.3) : 1
  projection(g, v.image, k)

  g.save()
  g.globalCompositeOperation = 'lighter'
  const faisceau = g.createLinearGradient(195, h + 10, 195, sy)
  faisceau.addColorStop(0, c('#F2D7A0', 0.22 * fl))
  faisceau.addColorStop(1, c('#F2D7A0', 0.03))
  g.fillStyle = faisceau
  poly(g, [[186, h + 10], [204, h + 10], [sx + sw, sy], [sx, sy]])
  g.fill()
  for (let i = 0; i < 26; i++) {
    const u = (hash(i * 3.3) + (v.vivant ? v.t * 0.02 * (1 + hash(i)) : 0)) % 1
    const dv = hash(i * 7.1) - 0.5
    const y = lerp(h + 10, sy, u)
    const demi = lerp(9, sw / 2, u)
    g.fillStyle = c('#FFF1D0', 0.35 * (v.vivant ? 0.5 + 0.5 * Math.sin(v.t * 2 + i) : 0.6))
    cercle(g, 195 + dv * 2 * demi, y + (v.vivant ? Math.sin(v.t + i) * 3 : 0), 0.8 + hash(i) * 0.9)
  }
  g.restore()

  g.strokeStyle = c('#B8862B')
  g.lineWidth = 6
  g.strokeRect(sx - 5, sy - 5, sw + 10, sh + 10)
  g.strokeStyle = c('#6B4712')
  g.lineWidth = 1.5
  g.strokeRect(sx - 8, sy - 8, sw + 16, sh + 16)

  const bal = v.vivant ? Math.sin(v.t * 0.9) * 3 : 0
  for (const s of [-1, 1] as const) {
    const x0 = s < 0 ? -8 : sx + sw + 10
    const x1 = s < 0 ? sx - 10 : W + 8
    const velours = g.createLinearGradient(x0, 0, x1, 0)
    velours.addColorStop(0, c('#6a1f18'))
    velours.addColorStop(0.5, c('#8a2a20'))
    velours.addColorStop(1, c('#4a120e'))
    g.fillStyle = velours
    g.beginPath()
    g.moveTo(x0, 0)
    g.lineTo(x1, 0)
    g.quadraticCurveTo(x1 + s * -6 + bal * s, h * 0.6, x1 + s * 14, h)
    g.lineTo(x0, h)
    g.closePath()
    g.fill()
    g.strokeStyle = c('#3a0e0a', 0.7)
    g.lineWidth = 1.4
    for (let k2 = 8; k2 < Math.abs(x1 - x0); k2 += 9) {
      const xx = x0 + k2
      g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx + bal * 0.5, h); g.stroke()
    }
  }
  g.fillStyle = c('#7A1F1A')
  g.fillRect(-8, 0, W + 16, 26)
  for (let i = 0; i < 13; i++) { g.beginPath(); g.arc(15 + i * 30, 26, 15, 0, Math.PI); g.fill() }
  g.fillStyle = c('#E6B94A', 0.8)
  for (let i = 0; i < 13; i++) g.fillRect(8 + i * 30, 40, 14, 1.5)
  for (let i = 0; i < 12; i++) lampion(g, vm, 30 + i * 30, 12, 2.4, i, null, 1)

  const recul = lisse(0.72, 0.92, k) * (1 - lisse(0.985, 1, k))
  const rangs: ReadonlyArray<readonly [number, number, number]> = [[258, 9, 8.5], [276, 8, 10], [296, 7, 11.5]]
  rangs.forEach(([y, nb, rt], ri) => {
    for (let i = 0; i < nb; i++) {
      const x = ((i + 0.5 + (ri % 2) * 0.5) * W) / nb - (ri % 2 ? W / nb / 2 : 0)
      const dx = (x - 195) / 195
      const tx = x + dx * recul * 6
      const ty = y + recul * (4 + ri * 2) + (v.vivant ? Math.sin(v.t * 1.1 + i + ri) * 0.5 : 0)
      g.fillStyle = c('#0a0604')
      g.beginPath(); g.ellipse(x, y + rt * 1.8, rt * 1.7, rt, 0, Math.PI, 0); g.fill()
      cercle(g, tx, ty, rt * 0.8)
      if ((i + ri) % 3 === 0 && !(ri === 1 && i === 4 && k > 0.86)) {
        g.fillRect(tx - rt * 0.55, ty - rt * 1.9, rt * 1.1, rt * 1.2)
        g.fillRect(tx - rt, ty - rt * 0.75, rt * 2, rt * 0.22)
      } else if ((i + ri) % 3 === 1) {
        g.beginPath(); g.ellipse(tx, ty - rt * 0.6, rt * 1.2, rt * 0.4, 0, 0, TAU); g.fill()
      }
    }
  })
  // Le chapeau du deuxième rang qui s'envole quand le film arrive sur la salle.
  if (k > 0.86) {
    const u = (k - 0.86) / 0.14
    const x0 = ((4 + 0.5 + 0.5) * W) / 8 - W / 16
    const x = x0 + u * 40
    const y = 276 - 12 - u * 70 + u * u * 40
    const rt = 10
    g.save()
    g.translate(x, y)
    g.rotate(u * 5)
    g.fillStyle = c('#0a0604')
    g.fillRect(-rt * 0.55, -rt * 1.2, rt * 1.1, rt * 1.2)
    g.fillRect(-rt, -rt * 0.1, rt * 2, rt * 0.22)
    g.restore()
  }
}
