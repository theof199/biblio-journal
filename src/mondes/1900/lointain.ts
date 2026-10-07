import type { VueMonde } from '../types'
import { c } from './couleur'
import { cuire, fondre } from './cuisson'
import { CADRE_LOIN, RACCORD_LOIN, SUITE_LOIN, type VueLointaine } from './donnees'
import { imageDu1900, TAILLES } from './images'
import { decalages, ouvrir, RAPPORTS } from './toiles'
import { E } from './trace'

/** La largeur d'une vue lointaine recadrée, pour une toile haute de `h` (maquette : `construireLoin`, l. 2855-2868). */
export function largeurDeLaVue(nom: string, h: number): number {
  const [lp, hp] = TAILLES[nom]!
  const [x0, x1] = CADRE_LOIN[nom]!
  return (h * lp * (x1 - x0)) / hp
}

/**
 * La vue lointaine de rang `k` sur la toile : la suite de la maquette, reprise autant qu'il faut.
 * Elle couvre la ligne sur un téléphone debout ; sur un écran plus large que haut, la toile ne
 * s'arrête pas avant la gare de 1909.
 */
export const vueDeRang = (k: number): VueLointaine => SUITE_LOIN[k % SUITE_LOIN.length]!

/**
 * Les vues lointaines à l'écran, de gauche à droite : leur rang sur la toile, leur bord gauche et
 * leur largeur. Chacune commence `RACCORD_LOIN` pixels avant la fin de la précédente ; la toile est
 * couverte jusqu'au bord droit de l'écran, quelle que soit sa largeur.
 */
export function vuesALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>): Array<VueLointaine & { rang: number; x: number; w: number }> {
  const h = v.H * 0.64
  const vues: Array<VueLointaine & { rang: number; x: number; w: number }> = []
  let x = -60 - E * (RAPPORTS.loin / RAPPORTS.gares) - decalages(v.avance).loin
  for (let rang = 0; x < v.W; rang++) {
    const vue = vueDeRang(rang)
    const w = largeurDeLaVue(vue.nom, h)
    if (x + w > 0) vues.push({ ...vue, rang, x, w })
    x += w - RACCORD_LOIN
  }
  return vues
}

/**
 * Une vue lointaine recadrée et fondue (maquette : `.loin i`, l. 95-102) : son ciel s'efface de
 * `h0` à `h1`, et son bord gauche se fond sur la vue d'avant, restée pleine dessous. Retournée, elle
 * se raccorde à elle-même sans couture.
 */
function vueFondue(nom: string, miroir: boolean, photo: CanvasImageSource, w: number, h: number): CanvasImageSource | null {
  const [lp] = TAILLES[nom]!
  const [x0, x1, h0, h1] = CADRE_LOIN[nom]!
  return cuire(`loin:${nom}:${miroir ? 'm' : ''}:${Math.round(h)}`, w, h, (g, lw, lh) => {
    g.save()
    if (miroir) {
      g.translate(lw, 0)
      g.scale(-1, 1)
    }
    g.drawImage(photo, x0 * lp, 0, (x1 - x0) * lp, TAILLES[nom]![1], 0, 0, lw, lh)
    if (nom === 'loin3') {
      // La plaque de la côte porte une marche de teinte dans la mer : sa partie claire est rabattue sur l'autre (l. 102).
      g.globalCompositeOperation = 'multiply'
      const mer = g.createLinearGradient(0, lh * 0.4, 0, lh * 0.454)
      mer.addColorStop(0, c('#ffffff'))
      mer.addColorStop(1, c('#a6c6c5'))
      g.fillStyle = mer
      g.fillRect(0, lh * 0.4, lw * 0.356, lh * 0.6)
      g.globalCompositeOperation = 'source-over'
    }
    g.restore()
    fondre(g, 0, 0, RACCORD_LOIN, 0, [[0, 0], [1, 1]], lw, lh)
    fondre(g, 0, 0, 0, lh, [[0, 0], [h0 / 100, 0], [h1 / 100, 1], [1, 1]], lw, lh)
  })
}

/**
 * La toile basse de la campagne (rapport 2/15 ; maquette : `.loin`, l. 95 et 3073), puis le talus
 * au pied des gares. Les vues se suivent dans l'ordre de `SUITE_LOIN`, en boucle (`vueDeRang`), chacune recadrée
 * (`CADRE_LOIN`) et fondue sur la précédente.
 */
export function dessinerLointain(v: VueMonde): void {
  if (!ouvrir(v)) return
  const g = v.ctx
  const haut = v.H * 0.2
  const h = v.H * 0.64
  for (const { nom, miroir, x, w } of vuesALEcran(v)) {
    const url = imageDu1900(nom)
    const photo = url ? v.image(url) : null
    if (!photo) continue
    const fondue = vueFondue(nom, miroir, photo, w, h)
    if (fondue) g.drawImage(fondue, x, haut, w, h)
    else g.drawImage(photo, x, haut, w, h)
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
