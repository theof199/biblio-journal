import type { VueEstrade } from '../types'
import { c } from './couleur'
import { vuePage } from './vuePage'
import { bonimenteur, cercle, guirlande, rr, texte } from './moyen'
import { hash } from '../../carte/outils'

const F_A = "'Limelight', Didot, Georgia, serif"
const F_T = "'Fraunces', Georgia, serif"
const F_F = "'IM Fell English', Georgia, serif"

/**
 * L'estrade du chroniqueur, au-dessus de sa feuille (maquette 1890 : `dessinEstrade`, lignes 2039 à
 * 2059) : le velours, les lampions, la poursuite, le panneau du Boniment, le bonimenteur qui se
 * tait, tape du pied en attendant (`tape`) ou parle, les ondes de sa voix, le public de dos.
 */
export function dessinerEstrade(v: VueEstrade): void {
  const g = v.ctx
  const W = v.W
  const h = v.H
  // L'estrade est éclairée à toute heure : ses lampions brillent comme la nuit.
  const vm = vuePage({ ctx: g, W, H: h, t: v.t, vivant: v.vivant, nuit: 1, touche: -9, annee: 0 })
  const frame = Math.floor(v.t * 16)

  const fond = g.createLinearGradient(0, 0, 0, h)
  fond.addColorStop(0, c('#4a1a12'))
  fond.addColorStop(1, c('#1d0c08'))
  g.fillStyle = fond
  g.fillRect(-8, -8, W + 16, h + 16)
  g.strokeStyle = c('#2a0c08', 0.6)
  g.lineWidth = 2
  for (let x = 10; x < W; x += 18) {
    g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (v.vivant ? Math.sin(v.t * 0.8 + x) * 2 : 0), h / 2, x, h); g.stroke()
  }
  guirlande(g, vm, -4, 12, 394, 8, 22, 10, 'lampion', 1)
  g.save()
  g.globalCompositeOperation = 'lighter'
  g.translate(118, 112)
  g.scale(1, 1.25)
  const poursuite = g.createRadialGradient(0, 0, 4, 0, 0, 82)
  poursuite.addColorStop(0, c('#F2D7A0', 0.42 * (v.vivant ? 0.92 + 0.08 * hash(frame) : 1)))
  poursuite.addColorStop(1, c('#F2D7A0', 0))
  g.fillStyle = poursuite
  cercle(g, 0, 0, 82)
  g.restore()

  g.fillStyle = c('#5a3e26')
  g.fillRect(-8, 150, W + 16, 50)
  g.fillStyle = c('#8a6a44')
  g.fillRect(-8, 148, W + 16, 4)
  g.strokeStyle = c('#2e2014', 0.8)
  g.lineWidth = 1
  for (let x = 20; x < W; x += 34) { g.beginPath(); g.moveTo(x, 152); g.lineTo(x, 200); g.stroke() }
  g.strokeStyle = c('#3a2819')
  g.lineWidth = 3
  g.beginPath(); g.moveTo(262, 150); g.lineTo(280, 56); g.moveTo(350, 150); g.lineTo(332, 56); g.stroke()
  g.fillStyle = c('#20150d')
  rr(g, 236, 46, 140, 88, 3)
  g.fill()
  g.strokeStyle = c('#E6B94A', 0.8)
  g.lineWidth = 1.5
  g.stroke()
  texte(g, 'LE BONIMENT', 306, 80, `17px ${F_A}`, c('#E6B94A'))
  texte(g, 'du chroniqueur', 306, 100, `italic 500 13px ${F_T}`, c('#F2E8D5'))
  texte(g, 'Entrée libre · ce soir', 306, 120, `11px ${F_F}`, c('#D9B382'))

  const parle = v.parle === 'parle'
  // Au repos, le bras se pose ; en attendant le texte, il bat la mesure (maquette : `D.repos`).
  const repos = v.parle === 'tape' ? 0.9 + (v.vivant ? Math.sin(v.t * 9) * 0.25 : 0) : 0.5
  bonimenteur(g, vm, 118, 150, 3.4, parle, repos)
  if (parle && v.vivant) {
    g.strokeStyle = c('#F2E8D5', 0.5)
    g.lineWidth = 1.6
    g.lineCap = 'round'
    for (let k = 0; k < 3; k++) {
      const ph = (v.t * 1.6 + k / 3) % 1
      const R = 10 + ph * 26
      g.globalAlpha = 1 - ph
      g.beginPath(); g.arc(128, 84, R, -0.55, 0.55); g.stroke()
    }
    g.globalAlpha = 1
  }
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 64 + hash(i) * 16
    const y = h + 4
    g.fillStyle = c('#080503')
    g.beginPath(); g.ellipse(x, y, 22, 14, 0, Math.PI, 0); g.fill()
    cercle(g, x, y - 18, 9)
    if (i % 2) { g.fillRect(x - 6, y - 36, 12, 13); g.fillRect(x - 11, y - 25, 22, 2.5) }
  }
}
