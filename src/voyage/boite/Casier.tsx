import type { Monde } from '../../mondes/types'
import { formatDateVisionnage } from '../../ui/format'
import { numeroLisible, type Billet, type Intercalaire } from '../billets'
import styles from './Casier.module.css'

interface Props {
  monde: Monde
  /** Les intercalaires de la boîte, « Tous » en tête (`intercalaires`). */
  intercalaires: readonly Intercalaire[]
  /** L'intercalaire choisi ; nul : « Tous ». */
  choisi: number | null
  onChoisir: (annee: number | null) => void
  /** Les billets du casier ouvert, le dernier devant (`casier`). */
  billets: readonly Billet[]
  /** Le billet que la séance vient de ranger : son liseré. */
  nouveau: string | null
  onOuvrir: (entree: string) => void
}

/**
 * La boîte et son casier (maquette 1890 : `.boite`, `.intercalaires`, `.casier`, `.b-ligne`, écran
 * VII) : un intercalaire par année, et les billets du casier ouvert, chacun son numéro, son titre, la
 * date du visionnage et la note. Toucher un billet l'ouvre en grand.
 */
export default function Casier({ monde, intercalaires, choisi, onChoisir, billets, nouveau, onOuvrir }: Props) {
  const m = monde.pages.mots
  return (
    <div className={styles.boite}>
      <span className={styles.etiquette} aria-hidden="true">
        {m.boite.etiquette}
      </span>
      <div className={styles.intercalaires} role="group" aria-label="Les intercalaires">
        <button type="button" aria-pressed={choisi === null} onClick={() => onChoisir(null)}>
          {m.boite.tous}
        </button>
        {intercalaires.map((i) => (
          <button key={i.annee} type="button" aria-pressed={choisi === i.annee} aria-label={`${i.annee}, ${i.compte} billet${i.compte > 1 ? 's' : ''}`} onClick={() => onChoisir(i.annee)}>
            {i.annee}
          </button>
        ))}
      </div>
      <div className={styles.casier}>
        {billets.length === 0 ? (
          <p className={styles.vide}>{m.boite.vide}</p>
        ) : (
          <ol className={styles.billets} aria-label="Les billets">
            {billets.map((b) => {
              const { entry, media } = b.item
              const neuf = entry.id === nouveau
              return (
                <li key={entry.id}>
                  <button type="button" className={neuf ? `${styles.billet} ${styles.nouveau}` : styles.billet} onClick={() => onOuvrir(entry.id)}>
                    <span className={styles.numero}>{numeroLisible(b.numero)}</span>
                    <span className={styles.texte}>
                      <span className={styles.titre}>{media.title}</span>
                      <small>
                        {formatDateVisionnage(entry.finished_at)}
                        {entry.rating !== null ? ` · ${entry.rating}/10` : ''}
                      </small>
                    </span>
                    <span className={styles.vu} aria-hidden="true">
                      {m.billet.tampon}
                    </span>
                    {neuf ? <span className={styles.lecteur}>, rangé à l’instant</span> : null}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
