import { useSyncExternalStore } from 'react'

const REQUETE = '(prefers-reduced-motion: reduce)'

/** `matchMedia` manque à jsdom, et `addEventListener('change')` à Safari avant 14 : les deux se rattrapent. */
function abonner(rappel: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const mq = window.matchMedia(REQUETE)
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', rappel)
    return () => mq.removeEventListener('change', rappel)
  }
  mq.addListener(rappel)
  return () => mq.removeListener(rappel)
}

export const mouvementReduit = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(REQUETE).matches

/** Vrai quand le visiteur demande moins d'animations ; suit le réglage s'il change en cours de route. */
export function useMouvementReduit(): boolean {
  return useSyncExternalStore(abonner, mouvementReduit, () => false)
}
