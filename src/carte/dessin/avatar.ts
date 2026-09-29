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
const poly = (g: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>): void => {
  g.beginPath()
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
}
/** Le clap, commun à tous les mondes (maquette : `barre`) : une bande de pellicule au flanc rayé. */
const barre = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void => {
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  g.fillStyle = '#F2E8D5'
  g.fillRect(x, y, w, h)
  g.fillStyle = '#151009'
  for (let i = -1; i < w / 8 + 1; i++) {
    const bx = x + i * 8
    poly(g, [
      [bx, y + h],
      [bx + 4, y + h],
      [bx + 8, y],
      [bx + 4, y],
    ])
    g.fill()
  }
  g.restore()
  g.strokeStyle = 'rgba(0,0,0,.7)'
  g.lineWidth = 0.8
  g.strokeRect(x, y, w, h)
}

/**
 * Le voyageur, commun à tous les mondes : un clap qui s'ouvre au toucher (maquette : `avatar`,
 * `clap`, `barre`, `etiquetteIci`). Le saut du passage (`D.saut`) n'est pas porté : `x`, `y` sont
 * déjà la position à l'écran. `ageClap` : le temps écoulé depuis le dernier toucher, `-9` s'il n'a
 * jamais eu lieu — les rayons ne se dessinent que sous 0,25 s (maquette v2, `dessinerAvatar`).
 */
export function dessinerAvatar(g: CanvasRenderingContext2D, x: number, y: number, ageClap: number, marche: boolean, vivant: boolean): void {
  // Sans horloge du décor ici (signature inchangée) : l'angle de repos de la maquette, qui
  // respirait sur `t`, se fige à sa moyenne — jamais de dépendance à `t` hors de `ageClap`.
  let angle = 0.3
  if (ageClap >= 0 && ageClap < 0.45) {
    angle = ageClap < 0.08 ? 0.5 * (1 - ageClap / 0.08) : 0.3 * ((ageClap - 0.08) / 0.37)
  }
  g.save()
  g.translate(x, y - 2)
  g.fillStyle = 'rgba(0,0,0,.45)'
  g.beginPath()
  g.ellipse(2, 2, 17, 5, 0, 0, TAU)
  g.fill()
  g.fillStyle = '#231e19'
  rr(g, -15, -24, 30, 24, 3)
  g.fill()
  g.strokeStyle = 'rgba(242,232,213,.55)'
  g.lineWidth = 1
  g.stroke()
  g.fillStyle = 'rgba(242,232,213,.55)'
  g.fillRect(-11, -18, 22, 1.2)
  g.fillRect(-11, -12, 13, 1.2)
  g.fillRect(-11, -6, 18, 1.2)
  barre(g, -15, -30, 30, 6)
  g.save()
  g.translate(-15, -30)
  g.rotate(-angle)
  barre(g, 0, -6, 31, 6)
  g.restore()
  g.restore()
  // Les rayons du clap : tant que le battement est frais (moins de 0,25 s), avant qu'il ne se referme.
  if (vivant && ageClap >= 0 && ageClap < 0.25) {
    g.save()
    g.strokeStyle = `rgba(246,217,138,${1 - ageClap / 0.25})`
    g.lineWidth = 1.5
    g.lineCap = 'round'
    for (let j = 0; j < 5; j++) {
      const an = -Math.PI * 0.95 + j * 0.32
      const r0 = 22 + ageClap * 40
      g.beginPath()
      g.moveTo(x - 15 + Math.cos(an) * r0 * 0.6, y - 34 + Math.sin(an) * r0 * 0.6)
      g.lineTo(x - 15 + Math.cos(an) * r0, y - 34 + Math.sin(an) * r0)
      g.stroke()
    }
    g.restore()
  }
  if (!marche) {
    const yEt = y - 44
    g.font = "700 10px 'Manrope', system-ui, sans-serif"
    const w = g.measureText('Tu es ici').width + 14
    g.fillStyle = 'rgba(0,0,0,.35)'
    rr(g, x - w / 2 + 1, yEt - 17, w, 17, 8.5)
    g.fill()
    g.fillStyle = '#F2E8D5'
    rr(g, x - w / 2, yEt - 18, w, 17, 8.5)
    g.fill()
    poly(g, [
      [x - 4, yEt - 1.5],
      [x + 4, yEt - 1.5],
      [x, yEt + 3],
    ])
    g.fill()
    g.fillStyle = '#151009'
    g.textAlign = 'center'
    g.fillText('Tu es ici', x, yEt - 6)
  }
}
