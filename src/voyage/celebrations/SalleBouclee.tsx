import { vibrer } from '../../ui/haptique'
import Cadre from './Cadre'
import { SALLE, VIBRATION_DE_FETE, useDeroule } from './deroule'
import { cartonDeSalle, type Scene } from './scenes'
import type { PropsDeScene } from './Celebrations'
import styles from './Celebrations.module.css'

/**
 * La salle bouclée : la salle se referme en rideau, le clap tombe quand les deux pans se
 * rejoignent, puis le carton dit laquelle. Au calme, le rideau est fermé et le carton posé.
 */
export default function SalleBouclee({ scene, calme, son, onSuite }: PropsDeScene<Extract<Scene, { type: 'salle' }>>) {
  const { fini } = useDeroule(SALLE, calme, () => {
    son?.clap()
    vibrer(VIBRATION_DE_FETE)
  })
  const carton = cartonDeSalle(scene)
  return (
    <Cadre nom={`${carton.sur} : ${carton.titre}`} onToucher={onSuite} onEchap={onSuite}>
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
    </Cadre>
  )
}
