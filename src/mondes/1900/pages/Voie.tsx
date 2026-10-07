import type { PropsSalle } from '../../../voyage/salles/Salle'
import { compteDeLaSalle } from '../../../voyage/salles'
import Voiture from './Voiture'
import { mentionDeLaVoie } from './voies'
import styles from './Voies.module.css'

/**
 * Une voie de correspondance, à la place d'une salle (maquette, écran 2 : `.voie`) : son numéro sur
 * la plaque émaillée, le nom de la salle, son compte. La toucher ouvre sa voiture, dans l'adresse
 * (le calque `voiture`, que la page tient) : au `click`, jamais au premier contact d'un défilement.
 */
export default function Voie(props: PropsSalle) {
  const { salle, numero, ouverte, onOuvrir } = props
  const mention = mentionDeLaVoie(salle, props.fournee.abandon)
  const compte = compteDeLaSalle(salle)
  return (
    <li>
      <button type="button" className={styles.voie} aria-haspopup="dialog" aria-label={[`Voie ${numero}`, salle.nom, compte, mention].filter(Boolean).join(', ')} onClick={onOuvrir}>
        <b className={styles.numero}>
          voie<span>{numero}</span>
        </b>
        <span className={styles.nom}>
          {salle.nom}
          {mention ? <small>{mention}</small> : null}
        </span>
        <span className={styles.compte}>{compte}</span>
      </button>
      {ouverte ? <Voiture {...props} /> : null}
    </li>
  )
}
