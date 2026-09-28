import { useSession } from '../session/SessionContext'
import styles from './Bonjour.module.css'

export default function Bonjour() {
  const { user, deconnecter } = useSession()

  return (
    <div className={styles.page}>
      <h1>Bonjour {user.pseudo}</h1>
      <button type="button" className={styles.bouton} onClick={() => void deconnecter()}>
        Se déconnecter
      </button>
    </div>
  )
}
