import { describe, expect, it } from 'vitest'
import { contexteFactice, type Appel } from '../../test/contexteFactice'
import { mondeAVenir } from '../../mondes/avenir'
import type { Monde } from '../../mondes/types'
import type { CaseCarte, EtatCarte } from '../moteur'
import { placerCarte } from '../placement'
import { construireRoute } from '../route'
import { dessinerCase } from './cases'
import { dessinerSol } from './sol'
import { dessinerRoulotte } from './roulotte'

/**
 * Un monde dont la rampe et la palette marquent tout ce qui les traverse : un hexadécimal qui
 * sort brut du dessin commun a contourné la rampe (le sépia des années 1890, décision du
 * propriétaire du 29 septembre 2026). Les ombres noires de la maquette restent en `rgba(0,0,0,…)`,
 * que le sépia ne change pas.
 */
function mondeMarque(): Monde {
  const base = mondeAVenir(1890)
  return {
    ...base,
    couleur: (hex, a = 1) => `rampe(${hex},${a})`,
    palette: {
      ...base.palette,
      route: { bord: 'palette:bord', fond: 'palette:fond', perforations: 'palette:perf', coeur: 'palette:coeur' },
      caseFaite: { dessus: ['palette:d0', 'palette:d1'], flanc: ['palette:f0', 'palette:f1'], plaque: 'palette:plaque' },
      caseVerrou: { dessus: ['palette:v0', 'palette:v1'] },
      colonne: { fonce: 'palette:fonce', clair: 'palette:clair', penche: 0.12 },
    },
  }
}

/** Les couleurs réellement posées : le remplissage d'un `fill…`, le trait d'un `stroke…`, les arrêts de leurs dégradés. */
function couleursPosees(appels: readonly Appel[]): string[] {
  const lire = (s: unknown): string[] =>
    typeof s === 'string' ? [s] : s && typeof s === 'object' && 'arrets' in s ? (s as { arrets: Array<[number, string]> }).arrets.map(([, c]) => c) : []
  return appels.flatMap((a) => (a.nom.startsWith('fill') ? lire(a.fillStyle) : a.nom.startsWith('stroke') ? lire(a.strokeStyle) : []))
}
const brutes = (couleurs: readonly string[]) => couleurs.filter((c) => /#[0-9a-f]{3,8}/i.test(c) && !c.startsWith('rampe('))

const uneCase = (etat: CaseCarte['etat'], attente = false): CaseCarte => ({
  annee: 1896,
  etat,
  attente,
  profondeur: 6,
  jauge: etat === 'encours' ? { vus: 2, total: 5 } : null,
  affiches: [],
})

describe('le dessin commun', () => {
  // Mutation : une médaille, la bobine d'une année passée, une affiche vierge ou le « +N » de la
  // colonne dans leurs hexadécimaux bruts — l'or d'une médaille éclaterait dans le sépia.
  it('passe toute couleur d’une case par la rampe ou la palette de son monde', () => {
    const monde = mondeMarque()
    const etats: CaseCarte[] = (['verrou', 'encours', 'passee', 'palme', 'lion', 'ours'] as const).map((e) => uneCase(e))
    for (const c of [...etats, uneCase('passee', true)]) {
      const { ctx, appels } = contexteFactice()
      dessinerCase(ctx, 100, 200, c, monde, 0, true, () => null)
      expect(couleursPosees(appels).length, c.etat).toBeGreaterThan(5)
      expect(brutes(couleursPosees(appels)), `${c.etat}${c.attente ? ' en attente' : ''}`).toEqual([])
    }
  })

  // Mutation : les photogrammes allumés du sol en `rgba(255,222,160,…)` écrit à la main.
  it('passe les photogrammes allumés du sol par la rampe du monde de leur année', () => {
    const monde = mondeMarque()
    const annees = Array.from({ length: 5 }, (_, i) => 1895 + i)
    const plan = placerCarte(annees, (_, a) => monde.trace(a))
    const route = construireRoute(plan.points, 1)
    const etat: EtatCarte = {
      cases: annees.map((annee) => ({ annee, etat: annee < 1898 ? 'lion' : 'encours', attente: false, profondeur: 30, jauge: null, affiches: [] })),
      anneeAvatar: 1898,
      tampons: [],
      roulotte: null,
    }
    const { ctx, appels } = contexteFactice()
    dessinerSol(ctx, {} as Path2D, route, plan, etat, () => monde)
    const photogrammes = appels.filter((a) => a.nom === 'fillRect')
    expect(photogrammes.length).toBeGreaterThan(10)
    expect(brutes(couleursPosees(appels))).toEqual([])
    expect(photogrammes.every((a) => String(a.fillStyle).startsWith('rampe(#FF'))).toBe(true)
  })

  // Mutation : `tourne = roule` — la roue et les chevaux suivraient `t` quand le visiteur demande
  // moins d'animations, si l'appelant les disait en route (le moteur ne le fait pas aujourd'hui).
  it('ne fait dépendre la roulotte de rien quand `vivant` est faux, même en route', () => {
    const dessin = (t: number) => {
      const { ctx, appels } = contexteFactice()
      dessinerRoulotte(ctx, 100, 200, 1, true, t, false, 0.42, 'theo', (h, a = 1) => `${h}/${a}`, 0.5, null)
      return JSON.stringify(appels)
    }
    expect(dessin(3.3)).toBe(dessin(0))
  })

  // Mutation : l'image de la planche tirée de `t` sans regarder `vivant`, ou `n` lu d'autre chose
  // que le rapport de la largeur à la hauteur.
  it('lit la planche de la roulotte à seize images par seconde, et son image 0 quand `vivant` est faux', () => {
    const planche = { width: 400, height: 100 } as unknown as CanvasImageSource
    const source = (t: number, vivant: boolean) => {
      const { ctx, appels } = contexteFactice()
      dessinerRoulotte(ctx, 100, 200, 1, false, t, vivant, 0.42, 'theo', (h) => h, 0, planche)
      return appels.find((a) => a.nom === 'drawImage')!.args.slice(1, 5)
    }
    expect(source(0.2, true)).toEqual([300, 0, 100, 100])
    expect(source(0.3, true)).toEqual([0, 0, 100, 100])
    expect(source(0.2, false)).toEqual([0, 0, 100, 100])
  })
})
