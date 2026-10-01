import { TAU } from '../outils'

/**
 * Les bobines perdues (plan 2d ; maquette carte v2 : `dessinerBobine`, `bobinePerdue`,
 * `lueurBrume`, `dessinerVol`, lignes 1365-1400 et 1700-1706). Le monde dit où il les cache
 * (`VueMonde.bobine`) ; le moteur les dessine ici, et fait voler vers le HUD celle qu'on ramasse.
 */

type Couleur = (hex: string, a?: number) => string
const telle: Couleur = (hex, a = 1) => (a >= 1 ? hex : `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`)

const cercle = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  g.beginPath()
  g.arc(x, y, Math.max(0, r), 0, TAU)
  g.fill()
}
const etoile4 = (g: CanvasRenderingContext2D, x: number, y: number, s: number): void => {
  const pts: Array<[number, number]> = [[x, y - s], [x + s * 0.22, y - s * 0.22], [x + s, y], [x + s * 0.22, y + s * 0.22], [x, y + s], [x - s * 0.22, y + s * 0.22], [x - s, y], [x - s * 0.22, y - s * 0.22]]
  g.beginPath()
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)))
  g.closePath()
  g.fill()
}

/** Une bobine à cinq trous : terne quand elle traîne dans le décor, dorée quand elle vole (maquette : `dessinerBobine`). */
export function dessinerBobine(g: CanvasRenderingContext2D, r: number, dore: boolean, c: Couleur = telle): void {
  g.fillStyle = dore ? c('#b8862b') : c('#2a2520')
  cercle(g, 0, 0, r)
  g.fillStyle = dore ? c('#F6D98A') : c('#6b6258')
  cercle(g, 0, 0, r * 0.82)
  g.fillStyle = dore ? c('#6B4712') : c('#2a2520')
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2
    cercle(g, Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, r * 0.19)
  }
  cercle(g, 0, 0, r * 0.13)
  g.strokeStyle = dore ? c('#FFF5D2', 0.7) : c('#F2E8D5', 0.35)
  g.lineWidth = 0.6
  g.beginPath()
  g.arc(0, 0, r, 0, TAU)
  g.stroke()
}

/**
 * Une bobine perdue posée dans le décor, son bout de pellicule déroulé, et un éclat qui la trahit
 * de temps en temps (maquette : `bobinePerdue`). Quand rien ne bouge, ni éclat ni rien qui dépende
 * de l'horloge : la bobine reste où elle est, telle quelle.
 */
export function dessinerBobinePerdue(g: CanvasRenderingContext2D, lx: number, ly: number, r: number, rang: number, t: number, vivant: boolean, c: Couleur): void {
  g.save()
  g.translate(lx, ly)
  g.save()
  g.rotate(0.5)
  g.fillStyle = c('#16120e')
  g.fillRect(r * 0.5, -r * 0.24, r * 1.3, r * 0.48)
  g.restore()
  dessinerBobine(g, r, false, c)
  if (vivant) {
    const ph = (t * 0.42 + rang * 0.33) % 1
    if (ph < 0.14) {
      const e = Math.sin((ph / 0.14) * Math.PI)
      g.globalCompositeOperation = 'lighter'
      g.fillStyle = c('#FFF4D6', 0.9 * e)
      etoile4(g, -r * 0.45, -r * 0.45, r * 0.9 * e)
      g.globalCompositeOperation = 'source-over'
    }
  }
  g.restore()
}

/**
 * La lueur d'une bobine qu'on ne voit pas : un éclat qui perce la brume, par-dessus elle (maquette :
 * `lueurBrume`). Rien quand rien ne bouge : la brume reste muette.
 */
export function lueurDansLaBrume(g: CanvasRenderingContext2D, x: number, y: number, t: number, vivant: boolean, c: Couleur): void {
  if (!vivant) return
  const ph = (t * 0.36) % 1
  if (ph > 0.16) return
  const e = Math.sin((ph / 0.16) * Math.PI)
  g.save()
  g.globalCompositeOperation = 'lighter'
  g.fillStyle = c('#FFECBE', 0.16 * e)
  cercle(g, x, y, 18)
  g.fillStyle = c('#FFF6DE', 0.85 * e)
  etoile4(g, x - 3, y - 3, 7 * e)
  g.restore()
}

/** La bobine qui vole vers le HUD, dorée, qui tourne et rapetisse en arrivant (maquette : `dessinerVol`). */
export function dessinerEnvol(g: CanvasRenderingContext2D, x: number, y: number, e: number, t: number): void {
  const sc = 1.8 + (0.7 - 1.8) * e
  g.save()
  g.translate(x, y)
  g.globalCompositeOperation = 'lighter'
  g.fillStyle = 'rgba(246,217,138,.28)'
  cercle(g, 0, 0, 16 * sc)
  g.globalCompositeOperation = 'source-over'
  g.rotate(t * 9)
  g.scale(sc, sc)
  dessinerBobine(g, 8, true)
  g.restore()
}
