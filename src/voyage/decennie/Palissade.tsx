import type { Monde } from '../../mondes/types'
import type { Panneau } from '../decennie'
import styles from './Palissade.module.css'

/**
 * La palissade des affiches (maquette 1890 : `.palissade`, `.panneau`, écran IV) : un panneau par
 * année du Voyage de la décennie, ses affiches collées de travers (traitées comme le monde traite
 * les affiches), « +N » pour les films vus sans place, le millésime au pochoir, et « en avance »
 * pour une année verrouillée déjà entamée.
 */
export default function Palissade({ monde, panneaux }: { monde: Monde; panneaux: readonly Panneau[] }) {
  const m = monde.pages.mots
  const traitement = monde.traitement.affiches === 'sepia' ? styles.sepia : monde.traitement.affiches === 'gris' ? styles.gris : ''

  return (
    <ul className={`${styles.palissade} ${traitement}`} aria-label={m.decennie.palissade.titre}>
      {panneaux.map((p) => (
        <li key={p.annee} className={p.enAvance ? `${styles.panneau} ${styles.avance}` : styles.panneau}>
          <span className={styles.colle}>
            {p.affiches.length > 0 ? p.affiches.map((url) => <img key={url} src={url} alt="" />) : <span className={styles.vide}>{m.decennie.prochainement}</span>}
            {p.plus > 0 ? <span className={styles.plus}>{`+${p.plus}`}</span> : null}
          </span>
          <span className={styles.an}>{p.annee}</span>
          {p.enAvance ? <small className={styles.enAvance}>{m.fermee.enAvance}</small> : null}
        </li>
      ))}
    </ul>
  )
}
