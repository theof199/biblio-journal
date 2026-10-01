import { useMemo, useRef } from 'react'
import { Particules } from '../../carte/dessin/particules'
import { vibrer } from '../../ui/haptique'
import Toile, { LARGEUR_LOGIQUE } from '../Toile'
import Embleme, { NOM_DE_RECOMPENSE } from '../annee/Embleme'
import Fronton from '../annee/Fronton'
import Cadre from './Cadre'
import { ANNEE, PAS_DE_L_ANNEE, VIBRATION_DE_FETE, useDeroule } from './deroule'
import { motifDeRecompense, type Scene } from './scenes'
import type { PropsDeScene } from './Celebrations'
import styles from './Celebrations.module.css'

/** La toile des confettis, en unités logiques : du fronton au guichet. */
const HAUTEUR = 520
/** Les cinq couleurs des confettis de la maquette, passées par la rampe du monde. */
const CONFETTIS = ['#A8452F', '#E6B94A', '#F2E8D5', '#3E5360', '#DE7A45'] as const

interface Props extends PropsDeScene<Extract<Scene, { type: 'annee' }>> {
  /** Le ticket s'est montré : `POST …/montre`, une seule fois, quel que soit le choix. Faux : il l'était déjà, le geste ne compte pas. */
  onMontre: (annee: number) => boolean
  /** Encaisser le ticket ; absent quand il n'ouvre pas l'année qui suit mon année en cours. */
  onUtiliser?: (annee: number) => void
}

/**
 * L'année bouclée (maquette 1890 : `sceneAnnee`) : les cinq ampoules du fronton s'allument une à
 * une, la médaille tombe au bout de son ruban sous les confettis de la carte (`Particules`), puis
 * le guichet tend le billet de l'année suivante : le garder, ou l'utiliser. Un toucher pendant la
 * scène pose son état final ; elle ne se quitte que par un choix. Au calme : tout est posé, sans
 * confettis.
 */
export default function AnneeBouclee({ scene, monde, calme, son, onSuite, onMontre, onUtiliser }: Props) {
  const particules = useRef<Particules | null>(null)
  particules.current ??= new Particules()
  const aLancer = useRef(false)
  const dernierT = useRef(0)
  const couleurs = useMemo(() => CONFETTIS.map((c) => monde.couleur(c)), [monde])
  const { pas, fini, finir } = useDeroule(ANNEE, calme, (p) => {
    if (p !== PAS_DE_L_ANNEE.medaille) return
    aLancer.current = true
    son?.carillon()
    vibrer(VIBRATION_DE_FETE)
  })

  // Deux touchers rapprochés (ou « Le garder » puis « L’utiliser ») ne montrent ni n'encaissent deux
  // fois : le premier seul montre le ticket (`useMontrerLeTicket`), les suivants ne comptent pas.
  const choisir = (utiliser: boolean) => {
    if (!onMontre(scene.ticket)) return
    if (utiliser) onUtiliser?.(scene.ticket)
    onSuite()
  }

  const recompense = scene.recompense
  return (
    <Cadre
      nom={`${scene.annee} est bouclée`}
      onToucher={() => {
        if (!fini) finir()
      }}
      onEchap={() => (fini ? choisir(false) : finir())}
      pied={
        fini ? (
          <>
            <button type="button" className={styles.bouton} onClick={() => choisir(false)}>
              Le garder
            </button>
            {onUtiliser ? (
              <button type="button" className={`${styles.bouton} ${styles.utiliser}`} onClick={() => choisir(true)}>
                L’utiliser
              </button>
            ) : null}
          </>
        ) : (
          <></>
        )
      }
    >
      <div className={styles.confettis} aria-hidden="true">
        <Toile
          hauteur={HAUTEUR}
          libelle="Des confettis."
          dessiner={(ctx, t, vivant) => {
            ctx.clearRect(0, 0, LARGEUR_LOGIQUE, HAUTEUR)
            if (!vivant) return
            const dt = Math.min(0.05, Math.max(0, t - dernierT.current))
            dernierT.current = t
            const p = particules.current!
            if (aLancer.current) {
              aLancer.current = false
              p.confettis(120, 250, couleurs)
              p.confettis(270, 250, couleurs)
            }
            p.maj(dt)
            p.dessiner(ctx, false)
          }}
        />
      </div>
      <div className={styles.fronton}>
        <Fronton annee={scene.annee} annonce={monde.pages.mots.annonce.bouclee} millesime="bouclee" monde={monde}>
          <div className={styles.ampoules} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} className={`${styles.ampoule} ${pas > i ? styles.allumee : ''}`} data-allumee={pas > i} />
            ))}
          </div>
        </Fronton>
      </div>
      {pas >= PAS_DE_L_ANNEE.medaille && recompense ? (
        <div className={styles.pendue}>
          <i className={styles.ruban} aria-hidden="true" />
          <Embleme type={recompense} couleur={monde.couleur} className={styles.medaille} />
        </div>
      ) : null}
      {pas >= PAS_DE_L_ANNEE.titre ? (
        <>
          <p className={`celebration ${styles.titre}`}>est bouclée</p>
          {recompense ? <p className={styles.sous}>{`${NOM_DE_RECOMPENSE[recompense]} · ${motifDeRecompense(recompense, scene.annee)}`}</p> : null}
        </>
      ) : null}
      {pas >= PAS_DE_L_ANNEE.guichet ? (
        <div className={styles.guichet}>
          <i className={styles.auvent} aria-hidden="true" />
          <i className={styles.caisse} aria-hidden="true">
            <i className={styles.fenetre} />
          </i>
          <p className={styles.billet} aria-label={`Bon pour ${scene.ticket}`}>
            <span className={styles.bon}>
              <small>Bon pour</small>
              <b>{scene.ticket}</b>
            </span>
            <span className={styles.talon} aria-hidden="true">
              ENTRÉE
            </span>
          </p>
        </div>
      ) : null}
    </Cadre>
  )
}
