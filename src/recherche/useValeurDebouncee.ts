import { useEffect, useState } from 'react'

/**
 * Une frappe, 300 ms de silence, la valeur repart : jumeau du `debounce(300)` de
 * `SearchViewModel.kt`. Chaque nouvelle frappe repousse le délai, sans lancer la requête
 * intermédiaire — c'est ce qui garantit une seule requête par pause de saisie.
 */
export function useValeurDebouncee<T>(valeur: T, delai = 300): T {
  const [debouncee, setDebouncee] = useState(valeur)

  useEffect(() => {
    const minuteur = window.setTimeout(() => setDebouncee(valeur), delai)
    return () => window.clearTimeout(minuteur)
  }, [valeur, delai])

  return debouncee
}
