import type { VueMonde } from '../types'
import { c } from './couleur'
import { chantier, avancement } from './chantier'
import { remplissage } from './foire'
import { AMPOULE_Y, cercle, guirlande, halo, plaque, rr, silhouette, texte } from './moyen'
import { clamp, ease, hash, lisse, TAU } from '../../carte/outils'

const COULEURS_CONFETTIS: readonly string[] = [c('#A8452F'), c('#E6B94A'), c('#F2E8D5'), c('#3E5360'), c('#DE7A45')]
/** Une onde triangulaire, 0 aux bords, 1 au centre (maquette : `tri`). */
const tri = (u: number): number => 1 - Math.abs((((u % 1) + 1) % 1) * 2 - 1)

/** Les guirlandes de lampions de 1897, tendues de proche en proche puis allumées (maquette : `guirlandesLampions`). */
export function guirlandesLampions(g: CanvasRenderingContext2D, v: VueMonde, k97: number, r: number, seule: boolean): void {
  if (k97 <= 0) return
  const tend = lisse(0.5, 0.8, k97)
  const on = lisse(0.8, 0.92, k97)
  const G: Array<[number, number, number, number, number, number]> = [[6, 532, 178, 524, 18, 2 + Math.round(r * 8)]]
  if (!seule && r > 0.35) G.push([214, 436, 384, 428, 14, Math.round(r * 7)])
  if (!seule && r > 0.7) G.push([140, 652, 270, 642, 16, Math.round(r * 6)])
  for (const [x0, y0, x1, y1, cr, n] of G) {
    if (tend >= 1) { guirlande(g, v, x0, y0, x1, y1, cr, n, 'lampion', on); continue }
    g.save(); g.beginPath(); g.rect(x0 - 4, y0 - 20, (x1 - x0 + 8) * tend, 60); g.clip()
    guirlande(g, v, x0, y0, x1, y1, cr, n, 'lampion', on)
    g.restore()
  }
}

/** Un feu d'artifice (maquette : `artifice`). */
export function artifice(g: CanvasRenderingContext2D, v: VueMonde, cx: number, cy: number, per: number, ph: number, force = 1): void {
  const u = v.vivant ? (((v.t / per + ph) % 1) + 1) % 1 : 0.5 + ph * 0.3
  const a = force * (0.25 + 0.75 * v.nuit)
  if (u < 0.22) {
    const k = u / 0.22
    g.fillStyle = c('#F6D98A', 0.8 * a)
    cercle(g, cx, cy + 120 * (1 - k), 1.6)
    return
  }
  const k = (u - 0.22) / 0.78
  const R = 46 * Math.sqrt(k)
  const fad = 1 - k
  g.save(); g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 22; i++) {
    const an = (i / 22) * TAU + ph * 9
    const x = cx + Math.cos(an) * R
    const y = cy + Math.sin(an) * R + 30 * k * k
    g.fillStyle = c(i % 2 ? '#F6D98A' : '#FFE9C2', fad * a)
    cercle(g, x, y, 1.5 * fad + 0.4)
    g.fillStyle = c('#F6D98A', fad * a * 0.35)
    cercle(g, cx + Math.cos(an) * R * 0.7, cy + Math.sin(an) * R * 0.7 + 22 * k * k, 1)
  }
  g.restore()
}

/**
 * Le billet qui vole de la case qu'on vient de quitter vers son ampoule au fronton de la baraque
 * (maquette : `recompense`, retargetée sur `v.bati` : idée 8, aucune variable d'état). `v.cases`
 * est déjà en coordonnées d'écran (posé par le moteur) : ce plan-ci dessine hors du repère de
 * section, en écran, comme la case et l'ampoule qu'il relie.
 */
function recompense(g: CanvasRenderingContext2D, v: VueMonde): void {
  // En « moins d'animations », le billet est déjà arrivé : l'horloge figée le laisserait en l'air.
  if (!v.vivant || v.bati.nouvelle === null) return
  const u = v.t - v.bati.t0
  if (u < 0.65 || u >= 2.05) return
  const caseQuittee = v.cases[v.bati.nouvelle]
  if (!caseQuittee) return
  const p1 = { x: caseQuittee.x, y: caseQuittee.y - 92 }
  const p2 = { x: 285 * v.k, y: v.ecranY(AMPOULE_Y, 1) }
  let x: number, y: number, sc: number, rot: number
  if (u < 1.05) {
    const k = ease((u - 0.65) / 0.4)
    x = caseQuittee.x
    y = caseQuittee.y - 20 + (p1.y - (caseQuittee.y - 20)) * k
    sc = 0.6 + 0.6 * k
    rot = Math.sin(u * 9) * 0.2
  } else {
    const k = ease(clamp((u - 1.05) / 1, 0, 1))
    const mx = (p1.x + p2.x) / 2
    const my = Math.min(p1.y, p2.y) - 60
    x = (1 - k) * (1 - k) * p1.x + 2 * (1 - k) * k * mx + k * k * p2.x
    y = (1 - k) * (1 - k) * p1.y + 2 * (1 - k) * k * my + k * k * p2.y
    sc = 1.2 - 0.5 * k
    rot = Math.sin(u * 7) * 0.25 * (1 - k)
  }
  halo(g, x, y, 28, '#F6D98A', 0.4)
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc)
  g.fillStyle = c('#F2E8D5'); rr(g, -13, -7.5, 26, 15, 2); g.fill()
  g.fillStyle = c('#3a2a1e'); cercle(g, -13, 0, 2.6); cercle(g, 13, 0, 2.6)
  g.strokeStyle = c('#A8452F'); g.lineWidth = 1; rr(g, -10, -5, 20, 10, 1.5); g.stroke()
  texte(g, String(caseQuittee.annee), 0, 3, "600 7px 'Fraunces', Georgia, serif", c('#151009'))
  g.restore()
}

/** Le plan proche : les guirlandes de 1897, la promeneuse, le feu d'artifice à la décennie bouclée, le billet qui vole. */
export function dessinerProche(v: VueMonde): void {
  if (v.presence <= 0.01) return
  const g = v.ctx
  const k97 = avancement(chantier(1897, v.ouverte, v.t, v.vivant))
  const r = remplissage(v.cases, v.bouclee)
  g.save(); g.translate(0, v.ecranY(0, 1)); g.scale(v.k, 1)
  guirlandesLampions(g, v, k97, r, false)
  const u2 = v.vivant ? (v.t / 18) % 1 : 0.3
  silhouette(g, v, -24 + 206 * tri(u2), 640, 15, 'ombrelle', v.t * 5.2, v.vivant, u2 < 0.5 ? 1 : -1)
  // Idée 2 : le feu d'artifice part avec le tampon de la décennie, jamais d'un compte de films, jamais pendant l'adieu.
  if (v.bouclee && v.adieu < 0) {
    artifice(g, v, 90, 70, 3.1, 0)
    artifice(g, v, 310, 44, 3.7, 0.4)
    artifice(g, v, 200, 120, 4.3, 0.7)
    plaque(g, 195, 6, 'Fête complète · 1899 bouclée', c('#E6B94A'), c('#151009'))
    const frame = Math.floor(v.t * 16)
    if (v.vivant && hash(frame * 0.37) < 0.05) v.confettis((40 + hash(frame) * 310) * v.k, v.ecranY(240, 1), COULEURS_CONFETTIS)
  }
  g.restore()
  recompense(g, v)
}
