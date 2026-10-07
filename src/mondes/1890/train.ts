import type { VueMonde } from '../types'
import { imageDu1890 } from './images'
import { ombre } from './moyen'

/**
 * Le train au bout de la foire (demande du propriétaire, 7 octobre 2026 : « à la fin du chemin
 * mettre un train pour qu'on remarque mieux que ça n'est pas fini à 1899 », et « un train crédible,
 * pas juste des formes faites à la main »). Une photographie d'époque détourée, la C-127 du P.L.M.
 * (`assets/CREDITS.md`), posée à gauche du bout du chemin, sous la baraque « Prochainement », le
 * nez vers la pellicule.
 *
 * Il attend là toujours, dès 1895, par-dessus la brume de l'avenir, qu'il perce. Tant que
 * 1900 est fermé, c'est un décor : aucune zone, il ne répond pas. 1900 atteint (`v.passer` n'est
 * plus nul), il se touche, et le toucher lance le passage que lance le bouton « Prendre le train »
 * (`MoteurCarte.direBonjour`), au calme aussi. Il ne bouge pas et ne lit pas l'horloge : rien de lui
 * ne change pendant le passage, ni quand le visiteur demande moins d'animations.
 *
 * Sans l'image (elle charge encore), rien ne se dessine et rien ne se touche : pas de train tracé à
 * la main en attendant, et pas de zone sous un train qu'on ne voit pas.
 */
export const ZONE_DU_TRAIN = 'train'

/**
 * Sa place, dans le repère de la section : le coin bas gauche de la photographie (le rail), sa
 * largeur, et le rapport de l'image (720 × 305). La pellicule passe à droite, à partir de x = 185,
 * avant comme après 1900 ; la case de 1899 est en (130, 695), la baraque « Prochainement » finit
 * en y = 751, la bobine sous la brume est en y = 1062.
 */
export const TRAIN = { x: 4, y: 962, largeur: 172, rapport: 305 / 720 } as const

/** La photographie décodée, ou nulle tant qu'elle charge : le train n'est posé qu'avec elle. */
export function imageDuTrain(v: Pick<VueMonde, 'image'>): CanvasImageSource | null {
  const url = imageDu1890('locomotive.webp')
  return url ? v.image(url) : null
}

/** Le train se touche-t-il ? Seulement une fois le monde d'après atteint, et le train à l'écran. */
export const trainSeTouche = (v: Pick<VueMonde, 'image' | 'passer'>): boolean => v.passer !== null && imageDuTrain(v) !== null

/** Dans le repère de la section (`dessinerSurLaBrume`) : l'ombre au sol, la photographie, et sa zone si le train se prend. */
export function dessinerTrain(g: CanvasRenderingContext2D, v: VueMonde): void {
  const photo = imageDuTrain(v)
  if (!photo) return
  const { x, y, largeur } = TRAIN
  const hauteur = largeur * TRAIN.rapport
  // Dans la brume de l'avenir, il s'efface un peu : il la perce sans avoir l'air posé dessus.
  g.save()
  g.globalAlpha = v.brume < y ? 0.82 : 1
  ombre(g, x + largeur * 0.5, y + 1, largeur * 0.54, 5, 0.38)
  g.drawImage(photo, x, y - hauteur, largeur, hauteur)
  g.restore()
  if (!trainSeTouche(v)) return
  // Deux ronds couvrent la machine d'un bout à l'autre sans déborder sur le chemin.
  v.zone(ZONE_DU_TRAIN, x + largeur * 0.27, y - hauteur * 0.5, largeur * 0.26)
  v.zone(ZONE_DU_TRAIN, x + largeur * 0.73, y - hauteur * 0.5, largeur * 0.26)
}

/** Le toucher du train : le passage du bouton, ou rien tant que 1900 est fermé. Il ne date rien. */
export function prendreLeTrain(v: Pick<VueMonde, 'passer'>): void {
  v.passer?.()
}
