import type { VueBandeau } from '../types'
import { c } from './couleur'
import { vuePage } from './vuePage'
import { baraqueFacade, carrousel, foule, guichet, guirlande, plaque } from './moyen'
import { artifice } from './proches'
import { astre } from './ciel'
import { ampoules, remplissage } from './foire'
import { medaille } from '../../carte/dessin/cases'
import { dessinerRoulotte } from '../../carte/dessin/roulotte'
import { imageCommune } from '../../carte/images'
import { clamp, ease, hash, lerp, TAU } from '../../carte/outils'

// Le ciel de la carte (`ciel.ts`), recopié : le bandeau le peint sur sa propre hauteur (maquette : `ciel`).
const CIEL_N: readonly [string, string, string] = ['#1b1116', '#3a2a1e', '#2e2117']
const CIEL_J: readonly [string, string, string] = ['#b9a27e', '#a58a64', '#6e5a40']
const ETOILES = Array.from({ length: 46 }, (_, i) => ({
  x: hash(i * 3.1),
  y: hash(i * 7.7 + 1),
  r: 0.5 + hash(i * 1.3) * 1.1,
  p: hash(i * 5.5) * TAU,
  v: 0.6 + hash(i * 2.2) * 1.6,
}))

/** Le ciel du jour et de la nuit, et ses étoiles sur les `haut` premiers pixels (maquette : `ciel`, ligne 797). */
function ciel(g: CanvasRenderingContext2D, v: VueBandeau, h: number, haut: number): void {
  for (const [cols, a] of [[CIEL_J, 1], [CIEL_N, v.nuit]] as const) {
    if (a <= 0.01) continue
    const gr = g.createLinearGradient(0, 0, 0, h)
    gr.addColorStop(0, c(cols[0]))
    gr.addColorStop(Math.min(0.5, 260 / h), c(cols[1]))
    gr.addColorStop(1, c(cols[2]))
    g.globalAlpha = a
    g.fillStyle = gr
    g.fillRect(-8, -8, v.W + 16, h + 16)
  }
  g.globalAlpha = 1
  if (v.nuit > 0.05) {
    for (const e of ETOILES) {
      g.globalAlpha = v.nuit * (1 - e.y) * 0.6 * (v.vivant ? 0.55 + 0.45 * Math.sin(v.t * e.v + e.p) : 0.8)
      g.fillStyle = c('#F2E8D5')
      g.fillRect(e.x * v.W, e.y * haut, e.r, e.r)
    }
  }
  g.globalAlpha = 1
}

/**
 * Le bandeau d'une année (maquette 1890 : `dessinBandeau`, lignes 1933 à 1956) : le manège, la
 * baraque et le guichet de la foire, remplis par la carte, allumés ou fermés selon l'année ; le
 * feu d'artifice et la médaille d'une année bouclée ; la roulotte du Voyage suivi qui arrive en
 * attente, et qui traverse sinon, quand la page la donne.
 */
export function dessinerBandeau(v: VueBandeau): void {
  const g = v.ctx
  const h = v.H
  const m = v.mode
  const fermee = m === 'fermee'
  const vm = vuePage({ ctx: g, W: v.W, H: v.H, t: v.t, vivant: v.vivant, nuit: v.nuit, touche: v.touche, annee: v.annee })
  const r = remplissage(v.cases, v.bouclee)
  // L'angle du manège : l'intégrale de sa vitesse, 1 au repos, portée à 5 par un toucher et rappelée vers 1 (« Ce qui a été vérifié »).
  const angle = v.vivant ? 0.8 * (v.t + (v.touche >= 0 ? 8 * (1 - Math.exp(-0.5 * (v.t - v.touche))) : 0)) : 0
  // Le prédicat `quittee` du moteur (`carte/moteur.ts`) : une année ni en cours ni verrouillée.
  const quittees = v.cases.filter((k) => k.etat !== 'encours' && k.etat !== 'verrou').length
  const file = fermee ? 0 : 2 + Math.round(r * 6)

  ciel(g, v, h, 120)
  astre(g, vm, 34, 34, 12)
  if (m === 'bouclee') {
    artifice(g, vm, 70, 40, 3.3, 0)
    artifice(g, vm, 360, 30, 3.9, 0.5)
    artifice(g, vm, 170, 20, 4.4, 0.25)
  }
  g.save()
  if (fermee) g.globalAlpha = 0.5
  guirlande(g, vm, 392, 24, -4, 60, 22, 5 + Math.round(r * 4), 'fanion', 1)
  g.restore()
  carrousel(g, vm, 52, 214, 32, 150, angle, 6, fermee ? 0 : 1)
  g.save()
  g.translate(-92, 6)
  baraqueFacade(g, vm, { ampoules: ampoules(quittees, v.bouclee), file, lampes: 1, sansBoni: false, ferme: fermee ? 'verrou' : m === 'attente' ? 'attente' : undefined })
  g.restore()
  if (m === 'bouclee' && v.recompense) {
    const sw = v.vivant ? Math.sin(v.t * 1.8) * 0.12 : 0
    g.save()
    g.translate(208, 34)
    g.rotate(sw)
    g.strokeStyle = c('#6E2A1E')
    g.lineWidth = 1.4
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.stroke()
    medaille(g, v.recompense, 0, 34, 0, v.t, v.vivant, c)
    g.restore()
  }
  g.save()
  g.translate(346, 220)
  g.scale(0.6, 0.6)
  g.translate(-84, -608)
  guichet(g, vm)
  g.restore()
  const sol = g.createLinearGradient(0, 218, 0, h)
  sol.addColorStop(0, c('#3a2a1b'))
  sol.addColorStop(1, c('#1f160e'))
  g.fillStyle = sol
  g.fillRect(-8, 219, v.W + 16, h - 210)
  g.strokeStyle = c('#000000', 0.3)
  g.lineWidth = 1
  for (const y of [234, 247]) { g.beginPath(); g.moveTo(0, y); g.lineTo(v.W, y + 2); g.stroke() }
  if (!fermee) {
    guirlande(g, vm, 0, 112, 106, 104, 14, 2 + Math.round(r * 4), 'lampion', 1)
    foule(g, vm, Math.round(r * 8), 6, 120, 226, 3, 12)
  }
  const url = imageCommune('roulotte.webp')
  const planche = url ? vm.image(url) : null
  if (m === 'attente') {
    // Sans Voyage suivi, pas d'attente (`en_attente` n'est rendu qu'à qui suit une source) : aucune roulotte.
    if (v.roulotte) {
      const u = v.vivant ? clamp(v.t / 7, 0, 1) : 1
      const x = lerp(-110, 100, ease(u))
      dessinerRoulotte(g, x, 246, 1, u < 1 && v.vivant, v.t, v.vivant, 0.62, v.roulotte.pseudo, c, v.nuit, planche)
      if (u >= 1) plaque(g, x + 6, 192, `${v.roulotte.pseudo}, encore en ${v.roulotte.annee}`, c('#F2E8D5'), c('#151009'))
    }
  } else if (!fermee && v.roulotte) {
    const u = v.vivant ? (v.t / 22) % 1 : 0.62
    dessinerRoulotte(g, -130 + u * 660, 246, 1, v.vivant, v.t, v.vivant, 0.62, v.roulotte.pseudo, c, v.nuit, planche)
  }
  if (fermee) {
    g.fillStyle = c('#1a120b', 0.36)
    g.fillRect(-8, -8, v.W + 16, h + 16)
  }
}
