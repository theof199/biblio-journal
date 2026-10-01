import { useId } from 'react'
import type { ReactNode } from 'react'
import styles from './Section.module.css'

/** Une section du profil : son étiquette peinte en capitales avec sa règle, puis l'objet qu'elle porte. */
export default function Section({ titre, children }: { titre: string; children: ReactNode }) {
  const titreId = useId()
  return (
    <section aria-labelledby={titreId} className={styles.section}>
      <h2 id={titreId} className={styles.libelle}>
        <span>{titre}</span>
        <span className={styles.regle} aria-hidden="true" />
      </h2>
      {children}
    </section>
  )
}
