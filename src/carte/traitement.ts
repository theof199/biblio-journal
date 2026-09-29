import { hash } from './outils'

/**
 * Le traitement « image qui tremble » d'un monde (décision du 28 septembre 2026 : 1890 est
 * l'image de la manivelle) : l'horloge du décor avance par images entières (`cadence`), le cadre
 * tremble d'une fraction de pixel, la lumière palpite. Rien de tout cela quand le visiteur
 * demande moins d'animations.
 */

/** L'horloge du décor, tenue sur chaque image jusqu'à la suivante ; `cadence` nulle : continue. */
export const horlogeDuMonde = (t: number, cadence: number | null) => (cadence ? Math.floor(t * cadence) / cadence : t)

/** Le décalage du cadre, identique sur toute une image de `cadence`, nul si `calme`. */
export function tremblement(t: number, cadence: number, amplitude: number, calme: boolean) {
  if (calme || amplitude <= 0) return { dx: 0, dy: 0 }
  const image = Math.floor(t * cadence)
  return { dx: (hash(image * 1.37) * 2 - 1) * amplitude, dy: (hash(image * 2.71 + 5) * 2 - 1) * amplitude }
}

/**
 * Le plafond du voile qui palpite, en opacité de noir sur tout l'écran. WCAG 2.3.1 : un flash
 * général est un aller-retour de luminance relative de 0,10 ou plus. Un voile noir d'opacité a
 * multiplie chaque composante sRGB par (1 − a) ; sur un blanc pur, a = 0,03 fait passer la
 * luminance relative de 1 à 0,933 (formule WCAG), soit 0,067 : sous le seuil, même à 16 Hz.
 */
export const SCINTILLEMENT_MAX = 0.03

export function scintillement(t: number, cadence: number, amplitude: number, calme: boolean) {
  if (calme) return 0
  const a = Math.min(Math.max(0, amplitude), SCINTILLEMENT_MAX)
  return hash(Math.floor(t * cadence) * 0.73 + 11) * a
}
