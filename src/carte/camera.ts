import { clamp, lisse } from './outils'
import type { SectionPlacee } from './placement'

/** Où poser le défilement pour que `yMonde` tombe un peu au-dessus du milieu de l'écran (maquette : `H * .52`). */
export function cibleCamera(yMonde: number, H: number, hauteur: number): number {
  return clamp(yMonde - H * 0.52, 0, Math.max(0, hauteur - H))
}

/** Demi-largeur du fondu entre deux mondes, en px de carte (maquette : `lisse(1350, 1850, camC)`). */
export const FONDU = 250

/**
 * La présence de chaque monde à l'écran, de 0 à 1, selon le centre de la caméra `camC` : 1 au
 * cœur de sa section, un fondu de 500 px à chaque frontière. La somme vaut 1 partout, tant
 * qu'aucune section ne mesure moins de 2 × FONDU (`HAUTEUR_MIN_SECTION`).
 */
export function poidsSections(camC: number, sections: readonly SectionPlacee[]): number[] {
  return sections.map((s, i) => {
    const entree = i === 0 ? 1 : lisse(s.y0 - FONDU, s.y0 + FONDU, camC)
    const suivante = sections[i + 1]
    const sortie = suivante ? 1 - lisse(suivante.y0 - FONDU, suivante.y0 + FONDU, camC) : 1
    return entree * sortie
  })
}
