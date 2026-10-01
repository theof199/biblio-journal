import { Link } from 'react-router-dom'
import styles from './SoucheCaisse.module.css'

/**
 * Le ticket de caisse qui sort de son imprimante, en bas du profil : le lien vers les réglages
 * (`profil/reglages`). Seul le haut du ticket dépasse de la fente, déchiré ; la page de la caisse le déroule.
 */
export default function SoucheCaisse() {
  return (
    <Link
      to="/profil/reglages"
      className={styles.imprimante}
      aria-label="Journal, la caisse : jour ou nuit, Letterboxd, doublons, se déconnecter"
    >
      <span className={styles.souche}>
        <span className={styles.papier} aria-hidden="true" />
        <span className={styles.texte}>
          <span className={styles.journal}>Journal</span>
          <span className={styles.titre}>La caisse</span>
          <span className={styles.aide}>Jour ou nuit · Letterboxd · doublons · se déconnecter</span>
          <span className={styles.fleche} aria-hidden="true">
            →
          </span>
        </span>
      </span>
      <span className={styles.fente} aria-hidden="true">
        <span className={styles.ouverture} />
        <span className={styles.voyant} />
      </span>
    </Link>
  )
}
