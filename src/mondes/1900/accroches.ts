import type { VueMonde } from '../types'
import { c } from './couleur'
import { cuire } from './cuisson'
import { affichesDeLaFicelle, PENCHES } from './ficelle'

/**
 * Le trait de la ficelle (idée 72 ; maquette : `.accroches`, l. 1109-1116) : un fil qui pend, et
 * sous lui les affiches des films vus, chacune à sa pince dorée, un peu de travers. Lesquelles et
 * dans quel ordre vient de `ficelle.ts` ; ici, rien que le trait, sans avance ni horloge. Toute la
 * ficelle se cuit sur une seule toile (`cuire`), dont la clé porte les adresses et lesquelles sont
 * chargées : une affiche qui arrive la fait recuire, une affiche qui manque laisse son papier nu.
 * Sans toile hors écran (jsdom), rien n'est dessiné.
 */

/** Une affiche (maquette : 40 px de large, trois sur quatre), l'écart entre deux, et ce dont le fil dépasse de chaque côté. */
const LARGE = 40
const HAUTE = (LARGE * 4) / 3
const ECART = 8
const DEBORD = 16
/** Ce que la toile garde autour de la ficelle : l'ombre, le liseré, le coin d'une affiche penchée. */
const MARGE = 24
const TETE = 6
const HAUT = TETE + 10 + HAUTE + 22
/** La toile est cuite trois fois plus fine que posée : une vignette de l'API sur un écran dense. */
const FINESSE = 3

/** La largeur et la hauteur d'une image, nulles pour ce qui n'en dit rien. */
function tailleDe(image: CanvasImageSource): [number, number] | null {
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) return [image.naturalWidth, image.naturalHeight]
  const { width, height } = image as { width?: unknown; height?: unknown }
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 ? [width, height] : null
}

/** Une affiche à sa pince, dans un repère dont l'origine est le milieu de son bord haut. */
function affiche(g: CanvasRenderingContext2D, image: CanvasImageSource | null): void {
  g.save()
  g.shadowColor = c('#000000', 0.6)
  g.shadowBlur = 6 * FINESSE
  g.shadowOffsetX = 2 * FINESSE
  g.shadowOffsetY = 4 * FINESSE
  g.fillStyle = c('#efe6d0')
  g.fillRect(-LARGE / 2 - 2, -2, LARGE + 4, HAUTE + 4)
  g.restore()
  g.fillStyle = c('#2a180c')
  g.fillRect(-LARGE / 2, 0, LARGE, HAUTE)
  if (image) {
    // Elle couvre son cadre, centrée (maquette : `center / cover`).
    const taille = tailleDe(image)
    if (taille) {
      const e = Math.max(LARGE / taille[0], HAUTE / taille[1])
      const w = LARGE / e
      const h = HAUTE / e
      g.drawImage(image, (taille[0] - w) / 2, (taille[1] - h) / 2, w, h, -LARGE / 2, 0, LARGE, HAUTE)
    } else g.drawImage(image, -LARGE / 2, 0, LARGE, HAUTE)
  }
  const pince = g.createLinearGradient(0, -6, 0, 5)
  pince.addColorStop(0, c('#e2c27a'))
  pince.addColorStop(1, c('#9c7a36'))
  g.fillStyle = pince
  g.fillRect(-2.5, -6, 5, 11)
}

/** La ficelle entière, sur sa toile : le fil d'abord, les affiches par-dessus. */
function peindre(g: CanvasRenderingContext2D, images: ReadonlyArray<CanvasImageSource | null>): void {
  const n = images.length
  const large = n * LARGE + (n - 1) * ECART
  g.scale(FINESSE, FINESSE)
  g.translate(MARGE, TETE)
  g.strokeStyle = c('#e9dcc0', 0.75)
  g.lineWidth = 1
  g.beginPath()
  g.ellipse(large / 2, 2, large / 2 + DEBORD, 9, 0, 0, Math.PI)
  g.stroke()
  images.forEach((image, k) => {
    g.save()
    g.translate(k * (LARGE + ECART) + LARGE / 2, 10)
    g.rotate((PENCHES[k % PENCHES.length]! * Math.PI) / 180)
    affiche(g, image)
    g.restore()
  })
}

/**
 * La ficelle, centrée en `x`, son haut en `y`, grossie de `echelle`. Chaque affiche est redemandée à
 * chaque image, cuite ou non : c'est ce qui la garde dans la mémoire bornée des affiches
 * (`CarteCanvas.tsx`). Rien sans affiche à pincer.
 */
export function dessinerFicelle(v: Pick<VueMonde, 'ctx' | 'cases' | 'image'>, x: number, y: number, echelle: number): void {
  const adresses = affichesDeLaFicelle(v.cases)
  if (adresses.length === 0) return
  const images = adresses.map((url) => v.image(url))
  const w = adresses.length * LARGE + (adresses.length - 1) * ECART + 2 * MARGE
  const cle = `ficelle:${adresses.map((url, k) => `${images[k] ? '+' : '-'}${url}`).join('|')}`
  const toile = cuire(cle, w * FINESSE, HAUT * FINESSE, (g) => peindre(g, images))
  if (toile) v.ctx.drawImage(toile, x - (w * echelle) / 2, y - TETE * echelle, w * echelle, HAUT * echelle)
}
