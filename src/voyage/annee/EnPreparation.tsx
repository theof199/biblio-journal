import type { Monde } from '../../mondes/types'
import styles from '../../pages/VoyageAnnee.module.css'
import Toile, { LARGEUR_LOGIQUE } from '../Toile'

/** Ce que l'attente annonce tant que la fiche s'écrit. */
export const ECRIT = 'Le chroniqueur écrit…'
/** Ce que la page dit quand le chroniqueur n'a pas rendu la fiche dans les délais. */
export const SANS_REPONSE = 'Le chroniqueur n’a pas répondu, reviens plus tard.'

/** Ce que la page passe au corps d'une année en préparation ; un gabarit de monde reçoit les mêmes (`GabaritsDesPages`). */
export interface PropsAnneeEnPreparation {
  monde: Monde
  /** La page a cessé de relire la fiche (`useFiche`) : l'attente laisse la place à « Réessayer ». */
  abandon: boolean
  onReessayer: () => void
}

/**
 * Le corps d'une année que le chroniqueur écrit encore, sous son fronton (que la page garde) : l'estrade
 * du monde, où il tape, puis l'attente, ou l'abandon et son bouton. La relecture de la fiche et son
 * abandon restent à la page (`useFiche`).
 */
export default function EnPreparation({ monde, abandon, onReessayer }: PropsAnneeEnPreparation) {
  const { hauteurs, dessinerEstrade } = monde.pages
  return (
    <>
      <Toile
        hauteur={hauteurs.estrade}
        libelle="Le chroniqueur sur son estrade."
        dessiner={(ctx, t, vivant) => dessinerEstrade({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.estrade, t, vivant, parle: abandon ? 'non' : 'tape' })}
      />
      {abandon ? (
        <div role="alert" className={styles.etat}>
          <p>{SANS_REPONSE}</p>
          <button type="button" className={styles.bouton} onClick={onReessayer}>
            Réessayer
          </button>
        </div>
      ) : (
        <p role="status" aria-label={ECRIT} className={styles.etat}>
          {ECRIT}
        </p>
      )}
    </>
  )
}
