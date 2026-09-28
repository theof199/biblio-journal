import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useConnexion, useSessionQuery } from '../session/SessionContext'
import ConnexionDev from './ConnexionDev'
import styles from './Connexion.module.css'

export default function Connexion() {
  const session = useSessionQuery()
  const [pseudo, setPseudo] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const connexion = useConnexion()

  if (session.data) return <Navigate to="/" replace />

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (connexion.isPending) return
    connexion.mutate({ pseudo, password: motDePasse })
  }

  return (
    <div className={styles.page}>
      <div className={styles.panneau}>
        <h1>Connexion</h1>
        <form onSubmit={handleSubmit} className={styles.formulaire}>
          <label className={styles.champ}>
            <span>Pseudo</span>
            <input
              type="text"
              value={pseudo}
              onChange={(event) => setPseudo(event.target.value)}
              className={styles.saisie}
              autoComplete="username"
              required
            />
          </label>

          <label className={styles.champ}>
            <span>Mot de passe</span>
            <input
              type="password"
              value={motDePasse}
              onChange={(event) => setMotDePasse(event.target.value)}
              className={styles.saisie}
              autoComplete="current-password"
              required
            />
          </label>

          {connexion.error ? <p role="alert">{connexion.error.message}</p> : null}

          <button type="submit" className={styles.bouton} disabled={connexion.isPending}>
            Se connecter
          </button>
        </form>

        {import.meta.env.DEV && <ConnexionDev />}
      </div>
    </div>
  )
}
