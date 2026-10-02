import { Barre } from '../ui/Attente'
import styles from './Affichette.module.css'

/**
 * L'affichette d'une rétrospective laissée en blanc : la punaise, le papier, le cadre du portrait
 * sans portrait, le nom et le compte en barres. Les classes sont celles de `Affichette` : même
 * papier, même penche, même cadre. Ni trous poinçonnés ni « ensuite », qui dépendent des films.
 */
export default function AffichetteEnAttente() {
  return (
    <li className={styles.affichette} data-testid="affichette-en-attente">
      <span className={styles.punaise} aria-hidden="true" />
      <p className={styles.genre}>Rétrospective</p>
      <span className={styles.cadreCliche}>
        <span className={styles.cliche} />
      </span>
      <div className={styles.nom}>
        <Barre largeur="longue" />
      </div>
      <div className={styles.seances}>
        <Barre largeur="moyenne" />
      </div>
    </li>
  )
}
