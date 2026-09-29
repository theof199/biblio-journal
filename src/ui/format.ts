/** « Christopher Nolan, 2010 » — reprise de `subtitle()` (Android, `ui/Format.kt`). */
export function sousTitre(realisateur: string | null | undefined, annee: number | null | undefined): string {
  return [realisateur?.trim() || null, annee != null ? String(annee) : null].filter(Boolean).join(', ')
}
