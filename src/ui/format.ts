/** « Christopher Nolan, 2010 » — reprise de `subtitle()` (Android, `ui/Format.kt`). */
export function sousTitre(realisateur: string | null | undefined, annee: number | null | undefined): string {
  return [realisateur?.trim() || null, annee != null ? String(annee) : null].filter(Boolean).join(', ')
}

/**
 * « 2026-09-30 » : le jour du calendrier du téléphone, pas celui de Greenwich. `toISOString()`
 * rendrait la veille entre minuit et deux heures à Paris — le visionnage d'hier soir, noté après
 * minuit, se daterait de la veille, et `max` interdirait d'y mettre le bon jour.
 */
export function jourLocal(date: Date = new Date()): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mois}-${jour}`
}
