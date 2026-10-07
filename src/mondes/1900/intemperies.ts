import type { VueMonde } from '../types'
import { c } from './couleur'
import { forceDeLaBuee, type Trait, type Vitre } from './buee'
import { cuire, toileHorsEcran } from './cuisson'
import { alea } from './habillage'
import { GOUTTES, glissement, goutteALEcran, NEIGE, partsDuTemps, PLUIE, type Plan } from './meteo'

/**
 * Le trait de la météo par la vitre (idée 70, et sa buée plus bas ; maquette : `.meteo`, l. 1071-1099 et
 * 3560-3570) : un voile, des motifs répétés qui glissent (un plan de pluie, trois de neige), onze
 * gouttes. Pas de particules : une tuile se peint une fois (`cuire`), puis se pose d'un seul
 * remplissage par plan. Chaque « quoi » et chaque « combien » vient de `meteo.ts` ; ici, rien que le
 * trait. Aucune zone n'est inscrite. Sans toile hors écran (jsdom), les motifs se taisent.
 *
 * Deux écarts à la maquette, faute de mémoire d'une image à l'autre : le vent ne couche pas la
 * pluie selon la vitesse du train (`m-vent`, `skewX`), et le plan de neige le plus proche n'est pas
 * flouté (`blur`), ses flocons sont peints doux. La buée non plus n'est pas floutée (`.embuee`,
 * l. 1099), et ses perles tombent où le hasard du monde les met, pas où la maquette les a.
 */

/** En dessous, une part ne se dessine pas (maquette : `poser1`, l. 3724). */
const SEUIL = 0.004
/** La finesse des tuiles : peintes deux fois plus grandes, posées à moitié, pour rester nettes sur un écran dense. */
const FINESSE = 2

type Peintre = (g: CanvasRenderingContext2D) => void

/** La tuile de pluie : onze traits penchés (maquette, l. 3560). */
const peindrePluie: Peintre = (g) => {
  g.lineCap = 'butt'
  for (let k = 0; k < 11; k++) {
    const x = alea(k + 300) * PLUIE.l
    const y = alea(k + 320) * PLUIE.h
    const l = 16 + alea(k + 340) * 22
    g.strokeStyle = c('#eef3f6', 0.3 + alea(k + 380) * 0.4)
    g.lineWidth = 0.6 + alea(k + 360) * 0.6
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x - l * 0.19, y + l)
    g.stroke()
  }
}

/** La tuile du plan de neige `n` : des flocons plus gros et plus nombreux de plan en plan (maquette, l. 3561-3564). */
const peindreNeige = (n: number): Peintre => (g) => {
  const plan = NEIGE[n]!
  for (let k = 0; k < 9 + n * 2; k++) {
    const x = alea(k + n * 40 + 400) * plan.l
    const y = alea(k + n * 40 + 430) * plan.h
    const r = 0.7 + n * 0.55 + alea(k + 460) * (0.6 + n * 0.5)
    const a = 0.55 + alea(k + 490) * 0.4
    if (n === 2) {
      // Le plan le plus proche : un flocon doux, à la place du flou de la maquette.
      const d = g.createRadialGradient(x, y, 0, x, y, r * 1.3)
      d.addColorStop(0, c('#ffffff', a))
      d.addColorStop(0.55, c('#ffffff', a))
      d.addColorStop(1, c('#ffffff', 0))
      g.fillStyle = d
    } else g.fillStyle = c('#ffffff', a)
    g.beginPath()
    g.arc(x, y, r * (n === 2 ? 1.3 : 1), 0, Math.PI * 2)
    g.fill()
  }
}

/** Un motif par tuile cuite : une tuile rendue par la mémoire emporte le sien. */
const motifs = new WeakMap<object, CanvasPattern>()

/** Pose le motif d'un plan sur tout l'écran, d'un seul remplissage, glissé de ce que dit `meteo.ts`. */
function semer(v: VueMonde, cle: string, plan: Plan, force: number, peindre: Peintre): void {
  if (force <= SEUIL) return
  const g = v.ctx
  const tuile = cuire(cle, plan.l * FINESSE, plan.h * FINESSE, (t) => {
    t.scale(FINESSE, FINESSE)
    peindre(t)
  })
  if (!tuile) return
  let motif = motifs.get(tuile)
  if (!motif) {
    const neuf = g.createPattern(tuile, 'repeat')
    if (!neuf) return
    motif = neuf
    motifs.set(tuile, motif)
  }
  const { dx, dy } = glissement(plan, v)
  g.save()
  g.globalAlpha *= force
  // Le motif s'ancre à l'origine du repère : c'est le repère qui glisse, le rectangle reste l'écran.
  g.translate(dx, dy)
  g.scale(1 / FINESSE, 1 / FINESSE)
  g.fillStyle = motif
  g.fillRect(-dx * FINESSE, -dy * FINESSE, v.W * FINESSE, v.H * FINESSE)
  g.restore()
}

/** Le voile de pluie (maquette : `.m-voile.p`, l. 1077) : un gris d'ardoise posé sur le paysage, sans fusion. */
function voileDePluie(v: VueMonde, force: number): void {
  if (force <= SEUIL) return
  const g = v.ctx
  g.save()
  g.globalAlpha *= force
  const d = g.createLinearGradient(0, 0, 0, v.H)
  d.addColorStop(0, c('#3a4452', 0.5))
  d.addColorStop(0.55, c('#3a4452', 0.26))
  d.addColorStop(1, c('#3a4452', 0.34))
  g.fillStyle = d
  g.fillRect(0, 0, v.W, v.H)
  g.restore()
}

/** Le voile de neige et le sol blanchi (maquette : `.m-voile.n`, `.m-sol`, l. 1074-1076), l'un sur l'autre. */
function peindreVoileDeNeige(g: CanvasRenderingContext2D, w: number, h: number): void {
  const voile = g.createLinearGradient(0, 0, 0, h)
  voile.addColorStop(0, c('#d6e0ea', 0.42 * 0.6))
  voile.addColorStop(0.6, c('#d6e0ea', 0.2 * 0.6))
  voile.addColorStop(1, c('#d6e0ea', 0.08 * 0.6))
  g.fillStyle = voile
  g.fillRect(0, 0, w, h)
  const sol = g.createLinearGradient(0, h, 0, h * 0.6)
  sol.addColorStop(0, c('#aab4be', 0.62))
  sol.addColorStop(0.46, c('#b9c3cc', 0.62))
  sol.addColorStop(0.7, c('#aeb8c2', 0.62))
  sol.addColorStop(1, c('#aeb8c2', 0))
  g.fillStyle = sol
  g.fillRect(0, h * 0.6, w, h * 0.4)
}

/**
 * Le voile de neige et le sol blanchi, en une seule passe qui éclaire : les deux dégradés sont
 * cuits ensemble dans une bande de deux pixels de large, étirée sur l'écran.
 */
function voileDeNeige(v: VueMonde, force: number): void {
  if (force <= SEUIL) return
  const g = v.ctx
  g.save()
  g.globalAlpha *= force
  g.globalCompositeOperation = 'screen'
  const cuit = cuire(`neige:voile:${Math.round(v.H)}`, 2, v.H, peindreVoileDeNeige)
  if (cuit) g.drawImage(cuit, 0, 0, v.W, v.H)
  else peindreVoileDeNeige(g, v.W, v.H)
  g.restore()
}

/** Les gouttes qui ruissellent sur la vitre (maquette : `.m-gouttes i`, l. 1089-1090) : une traînée, une perle, son reflet. */
function gouttes(v: VueMonde, force: number): void {
  if (force <= SEUIL) return
  const g = v.ctx
  g.save()
  g.globalAlpha *= force
  GOUTTES.forEach((_, k) => {
    const p = goutteALEcran(v, k)
    if (p.y < -12 || p.y - p.trainee > v.H) return
    g.fillStyle = c('#e8f0f4', 0.12)
    g.fillRect(p.x - 1, p.y - p.trainee, 2, p.trainee / 2)
    g.fillStyle = c('#e8f0f4', 0.32)
    g.fillRect(p.x - 1, p.y - p.trainee / 2, 2, p.trainee / 2)
    g.fillStyle = c('#607080', 0.4)
    g.beginPath()
    g.arc(p.x, p.y + 5, 3.4, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = c('#d6e2ea', 0.7)
    g.beginPath()
    g.arc(p.x, p.y + 4.5, 3, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = c('#ffffff', 0.95)
    g.beginPath()
    g.arc(p.x - 1, p.y + 3.4, 1.1, 0, Math.PI * 2)
    g.fill()
  })
  g.restore()
}

/** Le voile de buée, peint une fois : dense aux bords, déjà clair au milieu, perlé de gouttes dont quelques-unes ont coulé (maquette : `embuer`, l. 3651-3672). */
function peindreBuee(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = c('#e0e6e2', 0.8)
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'destination-out'
  const d = g.createRadialGradient(w / 2, h * 0.5, 36, w / 2, h * 0.5, h * 0.52)
  d.addColorStop(0, c('#000000', 0.7))
  d.addColorStop(0.5, c('#000000', 0.44))
  d.addColorStop(1, c('#000000', 0))
  g.fillStyle = d
  g.fillRect(0, 0, w, h)
  const perle = (k: number) => ({ x: alea(k + 700) * w, y: h * (0.15 + alea(k + 900) * 0.68), r: 1.3 + alea(k + 1100) * 2.9 })
  for (let k = 0; k < 120; k++) {
    const p = perle(k)
    g.fillStyle = c('#000000', 0.4 + alea(k + 1300) * 0.45)
    g.beginPath()
    g.ellipse(p.x, p.y, p.r * 0.85, p.r, 0, 0, Math.PI * 2)
    g.fill()
    if (k % 8 === 0) {
      const l = 26 + alea(k + 1500) * 96
      g.fillRect(p.x - p.r * 0.42, p.y - l, p.r * 0.84, l)
    }
  }
  g.globalCompositeOperation = 'source-over'
  g.strokeStyle = c('#ffffff', 0.7)
  g.lineWidth = 0.9
  for (let k = 0; k < 120; k++) {
    const p = perle(k)
    if (p.r <= 2.2) continue
    g.beginPath()
    g.arc(p.x, p.y, p.r, 0.3, 1.9)
    g.stroke()
  }
}

/** Ôte un trait à la buée : le passage du doigt, large et doux, ou une coulure (maquette : `essuyer`, `finirEssuyage`, l. 3675-3691). */
function oter(g: CanvasRenderingContext2D, t: Trait, w: number, h: number): void {
  const doigt = t.genre === 'doigt'
  g.globalCompositeOperation = 'destination-out'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.lineWidth = doigt ? 54 : 3.5
  g.strokeStyle = c('#000000', doigt ? 0.94 : 0.8)
  g.shadowColor = c('#000000')
  g.shadowBlur = doigt ? 10 : 0
  g.beginPath()
  g.moveTo(t.x0 * w, t.y0 * h)
  g.lineTo(t.x1 * w, t.y1 * h)
  g.stroke()
}

/**
 * La seule toile de la buée, à la densité 1 (la note de la maquette, l. 2587 : 1,2 Mo pour un
 * téléphone), hors de la mémoire de `cuire` : elle se retouche, et se rend dès que la buée n'a plus
 * de force. `faits` : combien de traits de la vitre y sont déjà ôtés ; `tete` : le premier, qui
 * change quand la vitre s'est réembuée entre deux images.
 */
let embuee: { toile: HTMLCanvasElement; g: CanvasRenderingContext2D; de: Vitre; w: number; h: number; faits: number; tete: Trait | undefined } | null = null

/**
 * La buée sur la vitre. La liste des traits fait foi, la toile n'en est que le cache : un trait neuf
 * s'y ôte seul, sans rien recuire ; une toile neuve (rendue, d'un autre écran, d'une vitre réembuée)
 * se repeint d'après la liste. Hors d'une gare embuée, aucune passe, et la toile est rendue.
 */
function buee(v: VueMonde, vitre: Vitre): void {
  const force = forceDeLaBuee(v.avance)
  const traits = vitre.essuyage(v.avance).traits
  if (force <= SEUIL) {
    if (force <= 0 && embuee) {
      embuee.toile.width = 0
      embuee = null
    }
    return
  }
  const w = Math.ceil(v.W)
  const h = Math.ceil(v.H)
  if (!embuee || embuee.de !== vitre || embuee.w !== w || embuee.h !== h || embuee.faits > traits.length || (embuee.faits > 0 && embuee.tete !== traits[0])) {
    if (embuee) embuee.toile.width = 0
    const neuve = toileHorsEcran(w, h)
    embuee = neuve && { ...neuve, de: vitre, w, h, faits: 0, tete: undefined }
    if (!embuee) return
    peindreBuee(embuee.g, w, h)
  }
  for (; embuee.faits < traits.length; embuee.faits++) oter(embuee.g, traits[embuee.faits]!, v.W, v.H)
  embuee.tete = traits[0]
  const g = v.ctx
  g.save()
  g.globalAlpha *= force
  g.drawImage(embuee.toile, 0, 0, v.W, v.H)
  g.restore()
}

/**
 * La météo sur la vitre, dans le contexte déjà ouvert et coupé par `ouvrir` (`dessus.ts`), après la
 * lanterne. Hors d'une gare à météo, `partsDuTemps` ne rend que des zéros et rien ne se pose.
 */
export function dessinerMeteo(v: VueMonde, vitre: Vitre | null = null): void {
  const parts = partsDuTemps(v)
  voileDeNeige(v, parts.voileDeNeige)
  voileDePluie(v, parts.voileDePluie)
  semer(v, 'meteo:pluie', PLUIE, parts.pluie, peindrePluie)
  NEIGE.forEach((plan, n) => semer(v, `meteo:neige:${n}`, plan, parts.neige, peindreNeige(n)))
  gouttes(v, parts.pluie)
  // La buée est le dernier calque de la vitre (maquette : `.embuee`, l. 1545).
  if (vitre) buee(v, vitre)
}
