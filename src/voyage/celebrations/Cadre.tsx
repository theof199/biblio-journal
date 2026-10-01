import type { KeyboardEvent, ReactNode } from 'react'
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
 * Le cadre d'une scène : un dialogue nommé, qui prend lui-même le focus (les boutons de l'année
 * bouclée n'arrivent qu'au bout de la scène), qu'Échap ferme, et qu'un toucher n'importe où fait
 * avancer. Le focus ne sort pas du calque : Tab tourne entre ses boutons, et reste sur le dialogue
 * tant qu'il n'en a pas, au lieu de passer à la page couverte. Le bouton « Continuer » n'a pas de
 * geste à lui : son `click` remonte à la scène, comme celui du reste de l'écran.
 */
export default function Cadre({ nom, onToucher, onEchap, children, pied }: Props) {
  const dialogue = useDialogue<HTMLDivElement>(onEchap)
  const tourner = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const boutons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    e.preventDefault()
    if (boutons.length === 0) return
    const ici = boutons.indexOf(document.activeElement as HTMLButtonElement)
    // Depuis le dialogue lui-même (`ici` vaut -1) : le premier bouton, ou le dernier à rebours.
    const suivant = e.shiftKey ? (ici <= 0 ? boutons.length - 1 : ici - 1) : (ici + 1) % boutons.length
    boutons[suivant]!.focus()
  }
  return (
    <div ref={dialogue} className={styles.colonne} role="dialog" aria-modal="true" aria-label={nom} tabIndex={-1} onClick={onToucher} onKeyDown={tourner}>
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
