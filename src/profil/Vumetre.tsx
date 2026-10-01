import type { CSSProperties } from 'react'
import styles from './Vumetre.module.css'

/**
 * La distribution des notes en diodes : une colonne par note de 1 à 10, haute à proportion de son
 * compte (la colonne la plus fournie est pleine, la rouge), le compte au-dessus. Une note jamais
 * donnée n'a que ses logements sombres.
 */
export default function Vumetre({ comptes }: { comptes: readonly number[] }) {
  const maximum = Math.max(...comptes)
  return (
    <div className={styles.panneau} role="img" aria-label={`Films par note, de 1 à 10 : ${comptes.join(', ')}`}>
      <ul className={styles.colonnes} aria-hidden="true">
        {comptes.map((compte, indice) => (
          <li key={indice} className={styles.colonne} data-pic={maximum > 0 && compte === maximum ? '' : undefined}>
            <span className={styles.compte} data-vide={compte === 0 ? '' : undefined}>
              {compte}
            </span>
            {/* La part de la colonne pleine, lue par la feuille : la hauteur de diodes allumées en découle. */}
            <span className={styles.logements}>
              <span className={styles.lueur}>
                <span className={styles.diodes} style={{ '--part': maximum === 0 ? 0 : compte / maximum } as CSSProperties} />
              </span>
            </span>
            <span className={styles.note}>{indice + 1}</span>
          </li>
        ))}
      </ul>
      <p className={styles.legende} aria-hidden="true">
        Films par note
      </p>
    </div>
  )
}
