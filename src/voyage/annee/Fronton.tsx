import type { ReactNode } from 'react'
import type { Monde } from '../../mondes/types'
import styles from './Fronton.module.css'

/** L'écriture du millésime (maquette 1890) : en cours, bouclée (`clos`), fermée (tracé, `vide`), en montage (`peint`). */
export type Millesime = 'encours' | 'bouclee' | 'fermee' | 'attente'

/**
 * Le fronton d'une fiche d'année (maquette 1890 : `.fronton`, `htmlAnnee` et `initVerrou`) :
 * l'annonce, le millésime, qui est le titre de la page (son nom est l'année seule), le monde, puis ce
 * que la forme y accroche (le ruban d'une année bouclée, la banderole d'une année en attente).
 */
export default function Fronton({ annee, annonce, millesime, monde, children }: { annee: number; annonce: string; millesime: Millesime; monde: Monde; children?: ReactNode }) {
  return (
    <div className={styles.fronton}>
      <p className={styles.annonce}>{annonce}</p>
      <h1 className={`${styles.millesime} ${styles[millesime]}`}>{annee}</h1>
      <p className={styles.monde}>{`${monde.nom} · ${monde.sous}`}</p>
      {children}
      <div className={styles.fleuron} aria-hidden="true">
        ❦
      </div>
    </div>
  )
}
