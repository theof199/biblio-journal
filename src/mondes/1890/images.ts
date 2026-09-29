/**
 * Les images du monde 1890 (consigne du propriétaire du 29 septembre 2026 : « ne pas tout faire à
 * la main »). Un fichier déposé dans `assets/`, avec son entrée dans `assets/CREDITS.md`, suffit :
 * le dessin le prend s'il est là, et garde celui de la maquette sinon.
 */
const fichiers = import.meta.glob('./assets/*.{webp,png,webm}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export const imageDu1890 = (nom: string): string | null => fichiers[`./assets/${nom}`] ?? null
