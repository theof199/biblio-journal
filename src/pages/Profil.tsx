import { useSession } from '../session/SessionContext'
import styles from '../ui/Page.module.css'

export default function Profil() {
  const { user, deconnecter } = useSession()

  return (
    <div className={styles.page}>
      <h1 className={styles.titre}>{user.pseudo}</h1>
      <button type="button" className={styles.bouton} onClick={() => void deconnecter()}>
        Se déconnecter
      </button>
    </div>
  )
}
