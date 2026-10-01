import type { CaseCarte, Toile } from '../moteur'
import type { Monde } from '../../mondes/types'
import { TAU } from '../outils'

export const CORAIL = '#FF6B57'

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
const poly = (g: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>): void => {
  g.beginPath()
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
}
const ombre = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.4): void => {
  g.fillStyle = `rgba(0,0,0,${a})`
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, TAU)
  g.fill()
}
/** Maquette : `plaque` — une pastille, un fond, une encre, un bord facultatif. */
const plaque = (g: CanvasRenderingContext2D, x: number, y: number, s: string, fond: string, encre: string, bord?: string): void => {
  g.font = "600 11.5px 'Fraunces', Georgia, serif"
  const w = Math.max(40, g.measureText(s).width + 16)
  g.fillStyle = 'rgba(0,0,0,.35)'
  rr(g, x - w / 2 + 1, y + 2, w, 18, 9)
  g.fill()
  g.fillStyle = fond
  rr(g, x - w / 2, y, w, 18, 9)
  g.fill()
  if (bord) {
    g.strokeStyle = bord
    g.lineWidth = 1
    g.stroke()
  }
  g.fillStyle = encre
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillText(s, x, y + 13)
}

export const MEDAILLES: Record<string, readonly [string, string, string]> = {
  palme: ['#FBE3A0', '#B8862B', '#6B4712'],
  lion: ['#F8EFDC', '#B9A57C', '#5A4A2E'],
  ours: ['#EBB684', '#8A5530', '#4A2A12'],
}
function glyphe(g: CanvasRenderingContext2D, type: string, c: string): void {
  g.strokeStyle = c
  g.fillStyle = c
  g.lineCap = 'round'
  if (type === 'palme') {
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(-1, 8)
    g.quadraticCurveTo(0, 0, 4, -8)
    g.stroke()
    g.lineWidth = 1.2
    for (let i = 0; i < 4; i++) {
      const yy = 5 - i * 3.6
      const xx = -0.6 + i * 1.1
      g.beginPath()
      g.moveTo(xx, yy)
      g.lineTo(xx - 5 + i * 0.5, yy - 2.6)
      g.moveTo(xx, yy)
      g.lineTo(xx + 4.5 - i * 0.4, yy - 3.4)
      g.stroke()
    }
  } else if (type === 'lion') {
    g.beginPath()
    for (let i = 0; i < 20; i++) {
      const an = (i / 20) * TAU
      const r = i % 2 ? 6.2 : 8.4
      g.lineTo(Math.cos(an) * r, Math.sin(an) * r)
    }
    g.closePath()
    g.globalAlpha *= 0.55
    g.fill()
    g.globalAlpha /= 0.55
    cercle(g, 0, 0.5, 4.4)
    g.fillStyle = 'rgba(255,245,220,.5)'
    cercle(g, 0, 2.2, 1.8)
  } else {
    cercle(g, -4.8, -4.6, 2.6)
    cercle(g, 4.8, -4.6, 2.6)
    cercle(g, 0, 0.8, 6.2)
    g.fillStyle = 'rgba(255,240,215,.45)'
    g.beginPath()
    g.ellipse(0, 3, 2.6, 2, 0, 0, TAU)
    g.fill()
  }
}
/** La médaille qui flotte au-dessus d'une année récompensée (maquette : `medaille`), aux couleurs du monde. */
export function medaille(g: CanvasRenderingContext2D, type: string, x: number, y: number, i: number, t: number, vivant: boolean, couleur: Monde['couleur']): void {
  const [c0, c1, c2] = MEDAILLES[type]!
  g.save()
  g.translate(x, y)
  g.fillStyle = couleur('#6E2A1E')
  poly(g, [
    [-7, 6],
    [-11, 22],
    [-6, 19],
    [-3, 23],
    [0, 8],
  ])
  g.fill()
  poly(g, [
    [7, 6],
    [11, 22],
    [6, 19],
    [3, 23],
    [0, 8],
  ])
  g.fill()
  const gr = g.createRadialGradient(-4, -5, 1, 0, 0, 14)
  gr.addColorStop(0, couleur(c0))
  gr.addColorStop(1, couleur(c1))
  g.fillStyle = 'rgba(0,0,0,.35)'
  cercle(g, 1, 2, 14)
  g.fillStyle = gr
  cercle(g, 0, 0, 13.5)
  g.strokeStyle = couleur(c2)
  g.lineWidth = 1
  g.beginPath()
  g.arc(0, 0, 10.8, 0, TAU)
  g.stroke()
  glyphe(g, type, couleur(c2))
  if (vivant) {
    const p = (((t * 0.32 + i * 0.23) % 1) * 3) - 1
    if (p > -1 && p < 1.2) {
      g.save()
      g.beginPath()
      g.arc(0, 0, 13.5, 0, TAU)
      g.clip()
      g.rotate(0.6)
      g.fillStyle = couleur('#FFFFF0', 0.45)
      g.fillRect(p * 16 - 3, -16, 5, 32)
      g.restore()
    }
  }
  g.restore()
}

/** Une affiche vierge, papier, quand `profondeur` demande plus d'affiches que l'année n'en a de traitées. */
function afficheVierge(g: CanvasRenderingContext2D, x: number, y: number, couleur: Monde['couleur']): void {
  g.fillStyle = couleur('#EFE2C4')
  g.fillRect(x, y, 13, 19)
  g.strokeStyle = 'rgba(0,0,0,.3)'
  g.lineWidth = 0.4
  g.strokeRect(x + 0.2, y + 0.2, 12.6, 18.6)
}

/**
 * La colonne Morris d'une case, ses affiches (carte v2 : `colonne`), aux couleurs de
 * `palette.colonne`, penchée de `penche` (la carte v2 penchait la colonne des années 1920 de
 * 0,12). Sans la largeur de l'écran (signature inchangée), elle se tient à 64 px à droite de sa
 * case, là où la carte v2 la posait pour une case de la moitié gauche ; `c.pop` n'est pas porté.
 */
function colonne(g: CanvasRenderingContext2D, x: number, y: number, c: CaseCarte, monde: Monde, affiche: (url: string) => Toile | null): void {
  const col = monde.palette.colonne
  if (!col || c.etat === 'verrou' || c.profondeur <= 0) return
  const couleur = monde.couleur
  const Hc = 60
  const R = 15
  g.save()
  g.translate(x + 64, y + 16)
  g.fillStyle = 'rgba(0,0,0,.42)'
  g.beginPath()
  g.ellipse(3, 1, 19, 5, 0, 0, TAU)
  g.fill()
  if (col.penche) g.transform(1, 0, -col.penche, 1, 0, 0)
  g.fillStyle = col.fonce
  g.fillRect(-R - 2.5, -7, 2 * R + 5, 7)
  const fut = g.createLinearGradient(-R, 0, R, 0)
  fut.addColorStop(0, col.fonce)
  fut.addColorStop(0.35, col.clair)
  fut.addColorStop(1, col.fonce)
  g.fillStyle = fut
  g.fillRect(-R, -Hc, 2 * R, Hc - 7)
  const N = Math.min(4, c.profondeur)
  for (let j = 0; j < N; j++) {
    const px = -R + 1.5 + (j % 2) * 14
    const py = -Hc + 5 + (j >> 1) * 21
    const url = c.affiches[j]
    const a = url ? affiche(url) : null
    if (a) g.drawImage(a as unknown as CanvasImageSource, px, py, 13, 19)
    else afficheVierge(g, px, py, couleur)
  }
  const om = g.createLinearGradient(-R, 0, R, 0)
  om.addColorStop(0, 'rgba(0,0,0,.55)')
  om.addColorStop(0.28, 'rgba(0,0,0,0)')
  om.addColorStop(0.72, 'rgba(0,0,0,0)')
  om.addColorStop(1, 'rgba(0,0,0,.6)')
  g.fillStyle = om
  g.fillRect(-R, -Hc, 2 * R, Hc - 7)
  g.fillStyle = col.fonce
  g.fillRect(-R - 2.5, -Hc - 3, 2 * R + 5, 4)
  g.beginPath()
  g.ellipse(0, -Hc - 3, R, 8, 0, Math.PI, 0)
  g.fill()
  g.fillStyle = col.clair
  g.fillRect(-1, -Hc - 16, 2, 6)
  cercle(g, 0, -Hc - 17, 2)
  const reste = c.profondeur - N
  if (reste > 0) {
    const txt = `+${reste}`
    g.font = "800 8px 'Manrope', system-ui, sans-serif"
    const tw = g.measureText(txt).width + 9
    g.fillStyle = couleur('#E6B94A')
    rr(g, -tw / 2, -12, tw, 11, 5.5)
    g.fill()
    g.fillStyle = couleur('#1B0E09')
    g.textAlign = 'center'
    g.fillText(txt, 0, -3.7)
  }
  g.restore()
}

/**
 * Le disque de la case, une bobine de pellicule (maquette du 29 septembre 2026 : `dessinerCase`,
 * `medaille`, `glyphe`, `plaque`, `MEDAILLES` ; carte v2 : `colonne`). `c.secoue` et `c.pop` de la
 * maquette (un appui, un rappel) ne sont pas portés : toucher une case ouvre sa fiche.
 */
export function dessinerCase(g: CanvasRenderingContext2D, x: number, y: number, c: CaseCarte, monde: Monde, t: number, vivant: boolean, affiche: (url: string) => Toile | null): void {
  const p = monde.palette
  const rx = 31
  const ry = 19
  const ep = 11
  let sc = 1
  if (c.etat === 'encours' && !c.attente && vivant) sc *= 1 + 0.022 * Math.sin(t * 2.1)
  g.save()
  g.translate(x, y)
  g.scale(sc, sc)
  const om = g.createRadialGradient(4, ep + 6, 4, 4, ep + 6, rx + 12)
  om.addColorStop(0, 'rgba(0,0,0,.55)')
  om.addColorStop(1, 'rgba(0,0,0,0)')
  g.save()
  g.scale(1, 0.5)
  g.fillStyle = om
  cercle(g, 4, (ep + 6) * 2, rx + 12)
  g.restore()
  // Une année « en attente » (un membre hors IA qui ne l'a pas encore visitée) se dessine comme
  // verrouillée, sans cadenas : le pointillé or plus bas la distingue d'une année vraiment fermée.
  const commeVerrou = c.etat === 'verrou' || c.attente
  let d0: string
  let d1: string
  let f0: string
  let f1: string
  if (commeVerrou) {
    [d0, d1] = p.caseVerrou.dessus
    f0 = monde.couleur('#15110c')
    f1 = monde.couleur('#0a0806')
  } else if (c.etat === 'encours') {
    d0 = monde.couleur('#FBF4E6')
    d1 = monde.couleur('#CDBB97')
    f0 = monde.couleur('#7d6a4b')
    f1 = monde.couleur('#3b2f1f')
  } else if (c.etat === 'passee') {
    // L'année passée au ticket prend la bobine du `ticket` de la maquette, plus terne qu'une année récompensée.
    d0 = monde.couleur('#c9b894')
    d1 = monde.couleur('#8a7856')
    f0 = monde.couleur('#5a4c36')
    f1 = monde.couleur('#2a2016')
  } else {
    [d0, d1] = p.caseFaite.dessus
    ;[f0, f1] = p.caseFaite.flanc
  }
  const fl = g.createLinearGradient(-rx, 0, rx, 0)
  fl.addColorStop(0, f1)
  fl.addColorStop(0.35, f0)
  fl.addColorStop(1, f1)
  g.fillStyle = fl
  g.beginPath()
  g.ellipse(0, ep, rx, ry, 0, 0, Math.PI)
  g.lineTo(-rx, 0)
  g.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true)
  g.closePath()
  g.fill()
  const ds = g.createRadialGradient(-rx * 0.35, -ry * 0.5, 2, 0, 0, rx)
  ds.addColorStop(0, d0)
  ds.addColorStop(1, d1)
  g.fillStyle = ds
  g.beginPath()
  g.ellipse(0, 0, rx, ry, 0, 0, TAU)
  g.fill()
  g.save()
  g.scale(1, ry / rx)
  g.strokeStyle = monde.couleur('#281C0E', 0.32)
  g.lineWidth = 1.2
  g.beginPath()
  g.arc(0, 0, rx * 0.8, 0, TAU)
  g.stroke()
  g.fillStyle = monde.couleur('#281C0E', 0.26)
  const tourne = c.etat === 'encours' && !c.attente && vivant ? t * 0.6 : 0
  for (let j = 0; j < 6; j++) {
    const an = (j / 6) * TAU + 0.3 + tourne
    g.beginPath()
    g.arc(Math.cos(an) * rx * 0.47, Math.sin(an) * rx * 0.47, rx * 0.15, 0, TAU)
    g.fill()
  }
  g.fillStyle = monde.couleur('#281C0E', 0.4)
  cercle(g, 0, 0, rx * 0.12)
  g.restore()
  g.strokeStyle = monde.couleur('#FFFAEB', 0.45)
  g.lineWidth = 1.2
  g.beginPath()
  g.ellipse(0, 0, rx - 0.6, ry - 0.6, 0, Math.PI * 1.08, Math.PI * 1.9)
  g.stroke()
  if (c.etat === 'verrou') {
    g.fillStyle = monde.couleur('#150F09', 0.5)
    g.beginPath()
    g.ellipse(0, ep / 2, rx + 1, ry + ep / 2 + 1, 0, 0, TAU)
    g.fill()
    g.strokeStyle = monde.couleur('#F2E8D5', 0.42)
    g.lineWidth = 1.6
    g.beginPath()
    g.arc(0, -4, 3.6, Math.PI, 0)
    g.stroke()
    g.fillStyle = monde.couleur('#F2E8D5', 0.42)
    rr(g, -5.5, -4, 11, 8, 1.5)
    g.fill()
  }
  if (c.etat === 'passee' && !c.attente) {
    g.save()
    g.rotate(-0.18)
    g.fillStyle = monde.couleur('#F2E8D5')
    rr(g, -12, -7, 24, 13, 2)
    g.fill()
    g.fillStyle = d1
    cercle(g, -12, -0.5, 2.5)
    cercle(g, 12, -0.5, 2.5)
    g.strokeStyle = monde.couleur('#151009', 0.5)
    g.setLineDash([1.5, 1.5])
    g.beginPath()
    g.moveTo(4, -6)
    g.lineTo(4, 5)
    g.stroke()
    g.setLineDash([])
    g.restore()
  }
  if (c.attente) {
    g.save()
    g.setLineDash([3, 3])
    g.strokeStyle = monde.couleur('#E6B94A', 0.8)
    g.lineWidth = 1.3
    g.beginPath()
    g.ellipse(0, 0, rx + 2, ry + 2, 0, 0, TAU)
    g.stroke()
    g.setLineDash([])
    g.restore()
  }
  g.restore()
  colonne(g, x, y, c, monde, affiche)
  const py = y + ep + ry * 0.3 + 12
  // Ni jauge ni plaque corail pour l'année en cours : `dessinerCorail` les dessine en dernier. Une
  // année en cours en attente du Voyage suivi n'en a pas : sa plaque est celle d'une année fermée.
  if (c.etat === 'encours' && !c.attente) return
  if (commeVerrou) plaque(g, x, py, String(c.annee), monde.couleur('#150F09', 0.72), monde.couleur('#F2E8D5', 0.55), monde.couleur('#F2E8D5', 0.18))
  // La plaque d'une année faite prend la couleur du monde, le millésime l'encre (maquette : `plaque`).
  else plaque(g, x, py, String(c.annee), p.caseFaite.plaque, monde.couleur('#151009'))
  if ((c.etat === 'palme' || c.etat === 'lion' || c.etat === 'ours') && !c.attente) {
    const bob = vivant ? Math.sin(t * 1.6 + c.annee * 1.3) * 2.2 : 0
    ombre(g, x + 2, y + 1, 11 - bob * 0.6, 4, 0.3)
    medaille(g, c.etat, x, y - 22 + bob, c.annee, t, vivant, monde.couleur)
  }
}

/** La couche corail de l'année en cours : la jauge, le millésime. Rien de cette couche ne passe par une rampe. */
export function dessinerCorail(g: CanvasRenderingContext2D, x: number, y: number, c: CaseCarte, t: number, vivant: boolean): void {
  void t
  void vivant
  if (c.jauge && c.jauge.total > 0) {
    const rx = 40
    const ry = 26
    g.save()
    g.translate(x, y + 1)
    g.strokeStyle = 'rgba(0,0,0,.55)'
    g.lineWidth = 6
    g.beginPath()
    g.ellipse(0, 0, rx, ry, 0, 0, TAU)
    g.stroke()
    const { total, vus } = c.jauge
    for (let j = 0; j < total; j++) {
      const a0 = -Math.PI / 2 + (j * TAU) / total + 0.09
      const a1 = a0 + TAU / total - 0.18
      g.strokeStyle = j < vus ? CORAIL : 'rgba(242,232,213,.2)'
      g.lineWidth = 4
      g.lineCap = 'round'
      g.beginPath()
      g.ellipse(0, 0, rx, ry, 0, a0, a1)
      g.stroke()
    }
    g.lineCap = 'butt'
    g.restore()
  }
  // La plaque du millésime, là où `dessinerCase` pose celle des autres années (maquette : `plaque`).
  plaque(g, x, y + 11 + 19 * 0.3 + 12, String(c.annee), CORAIL, '#1b0e09')
}
