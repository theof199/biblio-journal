import { Link } from 'react-router-dom'
import type { PropsLiens } from '../../../voyage/decennie/Liens'
import { MOTS_DE_LA_LIGNE as M, compteDuLien } from './ligne'
import styles from './Ligne.module.css'

/**
 * Les liens de la ligne (maquette, écran 1 : `.liens-dec`) : le casier et le guichet, ceux que la
 * page passe et eux seuls, chacun sous son nom et son compte. Le passeport n'a pas de route : il
 * reste dans la page, sans lien.
 */
export default function LiensDeLaLigne({ decennie, liens }: PropsLiens) {
  if (liens.length === 0) return null
  return (
    <nav className={styles.liens} aria-label={`${M.liens} des années ${decennie}`}>
      {liens.map((l) => {
        const sous = l.page === 'recherche' ? M.chercher : compteDuLien(l.compte)
        return (
          <Link key={l.page} to={l.vers} className={styles.lien}>
            {l.titre}
            {/* L'espace ne se voit pas (la précision passe à la ligne) : il sépare les deux au lecteur d'écran. */}
            {sous ? <> <small>{sous}</small></> : null}
          </Link>
        )
      })}
    </nav>
  )
}
