import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { lirePageRealisateur, neplusSuivreRealisateur, suivreRealisateur } from '../api/realisateurs'
import { filmsSansSeries, filmsVus } from '../suivis/prochain'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import Panne from '../ui/Panne'
import styles from './PageRealisateur.module.css'

const anneeDe = (date: string) => date.slice(0, 4)

/** « 1861 – 1938 », « né en 1958 »/« née en 1958 »/« naissance en 1958 », ou vide sans aucune date. */
function ligneDates(naissance: string | null, deces: string | null, genre: 'homme' | 'femme' | null): string {
  if (naissance && deces) return `${anneeDe(naissance)} – ${anneeDe(deces)}`
  if (naissance) {
    const annee = anneeDe(naissance)
    if (genre === 'homme') return `né en ${annee}`
    if (genre === 'femme') return `née en ${annee}`
    return `naissance en ${annee}`
  }
  return ''
}

const libelleSuivi = (suivi: boolean, genre: 'homme' | 'femme' | null): string => {
  if (!suivi) return 'Suivre'
  return genre === 'femme' ? 'Suivie' : 'Suivi'
}

/**
 * La page d'un réalisateur (reprise de `RealisateurScreen.kt`) : sa fiche, suivre/ne plus suivre,
 * et sa filmographie — films seulement, les séries écartées comme sur Android (`filmsSansSeries`) :
 * le journal ne connaît que des films. Un film cliqué ouvre sa fiche (`FicheFilm`), qu'il soit vu
 * ou à voir.
 */
export default function PageRealisateur() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const id = Number(tmdbId)
  const client = useQueryClient()

  const page = useQuery({
    queryKey: cles.pageRealisateur(id),
    queryFn: ({ signal }) => lirePageRealisateur(id, signal),
  })

  const suivi = useMutation({
    mutationFn: async (): Promise<void> => {
      if (page.data!.suivi) await neplusSuivreRealisateur(id)
      else await suivreRealisateur(id)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cles.realisateurs })
      void client.invalidateQueries({ queryKey: cles.pageRealisateur(id) })
    },
  })

  if (page.isPending) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <p role="status">Chargement…</p>
      </div>
    )
  }
  if (page.error) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <Panne erreur={page.error} onReessayer={() => void page.refetch()} />
      </div>
    )
  }

  const fiche = page.data
  const films = filmsSansSeries(fiche.films)
  const dates = ligneDates(fiche.naissance, fiche.deces, fiche.genre)

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers="/suivis" />
      </div>

      <div className={styles.fiche}>
        <Affiche src={fiche.photo_url} titre={fiche.name} taille="ligne" className={styles.photo} />
        <div className={styles.infos}>
          <h1 className={styles.nom}>{fiche.name}</h1>
          {dates ? <p className={styles.dates}>{dates}</p> : null}
          <p className={styles.compte}>
            {filmsVus(films)} vus sur {films.length}
          </p>
        </div>
      </div>

      <button
        type="button"
        className={styles.boutonSuivre}
        onClick={() => suivi.mutate()}
        disabled={suivi.isPending}
      >
        {libelleSuivi(fiche.suivi, fiche.genre)}
      </button>
      {suivi.error ? (
        <p role="alert">{suivi.error instanceof Error ? suivi.error.message : String(suivi.error)}</p>
      ) : null}

      {fiche.presentation ? <p className={styles.presentation}>{fiche.presentation}</p> : null}

      {films.length === 0 ? (
        <p className={styles.vide}>Aucun film connu pour ce réalisateur.</p>
      ) : (
        <ul className={styles.liste}>
          {films.map((film) => (
            <li key={film.tmdb_id}>
              <Link
                to={`/suivis/films/${film.tmdb_id}`}
                state={{ film, realisateur: { tmdb_id: id, name: fiche.name } }}
                className={styles.film}
              >
                <Affiche src={film.cover_url} titre={film.title} taille="ligne" />
                <div className={styles.infosFilm}>
                  <p className={styles.titreFilm}>
                    {film.title}
                    {film.year ? ` (${film.year})` : ''}
                  </p>
                  <p className={styles.etatFilm}>
                    {film.vu ? `Vu${film.vu.rating != null ? ` · ${film.vu.rating}/10` : ''}` : film.introuvable ? 'Introuvable' : 'À voir'}
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
