import { Link } from 'react-router-dom'
import styles from './BilletAuCine.module.css'

/**
 * Le billet d'entrée d'« Au ciné », posé sur l'accueil entre l'entrée et le journal : le seul chemin
 * vers `/au-cine`, qui n'a pas d'onglet. C'est le billet du profil (`profil/Tickets.tsx`, les jetons
 * `--ticket-*`), en un seul exemplaire : le papier, sa bande rouge, sa souche derrière les pointillés.
 * Un lien et rien d'autre : il ne lit aucune donnée, l'accueil ne charge rien de la page qu'il ouvre.
 */
export default function BilletAuCine() {
  return (
    <Link to="/au-cine" className={styles.billet} aria-label="Au ciné : les séances et les sorties en salle">
      <span className={styles.papier}>
        <span className={styles.corps}>
          <span className={styles.titre}>Au ciné</span>
          <span className={styles.aide}>Séances et sorties en salle</span>
        </span>
        <span className={styles.souche}>
          <span className={styles.mot}>Entrée</span>
          <span className={styles.fleche} aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </Link>
  )
}
