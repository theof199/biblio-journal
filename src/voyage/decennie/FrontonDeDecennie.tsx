import type { Monde } from '../../mondes/types'
import type { ArretDeLaLigne } from '../decennie'
import styles from '../../pages/VoyageDecennie.module.css'

/**
 * Ce que reçoit le fronton d'une décennie, par défaut ou du monde
 * (`GabaritsDesPages.frontonDeDecennie`). Il porte le titre de niveau 1 de la page. Les arrêts sont
 * ceux de l'indicateur (`arrets`) : un monde y lit où j'en suis, sans rien recompter.
 */
export interface PropsFrontonDeDecennie {
  monde: Monde
  decennie: number
  arrets: readonly ArretDeLaLigne[]
}

/** Le fronton par défaut (maquette 1890, écran IV) : l'annonce, le millésime, le nom du monde. */
export default function FrontonDeDecennie({ monde, decennie }: PropsFrontonDeDecennie) {
  return (
    <div className={styles.fronton}>
      <p className={styles.annonce}>{monde.pages.mots.decennie.annonce}</p>
      <h1 className={styles.millesime}>{`Années ${decennie}`}</h1>
      <p className={styles.monde}>{`${monde.nom} · ${monde.sous}`}</p>
    </div>
  )
}
