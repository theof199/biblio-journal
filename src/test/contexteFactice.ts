/**
 * Un `CanvasRenderingContext2D` qui ne dessine rien et note tout : jsdom n'a pas de canvas
 * (`getContext` rend `null`), et les propriétés à interdire (l'ordre des couches, l'absence de
 * lecture de pixels, l'image figée quand le visiteur demande moins d'animations) se lisent dans
 * la suite des appels. Tient la pile `save`/`restore` et la matrice courante, que `getTransform`
 * rend : les zones touchables en dépendent.
 */
export interface Appel {
  nom: string
  args: unknown[]
  fillStyle: unknown
  strokeStyle: unknown
  alpha: number
  composite: string
  /** Le décalage du pointillé : le chemin parcouru coule d'après lui. */
  dash: number
}

type Etat = { fillStyle: unknown; strokeStyle: unknown; globalAlpha: number; globalCompositeOperation: string; lineDashOffset: number; m: number[] }
const IDENTITE = [1, 0, 0, 1, 0, 0]
const multiplier = (m: number[], n: number[]) => [
  m[0]! * n[0]! + m[2]! * n[1]!,
  m[1]! * n[0]! + m[3]! * n[1]!,
  m[0]! * n[2]! + m[2]! * n[3]!,
  m[1]! * n[2]! + m[3]! * n[3]!,
  m[0]! * n[4]! + m[2]! * n[5]! + m[4]!,
  m[1]! * n[4]! + m[3]! * n[5]! + m[5]!,
]

export function contexteFactice(): { ctx: CanvasRenderingContext2D; appels: Appel[] } {
  const appels: Appel[] = []
  let etat: Etat = { fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, globalCompositeOperation: 'source-over', lineDashOffset: 0, m: IDENTITE }
  const pile: Etat[] = []
  // Un dégradé garde ses arrêts : une couleur qui palpite (le faisceau, la brume) se lit dans le
  // `fillStyle` noté, pas seulement dans l'appel qui le pose.
  const degrade = () => {
    const arrets: Array<[number, string]> = []
    return { arrets, addColorStop: (o: number, c: string) => void arrets.push([o, c]) }
  }
  const noter = (nom: string, args: unknown[]) =>
    appels.push({ nom, args, fillStyle: etat.fillStyle, strokeStyle: etat.strokeStyle, alpha: etat.globalAlpha, composite: etat.globalCompositeOperation, dash: etat.lineDashOffset })
  const special: Record<string, (...a: number[]) => unknown> = {
    save: () => void pile.push({ ...etat }),
    restore: () => void (etat = pile.pop() ?? etat),
    translate: (x, y) => void (etat.m = multiplier(etat.m, [1, 0, 0, 1, x!, y!])),
    scale: (x, y) => void (etat.m = multiplier(etat.m, [x!, 0, 0, y!, 0, 0])),
    rotate: (r) => void (etat.m = multiplier(etat.m, [Math.cos(r!), Math.sin(r!), -Math.sin(r!), Math.cos(r!), 0, 0])),
    transform: (a, b, c, d, e, f) => void (etat.m = multiplier(etat.m, [a!, b!, c!, d!, e!, f!])),
    setTransform: (a, b, c, d, e, f) => void (etat.m = [a!, b!, c!, d!, e!, f!]),
    resetTransform: () => void (etat.m = IDENTITE),
    getTransform: () => ({ a: etat.m[0], b: etat.m[1], c: etat.m[2], d: etat.m[3], e: etat.m[4], f: etat.m[5] }),
    createLinearGradient: degrade,
    createRadialGradient: degrade,
    createPattern: degrade,
    measureText: () => ({ width: 40 }),
    // Le grain de la maquette écrit ses pixels dans une `ImageData` neuve (`preRendus`) : sans
    // elle, `mesurer` lèverait et aucun test du moteur ne démarrerait.
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w! * h! * 4) }),
  }
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(_, cle) {
      if (typeof cle !== 'string') return undefined
      if (cle in etat) return etat[cle as keyof Etat]
      return (...args: number[]) => {
        noter(cle, args)
        return special[cle]?.(...args)
      }
    },
    set(_, cle, valeur) {
      if (typeof cle === 'string' && cle in etat) (etat as Record<string, unknown>)[cle] = valeur
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, appels }
}
