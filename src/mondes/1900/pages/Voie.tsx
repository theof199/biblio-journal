import type { ReactNode } from 'react'
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
/**
 * Ce qu'une voie porte, d'un bord à l'autre : la plaque émaillée et son numéro, le nom et sa mention,
 * le compte. Commun à la voie d'une salle et à la voie à ouvrir (`VoieAOuvrir`), dont la plaque est
 * vide : sans numéro, elle ne dit que « voie ».
 */
export function LigneDeVoie({ numero, nom, mention, compte }: { numero: number | null; nom: ReactNode; mention?: ReactNode; compte?: string | null }) {
  return (
    <>
      <b className={styles.numero}>
        voie{numero !== null ? <span>{numero}</span> : null}
      </b>
      <span className={styles.nom}>
        {nom}
        {mention ? <small>{mention}</small> : null}
      </span>
      {compte ? <span className={styles.compte}>{compte}</span> : null}
    </>
  )
}

export default function Voie(props: PropsSalle) {
  const { salle, numero, ouverte, onOuvrir } = props
  const mention = mentionDeLaVoie(salle, props.fournee.abandon)
  const compte = compteDeLaSalle(salle)
  return (
    <li>
      <button type="button" className={styles.voie} aria-haspopup="dialog" aria-label={[`Voie ${numero}`, salle.nom, compte, mention].filter(Boolean).join(', ')} onClick={onOuvrir}>
        <LigneDeVoie numero={numero} nom={salle.nom} mention={mention} compte={compte} />
      </button>
      {ouverte ? <Voiture {...props} /> : null}
    </li>
  )
}
