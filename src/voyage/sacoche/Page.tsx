import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Monde } from '../../mondes/types'
import Anneau, { anneesSur } from '../passeport/Anneau'
import Tampon from '../passeport/Tampon'
import type { Tampon as TamponDuPasseport } from '../passeport'
import styles from './Passeport.module.css'

/**
 * Ce que reçoit une page du passeport de la sacoche, par défaut ou du monde
 * (`GabaritsDesPages.pageDuPasseport`). **Le monde est celui de la décennie de la page**, jamais
 * celui de mon année en cours : c'est lui qui la dessine, et qui pose ses jetons sur elle.
 */
export interface PropsPageDuPasseport {
  /** Le monde de la décennie (`creerRegistre()(decennie)`). */
  monde: Monde
  decennie: number
  /** Le tampon de la décennie (`tamponDe`), nul tant qu'elle n'est pas bouclée. */
  tampon: TamponDuPasseport | null
  /** Les années qui portent leur récompense, sur toutes (`anneauDuPasseport`). */
  anneau: { faites: number; total: number }
  /** La page de la décennie, où mène celle-ci. */
  vers: string
}

/**
 * La page par défaut, au livret de sa décennie (ses jetons posés sur elle, comme le tampon le fait) :
 * bouclée, son tampon (le titre du voyageur, le jour de Paris où elle l'a été) ; sinon, son anneau.
 */
export default function Page({ monde, decennie: d, tampon, anneau, vers }: PropsPageDuPasseport) {
  const { jetons } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  return (
    <Link to={vers} className={styles.page} style={style}>
      <div className={styles.tete}>
        {tampon ? null : <Anneau {...anneau} />}
        <span className={styles.texte}>
          <span className={styles.decennie}>{`Années ${d}`}</span>
          <span className={styles.monde}>{monde.nom}</span>
          {tampon ? null : <span className={styles.annees}>{anneesSur(anneau)}</span>}
        </span>
        <span className={styles.fleche} aria-hidden="true">
          ›
        </span>
      </div>
      {tampon ? (
        <div className={styles.tampon}>
          <Tampon monde={monde} decennie={d} tampon={tampon} />
        </div>
      ) : null}
    </Link>
  )
}
