/**
 * Ce qu'il reste à voir d'un réalisateur ou d'une saga suivis — fonctions pures, testées sans
 * réseau (reprise de `SuivisViewModel.kt`, appli Android). `FilmRealisateur` et `FilmSaga`
 * (`api/realisateurs.ts`, `api/sagas.ts`) partagent tous deux `tmdb_id`, `vu` et `introuvable` :
 * une seule implémentation sert donc les deux sources.
 */

/** Un film suivi, réduit à ce que ces fonctions lisent. */
export interface FilmSuivi {
  tmdb_id: number
  vu: { entry_id: string; rating: number | null; finished_at: string } | null
  introuvable: boolean
}

/** Combien de ces films j'ai déjà journalisés. */
export function filmsVus(films: readonly FilmSuivi[]): number {
  return films.filter((film) => film.vu != null).length
}

/**
 * Le premier film ni vu ni marqué introuvable, dans l'ordre où le back les rend (de la plus
 * ancienne sortie à la plus récente). `undefined` quand il n'y a plus rien à voir.
 */
export function prochainAVoir<F extends FilmSuivi>(films: readonly F[]): F | undefined {
  return films.find((film) => film.vu == null && !film.introuvable)
}

/** Les films d'une filmographie de réalisateur, séries écartées : le journal ne connaît que des films. */
export function filmsSansSeries<F extends { type: 'movie' | 'tv' }>(films: readonly F[]): F[] {
  return films.filter((film) => film.type === 'movie')
}

export interface EntiteEnCours<E, F> {
  entite: E
  prochain: F
}

/**
 * L'entité (réalisateur ou saga) « en cours » pour le carrousel « Ensuite » de l'accueil : celle
 * qui a le plus de films vus, parmi celles qui ont encore au moins un film à voir. `null` si aucune
 * n'est dans ce cas — la ligne « Ensuite » correspondante est alors absente, plutôt qu'affichée
 * vide. Une entité dont la filmographie n'est pas encore connue (absente de `filmographies`) ne
 * participe pas. À égalité de films vus, la première rencontrée l'emporte : `GET /me/realisateurs`
 * et `GET /me/sagas` rendent leurs listes du plus récemment ajouté au plus ancien, donc c'est le
 * suivi le plus récent qui gagne.
 */
export function entiteEnCours<E extends { tmdb_id: number }, F extends FilmSuivi>(
  entites: readonly E[],
  filmographies: ReadonlyMap<number, readonly F[]>,
): EntiteEnCours<E, F> | null {
  let gagnant: EntiteEnCours<E, F> | null = null
  let meilleur = -1
  for (const entite of entites) {
    const films = filmographies.get(entite.tmdb_id)
    if (!films) continue
    const prochain = prochainAVoir(films)
    if (!prochain) continue
    const vus = filmsVus(films)
    if (vus > meilleur) {
      meilleur = vus
      gagnant = { entite, prochain }
    }
  }
  return gagnant
}
