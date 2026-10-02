import { Navigate, Outlet, useLocation } from 'react-router-dom'
import AccueilEnAttente from '../pages/AccueilEnAttente'
import Panne from '../ui/Panne'
import PageEnAttente from './PageEnAttente'
import { SessionProvider, useSessionQuery } from './SessionContext'

/**
 * Trois issues, jamais confondues : on attend, l'API est en panne (un écran
 * de connexion échouerait de la même façon), ou personne n'est connecté.
 */
export default function RouteProtegee() {
  const session = useSessionQuery()
  const { pathname } = useLocation()

  // La porte d'entrée connaît déjà sa forme ; ailleurs, on ne sait pas encore quelle page s'ouvrira.
  if (session.isPending) return pathname === '/' ? <AccueilEnAttente /> : <PageEnAttente />
  if (session.error) return <Panne erreur={session.error} onReessayer={() => void session.refetch()} />
  if (!session.data) return <Navigate to="/connexion" replace />

  return (
    <SessionProvider session={session.data}>
      <Outlet />
    </SessionProvider>
  )
}
