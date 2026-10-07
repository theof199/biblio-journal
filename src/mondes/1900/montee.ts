import type { VueMonde } from '../types'
import { lerp } from '../../carte/outils'
import { c, F_CORPS, F_RAIL } from './couleur'
import { cuire, fondre } from './cuisson'
import { emaillee } from './gares'
import { imageDu1900, TAILLES } from './images'
import { bouffee, cadrageDuQuai, dessousDevant, interieurALEcran, jonctionALEcran, montee, ouverture, quaiALEcran, VITRE, vitreALEcran } from './passage'
import { arrondi, fenetre } from './toiles'
import { JONCTION } from './trace'

/**
 * Le dessin du passage de la foire au train, dans le haut de la section (maquette « Voyage immobile
 * 1900 », idées 46 à 49 ; `rendre`, l. 3012-3051) : la jonction où la pellicule devient des rails,
 * le quai de 1899, la bouffée de la locomotive, le compartiment et le cadre de sa vitre. Les toiles
 * vues par la vitre, le quai qui s'éloigne et la borne sont aux plans du train (`toiles.ts`,
 * `gares.ts`). Chaque « quoi » et chaque « combien » vient de `passage.ts`, donc d'`avance` seule :
 * ici, rien que le trait, et ni `v.t` ni `v.entree`. Aucune zone n'est inscrite, aucun son joué.
 * Les affiches du compartiment (idée 72) et les panaches animés à l'horloge ne sont pas dessinés.
 */

/** De combien la pellicule de la jonction est décalée, en px du repère de 390 : la route de 1890 arrive au milieu de la section, pas à gauche comme sur l'image de la maquette. */
const ARRIVEE = 56

/** La jonction (maquette : `jonctionSVG`, l. 2885-2909) : la pellicule de 1890 devient deux rails, sous un poteau indicateur. */
function jonction(g: CanvasRenderingContext2D, W: number, y: number): void {
  g.save()
  g.translate(0, y)
  g.scale(W / 390, 1)
  const fond = g.createLinearGradient(0, 0, 0, JONCTION)
  fond.addColorStop(0, c('#41301f'))
  fond.addColorStop(0.55, c('#2b1f15'))
  fond.addColorStop(1, c('#140e09'))
  g.fillStyle = fond
  g.fillRect(0, 0, 390, JONCTION)
  g.save()
  g.translate(ARRIVEE, 0)
  g.fillStyle = c('#2b221b')
  g.beginPath()
  g.moveTo(122, 0)
  g.lineTo(166, 0)
  g.lineTo(170, 70)
  g.lineTo(118, 70)
  g.closePath()
  g.fill()
  g.fillStyle = c('#d9c9a6', 0.55)
  for (let k = 0; k < 7; k++) g.fillRect(136, 6 + k * 11, 5, 5)
  g.strokeStyle = c('#e1c98f', 0.7)
  g.lineWidth = 2
  g.setLineDash([3, 7])
  g.beginPath()
  g.moveTo(128, 0)
  g.lineTo(132, 70)
  g.stroke()
  g.setLineDash([])
  g.fillStyle = c('#2a1d13')
  for (let k = 0; k < 9; k++) {
    const t = k / 8
    const x0 = lerp(118, 60, t)
    g.fillRect(x0, 92 + k * 10, lerp(170, 250, t) - x0, 3 + t * 3)
  }
  g.strokeStyle = c('#9c9486')
  g.lineWidth = 3
  for (const [x0, cx, x1] of [[126, 110, 70], [162, 190, 240]] as const) {
    g.beginPath()
    g.moveTo(x0, 74)
    g.quadraticCurveTo(cx, 130, x1, 180)
    g.stroke()
  }
  g.restore()
  // Le poteau indicateur de bois peint, à flèche : la plaque émaillée, elle, attend sur le quai.
  g.translate(226, 14)
  g.fillStyle = c('#3a2414')
  g.fillRect(148, -6, 7, 92)
  g.fillStyle = c('#1b140e')
  g.fillRect(146, -9, 11, 5)
  g.translate(150, 22)
  g.rotate((-5 * Math.PI) / 180)
  g.translate(-150, -22)
  for (const [x0, x1, y0, y1, pointe, trait, epais] of [[22, 160, 2, 42, 0, '#3a2414', 2], [26, 155, 7, 37, 9, '#a8352a', 1.2]] as const) {
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y0)
    g.lineTo(x1, y1)
    g.lineTo(x0, y1)
    g.lineTo(pointe, 22)
    g.closePath()
    if (pointe === 0) {
      g.fillStyle = c('#e6d8b4')
      g.fill()
    }
    g.strokeStyle = c(trait)
    g.lineWidth = epais
    g.stroke()
  }
  g.fillStyle = c('#221910')
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.font = `11px ${F_RAIL}`
  g.fillText('QUAI · DÉPARTS', 88, 19)
  g.font = `9.5px ${F_RAIL}`
  g.fillText('POUR LES ANNÉES 1900 ↓', 88, 32)
  g.restore()
}

/** Le quai de 1899 (maquette : `.quai`, l. 69-75) : la halle de Toulouse-Matabiau, sa plaque émaillée, sa légende ; il grossit vers la voiture. */
function quai(v: VueMonde, q: { y: number; zoom: number; mots: number }): void {
  const g = v.ctx
  const taille = TAILLES.quai!
  const cadrage = cadrageDuQuai(v.W, v.H, taille)
  const url = imageDu1900('quai')
  const photo = url ? v.image(url) : null
  g.save()
  g.translate(v.W * 0.16, q.y + v.H * 0.47)
  g.scale(q.zoom, q.zoom)
  g.translate(-v.W * 0.16, -v.H * 0.47)
  if (photo) {
    const [de, a] = cadrage.fondu
    const fondue = cuire(`quai:${de.toFixed(3)}:${a.toFixed(3)}`, taille[0], taille[1], (t, w, h) => {
      t.drawImage(photo, 0, 0, w, h)
      fondre(t, 0, 0, 0, h, [[0, 0], [Math.max(0, de), 0], [Math.min(1, a), 1], [1, 1]], w, h)
    })
    g.drawImage(fondue ?? photo, cadrage.x, cadrage.y, cadrage.w, cadrage.h)
  }
  if (q.mots > 0.001) {
    g.globalAlpha *= q.mots
    emaillee(g, v.W / 2, v.H * 0.22, [['QUAI DE DÉPART', 11], ['POUR LES ANNÉES 1900', 19]])
    g.fillStyle = c('#f4efe2', 0.75)
    g.textAlign = 'left'
    g.font = `italic 11px ${F_CORPS}`
    g.fillText('Toulouse-Matabiau, 4 octobre 1899 · E. Trutat', 10, v.H - 8)
  }
  g.restore()
}

/** Une banquette de drap rouge, son accoudoir (maquette : `#bq`, l. 1515-1523), dans le repère de 390 × 760. */
function banquette(g: CanvasRenderingContext2D): void {
  const drap = g.createLinearGradient(0, 0, 66, 0)
  drap.addColorStop(0, c('#3a1412'))
  drap.addColorStop(1, c('#6e2621'))
  g.fillStyle = drap
  g.beginPath()
  g.moveTo(0, 500)
  g.lineTo(66, 522)
  g.lineTo(66, 664)
  g.lineTo(0, 706)
  g.closePath()
  g.fill()
  g.strokeStyle = c('#c9a257', 0.7)
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(0, 500)
  g.lineTo(66, 522)
  g.stroke()
  g.fillStyle = c('#1f0a09')
  for (const [x, y] of [[18, 548], [46, 556], [18, 600], [46, 604], [18, 652], [46, 650]] as const) {
    g.beginPath()
    g.arc(x, y, 2.4, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = c('#1f0a09', 0.55)
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(0, 574)
  g.lineTo(66, 580)
  g.moveTo(0, 626)
  g.lineTo(66, 627)
  g.stroke()
  const assise = g.createLinearGradient(0, 664, 0, 760)
  assise.addColorStop(0, c('#7d2c26'))
  assise.addColorStop(1, c('#2b0e0c'))
  g.fillStyle = assise
  g.beginPath()
  g.moveTo(0, 706)
  g.lineTo(66, 664)
  g.lineTo(138, 664)
  g.lineTo(112, 760)
  g.lineTo(0, 760)
  g.closePath()
  g.fill()
  g.strokeStyle = c('#c9a257', 0.55)
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(66, 664)
  g.lineTo(138, 664)
  g.lineTo(112, 760)
  g.stroke()
  g.fillStyle = c('#4a2812')
  g.beginPath()
  g.moveTo(58, 668)
  g.bezierCurveTo(56, 640, 86, 636, 88, 664)
  g.lineTo(84, 690)
  g.lineTo(62, 690)
  g.closePath()
  g.fill()
  g.strokeStyle = c('#8a5a34')
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(60, 660)
  g.bezierCurveTo(62, 644, 82, 642, 86, 660)
  g.stroke()
}

/**
 * Le compartiment (maquette : `.interieur`, l. 77-79 et 1510-1528) : la boiserie photographiée,
 * assombrie vers ses bords, la tablette sous la vitre, deux banquettes et une valise. Sans les
 * affiches de la ficelle (idée 72, hors du lot).
 */
function interieur(v: VueMonde, i: { alpha: number; echelle: number }): void {
  const g = v.ctx
  const [lp, hp] = TAILLES.interieur!
  g.save()
  g.globalAlpha *= i.alpha
  g.translate(v.W * 0.5, v.H * 0.36)
  g.scale(i.echelle, i.echelle)
  g.translate(-v.W * 0.5, -v.H * 0.36)
  const e = Math.max(v.W / lp, v.H / hp)
  const url = imageDu1900('interieur')
  const photo = url ? v.image(url) : null
  if (photo) g.drawImage(photo, (v.W - lp * e) * 0.5, (v.H - hp * e) * 0.4, lp * e, hp * e)
  else {
    g.fillStyle = c('#2a180c')
    g.fillRect(0, 0, v.W, v.H)
  }
  g.save()
  g.translate(v.W * 0.5, v.H * 0.4)
  g.scale(v.W * 0.71, v.H * 0.85)
  const ombre = g.createRadialGradient(0, 0, 0, 0, 0, 1)
  ombre.addColorStop(0, c('#080503', 0))
  ombre.addColorStop(0.38, c('#080503', 0))
  ombre.addColorStop(1, c('#080503', 0.62))
  g.fillStyle = ombre
  g.fillRect(-2, -2, 4, 4)
  g.restore()
  g.scale(v.W / 390, v.H / 760)
  g.fillStyle = c('#5e351b')
  g.fillRect(16, 472, 358, 10)
  g.fillStyle = c('#1c0f07')
  g.fillRect(16, 482, 358, 3)
  g.fillStyle = c('#c9a257', 0.5)
  g.fillRect(16, 472, 358, 1.5)
  g.fillStyle = c('#c9a257')
  g.fillRect(162, 512, 66, 5)
  g.fillStyle = c('#8a6c33')
  for (const x of [165, 225]) {
    g.beginPath()
    g.arc(x, 514.5, 5.5, 0, Math.PI * 2)
    g.fill()
  }
  banquette(g)
  g.save()
  g.translate(390, 0)
  g.scale(-1, 1)
  banquette(g)
  g.restore()
  g.translate(286, 618)
  g.rotate((-4 * Math.PI) / 180)
  g.fillStyle = c('#6b4324')
  g.fillRect(0, 0, 74, 48)
  g.strokeStyle = c('#2a180c')
  g.lineWidth = 2
  g.strokeRect(0, 0, 74, 48)
  g.fillStyle = c('#3a2212')
  g.fillRect(14, 0, 6, 48)
  g.fillRect(54, 0, 6, 48)
  g.strokeStyle = c('#3a2212')
  g.lineWidth = 3.5
  g.beginPath()
  g.moveTo(27, 0)
  g.bezierCurveTo(27, -11, 47, -11, 47, 0)
  g.stroke()
  g.fillStyle = c('#c9a257')
  g.fillRect(33, 19, 8, 7)
  g.restore()
}

/** Le cadre de bois de la vitre et sa courroie (maquette : `.vitre .cadre`, `.courroie`, l. 81-83) : il grandit avec elle jusqu'à sortir de l'écran. */
function cadre(v: VueMonde, vitre: { alpha: number; cadre: { x: number; y: number; sx: number; sy: number } }): void {
  const g = v.ctx
  const w = v.W * VITRE.w
  const h = v.H * VITRE.h
  g.save()
  g.globalAlpha *= vitre.alpha
  g.translate(vitre.cadre.x, vitre.cadre.y)
  g.scale(vitre.cadre.sx, vitre.cadre.sy)
  const ombre = g.createLinearGradient(0, 12, 0, 48)
  ombre.addColorStop(0, c('#000000', 0.4))
  ombre.addColorStop(1, c('#000000', 0))
  g.fillStyle = ombre
  g.fillRect(12, 12, w - 24, 36)
  for (const [retrait, epais, trait, rayon] of [[6, 12, c('#4a2a17'), 9], [13, 2, c('#1c0f07'), 3], [14.5, 1, c('#c9a257', 0.55), 2]] as const) {
    g.strokeStyle = trait
    g.lineWidth = epais
    arrondi(g, retrait, retrait, w - 2 * retrait, h - 2 * retrait, rayon)
    g.stroke()
  }
  g.globalAlpha *= 1 - ouverture(v.avance)
  const cuir = g.createLinearGradient(0, h - 27, 0, h + 3)
  cuir.addColorStop(0, c('#6d3d20'))
  cuir.addColorStop(1, c('#4a2812'))
  g.fillStyle = cuir
  g.fillRect(w / 2 - 13, h - 27, 26, 30)
  g.fillStyle = c('#33190a')
  g.fillRect(w / 2 - 13, h - 2, 26, 5)
  g.restore()
}

/** Les cinq volutes de la bouffée (maquette : `P`, l. 3029) : d'où elle part et où elle va, en parts de l'écran, sa taille, sa force. */
const VOLUTES = [[-0.42, 0.3, 0.16, -0.5, 1, 0.95], [0.05, 0.42, -0.1, -0.62, 0.85, 0.9], [-0.2, -0.05, 0.08, -0.4, 1.1, 0.8], [0.12, 0.05, -0.14, -0.34, 0.9, 0.75], [-0.3, 0.6, 0.1, -0.7, 1.2, 0.85]] as const

/** La bouffée de la locomotive, qui couvre l'écran pendant qu'on monte (maquette : `.buee`, l. 3026-3035) : menée par l'avance, jamais par l'horloge. */
function buee(v: VueMonde, force: number): void {
  const g = v.ctx
  const t = montee(v.avance)
  const m = (t - 0.3) * 2
  for (const [x0, y0, dx, dy, taille, part] of VOLUTES) {
    const r = v.W * 0.75 * taille * (0.85 + t * 0.9)
    const x = v.W * (x0 + dx * m + 0.75)
    const y = v.H * (y0 + dy * m) + v.W * 0.75
    const volute = g.createRadialGradient(x, y, 0, x, y, r)
    volute.addColorStop(0, c('#f4efe2', force * part))
    volute.addColorStop(0.5, c('#e6dcc6', force * part * 0.85))
    volute.addColorStop(1, c('#e6dcc6', 0))
    g.fillStyle = volute
    g.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
}

/** Ouvre le dessin du passage, coupé à la fenêtre de la section ; faux hors d'elle. */
function ouvrirLePassage(v: VueMonde): boolean {
  if (v.presence <= 0.01) return false
  const [haut, bas] = fenetre(v)
  if (bas <= haut) return false
  const g = v.ctx
  g.save()
  g.globalAlpha = v.presence
  g.beginPath()
  g.rect(0, haut, v.W, bas - haut)
  g.clip()
  return true
}

/** Ce qui est sous la vitre : la jonction, le quai, le compartiment, sur un fond qui ne laisse rien voir de dessous. */
function dessous(v: VueMonde): void {
  const j = jonctionALEcran(v)
  const q = quaiALEcran(v)
  const i = interieurALEcran(v.avance)
  if ((!j && !q && !i) || !ouvrirLePassage(v)) return
  const g = v.ctx
  if (j || q) {
    g.fillStyle = c('#140e09')
    g.fillRect(0, 0, v.W, v.H)
  }
  if (j) jonction(g, v.W, j.y)
  if (q) quai(v, q)
  if (i) interieur(v, i)
  g.restore()
}

/** Avant toute toile (le moteur appelle `dessinerCiel` en premier) : le dessous de la vitre, dès qu'elle existe. */
export function dessinerSousLaVitre(v: VueMonde): void {
  if (!dessousDevant(v)) dessous(v)
}

/**
 * Après tous les plans : tant qu'il n'y a pas de vitre, la jonction et le quai, qui couvrent ce que
 * la foire laisse déborder sous sa section ; puis le cadre de la vitre, et la bouffée par-dessus tout.
 */
export function dessinerDevantLaVitre(v: VueMonde): void {
  if (dessousDevant(v)) dessous(v)
  const vitre = vitreALEcran(v)
  const force = bouffee(v.avance)
  const encadree = vitre?.cadre ? { alpha: vitre.alpha, cadre: vitre.cadre } : null
  if ((!encadree && force <= 0.002) || !ouvrirLePassage(v)) return
  if (encadree) cadre(v, encadree)
  if (force > 0.002) buee(v, force)
  v.ctx.restore()
}
