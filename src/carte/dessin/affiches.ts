import { Lru } from '../lru'
import type { Dependances, Toile } from '../moteur'
import type { Traitement } from '../../mondes/types'

const SEPIA = 'rgb(150,104,58)'

/**
 * Une affiche TMDB au traitement du monde. Jamais par `getImageData` : l'affiche vient d'une
 * autre origine sans CORS, la toile est « teintée », et toute lecture de pixels y lève une
 * `SecurityError` (MDN, « Allowing cross-origin use of images and canvas »). Le traitement passe
 * donc par la composition, qui ne lit rien : `saturation` sur un gris ôte la couleur, `color`
 * sur un sépia la vire.
 */
export function afficheTraitee(url: string, traitement: Traitement, deps: Dependances, cache: Lru<string, Toile>, pret: () => void): Toile | null {
  const cle = `${traitement.affiches}|${url}`
  const deja = cache.get(cle)
  if (deja) return deja
  const img = deps.image(url, pret)
  if (!img) return null
  const toile = deps.creerToile(52, 76)
  const x = toile.getContext('2d')
  if (!x) return null
  x.drawImage(img, 0, 0, 52, 76)
  if (traitement.affiches !== 'couleur') {
    x.globalCompositeOperation = 'saturation'
    x.fillStyle = '#808080'
    x.fillRect(0, 0, 52, 76)
    if (traitement.affiches === 'sepia') {
      x.globalCompositeOperation = 'color'
      x.fillStyle = SEPIA
      x.fillRect(0, 0, 52, 76)
    }
    x.globalCompositeOperation = 'source-over'
  }
  cache.set(cle, toile)
  return toile
}
