import type { VueMonde } from '../types'
import { c } from './couleur'
import { imageDu1900, TAILLES } from './images'
import { decalages, ouvrir, RAPPORTS } from './toiles'
import { E } from './trace'

/** Les trois vues de la campagne (Trutat), à la suite et reprises autant qu'il faut pour couvrir la ligne. */
const VUES = ['loin1', 'loin2', 'loin3'] as const

/**
 * La toile basse de la campagne (rapport 2/15 ; maquette : `.loin`, l. 95 et 3073), puis le talus
 * au pied des gares. En 11a les vues sont posées entières, bord à bord : leur recadrage et leurs
 * fondus sont l'habillage de 11b.
 */
export function dessinerLointain(v: VueMonde): void {
  if (!ouvrir(v)) return
  const g = v.ctx
  const haut = v.H * 0.2
  const h = v.H * 0.64
  let x = -60 - E * (RAPPORTS.loin / RAPPORTS.gares) - decalages(v.avance).loin
  for (let i = 0; x < v.W; i++) {
    const nom = VUES[i % VUES.length]!
    const [lp, hp] = TAILLES[nom]!
    const w = (h * lp) / hp
    if (x + w > 0) {
      const url = imageDu1900(nom)
      const photo = url ? v.image(url) : null
      if (photo) g.drawImage(photo, x, haut, w, h)
    }
    x += w
  }
  // Le talus (maquette : `.talus`) : une bande d'herbe sombre, sans rien qui dise sa vitesse.
  const y = v.H * 0.68
  const talus = g.createLinearGradient(0, y, 0, v.H * 0.81)
  talus.addColorStop(0, c('#3e462c', 0))
  talus.addColorStop(0.35, c('#3d4029'))
  talus.addColorStop(1, c('#2c2618'))
  g.fillStyle = talus
  g.fillRect(0, y, v.W, v.H * 0.13)
  g.restore()
}
