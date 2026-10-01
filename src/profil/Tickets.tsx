import type { CSSProperties } from 'react'
import type { ReactionComptee } from './bilan'
import styles from './Tickets.module.css'

/**
 * Les réactions les plus posées, en souches de billets empilées : plus une réaction est posée, plus son
 * billet est long. Le compte est sur la souche, côté perforation.
 */
export default function Tickets({ reactions }: { reactions: readonly ReactionComptee[] }) {
  const maximum = Math.max(...reactions.map((reaction) => reaction.nombre))
  return (
    <ul className={styles.liste}>
      {reactions.map((reaction) => (
        <li key={reaction.cle} className={styles.ticket} style={{ '--part': reaction.nombre / maximum } as CSSProperties}>
          <span className={styles.papier}>
            <span className={styles.corps}>
              <span className={styles.emoji} aria-hidden="true">
                {reaction.emoji}
              </span>
              <span className={styles.phrase}>{reaction.phrase}</span>
            </span>
            <span className={styles.souche}>
              <span className={styles.compte}>{reaction.nombre}</span>
              <span className={styles.fois}>fois</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
