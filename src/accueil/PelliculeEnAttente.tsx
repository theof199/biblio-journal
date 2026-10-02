import Affiche from '../ui/Affiche'
import { Barre } from '../ui/Attente'
import styles from './Pellicule.module.css'

/** De quoi remplir la largeur d'un écran de téléphone, la bande défilant de côté. */
const VIGNETTES = 4

/** Un mois du journal laissé en blanc : la pellicule de `Pellicule`, ses classes et donc sa hauteur, sans une date, un rang ni un nom. */
export default function PelliculeEnAttente() {
  return (
    <div className={styles.mois} data-testid="pellicule-en-attente">
      <div className={styles.entete}>
        <Barre largeur="courte" />
      </div>
      <div className={styles.defilement}>
        <ul className={styles.film}>
          {Array.from({ length: VIGNETTES }, (_, rang) => (
            <li key={rang} className={styles.vignette}>
              <div className={styles.impression} />
              <div className={styles.lien}>
                <Affiche src={null} titre="" className={styles.affiche} />
              </div>
              <div className={styles.legende}>
                <Barre largeur="moyenne" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
