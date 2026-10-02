import Affiche from '../ui/Affiche'
import { Barre } from '../ui/Attente'
import styles from './PlancheCycle.module.css'

/** Les cases d'une planche en blanc : une rangée, comme une bande de six affiches. */
const CASES = 6

/**
 * La planche d'un cycle laissée en blanc : la punaise, le papier, le nom en barre et la bande de
 * ses cases, aux classes de `PlancheCycle`, avec le compte à droite du titre et la ligne « ensuite »
 * qu'une planche a toujours ; leur contenu dépend des films.
 */
export default function PlancheCycleEnAttente() {
  return (
    <li className={styles.planche} data-testid="planche-en-attente">
      <span className={styles.punaise} aria-hidden="true" />
      <div className={styles.tete}>
        <div className={`${styles.titre} ${styles.titreVide}`}>
          <p className={styles.genre}>Cycle</p>
          <div className={styles.nom}>
            <Barre largeur="moyenne" />
          </div>
        </div>
        <div className={`${styles.attente} ${styles.attenteVide}`}>
          <Barre largeur="longue" />
        </div>
      </div>
      <ul className={styles.bande}>
        {Array.from({ length: CASES }, (_, rang) => (
          <li key={rang} className={styles.case}>
            <span className={styles.afficheCase}>
              <Affiche src={null} titre="" />
            </span>
            <span className={styles.anneeCase}>
              <Barre largeur="courte" />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.suite}>
        <Barre largeur="moyenne" />
      </div>
    </li>
  )
}
