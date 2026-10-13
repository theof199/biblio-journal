import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DUREE_DU_RETOUR } from '../retourDuVu'
import styles from './Panneau.module.css'

interface Props {
  /** Le message de l'espace, ou le neutre (`lireLeRetourDuVu`) ; ou un avis (un lot noté, un échec). */
  texte: string
  /** « Annuler » : sans fonction, le message est seul (on ne défait pas un lot d'un geste, ni un échec). */
  onAnnuler?: () => void
  /** Un échec : il s'annonce tout de suite (`alert`), là où un retour attend son tour (`status`). */
  alerte?: boolean
  /** Le message s'en va : son temps est passé, ou l'on a touché ailleurs. */
  onPartir: () => void
}

/** Le temps laissé à la région vivante pour exister, vide, avant que son texte n'y entre. */
export const DELAI_D_ANNONCE = 100

/** Le focus n'est nulle part : la touche qui le portait vient de quitter la page. */
const focusPerdu = () => document.activeElement === null || document.activeElement === document.body

/**
 * Le retour du « Vu » : il REMPLACE les touches de la rangée principale, dans la même rangée (à hauteur
 * fixe : rien ne saute), quelques secondes, avec « Annuler ». Toucher ailleurs le fait partir plus tôt.
 * Un avis (« 7 épisodes notés », le message d'un échec) prend la même place, sans « Annuler ».
 *
 * **Il s'annonce** : la région vivante est montée sans son texte, qui y entre un instant après
 * (`DELAI_D_ANNONCE` : un lecteur d'écran ne dit pas une région qui arrive déjà remplie). Ce qui se voit
 * n'attend pas : le texte affiché est là d'emblée, caché aux lecteurs d'écran, qui lisent l'autre.
 *
 * **Le focus suit** : la touche pressée (« Vu ») a quitté la page, le focus avec elle ; il se pose sur
 * « Annuler » (sur le message lui-même s'il est seul : l'échec qui remplace « Épisode noté » garde la
 * place), et au départ du message il revient à la touche principale de la rangée (à défaut, à sa
 * première touche allumée). Jamais contre l'utilisateur : rien ne bouge si le focus est ailleurs.
 */
export default function MessageDuVu({ texte, onAnnuler, alerte = false, onPartir }: Props) {
  const boite = useRef<HTMLParagraphElement>(null)
  const annuler = useRef<HTMLButtonElement>(null)
  const partir = useRef(onPartir)
  partir.current = onPartir
  const [dit, setDit] = useState('')

  useEffect(() => {
    const minuterie = window.setTimeout(() => setDit(texte), DELAI_D_ANNONCE)
    return () => window.clearTimeout(minuterie)
  }, [texte])

  useEffect(() => {
    if (focusPerdu()) (annuler.current ?? boite.current)?.focus()
    const minuterie = window.setTimeout(() => partir.current(), DUREE_DU_RETOUR)
    const ailleurs = (e: PointerEvent) => {
      if (e.target instanceof Node && boite.current?.contains(e.target)) return
      partir.current()
    }
    document.addEventListener('pointerdown', ailleurs)
    return () => {
      window.clearTimeout(minuterie)
      document.removeEventListener('pointerdown', ailleurs)
    }
  }, [])

  // Au départ, lu avant que le message ne quitte la page : s'il tient le focus, la rangée le reprend, une
  // fois ses touches revenues.
  useLayoutEffect(() => {
    const message = boite.current
    return () => {
      const rangee = message?.parentElement
      if (!message || !rangee || !message.contains(document.activeElement)) return
      queueMicrotask(() => {
        if (!focusPerdu()) return
        const touche = rangee.querySelector<HTMLElement>('[data-piece="touche-principale"]:not([disabled])') ?? rangee.querySelector<HTMLElement>('button:not([disabled])')
        touche?.focus()
      })
    }
  }, [])

  return (
    <p ref={boite} tabIndex={-1} role={alerte ? 'alert' : 'status'} className={onAnnuler ? styles.message : `${styles.message} ${styles.seul}`} data-piece="message">
      <span className={styles.texte} aria-hidden="true">
        {texte}
      </span>
      <span className="sr-only" data-piece="annonce">
        {dit}
      </span>
      {onAnnuler ? (
        <button ref={annuler} type="button" className={`${styles.touche} ${styles.deMessage}`} onClick={onAnnuler}>
          Annuler
        </button>
      ) : null}
    </p>
  )
}
