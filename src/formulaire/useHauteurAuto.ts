import { useLayoutEffect, type RefObject } from 'react'

/**
 * Un champ de texte qui grandit avec ce qu'on y écrit : sa hauteur suit celle de son contenu, sans
 * barre de défilement dans le carnet. Remise à `auto` avant la mesure : sans cela, il ne
 * rétrécirait jamais quand on efface.
 */
export function useHauteurAuto(champ: RefObject<HTMLTextAreaElement>, valeur: string): void {
  useLayoutEffect(() => {
    const zone = champ.current
    if (!zone) return
    zone.style.height = 'auto'
    zone.style.height = `${zone.scrollHeight}px`
  }, [champ, valeur])
}
