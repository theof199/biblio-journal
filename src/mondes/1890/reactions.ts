import type { VueMonde } from '../types'
/**
 * Toute réaction passe par `marquer` et se relit par `age` : le manège qui s'emballe, le rideau
 * qui se rouvre, l'affichette lue. Aucune variable d'état dans le monde.
 */
export function reagir(id: string, data: number | null, v: VueMonde, ou: { x: number; y: number }): void {
  void ou
  v.marquer(id === 'date' ? `date:${data}` : id)
}
