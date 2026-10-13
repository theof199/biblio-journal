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
 * La seule ancre que la coque honore : la section « Au ciné » de l'accueil (`cinema/SectionAuCine.tsx`).
 * C'est l'exception au défilement « toujours celui du doigt » (`docs/identite.md`, « Le mouvement » ;
 * décision D6 du 13 octobre 2026) : l'ancienne adresse de l'onglet (`/au-cine`) mène à `/#au-cine`,
 * et la page s'ouvre sur la section au lieu de s'ouvrir en haut. Le « Retour » d'une fiche, lui,
 * recule dans l'historique et retrouve la place quittée ; il ne mène à `/#au-cine` que comme repli,
 * quand la fiche (d'un film, d'une séance) a été ouverte d'un lien, sans rien derrière elle.
 */
export const ANCRE_AU_CINE = 'au-cine'

/** Où poser la zone pour que `element` soit en haut : sa place dans le contenu, quel que soit le défilement. */
const hautDe = (zone: HTMLElement, element: Element) =>
  zone.scrollTop + element.getBoundingClientRect().top - zone.getBoundingClientRect().top

/**
 * Pose la zone sur l'élément `id`, d'un coup, sans animation, et l'y repose à chaque changement du
 * contenu : ce qui précède la section (le fronton, l'éventail, la bande du Voyage) arrive après elle
 * et la pousserait hors de vue. Comme `restaurer`, un geste du membre ou le délai y mettent fin. Rend
 * l'arrêt.
 */
export function sauter(zone: HTMLElement, id: string): () => void {
  const poser = () => {
    const element = document.getElementById(id)
    if (element) zone.scrollTop = hautDe(zone, element)
  }
  poser()

  const observateur = new MutationObserver(poser)
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
 *
 * Une seule arrivée ne part pas du haut : celle qui porte l'ancre `#au-cine` (`ANCRE_AU_CINE`), et
 * seulement quand l'entrée est neuve. Une entrée retrouvée garde la position qu'on lui a laissée.
 */
export function useDefilementMemorise(zone: RefObject<HTMLElement>, cle: string, ancre = '') {
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
    // La présence, pas la vérité : une entrée laissée tout en haut (`0`) est retrouvée, elle aussi.
    const cible = positions.current.get(cle)
    if (cible !== undefined) return restaurer(element, cible)
    if (ancre === `#${ANCRE_AU_CINE}`) return sauter(element, ANCRE_AU_CINE)
    element.scrollTop = 0
  }, [zone, cle, ancre])
}
