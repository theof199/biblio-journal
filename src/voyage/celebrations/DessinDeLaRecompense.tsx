import type { Monde } from '../../mondes/types'
import Embleme from '../annee/Embleme'
import type { RecompensePassee } from './lues'
import type { Scene } from './scenes'
import styles from './Celebrations.module.css'

/** Ce que la scène de la récompense passe à son dessin (`GabaritsDesPages.feteDeLaRecompense`). */
export interface PropsFeteDeLaRecompense {
  scene: Extract<Scene, { type: 'recompense' }>
  monde: Monde
  /** Le pas du déroulé (`RECOMPENSE`) : 1, la frappe ; 2, l'emblème sort ; le dernier d'emblée au calme. */
  pas: number
  /** Le déroulé est au bout : le nom se dit. */
  fini: boolean
  /** « Le Lion », et ce qu'il couronne (`motifDeRecompense`) : aussi le nom du dialogue. */
  nom: string
  motif: string
  /** Les récompenses des années d'avant de la décennie, lues de la carte (`recompensesDAvant`). */
  passees: readonly RecompensePassee[]
}

/**
 * Le dessin par défaut de la récompense : le balancier d'une presse à médailles lance la vis, qui
 * frappe ; la presse s'efface et l'emblème sort en tournant sur lui-même, puis son nom. Au calme :
 * l'emblème et son nom, posés. Il ne montre pas les récompenses passées.
 */
export default function DessinDeLaRecompense({ scene, monde, pas, fini, nom, motif }: PropsFeteDeLaRecompense) {
  return (
    <>
      <div className={styles.presse}>
        <div className={`${styles.machine} ${pas >= 2 ? styles.efface : ''}`} aria-hidden="true">
          <i className={styles.balancier} />
          <i className={styles.vis} />
          <i className={styles.traverse} />
          <i className={`${styles.montant} ${styles.montantGauche}`} />
          <i className={`${styles.montant} ${styles.montantDroit}`} />
          <i className={styles.enclume} />
          <i className={styles.socle} />
        </div>
        {pas >= 1 ? <i className={styles.eclair} aria-hidden="true" /> : null}
        {pas >= 2 ? <Embleme type={scene.recompense} couleur={monde.couleur} className={styles.sortie} /> : null}
      </div>
      {fini ? (
        <>
          <p className={`celebration ${styles.titre}`}>{nom}</p>
          <p className={styles.sous}>{motif}</p>
        </>
      ) : null}
    </>
  )
}
