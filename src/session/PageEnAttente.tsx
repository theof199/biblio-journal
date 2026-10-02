import Affiche from '../ui/Affiche'
import Attente, { Barre } from '../ui/Attente'
import styles from './PageEnAttente.module.css'

const LIGNES = 5

/**
 * Une page quelconque avant que la session ne réponde : on ne sait pas encore où l'on va, donc un
 * titre et des lignes de film, la forme que prennent la plupart des pages. L'accueil, lui, a la sienne
 * (`AccueilEnAttente`).
 */
export default function PageEnAttente() {
  return (
    <Attente className={styles.page}>
      <div className={styles.titre}>
        <Barre largeur="courte" />
      </div>
      {Array.from({ length: LIGNES }, (_, ligne) => (
        <div key={ligne} className={styles.ligne} data-testid="ligne-en-attente">
          <Affiche src={null} titre="" taille="ligne" />
          <div className={styles.infos}>
            <Barre largeur="longue" />
            <Barre largeur="moyenne" />
          </div>
        </div>
      ))}
    </Attente>
  )
}
