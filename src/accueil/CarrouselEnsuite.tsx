import { Link } from 'react-router-dom'
import Affiche from '../ui/Affiche'
import { candidatDepuisPlex } from '../formulaire/candidat'
import styles from './CarrouselEnsuite.module.css'
import type { PlexFilm } from '../api/plex'

/**
 * « Ensuite » (reprise de `CarrrouselEnsuite`, `HomeScreen.kt`) : ce qu'il reste à voir, en dehors
 * du journal. Réduit à la source Plex dans ce lot — les réalisateurs et sagas suivis viennent d'un
 * autre lot (Suivis), pas encore construit ici.
 */
export default function CarrouselEnsuite({ film }: { film: PlexFilm }) {
  return (
    <Link
      to="/journal/nouveau"
      state={{ candidat: candidatDepuisPlex(film) }}
      className={styles.carte}
    >
      <Affiche src={film.cover_url} titre={film.title} taille="ligne" />
      <div className={styles.texte}>
        <p className={styles.etiquette}>Ensuite</p>
        <p className={styles.titre}>
          {film.title}
          {film.year ? ` (${film.year})` : ''}
        </p>
      </div>
    </Link>
  )
}
