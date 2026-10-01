import type { FilmRealisateur } from '../api/realisateurs'
import type { FilmSaga } from '../api/sagas'

/** Où mène un film de suivi : l'adresse, et l'état de navigation que la fiche attend (`FicheFilm`), s'il en faut un. */
export interface DestinationFilm {
  to: string
  state?: { film: FilmRealisateur | FilmSaga; realisateur: { tmdb_id: number; name: string } | null }
}

/**
 * Où mène un film de la filmographie d'un réalisateur : sa fiche du Voyage s'il figure dans une
 * salle (`voyage`, la plus ancienne année ; décision D5 du plan 2b), sinon sa fiche des Suivis, avec
 * le film et le réalisateur (son identifiant et son nom, rien d'autre) en état de navigation. Celle
 * de la page du réalisateur et de la rangée « Ensuite » des Suivis : un film mène au même endroit
 * d'où qu'on le touche.
 */
export function destinationFilmRealisateur(film: FilmRealisateur, realisateur: { tmdb_id: number; name: string }): DestinationFilm {
  if (film.voyage) return { to: `/voyage/${film.voyage.annee}/films/${film.voyage.film_id}` }
  return { to: `/suivis/films/${film.tmdb_id}`, state: { film, realisateur: { tmdb_id: realisateur.tmdb_id, name: realisateur.name } } }
}

/** Où mène un film d'une saga : toujours sa fiche des Suivis, sans réalisateur connu (la fiche le demandera). */
export function destinationFilmSaga(film: FilmSaga): DestinationFilm {
  return { to: `/suivis/films/${film.tmdb_id}`, state: { film, realisateur: null } }
}
