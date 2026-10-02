import type { Reaction } from '../api/reactions'
import styles from './Tampons.module.css'

interface Props {
  /** Les réactions à montrer, dans l'ordre où on les pose. */
  reactions: readonly Reaction[]
  cochees: readonly string[]
  onBasculer: (cle: string) => void
  /** Combien de réactions restent cachées tant que le reste est replié ; 0 quand il n'y a rien à déplier. */
  cachees: number
  depliees: boolean
  onDeplier: () => void
}

/**
 * Les réactions, des tampons encreurs : un contour de pointillés, et un double cadre bleu, un peu
 * penché, une fois pressé. Un seul bouton au crayon plie ou déplie le reste (« + 10 autres »,
 * « − replier »), absent quand il n'y a rien à cacher.
 */
export default function Tampons({ reactions, cochees, onBasculer, cachees, depliees, onDeplier }: Props) {
  return (
    <div className={styles.tampons}>
      {reactions.map((reaction) => {
        const posee = cochees.includes(reaction.cle)
        return (
          <button
            key={reaction.cle}
            type="button"
            className={posee ? `${styles.encre} ${styles.tampon} ${styles.pose}` : `${styles.encre} ${styles.tampon}`}
            aria-pressed={posee}
            onClick={() => onBasculer(reaction.cle)}
          >
            {`${reaction.emoji} ${reaction.phrase}`}
          </button>
        )
      })}
      {cachees > 0 ? (
        <button type="button" className={styles.plus} onClick={onDeplier}>
          {depliees ? '− replier' : `+ ${cachees} ${cachees > 1 ? 'autres' : 'autre'}`}
        </button>
      ) : null}
    </div>
  )
}
