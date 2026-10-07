import { clamp, lerp, lisse } from './outils'
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

/** Le rang de la section de **la décennie à l'écran** : le plus fort poids de mélange, le premier en cas d'égalité ; -1 sans section. */
export function sectionALEcran(poids: readonly number[]): number {
  return poids.indexOf(Math.max(...poids))
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

/** Un ralenti du roulement en `y` de carte (`Ralenti`, `mondes/types.ts`) : de `haut` à `bas`, la caméra ne garde que la part `allure` de sa vitesse. */
export interface RalentiDeCarte {
  haut: number
  bas: number
  allure: number
}

/**
 * Le **coût** d'un `y` de carte : l'intégrale de `1 / allure` depuis le haut de la carte, l'allure
 * valant 1 hors de tout ralenti. Un pixel d'un ralenti d'allure 0,5 en coûte deux. Croissante,
 * affine par morceaux, de pente 1 au moins : elle s'inverse (`yDuCout`).
 */
export function coutDe(y: number, ralentis: readonly RalentiDeCarte[]): number {
  return ralentis.reduce((cout, r) => cout + (1 / r.allure - 1) * clamp(y - r.haut, 0, r.bas - r.haut), y)
}

/** L'inverse de `coutDe` : le `y` de carte dont le coût est `cout`. */
export function yDuCout(cout: number, ralentis: readonly RalentiDeCarte[]): number {
  const bornes = [...new Set(ralentis.flatMap((r) => [r.haut, r.bas]))].sort((a, b) => a - b)
  // Au-dessus du premier ralenti, rien n'est compté : le coût est le `y` lui-même.
  if (bornes.length === 0 || cout <= bornes[0]!) return cout
  for (let i = 1; i < bornes.length; i++) {
    const c1 = coutDe(bornes[i]!, ralentis)
    if (cout > c1) continue
    const c0 = coutDe(bornes[i - 1]!, ralentis)
    return bornes[i - 1]! + ((cout - c0) * (bornes[i]! - bornes[i - 1]!)) / (c1 - c0)
  }
  // Sous le dernier ralenti, la pente est de 1 à nouveau.
  const dernier = bornes[bornes.length - 1]!
  return dernier + (cout - coutDe(dernier, ralentis))
}

/**
 * Ce que les ralentis font d'un roulement de `y0` à `y1` ; **nul quand aucun n'est sur le trajet**
 * (aucun en commun avec lui sur plus qu'un bord, ou d'une allure hors de `]0, 1[`) : le roulement
 * reste alors ce qu'il est sans eux, par le calcul d'avant et non par un coût qui retomberait juste.
 * Sinon le roulement progresse **dans le coût** : `y(p)` est où il en est quand sa courbe d'aisance
 * vaut `p` (0 au départ, 1 à l'arrivée), et `allonge` ce par quoi sa durée se multiplie, le coût du
 * trajet rapporté à sa longueur. Hors d'un ralenti, il va donc à la vitesse qu'il aurait eue sans
 * lui au même instant de sa courbe ; dedans, à cette vitesse multipliée par l'allure.
 */
export function trajetRalenti(y0: number, y1: number, ralentis: readonly RalentiDeCarte[]): { allonge: number; y: (p: number) => number } | null {
  const haut = Math.min(y0, y1)
  const bas = Math.max(y0, y1)
  const sur = ralentis.filter((r) => r.allure > 0 && r.allure < 1 && Math.min(r.bas, bas) > Math.max(r.haut, haut))
  if (sur.length === 0) return null
  const c0 = coutDe(y0, sur)
  const c1 = coutDe(y1, sur)
  return { allonge: Math.abs(c1 - c0) / (bas - haut), y: (p) => yDuCout(lerp(c0, c1, p), sur) }
}
