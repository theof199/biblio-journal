import { DECENNIES_DU_VOYAGE } from './bilan'
import styles from './Perforations.module.css'

/**
 * Les quatorze décennies du Voyage sur une bande de pellicule : un repère par décennie, allumé quand
 * un film y est sorti, son compte au-dessus (éteint à zéro) et son année dessous. Sur un écran
 * étroit, l'année se réduit à ses deux derniers chiffres (« ’20 »), la feuille choisit.
 */
export default function Perforations({ comptes }: { comptes: readonly number[] }) {
  const description = DECENNIES_DU_VOYAGE.map((decennie, indice) => `${decennie} : ${comptes[indice]}`).join(', ')
  return (
    <div className={styles.bande} role="img" aria-label={`Films par décennie : ${description}`}>
      <ul className={styles.cellules} aria-hidden="true">
        {DECENNIES_DU_VOYAGE.map((decennie, indice) => {
          const compte = comptes[indice] ?? 0
          const annee = String(decennie)
          return (
            <li key={decennie} className={styles.cellule} data-allume={compte > 0 ? '' : undefined}>
              <span className={styles.compte}>{compte}</span>
              <span className={styles.repere} />
              <span className={styles.annee}>
                <span className={styles.siecle}>{annee.slice(0, 2)}</span>
                <span className={styles.fin}>{annee.slice(2)}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
