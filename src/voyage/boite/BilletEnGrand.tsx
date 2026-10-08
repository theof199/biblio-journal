import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { Monde } from '../../mondes/types'
import { formatDateVisionnage } from '../../ui/format'
import { numeroLisible, type Billet } from '../billets'
import { useDialogue } from '../dialogue'
import styles from './Visionneuse.module.css'

/** Une réaction du billet, telle que le catalogue la dit ; `emoji` et `phrase` nuls tant qu'il n'est pas lu. */
export interface ReactionDuBillet {
  cle: string
  emoji: string | null
  phrase: string | null
}

export interface PropsBilletEnGrand {
  monde: Monde
  billet: Billet
  /** Les réactions du billet, dans son ordre, lues au catalogue par `Visionneuse`. */
  reactions: readonly ReactionDuBillet[]
  /** Le billet de correction, quand la fiche de l'année du film est déjà lue ; nul sinon. */
  corriger: string | null
  onFermer: () => void
  /** Le contrôleur a poinçonné ce billet, cette séance et non son film. Le billet par défaut l'ignore. */
  poinconne?: boolean
}

/**
 * Le dessin d'un billet de la boîte ouvert en grand (maquette 1890 : `.visionneuse`, `.billet-plein`,
 * écran VII) : ce que dit le billet de séance — le titre, la date, la note, les réactions — et la
 * remarque privée, puisque c'est mon journal (`/me/journal`). Un dialogue comme le feuillet : il prend
 * le focus, le rend en se fermant, et se ferme à Échap comme d'un toucher sur le voile.
 *
 * Le composant par défaut de la clé de gabarit `billetEnGrand`, lue par `Visionneuse`, qui garde la
 * lecture du catalogue des réactions.
 */
export default function BilletEnGrand({ monde, billet, reactions, corriger, onFermer }: PropsBilletEnGrand) {
  const m = monde.pages.mots
  const ranger = useDialogue<HTMLButtonElement>(onFermer)
  const id = useId()
  const { entry, media, carnet } = billet.item
  const vu = (
    <span className={styles.tampon} aria-hidden="true">
      {m.billet.tampon}
    </span>
  )

  return (
    <div className={styles.calque}>
      <div className={styles.voile} onClick={onFermer} aria-hidden="true" />
      <div className={styles.billet} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className={styles.entete}>
          <small>{m.billet.tete}</small>
          <strong id={id}>{media.title}</strong>
          <span className={styles.numero}>{numeroLisible(billet.numero)}</span>
        </div>
        <dl className={styles.champs}>
          <div className={styles.champ}>
            <dt>{m.billet.titre}</dt>
            <dd>{formatDateVisionnage(entry.finished_at)}</dd>
          </div>
          {media.director ? (
            <div className={styles.champ}>
              <dt>Réalisation</dt>
              <dd>{media.director}</dd>
            </div>
          ) : null}
          <div className={styles.champ}>
            <dt>Note</dt>
            <dd>{entry.rating !== null ? `${entry.rating} sur 10` : 'sans note'}</dd>
          </div>
        </dl>
        {reactions.length > 0 ? (
          <ul className={styles.reactions} aria-label="Tes réactions">
            {reactions.map((r) => (
              <li key={r.cle}>{r.phrase !== null ? `${r.emoji} ${r.phrase}` : r.cle}</li>
            ))}
          </ul>
        ) : null}
        {/* Le grand « VU » flotte à côté de la remarque, que le texte contourne : jamais dessus. */}
        {carnet.comment ? (
          <p className={styles.prive}>
            {vu}
            <span className={styles.sc}>Ta remarque · rien qu’à toi</span>
            {carnet.comment}
          </p>
        ) : (
          <div className={styles.sansRemarque}>{vu}</div>
        )}
        <div className={styles.gestes}>
          {corriger ? (
            <Link to={corriger} state={{ item: billet.item }} className={styles.corriger}>
              Corriger le billet
            </Link>
          ) : null}
          <button ref={ranger} type="button" className={styles.ranger} onClick={onFermer}>
            {m.boite.ranger}
          </button>
        </div>
      </div>
    </div>
  )
}
