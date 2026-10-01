import { useId } from 'react'
import { Link } from 'react-router-dom'
import { destinationFilmRealisateur, destinationFilmSaga } from './destination'
import type { FilmEnsuite } from './affichettes'
import AfficheSuivi from './AfficheSuivi'
import styles from './RangeeEnsuite.module.css'

/**
 * « Ensuite » : le prochain film à voir de chaque réalisateur et de chaque saga en cours, en une
 * rangée qui défile de côté — l'affiche, le titre, et sous lui le nom du suivi. Chaque film mène
 * où le mène sa ligne de la page de son réalisateur ou de sa saga (`destination.ts`). Absente quand
 * aucun suivi n'a de prochain film : une rangée vide n'a rien à annoncer.
 */
export default function RangeeEnsuite({ films }: { films: readonly FilmEnsuite[] }) {
  const idTitre = useId()
  if (films.length === 0) return null

  return (
    <section className={styles.ensuite} aria-labelledby={idTitre}>
      <h2 id={idTitre} className={styles.titre}>
        Ensuite
      </h2>
      <ul className={styles.defile}>
        {films.map((ensuite) => {
          const destination =
            ensuite.source === 'realisateurs'
              ? destinationFilmRealisateur(ensuite.film, ensuite.entite)
              : destinationFilmSaga(ensuite.film)
          return (
            <li key={`${ensuite.source}-${ensuite.entite.tmdb_id}`} className={styles.element}>
              <Link to={destination.to} state={destination.state} className={styles.lien}>
                <div aria-hidden="true">
                  <AfficheSuivi film={ensuite.film} className={styles.affiche} />
                </div>
                <p className={styles.film}>{ensuite.film.title}</p>
                <p className={styles.de}>{ensuite.entite.name}</p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
