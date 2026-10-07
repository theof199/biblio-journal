import { c } from './couleur'
import { cuire, fondre } from './cuisson'
import type { Ambiance } from './donnees'
import { TAILLES } from './images'

/**
 * Les quatre fonds de la toile la plus lente (maquette : `.fond i`, l. 88-94 ; `fondsSVG`,
 * l. 2912-2945) : le ciel de chaque ambiance, et une silhouette pâle sur l'horizon. La montagne garde
 * la photographie `fond` ; la ville, la campagne et la mer sont des tracés, recopiés de la maquette
 * dans son repère de 800 × 350. Ses fumées floutées (`feGaussianBlur`) sont ici des nuées en dégradé :
 * le dessin ne dépend pas de `ctx.filter`.
 */

const alea = (k: number): number => {
  const x = Math.sin(k * 127.1) * 43758.5453
  return x - Math.floor(x)
}
const n1 = (x: number) => x.toFixed(1)

/** Les toits de la ville, en un seul tracé (maquette : `toits`). */
function toits(): string {
  let d = ''
  let x = 0
  let k = 0
  while (x < 800) {
    k++
    const l = 14 + alea(k) * 30
    const h = 14 + alea(k + 50) * 30
    d += `M${n1(x)} 252 V${n1(252 - h)} L${n1(x + l / 2)} ${n1(252 - h - (alea(k + 9) > 0.5 ? 7 : 0))} L${n1(x + l)} ${n1(252 - h)} V252 Z`
    if (alea(k + 20) > 0.55) d += `M${n1(x + l * 0.3)} ${n1(240 - h)} h3.5 v12 h-3.5 Z`
    x += l - 1
  }
  return d
}

const rond = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`
const ovale = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`

type Trace = { d: string; fond: string; alpha: number; repere?: readonly [number, number, number, number] }
type Nuee = readonly [number, number, number, number]
type Fond = { ciel: ReadonlyArray<readonly [number, string]>; traces: () => Trace[]; nuees: { fond: string; alpha: number; ou: readonly Nuee[] } | null }

const FONDS: Record<Ambiance, Fond> = {
  ville: {
    ciel: [[0, '#a4a297'], [0.52, '#cbc2ad'], [0.72, '#dcd0b6']],
    traces: () => {
      const t = toits()
      return [
        { d: t, fond: '#6f675c', alpha: 0.3, repere: [-23, -146, 1.06, 1.58] },
        {
          d: `${t}M0 251 h800 v99 h-800 Z M226 252 V212 h46 V252 Z M229 213 a20 24 0 0 1 40 0 Z M247 176 h4 v15 h-4 Z ${rond(249, 188, 4)} M377 252 L380 168 h5 L388 252 Z M418 252 L420 184 h4.5 L427 252 Z M332 252 L334 176 h4.5 L341 252 Z`,
          fond: '#5b5349', alpha: 0.5,
        },
      ]
    },
    nuees: { fond: '#6f6860', alpha: 0.42, ou: [[402, 160, 30, 8], [444, 146, 42, 10], [486, 158, 30, 7], [352, 150, 26, 7]] },
  },
  campagne: {
    ciel: [[0, '#b3b8a8'], [0.5, '#dad6c0'], [0.72, '#e6dab8']],
    traces: () => [
      { d: 'M0 226 C 90 196, 170 210, 260 220 S 420 190, 520 212 S 700 198, 800 216 V350 H0 Z', fond: '#8f9278', alpha: 0.6 },
      { d: 'M0 244 C 120 222, 210 240, 330 234 S 560 222, 660 238 S 760 232, 800 236 V350 H0 Z', fond: '#71765b', alpha: 0.8 },
      { d: [38, 52, 66, 148, 162, 366, 380, 394, 408, 498, 606, 620, 634, 728, 742].map((ax, n) => ovale(ax, 226 + (n % 3) * 3, 3.6, 13 + (n % 4) * 2)).join(' '), fond: '#565d45', alpha: 0.8 },
      { d: 'M288 238 V216 L292.5 198 L297 216 V238 Z M296 224 h24 v14 h-24 Z M294 224 L308 215 L322 224 Z M566 226 h18 v10 h-18 Z M563 226 L575 218 L587 226 Z', fond: '#5d5548', alpha: 0.85 },
    ],
    nuees: null,
  },
  // La montagne n'a pas de tracé : sa silhouette est la photographie du pic de Maupas.
  montagne: { ciel: [[0, '#a2a69d'], [0.55, '#c4c4b5'], [0.75, '#d0cab7']], traces: () => [], nuees: null },
  mer: {
    ciel: [[0, '#a7b2b0'], [0.48, '#d2d3c3'], [0.66, '#eddcb6']],
    traces: () => [
      { d: Array.from({ length: 46 }, (_, n) => `M${(alea(n + 300) * 800).toFixed(0)} ${(240 + alea(n + 400) * 100).toFixed(0)} h${(8 + alea(n + 500) * 34).toFixed(0)} v1.2 H${(alea(n + 300) * 800).toFixed(0)} Z`).join(' '), fond: '#f4ead0', alpha: 0.55 },
      { d: 'M520 237 C 570 230, 600 206, 660 204 S 760 190, 800 192 V237 Z', fond: '#69735f', alpha: 0.85 },
      { d: 'M356 237 C 382 232, 412 230, 438 237 Z', fond: '#6f7868', alpha: 0.8 },
      { d: 'M395 208 h4.5 v24 h-4.5 Z', fond: '#ece3cd', alpha: 1 },
      { d: 'M393.5 203 h7.5 v6 h-7.5 Z', fond: '#5a3a2c', alpha: 1 },
      { d: rond(397.2, 206, 1.8), fond: '#fff3c9', alpha: 1 },
      { d: 'M452 236 l8 -21 l6 21 Z M590 236 l5 -14 l5 14 Z', fond: '#f1e8d2', alpha: 1 },
      { d: 'M700 236 l6 -17 l5 17 Z', fond: '#f1e8d2', alpha: 0.8 },
      { d: 'M492 236 l-3 -4 h26 l-3 4 Z M500 226 h2.6 v6 h-2.6 Z', fond: '#4a4843', alpha: 0.8 },
    ],
    nuees: { fond: '#77736c', alpha: 0.4, ou: [[486, 220, 16, 4], [464, 213, 20, 5]] },
  },
}

/** La photographie du fond de montagne, fondue par ses côtés et par le haut (maquette : `.montagne::before`, l. 92-93). */
function picFondu(photo: CanvasImageSource, w: number, h: number): CanvasImageSource {
  return cuire(`pic:${Math.round(w)}`, w, h, (g, lw, lh) => {
    g.drawImage(photo, 0, 0, lw, lh)
    fondre(g, 0, 0, lw, 0, [[0, 0], [0.2, 1], [0.8, 1], [1, 0]], lw, lh)
    fondre(g, 0, 0, 0, lh, [[0, 0], [0.26, 1], [1, 1]], lw, lh)
  }) ?? photo
}

/** Peint une ambiance dans un rectangle de `w` × `h` posé à l'origine du contexte. */
function peindre(g: CanvasRenderingContext2D, nom: Ambiance, w: number, h: number, photo: CanvasImageSource | null): void {
  const fond = FONDS[nom]
  const ciel = g.createLinearGradient(0, 0, 0, h)
  for (const [ou, teinte] of fond.ciel) ciel.addColorStop(ou, c(teinte))
  g.fillStyle = ciel
  g.fillRect(0, 0, w, h)
  if (nom === 'montagne' && photo) {
    const [lp, hp] = TAILLES.fond!
    const lw = (w * 530) / 800
    g.drawImage(picFondu(photo, lw, (lw * hp) / lp), (w * 165) / 800, h * 0.24, lw, (lw * hp) / lp)
  }
  g.save()
  g.scale(w / 800, h / 350)
  if (nom === 'campagne') {
    // Une clarté sur l'horizon (maquette : le `radial-gradient` de `.fond .campagne`).
    g.save()
    g.translate(800 * 0.62, 350 * 0.36)
    g.scale(800 * 0.3, 350 * 0.09)
    const clarte = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    clarte.addColorStop(0, c('#f5eedc', 0.6))
    clarte.addColorStop(1, c('#f5eedc', 0))
    g.fillStyle = clarte
    g.fillRect(-1, -1, 2, 2)
    g.restore()
  }
  if (nom === 'mer') {
    const eau = g.createLinearGradient(0, 236, 0, 350)
    eau.addColorStop(0, c('#a9b9b4'))
    eau.addColorStop(1, c('#6c8483'))
    g.fillStyle = eau
    g.fillRect(0, 236, 800, 114)
  }
  // Un tracé SVG se lit par `Path2D` ; là où il manque (jsdom), le fond n'a que son ciel.
  if (typeof Path2D !== 'undefined') {
    for (const t of fond.traces()) {
      g.save()
      if (t.repere) {
        g.translate(t.repere[0], t.repere[1])
        g.scale(t.repere[2], t.repere[3])
      }
      g.globalAlpha *= t.alpha
      g.fillStyle = c(t.fond)
      g.fill(new Path2D(t.d))
      g.restore()
    }
  }
  if (fond.nuees) {
    for (const [cx, cy, rx, ry] of fond.nuees.ou) {
      g.save()
      g.translate(cx, cy)
      g.scale(rx * 1.5, ry * 1.5)
      const nuee = g.createRadialGradient(0, 0, 0, 0, 0, 1)
      nuee.addColorStop(0, c(fond.nuees.fond, fond.nuees.alpha))
      nuee.addColorStop(1, c(fond.nuees.fond, 0))
      g.fillStyle = nuee
      g.fillRect(-1, -1, 2, 2)
      g.restore()
    }
  }
  g.restore()
}

/**
 * Pose une ambiance du fond à `x`, large de `w` et haute de `h`, à l'opacité courante du contexte.
 * Cuite une fois par taille ; sans toile hors écran, peinte à même le contexte.
 */
export function dessinerFond(g: CanvasRenderingContext2D, nom: Ambiance, x: number, w: number, h: number, photo: CanvasImageSource | null): void {
  const cuit = cuire(`fond:${nom}:${Math.round(w)}:${Math.round(h)}:${photo ? 1 : 0}`, w, h, (t, lw, lh) => peindre(t, nom, lw, lh, photo))
  if (cuit) {
    g.drawImage(cuit, x, 0, w, h)
    return
  }
  g.save()
  g.translate(x, 0)
  peindre(g, nom, w, h, photo)
  g.restore()
}
