/**
 * Les deux espaces du Feuilleton : le Travail (le Studio, `src/studio/`) et la Maison (`src/maison/`).
 * Chacun a sa page, dans son morceau, sous `/feuilleton/…` ; la mise en page commune
 * (`feuilleton/Feuilleton.tsx`) offre de passer de l'un à l'autre.
 */
export type Espace = 'studio' | 'maison'

export const ESPACES: Record<Espace, { libelle: string; chemin: string; passer: string }> = {
  studio: { libelle: 'Travail', chemin: '/feuilleton/studio', passer: 'Passer au Travail' },
  maison: { libelle: 'Maison', chemin: '/feuilleton/maison', passer: 'Passer à la Maison' },
}

export const autreEspace = (espace: Espace): Espace => (espace === 'studio' ? 'maison' : 'studio')

/**
 * L'espace d'une adresse, ou rien : `/feuilleton` seul n'en est pas un. Une barre oblique finale est
 * tolérée, comme le routeur la tolère : `/feuilleton/studio/` est le Studio, pas l'espace de l'heure.
 */
export function espaceDuChemin(pathname: string): Espace | null {
  const chemin = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const trouve = (Object.keys(ESPACES) as Espace[]).find((espace) => ESPACES[espace].chemin === chemin)
  return trouve ?? null
}

/** Les heures de travail, à Paris : de 6 h 00 incluse à 18 h 00 exclue. */
const DEBUT_DU_TRAVAIL = 6
const FIN_DU_TRAVAIL = 18
const JOURS_DE_REPOS = new Set(['Sat', 'Sun'])

/** Le jour et l'heure de Paris d'un instant, quel que soit le fuseau de l'appareil. */
const A_PARIS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', hourCycle: 'h23' })

/**
 * L'espace que `/feuilleton` ouvre à cet instant (décision D7 du 13 octobre 2026) : du lundi au
 * vendredi, de 6 h à 18 h de Paris, le Travail ; les soirs, les nuits, le samedi et le dimanche, la
 * Maison. **Rien n'est mémorisé** : le bouton de la mise en page ne vaut que pour la visite en cours,
 * et revenir à `/feuilleton` relit l'heure. Pure : l'instant lui est donné.
 */
export function espaceDeLHeure(instant: Date): Espace {
  const parties = A_PARIS.formatToParts(instant)
  const jour = parties.find((partie) => partie.type === 'weekday')!.value
  const heure = Number(parties.find((partie) => partie.type === 'hour')!.value)
  if (JOURS_DE_REPOS.has(jour)) return 'maison'
  return heure >= DEBUT_DU_TRAVAIL && heure < FIN_DU_TRAVAIL ? 'studio' : 'maison'
}
