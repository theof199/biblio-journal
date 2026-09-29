import { useEffect, useRef } from 'react'

/**
 * Ce qu'un calque du Voyage doit à un dialogue (la feuille du chroniqueur, un feuillet) : l'élément
 * qui porte la référence rendue (son bouton « Fermer ») prend le focus à l'ouverture ; à la
 * fermeture, le focus revient à l'élément qui l'avait (« Lire l’ouverture », une marche…) ; Échap
 * ferme, où que soit le focus (un toucher sur le papier le rend au document).
 */
export function useDialogue<T extends HTMLElement>(onFermer: () => void) {
  const premier = useRef<T>(null)
  const fermer = useRef(onFermer)
  fermer.current = onFermer

  useEffect(() => {
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null
    premier.current?.focus()
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      fermer.current()
    }
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('keydown', touche)
      if (avant?.isConnected) avant.focus()
    }
  }, [])

  return premier
}
