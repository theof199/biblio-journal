import { vibrer } from '../../ui/haptique'
import { gabaritDe } from '../gabarit'
import Cadre from './Cadre'
import DessinDeLaSalle from './DessinDeLaSalle'
import { SALLE, VIBRATION_DE_FETE, useDeroule } from './deroule'
import type { SalleFetee } from './lues'
import { cartonDeSalle, type Scene } from './scenes'
import type { PropsDeScene } from './Celebrations'

interface Props extends PropsDeScene<Extract<Scene, { type: 'salle' }>> {
  /** La salle bouclée telle que la fiche la montre ; nulle sans fiche, ou quand la scène en compte plusieurs. */
  salle: SalleFetee | null
}

/**
 * La salle bouclée : la salle se referme en rideau, le clap tombe quand les deux pans se
 * rejoignent, puis le carton dit laquelle. Au calme, le rideau est fermé et le carton posé.
 *
 * La scène garde son cadre (le dialogue, le toucher, Échap), son déroulé, le clap et la vibration ;
 * le dessin seul se lit au monde (`feteDeLaSalle`).
 */
export default function SalleBouclee({ scene, monde, calme, son, onSuite, salle }: Props) {
  const { fini } = useDeroule(SALLE, calme, () => {
    son?.clap()
    vibrer(VIBRATION_DE_FETE)
  })
  const carton = cartonDeSalle(scene)
  const Dessin = gabaritDe(monde, 'feteDeLaSalle', DessinDeLaSalle)
  return (
    <Cadre nom={`${carton.sur} : ${carton.titre}`} onToucher={onSuite} onEchap={onSuite}>
      <Dessin scene={scene} monde={monde} carton={carton} fini={fini} salle={salle} />
    </Cadre>
  )
}
