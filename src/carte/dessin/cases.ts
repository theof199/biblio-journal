import type { CaseCarte, Toile } from '../moteur'
import type { Monde } from '../../mondes/types'
import { TAU } from '../outils'

const CORAIL = '#FF6B57'

/** Maquette : `dessinerCase` et `colonne`, sans le corail (voir `dessinerCorail`). */
/** `affiche` rend l'affiche déjà traitée au goût du monde, nulle tant qu'elle charge. */
export function dessinerCase(g: CanvasRenderingContext2D, x: number, y: number, c: CaseCarte, monde: Monde, t: number, vivant: boolean, affiche: (url: string) => Toile | null): void {
  void t
  void vivant
  const p = monde.palette
  g.fillStyle = c.etat === 'verrou' ? p.caseVerrou.dessus[0] : p.caseFaite.dessus[0]
  g.beginPath()
  g.ellipse(x, y, 31, 19, 0, 0, TAU)
  g.fill()
  if (p.colonne) c.affiches.slice(0, 4).forEach((url, j) => {
    const a = affiche(url)
    if (a) g.drawImage(a as unknown as CanvasImageSource, x + 50 + (j % 2) * 14, y - 60 + (j >> 1) * 21, 13, 19)
  })
  if (c.etat !== 'encours') {
    g.fillStyle = p.caseFaite.plaque
    g.fillText(String(c.annee), x, y + 30)
  }
}

/** La couche corail de l'année en cours : la jauge, le millésime. */
export function dessinerCorail(g: CanvasRenderingContext2D, x: number, y: number, c: CaseCarte, t: number, vivant: boolean): void {
  void t
  void vivant
  if (c.jauge) {
    g.strokeStyle = CORAIL
    for (let j = 0; j < c.jauge.vus; j++) {
      g.beginPath()
      g.ellipse(x, y + 1, 40, 26, 0, j, j + 0.5)
      g.stroke()
    }
  }
  g.fillStyle = CORAIL
  g.fillRect(x - 20, y + 20, 40, 18)
  g.fillStyle = '#1b0e09'
  g.fillText(String(c.annee), x, y + 33)
}
