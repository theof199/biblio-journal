import type { PlaceDeBobine } from '../../../voyage/sacoche/retrouvees'

/**
 * Les bobines retrouvées dans la sacoche des années 1900 : ses mots et son compte. **La maquette ne
 * dessine pas cette rubrique** (son écran 15 s'arrête aux objets trouvés ; elle ne dit des bobines
 * que le compteur de la carte, l. 3224, et le point de la sacoche, l. 3225) : elle est faite par
 * analogie avec la consigne (`consigne.ts`). Sans rendu ni lecture : le dessin est
 * `BobinesDeLaSacoche.tsx`, les places viennent du bloc (`voyage/sacoche/retrouvees.ts`).
 */
export const MOTS_DES_BOBINES = {
  /** La région du bloc se nomme « Bobines retrouvées » ; le compteur de la carte dit « Bobines retrouvées n/N ». */
  titre: 'Les bobines retrouvées',
  /** Le mot de la consigne. */
  aTrouver: 'à trouver',
  /** Le mot du courrier. */
  nouvelle: 'Nouvelle',
} as const

/** « 2 sur 6 » : les places retrouvées, sur toutes celles qu'on lui passe. Jamais six en dur. */
export const compteDesBobines = (places: readonly PlaceDeBobine[]): string => `${places.filter((p) => p.bobine !== null).length} sur ${places.length}`

/** « Années 1890 » : tout ce qu'une place dit du monde qui cache sa bobine, le titre de la page de sa décennie. */
export const decennieDite = (decennie: number): string => `Années ${decennie}`
