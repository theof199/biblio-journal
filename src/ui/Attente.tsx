import type { ReactNode } from 'react'
import styles from './Attente.module.css'

interface Props {
  /** Ce que dit un lecteur d'écran pendant l'attente. */
  libelle?: string
  /** Une petite attente dans une carte dont le texte dit déjà ce qui manque : ni rôle ni libellé, rien que le dessin. */
  muet?: boolean
  className?: string
  /** Les formes vides, dans la mise en page de la page qui attend : elles ne sont qu'un décor. */
  children: ReactNode
}

/**
 * Une page qui attend ses données montre ses objets laissés en blanc, qui respirent ensemble. Un seul
 * `role="status"` par zone d'attente : le dessin est caché aux lecteurs d'écran, qui n'entendent que le libellé.
 */
export default function Attente({ libelle = 'Chargement…', muet = false, className, children }: Props) {
  const classes = `${styles.attente} ${className ?? ''}`.trim()
  if (muet) {
    return (
      <div className={classes} aria-hidden="true">
        {children}
      </div>
    )
  }
  return (
    <div role="status" className={className}>
      <span className="sr-only">{libelle}</span>
      <div className={styles.attente} aria-hidden="true">
        {children}
      </div>
    </div>
  )
}

interface PropsBarre {
  largeur: 'longue' | 'moyenne' | 'courte'
}

/** Une ligne de texte laissée en blanc, de l'encre de ce qui la porte (page, papier, pellicule), jour et nuit. */
export function Barre({ largeur }: PropsBarre) {
  return <div className={`${styles.barre} ${styles[largeur]}`} />
}
