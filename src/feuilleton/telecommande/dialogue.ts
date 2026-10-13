import { useEffect, useRef, type RefObject } from 'react'

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Ce que le panneau doit à un dialogue : il prend le focus à l'ouverture, et le reprend à chaque
 * changement de `vue` (la touche qu'on vient de presser n'existe plus) ; Tab et Maj+Tab tournent
 * dedans, et y ramènent un focus parti ailleurs (la barre d'onglets reste touchable, pas le reste) ;
 * Échap ferme ; à la fermeture le focus va à `retour` (le bouton rond), s'il est encore là.
 * Écrit pour le Feuilleton : il ne doit rien au Voyage.
 */
export function useDialogue<T extends HTMLElement>(onFermer: () => void, retour: RefObject<HTMLElement>, vue: string) {
  const boite = useRef<T>(null)
  const fermer = useRef(onFermer)
  fermer.current = onFermer

  useEffect(() => {
    boite.current?.focus()
  }, [vue])

  useEffect(() => {
    const element = boite.current
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        fermer.current()
        return
      }
      if (e.key !== 'Tab' || !element) return
      const cibles = [...element.querySelectorAll<HTMLElement>(FOCALISABLES)]
      const premiere = cibles[0]
      const derniere = cibles[cibles.length - 1]
      if (!premiere || !derniere) {
        e.preventDefault()
        element.focus()
        return
      }
      const actif = document.activeElement
      const dehors = !element.contains(actif) || actif === element
      if (e.shiftKey ? dehors || actif === premiere : dehors || actif === derniere) {
        e.preventDefault()
        ;(e.shiftKey ? derniere : premiere).focus()
      }
    }
    document.addEventListener('keydown', touche)
    const cible = retour
    return () => {
      document.removeEventListener('keydown', touche)
      if (cible.current?.isConnected) cible.current.focus()
    }
  }, [retour])

  return boite
}
