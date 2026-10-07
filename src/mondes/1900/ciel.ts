import type { VueMonde } from '../types'
import { c } from './couleur'
import type { Ambiance } from './donnees'
import { dessinerFond } from './fonds'
import { ambiances } from './habillage'
import { imageDu1900 } from './images'
import { decalages, ouvrir, RAPPORTS } from './toiles'
import { E } from './trace'

/** La largeur de la toile du fond (maquette : `.fond`, 800 px), élargie sur un écran qui la dépasserait. */
/** L'ordre où les ambiances se posent : celle qui s'efface dessous, celle qui monte dessus, selon la ligne. */
const ORDRE: readonly Ambiance[] = ['ville', 'campagne', 'montagne', 'mer']

const largeurDuFond = (W: number) => Math.max(800, W + 410)

/**
 * Le ciel de la vitre et la toile du fond, la plus lente (rapport 1/60 ; maquette : `.ciel`,
 * `.fond`, l. 86-94 et 3069-3072). Le fond suit la ligne : ville, campagne, montagne, mer, une
 * ambiance par gare, deux qui se fondent en route (`ambiances`). Le ciel n'est pas celui de l'heure
 * du visiteur : le monde ne lit ni `nuit` ni `lum` ; l'heure de la gare se pose par-dessus tout
 * (`dessus.ts`).
 */
export function dessinerCiel(v: VueMonde): void {
  if (!ouvrir(v)) return
  const g = v.ctx
  const ciel = g.createLinearGradient(0, 0, 0, v.H)
  ciel.addColorStop(0, c('#b9b7a6'))
  ciel.addColorStop(0.45, c('#ddd3bb'))
  ciel.addColorStop(0.7, c('#cfc2a3'))
  ciel.addColorStop(1, c('#8f7d61'))
  g.fillStyle = ciel
  g.fillRect(0, 0, v.W, v.H)
  // La toile part d'un quai plus tôt (`E`) : le train a déjà roulé du quai de 1899 à la gare de 1900.
  const x = -12 - E * (RAPPORTS.fond / RAPPORTS.gares) - decalages(v.avance).fond
  const w = largeurDuFond(v.W)
  const h = v.H * 0.46
  const url = imageDu1900('fond')
  const photo = url ? v.image(url) : null
  const parts = ambiances(v.avance)
  for (const nom of ORDRE) {
    if (parts[nom] <= 0) continue
    g.save()
    g.globalAlpha *= parts[nom]
    dessinerFond(g, nom, x, w, h, photo)
    g.restore()
  }
  // Le bas de la toile se fond dans le ciel (maquette : le masque de `.fond`).
  const fondu = g.createLinearGradient(0, h * 0.74, 0, h)
  fondu.addColorStop(0, c('#ddd3bb', 0))
  fondu.addColorStop(1, c('#ddd3bb'))
  g.fillStyle = fondu
  g.fillRect(0, h * 0.74, v.W, h * 0.26 + 1)
  g.restore()
}
