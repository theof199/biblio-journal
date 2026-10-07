import type { VueMonde } from '../types'
import { c } from './couleur'
import { prendreLeTrain, ZONE_DE_LA_HALTE } from './halte'
/**
 * Toute réaction passe par `marquer` et se relit par `age` : le manège qui s'emballe, le rideau
 * qui se rouvre, l'affichette lue. Aucune variable d'état dans le monde.
 */
export function reagir(id: string, data: number | null, v: VueMonde, ou: { x: number; y: number }): void {
  // Prendre le train n'est pas une réaction du décor mais un acte, qui vaut au calme : il ne date rien.
  if (id === ZONE_DE_LA_HALTE) {
    prendreLeTrain(v)
    return
  }
  v.marquer(id === 'date' ? `date:${data}` : id)
  // Le bec de gaz crache ses étincelles (maquette : `reagir`, cas `bec`).
  if (id === 'bec') v.etincelles(ou.x, ou.y, 14, c('#F6D98A'))
}
