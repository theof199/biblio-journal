import { forwardRef } from 'react'
import { IconDeviceRemote } from '@tabler/icons-react'
import type { Habillage } from '../habillages'
import styles from './Bouton.module.css'

interface Props {
  habillage: Habillage
  /** Le nom du chapitre, pour qui inspecte la page : l'apparence, elle, vient de `habillage.classe`. */
  chapitre: string
  /** Une invitation « vu à deux » attend : le point rouge. */
  invitation: boolean
  /** Le panneau est sorti. */
  ouvert: boolean
  onOuvrir: () => void
}

/**
 * Le bouton rond de la télécommande : il flotte en bas à droite, au-dessus de la barre d'onglets, sur
 * les deux espaces. La page ne lui réserve rien. Sur grand écran il reste au bord de la colonne de la
 * page, pas de la fenêtre.
 */
const Bouton = forwardRef<HTMLButtonElement, Props>(function Bouton({ habillage, chapitre, invitation, ouvert, onOuvrir }, ref) {
  return (
    <div className={`${styles.ancre} ${habillage.classe}`} data-chapitre={chapitre}>
      <div className={styles.colonne}>
        <button
          ref={ref}
          type="button"
          className={styles.bouton}
          aria-label="Télécommande"
          aria-describedby={invitation ? 'telecommande-invitation' : undefined}
          aria-haspopup="dialog"
          aria-expanded={ouvert}
          onClick={onOuvrir}
        >
          <IconDeviceRemote aria-hidden="true" className={styles.icone} />
          {/* Le point n'existe que lorsqu'une invitation attend. */}
          {invitation ? <span className={styles.point} data-piece="point" /> : null}
        </button>
        {invitation ? (
          <span id="telecommande-invitation" className="sr-only">
            Une invitation attend
          </span>
        ) : null}
      </div>
    </div>
  )
})

export default Bouton
