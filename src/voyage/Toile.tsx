import { createContext, useContext, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { useMouvementReduit } from '../ui/mouvement'
import styles from './Toile.module.css'

/** La largeur de la maquette : un monde dessine ses pages dans 390 unités, la toile les met à l'échelle. */
export const LARGEUR_LOGIQUE = 390

/** Le dessin d'une toile : `t` en secondes depuis son ouverture ; `vivant` faux quand le visiteur demande moins d'animations. */
export type Dessin = (ctx: CanvasRenderingContext2D, t: number, vivant: boolean) => void

/** jsdom n'a pas de canvas : les tests passent ici un contexte factice (`test/contexteFactice.ts`). */
export const FabriqueContexteToile = createContext<(canvas: HTMLCanvasElement) => CanvasRenderingContext2D | null>((canvas) =>
  canvas.getContext('2d'),
)

interface Props {
  /** La hauteur, en unités logiques (celles du monde : `pages.hauteurs`). */
  hauteur: number
  dessiner: Dessin
  libelle: string
  /**
   * Le premier contact (`pointerdown`), en unités logiques de la toile (390 de large, `hauteur` de
   * haut) : de quoi relancer une animation (le carrosse, le train, le manège qui s'emballe). Jamais
   * de quoi naviguer : un défilement de la page commence aussi par là.
   */
  onToucher?: (p: { x: number; y: number }) => void
  /**
   * Un toucher achevé, sans défilement (le `click`, que le navigateur ne donne pas après avoir pris
   * le geste pour défiler), dans les mêmes unités : de quoi ouvrir ce qui est sous le doigt (un
   * cheval du manège). Le jumeau du toucher bref de la carte (`carte/geste.ts`).
   */
  onChoisir?: (p: { x: number; y: number }) => void
  className?: string
}

/** Un point de l'écran en unités logiques de la toile, depuis son coin. */
function enUnites(e: ReactMouseEvent<HTMLCanvasElement>, hauteur: number): { x: number; y: number } {
  // Sans mise en page (jsdom), la toile mesure zéro : les coordonnées restent celles du toucher.
  const r = e.currentTarget.getBoundingClientRect()
  const sx = r.width > 0 ? LARGEUR_LOGIQUE / r.width : 1
  const sy = r.height > 0 ? hauteur / r.height : 1
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
}

/**
 * Une toile d'une page du Voyage (bandeau, scène, estrade, monument, guichet) : une boucle `requestAnimationFrame` à
 * elle, coupée hors de l'écran quand le navigateur sait le dire (`IntersectionObserver`), et une
 * seule image, immobile, quand le visiteur demande moins d'animations — repeinte à chaque rendu,
 * pour qu'un changement de données se voie. Le repère est mis à l'échelle de la largeur réelle :
 * le monde dessine en 390 unités ; la densité de l'écran est bornée à 2.
 */
export default function Toile({ hauteur, dessiner, libelle, onToucher, onChoisir, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const calme = useMouvementReduit()
  const fabrique = useContext(FabriqueContexteToile)
  const dessin = useRef(dessiner)
  dessin.current = dessiner
  const peindre = useRef<((t: number, vivant: boolean) => void) | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = fabrique(canvas)
    if (!ctx) return
    const densite = Math.min(2, window.devicePixelRatio || 1)
    const largeur = canvas.clientWidth || LARGEUR_LOGIQUE
    const echelle = largeur / LARGEUR_LOGIQUE
    canvas.width = Math.round(largeur * densite)
    canvas.height = Math.round(hauteur * echelle * densite)
    peindre.current = (t, vivant) => {
      ctx.setTransform(densite * echelle, 0, 0, densite * echelle, 0, 0)
      dessin.current(ctx, t, vivant)
    }
    return () => {
      peindre.current = null
    }
  }, [fabrique, hauteur])

  useEffect(() => {
    if (calme || !ref.current) return
    let visible = true
    const guet = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => void (visible = !!e?.isIntersecting)) : null
    guet?.observe(ref.current)
    const debut = performance.now()
    let id = requestAnimationFrame(function image(maintenant) {
      if (visible) peindre.current?.((maintenant - debut) / 1000, true)
      id = requestAnimationFrame(image)
    })
    return () => {
      cancelAnimationFrame(id)
      guet?.disconnect()
    }
  }, [calme])

  // Au calme, l'image ne se repeint qu'au rendu : une police du monde qui finit de charger après
  // elle (IM Fell, Limelight : chargées à leur premier usage, celui de la toile compris) la
  // laisserait en police de repli. Elle se repeint à chaque fin de chargement des polices.
  useEffect(() => {
    if (!calme || !('fonts' in document)) return
    const polices = document.fonts
    const repeindre = () => peindre.current?.(0, false)
    polices.addEventListener('loadingdone', repeindre)
    return () => polices.removeEventListener('loadingdone', repeindre)
  }, [calme])

  // Au calme, une image posée à chaque rendu, jamais une boucle.
  useEffect(() => {
    if (calme) peindre.current?.(0, false)
  })

  return (
    <canvas
      ref={ref}
      className={`${styles.toile} ${className ?? ''}`}
      style={{ aspectRatio: `${LARGEUR_LOGIQUE} / ${hauteur}` }}
      role="img"
      aria-label={libelle}
      onPointerDown={onToucher ? (e) => onToucher(enUnites(e, hauteur)) : undefined}
      onClick={onChoisir ? (e) => onChoisir(enUnites(e, hauteur)) : undefined}
    />
  )
}
