import styles from './Fronton.module.css'

/** Les rails d'un panneau allumé : le jour, l'étiquette, trois pour le titre, un détail. */
const RAILS = 6

/**
 * Le fronton éteint : le cadre, les ampoules et les rails, sans une lettre. Il ne reprend pas
 * `Fronton`, dont l'état dépend de la dernière entrée du journal : un état provisoire allumerait
 * d'autres mots que ceux qui viendront.
 */
export default function FrontonEnAttente() {
  return (
    <div className={styles.fronton}>
      <div className={styles.ampoules} />
      <div className={styles.panneau}>
        {Array.from({ length: RAILS }, (_, rail) => (
          <div key={rail} className={styles.ligne} />
        ))}
      </div>
      <div className={styles.ampoules} />
    </div>
  )
}
