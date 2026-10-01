import type { VueMonument } from '../types'
import { c } from './couleur'
import { vuePage } from './vuePage'
import { cheval, foule, guirlande, lampion, ombre, plaque, poly } from './moyen'
import { astre } from './ciel'
import { ciel } from './bandeau'
import { CORAIL, medaille } from '../../carte/dessin/cases'
import { clamp, TAU } from '../../carte/outils'

/** L'état du manège d'une toile : son angle, sa vitesse, l'instant de la dernière image et le dernier toucher vu. */
export interface EtatManege {
  a: number
  v: number
  t: number
  touche: number
}

/** Le manège au départ (maquette : `{ a: .4, v: 1 }`), sans toucher vu. */
export const departDuManege = (t: number): EtatManege => ({ a: 0.4, v: 1, t, touche: -9 })

/**
 * L'angle du manège au calme (décision du propriétaire du 1er octobre 2026, 2c-2) : à l'angle de
 * départ de la maquette, le cheval de 1897 restait pour toujours derrière le pilier. À un demi-tour
 * moins un degré, aucun cheval n'est derrière le pilier : 1895 et 1890 aux flancs, les quatre autres
 * années du Voyage devant, avec leur plaque, et 1891 à 1894 derrière, entre le pilier et les flancs,
 * où le haut de chacun reste à découvert sous le doigt. Le degré retiré écarte les flancs du plan
 * médian (un cheval à `z` nul serait de devant ou de derrière selon l'arrondi) et décale chaque
 * cheval de derrière de celui de devant qui partagerait son abscisse.
 */
export const ANGLE_AU_CALME = (179 * Math.PI) / 180

/**
 * Un pas du manège (maquette : `dessinManege`, `D.a += D.v × dt × 0,3`, la vitesse rappelée vers 1 ;
 * `D.v = 6` au toucher). Pas à pas, jamais une formule close depuis le dernier toucher : un second
 * toucher y ramènerait le manège en arrière. `dt` est borné à un dixième de seconde, pour qu'une toile
 * revenue à l'écran ne fasse pas un tour d'un coup ; au calme, rien ne tourne.
 */
export function avancerManege(etat: EtatManege, o: { t: number; touche: number; vivant: boolean }): EtatManege {
  if (!o.vivant) return { ...etat, t: o.t, touche: o.touche }
  const dt = clamp(o.t - etat.t, 0, 0.1)
  const v = o.touche >= 0 && o.touche !== etat.touche ? 6 : etat.v
  return { a: etat.a + v * dt * 0.3, v: v + (1 - v) * Math.min(1, dt * 0.5), t: o.t, touche: o.touche }
}

/** Une toile, un manège : l'état vit d'une image à l'autre, rangé par le contexte de sa toile. */
const ETATS = new WeakMap<CanvasRenderingContext2D, EtatManege>()

const RECOMPENSES: readonly string[] = ['palme', 'lion', 'ours']

/**
 * Le manège des années (maquette 1890 : `dessinManege`, lignes 1958 à 1999) : un cheval de bois par
 * année de la décennie, brut avant le Voyage, médaillé, en cours (le corail, jamais teinté), passé,
 * vu en avance, en attente du Voyage suivi (terne, le pointillé or de la carte) ou bâché ; ses lampions s'allument à la part des années qui portent leur récompense.
 * Chaque cheval inscrit sa figure (`v.zone`), devant comme derrière, et dit son plan.
 */
export function dessinerMonument(v: VueMonument): void {
  const g = v.ctx
  const h = v.H
  const etat = avancerManege(ETATS.get(g) ?? departDuManege(v.t), { t: v.t, touche: v.touche, vivant: v.vivant })
  ETATS.set(g, etat)
  const angle = v.vivant ? etat.a : ANGLE_AU_CALME
  const vm = vuePage({ ctx: g, W: v.W, H: v.H, t: v.t, vivant: v.vivant, nuit: v.nuit, touche: -9, annee: v.annees[0]!.annee })
  const ratio = v.cases.length ? v.cases.filter((k) => RECOMPENSES.includes(k.etat)).length / v.cases.length : 0

  ciel(g, v, h, 140)
  astre(g, vm, 346, 40, 14)
  guirlande(g, vm, -4, 26, 394, 22, 30, 9, 'fanion', 1)
  const cx = 195
  const base = 280
  const R = 128
  const top = 88
  const eave = 132
  const ry = 20
  ombre(g, cx + 4, base + 8, R + 24, 22)
  g.fillStyle = c('#3a2819'); g.beginPath(); g.ellipse(cx, base, R + 18, 26, 0, 0, TAU); g.fill()
  g.fillStyle = c('#5a3e26'); g.beginPath(); g.ellipse(cx, base - 5, R + 18, 26, 0, 0, TAU); g.fill()
  const chevaux = v.annees.map((n, i) => {
    const b = angle + (i * TAU) / 10
    return { n, i, b, z: Math.sin(b) }
  }).sort((p, q) => p.z - q.z)

  const unCheval = (k: (typeof chevaux)[number]) => {
    const x = cx + Math.cos(k.b) * R
    const yb = base - 46 + k.z * ry
    const bob = v.vivant ? Math.sin(k.b * 3 + k.i) * 5 : 0
    const sc = 1.55 * (0.8 + (0.2 * (k.z + 1)) / 2)
    g.strokeStyle = c('#B8862B'); g.lineWidth = 1.6
    g.beginPath(); g.moveTo(x, eave + k.z * 8); g.lineTo(x, base - 6 + k.z * ry); g.stroke()
    const e = k.n.etat
    const recompense = RECOMPENSES.includes(e)
    // En attente du Voyage suivi : terne comme une année fermée, sans bâche (la case de la carte,
    // `dessinerCase`, se dessine de même, sans cadenas) ; jamais le corail de l'année en cours.
    const terne = e === 'avant' || e === 'verrou' || e === 'attente'
    const coul = e === 'avant' || e === 'passee' ? c('#8a6a44') : recompense ? c('#E9DCC0') : e === 'avance' ? c('#D9B382') : e === 'verrou' || e === 'attente' ? c('#2b1c14') : CORAIL
    g.save(); g.translate(x, yb + bob); g.scale((k.z > 0 ? -1 : 1) * sc, sc)
    g.fillStyle = g.strokeStyle = coul
    g.globalAlpha = e === 'avant' ? 0.75 : 1
    cheval(g, 1.1 + k.i * 0.3)
    g.globalAlpha = 1
    if (e === 'verrou') {
      g.fillStyle = c('#4a3321'); poly(g, [[-9, -3], [9, -3], [11, 7], [-11, 7]]); g.fill()
      g.strokeStyle = c('#E9DCC0', 0.3); g.lineWidth = 0.6
      g.beginPath(); g.moveTo(-9, 2); g.lineTo(9, 2); g.stroke()
    }
    g.restore()
    if (recompense) {
      g.save(); g.translate(x, yb + bob - 26); g.scale(0.62, 0.62)
      medaille(g, e, 0, 0, k.i, v.t, v.vivant, c)
      g.restore()
    }
    if (e === 'encours') {
      // Le corail n'est jamais teinté : son opacité passe par `globalAlpha`, pas par la rampe.
      g.strokeStyle = CORAIL; g.globalAlpha = 0.9; g.lineWidth = 2
      g.beginPath(); g.ellipse(x, yb + bob + 16, 16, 4, 0, 0, TAU); g.stroke()
      g.globalAlpha = 1
    }
    if (e === 'attente') {
      // Le pointillé or de la carte, à la place de l'anneau corail.
      g.save(); g.setLineDash([3, 3]); g.strokeStyle = c('#E6B94A', 0.8); g.lineWidth = 1.3
      g.beginPath(); g.ellipse(x, yb + bob + 16, 16, 4, 0, 0, TAU); g.stroke()
      g.restore()
    }
    if (k.z > -0.35) {
      const fond = e === 'encours' ? CORAIL : terne ? c('#150F09', 0.75) : c('#F2E8D5')
      plaque(g, x, yb + bob + 20, String(k.n.annee), fond, terne ? c('#F2E8D5', 0.6) : c('#151009'))
    }
    // Devant : peint après le pilier, comme `chevaux.filter((k) => k.z >= 0)` plus bas.
    v.zone(k.n.annee, x, yb + bob, 30, k.z >= 0)
  }

  chevaux.filter((k) => k.z < 0).forEach(unCheval)
  g.fillStyle = c('#6b4a2a'); g.fillRect(cx - 18, eave, 36, base - eave - 8)
  for (let k = 0; k < 5; k++) {
    g.fillStyle = c('#F2E2BE', 0.18 + 0.25 * v.nuit * (v.vivant ? 0.6 + 0.4 * Math.sin(v.t * 3 + k) : 0.8))
    g.fillRect(cx - 13, eave + 10 + k * 22, 26, 12)
  }
  chevaux.filter((k) => k.z >= 0).forEach(unCheval)

  // Le toit : seize pans, triés du fond vers l'avant.
  const n = 16
  const pp: { b: number; x: number; y: number }[] = []
  for (let i = 0; i <= n; i++) {
    const b = angle * 0.999 + (i * TAU) / n
    pp.push({ b, x: cx + Math.cos(b) * (R + 16), y: eave + Math.sin(b) * 12 })
  }
  const pans: [(typeof pp)[number], (typeof pp)[number], number][] = []
  for (let i = 0; i < n; i++) pans.push([pp[i]!, pp[i + 1]!, i])
  pans.sort((p, q) => Math.sin((p[0].b + p[1].b) / 2) - Math.sin((q[0].b + q[1].b) / 2))
  for (const [p, q, i] of pans) {
    g.fillStyle = c(i % 2 ? '#E9DCC0' : '#A8452F')
    poly(g, [[cx, top], [p.x, p.y], [q.x, q.y]]); g.fill()
  }
  g.fillStyle = c('#7A1F1A')
  for (let i = 0; i < 16; i++) {
    const x = cx - R - 16 + ((i + 0.5) * (2 * R + 32)) / 16
    g.beginPath(); g.arc(x, eave + 9, (2 * R + 32) / 32, 0, Math.PI); g.fill()
  }
  g.strokeStyle = c('#2b1c14'); g.lineWidth = 2
  g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, top - 18); g.stroke()
  const w = v.vivant ? Math.sin(v.t * 5) * 3 : 0
  g.fillStyle = c('#E6B94A'); poly(g, [[cx, top - 18], [cx + 16, top - 14 + w], [cx, top - 9]]); g.fill()
  const allumes = Math.round(ratio * 16)
  for (let i = 0; i < 16; i++) {
    const b = (i * TAU) / 16 + angle
    if (Math.sin(b) < -0.25) continue
    lampion(g, vm, cx + Math.cos(b) * (R + 16), eave + Math.sin(b) * 12 + 4, 2.6, i, null, i < allumes ? 1 : 0)
  }
  foule(g, vm, 3 + Math.round(ratio * 8), 8, 382, 306, 11, 15)
}
