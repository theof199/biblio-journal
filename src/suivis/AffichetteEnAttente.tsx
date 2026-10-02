import { Barre } from '../ui/Attente'
import styles from './Affichette.module.css'

/** Une rangée de trous poinçonnés, vides. */
const TROUS = 10

/**
 * L'affichette d'une rétrospective laissée en blanc : la punaise, le papier, le cadre du portrait
 * sans portrait, le nom et le compte en barres. Les classes sont celles de `Affichette` : même
 * papier, même penche, même cadre. Ce qu'une affichette a toujours : un prénom, un nom, le compte, une
 * rangée de trous et « ensuite » ; leur nombre et leur contenu dépendent des films, et restent en blanc.
 */
export default function AffichetteEnAttente() {
  return (
    <li className={styles.affichette} data-testid="affichette-en-attente">
      <span className={styles.punaise} aria-hidden="true" />
      <p className={styles.genre}>Rétrospective</p>
      <span className={styles.cadreCliche}>
        <span className={styles.cliche} />
      </span>
      <div className={styles.prenom}>
        <Barre largeur="courte" />
      </div>
      <div className={styles.nom}>
        <Barre largeur="longue" />
      </div>
      <div className={styles.seances}>
        <Barre largeur="moyenne" />
      </div>
      <div className={styles.trous}>
        {Array.from({ length: TROUS }, (_, rang) => (
          <i key={rang} className={styles.trou} />
        ))}
      </div>
      <div className={styles.suite}>
        <Barre largeur="courte" />
        <Barre largeur="longue" />
      </div>
    </li>
  )
}
