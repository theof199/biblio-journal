import { useSession } from '../session/SessionContext'
import PageAttente from '../ui/PageAttente'

/** L'accueil provisoire : il salue le membre, en attendant le lot qui le remplira. */
export default function Accueil() {
  const { user } = useSession()

  return <PageAttente titre={`Bonjour ${user.pseudo}`} texte="L’accueil arrive." />
}
