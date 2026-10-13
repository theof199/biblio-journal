/**
 * Le retour du « Vu » : ce que la télécommande dit quand on vient de cocher un épisode. Le socle ne
 * connaît ni le Travail ni la Maison (`src/studio/`, `src/maison/`, qu'il n'importe pas) : c'est l'espace
 * affiché qui s'inscrit ici à son montage, et se retire à son démontage,
 *
 *     useEffect(() => fournirLeRetourDuVu((coche) => `+1 pour ${coche.serie}`), [])
 *
 * et la télécommande lit. Sans fournisseur, ou s'il n'a rien à dire, le message neutre.
 */

/** Ce qu'on vient de cocher. */
export interface EpisodeCoche {
  /** L'identifiant de la série (`media_id`). */
  serieId: string
  /** Son titre. */
  serie: string
  saison: number
  numero: number
  /** Le titre de l'épisode, s'il en a un. */
  titre: string | null
}

/** Rend le message de l'espace pour cet épisode, ou `null` s'il n'a rien à dire. */
export type FournisseurDuRetour = (coche: EpisodeCoche) => string | null

export const RETOUR_NEUTRE = 'Épisode noté'

/** Combien de temps le message tient la place de la rangée principale, en millisecondes. */
export const DUREE_DU_RETOUR = 5000

let fournisseur: FournisseurDuRetour | null = null

/**
 * Inscrit le fournisseur de l'espace affiché ; rend son retrait. Un seul à la fois : le dernier inscrit
 * parle, et le retrait d'un fournisseur déjà remplacé ne retire pas son successeur.
 */
export function fournirLeRetourDuVu(fn: FournisseurDuRetour): () => void {
  fournisseur = fn
  return () => {
    if (fournisseur === fn) fournisseur = null
  }
}

/** Le message à montrer : celui du fournisseur, sinon le neutre. Un fournisseur qui casse ne casse pas la coche. */
export function lireLeRetourDuVu(coche: EpisodeCoche): string {
  try {
    return fournisseur?.(coche) || RETOUR_NEUTRE
  } catch {
    return RETOUR_NEUTRE
  }
}
