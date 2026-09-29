import type { VueMonde } from '../types'
import { c } from './couleur'
import { ELEMENTS, chantier, avancement } from './chantier'
import { remplissage } from './foire'
import { guichetEtat, plaque } from './moyen'
import { guirlandesLampions } from './proches'
import { clamp, lisse } from '../../carte/outils'

const COULEURS_CONFETTIS: readonly string[] = [c('#A8452F'), c('#E6B94A'), c('#F2E8D5'), c('#3E5360'), c('#DE7A45')]

/**
 * Ce qu'une année ouverte montre par-dessus la brume de l'avenir (idée 8, maquette : les lignes
 * « Le guichet ouvert en 1897 perce la brume », `ecriteau`, et les confettis de fin de chantier de
 * `dessinCarte`) : le guichet de 1897 quand la brume le couvre encore, l'écriteau du chantier en
 * cours, et les confettis de sa fin — une année posée bâtie (`t0 < 0`) n'en fête aucune.
 */
export function dessinerSurLaBrume(v: VueMonde): void {
  if (v.presence <= 0.01) return
  const g = v.ctx
  const etat1897 = chantier(1897, v.ouverte, v.t, v.vivant)
  g.save(); g.translate(0, v.ecranY(0, 1)); g.scale(v.k, 1)
  if (etat1897.etat !== 'absent' && v.brume < 640) {
    const r = remplissage(v.cases, v.bouclee)
    g.save(); g.globalAlpha = 0.72
    guichetEtat(g, v, avancement(etat1897))
    guirlandesLampions(g, v, avancement(etat1897), r, true, 1)
    g.restore()
  }
  const e = ELEMENTS.find((el) => el.annee === v.ouverte.annee)
  const etatOuverte = e ? chantier(e.annee, v.ouverte, v.t, v.vivant) : null
  if (e && etatOuverte && etatOuverte.etat === 'chantier') {
    const k = etatOuverte.k
    const a = lisse(0, 0.08, k) * (1 - lisse(0.9, 1, k))
    if (a > 0.01) {
      g.font = "600 11.5px 'Fraunces', Georgia, serif"
      const w = g.measureText(e.ecriteau).width + 16
      const x = clamp(e.site[0], w / 2 + 8, v.W - w / 2 - 8)
      g.save(); g.globalAlpha = a
      plaque(g, x, e.ecriteauY, e.ecriteau, c('#F2E8D5'), c('#151009'))
      g.restore()
    }
  }
  g.restore()
  if (e && v.ouverte.t0 >= 0 && v.t - v.ouverte.t0 > e.duree + 0.05 && v.age(`chantier:${e.annee}`) === 99) {
    v.marquer(`chantier:${e.annee}`)
    v.confettis(e.site[0] * v.k, v.ecranY(e.site[1] - 30, 1), COULEURS_CONFETTIS)
  }
}
