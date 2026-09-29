import type { JournalItem } from '../api/journal'
import type { CorpsPodium, Marche, Podium, Salle } from '../api/voyage'

/**
 * Le podium d'une année (plan 2b), sans rendu. Porté de `PodiumEtats.kt` (`biblio-android`,
 * `ui/frise/`), avec un écart : un film vu deux fois n'est qu'un candidat.
 */

export type Candidat =
  | { type: 'film'; tmdbId: number; titre: string; affiche: string | null; note: number | null }
  | { type: 'programme'; programmeId: string; titre: string; affiche: string | null }

/**
 * Les candidats à une marche : mes films de cette année-là, depuis le journal — jumeau du contrôle
 * de `PUT …/podium/{place}` (un film TMDB de type `movie`, dans mon journal, sorti cette année :
 * `400` sinon) —, puis les programmes entièrement vus de mes salles. Le journal arrive du plus
 * récent au plus ancien : la note gardée est celle du dernier visionnage.
 */
export function candidats(items: readonly JournalItem[], annee: number, salles: readonly Salle[]): Candidat[] {
  const vus = new Set<string>()
  const films: Candidat[] = []
  for (const item of items) {
    const m = item.media
    if (m.source !== 'tmdb' || m.type !== 'movie' || m.year !== annee || vus.has(m.external_id)) continue
    const tmdbId = Number(m.external_id)
    if (!Number.isInteger(tmdbId)) continue
    vus.add(m.external_id)
    films.push({ type: 'film', tmdbId, titre: m.title, affiche: m.cover_url, note: item.entry.rating })
  }
  const programmes: Candidat[] = salles
    .flatMap((s) => s.films)
    .filter((f) => f.programme !== null && f.etat === 'vu')
    .map((f) => ({ type: 'programme', programmeId: f.id, titre: f.title, affiche: f.cover_url }))
  return [...films, ...programmes]
}

/** Le corps de `PUT …/podium/{place}` : `tmdb_id` ou `programme_id`, jamais les deux. */
export const corpsPodium = (c: Candidat): CorpsPodium =>
  c.type === 'film' ? { tmdb_id: c.tmdbId } : { programme_id: c.programmeId }

const occupe = (m: Marche | null, c: Candidat): boolean =>
  !!m && (c.type === 'film' ? m.tmdb_id === c.tmdbId : m.programme_id === c.programmeId)

/** La feuille d'une marche : « Retirer » en tête seulement si elle est occupée, puis chaque candidat, l'occupant coché. */
export type LigneDeMarche = { type: 'retirer' } | { type: 'candidat'; candidat: Candidat; occupant: boolean }

export function lignesDeLaMarche(marche: Marche | null, liste: readonly Candidat[]): LigneDeMarche[] {
  const lignes: LigneDeMarche[] = marche ? [{ type: 'retirer' }] : []
  for (const c of liste) lignes.push({ type: 'candidat', candidat: c, occupant: occupe(marche, c) })
  return lignes
}

/** « Mettre sur le podium », depuis la fiche d'un film : une ligne par marche, celle qui le porte déjà cochée. */
export interface ChoixDeMarche {
  place: number
  occupant: string | null
  cochee: boolean
}

export function choixDesMarches(podium: Podium, cible: Candidat): ChoixDeMarche[] {
  return [1, 2, 3].map((place) => {
    const m = podium[place - 1] ?? null
    return { place, occupant: m?.title ?? null, cochee: occupe(m, cible) }
  })
}
