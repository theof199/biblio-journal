import type { VueGuichet } from '../types'
import { c } from './couleur'
import { vuePage } from './vuePage'
import { guichet, guirlande } from './moyen'
import { astre } from './ciel'
import { ciel } from './bandeau'
import { clamp } from '../../carte/outils'

/**
 * Le bandeau du guichet, sur la recherche du Voyage (maquette 1890 : `dessinGuichet`, lignes 2061 à
 * 2068) : la palissade, les fanions et les lampions, et le guichet de 1897 dont le guichetier se
 * penche, lampe ravivée, à chaque lettre tapée ; au calme, il ne bouge pas.
 */
export function dessinerGuichet(v: VueGuichet): void {
  const g = v.ctx
  const h = v.H
  // Aucune année ici : le guichet n'en ouvre aucune, la vue n'en a besoin que pour son rideau.
  const vm = vuePage({ ctx: g, W: v.W, H: v.H, t: v.t, vivant: v.vivant, nuit: v.nuit, touche: -9, annee: 0 })
  ciel(g, v, h, 70)
  astre(g, vm, 46, 30, 11)
  g.fillStyle = c('#4a3321'); g.fillRect(-8, 56, v.W + 16, h)
  g.strokeStyle = c('#2e2014', 0.8); g.lineWidth = 1
  for (let x = 6; x < v.W; x += 13) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x, h); g.stroke() }
  guirlande(g, vm, -4, 20, 394, 24, 26, 8, 'fanion', 1)
  guirlande(g, vm, -4, 64, 120, 58, 12, 4, 'lampion', 1)
  guirlande(g, vm, 270, 58, 394, 64, 12, 4, 'lampion', 1)
  const p = v.vivant && v.frappe >= 0 ? clamp(1 - (v.t - v.frappe) / 1.2, 0, 1) : 0
  g.save(); g.translate(195, 134); g.scale(1.25, 1.25); g.translate(-84, -608)
  guichet(g, vm, p, 1 + p * 0.9)
  g.restore()
}
