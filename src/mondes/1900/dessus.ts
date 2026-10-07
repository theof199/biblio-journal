import type { VueMonde } from '../types'
import { dessinerDevantLaVitre } from './montee'
import { c, F_CORPS } from './couleur'
import { cuire, fondre } from './cuisson'
import { FENETRES } from './donnees'
import { alea, aUnChef, chefALEcran, fenetresALEcran, forceDeLaLanterne, heureSurLaLigne, lanterneALEcran, leveeDuGuidon, luneALEcran, motsDeLEtiquette, partsDeLHeure, souffleDeLaLampe } from './habillage'
import { dessinerMeteo } from './intemperies'
import { ouvrir } from './toiles'
import { ANNEES } from './trace'
import { sousLaVoute, tunnelALEcran } from './tunnel'
import { dessinerTunnel } from './voute'

/**
 * Ce qui se pose par-dessus tout le paysage du monde 1900, après les poteaux et la voiture du Voyage
 * suivi (maquette, l. 1543 : `heure-m`, `heure-e`, `etoiles`, `lune`, `lumieres`, puis les chambres) :
 * les chefs de gare, l'heure de la gare, ses astres et ses fenêtres allumées, puis la lanterne rouge
 * des années fermées, qui efface l'heure. Chaque « quoi » et chaque « combien » vient de
 * `habillage.ts` ; ici, rien que le trait. Aucune zone n'est inscrite : rien de tout cela ne se touche.
 */

const hex = (v: readonly number[]): string => `#${v.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`
/** Un tracé SVG se lit par `Path2D` ; là où il manque (jsdom), le trait se tait. */
const trace = (g: CanvasRenderingContext2D, d: string, fond: string): void => {
  if (typeof Path2D === 'undefined') return
  g.fillStyle = fond
  g.fill(new Path2D(d))
}
const disque = (g: CanvasRenderingContext2D, x: number, y: number, r: number, fond: string): void => {
  g.fillStyle = fond
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}
/** Un halo rond ou ovale, du plein au vide, dans le mode de fusion courant. */
function halo(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, arrets: ReadonlyArray<readonly [number, string]>): void {
  g.save()
  g.translate(x, y)
  g.scale(rx, ry)
  const d = g.createRadialGradient(0, 0, 0, 0, 0, 1)
  for (const [ou, teinte] of arrets) d.addColorStop(ou, teinte)
  g.fillStyle = d
  g.fillRect(-1, -1, 2, 2)
  g.restore()
}

/** Le chef de gare (maquette : `CHEF_SVG`, l. 3530-3537), dans son repère de 36 × 82 ; `levee` tourne le bras au guidon. */
function chef(g: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }, levee: number): void {
  g.save()
  g.translate(p.x, p.y)
  g.scale(p.w / 36, p.h / 82)
  trace(g, 'M12 50 L11 78 h6 L18 58 L19 78 h6 L24 50 Z', c('#1b1b22'))
  trace(g, 'M9.5 78 h8 v3 h-8 Z M18.5 78 h8 v3 h-8 Z', c('#0b0b0e'))
  const drap = g.createLinearGradient(8, 0, 28, 0)
  drap.addColorStop(0, c('#4c4b55'))
  drap.addColorStop(0.45, c('#25252d'))
  drap.addColorStop(1, c('#0e0e13'))
  if (typeof Path2D !== 'undefined') {
    g.fillStyle = drap
    g.fill(new Path2D('M9 24 C9 20 27 20 27 24 L28 55 H8 Z'))
  }
  trace(g, 'M17.6 22 h0.8 V55 h-0.8 Z M8.3 41 h19.4 v2.2 h-19.4 Z', c('#08080b'))
  trace(g, 'M16.6 40.6 h2.8 v3 h-2.8 Z', c('#c9a257'))
  for (const y of [27.5, 32, 36.5, 47]) disque(g, 16, y, 1, c('#d8b96a'))
  trace(g, 'M14 21.5 h8 v2.4 h-8 Z', c('#a8352a'))
  trace(g, 'M9 25 L12.5 24 L11.5 42 L8 42 Z', c('#17171d'))
  disque(g, 9.8, 44, 2.3, c('#efe6d0'))
  trace(g, 'M13 9.5 C12.4 17 14.5 20.5 18 20.5 C21.5 20.5 23.6 17 23 9.5 Z', c('#cdae87'))
  trace(g, 'M18 9.5 H23 C23.6 17 21.5 20.5 18 20.5 Z', c('#7a5c40', 0.45))
  trace(g, 'M14.6 16.2 C16.5 15 19.5 15 21.4 16.2 L21.4 17.4 C19.5 16.4 16.5 16.4 14.6 17.4 Z', c('#2a2018'))
  trace(g, 'M12 9.8 L12.6 4.6 C14.5 3 21.5 3 23.4 4.6 L24 9.8 Z', c('#1b1b22'))
  trace(g, 'M11.9 7.6 h12.2 v2.4 h-12.2 Z', c('#a8352a'))
  trace(g, 'M11.9 7.35 h12.2 v0.5 h-12.2 Z', c('#d8b96a'))
  disque(g, 18, 5.6, 1, c('#d8b96a'))
  trace(g, 'M11.4 10 h13.6 l2.8 1.9 h-16.4 Z', c('#08080b'))
  // Le bras au guidon tourne autour de l'épaule (maquette : `.chef.leve .bras`, -152 degrés).
  g.translate(23, 24)
  g.rotate((-152 * Math.PI * levee) / 180)
  g.translate(-23, -24)
  trace(g, 'M22 23 L27 24 L28.4 41 L24.6 41 Z', c('#2a2a33'))
  disque(g, 26.5, 42.6, 2.3, c('#efe6d0'))
  trace(g, 'M25.65 43 h1.7 V57 h-1.7 Z', c('#6b4324'))
  disque(g, 26.5, 62, 7.45, c('#f4efe2'))
  disque(g, 26.5, 62, 5.75, c('#2f6b47'))
  disque(g, 26.5, 62, 2.2, c('#f4efe2'))
  g.restore()
}

/** Les chefs de gare, sur le quai des années quittées. */
function dessinerChefs(v: VueMonde): void {
  ANNEES.forEach((annee, i) => {
    if (!aUnChef(v, annee)) return
    const p = chefALEcran(v, i)
    if (p.x + p.w + 40 < 0 || p.x - 40 > v.W) return
    chef(v.ctx, p, leveeDuGuidon(v, annee))
  })
}

/** Les soixante-quatre étoiles de la maquette (l. 3557-3559), dans son repère de 390 × 236. */
const ETOILES = Array.from({ length: 64 }, (_, k) => ({ x: alea(k), y: alea(k + 70), r: 0.5 + alea(k + 140) * 0.9, a: 0.45 + alea(k + 210) * 0.55 }))

/**
 * L'heure de la gare (idée 69 ; maquette : `rendreDecor`, l. 3695-3719) : un aplat qui multiplie,
 * une lueur qui éclaire, le soleil, la lune, les étoiles et les fenêtres allumées. Elle ne lit ni
 * `v.nuit` ni `v.lum` et n'appelle pas `v.feu` : c'est l'heure de la gare, pas celle du visiteur.
 */
function dessinerHeure(v: VueMonde): void {
  const g = v.ctx
  const parts = partsDeLHeure(v)
  if (parts.teinte <= 0) return
  const h = heureSurLaLigne(v.avance)
  g.save()
  g.globalAlpha *= parts.teinte
  g.globalCompositeOperation = 'multiply'
  const teinte = g.createLinearGradient(0, 0, 0, v.H)
  teinte.addColorStop(0, c(hex(h.haut)))
  teinte.addColorStop(0.66, c(hex(h.bas)))
  teinte.addColorStop(1, c(hex(h.bas)))
  g.fillStyle = teinte
  g.fillRect(0, 0, v.W, v.H)
  g.globalCompositeOperation = 'screen'
  halo(g, (v.W * h.lx) / 100, (v.H * h.ly) / 100, v.W * 0.88, v.H * 0.3, [[0, c(hex(h.lueur), h.lueur[3])], [1, c(hex(h.lueur), 0)]])
  g.restore()
  if (parts.soleil > 0) {
    g.save()
    g.globalAlpha *= parts.soleil
    halo(g, (v.W * h.lx) / 100, (v.H * h.ly) / 100, 31, 31, [[0, c('#fffdf2')], [0.36, c('#fffdf2')], [0.48, c('#fff4d2', 0.6)], [0.7, c('#fff4d2', 0)], [1, c('#fff4d2', 0)]])
    g.restore()
  }
  if (parts.etoiles > 0) {
    const bas = v.H * 0.31
    for (const e of ETOILES) {
      // Les étoiles s'effacent vers l'horizon (maquette : le masque de `.etoiles`, de 55 % à 100 %).
      const fondu = 1 - Math.max(0, (e.y - 0.55) / 0.45)
      g.save()
      g.globalAlpha *= parts.etoiles * e.a * fondu
      disque(g, e.x * v.W, e.y * bas, e.r, c('#fff8e6'))
      g.restore()
    }
  }
  if (parts.lune > 0) {
    const l = luneALEcran(v)
    g.save()
    g.globalAlpha *= parts.lune
    halo(g, l.x, l.y, 37, 37, [[0, c('#d6e0ff', 0.5)], [0.4, c('#d6e0ff', 0.5)], [1, c('#d6e0ff', 0)]])
    g.beginPath()
    g.arc(l.x, l.y, 15, 0, Math.PI * 2)
    g.clip()
    disque(g, l.x, l.y, 15, c('#c9c6bb'))
    disque(g, l.x - 7, l.y + 3, 15, c('#f4eeda'))
    g.restore()
  }
  if (parts.fenetres > 0) {
    g.save()
    g.globalAlpha *= parts.fenetres
    for (const rang of Object.keys(FENETRES)) {
      for (const f of fenetresALEcran(v, Number(rang))) {
        if (f.x + f.w < -20 || f.x > v.W + 20) continue
        if (f.halo) {
          g.globalCompositeOperation = 'screen'
          halo(g, f.x + f.w / 2, f.y + f.h / 2, f.w / 2, f.h / 2, [[0, c('#ffc46e', 0.5)], [0.7, c('#ffc46e', 0)], [1, c('#ffc46e', 0)]])
          g.globalCompositeOperation = 'source-over'
        } else {
          halo(g, f.x + f.w / 2, f.y + f.h / 2, f.w / 2 + 9, f.h / 2 + 9, [[0, c('#ffaa46', 0.4)], [1, c('#ffaa46', 0)]])
          g.fillStyle = c('#ffdf9a')
          g.fillRect(f.x, f.y, f.w, f.h)
        }
      }
    }
    g.restore()
  }
}

const CHAMBRE = 1100

/** L'ombre rouge du laboratoire (maquette : `.chambre`, l. 559-562) : elle multiplie le paysage autour de sa lampe, et se fond par ses côtés. */
function chambre(g: CanvasRenderingContext2D, lx: number, ly: number, w: number, h: number): void {
  const d = g.createRadialGradient(lx, ly, 0, lx, ly, 540)
  for (const [ou, teinte] of [[0, '#ffdccb'], [0.17, '#f28a68'], [0.42, '#b53c2b'], [0.74, '#4a130e'], [1, '#1f0806']] as const) d.addColorStop(ou, c(teinte))
  g.fillStyle = d
  g.fillRect(0, 0, w, h)
  // Le fil et la douille de la lampe.
  g.fillStyle = c('#140605')
  g.fillRect(lx - 1, 0, 2, ly - 10)
  g.fillRect(lx - 7, ly - 23, 14, 6)
  g.fillRect(lx - 15, ly - 17, 30, 7)
}

/** L'étiquette de la plaque, à la main (maquette : `.etiquette`, l. 566-568) : le lieu, et ce qui la sépare de l'année en cours. */
function etiquette(g: CanvasRenderingContext2D, x: number, y: number, penche: number, mots: { lieu: string; sous: string }): void {
  g.save()
  g.translate(x, y)
  g.rotate((penche * Math.PI) / 180)
  g.font = `italic 600 17px ${F_CORPS}`
  const l1 = g.measureText(mots.lieu).width
  g.font = `italic 400 13px ${F_CORPS}`
  const l2 = mots.sous ? g.measureText(mots.sous).width : 0
  const w = Math.max(l1, l2) + 37
  const h = mots.sous ? 50 : 33
  g.translate(-w * 0.42, 0)
  const forme = (dx: number, dy: number) => {
    g.beginPath()
    g.moveTo(12 + dx, dy)
    g.lineTo(w + dx, dy)
    g.lineTo(w + dx, h + dy)
    g.lineTo(12 + dx, h + dy)
    g.lineTo(dx, h / 2 + dy)
    g.closePath()
    g.fill()
  }
  g.fillStyle = c('#000000', 0.4)
  forme(2, 4)
  g.fillStyle = c('#eab9a0')
  forme(0, 0)
  disque(g, 13, h / 2, 3, c('#240b07'))
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.font = `italic 600 17px ${F_CORPS}`
  g.fillText(mots.lieu, 24, 22)
  if (mots.sous) {
    g.font = `italic 400 13px ${F_CORPS}`
    g.fillText(mots.sous, 24, 40)
  }
  g.restore()
}

/**
 * La lanterne rouge des années fermées (maquette, l. 558-566 et 2795-2804) : une ombre qui
 * multiplie, une lampe qui éclaire, l'étiquette de la plaque. Posée au-dessus de l'heure, qu'elle
 * efface ; elle s'éteint pendant que la plaque se développe.
 */
function dessinerLanternes(v: VueMonde): void {
  const g = v.ctx
  ANNEES.forEach((annee) => {
    const force = forceDeLaLanterne(v, annee)
    if (force <= 0) return
    const p = lanterneALEcran(v, annee)
    if (!p) return
    const gauche = p.milieu - CHAMBRE / 2
    const lx = p.lampe.x - gauche
    g.save()
    g.globalAlpha *= force
    g.globalCompositeOperation = 'multiply'
    const cuite = cuire(`chambre:${annee}:${Math.round(v.H)}`, CHAMBRE, v.H, (t, w, h) => {
      chambre(t, lx, p.lampe.y, w, h)
      fondre(t, 0, 0, w, 0, [[0, 0], [0.31, 1], [0.69, 1], [1, 0]], w, h)
    })
    if (cuite) g.drawImage(cuite, gauche, 0, CHAMBRE, v.H)
    else {
      g.translate(gauche, 0)
      chambre(g, lx, p.lampe.y, CHAMBRE, v.H)
      g.translate(-gauche, 0)
    }
    g.globalCompositeOperation = 'screen'
    g.globalAlpha *= souffleDeLaLampe(v)
    halo(g, p.lampe.x, p.lampe.y, 280, 280, [
      [0, c('#fff0d2')], [6 / 280, c('#fff0d2')], [10 / 280, c('#ff7445')], [14 / 280, c('#e2371c')],
      [17 / 280, c('#d62e18', 0.5)], [70 / 280, c('#c82814', 0.26)], [170 / 280, c('#c82814', 0.09)], [1, c('#c82814', 0)],
    ])
    g.restore()
    g.save()
    g.globalAlpha *= force
    etiquette(g, p.etiquette.x, p.etiquette.y, p.etiquette.penche, motsDeLEtiquette(v, annee))
    g.restore()
  })
}

/** Par-dessus tout : les chefs de gare, l'heure, la lanterne, la météo sur la vitre, puis le tunnel, qui les couvre. Le moteur l'appelle après la voiture du Voyage suivi. */
export function dessinerSurLaBrume(v: VueMonde): void {
  if (ouvrir(v)) {
    const tunnel = tunnelALEcran(v)
    // Sous le noir plein du tunnel, rien de ce qui suit ne se verrait : ni passe plein écran, ni neige.
    if (!sousLaVoute(tunnel)) {
      dessinerChefs(v)
      dessinerHeure(v)
      dessinerLanternes(v)
      // La météo est sur la vitre : par-dessus l'heure et la lanterne (maquette : `.meteo`, l. 1545).
      dessinerMeteo(v)
    }
    // Le tunnel passe devant la vitre : par-dessus la météo (maquette : `.tunnel`, l. 1546).
    if (tunnel) dessinerTunnel(v, tunnel)
    v.ctx.restore()
  }
  // Le passage, par-dessus les toiles : le cadre de la vitre, la bouffée, et tant qu'il n'y a pas de
  // vitre, la jonction et le quai, qui couvrent ce que la foire laisse déborder (`montee.ts`).
  dessinerDevantLaVitre(v)
}
