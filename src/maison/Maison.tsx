import styles from './Maison.module.css'

/**
 * L'espace « Maison » du Feuilleton, en construction : la page vide que le socle pose, dans son
 * morceau à elle (`App.tsx`, `paresseux`). Tout ce qui s'y construira vit dans ce dossier, sans rien
 * devoir à le Studio (`src/studio/`).
 */
export default function Maison() {
  return (
    <div className={styles.page}>
      <h1 className={styles.titre}>Maison</h1>
      <p className={styles.chantier}>En construction.</p>
    </div>
  )
}
