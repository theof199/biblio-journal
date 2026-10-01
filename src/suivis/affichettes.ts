import type { FilmRealisateur, Realisateur } from '../api/realisateurs'
import type { FilmSaga, Saga } from '../api/sagas'
import { casesBande, derniereActivite, type EtatBande, type EtatFilmographie } from './liste'
import { prochainAVoir, type FilmSuivi } from './prochain'

/**
 * Les règles pures de ce que les Suivis dessinent sur le mur : la rangée « Ensuite », les trous
 * d'une affichette, le nom imprimé en deux corps. Testées sans réseau ni rendu.
 */

/** Au-delà de ces lettres, le dernier mot d'un nom passe au petit corps : « VILLENEUVE » tient à peine sur une affichette. */
const LONGUEUR_MOT_LONG = 9
/** Le nom d'une saga, imprimé en grand sur toute la largeur d'une planche, passe au petit corps plus tard. */
const LONGUEUR_SAGA_LONGUE = 16

/**
 * Un nom coupé comme sur une affiche : les prénoms en petit, le dernier mot en grand (`long` :
 * ce mot est long, il s'imprime d'un corps plus petit). Un nom d'un seul mot n'a pas de prénoms.
 */
export function scinderNom(nom: string): { prenoms: string; dernier: string; long: boolean } {
  const mots = nom.trim().split(/\s+/)
  const dernier = mots.pop() ?? ''
  return { prenoms: mots.join(' '), dernier, long: dernier.length > LONGUEUR_MOT_LONG }
}

/** Le nom d'une saga est-il trop long pour le grand corps d'une planche ? */
export const sagaALongNom = (nom: string): boolean => nom.length > LONGUEUR_SAGA_LONGUE

/**
 * Un trou par film de la rétrospective, dans l'ordre du back : vu (poinçonné), le prochain (cerclé
 * de rouge), introuvable (en pointillés), les autres vides. Ceux de `casesBande` sans en masquer
 * aucun : l'affichette montre toute la filmographie, l'interrupteur « Masquer les introuvables »
 * n'est que celui d'une saga.
 */
export const trousDeLaRetrospective = (films: readonly FilmSuivi[]): EtatBande[] =>
  casesBande(films, false).map(({ etat }) => etat)

/** Le prochain film d'un réalisateur (`realisateurs`) ou d'une saga (`sagas`), avec celui qui le porte. */
export type FilmEnsuite =
  | { source: 'realisateurs'; entite: Realisateur; film: FilmRealisateur }
  | { source: 'sagas'; entite: Saga; film: FilmSaga }

/**
 * Le prochain film à voir de chaque réalisateur et de chaque saga en cours (filmographie arrivée, un
 * film encore à voir : un suivi bouclé n'en a plus), les deux ensemble, du suivi le plus récemment
 * actif au plus ancien : la même activité que `trierParActivite`. Les ex æquo gardent l'ordre
 * d'entrée : réalisateurs d'abord, puis sagas, chacun dans l'ordre du back.
 */
export function filmsEnsuite(
  realisateurs: readonly Realisateur[],
  filmsRealisateurs: ReadonlyMap<number, EtatFilmographie<FilmRealisateur>>,
  sagas: readonly Saga[],
  filmsSagas: ReadonlyMap<number, EtatFilmographie<FilmSaga>>,
): FilmEnsuite[] {
  const candidats = [
    ...avecProchain(realisateurs, filmsRealisateurs).map(({ entite, film, jour }) => ({ jour, ensuite: { source: 'realisateurs', entite, film } as const })),
    ...avecProchain(sagas, filmsSagas).map(({ entite, film, jour }) => ({ jour, ensuite: { source: 'sagas', entite, film } as const })),
  ]
  return candidats.sort((a, b) => (a.jour < b.jour ? 1 : a.jour > b.jour ? -1 : 0)).map(({ ensuite }) => ensuite)
}

function avecProchain<E extends { tmdb_id: number; ajoute_le: string }, F extends FilmSuivi>(
  entites: readonly E[],
  filmographies: ReadonlyMap<number, EtatFilmographie<F>>,
): { entite: E; film: F; jour: string }[] {
  // Un suivi bouclé n'a plus de film à voir : il n'a pas besoin d'être écarté à part.
  return entites.flatMap((entite) => {
    const etat = filmographies.get(entite.tmdb_id)
    if (etat?.statut !== 'pret') return []
    const film = prochainAVoir(etat.films)
    return film ? [{ entite, film, jour: derniereActivite(entite.ajoute_le, etat.films) }] : []
  })
}
