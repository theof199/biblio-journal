/** « Christopher Nolan, 2010 » — reprise de `subtitle()` (Android, `ui/Format.kt`). */
export function sousTitre(realisateur: string | null | undefined, annee: number | null | undefined): string {
  return [realisateur?.trim() || null, annee != null ? String(annee) : null].filter(Boolean).join(', ')
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long' })

/**
 * Une date seule (`AAAA-MM-JJ`, `entry.finished_at`) en date locale : découpée en chiffres plutôt
 * que passée à `new Date(iso)`, qui la lirait à minuit UTC — un jour différent selon le fuseau du lecteur.
 */
export function dateLocale(iso: string): Date {
  const [annee, mois, jour] = iso.split('-').map(Number)
  return new Date(annee!, mois! - 1, jour!)
}

/**
 * « 11 juillet 2026 », mais « 1er juillet 2026 » : reprise de `formatDate()` (Android,
 * `ui/Format.kt`), qui ordinalise le premier jour du mois, jamais les suivants.
 */
export function formatDateVisionnage(iso: string): string {
  const date = dateLocale(iso)
  const jourTexte = date.getDate() === 1 ? '1er' : String(date.getDate())
  return `${jourTexte} ${MOIS.format(date)} ${date.getFullYear()}`
}

const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short' })

/** « 28 SEPT », « 16 AOÛT » : le jour et le mois abrégé d'une date seule, sans point, pour le bord d'une pellicule. */
export function formatJourBref(iso: string): string {
  const date = dateLocale(iso)
  return `${date.getDate()} ${MOIS_COURT.format(date).replace('.', '').toUpperCase()}`
}

/**
 * Sans accents, en minuscules, sans espaces aux extrémités — reprise de `normaliser()` (Android,
 * `ui/Format.kt`) : « Miyazaki » et « miyazaki » se retrouvent, comme « Amélie » et « amelie ».
 */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
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

/** « 7.4 » en « 7,4 » : la virgule décimale du français, sans passer par l'`Intl` (« 8 » reste « 8 », jamais « 8,0 »). */
export const virgule = (nombre: number): string => String(nombre).replace('.', ',')

/** « 01/10/2026 » : une date seule (`AAAA-MM-JJ`) en jour, mois, année, comme on la tamponne sur un ticket. */
export function formatDateCourte(iso: string): string {
  const [annee, mois, jour] = iso.split('-')
  return `${jour}/${mois}/${annee}`
}

const MOIS_ET_ANNEE = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

/** « Octobre 2026 » : le mois d'une date seule (`AAAA-MM-JJ`), avec sa majuscule d'en-tête. */
export function moisEnLettres(iso: string): string {
  const texte = MOIS_ET_ANNEE.format(dateLocale(iso))
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/**
 * Le français prend une espace insécable avant « : », « ; », « ? » et « ! » : sans elle, un titre
 * comme « Batman : Le Défi » se coupe avant les deux-points et la ligne suivante commence par eux.
 */
export const espaceInsecable = (texte: string): string => texte.replace(/ (?=[:;?!])/g, '\u00a0')

/** « 2 h 49 », ou « 49 min » sous l'heure ; une heure pile se lit « 2 h 00 », pas « 2 h ». */
export function formatDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}
