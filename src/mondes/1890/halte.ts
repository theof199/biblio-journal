import type { VueMonde } from '../types'
import { RAMPE } from './couleur'
import { cercle, halo, ombre, poly, rr, silhouette } from './moyen'
import { lisse, type Rgb } from '../../carte/outils'

/**
 * La halte au bout de la foire (demande du propriétaire, 7 octobre 2026 : « à la fin du chemin
 * mettre un train pour qu'on remarque mieux que ça n'est pas fini à 1899 » ; choisie sur captures le
 * 8, après le refus des photographies d'époque, « la photo d'époque ne colle pas bien »). Une petite
 * gare dessinée de la main du guichet et de la baraque « Prochainement » : des aplats, les bois et
 * les noirs de la rampe, la toile rayée rouille et crème, une ombre en ellipse, des lampes à halo.
 * Elle est posée sur le bout de la pellicule, sous la case de 1899, une voie devant elle.
 *
 * Trois états, et rien n'y nomme 1900 :
 * - **sans ticket**, la halte seule, dès 1895 : elle perce la brume de l'avenir, où elle n'est
 *   qu'une ombre et ses fenêtres ; porte close, sémaphore à l'arrêt. Un décor : aucune zone ;
 * - **le ticket du monde d'après émis** (`v.ticketDApres`), un train vient se ranger à quai devant
 *   elle, le nez contre la pellicule, et n'en repart plus : ni au compostage du ticket, ni 1900
 *   ouvert, ni plus loin dans le Voyage. Tant que 1900 est fermé il ne répond pas plus que la gare ;
 * - **1900 ouvert** (`v.passer` n'est plus nul), la porte s'éclaire, le bras du sémaphore se lève,
 *   et toucher la gare ou le train lance le passage que lance le bouton « Prendre le train »
 *   (`MoteurCarte.direBonjour`), au calme aussi.
 *
 * Seuls bougent, et seulement si `v.vivant`, le tremblement des lampes et la fumée de la machine :
 * au calme, la même image à toute heure.
 */
export const ZONE_DE_LA_HALTE = 'halte'

/**
 * Sa place, dans le repère de la section : l'axe du bâtiment, son sol, sa demi-largeur (les ailes)
 * et sa hauteur (le pignon de l'horloge) ; le rail de la voie qui passe devant ; le nez du train à
 * quai, juste à gauche de la pellicule, qui sort de la porte entre x = 184 et x = 242 une fois 1900
 * ouvert. La case de 1899 est en (130, 695), la baraque « Prochainement » en (322, 690) et finit en
 * y = 751, la bobine sous la brume en (96, 1060), le bec de gaz en x = 376.
 */
export const HALTE = { cx: 213, sol: 908, demi: 72, haut: 84, rail: 918, nez: 178, echelle: 0.85 } as const

/** Ce que la halte montre : le train à quai, et si elle répond au toucher. */
export interface Depart {
  train: boolean
  ouvert: boolean
}

/**
 * Le train suit le ticket, le toucher suit le passage. 1900 ouvert vaut ticket émis : le train ne
 * dépend pas de la lecture des tickets, que la page fait à part, une fois le monde d'après atteint.
 */
export const departDe = (v: Pick<VueMonde, 'passer' | 'ticketDApres'>): Depart => ({ train: v.ticketDApres || v.passer !== null, ouvert: v.passer !== null })

type Rond = readonly [x: number, y: number, r: number]
/** Trois ronds couvrent le bâtiment, d'une aile à l'autre et du quai au pignon de l'horloge ; deux autres, le train, à quai dès que 1900 est ouvert. */
const RONDS: readonly Rond[] = [
  [HALTE.cx - 34, HALTE.sol - 34, 44],
  [HALTE.cx + 34, HALTE.sol - 34, 44],
  [HALTE.cx, HALTE.sol - 50, 40],
  [HALTE.nez - 62, HALTE.rail - 18, 38],
  [HALTE.nez - 132, HALTE.rail - 18, 38],
]

/** Où la halte se touche, dans le repère de la section : nulle part tant que 1900 est fermé. */
export const zonesDeLaHalte = (d: Depart): readonly Rond[] => (d.ouvert ? RONDS : [])

/** Le toucher de la halte : le passage du bouton, ou rien tant que 1900 est fermé. Il ne date rien. */
export function prendreLeTrain(v: Pick<VueMonde, 'passer'>): void {
  v.passer?.()
}

const F_A = 'Limelight, Didot, Georgia, serif'
/** Ce que la brume de l'avenir laisse d'un décor : une seule teinte, un peu plus sombre qu'elle. */
const DANS_LA_BRUME: Rgb = [57, 45, 33]
type Encre = (hex: string, a?: number) => string

/**
 * De 0 (à l'air libre) à 1 (sous la brume) pour ce qui pose son pied en `y` de la section. La halte
 * se devine de loin et se précise en approchant : en 1899, la brume est à sa porte et elle est
 * nette ; en 1895, elle n'est qu'une ombre et ses lumières.
 */
const voile = (v: Pick<VueMonde, 'brume'>, y: number): number => lisse(70, 400, y - v.brume)
/** L'encre d'un décor que la brume prend : la couleur de la rampe, fondue vers la teinte de la brume. */
function encre(m: number): Encre {
  return (hex, a = 1) => {
    const [r, g, b] = RAMPE.rgb(hex)
    const f = (x: number, y: number) => Math.round(x + (y - x) * m)
    return `rgba(${f(r, DANS_LA_BRUME[0])},${f(g, DANS_LA_BRUME[1])},${f(b, DANS_LA_BRUME[2])},${a})`
  }
}
/** Le tremblement d'une flamme (celui du guichet), fixe au calme. */
const flamme = (v: VueMonde, ph = 0): number => (v.vivant ? 0.85 + 0.15 * Math.sin(v.t * 5.3 + ph) * Math.sin(v.t * 2.2 + ph) : 0.9)

/** Une lumière qui perce la brume : elle ne se fond pas, elle. */
function lumiere(g: CanvasRenderingContext2D, v: VueMonde, x: number, y: number, r: number, hex: string, force: number, m: number): void {
  const a = Math.min(1, force)
  g.fillStyle = RAMPE.couleur(hex, a)
  cercle(g, x, y, r)
  halo(g, x, y, r * 7, hex, (0.28 + 0.22 * m) * a * (0.5 + 0.5 * v.nuit + 0.4 * m))
  v.feu(x, y, r * 9, 'or', v.presence * a * 0.7)
}
/** Une vitre éclairée (la fenêtre du guichet). */
function vitre(g: CanvasRenderingContext2D, e: Encre, x: number, y: number, w: number, h: number, allumee: number): void {
  g.fillStyle = e('#2b1c14'); g.fillRect(x - 1, y - 1, w + 2, h + 2)
  g.fillStyle = RAMPE.couleur('#F2CD8C', Math.min(1, 0.5 + 0.4 * allumee))
  g.fillRect(x, y, w, h)
}

/** La voie vue de côté, de `x0` à `x1` : le rail, ses traverses ; elle s'efface avant `x1`. `trou` : là où passe la pellicule. */
function voieDeProfil(g: CanvasRenderingContext2D, e: Encre, x0: number, x1: number, y: number, trou: readonly [number, number] | null): void {
  for (let x = x0; x < x1; x += 6) {
    if (trou && x > trou[0] - 6 && x < trou[1]) continue
    const a = Math.min(1, (x1 - x) / 46)
    g.fillStyle = e('#2b1c14', 0.75 * a); g.fillRect(x + 1, y + 1, 3.4, 2.4)
    g.fillStyle = e('#0c0806', a); g.fillRect(x, y - 0.8, 6.2, 1.7)
    g.fillStyle = e('#9a7a50', 0.55 * a); g.fillRect(x, y - 1.3, 6.2, 0.5)
  }
}

/** Le sémaphore : un mât en treillis, son bras rouille barré de crème (à l'arrêt, ou levé : voie libre), sa lanterne. */
function semaphore(g: CanvasRenderingContext2D, v: VueMonde, e: Encre, m: number, x: number, y: number, h: number, libre: boolean): void {
  ombre(g, x + 1, y + 1, 9, 2.2, 0.38 * (1 - m))
  g.fillStyle = e('#0c0806'); g.fillRect(x - 4.5, y - 4, 9, 4)
  g.strokeStyle = e('#1c140c'); g.lineWidth = 1.3; g.lineCap = 'butt'
  g.beginPath(); g.moveTo(x - 2.8, y - 4); g.lineTo(x - 1.6, y - h); g.moveTo(x + 2.8, y - 4); g.lineTo(x + 1.6, y - h); g.stroke()
  g.lineWidth = 0.7
  g.beginPath()
  for (let j = 0, yy = y - 6; yy - 7 > y - h; yy -= 7, j++) {
    if (j % 2) { g.moveTo(x - 2.6, yy); g.lineTo(x + 2.4, yy - 7) } else { g.moveTo(x + 2.6, yy); g.lineTo(x - 2.4, yy - 7) }
  }
  g.stroke()
  g.fillStyle = e('#0c0806'); poly(g, [[x - 3, y - h], [x + 3, y - h], [x, y - h - 6]]); g.fill()
  g.save(); g.translate(x, y - h + 9); g.rotate(libre ? 0.82 : 0)
  g.fillStyle = e('#0c0806'); g.fillRect(-2, -3.6, 9, 7.2)
  g.fillStyle = e('#A8452F'); g.fillRect(-25, -3, 23, 6)
  g.fillStyle = e('#E9DCC0'); g.fillRect(-20, -3, 4.5, 6)
  g.restore()
  lumiere(g, v, x + 6, y - h + 18, 2.4, libre ? '#F6D98A' : '#DE7A45', flamme(v, 1.7) * (libre ? 1 : 0.85), m)
}

/** Le bâtiment : deux ailes basses, le corps et son pignon à horloge, le fronton « DÉPARTS », la marquise, le quai. */
function batiment(g: CanvasRenderingContext2D, e: Encre, fl: number, nuit: number, ouvert: boolean): void {
  const { cx, sol } = HALTE
  // Les deux ailes basses, leur toit, leur fenêtre.
  for (const d of [-1, 1]) {
    const x0 = d < 0 ? cx - 72 : cx + 38
    g.fillStyle = e('#553b26'); g.fillRect(x0, sol - 30, 34, 30)
    g.fillStyle = e('#2b1c14'); poly(g, [[x0 - 3, sol - 30], [x0 + 37, sol - 30], [x0 + 31, sol - 42], [x0 + 3, sol - 42]]); g.fill()
    vitre(g, e, x0 + 12, sol - 20, 10, 12, fl)
  }
  // Le corps central : le mur, ses assises, le toit, les cheminées.
  g.fillStyle = e('#5a3e26'); g.fillRect(cx - 38, sol - 54, 76, 54)
  g.fillStyle = e('#6b4a2a', 0.7)
  for (let y = sol - 46; y < sol - 26; y += 8) g.fillRect(cx - 38, y, 76, 1)
  g.fillStyle = e('#2b1c14')
  g.fillRect(cx - 29, sol - 81, 5, 10); g.fillRect(cx + 24, sol - 81, 5, 10)
  poly(g, [[cx - 42, sol - 54], [cx + 42, sol - 54], [cx + 32, sol - 73], [cx - 32, sol - 73]]); g.fill()
  // Le pignon de l'horloge.
  g.fillStyle = e('#5a3e26'); poly(g, [[cx - 13, sol - 54], [cx + 13, sol - 54], [cx + 13, sol - 70], [cx, sol - 83], [cx - 13, sol - 70]]); g.fill()
  g.strokeStyle = e('#2b1c14'); g.lineWidth = 2.4; g.lineJoin = 'miter'
  g.beginPath(); g.moveTo(cx - 16, sol - 68); g.lineTo(cx, sol - 84); g.lineTo(cx + 16, sol - 68); g.stroke()
  g.fillStyle = e('#20150d'); cercle(g, cx, sol - 66, 7.2)
  g.fillStyle = e('#E9DCC0'); cercle(g, cx, sol - 66, 5.6)
  g.strokeStyle = e('#20150d'); g.lineWidth = 1; g.lineCap = 'round'
  g.beginPath(); g.moveTo(cx, sol - 66); g.lineTo(cx - 0.6, sol - 70.4); g.moveTo(cx, sol - 66); g.lineTo(cx + 2.8, sol - 64.4); g.stroke()
  // Le fronton : le panneau du guichet, encre sombre et lettres d'or.
  g.fillStyle = e('#20150d'); rr(g, cx - 27, sol - 50, 54, 14, 2.5); g.fill()
  g.strokeStyle = e('#E6B94A', 0.6); g.lineWidth = 0.8; g.stroke()
  g.font = `8.5px ${F_A}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'
  g.fillStyle = e('#E6B94A'); g.fillText('DÉPARTS', cx, sol - 39.6, 48)
  // Le rez-de-chaussée : deux fenêtres, la porte (close, puis éclairée quand le train se prend).
  vitre(g, e, cx - 28, sol - 21, 10, 13, fl)
  vitre(g, e, cx + 18, sol - 21, 10, 13, fl)
  g.fillStyle = e('#20150d')
  g.beginPath(); g.moveTo(cx - 8, sol); g.lineTo(cx - 8, sol - 16); g.arc(cx, sol - 16, 8, Math.PI, 0); g.lineTo(cx + 8, sol); g.closePath(); g.fill()
  if (ouvert) {
    g.fillStyle = RAMPE.couleur('#F2CD8C', Math.min(1, 0.6 + 0.35 * fl))
    g.beginPath(); g.moveTo(cx - 6, sol); g.lineTo(cx - 6, sol - 16); g.arc(cx, sol - 16, 6, Math.PI, 0); g.lineTo(cx + 6, sol); g.closePath(); g.fill()
    halo(g, cx, sol - 10, 26, '#F2CD8C', 0.3 * fl * (0.4 + 0.6 * nuit))
  } else {
    g.strokeStyle = e('#6b4a2a'); g.lineWidth = 0.8
    g.beginPath(); g.moveTo(cx, sol); g.lineTo(cx, sol - 23); g.stroke()
  }
  // La marquise : la toile rayée du guichet, son lambrequin, ses colonnettes.
  g.strokeStyle = e('#20150d'); g.lineWidth = 1.4; g.lineCap = 'butt'
  g.beginPath()
  for (const x of [cx - 60, cx - 36, cx + 36, cx + 60]) { g.moveTo(x, sol - 25); g.lineTo(x, sol) }
  g.stroke()
  g.fillStyle = e('#A8452F'); poly(g, [[cx - 54, sol - 35], [cx + 54, sol - 35], [cx + 65, sol - 25], [cx - 65, sol - 25]]); g.fill()
  g.fillStyle = e('#E9DCC0')
  for (let k = 0; k < 7; k++) {
    const u0 = (k * 2 + 0.5) / 14, u1 = (k * 2 + 1.5) / 14
    poly(g, [[cx - 65 + 130 * u0, sol - 25], [cx - 65 + 130 * u1, sol - 25], [cx - 54 + 108 * u1, sol - 35], [cx - 54 + 108 * u0, sol - 35]]); g.fill()
  }
  g.fillStyle = e('#2b1c14'); g.fillRect(cx - 66, sol - 25.5, 132, 2)
  g.fillStyle = e('#A8452F')
  for (let x = cx - 65; x < cx + 64; x += 6.5) { poly(g, [[x, sol - 23.5], [x + 6.5, sol - 23.5], [x + 3.25, sol - 19.5]]); g.fill() }
  // Le quai.
  g.fillStyle = e('#2b1c14'); g.fillRect(cx - 78, sol - 1, 156, 4)
}

/** Une voiture de profil, son rail en y = 0 : les roues, la caisse, le filet rouille, le toit bombé, les baies. */
function voiture(g: CanvasRenderingContext2D, e: Encre, x0: number, long: number, allumee: number): void {
  g.fillStyle = e('#0c0806')
  for (const dx of [11, 21, long - 21, long - 11]) cercle(g, x0 + dx, -3.6, 3.6)
  g.fillRect(x0 + 3, -9.5, long - 6, 3)
  g.fillRect(x0 + long, -13, 3.2, 1.6)
  g.fillStyle = e('#4a3321'); g.fillRect(x0, -30, long, 21)
  g.fillStyle = e('#3a2819'); g.fillRect(x0, -18, long, 9)
  g.fillStyle = e('#A8452F'); g.fillRect(x0, -19.4, long, 1.5)
  g.fillStyle = e('#1c140c')
  g.beginPath(); g.moveTo(x0 - 2, -29.5); g.quadraticCurveTo(x0 + long / 2, -37, x0 + long + 2, -29.5); g.closePath(); g.fill()
  const n = Math.floor((long - 6) / 16)
  const pas = (long - 6) / n
  g.strokeStyle = e('#2e2014', 0.8); g.lineWidth = 0.8
  for (let i = 0; i < n; i++) {
    const x = x0 + 3 + i * pas
    g.beginPath(); g.moveTo(x, -29); g.lineTo(x, -10); g.stroke()
    g.fillStyle = RAMPE.couleur('#F2CD8C', Math.min(1, 0.5 + 0.4 * allumee))
    g.fillRect(x + 3.5, -27.5, pas - 7, 6.5)
  }
}

/**
 * Le train à quai, de profil : la machine, son tender et deux voitures, la dernière sortant du
 * cadre. Dessiné dans son repère (le nez en x = 0, le rail en y = 0), posé par `HALTE.nez`,
 * `HALTE.rail` et `HALTE.echelle`. Il s'arrête avant la pellicule et laisse voir le fronton et la
 * porte ; le bec de gaz est de l'autre côté.
 */
function trainAQuai(g: CanvasRenderingContext2D, v: VueMonde, e: Encre, m: number, fl: number, ouvert: boolean): void {
  g.save()
  g.translate(HALTE.nez, HALTE.rail); g.scale(HALTE.echelle, HALTE.echelle)
  // La fumée, derrière la machine : cinq bouffées qui montent (immobiles au calme).
  for (let j = 0; j < 5; j++) {
    const u = v.vivant ? (v.t * 0.11 + j / 5) % 1 : (j + 0.5) / 5
    const a = (ouvert ? 0.5 : 0.34) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - 0.5 * m)
    g.fillStyle = RAMPE.couleur('#D8CCB6', a)
    cercle(g, -13 - u * u * 26 + Math.sin(j * 2.4) * 2.5, -47 - u * 54, 3.2 + u * 10)
  }
  ombre(g, -108, 3, 112, 4.5, 0.36 * (1 - m))
  voiture(g, e, -280, 86, fl)
  voiture(g, e, -191, 86, fl)
  // Le tender.
  g.fillStyle = e('#0c0806')
  for (const x of [-97, -88.5, -80]) cercle(g, x, -3.4, 3.4)
  g.fillRect(-76, -13, 3.2, 1.6)
  poly(g, [[-100, -23], [-94, -28], [-86, -26.5], [-77, -23]]); g.fill()
  g.fillStyle = e('#1c140c'); g.fillRect(-102, -24, 27, 16)
  g.fillStyle = e('#A8452F'); g.fillRect(-102, -11.5, 27, 1.3)
  // La machine : l'abri et son foyer, la chaudière, le dôme, la cheminée, les roues et la bielle.
  g.fillStyle = e('#1c140c')
  g.fillRect(-72, -33, 16, 24)
  rr(g, -58, -29, 48, 16, 6); g.fill()
  cercle(g, -39, -29, 4.6)
  g.fillRect(-29, -32.5, 5, 4.5)
  g.fillRect(-25, -14, 13, 6.5)
  g.fillStyle = e('#0c0806')
  g.fillRect(-75, -35.5, 22, 2.6)
  g.fillRect(-15, -30, 7, 18)
  poly(g, [[-16, -29], [-10, -29], [-8.4, -42], [-17.6, -42]]); g.fill()
  g.fillRect(-18.6, -44, 11.2, 2.4)
  g.fillRect(-72, -13.5, 68, 2)
  g.fillRect(-6, -15, 3, 7); g.fillRect(-3, -13, 3.6, 1.7)
  g.fillStyle = e('#9a7a50', 0.6)
  for (const x of [-48, -36.5, -25]) g.fillRect(x, -29, 0.8, 15.5)
  g.fillStyle = e('#A8452F'); g.fillRect(-72, -11.5, 64, 1.3)
  g.fillStyle = RAMPE.couleur('#DE7A45', 0.75 * fl); g.fillRect(-68, -30, 8, 7.5)
  for (const x of [-56.5, -39.5]) {
    g.fillStyle = e('#0c0806'); cercle(g, x, -7.6, 7.6)
    g.strokeStyle = e('#6b4a2a', 0.9); g.lineWidth = 0.8
    g.beginPath(); g.arc(x, -7.6, 5.6, 0, Math.PI * 2); g.stroke()
    g.fillStyle = e('#6b4a2a'); cercle(g, x, -7.6, 1.8)
  }
  g.fillStyle = e('#0c0806'); cercle(g, -22, -3.8, 3.8); cercle(g, -11, -3.8, 3.8)
  g.strokeStyle = e('#9a7a50'); g.lineWidth = 1.4; g.lineCap = 'round'
  g.beginPath(); g.moveTo(-56.5, -5); g.lineTo(-39.5, -5); g.lineTo(-22, -10.5); g.stroke()
  // Le fanal, qui perce la brume.
  lumiere(g, v, -4.5, -19, 2.3, '#FCE2AA', fl, m)
  g.restore()
}

/** Dans le repère de la section (`dessinerSurLaBrume`) : la voie, la halte, le train s'il est à quai, et ses zones si elle répond. */
export function dessinerHalte(g: CanvasRenderingContext2D, v: VueMonde): void {
  const { cx, sol, rail } = HALTE
  const depart = departDe(v)
  const m = voile(v, sol)
  const e = encre(m)
  const fl = flamme(v)
  g.save()
  voieDeProfil(g, e, -8, 366, rail, depart.ouvert ? [184, 242] : null)
  ombre(g, cx, sol + 3, 86, 6, 0.4 * (1 - m))
  batiment(g, e, fl, v.nuit, depart.ouvert)
  semaphore(g, v, e, m, cx - 104, sol + 5, 50, depart.ouvert)
  // Deux voyageurs sur le quai, que la brume efface ; le train à quai, ils attendent à droite.
  if (m < 0.35) {
    g.globalAlpha = 1 - m * 2
    silhouette(g, v, cx + 49, sol + 6, 13, 'homme', 0, false, -1)
    silhouette(g, v, depart.train ? cx + 66 : cx - 47, sol + 6, 13, 'ombrelle', 0, false, 1)
    g.globalAlpha = 1
  }
  if (depart.train) trainAQuai(g, v, e, m, fl, depart.ouvert)
  g.restore()
  for (const [x, y, r] of zonesDeLaHalte(depart)) v.zone(ZONE_DE_LA_HALTE, x, y, r)
}
