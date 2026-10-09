/**
 * Ce que le monde 1900 peint une fois pour le reposer à chaque image : une photographie fondue par
 * ses bords, sa plaque négative, un fond d'ambiance. Le fondu n'est cuit dans aucun fichier (fiche
 * de données, « Le fondu : laissé au dessin ») : une toile hors écran, puis un dégradé par bord en
 * `destination-in`, sans lire un pixel ni dépendre de `ctx.filter`.
 *
 * La mémoire est bornée : au-delà du plafond, la toile la moins récemment servie est rendue. Ce
 * n'est pas une mémoire du dessin : une toile rendue se recuit à l'identique.
 *
 * Une toile se cuit à une finesse : tant de pixels par px du dessin. Ce qui se dessine (le fond d'une
 * ambiance) se cuit à la densité de l'écran, celle que le moteur donne à sa propre toile
 * (`VueMonde.densite`) ; une photographie, jamais plus fin que ce qu'elle porte (`finesseDeCuisson`).
 * Sans finesse dite, 1 : la toile a la taille demandée, comme avant.
 */
import { c } from './couleur'

/** Combien de toiles cuites le monde garde : au-delà, la moins récemment servie est rendue. */
export const PLAFOND = 28
/** Vrai dès qu'une toile hors écran a été refusée : on ne la redemande plus, à chaque élément de chaque image. */
let refusee = false

export interface ToileHorsEcran {
  toile: HTMLCanvasElement
  g: CanvasRenderingContext2D
}
/** Ce qui peint une toile cuite : `w` et `h` sont ceux du dessin, la finesse est déjà sur le contexte. */
export type PeintreDeToile = (g: CanvasRenderingContext2D, w: number, h: number) => void

/**
 * La finesse à laquelle cuire ce qui se posera à la densité `densite` : cette densité, jamais moins
 * de 1. Pour une photographie de `natif` px posée sur `pose` px, pas au-delà de ce qu'elle porte :
 * l'agrandir dans sa toile coûterait de la mémoire sans rien montrer de plus.
 */
export function finesseDeCuisson(densite: number, natif?: number, pose?: number): number {
  const ecran = Math.max(1, densite || 1)
  if (natif === undefined || pose === undefined || pose <= 0) return ecran
  return Math.min(ecran, Math.max(1, natif / pose))
}
/**
 * Une toile hors écran et son contexte, hors de la mémoire des toiles cuites : à qui la demande de
 * la tenir et de la rendre (`width = 0`). Nulle là où il n'y en a pas ; le refus est retenu.
 */
export function toileHorsEcran(w: number, h: number): ToileHorsEcran | null {
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
 * Une mémoire de toiles cuites, sur la fabrique de toiles qu'on lui donne (`toileHorsEcran` pour le
 * monde ; un test en donne une autre). `cuire` rend la toile cuite sous `cle`, peinte par `peindre`
 * la première fois : large de `w × finesse` pixels, haute de `h × finesse`, le contexte déjà à la
 * finesse, si bien que `peindre` dessine dans `w` × `h` et que la toile se pose dans `w` × `h`.
 * Redemandée à une autre finesse (l'écran a changé de densité : une rotation, un zoom), la toile
 * d'avant est rendue et une autre se cuit : jamais deux finesses de la même clé. Nulle là où aucune
 * toile hors écran ne s'obtient (jsdom, un navigateur à court de mémoire) : le dessin s'en passe
 * alors, et pose ce qu'il a sans fondu.
 */
export function creerFour(fabrique: (w: number, h: number) => ToileHorsEcran | null, plafond = PLAFOND) {
  const cuites = new Map<string, { toile: HTMLCanvasElement; finesse: number }>()
  return function cuire(cle: string, w: number, h: number, peindre: PeintreDeToile, finesse = 1): CanvasImageSource | null {
    const deja = cuites.get(cle)
    if (deja && deja.finesse === finesse) {
      cuites.delete(cle)
      cuites.set(cle, deja)
      return deja.toile
    }
    const neuve = fabrique(w * finesse, h * finesse)
    if (!neuve) return null
    if (deja) {
      deja.toile.width = 0
      cuites.delete(cle)
    }
    const { toile, g } = neuve
    if (finesse !== 1) g.scale(finesse, finesse)
    peindre(g, toile.width / finesse, toile.height / finesse)
    cuites.set(cle, { toile, finesse })
    if (cuites.size > plafond) {
      const [vieille, rendue] = cuites.entries().next().value!
      rendue.toile.width = 0
      cuites.delete(vieille)
    }
    return toile
  }
}

/** La mémoire du monde. Un refus de toile y est retenu jusqu'au rechargement de la page. */
export const cuire = creerFour(toileHorsEcran)

/** Ne garde de ce qui est peint que ce que le dégradé couvre : un fondu, d'un bord à l'autre. */
export function fondre(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, arrets: ReadonlyArray<readonly [number, number]>, w: number, h: number): void {
  const d = g.createLinearGradient(x0, y0, x1, y1)
  for (const [ou, alpha] of arrets) d.addColorStop(ou, c('#000000', alpha))
  g.globalCompositeOperation = 'destination-in'
  g.fillStyle = d
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'source-over'
}
