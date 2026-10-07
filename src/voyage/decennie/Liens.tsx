import { Link } from 'react-router-dom'
import type { Monde } from '../../mondes/types'
import type { LienDeDecennie } from '../decennie'
import styles from '../../pages/VoyageDecennie.module.css'

/**
 * Ce que reçoivent les liens d'une décennie, par défaut ou du monde
 * (`GabaritsDesPages.liensDeDecennie`) : les pages qui ont leur route, et elles seules
 * (`PAGES_DE_LA_DECENNIE`, que la page lit), chacune avec son adresse, son nom et son compte.
 */
export interface PropsLiens {
  monde: Monde
  decennie: number
  liens: readonly LienDeDecennie[]
}

/** Les liens par défaut : deux boutons dorés, côte à côte, sans leur compte ; rien sans page à offrir. */
export default function Liens({ decennie, liens }: PropsLiens) {
  if (liens.length === 0) return null
  return (
    <nav className={styles.liens} aria-label={`Les billets et le catalogue des années ${decennie}`}>
      {liens.map((l) => (
        <Link key={l.page} to={l.vers} className={styles.lien}>
          {l.titre}
        </Link>
      ))}
    </nav>
  )
}
