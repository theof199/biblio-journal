import { vibrer } from '../../ui/haptique'
import Embleme, { NOM_DE_RECOMPENSE } from '../annee/Embleme'
import Cadre from './Cadre'
import { RECOMPENSE, VIBRATION_DE_FETE, useDeroule } from './deroule'
import { motifDeRecompense, type Scene } from './scenes'
import type { PropsDeScene } from './Celebrations'
import styles from './Celebrations.module.css'

const ARTICLE = { ours: 'L’', lion: 'Le ', palme: 'La ' } as const

/**
 * La récompense (maquette 1890 : `sceneBadge`) : le balancier d'une presse à médailles lance la
 * vis, qui frappe (l'éclair, le clap) ; la presse s'efface et l'emblème sort en tournant sur
 * lui-même (le carillon), puis son nom. Au calme : l'emblème et son nom, posés.
 */
export default function PresseAMedailles({ scene, monde, calme, son, onSuite }: PropsDeScene<Extract<Scene, { type: 'recompense' }>>) {
  const { pas, fini } = useDeroule(RECOMPENSE, calme, (p) => {
    if (p === 1) {
      son?.clap()
      vibrer(VIBRATION_DE_FETE)
    }
    if (p === 2) son?.carillon()
  })
  const nom = `${ARTICLE[scene.recompense]}${NOM_DE_RECOMPENSE[scene.recompense]}`
  const motif = motifDeRecompense(scene.recompense, scene.annee)
  return (
    <Cadre nom={`${nom} : ${motif}`} onToucher={onSuite} onEchap={onSuite}>
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
    </Cadre>
  )
}
