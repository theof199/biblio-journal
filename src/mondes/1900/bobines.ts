import type { BobinePerdue } from '../types'

/**
 * Les bobines perdues de la décennie (fiche de données, « Les bobines » ; maquette : `BOBINES`,
 * l. 2717-2721, le `qui` de la troisième corrigé par la fiche) : trois boîtes de film oubliées en
 * gare. Le rang est celui que le monde passe à `VueMonde.bobine` ; la clé, ce que l'appareil retient.
 */
export const BOBINES: readonly BobinePerdue[] = [
  { cle: 'soldiers', titre: 'Soldiers of the Cross', qui: 'Joseph Perry et Herbert Booth, 1900' },
  { cle: 'hamlet', titre: 'Hamlet', qui: 'Georges Méliès, 1907' },
  { cle: 'fairylogue', titre: 'The Fairylogue and Radio-Plays', qui: 'Francis Boggs et Otis Turner, 1908' },
]

/**
 * Où chaque bobine se cache, au rang de `BOBINES` : l'année de sa gare, puis sa place en pixels du
 * milieu de la gare et en pourcentage de la hauteur de l'écran depuis le bas. *Hamlet* est en gare
 * de 1901 (décision 3 du plan 3b).
 */
export const CACHETTES: ReadonlyArray<{ an: number; dx: number; bas: number }> = [
  { an: 1900, dx: -122, bas: 33 },
  { an: 1901, dx: 24, bas: 27 },
  { an: 1904, dx: 112, bas: 41 },
]
