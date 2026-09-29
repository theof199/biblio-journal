/**
 * Les images communes à tous les mondes (la roulotte, qui se gare dans n'importe lequel). Un
 * fichier déposé dans `assets/`, avec son entrée dans `assets/CREDITS.md`, suffit : le dessin le
 * prend s'il est là, et garde celui de la maquette sinon.
 */
const fichiers = import.meta.glob('./assets/*.{webp,png,webm}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export const imageCommune = (nom: string): string | null => fichiers[`./assets/${nom}`] ?? null
