import styles from './Fronton.module.css'

/**
 * Les rails d'un panneau éteint. Un fronton allumé en compte cinq à sept selon son titre (le jour,
 * l'étiquette, deux ou trois pour le titre, un détail) : le blanc en prend quatre, pour n'être jamais
 * plus haut que le plus court, que la page agrandit à l'arrivée.
 */
const RAILS = 4

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
