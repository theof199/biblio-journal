import chapitre1 from './chapitre-1.module.css'

/**
 * L'habillage de la télécommande du Feuilleton : tout ce qui s'en voit (couleurs, formes des touches,
 * cadre, écran, polices) et ses petits libellés d'ambiance. Un chapitre du jeu = un habillage = un
 * fichier `chapitre-N.module.css` et une ligne de `HABILLAGES` ; les composants
 * (`feuilleton/telecommande/`) ne changent pas : ils ne lisent que les variables `--h-*` que la classe
 * du chapitre pose. Comment en ajouter un : `docs/feuilleton/habillages.md`.
 */
export interface Habillage {
  /** La classe qui pose les variables `--h-*` : sur le bouton rond et sur le panneau. */
  classe: string
  /** Les libellés d'ambiance, gravés au pied du boîtier. Jamais un libellé d'action. */
  marque: string
  modele: string
}

export const HABILLAGES = {
  'chapitre-1': { classe: chapitre1.habillage ?? '', marque: 'Feuilleton', modele: 'chapitre 1' },
} satisfies Record<string, Habillage>

export type Chapitre = keyof typeof HABILLAGES

/**
 * Le chapitre dont la télécommande porte l'habillage. **Le seul endroit où il se choisit** : le jour où
 * le jeu avance, c'est ici que le chapitre se lit (de l'état du joueur, d'une date…).
 */
export function habillageActif(): Chapitre {
  return 'chapitre-1'
}
