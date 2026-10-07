import type { Monde } from '../../mondes/types'
import type { SalleFetee } from './lues'
import type { Scene } from './scenes'
import styles from './Celebrations.module.css'

/** Ce que la scène de la salle bouclée passe à son dessin (`GabaritsDesPages.feteDeLaSalle`). */
export interface PropsFeteDeLaSalle {
  scene: Extract<Scene, { type: 'salle' }>
  monde: Monde
  /** Le carton de la scène (`cartonDeSalle`) : ce qu'elle dit, et le nom de son dialogue. */
  carton: { sur: string; titre: string }
  /** Le déroulé est au bout (d'emblée au calme) : le carton se dit. */
  fini: boolean
  /** La salle bouclée telle que la fiche la montre (`salleFetee`) ; nulle sans fiche, ou à plusieurs. */
  salle: SalleFetee | null
}

/**
 * Le dessin par défaut de la salle bouclée : la salle se referme en rideau, puis le carton dit
 * laquelle. Au calme, le rideau est fermé et le carton posé.
 */
export default function DessinDeLaSalle({ carton, fini }: PropsFeteDeLaSalle) {
  return (
    <>
      <div className={styles.salle} aria-hidden="true">
        <i className={`${styles.pan} ${styles.gauche}`} />
        <i className={`${styles.pan} ${styles.droite}`} />
        <i className={styles.lambrequin} />
      </div>
      {fini ? (
        <>
          <p className={styles.sur}>{carton.sur}</p>
          <p className={`celebration ${styles.titre}`}>{carton.titre}</p>
          <p className={styles.sous}>Plus un film à y voir : le rideau tombe.</p>
        </>
      ) : null}
    </>
  )
}
