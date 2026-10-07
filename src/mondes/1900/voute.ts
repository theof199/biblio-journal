import type { VueMonde } from '../types'
import { dessinerFicelle } from './accroches'
import { c } from './couleur'
import { cuire } from './cuisson'
import { imageDu1900, TAILLES } from './images'
import { L_BOUCHE, L_PAROI, type TunnelALEcran } from './tunnel'

/**
 * Le trait du tunnel (idée 71 ; maquette : `.tunnel`, l. 1101-1108, `boucheSVG` et `paroiSVG`,
 * l. 3573-3628) : le noir, la paroi qui défile sous ses lampes, un reflet léger du compartiment,
 * puis les deux bouches de pierre par-dessus. Chaque « où » et chaque « combien » vient de
 * `tunnel.ts` ; ici, rien que le trait. Aucune zone n'est inscrite. Une bouche et le motif de la
 * paroi se cuisent une fois (`cuire`) ; sans toile hors écran (jsdom), il ne reste que le noir.
 *
 * Trois écarts à la maquette. L'ouverture de la bouche est percée dans le mur de tête : la maquette
 * y laisse voir le mur sous un dégradé qui s'efface, alors que son noir commence au pied-droit ; ici
 * la paroi s'y voit. Ni la paroi ni ses lampes ne sont floutées (`feGaussianBlur`) : les lampes sont
 * peintes en dégradés, les moellons nets sur une tuile cuite petite. Le reflet du compartiment n'est
 * pas viré (`sepia`, `brightness`), ni celui des affiches, dont l'écart (12 px dans la maquette)
 * grossit avec elles au lieu d'être posé.
 */

/** Le hasard rejouable de la maquette, à la graine de chaque dessin (57,3 pour la bouche, 33,7 pour la paroi). */
const hasard = (graine: number) => (k: number): number => {
  const x = Math.sin(k * graine) * 43758.5453
  return x - Math.floor(x)
}

/** Le repère d'une bouche (maquette : `viewBox="-60 0 360 700"`) et sa finesse : cuite deux fois plus grande que posée. */
const HAUT_DE_BOUCHE = 700
const FINESSE = 2
/** La hauteur du motif de la paroi, étiré sur celle de l'écran (maquette : `viewBox="0 0 480 300"`). */
const HAUT_DE_PAROI = 300
const NOIR = '#070504'

/** L'ouverture : du pied-droit à la clé de l'arc, qui est au bout de la bouche. */
const OUVERTURE = 'M178 700 V330 A122 330 0 0 1 300 0 V700 Z'

/** Un dégradé rond dans une ellipse, du centre au bord. */
function ovale(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, arrets: ReadonlyArray<readonly [number, string]>): void {
  g.save()
  g.translate(x, y)
  g.scale(rx, ry)
  const d = g.createRadialGradient(0, 0, 0, 0, 0, 1)
  for (const [ou, teinte] of arrets) d.addColorStop(ou, teinte)
  g.fillStyle = d
  g.fillRect(-1, -1, 2, 2)
  g.restore()
}

/**
 * La bouche du tunnel, côté jour (maquette : `boucheSVG`) : le talus et ses herbes, le mur de tête
 * en pierres de taille, l'arc et ses claveaux, l'ouverture qui se perd dans le noir vers la droite.
 * La sortie est la même, retournée. Elle ne se peint que sur une toile à elle : l'ouverture y est
 * percée (`destination-out`), ce qui trouerait l'écran.
 */
function peindreBouche(g: CanvasRenderingContext2D, w: number, h: number): void {
  if (typeof Path2D === 'undefined') return
  const alea = hasard(57.3)
  g.scale(w / L_BOUCHE, h / HAUT_DE_BOUCHE)
  g.translate(60, 0)
  const trait = (d: string, teinte: string, epaisseur: number): void => {
    g.strokeStyle = teinte
    g.lineWidth = epaisseur
    g.stroke(new Path2D(d))
  }
  // Le talus, ses herbes, et son ombre au pied du mur.
  const talus = g.createLinearGradient(0, 240, 0, 700)
  talus.addColorStop(0.3, c('#55543a'))
  talus.addColorStop(1, c('#2b291b'))
  g.fillStyle = talus
  g.fill(new Path2D('M-60 700 V636 C-10 620 45 490 96 240 V700 Z'))
  let herbes = ''
  for (let k = 0; k < 24; k++) {
    const t = k / 23
    const q = 1 - t
    const x = -60 * q * q * q - 30 * q * q * t + 135 * q * t * t + 96 * t * t * t
    const y = 636 * q * q * q + 1860 * q * q * t + 1470 * q * t * t + 240 * t * t * t
    herbes += `M${x.toFixed(0)} ${(y + 4).toFixed(0)} l${(-3 + alea(k) * 5).toFixed(1)} ${(-9 - alea(k + 20) * 9).toFixed(1)} M${(x + 3).toFixed(0)} ${(y + 4).toFixed(0)} l${(1 + alea(k + 40) * 4).toFixed(1)} ${(-7 - alea(k + 60) * 8).toFixed(1)} `
  }
  trait(herbes, c('#6d6c44'), 1.6)
  g.fillStyle = c('#000000', 0.22)
  g.fillRect(88, 250, 12, 450)
  // Le mur de tête : ses assises, ses pierres plus claires ou plus sombres, ses joints.
  const mur = g.createLinearGradient(0, 0, 0, 700)
  mur.addColorStop(0, c('#7c7260'))
  mur.addColorStop(1, c('#5b5343'))
  g.fillStyle = mur
  g.fillRect(92, 0, 208, 700)
  g.save()
  g.beginPath()
  g.rect(92, 0, 208, 700)
  g.clip()
  let joints = ''
  for (let r = 0; r < 20; r++) {
    const y = r * 35
    joints += `M92 ${y} H300 `
    for (let x = 92 + (r % 2) * 26 + alea(r) * 14, k = 0; x < 300; k++) {
      const l = 44 + alea(r * 9 + k) * 22
      joints += `M${x.toFixed(0)} ${y} v35 `
      if (alea(r * 13 + k + 5) > 0.55) {
        g.fillStyle = c(alea(r + k) > 0.5 ? '#000000' : '#ffffff', 0.04 + alea(r * 3 + k) * 0.07)
        g.fillRect(Math.round(x), y, Math.round(l), 35)
      }
      x += l
    }
  }
  g.restore()
  // Les pierres du pied-droit, une assise sur deux.
  let claveaux = ''
  for (let y = 330; y < 700; y += 41) {
    claveaux += `M149 ${y} H178 `
    if (((y - 330) / 41) % 2 === 0) {
      g.fillStyle = c('#9a8f7a')
      g.fillRect(134, y, 16, 41)
      g.strokeStyle = c('#3c352a')
      g.lineWidth = 1
      g.strokeRect(134, y, 16, 41)
    }
  }
  trait(joints, c('#3c352a', 0.8), 1.5)
  const ombre = g.createLinearGradient(92, 0, 300, 0)
  ombre.addColorStop(0, c('#000000', 0))
  ombre.addColorStop(1, c('#000000', 0.3))
  g.fillStyle = ombre
  g.fillRect(92, 0, 208, 700)
  // La suie des locomotives, au-dessus de l'arc.
  ovale(g, 262, 70, 120, 170, [[0, c('#0b0806', 0.6)], [1, c('#0b0806', 0)]])
  // L'ouverture percée dans le mur : ce qui est dessous (le noir, la paroi) s'y voit.
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = '#000'
  g.fill(new Path2D(OUVERTURE))
  g.globalCompositeOperation = 'source-over'
  // L'arc, ses claveaux, son extrados.
  trait('M163.5 700 V330 A136.5 344.5 0 0 1 300 -14.5', c('#a1957f'), 29)
  for (let a = 4; a < 90; a += 8.6) {
    const co = Math.cos((a * Math.PI) / 180)
    const si = Math.sin((a * Math.PI) / 180)
    claveaux += `M${(300 - 122 * co).toFixed(1)} ${(330 - 330 * si).toFixed(1)} L${(300 - 151 * co).toFixed(1)} ${(330 - 359 * si).toFixed(1)} `
  }
  trait(claveaux, c('#3c352a'), 1.5)
  trait('M149 700 V330 A151 359 0 0 1 300 -29', c('#3c352a'), 1.5)
  // L'intrados : éclairé par le jour au pied-droit, il se perd dans le noir vers la droite.
  const intrados = g.createLinearGradient(178, 0, 300, 0)
  intrados.addColorStop(0, c('#3a2f22'))
  intrados.addColorStop(0.3, c('#17110c', 0.94))
  intrados.addColorStop(1, c('#0a0705', 0))
  g.fillStyle = intrados
  g.fill(new Path2D(OUVERTURE))
  trait(OUVERTURE, c('#120d09'), 2.5)
}

/**
 * Le motif de la paroi (maquette : `paroiSVG`) : des assises de moellons noircis, et une lampe qui
 * file en trait de lumière, une par motif.
 */
function peindreParoi(g: CanvasRenderingContext2D, w: number, h: number): void {
  const alea = hasard(33.7)
  g.scale(w / L_PAROI, h / HAUT_DE_PAROI)
  for (let r = 0; r < 10; r++) {
    for (let k = 0, x = -((r * 37) % 60); x < L_PAROI; k++) {
      const l = 50 + alea(r * 7 + k) * 44
      g.fillStyle = c('#d8b98a', 0.035 + alea(r * 11 + k + 3) * 0.075)
      g.fillRect(Math.round(x), r * 30 + 1.5, Math.round(l - 4), 27)
      x += l
    }
  }
  ovale(g, 240, 98, 200, 64, [[0, c('#ffc878', 0.5)], [0.45, c('#ff9c46', 0.14)], [1, c('#ff9c46', 0)]])
  const suie = g.createLinearGradient(0, 0, 0, HAUT_DE_PAROI)
  suie.addColorStop(0, c('#040302', 0.9))
  suie.addColorStop(0.3, c('#040302', 0))
  suie.addColorStop(0.72, c('#040302', 0))
  suie.addColorStop(1, c('#040302', 0.85))
  g.fillStyle = suie
  g.fillRect(0, 0, L_PAROI, HAUT_DE_PAROI)
  // La lampe : une lueur allongée, et son filament.
  ovale(g, 240, 98, 104, 5.5, [[0, c('#ffdc9c', 0.95)], [0.6, c('#ffdc9c', 0.5)], [1, c('#ffdc9c', 0)]])
  const filament = g.createLinearGradient(196, 0, 284, 0)
  filament.addColorStop(0, c('#fff6e0', 0))
  filament.addColorStop(0.2, c('#fff6e0'))
  filament.addColorStop(0.8, c('#fff6e0'))
  filament.addColorStop(1, c('#fff6e0', 0))
  g.fillStyle = filament
  g.fillRect(196, 96.8, 88, 2.4)
}

/**
 * Le reflet léger du compartiment sur la vitre (maquette : `.miroir`, l. 1105) : sa photographie,
 * déjà chargée par le passage, retournée et couvrant l'écran.
 */
function miroir(v: VueMonde): void {
  const url = imageDu1900('interieur')
  const photo = url ? v.image(url) : null
  if (!photo) return
  const g = v.ctx
  const [lp, hp] = TAILLES.interieur!
  const e = Math.max(v.W / lp, v.H / hp)
  g.save()
  g.globalAlpha *= 0.14
  g.translate(v.W, 0)
  g.scale(-1, 1)
  g.drawImage(photo, (v.W - lp * e) * 0.5, (v.H - hp * e) * 0.4, lp * e, hp * e)
  g.restore()
}

/**
 * Le reflet des affiches de la ficelle (idée 72 ; maquette : `.tunnel .accroches`, l. 1115-1116) :
 * plus haut et plus grandes que dans le compartiment (46 px pour 40), à peine visibles. Elles sont
 * sœurs du miroir dans la maquette, pas ses enfants : elles ne sont pas retournées, et se voient
 * sans la photographie du compartiment.
 */
function reflets(v: VueMonde): void {
  const g = v.ctx
  g.save()
  g.globalAlpha *= 0.24
  dessinerFicelle(v, v.W * 0.5, v.H * 0.47, 46 / 40)
  g.restore()
}

/** Ce qui se voit dans le tunnel, découpé à la part de l'écran que le noir couvre (maquette : `.dedans`, l. 1103-1106). */
function dedans(v: VueMonde, t: TunnelALEcran, noir: { x: number; w: number }): void {
  const g = v.ctx
  g.save()
  g.beginPath()
  g.rect(noir.x, 0, noir.w, v.H)
  g.clip()
  g.fillStyle = c(NOIR)
  g.fillRect(noir.x, 0, noir.w, v.H)
  const tuile = cuire('tunnel:paroi', L_PAROI, HAUT_DE_PAROI, peindreParoi)
  if (tuile) {
    for (let x = -t.paroi; x < noir.x + noir.w; x += L_PAROI) {
      if (x + L_PAROI > noir.x) g.drawImage(tuile, x, 0, L_PAROI, v.H)
    }
  }
  miroir(v)
  reflets(v)
  // La lueur des lampes au plafond, et l'ombre qui gagne les bords de la vitre.
  ovale(g, v.W * 0.5, -v.H * 0.07, v.W * 0.96, v.H * 0.22, [[0, c('#ffc46e', 0.13)], [0.72, c('#ffc46e', 0)], [1, c('#ffc46e', 0)]])
  ovale(g, v.W * 0.5, v.H * 0.46, v.W * 0.5 * Math.SQRT2, v.H * 0.54 * Math.SQRT2, [[0, c('#040302', 0)], [0.42, c('#040302', 0)], [1, c('#040302', 0.62)]])
  g.restore()
}

/**
 * Le tunnel sur la vitre, dans le contexte déjà ouvert et coupé par `ouvrir` (`dessus.ts`), après la
 * météo, qu'il couvre. `t` vient de `tunnelALEcran` : hors du tunnel, il est nul et rien n'est appelé.
 */
export function dessinerTunnel(v: VueMonde, t: TunnelALEcran): void {
  const g = v.ctx
  g.save()
  g.globalAlpha *= t.presence
  if (t.noir) dedans(v, t, t.noir)
  const bouche = cuire(`tunnel:bouche:${Math.round(v.H)}`, L_BOUCHE * FINESSE, v.H * FINESSE, peindreBouche)
  if (bouche) {
    if (t.entree > 0 && t.entree - L_BOUCHE < v.W) g.drawImage(bouche, t.entree - L_BOUCHE, 0, L_BOUCHE, v.H)
    if (t.sortie < v.W && t.sortie + L_BOUCHE > 0) {
      g.translate(t.sortie + L_BOUCHE, 0)
      g.scale(-1, 1)
      g.drawImage(bouche, 0, 0, L_BOUCHE, v.H)
    }
  }
  g.restore()
}
