import type { SuiviGare, VueMonde } from '../types'
import { c, F_RAIL } from './couleur'
import { imageDu1900, TAILLES } from './images'
import { milieuDeLaGare } from './gares'
import { dansLaFenetre, ouvrir } from './toiles'
import { ANNEES } from './trace'

/**
 * La voiture du Voyage suivi à l'écran (maquette : `.voisin`, l. 125 et 2982-2986) : garée à quai
 * dans la gare de son année, haute d'un cinquième de l'écran, à 12 % du bas, 70 px à droite du
 * milieu de la gare. Nulle pour une année qui n'est pas de ce monde, ou hors de l'écran.
 */
export function voitureALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>, annee: number): { x: number; y: number; w: number; h: number } | null {
  const i = ANNEES.indexOf(annee)
  if (i < 0) return null
  const [lp, hp] = TAILLES.voisin!
  const h = v.H * 0.2
  const w = (h * lp) / hp
  const x = milieuDeLaGare(v, i) - w / 2 + 70
  if (x + w < 0 || x > v.W) return null
  return { x, y: v.H * 0.88 - h, w, h }
}

/**
 * Le Voyage suivi garé dans son année : sa voiture à quai, son nom à la craie, et la zone
 * `roulotte` que le moteur attend du monde.
 */
export function dessinerSuivi(v: VueMonde, suivi: SuiviGare): void {
  const p = voitureALEcran(v, suivi.annee)
  if (!p || !ouvrir(v)) return
  const g = v.ctx
  const url = imageDu1900('voisin')
  const photo = url ? v.image(url) : null
  if (photo) g.drawImage(photo, p.x, p.y, p.w, p.h)
  // L'ardoise à la craie (maquette : `.craie`), penchée de deux degrés.
  g.save()
  g.translate(p.x + p.w * 0.34, p.y + p.h * 0.25)
  g.rotate(-0.035)
  const texte = `${suivi.pseudo} · ${suivi.annee}`.toUpperCase()
  g.font = `700 13px ${F_RAIL}`
  const w = g.measureText(texte).width + 16
  g.fillStyle = c('#1b1814')
  g.fillRect(0, 0, w, 20)
  g.strokeStyle = c('#efe9dc', 0.4)
  g.lineWidth = 1
  g.strokeRect(0, 0, w, 20)
  g.fillStyle = c('#efe9dc')
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(texte, 8, 10.5)
  g.textBaseline = 'alphabetic'
  g.restore()
  // Devant la zone `case` de sa gare (priorité 1), comme la roulotte de 1890 ; jamais hors de la
  // fenêtre de la section, où la voiture est coupée.
  if (dansLaFenetre(v, p.y + p.h / 2)) v.zone('roulotte', p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 2 + 6, undefined, 2)
  g.restore()
}
