import { useEffect, useState } from 'react'
import { vibrer } from '../../ui/haptique'
import type { Arrivee } from '../annee'
import { gabaritDe } from '../gabarit'
import Cadre from './Cadre'
import DessinDeLAnnee from './DessinDeLAnnee'
import { ANNEE, GARDE_DU_CHOIX, PAS_DE_L_ANNEE, VIBRATION_DE_FETE, useDeroule } from './deroule'
import type { Scene } from './scenes'
import type { PropsDeScene } from './Celebrations'
import styles from './Celebrations.module.css'

interface Props extends PropsDeScene<Extract<Scene, { type: 'annee' }>> {
  /** Le ticket s'est montré : `POST …/montre`, une seule fois, quel que soit le choix. Faux : il l'était déjà, le geste ne compte pas. */
  onMontre: (annee: number) => boolean
  /** Encaisser le ticket ; absent quand il n'ouvre pas l'année qui suit mon année en cours. */
  onUtiliser?: (annee: number) => void
  /** Les arrivées de l'année, par la règle de la fiche ; nulles quand la page ne tient pas sa fiche. */
  arrivees: readonly Arrivee[] | null
}

/**
 * L'année bouclée (maquette 1890 : `sceneAnnee`) : les cinq ampoules du fronton s'allument une à
 * une, la médaille tombe au bout de son ruban sous les confettis de la carte (`Particules`), puis
 * le guichet tend le billet de l'année suivante : le garder, ou l'utiliser. Un toucher pendant la
 * scène pose son état final ; elle ne se quitte que par un choix. Au calme : tout est posé, sans
 * confettis.
 *
 * La scène garde son cadre, son déroulé, le carillon, la vibration, le choix et sa garde ; le dessin
 * seul se lit au monde (`feteDeLAnnee`). Les deux boutons du choix restent les siens.
 */
export default function AnneeBouclee({ scene, monde, calme, son, onSuite, onMontre, onUtiliser, arrivees }: Props) {
  const [salve, setSalve] = useState(0)
  const { pas, fini, finir } = useDeroule(ANNEE, calme, (p) => {
    if (p !== PAS_DE_L_ANNEE.medaille) return
    setSalve(1)
    son?.carillon()
    vibrer(VIBRATION_DE_FETE)
  })

  // Le choix n'apparaît pas sous le doigt : hors du calme, ses boutons restent inertes un instant
  // (`GARDE_DU_CHOIX`), que la scène ait fini seule ou d'un toucher. Le toucher qui la termine,
  // redoublé au même endroit, ne dépense donc pas le billet.
  const [arme, setArme] = useState(calme)
  useEffect(() => {
    if (!fini || arme) return
    const j = setTimeout(() => setArme(true), GARDE_DU_CHOIX)
    return () => clearTimeout(j)
  }, [fini, arme])

  // Deux touchers rapprochés (ou « Le garder » puis « L’utiliser ») ne montrent ni n'encaissent deux
  // fois : le premier seul montre le ticket (`useMontrerLeTicket`), les suivants ne comptent pas.
  const choisir = (utiliser: boolean) => {
    if (!arme || !onMontre(scene.ticket)) return
    if (utiliser) onUtiliser?.(scene.ticket)
    onSuite()
  }

  const Dessin = gabaritDe(monde, 'feteDeLAnnee', DessinDeLAnnee)
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
            <button type="button" className={styles.bouton} aria-disabled={!arme} onClick={() => choisir(false)}>
              Le garder
            </button>
            {onUtiliser ? (
              <button type="button" className={`${styles.bouton} ${styles.utiliser}`} aria-disabled={!arme} onClick={() => choisir(true)}>
                L’utiliser
              </button>
            ) : null}
          </>
        ) : (
          <></>
        )
      }
    >
      <Dessin scene={scene} monde={monde} pas={pas} fini={fini} salve={salve} arrivees={arrivees} />
    </Cadre>
  )
}
