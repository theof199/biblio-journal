import type { PlexFilm } from '../api/plex'
import type { Realisateur, FilmRealisateur } from '../api/realisateurs'
import type { Saga, FilmSaga } from '../api/sagas'
import type { EntiteEnCours } from '../suivis/prochain'

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
