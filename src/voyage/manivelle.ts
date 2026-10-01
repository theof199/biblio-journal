/**
 * Tirer pour rafraîchir : la manivelle (idée 6 ; maquette 1890, écran I, `initAnnee`), sans rendu.
 * Le contenu suit le doigt à mi-course, plafonné ; au-delà du seuil, le lâcher recharge la bobine.
 */

/** La course du contenu au plus, en px (maquette : `Math.min(110, d * .5)`). */
export const TIRAGE_MAX = 110
/** Au-delà, lâcher recharge (maquette : `dy > 70`). */
export const SEUIL_MANIVELLE = 70

/** La course du contenu pour un doigt descendu de `ecart` px ; rien s'il remonte. */
export const tirage = (ecart: number): number => Math.min(TIRAGE_MAX, Math.max(0, ecart) * 0.5)

/** Lâcher à la course `dy` : recharger au-delà du seuil, sinon le contenu revient. */
export const aLaLachee = (dy: number): 'recharger' | 'revenir' => (dy > SEUIL_MANIVELLE ? 'recharger' : 'revenir')

/** Le bras de la manivelle tourne avec le geste : quatre degrés par pixel (maquette : `dy * 4`). */
export const angleDuBras = (dy: number): number => dy * 4

/**
 * Un tirage ne commence qu'en haut de la page : la zone qui défile (le `<main>` de la coque) doit
 * être tout en haut, sinon le geste est un défilement ordinaire. Jamais pendant un rechargement.
 */
export const peutTirer = (scrollTop: number, enCours: boolean): boolean => scrollTop <= 0 && !enCours
