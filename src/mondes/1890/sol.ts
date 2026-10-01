import type { CaseVue, DateVraie, VueMonde } from '../types'
import { c } from './couleur'
import { DATES } from './dates'
import { cercle, ombre, texte } from './moyen'
import { imageCommune } from '../../carte/images'
import { dessinerRoulotte } from '../../carte/dessin/roulotte'
import { ease } from '../../carte/outils'

const F_F = '"IM Fell English", Georgia, serif'
const F_A = 'Limelight, Didot, Georgia, serif'
const COULEURS_CONFETTIS: readonly string[] = [c('#A8452F'), c('#E6B94A'), c('#F2E8D5'), c('#3E5360'), c('#DE7A45')]

/**
 * Une affichette (maquette : `affichette`) : elle se colle pendant la seconde qui suit le `pop`
 * de la case de son année, ses confettis partent une fois, son liseré brille tant qu'elle n'a
 * jamais été lue (`v.age('date:i')`, marqué par `reagir`).
 */
function affichette(g: CanvasRenderingContext2D, v: VueMonde, d: DateVraie, i: number, caseAnnee: CaseVue | undefined): void {
  // `v.t` avance par images entières et retarde d'au plus 1/16 s sur l'horloge qui date le `pop` :
  // sans la borne, une affichette neuve se montrerait en entier une image avant de se coller.
  const age = caseAnnee ? Math.max(0, v.t - caseAnnee.pop) : 99
  let sc = 1
  if (v.vivant && age >= 0 && age < 1) sc = ease(Math.min(1, age / 0.5)) * (1 + Math.sin((age / 1) * Math.PI) * 0.25)
  if (sc <= 0.01) return
  if (v.vivant && age >= 0 && age < 1 && v.age(`date:${i}:confettis`) === 99) {
    v.marquer(`date:${i}:confettis`)
    v.confettis(d.x * v.k, v.ecranY(d.y - 36, 1), COULEURS_CONFETTIS)
  }
  const rot = v.vivant ? Math.sin(v.t * 1.3 + i * 2) * 0.04 : 0
  g.save(); g.translate(d.x, d.y); g.scale(sc, sc)
  ombre(g, 1, 1, 6, 1.8, 0.4)
  g.fillStyle = c('#3a2819'); g.fillRect(-1.2, -26, 2.4, 26)
  g.rotate(rot)
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-15, -45, 32, 23)
  g.fillStyle = c('#E9DCC0'); g.fillRect(-16, -46, 32, 23)
  g.fillStyle = c('#A8452F'); g.fillRect(-16, -46, 32, 5)
  if (d.court === String(d.an)) {
    // Une date connue à l'année seulement : l'année une fois, centrée dans le corps de l'affichette.
    texte(g, String(d.an), 0, -29, `9px ${F_A}`, c('#1c140c'))
  } else {
    texte(g, d.court, 0, -31, `9px ${F_F}`, c('#1c140c'))
    texte(g, String(d.an), 0, -25, `6.5px ${F_A}`, c('#6b4a2a'))
  }
  g.fillStyle = c('#1c140c'); cercle(g, 0, -44, 1)
  if (v.age(`date:${i}`) === 99 && v.vivant) {
    g.strokeStyle = c('#F6D98A', 0.35 + 0.35 * Math.sin(v.t * 4 + i))
    g.lineWidth = 1
    g.strokeRect(-18, -48, 36, 27)
  }
  g.restore()
}

/**
 * Le sol : les affichettes des dates vraies (une par année dont la case n'est pas `verrou`), la
 * roulotte qui traverse pour qui mène son Voyage. Ni porte (la maquette finit sur
 * « PROCHAINEMENT »), ni infobulle (l'aperçu de la page en tient lieu).
 */
export function dessinerSol(v: VueMonde, porte: { x: number; y: number }): void {
  void porte
  if (v.presence <= 0.01) return
  const g = v.ctx
  g.save(); g.translate(0, v.ecranY(0, 1)); g.scale(v.k, 1)
  if (v.roulotte) {
    const u = v.vivant ? (v.t / 26) % 1 : 0.42
    const url = imageCommune('roulotte.webp')
    const planche = url ? v.image(url) : null
    dessinerRoulotte(g, -130 + u * 650, 254, 1, v.vivant, v.t, v.vivant, 0.5, v.roulotte, c, v.nuit, planche)
  }
  DATES.forEach((d, i) => {
    const caseAnnee = v.cases.find((cc) => cc.annee === d.an)
    if (!caseAnnee || caseAnnee.etat === 'verrou') return
    v.zone('date', d.x, d.y - 23, 26, i)
    affichette(g, v, d, i, caseAnnee)
  })
  g.restore()
}
