import { useEffect, useRef } from 'react'
import { DUREE_DU_RETOUR } from '../retourDuVu'
import styles from './Panneau.module.css'

interface Props {
  /** Le message de l'espace, ou le neutre (`lireLeRetourDuVu`). */
  texte: string
  onAnnuler: () => void
  /** Le message s'en va : son temps est passé, ou l'on a touché ailleurs. */
  onPartir: () => void
}

/**
 * Le retour du « Vu » : il REMPLACE les touches de la rangée principale, dans la même rangée (à hauteur
 * fixe : rien ne saute), quelques secondes, avec « Annuler ». Toucher ailleurs le fait partir plus tôt.
 */
export default function MessageDuVu({ texte, onAnnuler, onPartir }: Props) {
  const boite = useRef<HTMLParagraphElement>(null)
  const partir = useRef(onPartir)
  partir.current = onPartir

  useEffect(() => {
    const minuterie = window.setTimeout(() => partir.current(), DUREE_DU_RETOUR)
    const ailleurs = (e: PointerEvent) => {
      if (e.target instanceof Node && boite.current?.contains(e.target)) return
      partir.current()
    }
    document.addEventListener('pointerdown', ailleurs)
    return () => {
      window.clearTimeout(minuterie)
      document.removeEventListener('pointerdown', ailleurs)
    }
  }, [])

  return (
    <p ref={boite} role="status" className={styles.message} data-piece="message">
      <span className={styles.texte}>{texte}</span>
      <button type="button" className={`${styles.touche} ${styles.deMessage}`} onClick={onAnnuler}>
        Annuler
      </button>
    </p>
  )
}
