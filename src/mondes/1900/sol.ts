import type { VueMonde } from '../types'
import { c } from './couleur'
import { decalages, ouvrir } from './toiles'

const mod = (a: number, n: number) => ((a % n) + n) % n
/** L'entraxe des traverses et celui des poteaux télégraphiques, en pixels (maquette : `.ballast`, `poteauxSVG`). */
const TRAVERSE = 31
const POTEAU = 450

/**
 * La courroie du ballast, la plus rapide (rapport 1 ; maquette : `.ballast`, l. 127-133 et 3075) :
 * le remblai, les traverses qui défilent, les deux rails. Aucune porte : la section finit en gare.
 */
export function dessinerSol(v: VueMonde): void {
  if (!ouvrir(v)) return
  const g = v.ctx
  const h = v.H * 0.22
  const y = v.H - h
  const remblai = g.createLinearGradient(0, y - h * 0.17, 0, y)
  remblai.addColorStop(0, c('#5f5040', 0))
  remblai.addColorStop(0.6, c('#5f5040', 0.7))
  remblai.addColorStop(1, c('#5f5040'))
  g.fillStyle = remblai
  g.fillRect(0, y - h * 0.17, v.W, h * 0.17)
  const corps = g.createLinearGradient(0, y, 0, v.H)
  corps.addColorStop(0, c('#5f5040'))
  corps.addColorStop(0.55, c('#3c2f22'))
  corps.addColorStop(1, c('#221910'))
  g.fillStyle = corps
  g.fillRect(0, y, v.W, h)
  g.fillStyle = c('#18100a', 0.8)
  for (let x = -mod(decalages(v.avance).ballast, TRAVERSE); x < v.W; x += TRAVERSE) g.fillRect(x, y, 7, h * 0.32)
  for (const [haut, bas] of [[0.12, '#3a2f25'], [0.38, '#2a2119']] as const) {
    g.fillStyle = c('#b9b2a2')
    g.fillRect(0, y + h * haut, v.W, h * 0.02)
    g.fillStyle = c(bas)
    g.fillRect(0, y + h * (haut + 0.02), v.W, h * 0.025)
  }
  g.restore()
}

/**
 * Les poteaux télégraphiques et leurs fils, au premier plan, à la vitesse du ballast (maquette :
 * `poteauxSVG`, l. 2871-2883, et l. 3077).
 */
export function dessinerProche(v: VueMonde): void {
  if (!ouvrir(v)) return
  const g = v.ctx
  const tete = Math.max(v.H * 0.19, 134)
  const pied = v.H * 0.83
  const encre = c('#1d150e')
  for (let x = -mod(decalages(v.avance).ballast + 8, POTEAU); x < v.W; x += POTEAU) {
    g.save()
    g.translate(x, 0)
    g.fillStyle = encre
    g.beginPath()
    g.moveTo(20, tete)
    g.lineTo(28, tete)
    g.lineTo(31, pied)
    g.lineTo(17, pied)
    g.closePath()
    g.fill()
    g.fillRect(6, tete + 10, 36, 4)
    g.fillRect(9, tete + 19, 30, 3)
    g.fillStyle = c('#cfc5b0')
    for (const [ix, iy] of [[9, 9], [39, 9], [24, 8]] as const) {
      g.beginPath()
      g.arc(ix, tete + iy, 2.6, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = c('#1d150e', 0.85)
    g.lineWidth = 1.3
    for (let k = 0; k < 3; k++) {
      const fy = tete + 14 + k * 9
      g.beginPath()
      g.moveTo(24, fy)
      g.quadraticCurveTo(POTEAU / 2 + 12, fy + 20 + k * 2, POTEAU + 24, fy)
      g.stroke()
    }
    g.restore()
  }
  g.restore()
}
