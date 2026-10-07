import type { CaseVue, VueMonde } from '../types'
import { clamp } from '../../carte/outils'
import { c, F_PRESSE, F_RAIL } from './couleur'
import { cuire, fondre } from './cuisson'
import { POSE } from './donnees'
import { DEVELOPPEMENT } from './durees'
import { imageDu1900, TAILLES } from './images'
import { dansLaFenetre, decalages, ouvrir } from './toiles'
import { ANNEES, E } from './trace'
import { DATES, PLACES_DES_DEPECHES } from './depeches'
import { CACHETTES } from './bobines'

/** Le lieu de chaque photographie (maquette : `LIEU`, l. 2733) : celui de l'image, pas celui des événements de l'année. */
export const LIEU: Readonly<Record<number, string>> = {
  1900: 'Paris, l’Exposition', 1901: 'Creil', 1902: 'Couville', 1903: 'Longueville', 1904: 'Allaman',
  1905: 'Bassersdorf', 1906: 'Brest', 1907: 'Monte-Carlo', 1908: 'Ponteland', 1909: 'Iguerande',
}

const HAUTEUR_DE_PLAQUE = 52

/** Le milieu de la gare de rang `i` à l'écran : `E` pixels de toile par gare, moins ce que la toile a défilé. */
export const milieuDeLaGare = (v: Pick<VueMonde, 'W' | 'avance'>, i: number): number => i * E + v.W / 2 - decalages(v.avance).gares

/**
 * La photographie de la gare de rang `i` à l'écran (maquette : `mesurer`, l. 2963-2971) : posée à
 * 19 % du bas, haute de 40 % de l'écran ; celle de 1900, la première qu'on voit, emplit la vitre.
 */
export function gareALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>, i: number): { x: number; y: number; w: number; h: number } {
  const [lp, hp] = TAILLES[`g${ANNEES[i]}`]!
  const h = i === 0 ? Math.min(v.H * 0.5, (v.W * 0.9 * hp) / lp) : v.H * 0.4
  const w = (h * lp) / hp
  return { x: milieuDeLaGare(v, i) - w / 2, y: v.H * 0.81 - h, w, h }
}

/** Le milieu du haut de la plaque émaillée (maquette : `.emaillee`, et `.gare.expo .emaillee` pour 1900). */
function plaqueDeLaGare(v: Pick<VueMonde, 'W' | 'H' | 'avance'>, i: number): { x: number; y: number } {
  const p = gareALEcran(v, i)
  return i === 0 ? { x: p.x + p.w * 0.79, y: p.y + p.h * 0.21 } : { x: p.x + p.w / 2, y: p.y + p.h * 0.06 }
}

/**
 * Où se tient une année à l'écran : sous sa plaque émaillée, là où le moteur inscrit la zone `case`
 * et pose le corail. Nulle quand la gare est hors de l'écran, ou hors de la part de l'écran que la
 * section occupe. Pure : ni dessin, ni zone, ni mémoire.
 */
export function ecranDeLaCase(v: VueMonde, annee: number): { x: number; y: number } | null {
  const i = ANNEES.indexOf(annee)
  if (i < 0) return null
  const p = plaqueDeLaGare(v, i)
  const y = p.y + HAUTEUR_DE_PLAQUE + 30
  if (p.x < 0 || p.x > v.W || !dansLaFenetre(v, y)) return null
  return { x: p.x, y }
}

/**
 * La seule règle de « fermée » du monde, lue par la gare (`aDevelopper`) comme par la bande de la vue
 * d'ensemble : une année sans case, verrouillée, ou en attente du Voyage suivi. Une année en attente
 * se montre fermée partout, plaque comprise, comme la case commune et le corail du moteur.
 */
export const estFermee = (a: Pick<CaseVue, 'etat' | 'attente'> | undefined): boolean => !a || a.etat === 'verrou' || a.attente === true

/**
 * Vrai tant que la gare d'une année est une plaque à développer : l'année est fermée (`estFermee`),
 * ou le membre n'y est pas encore arrivé. La page ouvre l'année avant la marche et n'avance
 * `ouverte.annee` qu'après : sans la seconde garde, la plaque paraîtrait développée le temps du
 * trajet, puis redeviendrait négative à l'arrivée pour se développer.
 */
export const aDevelopper = (v: Pick<VueMonde, 'cases' | 'ouverte'>, annee: number): boolean =>
  estFermee(v.cases.find((k) => k.annee === annee)) || annee > v.ouverte.annee

/**
 * Le développement de la plaque d'une année ouverte, de 0 (négative) à 1 (développée). Il ne se
 * joue que pour l'année où le membre vient d'arriver sous les yeux : `VueMonde.ouverte.t0` vaut -9
 * sans cela, neuf secondes avant toute horloge, et la plaque est alors posée développée (la durée
 * tient donc sous neuf secondes, `monde1900.test.ts` le garde). Au calme, elle l'est toujours.
 */
export function developpement(v: Pick<VueMonde, 'ouverte' | 't' | 'vivant'>, annee: number): number {
  if (!v.vivant || v.ouverte.annee !== annee) return 1
  return clamp(((v.t - v.ouverte.t0) * 1000) / DEVELOPPEMENT, 0, 1)
}

/** Retourne en négatif ce qui vient d'être peint dans le rectangle, sans lire un pixel. */
export function negatif(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.globalCompositeOperation = 'difference'
  g.fillStyle = c('#ffffff')
  g.fillRect(x, y, w, h)
  g.globalCompositeOperation = 'saturation'
  g.fillStyle = c('#000000')
  g.fillRect(x, y, w, h)
  g.globalCompositeOperation = 'source-over'
}

/**
 * La photographie d'une gare, posée (maquette : `.gare .photo`, l. 107-109) : son ciel se fond dans
 * le paysage par le haut (`POSE`, premier nombre) et par les côtés (second), sous un voile qui
 * s'éteint à la même hauteur. `negative`, c'est la plaque à développer : retournée sur sa propre
 * toile, elle n'inverse plus le paysage derrière ses bords fondus. Nulle sans toile hors écran.
 */
function gareCuite(annee: number, photo: CanvasImageSource, genre: 'positive' | 'negative' | 'bas' | 'haut'): CanvasImageSource | null {
  return poseCuite(String(annee), TAILLES[`g${annee}`]!, POSE[annee]!, photo, genre)
}

/** Une photographie posée sous sa `POSE`, cuite sous le nom `nom` : une gare, ou le quai de départ. */
function poseCuite(nom: string, [lp, hp]: readonly [number, number], [ciel, cote]: readonly [number, number], photo: CanvasImageSource, genre: 'positive' | 'negative' | 'bas' | 'haut'): CanvasImageSource | null {
  // La gare de 1900 emplit la vitre (l. 2774-2783) : son bas se fond de 53 % à 60 % ; son haut est un calque à part.
  const [de, a] = genre === 'bas' ? [53, 60] : [0, ciel]
  return cuire(`gare:${nom}:${genre}`, lp, hp, (g, w, h) => {
    g.drawImage(photo, 0, 0, w, h)
    if (genre !== 'haut') {
      g.globalCompositeOperation = 'multiply'
      const voile = g.createLinearGradient(0, 0, 0, h)
      voile.addColorStop(0, c('#c6b99c'))
      voile.addColorStop(a / 100, c('#ffffff'))
      voile.addColorStop(1, c('#ffffff'))
      g.fillStyle = voile
      g.fillRect(0, 0, w, h)
      g.globalCompositeOperation = 'source-over'
    }
    if (genre === 'negative') negatif(g, 0, 0, w, h)
    fondre(g, 0, 0, w, 0, [[0, 0], [cote / 100, 1], [1 - cote / 100, 1], [1, 0]], w, h)
    if (genre === 'haut') fondre(g, 0, 0, 0, h, [[0, 0], [0.025, 1], [0.55, 1], [0.62, 0], [1, 0]], w, h)
    else fondre(g, 0, 0, 0, h, [[0, 0], [de / 100, 0], [a / 100, 1], [1, 1]], w, h)
  })
}

/**
 * Pose la gare développée. Celle de 1900 en deux calques : la brume du matin, le bas de la photo,
 * puis son haut en `multiply`, qui laisse disparaître le ciel blanc de la plaque de lanterne et
 * garde la tour sur le ciel de l'heure. La maquette ôte ce ciel par un filtre SVG (`#sans-ciel`,
 * l. 110-113) : `ctx.filter` n'est pas vérifié sur Safari, et le dessin ne lit aucun pixel.
 */
function poserLaPositive(g: CanvasRenderingContext2D, annee: number, photo: CanvasImageSource, p: { x: number; y: number; w: number; h: number }): boolean {
  if (annee !== 1900) {
    const cuite = gareCuite(annee, photo, 'positive')
    if (cuite) g.drawImage(cuite, p.x, p.y, p.w, p.h)
    return cuite !== null
  }
  const bas = gareCuite(annee, photo, 'bas')
  const haut = gareCuite(annee, photo, 'haut')
  if (!bas || !haut) return false
  // La brume (maquette : `.gare .brume`, l. 115) porte la silhouette et cache la plaine de la toile lointaine.
  g.save()
  g.translate(p.x + p.w / 2, p.y + p.h * 0.375)
  g.scale(p.w * 0.47, p.h * 0.325)
  const brume = g.createRadialGradient(0, 0, 0, 0, 0, 1)
  brume.addColorStop(0, c('#e3d6bb'))
  brume.addColorStop(0.42, c('#e3d6bb'))
  brume.addColorStop(1, c('#e3d6bb', 0))
  g.fillStyle = brume
  g.fillRect(-1, -1, 2, 2)
  g.restore()
  g.drawImage(bas, p.x, p.y, p.w, p.h)
  g.globalCompositeOperation = 'multiply'
  g.drawImage(haut, p.x, p.y, p.w, p.h)
  g.globalCompositeOperation = 'source-over'
  return true
}

/**
 * Pose la photographie d'une gare : développée, ou en plaque négative sous laquelle le positif
 * monte (`revele`, de 0 à 1 ; maquette : `.fermee .photo`, `.positif`). Sans toile hors écran, la
 * photo est posée entière et retournée sur place, comme avant l'habillage.
 */
function poserLaGare(g: CanvasRenderingContext2D, annee: number, photo: CanvasImageSource, p: { x: number; y: number; w: number; h: number }, revele: number): void {
  if (revele < 1) {
    const plaque = gareCuite(annee, photo, 'negative')
    if (plaque) g.drawImage(plaque, p.x, p.y, p.w, p.h)
    else {
      g.drawImage(photo, p.x, p.y, p.w, p.h)
      negatif(g, p.x, p.y, p.w, p.h)
    }
  }
  if (revele <= 0) return
  g.save()
  g.globalAlpha *= revele
  if (!poserLaPositive(g, annee, photo, p)) g.drawImage(photo, p.x, p.y, p.w, p.h)
  g.restore()
}

/** La plaque émaillée : le millésime et le nom du lieu ; grise tant que la plaque est à développer. */
function plaque(g: CanvasRenderingContext2D, x: number, y: number, annee: number, sombre: boolean): void {
  const sous = (sombre ? 'plaque à développer' : LIEU[annee]!).toUpperCase()
  g.font = `10.5px ${F_RAIL}`
  const w = Math.max(84, g.measureText(sous).width + 28)
  const h = HAUTEUR_DE_PLAQUE
  g.fillStyle = c('#000000', 0.5)
  g.fillRect(x - w / 2 + 2, y + 5, w, h)
  g.fillStyle = sombre ? c('#3e3a35') : c('#1d3767')
  g.fillRect(x - w / 2, y, w, h)
  g.strokeStyle = sombre ? c('#bdb3a0') : c('#f4efe2')
  g.lineWidth = 1.5
  g.strokeRect(x - w / 2 + 2.75, y + 2.75, w - 5.5, h - 5.5)
  g.fillStyle = sombre ? c('#d6ccb8') : c('#f4efe2')
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.font = `30px ${F_RAIL}`
  g.fillText(String(annee), x, y + 32)
  g.font = `10.5px ${F_RAIL}`
  g.fillText(sous, x, y + 45)
}

/**
 * Une plaque émaillée à lignes libres, centrée en `x`, son haut en `y` (maquette : `.emaillee`,
 * `.plaque-quai`, `.borne span`) : chaque ligne porte son texte et son corps.
 */
export function emaillee(g: CanvasRenderingContext2D, x: number, y: number, lignes: ReadonlyArray<readonly [string, number]>): void {
  let w = 0
  let h = 12
  for (const [texte, corps] of lignes) {
    g.font = `${corps}px ${F_RAIL}`
    w = Math.max(w, g.measureText(texte).width + 30)
    h += corps + 2
  }
  g.fillStyle = c('#000000', 0.5)
  g.fillRect(x - w / 2 + 2, y + 5, w, h)
  g.fillStyle = c('#1d3767')
  g.fillRect(x - w / 2, y, w, h)
  g.strokeStyle = c('#f4efe2')
  g.lineWidth = 1.5
  g.strokeRect(x - w / 2 + 2.75, y + 2.75, w - 5.5, h - 5.5)
  g.fillStyle = c('#f4efe2')
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  let ligne = y + 6
  for (const [texte, corps] of lignes) {
    ligne += corps + 1
    g.font = `${corps}px ${F_RAIL}`
    g.fillText(texte, x, ligne)
    ligne += 1
  }
}

/**
 * Le quai de 1899 tel qu'on le revoit par la vitre une fois assis, une gare avant celle de 1900
 * (maquette : `.gare.depart`, l. 2755-2760 et 2963-2971) : le même lieu que le quai du passage.
 */
export function departALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>): { x: number; y: number; w: number; h: number } {
  const [lp, hp] = TAILLES.quai!
  const h = v.H * 0.4
  const w = (h * lp) / hp
  return { x: milieuDeLaGare(v, -1) - w / 2, y: v.H * 0.81 - h, w, h }
}

/** La borne de frontière entre 1899 et 1900, à mi-chemin du quai et de la gare (maquette : `.borne`, l. 569-573 et 2973) : son milieu, son haut, sa hauteur. */
export function borneALEcran(v: Pick<VueMonde, 'W' | 'H' | 'avance'>): { x: number; y: number; h: number } {
  return { x: milieuDeLaGare(v, -0.5), y: v.H * 0.35, h: v.H * 0.46 }
}

/** Le quai de départ et la borne : ce que le train laisse derrière lui avant la gare de 1900. */
function dessinerDepart(v: VueMonde): void {
  const g = v.ctx
  const d = departALEcran(v)
  if (d.x + d.w > 0 && d.x < v.W) {
    const url = imageDu1900('quai')
    const photo = url ? v.image(url) : null
    if (photo) g.drawImage(poseCuite('quai', TAILLES.quai!, POSE.quai!, photo, 'positive') ?? photo, d.x, d.y, d.w, d.h)
    emaillee(g, d.x + d.w * 0.73, d.y + d.h * 0.08, [['1899', 30], ['QUAI DE DÉPART', 10.5]])
  }
  const b = borneALEcran(v)
  if (b.x > -80 && b.x < v.W + 80) {
    for (let y = 0; y < b.h; y += 14) {
      g.fillStyle = (y / 14) % 2 === 0 ? c('#f4efe2') : c('#1d3767')
      g.fillRect(b.x - 4.5, b.y + y, 9, Math.min(14, b.h - y))
    }
    g.fillStyle = c('#000000', 0.25)
    g.fillRect(b.x + 2.5, b.y, 2, b.h)
    emaillee(g, b.x, b.y + b.h * 0.04, [['FRONTIÈRE', 10], ['1900', 21]])
  }
}

/** Une dépêche épinglée (maquette : `.date-vraie`, l. 980-981) : un papier bleuté, penché, sous une punaise rouge. */
function depeche(v: VueMonde, rang: number, x: number, y: number): void {
  const g = v.ctx
  const d = DATES[rang]!
  g.save()
  g.translate(x, y)
  g.rotate(-0.07)
  g.font = `700 10.5px ${F_PRESSE}`
  const w = g.measureText(d.court).width + 16
  g.fillStyle = c('#000000', 0.45)
  g.fillRect(-w / 2 + 1, -8, w, 20)
  g.fillStyle = c('#d9e0ea')
  g.fillRect(-w / 2, -10, w, 20)
  g.fillStyle = c('#1d3767')
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(d.court, 0, 0.5)
  g.textBaseline = 'alphabetic'
  g.fillStyle = c('#a8352a')
  g.beginPath()
  g.arc(0, -10, 3, 0, Math.PI * 2)
  g.fill()
  // Une dépêche passe devant la zone `case` de sa gare (priorité 2), derrière une bobine (3).
  v.zone('date', 0, 0, 26, rang, 2)
  g.restore()
}

/**
 * La toile des gares (rapport 2/5 ; maquette : `.gares`, l. 105-122 et 3074) : une photographie
 * par année, posée dans le paysage (`POSE`), sa plaque émaillée et le nom du lieu ; une année fermée en plaque négative, qui se
 * développe à l'ouverture ; puis ce qu'une gare ouverte porte, ses dépêches et sa bobine perdue.
 */
export function dessinerMoyen(v: VueMonde): void {
  if (!ouvrir(v)) return
  const g = v.ctx
  const aLEcran = (x: number, marge: number) => x > -marge && x < v.W + marge
  dessinerDepart(v)
  ANNEES.forEach((annee, i) => {
    const p = gareALEcran(v, i)
    if (p.x + p.w < 0 || p.x > v.W) return
    const sombre = aDevelopper(v, annee)
    const revele = sombre ? 0 : developpement(v, annee)
    const url = imageDu1900(`g${annee}`)
    const photo = url ? v.image(url) : null
    if (photo) poserLaGare(g, annee, photo, p, revele)
    const pl = plaqueDeLaGare(v, i)
    plaque(g, pl.x, pl.y, annee, sombre)
  })
  // Une dépêche et une bobine ne se montrent que dans une gare développée, et ne se touchent que
  // dans la fenêtre de la section : hors d'elle, leur zone resterait, invisible, sur le monde voisin.
  DATES.forEach((d, rang) => {
    if (aDevelopper(v, d.an)) return
    const place = PLACES_DES_DEPECHES[rang]!
    const x = milieuDeLaGare(v, d.an - 1900) + place.dx
    const y = v.H * (1 - place.bas / 100) - 10
    if (aLEcran(x, 60) && dansLaFenetre(v, y)) depeche(v, rang, x, y)
  })
  CACHETTES.forEach((b, rang) => {
    if (aDevelopper(v, b.an)) return
    const x = milieuDeLaGare(v, b.an - 1900) + b.dx
    const y = v.H * (1 - b.bas / 100) - 12
    if (aLEcran(x, 30) && dansLaFenetre(v, y)) v.bobine(rang, x, y, 8)
  })
  g.restore()
}
