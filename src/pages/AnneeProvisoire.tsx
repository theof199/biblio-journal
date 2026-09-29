import { Link, useParams } from 'react-router-dom'

/** La place de la fiche d'année, jusqu'au plan 2b qui la remplace. Dans `.contenu` de la coque, déjà un `<main>` : pas un second. */
export default function AnneeProvisoire() {
  const { annee } = useParams()
  return (
    <div>
      <h1>{annee}</h1>
      <p>La fiche de cette année arrive bientôt.</p>
      <Link to="/voyage">Retour à la carte</Link>
    </div>
  )
}
