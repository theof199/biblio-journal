import { ApiError } from '../api/client'

interface PanneProps {
  erreur: unknown
  onReessayer: () => void
}

/** Panne de l'API : jamais l'écran de connexion, qui échouerait de la même façon. */
export default function Panne({ erreur, onReessayer }: PanneProps) {
  const message =
    erreur instanceof ApiError ? erreur.message : 'Une erreur inattendue est survenue. Réessaie.'

  return (
    <div role="alert">
      <p>{message}</p>
      <button type="button" onClick={onReessayer}>
        Réessayer
      </button>
    </div>
  )
}
