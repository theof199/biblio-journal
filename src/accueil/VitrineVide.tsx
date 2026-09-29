import { IconPlus } from '@tabler/icons-react'
import styles from './VitrineVide.module.css'

/** Le journal est vide : une vitrine à remplir plutôt qu'une phrase seule (reprise de `VitrineVide.kt`). */
export default function VitrineVide({ onAjouter }: { onAjouter: () => void }) {
  return (
    <div className={styles.vitrine}>
      <button type="button" onClick={onAjouter} className={styles.cadre} aria-label="Ajouter un film">
        <IconPlus aria-hidden="true" className={styles.icone} />
      </button>
      <p className={styles.texte}>La vitrine attend sa première affiche.</p>
    </div>
  )
}
