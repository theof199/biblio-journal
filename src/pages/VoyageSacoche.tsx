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
import Bobines from '../voyage/sacoche/Bobines'
import Coulisses from '../voyage/sacoche/Coulisses'
import Courrier from '../voyage/sacoche/Courrier'
import Malle from '../voyage/sacoche/Malle'
import Objets from '../voyage/sacoche/Objets'
import Passeport from '../voyage/sacoche/Passeport'
import Portefeuille from '../voyage/sacoche/Portefeuille'
import TeteParDefaut from '../voyage/sacoche/Tete'
import styles from './VoyageSacoche.module.css'

/** Un registre pour la page, comme la carte et la page d'une décennie ont le leur. */
const mondes = creerRegistre()

/** Le départ du Voyage, tel que le contrat le fige : la décennie qui habille la page quand la carte est en panne. */
const DEPART: Voyage['depart'] = 1895

/**
 * La sacoche du voyageur (`/voyage/sacoche`, ouverte d'une pastille de la carte) : ce que j'ai
 * accompli dans le Voyage, repris du profil de l'appli Android — le passeport, le portefeuille, et
 * les Coulisses repliées (dépenses au chroniqueur, crédits des images). Habillée par le monde de mon
 * année en cours ; chaque page du passeport, par celui de sa décennie. Chaque bloc lit ses données
 * et tombe seul en panne ; son dessin, et celui de la tête, sont des gabarits que le monde peut
 * composer (`teteDeLaSacoche`, `passeportDeLaSacoche`, `pageDuPasseport`, `portefeuille`,
 * `coulisses`). Entre le passeport et le portefeuille, la malle aux étiquettes (`Malle`,
 * `malleDeLaSacoche`) **n'a pas de défaut** : un monde qui ne la compose pas ne la monte ni ne la lit.
 * De même le courrier (`Courrier`, `courrierDeLaSacoche`), les objets trouvés (`Objets`,
 * `objetsDeLaSacoche`) puis les bobines retrouvées (`Bobines`, `bobinesDeLaSacoche`), entre le
 * portefeuille et les coulisses.
 * **Aucune fiche d'année n'est lue** : `GET /me/voyage/annees/*` enfilerait
 * une ouverture chez le chroniqueur ; la carte, les tickets et, au dépli, les dépenses suffisent.
 *
 * **Tant que la carte n'a pas répondu, aucun monde n'habille rien** (la sacoche ouverte par un lien
 * direct : un voyageur de 1900 verrait celle de la foire, puis toute la composition basculer) : la
 * page attend, sans jetons, comme les autres pages attendent la carte. Les trois blocs sont déjà
 * montés, sans dessin : leurs lectures partent avec celle de la carte, et leur région est la même
 * quand elle arrive. La carte en panne, la page prend le monde du départ : chaque bloc dit alors ce
 * qu'il a, le passeport sa panne.
 */
export default function VoyageSacoche() {
  const { user } = useSession()
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const enCours = voyage.data?.annee_en_cours ?? (voyage.error ? DEPART : null)
  const monde = enCours === null ? null : mondes(decennieDe(enCours))
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: (CSSProperties & Record<string, string>) | undefined = monde ? { ...monde.pages.jetons } : undefined
  const revenir = useRevenir('/voyage')
  const Tete = monde ? gabaritDe(monde, 'teteDeLaSacoche', TeteParDefaut) : null

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
      {Tete ? (
        <Tete pseudo={user.pseudo} />
      ) : (
        <p role="status" className={styles.etat}>
          Chargement…
        </p>
      )}
      <Passeport monde={monde} />
      <Malle monde={monde} />
      <Portefeuille monde={monde} />
      <Courrier monde={monde} />
      <Objets monde={monde} />
      <Bobines monde={monde} />
      <Coulisses monde={monde} />
    </section>
  )
}
