import type { VueMonde } from '../types'

/**
 * Les dessins de la carte (`moyen.ts`, `proches.ts`) prennent une `VueMonde` : une page du Voyage
 * leur en prête une, sans carte derrière. Rien n'y est touchable ni n'y fume ; `age` ne connaît que
 * le toucher de la toile (le rideau qui se rouvre, le manège qui s'emballe). Aucune bobine perdue
 * ne s'y cache : elles ne se trouvent que sur la carte (plan 2d).
 */
/** Les images des pages (la planche du train) : une fois chargées, gardées ; la vue se refait à chaque image. */
const IMAGES = new Map<string, HTMLImageElement>()

export function vuePage(o: { ctx: CanvasRenderingContext2D; W: number; H: number; t: number; vivant: boolean; nuit: number; touche: number; annee: number }): VueMonde {
  const rien = () => undefined
  return {
    ctx: o.ctx,
    W: o.W,
    H: o.H,
    k: 1,
    t: o.t,
    vivant: o.vivant,
    presence: 1,
    lum: 0.45 + 0.85 * o.nuit,
    nuit: o.nuit,
    ecranY: (y) => y,
    zone: rien,
    feu: rien,
    age: (cle) => ((cle === 'rideau' || cle === 'carrousel') && o.touche >= 0 ? Math.max(0, o.t - o.touche) : 99),
    marquer: rien,
    etincelles: rien,
    confettis: rien,
    fumee: rien,
    image: (url) => {
      if (typeof Image !== 'function') return null
      let img = IMAGES.get(url)
      if (!img) {
        img = new Image()
        img.src = url
        IMAGES.set(url, img)
      }
      return img.complete && img.naturalWidth > 0 ? img : null
    },
    cases: [],
    bati: { n: 0, nouvelle: null, t0: -9 },
    bouclee: false,
    roulotte: null,
    adieu: -1,
    ouverte: { annee: o.annee, t0: -9 },
    brume: -1,
    bobine: rien,
    bobineTrouvee: () => true,
  }
}
