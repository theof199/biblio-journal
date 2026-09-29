import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Le temps laissé à une page pour retrouver sa hauteur au retour : une liste dont le cache a été
 * vidé recharge ses pages une à une (la sentinelle, au bas de la zone, réclame la suivante tant
 * que la position n'est pas atteinte).
 */
export const DELAI_RESTAURATION = 5000

/** Un geste du membre dans la zone : il a repris la main, la position ne lui est plus imposée. */
const GESTES = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/**
 * Pose `cible` dans la zone, et la repose à chaque changement de son contenu tant qu'elle n'est
 * pas atteinte : au retour, la page se rend d'abord avec ce que le cache lui donne, et la zone,
 * trop courte, ramène la position à son plus bas. Rend l'arrêt.
 */
export function restaurer(zone: HTMLElement, cible: number): () => void {
  const atteinte = () => {
    zone.scrollTop = cible
    return Math.abs(zone.scrollTop - cible) < 1
  }
  if (atteinte()) return () => {}

  const observateur = new MutationObserver(() => {
    if (atteinte()) arreter()
  })
  const arreter = () => {
    observateur.disconnect()
    window.clearTimeout(minuterie)
    for (const geste of GESTES) zone.removeEventListener(geste, arreter)
  }
  observateur.observe(zone, { childList: true, subtree: true, characterData: true })
  for (const geste of GESTES) zone.addEventListener(geste, arreter, { passive: true })
  const minuterie = window.setTimeout(arreter, DELAI_RESTAURATION)
  return arreter
}

/**
 * Le défilement de la zone de contenu de la coque, comme le navigateur le fait pour un document :
 * une navigation nouvelle (`PUSH`, `REPLACE`) part du haut ; un retour ou une avance dans
 * l'historique (`POP`) retrouve la position que cette entrée avait quand on l'a quittée, mémorisée
 * par sa clé (`location.key`, propre à chaque entrée : seul un `POP` en revoit une, une navigation
 * nouvelle en tire toujours une neuve). La zone est la même d'une page à l'autre : sans ce
 * crochet, la page ouverte hériterait de la position de la précédente.
 */
export function useDefilementMemorise(zone: RefObject<HTMLElement>, cle: string) {
  const positions = useRef(new Map<string, number>())
  const courante = useRef(cle)

  // Chaque défilement se note sous l'entrée affichée. `courante` change dans l'effet de mise en
  // page, avant que le navigateur ne livre l'événement d'un défilement causé par le changement de
  // page : la position de la page quittée n'est jamais écrasée par celle de la suivante.
  useEffect(() => {
    const element = zone.current
    if (!element) return
    const noter = () => positions.current.set(courante.current, element.scrollTop)
    element.addEventListener('scroll', noter, { passive: true })
    return () => element.removeEventListener('scroll', noter)
  }, [zone])

  // Avant la peinture : la page ne se montre jamais un instant à la position de la précédente.
  useLayoutEffect(() => {
    const element = zone.current
    if (!element) return
    courante.current = cle
    const cible = positions.current.get(cle)
    if (!cible) {
      element.scrollTop = 0
      return
    }
    return restaurer(element, cible)
  }, [zone, cle])
}
