import type { JournalItem, JournalPage } from '../api/journal'
import type { Bobine, EtatFilm, FichePrete, FilmDeSalle, Salle } from '../api/voyage'
import type { CandidatFilm } from '../formulaire/candidat'

/**
 * La fiche d'un film du Voyage et son billet (plan 2b), sans rendu. Portée de `FicheVoyageEtats.kt`
 * (`biblio-android`, `ui/frise/`), sans `lienPlexVoyage` : sur le web, `plex_url` s'ouvre tel quel.
 */

/** Le film d'une salle, retrouvé par son identifiant de ligne (`voyage_films`) dans la fiche de son année. */
export function filmDeLaFiche(fiche: FichePrete, filmId: string): { salle: Salle; film: FilmDeSalle } | null {
  for (const salle of fiche.salles) {
    const film = salle.films.find((f) => f.id === filmId)
    if (film) return { salle, film }
  }
  return null
}

export type BoutonDuFilm = 'corriger' | 'plex' | 'vu' | 'demander' | 'introuvable' | 'remettre' | 'podium'

/**
 * Les boutons du guichet (portée de `boutonsFicheVoyage`) : « Voir sur le Plex » ne dépend que du
 * lien ; « Je l'ai vu » tant que le film n'est pas vu, « Corriger » à sa place une fois vu **et**
 * son entrée retrouvée ; « Demander » sur `a_demander` seulement ; « Introuvable » et son inverse,
 * exclusifs, jamais sur un film vu ; « Mettre sur le podium » sur un film vu.
 */
export function boutonsDuFilm(etat: EtatFilm, plexUrl: string | null, entreeConnue: boolean): BoutonDuFilm[] {
  const b: BoutonDuFilm[] = []
  if (etat === 'vu' && entreeConnue) b.push('corriger')
  if (plexUrl) b.push('plex')
  if (etat !== 'vu') b.push('vu')
  if (etat === 'a_demander') b.push('demander')
  if (etat === 'introuvable') b.push('remettre')
  else if (etat !== 'vu') b.push('introuvable')
  if (etat === 'vu') b.push('podium')
  return b
}

/**
 * Mon dernier visionnage d'un film TMDB, dans les pages déjà chargées de **mon** journal. Jamais par
 * le seul `external_id` : un identifiant n'est unique qu'avec sa source (`itemAuJournal`,
 * `api/journal.ts`), et TMDB numérote à part films et séries — une série au même numéro n'est pas
 * ce film, et son entrée ne se corrige pas depuis le billet. Le journal arrive du plus récent au
 * plus ancien : la première trouvée est la dernière vue. `undefined` si elle n'est pas dans ces pages.
 */
export function derniereEntree(pages: readonly JournalPage[], tmdbId: number): JournalItem | undefined {
  const id = String(tmdbId)
  for (const page of pages) {
    const item = page.items.find((i) => i.media.source === 'tmdb' && i.media.type === 'movie' && i.media.external_id === id)
    if (item) return item
  }
  return undefined
}

/**
 * Une durée de programme ou de bobine, lisible (portée de `formatDuree`, `ui/fiche/FicheEtats.kt`,
 * Android) : « 12 min » sous l'heure, « 1 h 03 » au-delà, « 2 h 00 » pile.
 */
export function dureeLisible(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** Une bobine du programme d'un film, par son identifiant TMDB. */
export const bobineDuFilm = (film: FilmDeSalle, tmdbId: number): Bobine | undefined =>
  film.programme?.bobines.find((b) => b.tmdb_id === tmdbId)

/**
 * Le film à noter, pour `creerVisionnage` : le film de la salle, ou l'une de ses bobines — une
 * bobine n'a ni année ni réalisateur dans le contrat, elle prend l'année du programme.
 */
export function candidatDuBillet(film: FilmDeSalle, bobine?: Bobine): CandidatFilm {
  if (bobine) {
    return { source: 'tmdb', external_id: String(bobine.tmdb_id), title: bobine.title, year: film.year, cover_url: bobine.cover_url, director: null }
  }
  return { source: 'tmdb', external_id: String(film.tmdb_id), title: film.title, year: film.year, cover_url: film.cover_url, director: film.realisateur || null }
}
