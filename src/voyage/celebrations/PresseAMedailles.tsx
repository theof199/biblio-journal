import { vibrer } from '../../ui/haptique'
import { NOM_DE_RECOMPENSE } from '../annee/Embleme'
import { gabaritDe } from '../gabarit'
import Cadre from './Cadre'
import DessinDeLaRecompense from './DessinDeLaRecompense'
import { RECOMPENSE, VIBRATION_DE_FETE, useDeroule } from './deroule'
import type { RecompensePassee } from './lues'
import { motifDeRecompense, type Scene } from './scenes'
import type { PropsDeScene } from './Celebrations'

const ARTICLE = { ours: 'L’', lion: 'Le ', palme: 'La ' } as const

interface Props extends PropsDeScene<Extract<Scene, { type: 'recompense' }>> {
  /** Les récompenses des années d'avant de la décennie, lues de la carte par le séquenceur. */
  passees: readonly RecompensePassee[]
}

/**
 * La récompense (maquette 1890 : `sceneBadge`) : le balancier d'une presse à médailles lance la
 * vis, qui frappe (l'éclair, le clap) ; la presse s'efface et l'emblème sort en tournant sur
 * lui-même (le carillon), puis son nom. Au calme : l'emblème et son nom, posés.
 *
 * La scène garde son cadre, son déroulé, le clap, le carillon et la vibration ; le dessin seul se
 * lit au monde (`feteDeLaRecompense`).
 */
export default function PresseAMedailles({ scene, monde, calme, son, onSuite, passees }: Props) {
  const { pas, fini } = useDeroule(RECOMPENSE, calme, (p) => {
    if (p === 1) {
      son?.clap()
      vibrer(VIBRATION_DE_FETE)
    }
    if (p === 2) son?.carillon()
  })
  const nom = `${ARTICLE[scene.recompense]}${NOM_DE_RECOMPENSE[scene.recompense]}`
  const motif = motifDeRecompense(scene.recompense, scene.annee)
  const Dessin = gabaritDe(monde, 'feteDeLaRecompense', DessinDeLaRecompense)
  return (
    <Cadre nom={`${nom} : ${motif}`} onToucher={onSuite} onEchap={onSuite}>
      <Dessin scene={scene} monde={monde} pas={pas} fini={fini} nom={nom} motif={motif} passees={passees} />
    </Cadre>
  )
}
