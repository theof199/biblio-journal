/**
 * Le titre d'un film en lignes de panneau, pour les deux enseignes qui en portent : le fronton de
 * l'accueil et la vignette d'un film sans affiche sur sa pellicule. Fonction pure, testée sans réseau.
 */

export interface LigneDeTitre {
  texte: string
  /** `true` : lettres réduites, parce que le titre passe sur deux lignes (ou ne tient pas sur une en grandes lettres). */
  compacte: boolean
}

/**
 * Le titre en une seule ligne de grandes lettres s'il a au plus `longueurMax` lettres, sinon en deux
 * lignes compactes coupées à l'espace qui les équilibre le mieux — jamais un mot coupé. Un titre
 * sans espace reste sur une ligne compacte.
 */
export function lignesDeTitre(titre: string, longueurMax: number): LigneDeTitre[] {
  if (titre.length <= longueurMax) return [{ texte: titre, compacte: false }]
  let meilleureCoupe = -1
  let pireLigne = Infinity
  for (let position = 0; position < titre.length; position++) {
    if (titre[position] !== ' ') continue
    const plusLongue = Math.max(position, titre.length - position - 1)
    if (plusLongue < pireLigne) {
      pireLigne = plusLongue
      meilleureCoupe = position
    }
  }
  if (meilleureCoupe === -1) return [{ texte: titre, compacte: true }]
  return [
    { texte: titre.slice(0, meilleureCoupe), compacte: true },
    { texte: titre.slice(meilleureCoupe + 1), compacte: true },
  ]
}

/** Les deux lignes d'un titre coupé se lisent à la même taille : celle que la plus longue impose. */
export const longueurDeLecture = (lignes: readonly LigneDeTitre[]): number =>
  Math.max(1, ...lignes.filter((ligne) => ligne.compacte).map((ligne) => ligne.texte.length))
