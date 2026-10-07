import type { PropsFrontonDeDecennie } from '../../../voyage/decennie/FrontonDeDecennie'
import { phraseDeLaLigne } from './ligne'
import styles from './Ligne.module.css'

/**
 * Le titre de la ligne (maquette, écran 1 : `.titre-dec`, `.txt`) : la décennie, titre de la page
 * comme pour toute décennie, écrite en petit au-dessus du nom du monde, et la phrase qui dit où j'en suis (`phraseDeLaLigne`). Le chapitre est sur la
 * plaque que la page pose sur l'affiche.
 */
export default function TitreDeLaLigne({ monde, decennie, arrets }: PropsFrontonDeDecennie) {
  return (
    <div className={styles.titre}>
      <h1 className={styles.sur}>{`Années ${decennie}`}</h1>
      <p className={styles.nom}>{monde.nom}</p>
      <p className={styles.phrase}>{phraseDeLaLigne(arrets)}</p>
    </div>
  )
}
