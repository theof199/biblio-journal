import type { PlexFilm } from '../api/plex'
import type { Realisateur, FilmRealisateur } from '../api/realisateurs'
import type { Saga, FilmSaga } from '../api/sagas'
import type { EntiteEnCours } from '../suivis/prochain'
import { candidatDepuisFilmSuivi, candidatDepuisPlex } from '../formulaire/candidat'
import type { CandidatFilm } from '../formulaire/candidat'

/**
 * Une carte du carrousel « Ensuite » — laquelle des trois sources (Plex, réalisateur en cours,
 * saga en cours), jamais mêlées entre elles. Reprise de `CarteEnsuite` (Android, `HomeEtats.kt`).
 */
export type CarteEnsuite =
  | { source: 'plex'; film: PlexFilm }
  | { source: 'realisateur'; encours: EntiteEnCours<Realisateur, FilmRealisateur> }
  | { source: 'saga'; encours: EntiteEnCours<Saga, FilmSaga> }

/**
 * Les cartes du carrousel « Ensuite », dans l'ordre Plex puis réalisateur puis saga — reprise de
 * `cartesEnsuite` (Android, `HomeEtats.kt`). Une source absente, ou sans rien à proposer, n'ajoute
 * simplement aucune carte : jamais affichée vide.
 */
export function cartesEnsuite(
  plex: PlexFilm | null | undefined,
  realisateur: EntiteEnCours<Realisateur, FilmRealisateur> | null | undefined,
  saga: EntiteEnCours<Saga, FilmSaga> | null | undefined,
): CarteEnsuite[] {
  const cartes: CarteEnsuite[] = []
  if (plex) cartes.push({ source: 'plex', film: plex })
  if (realisateur) cartes.push({ source: 'realisateur', encours: realisateur })
  if (saga) cartes.push({ source: 'saga', encours: saga })
  return cartes
}

/** « Saga Alien », jamais « Saga Alien (Saga) » ni « Saga Saga Alien » : le préfixe ne s'ajoute pas quand le nom le porte déjà. */
function libelleDeSaga(nom: string): string {
  return /saga/i.test(nom) ? nom : `Saga ${nom}`
}

/**
 * Ce que chaque carte propose d'ouvrir dans le formulaire, et sa pastille : « Sur Plex », le nom du
 * réalisateur ou « Saga {nom} ». Seul un réalisateur donne son nom au candidat (une saga n'en a
 * pas). Un seul endroit pour le fronton et l'éventail, qui doivent mener au même film.
 */
export function candidatEnsuite(carte: CarteEnsuite): { candidat: CandidatFilm; libelle: string } {
  if (carte.source === 'plex') return { candidat: candidatDepuisPlex(carte.film), libelle: 'Sur Plex' }
  const nom = carte.encours.entite.name
  if (carte.source === 'realisateur') {
    return { candidat: candidatDepuisFilmSuivi(carte.encours.prochain, nom), libelle: nom }
  }
  return { candidat: candidatDepuisFilmSuivi(carte.encours.prochain, null), libelle: libelleDeSaga(nom) }
}

/** « Buster Keaton · 1926 », « 1933 » sans réalisateur, chaîne vide sans rien : la ligne sous un titre, au séparateur du panneau (`sousTitre` met une virgule). */
export function realisateurEtAnnee(realisateur: string | null | undefined, annee: number | null | undefined): string {
  return [realisateur?.trim() || null, annee == null ? null : String(annee)].filter(Boolean).join(' · ')
}

export const metaCandidat = (candidat: CandidatFilm): string => realisateurEtAnnee(candidat.director, candidat.year)
