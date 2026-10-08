import type { HalteVue, VueMonde } from '../types'
import { c, F_RAIL } from './couleur'
import { aDevelopper, milieuDeLaGare } from './gares'
import { dansLaFenetre } from './toiles'
import { ANNEES } from './trace'

/** Le rayon de la zone du levier : sa vue de 56 sur 84 tient dedans, et un doigt aussi. */
export const RAYON_DU_LEVIER = 34

/** La zone du levier passe devant la zone `case` de sa gare et devant la voiture du Voyage suivi (1), comme une dépêche ; derrière une bobine (3). */
export const PRIORITE_DU_LEVIER = 2
/**
 * Un embranchement à l'écran : la halte, son rang **dans `v.haltes`** (celui que lit le moteur), le
 * pied du levier et celui du poteau, et la zone à inscrire pour le levier : son centre à mi-hauteur
 * de sa vue (84 de haut, le pied en bas), son rayon et sa priorité.
 */
export interface AiguillageALEcran {
  halte: HalteVue
  rang: number
  levier: { x: number; y: number }
  poteau: { x: number; y: number }
  zone: { x: number; y: number; r: number; priorite: number }
}

/**
 * Les aiguillages de cette image (plan des écrans des lots, brief 12 ; maquette « Voyage immobile
 * 1900 » : `mesurerJeu`), **un par halte servie, et rien sans elle** : le monde n'en connaît aucune,
 * ni leur nom, ni leur année, ni leur compte. Le levier se tient au bout du quai de la gare `apres`,
 * à gauche de son milieu (72 px du bord sur un écran de 390 : à l'écran quand le train y est
 * arrêté) ; le poteau à mi-chemin de la gare suivante, sur le tronçon. Ni l'un ni l'autre dans une
 * gare à développer (`aDevelopper` : fermée, ou pas encore atteinte), ni hors de la fenêtre de la
 * section. Pure : ni dessin, ni zone.
 */
export function aiguillagesALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance' | 'cases' | 'ouverte' | 'haltes'>): AiguillageALEcran[] {
  return v.haltes.flatMap((halte, rang) => {
    // Une année hors de la ligne n'a pas de case : elle est « à développer », comme une gare fermée.
    if (aDevelopper(v, halte.apres)) return []
    const i = ANNEES.indexOf(halte.apres)
    // Le pied sur le quai, au-dessus du ballast que le sol dessine ensuite (la maquette, en calques, le posait à 19,5 % du bas).
    const y = v.H * 0.705
    if (!dansLaFenetre(v, y)) return []
    const milieu = milieuDeLaGare(v, i)
    const levier = { x: milieu - Math.min(128, v.W / 2 - 72), y }
    return [{ halte, rang, levier, poteau: { x: milieuDeLaGare(v, i + 0.5), y }, zone: { x: levier.x, y: levier.y - 42, r: RAYON_DU_LEVIER, priorite: PRIORITE_DU_LEVIER } }]
  })
}

/** Ce que le poteau écrit sous le nom : le compte de ce qui est servi, jamais « trois ». */
export const filmsDuPoteau = (total: number): string => `EMBRANCHEMENT · ${total} FILM${total > 1 ? 'S' : ''}`

/** Le levier à contrepoids (maquette : `LEVIER_SVG`, 56 sur 84, son pied en bas au milieu) et l'étiquette au nom de la halte. */
function levier(g: CanvasRenderingContext2D, x: number, y: number, nom: string): void {
  g.save()
  g.translate(x - 28, y - 84)
  g.fillStyle = c('#000000', 0.3)
  g.fillRect(8, 79, 44, 5)
  g.fillStyle = c('#2a1d13')
  g.fillRect(6, 74, 44, 7)
  g.fillStyle = c('#3a2a1c')
  g.beginPath()
  g.moveTo(19, 74)
  g.lineTo(24, 58)
  g.lineTo(32, 58)
  g.lineTo(37, 74)
  g.closePath()
  g.fill()
  // Le manche penché, son contrepoids mi-parti et sa poignée de laiton.
  g.save()
  g.translate(28, 68)
  g.rotate((-26 * Math.PI) / 180)
  g.fillStyle = c('#1d150e')
  g.fillRect(-2, -54, 4, 56)
  g.fillStyle = c('#f4efe2')
  g.strokeStyle = c('#1d150e')
  g.lineWidth = 2
  g.beginPath()
  g.arc(0, -24, 9.5, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.fillStyle = c('#1d3767')
  g.beginPath()
  g.arc(0, -24, 9.5, -Math.PI / 2, Math.PI / 2)
  g.closePath()
  g.fill()
  g.fillStyle = c('#c9a257')
  g.lineWidth = 1.5
  g.beginPath()
  g.arc(0, -54, 5, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.restore()
  g.fillStyle = c('#c9a257')
  g.strokeStyle = c('#1d150e')
  g.lineWidth = 1
  g.beginPath()
  g.arc(28, 68, 3.6, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  // L'étiquette émaillée, penchée, au-dessus du manche (maquette : `.levier em`).
  g.translate(28, -6)
  g.rotate((-3 * Math.PI) / 180)
  g.font = `700 10px ${F_RAIL}`
  const texte = nom.toUpperCase()
  const w = g.measureText(texte).width + 16
  g.fillStyle = c('#000000', 0.45)
  g.fillRect(-w / 2 + 1, -7, w, 17)
  g.fillStyle = c('#1d3767')
  g.fillRect(-w / 2, -9, w, 17)
  g.strokeStyle = c('#f4efe2')
  g.lineWidth = 1
  g.strokeRect(-w / 2 + 1.5, -7.5, w - 3, 14)
  g.fillStyle = c('#f4efe2')
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(texte, 0, 0)
  g.textBaseline = 'alphabetic'
  g.restore()
}

/** Le poteau de l'embranchement (maquette : `SIGNAL_SVG`, 170 sur 210, son pied en bas au milieu) : la flèche au nom de la halte, et les deux rails qui quittent la ligne. */
function poteau(g: CanvasRenderingContext2D, x: number, y: number, halte: HalteVue): void {
  g.save()
  g.translate(x - 85, y - 210)
  g.strokeStyle = c('#9c9486')
  g.lineWidth = 3
  for (const [y0, y1, y2] of [[204, 196, 150], [210, 204, 160]] as const) {
    g.beginPath()
    g.moveTo(0, y0)
    g.bezierCurveTo(62, y0, 113, y1, 170, y2)
    g.stroke()
  }
  g.fillStyle = c('#3a2414')
  g.fillRect(80, 20, 8, 190)
  g.fillStyle = c('#1b140e')
  g.fillRect(77, 14, 14, 7)
  g.translate(84, 60)
  g.rotate((-4 * Math.PI) / 180)
  g.fillStyle = c('#000000', 0.35)
  g.fillRect(-70, -19, 126, 44)
  g.fillStyle = c('#1d3767')
  g.strokeStyle = c('#f4efe2')
  g.lineWidth = 2.5
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(-72, -22)
  g.lineTo(54, -22)
  g.lineTo(76, 0)
  g.lineTo(54, 22)
  g.lineTo(-72, 22)
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = c('#f4efe2')
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  // Un nom plus long que « Halte Méliès » se serre dans la flèche au lieu d'en sortir.
  g.font = `700 17px ${F_RAIL}`
  g.fillText(halte.nom.toUpperCase(), -8, -2, 118)
  g.font = `10px ${F_RAIL}`
  g.fillText(filmsDuPoteau(halte.total), -8, 14, 118)
  g.restore()
}

/**
 * Les aiguillages sur la toile des gares, dans le repère de l'écran : le poteau, puis le levier, dont
 * la zone `aiguillage` porte le rang de la halte dans la vue (le moteur dit sa clé à la page, au calme
 * aussi). Rien n'y bouge. La zone est celle que dit la règle pure (`AiguillageALEcran.zone`), telle quelle.
 */
export function dessinerAiguillages(v: VueMonde): void {
  for (const a of aiguillagesALEcran(v)) {
    if (a.poteau.x > -90 && a.poteau.x < v.W + 90) poteau(v.ctx, a.poteau.x, a.poteau.y, a.halte)
    if (a.levier.x < -40 || a.levier.x > v.W + 40) continue
    levier(v.ctx, a.levier.x, a.levier.y, a.halte.nom)
    v.zone('aiguillage', a.zone.x, a.zone.y, a.zone.r, a.rang, a.zone.priorite)
  }
}
