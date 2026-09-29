import type { MovieSearchResult } from '../api/recherche'
import type { PlexFilm } from '../api/plex'
import type { FichePrete } from '../api/voyage'

/** Un film pas encore au journal, prêt pour le formulaire de création — quelle que soit sa provenance (recherche, Plex, Voyage). */
export interface CandidatFilm {
  source: 'tmdb'
  external_id: string
  title: string
  year: number | null
  cover_url: string | null
  director: string | null
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
