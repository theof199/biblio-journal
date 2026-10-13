import SectionAuCine from '../cinema/SectionAuCine'
import styles from './AuCine.module.css'

/**
 * L'onglet « Au ciné » : il ne porte plus que le titre de la page, tout le reste est la section
 * (`cinema/SectionAuCine.tsx`), que l'accueil recevra.
 */
export default function AuCine() {
  return (
    <div className={styles.page}>
      <h1 className="sr-only">Au ciné</h1>
      <SectionAuCine />
    </div>
  )
}
