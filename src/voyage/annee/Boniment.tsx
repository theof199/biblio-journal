import type { Recompense } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { paragraphes } from '../feuille'
import Embleme from './Embleme'
import styles from './Boniment.module.css'

/** Ce que la fiche prête passe au boniment ; un gabarit de monde reçoit les mêmes (`GabaritsDesPages.boniment`). */
export interface PropsBoniment {
  monde: Monde
  annee: number
  recompense: Recompense | null
  ouverture: string
  faits: readonly string[]
  /** « Le générique de fin » ne s'offre qu'avec le ticket de l'année (`afficherGenerique`). */
  generique: boolean
  onLire: () => void
  onGenerique: () => void
}

/**
 * Le boniment d'ouverture (maquette 1890 : `htmlAnnee`, `.papier`, lignes 133 à 145) : la tête et
 * l'emblème de la récompense, le premier paragraphe de l'ouverture, « Lire l’ouverture » (la feuille
 * du chroniqueur), le générique quand il existe, puis les échos de l'année.
 */
export default function Boniment({ monde, annee, recompense, ouverture, faits, generique, onLire, onGenerique }: PropsBoniment) {
  const m = monde.pages.mots
  const premier = paragraphes(ouverture)[0] ?? ''
  return (
    <section className={styles.papier} aria-label={m.boniment}>
      <div className={styles.tete}>
        <span>{`${m.boniment} · ${annee}`}</span>
        {recompense ? <Embleme type={recompense} couleur={monde.couleur} /> : null}
      </div>
      {premier ? <p className={styles.ouverture}>{premier}</p> : null}
      <div className={styles.liens}>
        <button type="button" className={styles.lien} onClick={onLire}>
          {m.lireOuverture}
        </button>
        {generique ? (
          <button type="button" className={styles.lien} onClick={onGenerique}>
            Le générique de fin
          </button>
        ) : null}
      </div>
      {faits.length > 0 ? (
        <div className={styles.echos}>
          <h2>{m.echos}</h2>
          <ul>
            {faits.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
