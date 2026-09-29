import styles from './Affiche.module.css'

interface Props {
  src: string | null
  titre: string
  /** La note posée sur ce visionnage — le repère « vu · note » des maquettes, en badge sur l'affiche. */
  note?: number | null
  taille?: 'grande' | 'ligne'
  /** Une largeur particulière (la fiche d'un visionnage) — remplace celle de `taille`. */
  className?: string
}

/** Une jaquette de film, éventuellement porteuse de sa note — grille du journal, lignes de recherche et d'« Ensuite ». */
export default function Affiche({ src, titre, note, taille = 'grande', className }: Props) {
  return (
    <div
      className={`${styles.cadre} ${className ?? (taille === 'ligne' ? styles.ligne : styles.grande)}`}
    >
      {src ? (
        <img src={src} alt={titre} className={styles.image} />
      ) : (
        <span className="sr-only">{titre}</span>
      )}
      {note != null ? (
        <span className={styles.note} aria-label={`Noté ${note} sur 10`}>
          {note}
        </span>
      ) : null}
    </div>
  )
}
