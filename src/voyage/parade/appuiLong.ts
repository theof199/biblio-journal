import { useEffect, useRef } from 'react'
import { APPUI_LONG_MS } from '../../carte/geste'

/**
 * L'appui long d'une marche du podium : tenu `APPUI_LONG_MS`, il appelle `onLong`, une fois, et le
 * relâcher qui suit n'est pas un toucher. Inactif (une marche vide), il n'arme rien. Les écouteurs se
 * posent sur ce qu'on tient ; `aEteLong()` se lit dans `onClick`, qui s'abstient alors.
 */
export function useAppuiLong(actif: boolean, onLong: () => void) {
  const minuteur = useRef<number | undefined>(undefined)
  const long = useRef(false)
  const lacher = () => {
    window.clearTimeout(minuteur.current)
    minuteur.current = undefined
  }
  useEffect(() => lacher, [])
  return {
    ecouteurs: {
      onPointerDown: () => {
        long.current = false
        lacher()
        if (!actif) return
        minuteur.current = window.setTimeout(() => {
          minuteur.current = undefined
          long.current = true
          onLong()
        }, APPUI_LONG_MS)
      },
      onPointerUp: lacher,
      onPointerLeave: lacher,
      onPointerCancel: lacher,
      // Une touche n'est jamais le relâcher d'un appui long : le clavier (le chemin qui remplace
      // l'appui long, par le feuillet et « Retirer ») ne se fait pas avaler son premier geste.
      onKeyDown: () => void (long.current = false),
      // L'appui long ne doit ouvrir ni le menu du navigateur, ni rien au relâcher.
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
    /** Vrai une fois après un appui long : le `click` du relâcher le consomme et ne fait rien d'autre. */
    aEteLong: () => {
      if (!long.current) return false
      long.current = false
      return true
    },
  }
}
