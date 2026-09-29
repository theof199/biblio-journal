import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { lireFilmsSaga, lireSagas, neplusSuivreSaga } from '../api/sagas'
import { filmsVus } from '../suivis/prochain'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import Panne from '../ui/Panne'
import styles from './PageSaga.module.css'

/**
 * La page d'une saga (reprise de `FicheSuiviScreen.kt`, réduite aux sagas depuis que le réalisateur
 * a la sienne) : ses films, vus et à voir, et « Ne plus suivre ». Le nom et l'affiche viennent de
 * `GET /me/sagas` (`cles.sagas`, déjà en cache depuis l'onglet Suivis qui y mène toujours) plutôt
 * que de l'état de navigation : la page reste correcte sur un accès direct ou un rechargement, et
 * `GET /me/sagas/{tmdbId}/films` n'a rien à en dire — il ne rend que `films`.
 */
export default function PageSaga() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const id = Number(tmdbId)
  const client = useQueryClient()
  const naviguer = useNavigate()

  const sagas = useQuery({ queryKey: cles.sagas, queryFn: ({ signal }) => lireSagas(signal) })
  const films = useQuery({
    queryKey: cles.filmsSaga(id),
    queryFn: ({ signal }) => lireFilmsSaga(id, signal),
  })

  const neplusSuivre = useMutation({
    mutationFn: () => neplusSuivreSaga(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cles.sagas })
      naviguer('/suivis', { replace: true })
    },
  })

  if (sagas.isPending || films.isPending) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <p role="status">Chargement…</p>
      </div>
    )
  }
  if (sagas.error) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <Panne erreur={sagas.error} onReessayer={() => void sagas.refetch()} />
      </div>
    )
  }

  const saga = sagas.data.find((s) => s.tmdb_id === id)

  if (!saga) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <p>Tu ne suis plus cette saga.</p>
        <Link to="/suivis">Retour aux Suivis</Link>
      </div>
    )
  }
  if (films.error) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <Panne erreur={films.error} onReessayer={() => void films.refetch()} />
      </div>
    )
  }

  const lesFilms = films.data.films

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers="/suivis" />
      </div>

      <div className={styles.fiche}>
        <Affiche src={saga.cover_url} titre={saga.name} taille="ligne" className={styles.photo} />
        <div className={styles.infos}>
          <h1 className={styles.nom}>{saga.name}</h1>
          <p className={styles.compte}>
            {filmsVus(lesFilms)} vus sur {lesFilms.length}
          </p>
        </div>
      </div>

      <button
        type="button"
        className={styles.boutonSuivre}
        onClick={() => neplusSuivre.mutate()}
        disabled={neplusSuivre.isPending}
      >
        Ne plus suivre
      </button>
      {neplusSuivre.error ? (
        <p role="alert">
          {neplusSuivre.error instanceof Error ? neplusSuivre.error.message : String(neplusSuivre.error)}
        </p>
      ) : null}

      {lesFilms.length === 0 ? (
        <p className={styles.vide}>Aucun film connu pour cette saga.</p>
      ) : (
        <ul className={styles.liste}>
          {lesFilms.map((film) => (
            <li key={film.tmdb_id}>
              <Link
                to={`/suivis/films/${film.tmdb_id}`}
                state={{ film, realisateur: null }}
                className={styles.film}
              >
                <Affiche src={film.cover_url} titre={film.title} taille="ligne" />
                <div className={styles.infosFilm}>
                  <p className={styles.titreFilm}>
                    {film.title}
                    {film.year ? ` (${film.year})` : ''}
                  </p>
                  <p className={styles.etatFilm}>
                    {film.vu
                      ? `Vu${film.vu.rating != null ? ` · ${film.vu.rating}/10` : ''}`
                      : film.introuvable
                        ? 'Introuvable'
                        : 'À voir'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
