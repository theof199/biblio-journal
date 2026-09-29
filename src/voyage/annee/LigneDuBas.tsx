import { useState } from 'react'
import type { Monde } from '../../mondes/types'
import { formatDateVisionnage, jourLocal } from '../../ui/format'
import type { LigneDuBas as Ligne } from '../annee'
import styles from './LigneDuBas.module.css'

interface Props {
  monde: Monde
  annee: number
  ligne: Ligne
  onUtiliser: (annee: number) => void
  /** L'encaissement est parti : le bouton ne se retouche pas. */
  occupe: boolean
  /** Le refus de l'API, tel qu'elle l'a écrit. */
  erreur: string | null
}

/**
 * Le bas de la fiche prête (`ligneDuBas`) : le ticket qui attend et « Utiliser » ; le billet déjà
 * utilisé, qui se retourne (maquette 1890 : `.grand-billet`, lignes 235 à 247) ; ou le verdict du
 * jury qui juge l'année pas encore mûre (maquette : `.jury`, lignes 201 à 203).
 */
export default function LigneDuBas({ monde, annee, ligne, onUtiliser, occupe, erreur }: Props) {
  const [retourne, setRetourne] = useState(false)
  if (!ligne) return null

  if (ligne.type === 'ticket') {
    return (
      <section className={styles.ticket} aria-label="Ton ticket">
        <p>{`Ton ticket pour ${ligne.annee} t’attend`}</p>
        <button type="button" className={styles.utiliser} disabled={occupe} onClick={() => onUtiliser(ligne.annee)}>
          Utiliser
        </button>
        {erreur ? (
          <p role="alert" className={styles.erreur}>
            {erreur}
          </p>
        ) : null}
      </section>
    )
  }

  if (ligne.type === 'billet') {
    const le = formatDateVisionnage(jourLocal(new Date(ligne.utiliseLe)))
    return (
      <button
        type="button"
        className={`${styles.grandBillet} ${retourne ? styles.retourne : ''}`}
        aria-pressed={retourne}
        onClick={() => setRetourne((r) => !r)}
      >
        <span className={`${styles.face} ${styles.recto}`} aria-hidden={retourne}>
          <span className={styles.corps}>
            <small>Bon pour une année</small>
            <b>{` ${ligne.annee} `}</b>
            <span>{`utilisé le ${le}`}</span>
          </span>
          <span className={styles.talon} aria-hidden="true">
            ENTRÉE
          </span>
        </span>
        <span className={`${styles.face} ${styles.dos}`} aria-hidden={!retourne}>
          {`Valable pour une année entière du Voyage, salles et séances comprises. Gagné en ${annee}, poinçonné à l’entrée de ${ligne.annee}. Ni repris ni échangé.`}
        </span>
      </button>
    )
  }

  return (
    <section className={styles.jury} aria-label={monde.pages.mots.jury}>
      <span className={styles.cachet} aria-hidden="true">
        J
      </span>
      <b>{monde.pages.mots.jury}</b>
      {`Pas encore mûre : ${ligne.motif}`}
    </section>
  )
}
