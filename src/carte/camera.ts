import { clamp, lisse } from './outils'
import type { SectionPlacee } from './placement'

/** Où poser le défilement pour que `yMonde` tombe un peu au-dessus du milieu de l'écran (maquette : `H * .52`). */
export function cibleCamera(yMonde: number, H: number, hauteur: number): number {
  return clamp(yMonde - H * 0.52, 0, Math.max(0, hauteur - H))
}

/** Demi-largeur du fondu entre deux mondes, en px de carte (maquette : `lisse(1350, 1850, camC)`). */
export const FONDU = 250

/**
 * Les entrées sans fondu (plan 3a) : `collante[i]` dit que la section `i` est collante
 * (`Monde.scene`), `H` est la hauteur de l'écran. À l'entrée d'une section collante, le fondu de
 * 500 px ne s'applique pas ; à sa sortie vers une section ordinaire, il reste celui d'aujourd'hui.
 */
export interface EntreesCollantes {
  H: number
  collante: readonly boolean[]
}

/**
 * Le **poids de mélange** de chaque monde, de 0 à 1, selon le centre de la caméra `camC` : ce qui
 * se mêle d'un monde à l'autre (le ciel, le virage, la musique). Entre deux sections ordinaires : 1
 * au cœur de la section, un fondu de 500 px à la frontière. À l'entrée d'une section collante : la
 * part de l'écran passée sous la frontière, continue d'un pixel à l'autre. La somme vaut 1
 * partout, tant qu'aucune section ne mesure moins de 2 × FONDU (`HAUTEUR_MIN_SECTION`), ni moins
 * que l'écran quand la section d'après est collante.
 */
export function poidsSections(camC: number, sections: readonly SectionPlacee[], entrees?: EntreesCollantes): number[] {
  // De combien la frontière du haut de la section `i` est franchie, de 0 à 1.
  const franchie = (i: number): number => {
    const y0 = sections[i]!.y0
    return entrees?.collante[i] ? clamp((camC + entrees.H / 2 - y0) / entrees.H, 0, 1) : lisse(y0 - FONDU, y0 + FONDU, camC)
  }
  return sections.map((_, i) => {
    const entree = i === 0 ? 1 : franchie(i)
    const sortie = sections[i + 1] ? 1 - franchie(i + 1) : 1
    return entree * sortie
  })
}

/**
 * La **présence** de chaque monde à l'écran, de 0 à 1 : ce que le monde reçoit pour dessiner sa
 * part (`VueMonde.presence`), et ce qui dit s'il dessine. Entre deux sections ordinaires, c'est le
 * poids de mélange. À l'entrée d'une section collante, il n'y a pas de fondu : le monde quitté
 * garde 1 tant que sa section est à l'écran, le monde collant a 1 dès que la sienne y entre.
 */
export function presencesSections(camC: number, sections: readonly SectionPlacee[], entrees: EntreesCollantes): number[] {
  const haut = camC - entrees.H / 2
  const bas = camC + entrees.H / 2
  const fondu = (i: number): number => lisse(sections[i]!.y0 - FONDU, sections[i]!.y0 + FONDU, camC)
  return sections.map((s, i) => {
    const entree = i === 0 ? 1 : entrees.collante[i] ? (bas > s.y0 ? 1 : 0) : fondu(i)
    const suivante = sections[i + 1]
    const sortie = !suivante ? 1 : entrees.collante[i + 1] ? (haut < suivante.y0 ? 1 : 0) : 1 - fondu(i + 1)
    return entree * sortie
  })
}
