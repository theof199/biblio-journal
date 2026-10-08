import { vibrer } from '../../ui/haptique'
import type { Monde } from '../../mondes/types'
import { gabaritSeul } from '../gabarit'
import Cadre from './Cadre'
import { BADGE, VIBRATION_DE_FETE, useDeroule } from './deroule'
import { MOT_DU_BADGE, nomDuBadge, type Scene } from './scenes'
import type { PropsDeScene } from './Celebrations'

/** Ce que la scène d'une étiquette de la malle passe à son dessin (`GabaritsDesPages.feteDuBadge`). */
export interface PropsFeteDuBadge {
  /** La place qui vient de se coller, et celles qui l'étaient avant elle (`scene.deja`, par numéro). */
  scene: Extract<Scene, { type: 'badge' }>
  monde: Monde
  /** Le pas du déroulé (`BADGE`) : 1, l'étiquette tombe ; le dernier d'emblée au calme. */
  pas: number
  /** Le déroulé est au bout : son nom et sa devise se disent. */
  fini: boolean
  /** « Étiquette collée », au-dessus du nom. */
  sur: string
}

/**
 * Une étiquette de la malle vient de se coller (maquette 1900, écran 13 : `.s-etiquette`) : le
 * pinceau passe la colle, l'étiquette tombe à sa place (le clap), puis son nom. La scène garde son
 * cadre, son déroulé, le clap, le carillon et la vibration, comme la récompense ; le dessin est au
 * monde, **sans défaut** : sans lui la scène ne se monte pas (`Celebrations.tsx` la passe).
 */
export default function BadgeColle({ scene, monde, calme, son, onSuite }: PropsDeScene<Extract<Scene, { type: 'badge' }>>) {
  const { pas, fini } = useDeroule(BADGE, calme, (p) => {
    if (p === 1) {
      son?.clap()
      vibrer(VIBRATION_DE_FETE)
    }
    if (p === 2) son?.carillon()
  })
  const Dessin = gabaritSeul(monde, 'feteDuBadge')
  if (!Dessin) return null
  return (
    <Cadre nom={nomDuBadge(scene)} onToucher={onSuite} onEchap={onSuite}>
      <Dessin scene={scene} monde={monde} pas={pas} fini={fini} sur={MOT_DU_BADGE} />
    </Cadre>
  )
}
