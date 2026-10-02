import { Link } from 'react-router-dom'
import styles from './Accueil.module.css'

/** L'en-tête du journal de l'accueil : son titre, son compte quand les statistiques ont répondu, et le lien vers la liste complète. */
export default function EnteteDuJournal({ compte }: { compte: string | null }) {
  return (
    <div className={styles.entete}>
      <div className={styles.intitule}>
        <h2 id="titre-journal" className={styles.titre}>
          Le journal
        </h2>
        {compte ? <p className={styles.compte}>{compte}</p> : null}
      </div>
      <Link to="/profil/mes-films" className={styles.mesFilms}>
        Mes films <span aria-hidden="true">→</span>
      </Link>
    </div>
  )
}
