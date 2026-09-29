/**
 * La feuille du chroniqueur (maquette 1890, écran VIII), sans rendu : les paragraphes d'un texte, et
 * la part du premier qui se compose mot à mot avant que le reste n'arrive en fondu.
 */

/** Les paragraphes, séparés par une ligne vide ; jamais un paragraphe vide. */
export const paragraphes = (texte: string): string[] =>
  texte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/**
 * Où s'arrête la part composée mot à mot (maquette : `partieTapee`) : à `limite` caractères, prolongée
 * jusqu'au premier blanc pour ne jamais couper un mot ; tout le texte s'il est plus court.
 */
export function partieComposee(texte: string, limite = 140): number {
  if (texte.length <= limite) return texte.length
  for (let i = limite; i < texte.length; i += 1) if (/\s/.test(texte[i]!)) return i
  return texte.length
}

/** Les quatre feuilles et leur numéro sur le prospectus (maquette : `DEF`). */
export const NUMERO_DE_FEUILLE = { ouverture: 1, salle: 2, film: 3, generique: 4 } as const
