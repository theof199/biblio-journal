import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../../api/client'
import type { Monde } from '../../mondes/types'
import { useMouvementReduit } from '../../ui/mouvement'
import { aLaLachee, angleDuBras, peutTirer, tirage } from '../manivelle'
import styles from './Manivelle.module.css'

/** La course tenue pendant que la bobine se recharge, la manivelle en vue (maquette : `dy = 80`). */
export const TENUE = 80
/** Le temps où « la bobine est rechargée » reste à l'écran. */
export const DUREE_DU_FAIT = 4000
/**
 * Un `click` qui suit de si près (en ms) le lâcher d'un tirage vient du doigt qui a tiré, pas d'un
 * toucher : il n'ouvre rien (un lien, une année, une salle sous le doigt).
 */
export const APRES_TIRAGE = 500

/** Une saisie : le clavier ouvert, un geste vers le bas déplace le texte, il ne recharge rien. */
const SAISIE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

const PANNE = 'La bobine n’a pas pu se recharger. Réessaie.'

type Etat = { type: 'repos' } | { type: 'charge'; tiree: boolean } | { type: 'fait' } | { type: 'erreur'; message: string }

interface Props {
  /** Le monde de l'année : ses mots (`pages.mots.manivelle`). */
  monde: Monde
  /** Relit ce que la page montre ; rejeter dit le refus. */
  onRecharger: () => Promise<unknown>
  children: ReactNode
}

/**
 * Tirer pour rafraîchir (idée 6 ; maquette 1890, écran I, `initAnnee`) : en haut de la page, le
 * contenu suit le doigt, la manivelle du projecteur tourne avec le geste ; lâché au-delà du seuil,
 * la bobine se recharge. « Recharger la bobine », en bas, pour qui ne tire pas (clavier, lecteur
 * d'écran). Au calme, rien ne bouge ni ne tourne, et le seuil franchi recharge quand même.
 *
 * Les écouteurs sont natifs, non passifs : React pose `touchmove` en passif, son `preventDefault`
 * serait ignoré et la page défilerait sous le doigt. Aucun tirage sous un calque ouvert (la feuille
 * du chroniqueur, un feuillet et son voile sont montés dans la page), ni pendant une saisie, ni
 * ailleurs qu'en haut de la zone qui défile (le `<main>` de la coque), ni pendant un rechargement.
 */
export default function Manivelle({ monde, onRecharger, children }: Props) {
  const m = monde.pages.mots.manivelle
  const calme = useMouvementReduit()
  const racine = useRef<HTMLDivElement>(null)
  const [course, setCourse] = useState(0)
  const [doigt, setDoigt] = useState(false)
  const [etat, setEtat] = useState<Etat>({ type: 'repos' })

  // `etat` ne se voit qu'au rendu suivant : deux gestes rapprochés rechargeraient deux fois.
  const enCours = useRef(false)
  const recharger = async (tiree: boolean) => {
    if (enCours.current) return
    enCours.current = true
    setEtat({ type: 'charge', tiree })
    try {
      await onRecharger()
      setEtat({ type: 'fait' })
    } catch (e) {
      setEtat({ type: 'erreur', message: e instanceof ApiError ? e.message : PANNE })
    } finally {
      enCours.current = false
    }
  }
  // Les écouteurs se posent une fois : ils lisent le rechargement du dernier rendu.
  const rechargerAuLacher = useRef(recharger)
  rechargerAuLacher.current = recharger

  useEffect(() => {
    if (etat.type !== 'fait') return
    const minuterie = window.setTimeout(() => setEtat({ type: 'repos' }), DUREE_DU_FAIT)
    return () => window.clearTimeout(minuterie)
  }, [etat])

  useEffect(() => {
    const el = racine.current
    if (!el) return
    const zone = () => el.closest('main') ?? document.scrollingElement
    let depart: number | null = null
    let dy = 0
    let finDuTirage = -Infinity

    const abandonner = () => {
      depart = null
      dy = 0
      setDoigt(false)
      setCourse(0)
    }
    const debut = (e: TouchEvent) => {
      depart = null
      finDuTirage = -Infinity
      if (el.querySelector('[role="dialog"]')) return
      const cible = e.target instanceof Element ? e.target : null
      if (cible?.closest(SAISIE) || document.activeElement?.matches(SAISIE)) return
      if (!peutTirer(zone()?.scrollTop ?? 0, enCours.current)) return
      const t = e.touches[0]
      if (!t) return
      depart = t.clientY
      dy = 0
      setDoigt(true)
    }
    const bouge = (e: TouchEvent) => {
      if (depart === null) return
      const t = e.touches[0]
      if (!t) return
      // Le doigt est remonté, la page a défilé : ce n'est plus un tirage.
      if ((zone()?.scrollTop ?? 0) > 0) return abandonner()
      const ecart = t.clientY - depart
      if (ecart <= 0) {
        dy = 0
        setCourse(0)
        return
      }
      if (e.cancelable) e.preventDefault()
      dy = tirage(ecart)
      setCourse(dy)
    }
    const fin = (e: TouchEvent) => {
      if (depart === null) return
      const lache = dy
      abandonner()
      if (lache <= 0) return
      // Le doigt qui a tiré ne touche rien en se levant : ni le `click` que le navigateur
      // donnerait, ni celui qui arriverait quand même (`avaler`).
      if (e.cancelable) e.preventDefault()
      finDuTirage = e.timeStamp
      if (aLaLachee(lache) === 'recharger') void rechargerAuLacher.current(true)
    }
    const annule = () => {
      // Le navigateur a repris le geste : rien ne se recharge, le contenu revient.
      if (depart !== null) abandonner()
    }
    const avaler = (e: MouseEvent) => {
      if (e.timeStamp - finDuTirage > APRES_TIRAGE) return
      finDuTirage = -Infinity
      e.preventDefault()
      e.stopPropagation()
    }

    el.addEventListener('touchstart', debut, { passive: false })
    el.addEventListener('touchmove', bouge, { passive: false })
    el.addEventListener('touchend', fin, { passive: false })
    el.addEventListener('touchcancel', annule)
    el.addEventListener('click', avaler, true)
    return () => {
      el.removeEventListener('touchstart', debut)
      el.removeEventListener('touchmove', bouge)
      el.removeEventListener('touchend', fin)
      el.removeEventListener('touchcancel', annule)
      el.removeEventListener('click', avaler, true)
    }
  }, [])

  const charge = etat.type === 'charge'
  // Au calme, le contenu ne suit pas le doigt et ne descend pas pendant le rechargement.
  const decalage = calme ? 0 : charge && etat.tiree ? TENUE : course
  const texte = charge ? m.charge : aLaLachee(course) === 'recharger' ? m.relacher : m.tirer
  const statut = etat.type === 'charge' ? m.charge : etat.type === 'fait' ? m.fait : etat.type === 'erreur' ? etat.message : ''

  return (
    <div ref={racine} className={styles.manivelle}>
      <div className={`${styles.tirer} ${charge && !calme ? styles.tourne : ''}`} aria-hidden="true" data-testid="manivelle">
        <svg viewBox="0 0 54 54">
          <circle cx="27" cy="27" r="21" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="27" cy="27" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
          <g className={styles.bras} style={charge || calme ? undefined : { transform: `rotate(${angleDuBras(course)}deg)` }}>
            <path d="M27 27V8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <circle cx="27" cy="7" r="4.5" fill="currentColor" />
          </g>
          <circle cx="27" cy="27" r="4" fill="currentColor" />
        </svg>
        <span>{texte}</span>
      </div>
      {/* Sans transformation au repos : elle ferait du contenu le repère des calques fixes qu'il porte. */}
      <div
        className={`${styles.contenu} ${doigt || calme ? '' : styles.revient}`}
        style={decalage ? { transform: `translateY(${decalage}px)` } : undefined}
        data-testid="contenu-manivelle"
      >
        {children}
        <button type="button" className={styles.recharger} disabled={charge} onClick={() => void recharger(false)}>
          {m.bouton}
        </button>
      </div>
      {/* Présente dès le montage, vide : une région d'état ne se lit qu'à son changement. */}
      <p role="status" className={styles.statut}>
        {statut ? <span className={styles.bulle}>{statut}</span> : null}
      </p>
    </div>
  )
}
