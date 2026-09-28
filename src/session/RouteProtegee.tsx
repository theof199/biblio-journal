import { Navigate, Outlet } from 'react-router-dom'
import Panne from '../ui/Panne'
import { SessionProvider, useSessionQuery } from './SessionContext'

/**
 * Trois issues, jamais confondues : on attend, l'API est en panne (un écran
 * de connexion échouerait de la même façon), ou personne n'est connecté.
 */
export default function RouteProtegee() {
  const session = useSessionQuery()

  if (session.isPending) return <p role="status">Chargement…</p>
  if (session.error) return <Panne erreur={session.error} onReessayer={() => void session.refetch()} />
  if (!session.data) return <Navigate to="/connexion" replace />

  return (
    <SessionProvider session={session.data}>
      <Outlet />
    </SessionProvider>
  )
}
