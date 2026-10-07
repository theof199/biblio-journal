import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './Action.module.css'

type Props = {
  children: ReactNode
  /** La précision sous le mot, en italique (maquette : `.bout-action small`). */
  sous?: ReactNode
} & (
  | { /** Un lien : où il mène, et l'état de navigation qu'il emporte. */ vers: string; etat?: unknown }
  | { onClick: () => void; disabled?: boolean }
)

/**
 * Le bouton d'action des pages 1900 (maquette : `.bout-action`) : le corail, jamais teinté, qui ne
 * marque que ce que le voyageur déclenche. Un lien quand il mène ailleurs, un bouton sinon. Commun à
 * toutes les sections du monde : « Composer une séance », « Composter une séance », « Corriger ».
 */
export default function Action(props: Props) {
  const contenu = (
    <>
      {props.children}
      {/* L'espace ne se voit pas (la précision passe à la ligne) : il sépare les deux au lecteur d'écran. */}
      {props.sous ? <> <small>{props.sous}</small></> : null}
    </>
  )
  if ('vers' in props) {
    return (
      <Link to={props.vers} state={props.etat} className={styles.action}>
        {contenu}
      </Link>
    )
  }
  return (
    <button type="button" className={styles.action} onClick={props.onClick} disabled={props.disabled}>
      {contenu}
    </button>
  )
}
