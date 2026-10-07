import type { PropsTeteDeLaSacoche } from '../../../voyage/sacoche/Tete'
import { MOTS_DE_LA_SACOCHE as M } from './sacoche'
import styles from './Sacoche.module.css'

/**
 * La tête de la sacoche des années 1900 (maquette, écran 15 : `.sacoche-tete`) : le rabat de cuir, le
 * nom de la compagnie, le titre de la page et le fermoir de laiton. Le pseudo ne s'y écrit pas : la
 * maquette ne signe pas la sacoche. Rien n'y bouge.
 */
export default function Rabat(_: PropsTeteDeLaSacoche) {
  return (
    <div className={styles.tete}>
      <div className={styles.rabat}>
        <small>{M.compagnie}</small>
        <h1>{M.titre}</h1>
      </div>
    </div>
  )
}
