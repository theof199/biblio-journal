import type { Palette, VueMonde } from '../../mondes/types'

const TAU = Math.PI * 2

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

/**
 * La porte de fin de monde (maquette : `porteFin`, `PORTE_OR`) : deux poteaux, un fronton qui
 * porte le titre, neuf ampoules allumées au prorata des années récompensées, le tampon
 * « BOUCLÉE » quand le passeport porte la décennie. Commune à tous les mondes, à leurs couleurs.
 */
export function dessinerPorte(v: VueMonde, ou: { x: number; y: number }, titre: string, sous: string, P: Palette['porte']): void {
  const { x, y } = ou
  const g = v.ctx
  g.save()
  for (const dx of [-78, 78]) {
    g.fillStyle = 'rgba(0,0,0,.45)'
    g.beginPath()
    g.ellipse(x + dx + 3, y + 30, 10, 3.5, 0, 0, TAU)
    g.fill()
    g.fillStyle = P.poteau
    g.fillRect(x + dx - 4, y - 96, 8, 126)
    g.fillStyle = P.or
    g.fillRect(x + dx - 6, y - 100, 12, 4)
    g.fillStyle = P.or
    cercle(g, x + dx, y - 104, 3)
  }
  const bw = 188
  const by = y - 132
  g.fillStyle = P.fond
  rr(g, x - bw / 2, by, bw, 50, 7)
  g.fill()
  g.strokeStyle = P.or
  g.lineWidth = 1.5
  g.stroke()
  g.strokeStyle = P.cadre
  g.lineWidth = 1
  rr(g, x - bw / 2 + 5, by + 5, bw - 10, 40, 4)
  g.stroke()
  const recomp = v.cases.filter((c) => c.etat === 'palme' || c.etat === 'lion' || c.etat === 'ours').length
  for (let i = 0; i < 9; i++) {
    const bx = x - bw / 2 + 14 + i * ((bw - 28) / 8)
    const allume = v.bouclee ? (v.vivant ? (Math.floor(v.t * 6) + i) % 3 !== 0 : true) : i < recomp
    g.fillStyle = allume ? P.amp : 'rgba(242,232,213,.14)'
    cercle(g, bx, by, 2.6)
    if (allume) {
      g.save()
      g.globalCompositeOperation = 'lighter'
      g.fillStyle = P.ampH
      cercle(g, bx, by, 6.5)
      g.restore()
    }
  }
  g.textAlign = 'center'
  g.fillStyle = P.texte
  g.font = "19px 'Limelight', Georgia, serif"
  g.fillText(titre, x, by + 27)
  g.fillStyle = 'rgba(242,232,213,.55)'
  g.font = "700 8.5px 'Manrope', system-ui, sans-serif"
  g.fillText(sous, x, by + 40)
  if (v.bouclee) {
    g.save()
    g.translate(x + bw / 2 - 10, by + 44)
    g.rotate(-0.25)
    g.strokeStyle = P.tampon
    g.lineWidth = 2
    g.beginPath()
    g.arc(0, 0, 17, 0, TAU)
    g.stroke()
    g.lineWidth = 0.8
    g.beginPath()
    g.arc(0, 0, 13.5, 0, TAU)
    g.stroke()
    g.fillStyle = P.tampon
    g.font = "800 6.5px 'Manrope', system-ui, sans-serif"
    g.fillText('BOUCLÉE', 0, 2.5)
    g.restore()
  }
  g.restore()
}
