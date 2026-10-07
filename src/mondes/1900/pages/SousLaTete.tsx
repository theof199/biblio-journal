import type { PropsFronton } from '../../../voyage/annee/Fronton'
import { heureDeLaGare } from './gare'
import styles from './Tete.module.css'

/**
 * Ce qui tient lieu de fronton sous la tête de la gare (maquette, écran 2 : `.g-sous`). La plaque de
 * la tête porte déjà l'année, qui est le titre de la page, et son tampon dit la ligne bouclée : ni
 * l'une ni l'annonce ne se répètent ici. Reste l'heure de la gare, et ce que la fiche accroche (le
 * ruban de la récompense d'une année bouclée).
 */
export default function SousLaTete({ annee, children }: PropsFronton) {
  return (
    <div className={styles.sous}>
      <p className={styles.heure}>{`L’horloge marque ${heureDeLaGare(annee).libelle} : l’année est l’heure de la gare.`}</p>
      {children}
    </div>
  )
}
