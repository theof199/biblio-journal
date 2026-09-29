import { useEffect, useRef } from 'react'

/**
 * Charge la suite quand la sentinelle entre dans l'écran — jumeau du `snapshotFlow` sur
 * `grille.layoutInfo` de `HomeScreen.kt`. `actif` doit valoir faux une fois la dernière page lue
 * (`hasNextPage` faux) : la sentinelle disparaît alors du DOM, aucun observateur ne reste posé, et
 * plus aucun appel ne part.
 */
export function useChargementInfini(onAtteint: () => void, actif: boolean) {
  const sentinelle = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!actif) return
    const element = sentinelle.current
    if (!element || typeof IntersectionObserver === 'undefined') return

    const observateur = new IntersectionObserver((entrees) => {
      if (entrees[0]?.isIntersecting) onAtteint()
    })
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [onAtteint, actif])

  return sentinelle
}
