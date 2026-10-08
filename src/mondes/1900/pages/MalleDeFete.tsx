import type { ReactNode } from 'react'
import { MOTS_DES_FETES } from './fetes'
import styles from './Fetes.module.css'

/**
 * La malle des fêtes (maquette, écran 13 : `.malle`) : le cuir, ses sangles, ses quatre coins de
 * laiton, la liste de ce qui y est collé, la tache de colle et le pinceau qui la passe. Elle sert à
 * l'étiquette de la récompense (`EtiquetteDeMalle.tsx`) comme à celle d'un badge
 * (`BadgeColleSurLaMalle.tsx`) : ce qui s'y colle est à qui la monte. Au calme, pas de pinceau.
 */
export default function MalleDeFete({ calme, children }: { calme: boolean; children: ReactNode }) {
  return (
    <div className={styles.malle}>
      <i className={styles.coin} aria-hidden="true" />
      <i className={styles.coin} aria-hidden="true" />
      <i className={styles.coin} aria-hidden="true" />
      <i className={styles.coin} aria-hidden="true" />
      <ul aria-label={MOTS_DES_FETES.malle}>{children}</ul>
      <i className={styles.colle} aria-hidden="true" />
      {calme ? null : <i className={styles.pinceau} aria-hidden="true" />}
    </div>
  )
}
