import type { ReactNode } from 'react'
import { useDialogue } from '../dialogue'
import styles from './Celebrations.module.css'

interface Props {
  /** Le nom du dialogue, pour qui ne voit pas la scène : « La salle … est complète ». */
  nom: string
  /** Un toucher n'importe où sur la scène. */
  onToucher: () => void
  /** Échap : ce que ferait le geste le plus sage de la scène. */
  onEchap: () => void
  children: ReactNode
  /** Les boutons de la scène ; sans eux, « Continuer », que le toucher de la scène suffit à jouer. */
  pied?: ReactNode
}

/**
 * Le cadre d'une scène : un dialogue nommé, dont le premier bouton prend le focus, qu'Échap ferme,
 * et qu'un toucher n'importe où fait avancer. Le bouton « Continuer » n'a pas de geste à lui : son
 * `click` remonte à la scène, comme celui du reste de l'écran.
 */
export default function Cadre({ nom, onToucher, onEchap, children, pied }: Props) {
  const premier = useDialogue<HTMLDivElement>(onEchap)
  return (
    <div ref={premier} className={styles.colonne} role="dialog" aria-modal="true" aria-label={nom} tabIndex={-1} onClick={onToucher}>
      {children}
      <div className={styles.pied}>
        {pied ?? (
          <button type="button" className={styles.bouton}>
            Continuer
          </button>
        )}
      </div>
    </div>
  )
}
