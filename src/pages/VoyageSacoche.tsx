import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { lireVoyage, type Voyage } from '../api/voyage'
import { creerRegistre } from '../mondes'
import { useSession } from '../session/SessionContext'
import { useRevenir } from '../ui/revenir'
import { gabaritDe } from '../voyage/gabarit'
import { decennieDe } from '../voyage/regles'
import Coulisses from '../voyage/sacoche/Coulisses'
import Passeport from '../voyage/sacoche/Passeport'
import Portefeuille from '../voyage/sacoche/Portefeuille'
import TeteParDefaut from '../voyage/sacoche/Tete'
import styles from './VoyageSacoche.module.css'

/** Un registre pour la page, comme la carte et la page d'une décennie ont le leur. */
const mondes = creerRegistre()

/** Le départ du Voyage, tel que le contrat le fige : la décennie qui habille la page avant la carte. */
const DEPART: Voyage['depart'] = 1895

/**
 * La sacoche du voyageur (`/voyage/sacoche`, ouverte d'une pastille de la carte) : ce que j'ai
 * accompli dans le Voyage, repris du profil de l'appli Android — le passeport, le portefeuille, et
 * les Coulisses repliées (dépenses au chroniqueur, crédits des images). Habillée par le monde de mon
 * année en cours ; chaque page du passeport, par celui de sa décennie. Chaque bloc lit ses données
 * et tombe seul en panne ; son dessin, et celui de la tête, sont des gabarits que le monde peut
 * composer (`teteDeLaSacoche`, `passeportDeLaSacoche`, `pageDuPasseport`, `portefeuille`,
 * `coulisses`). **Aucune fiche d'année n'est lue** : `GET /me/voyage/annees/*` enfilerait
 * une ouverture chez le chroniqueur ; la carte, les tickets et, au dépli, les dépenses suffisent.
 */
export default function VoyageSacoche() {
  const { user } = useSession()
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const monde = mondes(decennieDe(voyage.data?.annee_en_cours ?? DEPART))
  const { jetons } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const revenir = useRevenir('/voyage')
  const Tete = gabaritDe(monde, 'teteDeLaSacoche', TeteParDefaut)

  return (
    <section className={styles.page} style={style} aria-label="La sacoche du voyageur">
      {/* Comme la page d'une décennie : un lien vers la carte, qui recule dans l'historique quand il y a de quoi. */}
      <Link
        to="/voyage"
        className={styles.retour}
        aria-label="Retour à la carte"
        onClick={(e) => {
          // Ouvrir dans un autre onglet reste au navigateur.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          revenir()
        }}
      >
        <span aria-hidden="true">‹</span>
      </Link>
      <Tete pseudo={user.pseudo} />
      <Passeport monde={monde} />
      <Portefeuille monde={monde} />
      <Coulisses monde={monde} />
    </section>
  )
}
