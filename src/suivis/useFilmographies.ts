import { useEffect } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { lirePageRealisateur, type FilmRealisateur, type RealisateurPage } from '../api/realisateurs'
import { lireFilmsSaga, type FilmSaga, type FilmsSaga } from '../api/sagas'
import { filmsSansSeries } from './prochain'
import type { EtatFilmographie } from './liste'

interface Source<D, F> {
  cle: (tmdbId: number) => readonly unknown[]
  lire: (tmdbId: number, signal?: AbortSignal) => Promise<D>
  extraire: (donnee: D) => F[]
}

/** Les films d'un réalisateur : sa page (`cles.pageRealisateur`), séries écartées — le journal ne connaît que des films. */
const REALISATEURS: Source<RealisateurPage, FilmRealisateur> = {
  cle: cles.pageRealisateur,
  lire: lirePageRealisateur,
  extraire: (page) => filmsSansSeries(page.films),
}
/** Les films d'une saga (`cles.filmsSaga`) : ceux de la collection, plus ceux ajoutés à la main. */
const SAGAS: Source<FilmsSaga, FilmSaga> = {
  cle: cles.filmsSaga,
  lire: lireFilmsSaga,
  extraire: (donnee) => donnee.films,
}

/**
 * Les filmographies de ces entités, **l'une après l'autre** (reprise de `SuivisViewModel.refresh`,
 * Android, brief du 15 septembre 2026) : chacune est publiée dès son arrivée, plutôt que toutes
 * d'un coup — le back appelle TMDB derrière, et sa file sortante a déjà cédé à une rafale. Une
 * panne ne prive ni la liste des autres ni l'écran : l'entité passe à « indisponible » et la
 * suivante continue de se charger.
 *
 * Les requêtes portent les clés de `PageRealisateur` et `PageSaga` : ouvrir l'une de ces pages
 * après ne rappelle pas le back tant que les données sont fraîches. `charger: false` observe le
 * cache sans jamais rien demander (le sceau d'Au ciné : « aucun appel réseau nouveau »).
 */
function useFilmographies<D, F, E extends { tmdb_id: number }>(
  source: Source<D, F>,
  entites: readonly E[] | undefined,
  charger: boolean,
): Map<number, EtatFilmographie<F>> {
  const client = useQueryClient()
  const liste = entites ?? []
  const resultats = useQueries({
    queries: liste.map((entite) => ({
      queryKey: source.cle(entite.tmdb_id),
      queryFn: ({ signal }: { signal: AbortSignal }) => source.lire(entite.tmdb_id, signal),
      select: source.extraire,
      enabled: false,
    })),
  })

  const ids = liste.map((entite) => entite.tmdb_id).join(',')
  useEffect(() => {
    if (!charger || ids === '') return
    let annule = false
    void (async () => {
      for (const id of ids.split(',').map(Number)) {
        if (annule) return
        try {
          await client.fetchQuery({
            queryKey: source.cle(id),
            queryFn: ({ signal }) => source.lire(id, signal),
          })
        } catch {
          // L'échec est dans le cache : l'entité se lit « indisponible », la suivante se charge.
        }
      }
    })()
    return () => {
      annule = true
    }
  }, [client, source, ids, charger])

  const etats = new Map<number, EtatFilmographie<F>>()
  liste.forEach((entite, index) => {
    const resultat = resultats[index]
    etats.set(
      entite.tmdb_id,
      resultat?.data !== undefined
        ? { statut: 'pret', films: resultat.data }
        : resultat?.isError
          ? { statut: 'indisponible' }
          : { statut: 'attente' },
    )
  })
  return etats
}

export const useFilmographiesRealisateurs = <E extends { tmdb_id: number }>(entites: readonly E[] | undefined, charger = true) =>
  useFilmographies(REALISATEURS, entites, charger)

export const useFilmographiesSagas = <E extends { tmdb_id: number }>(entites: readonly E[] | undefined, charger = true) =>
  useFilmographies(SAGAS, entites, charger)
