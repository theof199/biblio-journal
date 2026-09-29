import styles from './Page.module.css'

interface Props {
  titre: string
  texte: string
}

/** Une page d'onglet pas encore construite : son titre, et ce qui l'attend. */
export default function PageAttente({ titre, texte }: Props) {
  return (
    <div className={styles.page}>
      <h1 className={styles.titre}>{titre}</h1>
      <p className={styles.texte}>{texte}</p>
    </div>
  )
}
