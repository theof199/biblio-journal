import { pointA, type Route } from '../route'
import type { PlanCarte, SectionPlacee } from '../placement'
import type { EtatCarte } from '../moteur'
import type { Monde, Palette } from '../../mondes/types'
import { hash } from '../outils'

export const TUILE = 512

/** Une bande de la carte, de `y0` (compris) à `y1` (exclu), en `y` de carte. */
export interface Bande {
  y0: number
  y1: number
}
/** Plus loin que toute carte : le bord d'une bande qui n'en a pas. */
const LOIN = 1e6

/**
 * Les bandes de la carte où le sol se dessine (plan 3a) : tout, sauf les sections collantes
 * (`Monde.scene`), dont le monde dessine lui-même les années. Nul sans section collante : rien à
 * couper, et le dessin reste celui d'avant, appel pour appel.
 */
export function bandesDuSol(sections: readonly SectionPlacee[], mondeDe: (d: number) => Monde): Bande[] | null {
  const collantes = sections.filter((s) => mondeDe(s.decennie).scene !== null)
  if (collantes.length === 0) return null
  const bandes: Bande[] = []
  let haut = -LOIN
  for (const s of collantes) {
    if (s.y0 > haut) bandes.push({ y0: haut, y1: s.y0 })
    haut = s.y0 + s.hauteur
  }
  bandes.push({ y0: haut, y1: haut + LOIN })
  return bandes
}

/**
 * Coupe le dessin aux bandes : net, au pixel. `dy` ramène un `y` de carte au repère courant
 * (`-camY` à l'écran, 0 dans une tuile) ; `x` et `w` bornent la coupe en largeur. À poser entre un
 * `save` et son `restore`.
 */
export function couperAuxBandes(g: CanvasRenderingContext2D, bandes: readonly Bande[], dy: number, x: number, w: number): void {
  g.beginPath()
  for (const b of bandes) g.rect(x, b.y0 + dy, w, b.y1 - b.y0)
  g.clip()
}

/** Un dégradé vertical, une couleur par section, un fondu de `FADE` px à chaque frontière. */
function degradeSection(g: CanvasRenderingContext2D, hauteur: number, sections: readonly SectionPlacee[], mondeDe: (d: number) => Monde, lire: (p: Palette['route']) => string): CanvasGradient {
  const FADE = 240
  const h = hauteur || 1
  const gr = g.createLinearGradient(0, 0, 0, h)
  const bornee = (y: number) => Math.min(1, Math.max(0, y / h))
  sections.forEach((s, i) => {
    const couleur = lire(mondeDe(s.decennie).palette.route)
    const y0 = s.y0
    const y1 = s.y0 + s.hauteur
    const suivante = sections[i + 1]
    gr.addColorStop(bornee(y0), couleur)
    if (suivante) {
      const debut = Math.max(y0, y1 - FADE / 2)
      const fin = Math.min(suivante.y0 + suivante.hauteur, y1 + FADE / 2)
      gr.addColorStop(bornee(debut), couleur)
      gr.addColorStop(bornee(fin), lire(mondeDe(suivante.decennie).palette.route))
    } else {
      gr.addColorStop(bornee(y1), couleur)
    }
  })
  return gr
}

/**
 * Le sol : la route en pellicule, ses photogrammes qui s'allument à mesure que l'année se
 * remplit (maquette : `sol`, sans ses trois dernières lignes — le pointillé doré du chemin
 * parcouru vit dans `Effets.parcouru`). Chaque courbe se colore aux teintes de `palette.route` de
 * la section qu'elle traverse, fondues sur 240 px aux frontières.
 *
 * Le sol entier est coupé net au haut d'une section collante (`bandesDuSol`). Rien n'est sauté pour
 * autant : les photogrammes qui mènent à la première année d'une section collante se dessinent
 * comme les autres, et la coupe les arrête à la frontière.
 */
export function dessinerSol(x: CanvasRenderingContext2D, chemin: Path2D, route: Route, plan: PlanCarte, etat: EtatCarte, mondeDe: (d: number) => Monde): void {
  const g = x
  g.save()
  const bandes = bandesDuSol(plan.sections, mondeDe)
  if (bandes) couperAuxBandes(g, bandes, 0, -LOIN, 2 * LOIN)
  g.lineJoin = 'round'
  g.save()
  g.translate(4, 9)
  g.strokeStyle = 'rgba(0,0,0,.34)'
  g.lineWidth = 56
  g.stroke(chemin)
  g.restore()
  g.strokeStyle = degradeSection(g, plan.hauteur, plan.sections, mondeDe, (p) => p.bord)
  g.lineWidth = 50
  g.stroke(chemin)
  g.strokeStyle = degradeSection(g, plan.hauteur, plan.sections, mondeDe, (p) => p.fond)
  g.lineWidth = 45
  g.stroke(chemin)
  g.setLineDash([4, 7])
  g.strokeStyle = degradeSection(g, plan.hauteur, plan.sections, mondeDe, (p) => p.perforations)
  g.lineWidth = 40
  g.stroke(chemin)
  g.setLineDash([])
  g.strokeStyle = degradeSection(g, plan.hauteur, plan.sections, mondeDe, (p) => p.coeur)
  g.lineWidth = 29
  g.stroke(chemin)
  g.setLineDash([2, 24])
  g.strokeStyle = 'rgba(0,0,0,.6)'
  g.stroke(chemin)
  g.setLineDash([])
  g.globalCompositeOperation = 'lighter'
  const parAnnee = new Map(etat.cases.map((c) => [c.annee, c]))
  plan.cases.forEach((c, i) => {
    const e = parAnnee.get(c.annee)
    if (!e || e.etat === 'verrou') return
    const dens = Math.min(e.profondeur, 30) / 30
    // Les photogrammes allumés passent par la rampe du monde de leur année (maquette : `C('#FFDEA0', …)`).
    const couleur = mondeDe(plan.sections[c.section]!.decennie).couleur
    const d0 = i ? (route.dWay[plan.cases[i - 1]!.w] ?? 0) + 34 : 0
    const d1 = (route.dWay[c.w] ?? 0) - 36
    for (let j = Math.ceil((d0 - 13) / 26); 13 + 26 * j < d1; j++) {
      if (hash(c.annee * 7.3 + j * 1.7) > 0.2 + 0.8 * dens) continue
      const dc = 13 + 26 * j
      const p = pointA(route, dc)
      const a = pointA(route, dc - 3)
      const b = pointA(route, dc + 3)
      g.save()
      g.translate(p.x, p.y)
      g.rotate(Math.atan2(b.y - a.y, b.x - a.x))
      g.fillStyle = couleur('#FFDEA0', 0.14 + 0.3 * dens * (0.6 + 0.4 * hash(j + c.annee)))
      g.fillRect(-10, -9.5, 20, 19)
      g.fillStyle = couleur('#FFF6DE', 0.08 + 0.12 * dens)
      g.fillRect(-5.5, -5.5, 11, 11)
      g.restore()
    }
  })
  g.restore()
}
