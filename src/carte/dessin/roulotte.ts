import type { Rampe } from '../rampe'

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
const cercle = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  g.beginPath()
  g.arc(x, y, Math.max(0, r), 0, TAU)
  g.fill()
}
const ombre = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.4): void => {
  g.fillStyle = `rgba(0,0,0,${a})`
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, TAU)
  g.fill()
}
const halo = (g: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a: number, couleur: Rampe['couleur']): void => {
  if (a <= 0.005) return
  g.save()
  g.globalCompositeOperation = 'lighter'
  const h = g.createRadialGradient(x, y, 0, x, y, r)
  h.addColorStop(0, couleur(hex, a))
  h.addColorStop(1, couleur(hex, 0))
  g.fillStyle = h
  cercle(g, x, y, r)
  g.restore()
}
/** Un cheval au trot (maquette : `cheval`), tourné au pas `ph` — nul, immobile (garée, ou en repos). */
const cheval = (g: CanvasRenderingContext2D, ph: number): void => {
  const b = Math.sin(ph * 2) * 0.8
  g.lineWidth = 1.4
  g.lineCap = 'round'
  g.beginPath()
  g.ellipse(0, b, 8.5, 3.4, 0, 0, TAU)
  g.fill()
  poly(g, [
    [5, -1 + b],
    [9.5, -8 + b],
    [12, -7 + b],
    [8.5, 1 + b],
  ])
  g.fill()
  g.beginPath()
  g.ellipse(12.8, -7 + b, 3.4, 1.6, 0.45, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(-8, -1 + b)
  g.quadraticCurveTo(-12, -1, -12.5, 4 + b)
  g.stroke()
  ;[
    [-5.5, 0],
    [-4, 1.7],
    [5, 3.1],
    [6.5, 4.8],
  ].forEach(([hx, p]) => {
    const an = Math.sin(ph + p!) * 0.75
    g.beginPath()
    g.moveTo(hx!, 2 + b)
    g.lineTo(hx! + Math.sin(an) * 7.5, 2 + b + Math.cos(an) * 7.5)
    g.stroke()
  })
}

/** Le dessin de la maquette (écrans 1890 : `roulotte`), sans planche d'images. */
function dessinerAuTrait(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: number,
  roule: boolean,
  t: number,
  vivant: boolean,
  echelle: number,
  pseudo: string,
  couleur: Rampe['couleur'],
  nuit: number,
): void {
  // La maquette plie `vivant` dans `roule` (`u < 1 && vivant`) : ici, les deux se lisent.
  const tourne = roule && vivant
  g.save()
  g.translate(x, y)
  g.scale(dir * echelle, echelle)
  ombre(g, 0, 2, 70, 5)
  for (const hx of [58, 72]) {
    g.save()
    g.translate(hx, -8)
    g.scale(1.25, 1.25)
    g.fillStyle = g.strokeStyle = couleur('#1d1712')
    cheval(g, tourne ? t * 9 + hx : 1.2 + (vivant ? Math.sin(t * 0.8 + hx) * 0.08 : 0))
    g.restore()
  }
  g.strokeStyle = couleur('#1d1712')
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(30, -12)
  g.lineTo(52, -10)
  g.stroke()
  g.fillStyle = couleur('#6b5a3a')
  rr(g, -40, -34, 72, 26, 3)
  g.fill()
  g.fillStyle = couleur('#F2CD8C', 0.45 + 0.45 * nuit)
  for (let i = 0; i < 5; i++) g.fillRect(-35 + i * 13, -30, 9, 9)
  g.fillStyle = couleur('#3a2e24')
  g.fillRect(-42, -38, 76, 4)
  g.fillStyle = couleur('#E9DCC0')
  g.fillRect(-38, -17, 66, 5)
  g.save()
  g.scale(dir, 1)
  g.textAlign = 'center'
  g.font = "700 4.6px 'Manrope', system-ui, sans-serif"
  g.fillStyle = couleur('#1d1712')
  g.fillText(`${pseudo.toUpperCase()} ET CIE`, -5 * dir, -13)
  g.restore()
  for (let i = 0; i < 4; i++) {
    g.fillStyle = couleur('#0c0806')
    cercle(g, -32 + i * 16, -43, 2.2)
    g.fillRect(-34 + i * 16, -41, 4, 3)
    if (i % 2) g.fillRect(-33.6 + i * 16, -48.2, 3.2, 3.6)
  }
  g.fillStyle = couleur('#1d1712')
  g.fillRect(24, -50, 3, 12)
  for (let k = 0; k < 4; k++) {
    const u = vivant ? (t * 0.45 + k / 4) % 1 : k / 4
    g.fillStyle = couleur('#CFC6B6', 0.28 * (1 - u))
    cercle(g, 25.5 - u * 10 * (tourne ? 2 : 0.6), -52 - u * 20, 2 + u * 5)
  }
  g.strokeStyle = couleur('#1d1712')
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(34, -34)
  g.lineTo(38, -30)
  g.stroke()
  halo(g, 38, -27, 12, '#F2CD8C', 0.35 * (0.3 + 0.7 * nuit), couleur)
  g.fillStyle = couleur('#FCE2AA')
  cercle(g, 38, -27, 1.8)
  for (const wx of [-26, 20]) {
    g.fillStyle = couleur('#1d1712')
    cercle(g, wx, -4, 9)
    g.fillStyle = couleur('#6b5a3a')
    cercle(g, wx, -4, 7)
    g.strokeStyle = couleur('#1d1712')
    g.lineWidth = 1
    const r0 = tourne ? t * 7 : 0
    g.beginPath()
    for (let k = 0; k < 6; k++) {
      const b2 = r0 + (k * TAU) / 6
      g.moveTo(wx, -4)
      g.lineTo(wx + Math.cos(b2) * 7, -4 + Math.sin(b2) * 7)
    }
    g.stroke()
    g.fillStyle = couleur('#1d1712')
    cercle(g, wx, -4, 1.8)
  }
  g.restore()
}

/**
 * Le dessin depuis la planche (`carte/images.ts`) : `n` images carrées de même taille, côte à
 * côte sur une rangée — `n` se lit du rapport de la largeur à la hauteur. Une planche d'images
 * non carrées se découperait mal : la déposer ainsi, ou changer cette règle avec elle.
 */
function dessinerDepuisPlanche(g: CanvasRenderingContext2D, planche: CanvasImageSource, x: number, y: number, dir: number, echelle: number, t: number, vivant: boolean): void {
  const src = planche as unknown as { width?: number; height?: number }
  const ih = src.height || 1
  const n = Math.max(1, Math.round((src.width || ih) / ih))
  const iw = (src.width || ih) / n
  const image = vivant ? Math.floor(t * 16) % n : 0
  g.save()
  g.translate(x, y)
  g.scale(dir * echelle, echelle)
  g.drawImage(planche, image * iw, 0, iw, ih, -iw / 2, -ih, iw, ih)
  g.restore()
}

/**
 * La roulotte de qui mène le Voyage (maquette du 29 septembre 2026 : `roulotte`, `roulotteCarte`) :
 * garée par le moteur sur l'année où ce Voyage est rendu, pour tout autre membre.
 */
/** `planche` : la suite d'images de la roulotte (`carte/assets/roulotte.webp`), nulle tant qu'elle manque ou charge ; le dessin de la maquette tient alors sa place. */
export function dessinerRoulotte(g: CanvasRenderingContext2D, x: number, y: number, dir: number, roule: boolean, t: number, vivant: boolean, echelle: number, pseudo: string, couleur: Rampe['couleur'], nuit: number, planche: CanvasImageSource | null): void {
  // Le halo de la lanterne sur le chemin (maquette : `roulotteCarte`, 16 px au-dessus de la roulotte).
  halo(g, x, y - 16, 40, '#F2CD8C', 0.16 * (0.3 + 0.7 * nuit), couleur)
  if (planche) dessinerDepuisPlanche(g, planche, x, y, dir, echelle, t, vivant)
  else dessinerAuTrait(g, x, y, dir, roule, t, vivant, echelle, pseudo, couleur, nuit)
}

/** La plaque de la roulotte garée (maquette : la `plaque` de `roulotteCarte`) : « Théo est rendu en 1896 ». */
export function dessinerPlaqueRoulotte(g: CanvasRenderingContext2D, x: number, y: number, texte: string, couleur: Rampe['couleur']): void {
  g.font = "600 11.5px 'Fraunces', Georgia, serif"
  const w = Math.max(40, g.measureText(texte).width + 16)
  g.fillStyle = 'rgba(0,0,0,.35)'
  rr(g, x - w / 2 + 1, y + 2, w, 18, 9)
  g.fill()
  g.fillStyle = couleur('#F2E8D5')
  rr(g, x - w / 2, y, w, 18, 9)
  g.fill()
  g.fillStyle = couleur('#151009')
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillText(texte, x, y + 13)
}
