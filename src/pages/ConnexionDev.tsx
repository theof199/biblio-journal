import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { connexionDev } from '../api/session'
import { ouvrirLaSession } from '../session/SessionContext'
import styles from './ConnexionDev.module.css'

/**
 * Outil de développement, rendu uniquement sous `import.meta.env.DEV` par
 * `Connexion`. L'API ne monte `/auth/dev-login` que si `ENABLE_DEV_LOGIN` le
 * dit (404 sinon) ; `scripts/verifier-dist.mjs` (tâche 4) prouve que ce
 * module ne part pas en ligne.
 */
export default function ConnexionDev() {
  const [pseudo, setPseudo] = useState('')
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (pseudo: string) => connexionDev(pseudo),
    // Le jumeau de la connexion : une session neuve part d'un cache vide.
    onSuccess: (session) => ouvrirLaSession(client, session),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!pseudo.trim() || mutation.isPending) return
    mutation.mutate(pseudo.trim())
  }

  return (
    <div className={styles.bloc}>
      <p className={styles.titre}>Développement</p>
      <form onSubmit={handleSubmit} className={styles.ligne}>
        <label>
          <span className="sr-only">Pseudo (dev)</span>
          <input
            type="text"
            aria-label="Pseudo (dev)"
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value)}
            className={styles.champ}
          />
        </label>
        <button type="submit" className={styles.bouton} disabled={mutation.isPending}>
          Connexion de dev
        </button>
      </form>
      {mutation.error ? <p role="alert">{(mutation.error as Error).message}</p> : null}
    </div>
  )
}
