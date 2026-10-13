import styles from './Studio.module.css'

/**
 * L'espace « Travail » du Feuilleton, en construction : la page vide que le socle pose, dans son
 * morceau à elle (`App.tsx`, `paresseux`). Tout ce qui s'y construira vit dans ce dossier, sans rien
 * devoir à la Maison (`src/maison/`).
 */
export default function Studio() {
  return (
    <div className={styles.page}>
      <h1 className={styles.titre}>Travail</h1>
      <p className={styles.chantier}>En construction.</p>
    </div>
  )
}
