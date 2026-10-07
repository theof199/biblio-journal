import styles from '../../pages/VoyageSacoche.module.css'

/**
 * Ce que reçoit la tête de la sacoche, par défaut ou du monde (`GabaritsDesPages.teteDeLaSacoche`) :
 * le pseudo du voyageur. Elle porte le titre de niveau 1 de la page ; le lien de retour reste à la
 * page, posé par-dessus.
 */
export interface PropsTeteDeLaSacoche {
  pseudo: string
}

/** La tête par défaut : « Le Voyage de … » au-dessus du titre de la page. */
export default function Tete({ pseudo }: PropsTeteDeLaSacoche) {
  return (
    <div className={styles.tete}>
      <span className={styles.sur}>{`Le Voyage de ${pseudo}`}</span>
      <h1 className={styles.titre}>La sacoche du voyageur</h1>
    </div>
  )
}
