import { useMemo, useRef } from 'react'
import { Particules } from '../../carte/dessin/particules'
import type { Monde } from '../../mondes/types'
import Toile, { LARGEUR_LOGIQUE } from '../Toile'
import type { Arrivee } from '../annee'
import Embleme, { NOM_DE_RECOMPENSE } from '../annee/Embleme'
import Fronton from '../annee/Fronton'
import { PAS_DE_L_ANNEE } from './deroule'
import { motifDeRecompense, type Scene } from './scenes'
import styles from './Celebrations.module.css'

/** La toile des confettis, en unités logiques : du fronton au guichet. */
const HAUTEUR = 520
/** Les cinq couleurs des confettis de la maquette, passées par la rampe du monde. */
const CONFETTIS = ['#A8452F', '#E6B94A', '#F2E8D5', '#3E5360', '#DE7A45'] as const

/** Ce que la scène de l'année bouclée passe à son dessin (`GabaritsDesPages.feteDeLAnnee`). */
export interface PropsFeteDeLAnnee {
  scene: Extract<Scene, { type: 'annee' }>
  monde: Monde
  /** Le pas du déroulé (`ANNEE`, `PAS_DE_L_ANNEE`) ; le dernier d'emblée au calme ou d'un toucher. */
  pas: number
  /** Le déroulé est au bout : le choix s'offre, que la scène garde. */
  fini: boolean
  /**
   * Le pas de la médaille s'est joué, lui : 1 alors, 0 tant qu'il ne l'est pas, et 0 pour toujours
   * quand il a été sauté (le calme, le toucher impatient). Ce qui éclate ne part que de là.
   */
  salve: number
  /** Les arrivées de l'année (`arriveesFetees`), par la règle de la fiche ; nulles sans sa fiche. */
  arrivees: readonly Arrivee[] | null
}

/**
 * Le dessin par défaut de l'année bouclée : les cinq ampoules du fronton s'allument une à une, la
 * médaille tombe au bout de son ruban sous les confettis de la carte (`Particules`), puis le guichet
 * tend le billet de l'année suivante. Au calme : tout est posé, sans confettis. Il ne montre pas les
 * arrivées.
 */
export default function DessinDeLAnnee({ scene, monde, pas, salve }: PropsFeteDeLAnnee) {
  const particules = useRef<Particules | null>(null)
  particules.current ??= new Particules()
  const lancee = useRef(0)
  const dernierT = useRef(0)
  const couleurs = useMemo(() => CONFETTIS.map((c) => monde.couleur(c)), [monde])
  const recompense = scene.recompense
  return (
    <>
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
            if (salve !== lancee.current) {
              lancee.current = salve
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
    </>
  )
}
