import { Link } from 'react-router-dom'
import { useSession } from '../session/SessionContext'
import styles from '../ui/Page.module.css'

export default function Profil() {
  const { user, deconnecter } = useSession()

  return (
    <div className={styles.page}>
      <h1 className={styles.titre}>{user.pseudo}</h1>
      {/* Entrée de « Mes films » (reprise de `ProfileScreen.kt`) : cet écran ne s'ouvre que depuis
          le profil, jamais depuis un autre onglet. */}
      <Link to="/profil/mes-films" className={styles.bouton}>
        Mes films
      </Link>
      <button type="button" className={styles.bouton} onClick={() => void deconnecter()}>
        Se déconnecter
      </button>
    </div>
  )
}
