import { useEffect, useRef } from 'react'

/** Les dialogues montés, du plus ancien au plus récent : Échap ne revient qu'au dernier. */
const ouverts: object[] = []

/**
 * Ce qu'un calque du Voyage doit à un dialogue (la feuille du chroniqueur, un feuillet) : l'élément
 * qui porte la référence rendue (son bouton « Fermer ») prend le focus à l'ouverture ; à la
 * fermeture, le focus revient à l'élément qui l'avait (« Lire l’ouverture », une marche…) ; Échap
 * ferme, où que soit le focus (un toucher sur le papier le rend au document), mais seulement le
 * dernier calque ouvert : deux calques à la fois (une adresse qui porte `feuille` et `marche`) ne se
 * ferment pas d'un seul Échap, qui reculerait deux fois dans l'historique.
 */
export function useDialogue<T extends HTMLElement>(onFermer: () => void) {
  const premier = useRef<T>(null)
  const fermer = useRef(onFermer)
  fermer.current = onFermer

  useEffect(() => {
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null
    premier.current?.focus()
    const moi = {}
    ouverts.push(moi)
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || ouverts[ouverts.length - 1] !== moi) return
      e.preventDefault()
      fermer.current()
    }
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('keydown', touche)
      ouverts.splice(ouverts.indexOf(moi), 1)
      if (avant?.isConnected) avant.focus()
    }
  }, [])

  return premier
}
