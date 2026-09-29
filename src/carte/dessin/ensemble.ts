import type { PlanCarte } from '../placement'
import type { EtatCarte } from '../moteur'
import type { Monde } from '../../mondes/types'
import type { EtatCase } from '../../voyage/regles'
import type { geoEnsemble } from '../ensemble'
import { TAU, rgba } from '../outils'

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
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
const cercle = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  g.beginPath()
  g.arc(x, y, Math.max(0, r), 0, TAU)
  g.fill()
}
const FAITS: readonly EtatCase[] = ['palme', 'lion', 'ours', 'passee']
const MEDAILLES: Record<string, string> = { palme: '#B8862B', lion: '#B9A57C', ours: '#8A5530' }

/** Une marquise, un an par étiquette d'une section détaillée, une décennie pour une repliée (maquette : `marquise`). */
function marquise(g: CanvasRenderingContext2D, x: number, y: number, etat: EtatCase, texte: string, e: number, accent: string): void {
  const w = 42
  const h = 17
  const fait = FAITS.includes(etat)
  const ici = etat === 'encours'
  g.save()
  g.globalAlpha = e
  g.translate(x, y)
  g.fillStyle = 'rgba(0,0,0,.5)'
  rr(g, -w / 2 + 1, -h / 2 + 2, w, h, 4)
  g.fill()
  g.fillStyle = ici ? '#2a0f0a' : fait ? '#1e150b' : '#141110'
  rr(g, -w / 2, -h / 2, w, h, 4)
  g.fill()
  g.strokeStyle = ici ? '#FF6B57' : fait ? accent : 'rgba(242,232,213,.2)'
  g.lineWidth = 1.2
  g.stroke()
  g.fillStyle = ici ? '#FF6B57' : fait ? '#F6D98A' : 'rgba(242,232,213,.4)'
  g.font = "800 10px 'Manrope', system-ui, sans-serif"
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(texte, 0, 0.5)
  g.textBaseline = 'alphabetic'
  if (MEDAILLES[etat]) {
    g.fillStyle = MEDAILLES[etat]!
    cercle(g, w / 2 - 1, -h / 2 + 1, 3.6)
    g.strokeStyle = 'rgba(0,0,0,.5)'
    g.lineWidth = 0.8
    g.stroke()
  }
  g.restore()
}

/**
 * La vue d'ensemble (maquette : `dessinerEnsemble`, `marquise`) : une bande par section aux
 * couleurs de `palette.fond`, une marquise par année dans une section détaillée, une seule pour
 * une section repliée. Ni collures ni bobines.
 */
export function dessinerEnsemble(g: CanvasRenderingContext2D, W: number, H: number, e: number, geo: ReturnType<typeof geoEnsemble>, plan: PlanCarte, etat: EtatCarte, mondeDe: (d: number) => Monde): void {
  g.globalAlpha = Math.min(1, e * 1.2)
  g.fillStyle = '#0b0806'
  g.fillRect(0, 0, W, H)
  g.globalAlpha = e
  const k = W / 390
  const parAnnee = new Map(etat.cases.map((c) => [c.annee, c]))
  const ici = plan.cases.find((c) => c.annee === etat.anneeAvatar)
  plan.sections.forEach((s, i) => {
    const bande = geo.bandes[i]
    if (!bande) return
    const monde = mondeDe(s.decennie)
    g.fillStyle = rgba(monde.palette.fond)
    rr(g, 10, bande.y0, W - 20, Math.max(4, bande.y1 - bande.y0), 10)
    g.fill()
    const detaillee = !monde.aVenir || ici?.section === i
    if (detaillee) {
      for (const c of plan.cases.filter((x) => x.section === i)) {
        const y = geo.versEcran(c.y)
        const e2 = parAnnee.get(c.annee)
        marquise(g, c.x * k, y, e2?.etat ?? 'verrou', String(c.annee), e, monde.palette.accent)
      }
    } else {
      marquise(g, W / 2, (bande.y0 + bande.y1) / 2, 'verrou', monde.nom, e, monde.palette.accent)
    }
  })
  g.globalAlpha = 1
}
