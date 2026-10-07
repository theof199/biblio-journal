/**
 * Les images du monde 1900 : les vingt-deux fichiers de `assets/`, chacun avec son entrée au
 * `CREDITS.md` du dossier (tâche 9). Le dessin prend une image si elle est là, et s'en passe sinon.
 */
const fichiers = import.meta.glob('./assets/*.{webp,png,webm}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export const imageDu1900 = (nom: string): string | null => fichiers[`./assets/${nom}.webp`] ?? null

/**
 * La largeur et la hauteur des photographies que le dessin pose à leurs proportions (fiche de
 * données, « Les images » ; maquette : `window.TAILLES`, l. 2656).
 */
export const TAILLES: Readonly<Record<string, readonly [number, number]>> = {
  fond: [941, 419],
  loin1: [883, 469],
  loin2: [845, 488],
  loin3: [893, 493],
  voisin: [900, 270],
  g1900: [760, 716],
  g1901: [760, 397],
  g1902: [760, 433],
  g1903: [760, 451],
  g1904: [760, 473],
  g1905: [640, 449],
  g1906: [640, 419],
  g1907: [560, 467],
  g1908: [640, 340],
  g1909: [640, 328],
}
