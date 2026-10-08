import type { Halte } from '../../api/voyage'

/**
 * Le compte d'une halte, **sur ce qui est servi** : les films à l'état `vu` seul (un film « sur ton
 * Plex » n'est pas vu), sur tous ceux que le serveur sert, introuvables compris. Jamais « trois » :
 * aucun catalogue dans l'appli. La carte le passe au monde (`HalteVue`), le dialogue de la halte le dit.
 */
export function compteDeLaHalte(films: Halte['films']): { vus: number; total: number } {
  return { vus: films.filter((f) => f.etat === 'vu').length, total: films.length }
}
