import type { MovieSearchResult } from '../api/recherche'
import type { PlexFilm } from '../api/plex'
import type { FichePrete } from '../api/voyage'
import type { SortieEnCoursFilm } from '../api/sorties'

/** Un film pas encore au journal, prêt pour le formulaire de création — quelle que soit sa provenance (recherche, Plex, Voyage). */
export interface CandidatFilm {
  source: 'tmdb'
  external_id: string
  title: string
  year: number | null
  cover_url: string | null
  director: string | null
  /**
   * Une date de visionnage déjà connue : le formulaire la propose au lieu d'aujourd'hui. Aucune
   * provenance ne la pose depuis que le rapport d'import enregistre lui-même le candidat choisi
   * (correctif du 30 septembre 2026) ; le formulaire sait toujours la lire.
   */
  finished_at?: string
  /** Une note déjà connue, de 1 à 10 — même remarque. */
  rating?: number | null
}

export const candidatDepuisResultat = (resultat: MovieSearchResult): CandidatFilm => ({
  source: 'tmdb',
  external_id: resultat.external_id,
  title: resultat.title,
  year: resultat.year,
  cover_url: resultat.cover_url,
  director: resultat.metadata.director,
})

export const candidatDepuisPlex = (film: PlexFilm): CandidatFilm => ({
  source: 'tmdb',
  external_id: String(film.tmdb_id),
  title: film.title,
  year: film.year,
  cover_url: film.cover_url,
  director: null,
})

/** Le film d'une salle, tel que rendu par `GET /me/voyage/annees/{annee}` (fiche « prête »). */
export type AnneeVoyageFilm = FichePrete['salles'][number]['films'][number]

/** Un film d'une salle du Voyage — `realisateur` y est toujours une chaîne, vide plutôt que nulle. */
export const candidatDepuisVoyageFilm = (film: AnneeVoyageFilm): CandidatFilm => ({
  source: 'tmdb',
  external_id: String(film.tmdb_id),
  title: film.title,
  year: film.year,
  cover_url: film.cover_url,
  director: film.realisateur || null,
})

/**
 * Une tuile « à l'affiche dans mes cinémas » (Au ciné, brief du 15 septembre 2026) n'est ouvrable
 * que si TMDB a été retrouvé côté back — reprise de `SortieCinemaFilm.estOuvrable()` (Android).
 * Sans lien vers sa fiche (`au-cine/films/:tmdbId`) sinon : elle n'a pas d'identifiant à y mettre.
 */
export function sortieEnCoursOuvrable(film: SortieEnCoursFilm): film is SortieEnCoursFilm & { tmdb_id: number } {
  return film.tmdb_id != null
}

/**
 * Un film d'une filmographie suivie (réalisateur ou saga), ou de la fiche d'un film — le
 * réalisateur n'est connu que lorsqu'on l'a déjà résolu ailleurs (la page d'où le film vient, ou
 * `GET /reference/films/{tmdbId}/realisateurs`) : une saga n'en a pas, contrairement à un
 * réalisateur.
 */
export const candidatDepuisFilmSuivi = (
  film: { tmdb_id: number; title: string; year: number | null; cover_url: string | null },
  director: string | null = null,
): CandidatFilm => ({
  source: 'tmdb',
  external_id: String(film.tmdb_id),
  title: film.title,
  year: film.year,
  cover_url: film.cover_url,
  director,
})
