/**
 * Ce que le monde 1900 peint une fois pour le reposer à chaque image : une photographie fondue par
 * ses bords, sa plaque négative, un fond d'ambiance. Le fondu n'est cuit dans aucun fichier (fiche
 * de données, « Le fondu : laissé au dessin ») : une toile hors écran, puis un dégradé par bord en
 * `destination-in`, sans lire un pixel ni dépendre de `ctx.filter`.
 *
 * La mémoire est bornée : au-delà du plafond, la toile la moins récemment servie est rendue. Ce
 * n'est pas une mémoire du dessin : une toile rendue se recuit à l'identique.
 */
import { c } from './couleur'

const PLAFOND = 28
const cuites = new Map<string, HTMLCanvasElement>()
/** Vrai dès qu'une toile hors écran a été refusée : on ne la redemande plus, à chaque élément de chaque image. */
let refusee = false

/**
 * Une toile hors écran et son contexte, hors de la mémoire des toiles cuites : à qui la demande de
 * la tenir et de la rendre (`width = 0`). Nulle là où il n'y en a pas ; le refus est retenu.
 */
export function toileHorsEcran(w: number, h: number): { toile: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  if (refusee || typeof document === 'undefined') return null
  const toile = document.createElement('canvas')
  toile.width = Math.max(1, Math.ceil(w))
  toile.height = Math.max(1, Math.ceil(h))
  const g = toile.getContext('2d')
  if (!g) {
    refusee = true
    return null
  }
  return { toile, g }
}

/**
 * La toile cuite sous `cle`, peinte par `peindre` la première fois. Nulle là où aucune toile hors
 * écran ne s'obtient (jsdom, un navigateur à court de mémoire) : le dessin s'en passe alors, et pose
 * ce qu'il a sans fondu. Un refus est retenu jusqu'au rechargement de la page.
 */
export function cuire(cle: string, w: number, h: number, peindre: (g: CanvasRenderingContext2D, w: number, h: number) => void): CanvasImageSource | null {
  const deja = cuites.get(cle)
  if (deja) {
    cuites.delete(cle)
    cuites.set(cle, deja)
    return deja
  }
  const neuve = toileHorsEcran(w, h)
  if (!neuve) return null
  const { toile, g } = neuve
  peindre(g, toile.width, toile.height)
  cuites.set(cle, toile)
  if (cuites.size > PLAFOND) {
    const [vieille, rendue] = cuites.entries().next().value!
    rendue.width = 0
    cuites.delete(vieille)
  }
  return toile
}

/** Ne garde de ce qui est peint que ce que le dégradé couvre : un fondu, d'un bord à l'autre. */
export function fondre(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, arrets: ReadonlyArray<readonly [number, number]>, w: number, h: number): void {
  const d = g.createLinearGradient(x0, y0, x1, y1)
  for (const [ou, alpha] of arrets) d.addColorStop(ou, c('#000000', alpha))
  g.globalCompositeOperation = 'destination-in'
  g.fillStyle = d
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'source-over'
}
