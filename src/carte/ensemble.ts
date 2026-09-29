import { clamp } from './outils'

export interface BandeSource {
  y0: number
  hauteur: number
  /** Une section détaillée montre une marquise par année ; les autres, une seule pour la décennie. */
  detaillee: boolean
}
export interface Bande {
  y0: number
  y1: number
}

/** Le poids d'une section repliée, en px de carte : quelle que soit sa longueur, elle tient une marquise. */
export const POIDS_REPLIEE = 220

/**
 * La vue d'ensemble : toute la carte dans l'écran, entre `haut` et `H - bas`. Une section
 * détaillée garde sa longueur relative ; une section repliée ne pèse que `POIDS_REPLIEE`. Sans
 * cela, cent trente années dans cinq cents pixels donneraient moins de quatre pixels par année.
 * `versEcran` et `versMonde` sont réciproques et croissantes.
 */
export function geoEnsemble(sections: readonly BandeSource[], H: number, haut: number, bas: number) {
  const poids = sections.map((s) => (s.detaillee ? s.hauteur : Math.min(s.hauteur, POIDS_REPLIEE)))
  const total = poids.reduce((a, b) => a + b, 0) || 1
  const echelle = Math.max(0, H - haut - bas) / total
  const bandes: Bande[] = []
  let y = haut
  for (const p of poids) {
    bandes.push({ y0: y, y1: y + p * echelle })
    y += p * echelle
  }
  const versEcran = (yMonde: number): number => {
    const i = sections.findIndex((s) => yMonde < s.y0 + s.hauteur)
    const k = i === -1 ? sections.length - 1 : i
    const s = sections[k]
    const b = bandes[k]
    if (!s || !b) return haut
    const u = clamp((yMonde - s.y0) / s.hauteur, 0, 1)
    return b.y0 + u * (b.y1 - b.y0)
  }
  const versMonde = (yEcran: number): number => {
    const i = bandes.findIndex((b) => yEcran < b.y1)
    const k = i === -1 ? bandes.length - 1 : i
    const s = sections[k]
    const b = bandes[k]
    if (!s || !b) return 0
    const u = clamp((yEcran - b.y0) / (b.y1 - b.y0 || 1), 0, 1)
    return s.y0 + u * s.hauteur
  }
  return { bandes, versEcran, versMonde }
}
