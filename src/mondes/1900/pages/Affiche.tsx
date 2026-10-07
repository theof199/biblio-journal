import type { PropsMonument } from '../../../voyage/decennie/Monument'
import { imageDu1900 } from '../images'
import { MOTS_DE_LA_LIGNE } from './ligne'
import styles from './Ligne.module.css'

/**
 * La tête de la ligne des années 1900 (maquette, écran 1 : `.affiche-tete`), à la place du monument :
 * l'affiche du Transsibérien. Rien ne s'y touche ni n'y bouge : les années s'ouvrent par l'indicateur.
 */
export default function Affiche({ decennie }: PropsMonument) {
  const affiche = imageDu1900(`aff${decennie}`)
  return <div className={styles.affiche} role="img" aria-label={MOTS_DE_LA_LIGNE.affiche} style={affiche ? { backgroundImage: `url(${affiche})` } : undefined} />
}
