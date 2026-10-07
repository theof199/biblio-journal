import type { CadreDeBande, EtatDeBande, LectureDeBande } from '../types'
import { c, F_RAIL } from './couleur'
import { imageDu1900 } from './images'
import { negatif } from './gares'

interface Rect { x: number; y: number; w: number; h: number }

/**
 * La case de la `i`-ième année dans la bande : `n` cases égales, de gauche à droite, sur toute la
 * hauteur du cadre et bord à bord. Aucun point du cadre n'est entre deux années.
 */
export function vignette(cadre: Pick<CadreDeBande, 'x' | 'y' | 'w' | 'h'>, n: number, i: number): Rect {
  const w = cadre.w / n
  return { x: cadre.x + i * w, y: cadre.y, w, h: cadre.h }
}

/** L'année que désigne un point de l'écran dans la bande : celle de sa case ; nulle hors du cadre. */
export function lectureDeLaBande(cadre: Pick<CadreDeBande, 'x' | 'y' | 'w' | 'h'>, annees: readonly number[]): LectureDeBande {
  return (x, y) => {
    if (annees.length === 0 || x < cadre.x || x >= cadre.x + cadre.w || y < cadre.y || y >= cadre.y + cadre.h) return null
    return annees[Math.min(annees.length - 1, Math.floor(((x - cadre.x) * annees.length) / cadre.w))] ?? null
  }
}

/**
 * La bande du monde dans la vue d'ensemble (maquette : `.b1900`, l. 174-179) : les gares en
 * bandeau, de gauche à droite, une vignette de sa photographie par année et ses deux chiffres ;
 * une année fermée ou en attente du Voyage suivi en négatif, celle du membre cerclée de laiton.
 * L'opacité de la vue d'ensemble est déjà sur le contexte.
 */
export function dessinerBande(g: CanvasRenderingContext2D, cadre: CadreDeBande, etat: EtatDeBande): LectureDeBande {
  const fond = g.createLinearGradient(0, cadre.y, 0, cadre.y + cadre.h)
  fond.addColorStop(0, c('#2a2119'))
  fond.addColorStop(1, c('#17110c'))
  g.fillStyle = fond
  g.fillRect(cadre.x, cadre.y, cadre.w, cadre.h)
  const n = etat.annees.length
  const chiffres = cadre.h >= 34 ? 13 : 0
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.font = `10px ${F_RAIL}`
  etat.annees.forEach((a, i) => {
    const r = vignette(cadre, n, i)
    const p = { x: r.x + 1.5, y: r.y + 3, w: r.w - 3, h: r.h - 6 - chiffres }
    const fermee = a.etat === 'verrou' || a.attente
    const url = imageDu1900(`g${a.annee}`)
    const photo = url ? cadre.image(url) : null
    if (photo) {
      g.drawImage(photo, p.x, p.y, p.w, p.h)
      if (fermee) negatif(g, p.x, p.y, p.w, p.h)
    } else {
      g.fillStyle = fermee ? c('#3e3a35') : c('#8d7a60')
      g.fillRect(p.x, p.y, p.w, p.h)
    }
    const ici = a.annee === etat.anneeAvatar
    g.strokeStyle = ici ? c('#c9a257') : c('#eee4cf', 0.25)
    g.lineWidth = ici ? 2 : 1
    g.strokeRect(p.x, p.y, p.w, p.h)
    if (chiffres) {
      g.fillStyle = fermee ? c('#eee4cf', 0.52) : c('#eee4cf')
      g.fillText(String(a.annee).slice(2), r.x + r.w / 2, r.y + r.h - 4)
    }
  })
  return lectureDeLaBande(cadre, etat.annees.map((a) => a.annee))
}
