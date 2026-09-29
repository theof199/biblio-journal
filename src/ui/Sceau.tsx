import type { TablerIcon } from '@tabler/icons-react'
import styles from './Sceau.module.css'

/**
 * Le sceau rond posé sur une affiche ou un portrait (reprise de `SceauOr`, Android) : une icône
 * sur la pastille d'accent, nommée pour qui ne la voit pas. Le parent le place (`className`) ; un
 * sceau se lit toujours par son `libelle` (« Rétrospective complète », « Saga suivie »…).
 */
export default function Sceau({ icone: Icone, libelle, className }: { icone: TablerIcon; libelle: string; className?: string }) {
  return (
    <span role="img" aria-label={libelle} className={`${styles.sceau} ${className ?? ''}`}>
      <Icone aria-hidden="true" className={styles.icone} />
    </span>
  )
}
