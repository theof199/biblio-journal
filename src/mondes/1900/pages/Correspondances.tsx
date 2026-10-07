import type { PropsRayons } from '../../../voyage/salles/Rayons'
import Rubrique from './Rubrique'
import { MOTS_DES_VOIES } from './voies'
import styles from './Voies.module.css'

/**
 * Les correspondances d'une gare, à la place du cadre des salles (maquette, écran 2 : `.voies`) : la
 * rubrique, puis une voie par salle, que la page monte (`Voie`). Une année sans salle n'en montre rien.
 */
export default function Correspondances({ salles, children }: PropsRayons) {
  if (salles.length === 0) return null
  return (
    <section aria-label={MOTS_DES_VOIES.titre}>
      <Rubrique>
        {MOTS_DES_VOIES.titre}
        <small>{MOTS_DES_VOIES.sous}</small>
      </Rubrique>
      <ul className={styles.voies}>{children}</ul>
    </section>
  )
}
