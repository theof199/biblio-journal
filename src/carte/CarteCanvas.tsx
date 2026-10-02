import { createContext, useContext, useEffect, useRef } from 'react'
import { MoteurCarte, type EtatCarte, type Rappels } from './moteur'
import { creerRegistre } from '../mondes'
import styles from './CarteCanvas.module.css'

/** Ce que la page attend d'un moteur : `MoteurCarte`, ou sa doublure dans un test. */
export type Moteur = Pick<
  MoteurCarte,
  'mesurer' | 'hauteur' | 'defiler' | 'majEtat' | 'reglerCalme' | 'reglerVisible' | 'pointeur' | 'pincer' | 'doigtsPoses' | 'allerIci' | 'basculerEnsemble' | 'marcher' | 'passerLaPorte' | 'direAdieu' | 'direBonjour' | 'claquer' | 'ouvrirSousLesYeux' | 'ecranDeLAnnee' | 'reglerBobines' | 'detruire'
>
export type FabriqueMoteur = (canvas: HTMLCanvasElement, rappels: Rappels) => Moteur

const images = new Map<string, HTMLImageElement>()

/** Le vrai moteur, sur le vrai `<canvas>` : l'affiche se charge sans CORS, et ne se lit jamais. */
export const fabriqueReelle: FabriqueMoteur = (canvas, rappels) =>
  new MoteurCarte(canvas, rappels, {
    creerToile: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
    image: (url, pret) => {
      let img = images.get(url)
      if (!img) {
        img = new Image()
        img.decoding = 'async'
        img.onload = pret
        img.src = url
        images.set(url, img)
      }
      return img.complete && img.naturalWidth > 0 ? img : null
    },
    demanderImage: (f) => requestAnimationFrame(f),
    annulerImage: (id) => cancelAnimationFrame(id),
    heure: () => {
      const d = new Date()
      return d.getHours() + d.getMinutes() / 60
    },
    mondeDe: creerRegistre(),
  })

export const FabriqueMoteurContexte = createContext<FabriqueMoteur>(fabriqueReelle)

interface Props {
  etat: EtatCarte
  calme: boolean
  /** Les bobines perdues déjà trouvées sur cet appareil (plan 2d). */
  bobines: readonly string[]
  rappels: Omit<Rappels, 'defilerVers'>
  /** Le moteur monté, pour que la page le commande (ticket, « Tu es ici ») ; nul au démontage. */
  surMoteur: (m: Moteur | null) => void
}

/**
 * Le pont entre le DOM et le moteur (la maquette : « Mesure et visibilité », « Toucher,
 * survol, pincement ») : un défilement natif (`.vue` et son espaceur), un `<canvas>` collant,
 * et chaque événement relayé. Le canvas est décoratif pour les lecteurs d'écran : la page porte
 * la liste des années.
 */
export default function CarteCanvas({ etat, calme, bobines, rappels, surMoteur }: Props) {
  const fabrique = useContext(FabriqueMoteurContexte)
  const vueRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const espaceRef = useRef<HTMLDivElement>(null)
  const moteurRef = useRef<Moteur | null>(null)
  const placee = useRef(false)
  const rappelsRef = useRef(rappels)
  rappelsRef.current = rappels

  useEffect(() => {
    const vue = vueRef.current
    const canvas = canvasRef.current
    const espace = espaceRef.current
    if (!vue || !canvas || !espace) return
    const moteur = fabrique(canvas, {
      toucherAnnee: (a) => rappelsRef.current.toucherAnnee(a),
      apercu: (a, ancre) => rappelsRef.current.apercu(a, ancre),
      finApercu: () => rappelsRef.current.finApercu(),
      ensemble: (o) => rappelsRef.current.ensemble(o),
      date: (d) => rappelsRef.current.date(d),
      roulotte: () => rappelsRef.current.roulotte(),
      avatarVisible: (v) => rappelsRef.current.avatarVisible(v),
      bobine: (cle) => rappelsRef.current.bobine(cle),
      bobineArrivee: (cle) => rappelsRef.current.bobineArrivee(cle),
      cibleBobines: () => rappelsRef.current.cibleBobines(),
      clap: () => rappelsRef.current.clap(),
      presences: (liste) => rappelsRef.current.presences(liste),
      entreeProche: (d) => rappelsRef.current.entreeProche?.(d),
      defilerVers: (y) => {
        vue.scrollTop = y
      },
    })
    moteurRef.current = moteur
    surMoteur(moteur)
    const mesurer = () => {
      moteur.mesurer(vue.clientWidth, vue.clientHeight, window.devicePixelRatio)
      espace.style.height = `${Math.max(0, moteur.hauteur - vue.clientHeight)}px`
    }
    mesurer()
    const local = (e: PointerEvent) => {
      const r = vue.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top] as const
    }
    const relayer = (type: Parameters<Moteur['pointeur']>[0]) => (e: PointerEvent) => {
      const [x, y] = local(e)
      moteur.pointeur(type, x, y, e.pointerType === 'mouse')
    }
    const bas = relayer('bas')
    const bouge = relayer('bouge')
    const haut = relayer('haut')
    const annule = relayer('annule')
    const quitte = relayer('quitte')
    // Défiler referme l'aperçu (maquette : l'écouteur `scroll`).
    const defile = () => {
      moteur.defiler(vue.scrollTop)
      rappelsRef.current.finApercu()
    }
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      rappelsRef.current.finApercu()
      moteur.basculerEnsemble(false)
    }
    const ecart = (t: TouchList) => (t.length === 2 ? Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY) : null)
    const touches = (e: TouchEvent) => {
      const r = vue.getBoundingClientRect()
      const milieu = e.touches.length === 2 ? (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - r.top : 0
      if (moteur.pincer(ecart(e.touches), milieu) && e.cancelable) e.preventDefault()
    }
    // Le nombre de doigts posés sur la carte : il survit au `pointercancel` du défilement natif, que
    // le moteur ne doit pas combattre. `targetTouches`, pas `touches` : un doigt posé ailleurs que
    // sur la carte y compterait, et son lever, qui n'arrive jamais ici, laisserait le compte bloqué.
    const doigts = (e: TouchEvent) => moteur.doigtsPoses(e.targetTouches.length)
    const menu = (e: Event) => e.target === canvas && e.preventDefault()
    vue.addEventListener('pointerdown', bas)
    vue.addEventListener('pointermove', bouge)
    vue.addEventListener('pointerup', haut)
    vue.addEventListener('pointercancel', annule)
    vue.addEventListener('pointerleave', quitte)
    vue.addEventListener('scroll', defile, { passive: true })
    vue.addEventListener('touchstart', touches, { passive: true })
    vue.addEventListener('touchmove', touches, { passive: false })
    vue.addEventListener('touchend', touches, { passive: true })
    vue.addEventListener('touchstart', doigts, { passive: true })
    vue.addEventListener('touchend', doigts, { passive: true })
    vue.addEventListener('touchcancel', doigts, { passive: true })
    vue.addEventListener('contextmenu', menu)
    document.addEventListener('keydown', echap)
    const taille = typeof ResizeObserver === 'function' ? new ResizeObserver(mesurer) : null
    taille?.observe(vue)
    const vu = typeof IntersectionObserver === 'function' ? new IntersectionObserver((e) => moteur.reglerVisible(e[0]?.isIntersecting ?? true)) : null
    vu?.observe(vue)
    const cache = () => moteur.reglerVisible(!document.hidden)
    document.addEventListener('visibilitychange', cache)
    return () => {
      vue.removeEventListener('pointerdown', bas)
      vue.removeEventListener('pointermove', bouge)
      vue.removeEventListener('pointerup', haut)
      vue.removeEventListener('pointercancel', annule)
      vue.removeEventListener('pointerleave', quitte)
      vue.removeEventListener('scroll', defile)
      vue.removeEventListener('touchstart', touches)
      vue.removeEventListener('touchmove', touches)
      vue.removeEventListener('touchend', touches)
      vue.removeEventListener('touchstart', doigts)
      vue.removeEventListener('touchend', doigts)
      vue.removeEventListener('touchcancel', doigts)
      vue.removeEventListener('contextmenu', menu)
      document.removeEventListener('keydown', echap)
      taille?.disconnect()
      vu?.disconnect()
      document.removeEventListener('visibilitychange', cache)
      moteur.detruire()
      moteurRef.current = null
      surMoteur(null)
    }
    // Un moteur par montage : `surMoteur` et `fabrique` sont stables pour la vie de la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const moteur = moteurRef.current
    const vue = vueRef.current
    if (!moteur || !vue) return
    moteur.majEtat(etat)
    if (espaceRef.current) espaceRef.current.style.height = `${Math.max(0, moteur.hauteur - vue.clientHeight)}px`
    // À l'ouverture, la caméra est déjà sur l'avatar : elle ne glisse pas depuis 1895.
    if (!placee.current && etat.cases.length > 0) {
      placee.current = true
      moteur.allerIci(true)
    }
  }, [etat])

  useEffect(() => moteurRef.current?.reglerCalme(calme), [calme])

  useEffect(() => moteurRef.current?.reglerBobines(bobines), [bobines])

  return (
    <div ref={vueRef} className={styles.vue}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div ref={espaceRef} />
    </div>
  )
}
