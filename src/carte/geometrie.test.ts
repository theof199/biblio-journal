import { describe, expect, it } from 'vitest'
import { construireRoute, pointA } from './route'
import { placerCarte } from './placement'
import { cibleCamera, poidsSections } from './camera'
import { rayonEcran, trouverZone, type Zone } from './zones'
import { geoEnsemble } from './ensemble'
import { ambianceDeLHeure } from './heure'
import { Lru } from './lru'
import { horlogeDuMonde, scintillement, SCINTILLEMENT_MAX, tremblement } from './traitement'
import { HAUTEUR_MIN_SECTION, trace1890, traceAVenir } from '../mondes/trace'

const traceDe = (decennie: number, annees: readonly number[]) => (decennie === 1890 ? trace1890(annees) : traceAVenir(annees))
const annees = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, i) => de + i)

describe('la route', () => {
  // Mutation : pousser le premier échantillon de chaque segment à u = 1/n au lieu de 0 décale
  // chaque case de la route.
  it('passe exactement par chaque point de passage, à l’échelle', () => {
    const points = [[195, 60], [110, 300], [285, 470]] as const
    const route = construireRoute(points, 2)
    points.forEach(([x, y], i) => {
      const p = pointA(route, route.dWay[i]!)
      expect(p.x).toBeCloseTo(x * 2, 6)
      expect(p.y).toBeCloseTo(y, 6)
    })
  })

  it('se borne aux deux bouts', () => {
    const route = construireRoute([[0, 0], [0, 100]], 1)
    expect(pointA(route, -50)).toMatchObject({ x: 0, y: 0 })
    expect(pointA(route, 1e6)).toMatchObject({ x: 0, y: 100 })
  })
})

describe('le placement', () => {
  const plan = placerCarte(annees(1895, 2026), traceDe)

  // Mutation : oublier le décalage `y0` empile toutes les décennies au sommet de la carte.
  it('pose les années 1890 aux coordonnées de la maquette, puis chaque décennie sous la précédente', () => {
    expect(plan.cases.slice(0, 5).map((c) => [c.annee, c.x, c.y])).toEqual([
      [1895, 105, 150], [1896, 290, 285], [1897, 120, 420], [1898, 280, 560], [1899, 130, 695],
    ])
    expect(plan.cases[5]).toMatchObject({ annee: 1900, y: 1240 + 170 })
    for (let i = 1; i < plan.cases.length; i++) expect(plan.cases[i]!.y).toBeGreaterThan(plan.cases[i - 1]!.y)
  })

  it('garde toutes les années jusqu’à l’année civile, une section par décennie', () => {
    expect(plan.cases).toHaveLength(2026 - 1895 + 1)
    expect(plan.sections.map((s) => s.decennie)).toEqual(annees(189, 202).map((d) => d * 10))
    expect(plan.sections[plan.sections.length - 1]!.annees).toEqual(annees(2020, 2026))
    const derniere = plan.sections[plan.sections.length - 1]!
    expect(plan.hauteur).toBe(derniere.y0 + derniere.hauteur)
  })

  it('refuse une année avant le départ du Voyage', () => {
    expect(() => placerCarte([1893, 1895], traceDe)).toThrow()
  })

  // Mutation : retirer la garde de `placerCarte` pose des années sans case.
  it('refuse un tracé qui n’a pas une case par année', () => {
    expect(() => placerCarte([1900, 1901], () => traceAVenir([1900]))).toThrow('le tracé de 1900 a 1 cases pour 2 années')
  })

  // Mutation : retirer `Math.max(HAUTEUR_MIN_SECTION, …)` fait chevaucher les fondus d'une
  // décennie d'une seule année, et la somme des poids dépasse 1.
  it('ne fait jamais une section trop courte pour ses fondus', () => {
    expect(traceAVenir([2030]).hauteur).toBe(HAUTEUR_MIN_SECTION)
  })
})

describe('la caméra', () => {
  it('pose la cible un peu au-dessus du milieu, sans sortir de la carte', () => {
    expect(cibleCamera(1000, 700, 5000)).toBeCloseTo(1000 - 364, 6)
    expect(cibleCamera(10, 700, 5000)).toBe(0)
    expect(cibleCamera(4990, 700, 5000)).toBe(4300)
  })

  // Mutation : une entrée sans `lisse` (coupure franche) ou un fondu de sortie oublié.
  it('fond les mondes à leurs frontières, la somme des présences valant 1 partout', () => {
    const plan = placerCarte([...annees(1895, 1909), 2030], traceDe)
    for (let camC = 0; camC < plan.hauteur; camC += 37) {
      const somme = poidsSections(camC, plan.sections).reduce((a, b) => a + b, 0)
      expect(somme).toBeCloseTo(1, 6)
    }
    const frontiere = plan.sections[1]!.y0
    const [a, b] = poidsSections(frontiere, plan.sections)
    expect(a).toBeCloseTo(0.5, 6)
    expect(b).toBeCloseTo(0.5, 6)
  })
})

describe('les zones', () => {
  const zone = (id: string, x: number, prio: number): Zone => ({ id, x, y: 0, r: 30, data: null, prio })

  // Mutation : `Math.max(20, …)` comme la maquette laisse des cibles de 40 px.
  it('ne descendent jamais sous 44 px de diamètre', () => {
    expect(rayonEcran({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }, 2, 3)).toBe(22)
  })

  it('rendent la plus prioritaire, puis la plus proche', () => {
    expect(trouverZone([zone('decor', 0, 0), zone('case', 10, 1)], 0, 0)?.id).toBe('case')
    expect(trouverZone([zone('loin', 20, 0), zone('pres', 2, 0)], 0, 0)?.id).toBe('pres')
    expect(trouverZone([zone('decor', 0, 0)], 100, 0)).toBeNull()
  })
})

describe('la vue d’ensemble', () => {
  const plan = placerCarte(annees(1895, 2026), traceDe)
  const sources = plan.sections.map((s, i) => ({ y0: s.y0, hauteur: s.hauteur, detaillee: i === 0 }))
  const geo = geoEnsemble(sources, 700, 132, 64)

  // Mutation : donner à chaque section sa hauteur réelle écrase les années 1890 en quelques pixels.
  it('laisse aux années 1890 au moins trente pixels par année', () => {
    const b = geo.bandes[0]!
    expect((b.y1 - b.y0) / 5).toBeGreaterThanOrEqual(30)
    expect(geo.bandes[geo.bandes.length - 1]!.y1).toBeCloseTo(700 - 64, 6)
  })

  // Mutation : inverser `u` dans l'une des deux fonctions.
  it('ramène un toucher à l’endroit touché', () => {
    for (let y = 0; y < plan.hauteur; y += 97) expect(geo.versMonde(geo.versEcran(y))).toBeCloseTo(y, 6)
    expect(geo.versEcran(plan.cases[3]!.y)).toBeLessThan(geo.versEcran(plan.cases[40]!.y))
  })
})

describe('l’heure', () => {
  it('fait le jour à midi et la nuit à minuit', () => {
    expect(ambianceDeLHeure(12)).toMatchObject({ nuit: 0, lum: 0.45 })
    expect(ambianceDeLHeure(0)).toMatchObject({ nuit: 1, lum: 1.3 })
    expect(ambianceDeLHeure(19.3).crep).toBeCloseTo(1, 6)
  })
})

describe('le cache des tuiles', () => {
  // Mutation : retirer la boucle d'éviction garde toutes les tuiles en mémoire.
  it('ne garde que les plus récemment servies', () => {
    const lru = new Lru<number, string>(2)
    lru.set(1, 'a')
    lru.set(2, 'b')
    lru.get(1)
    lru.set(3, 'c')
    expect(lru.taille).toBe(2)
    expect(lru.get(2)).toBeUndefined()
    expect(lru.get(1)).toBe('a')
  })
})

describe('l’image qui tremble', () => {
  // Mutation : ignorer `calme` fait trembler l'écran de qui a demandé moins d'animations.
  it('ne bouge ni ne palpite quand le visiteur demande moins d’animations', () => {
    for (const t of [0, 0.3, 1.7]) {
      expect(tremblement(t, 16, 0.8, true)).toEqual({ dx: 0, dy: 0 })
      expect(scintillement(t, 16, 0.03, true)).toBe(0)
    }
  })

  // Mutation : retirer le `Math.min(…, SCINTILLEMENT_MAX)`.
  it('ne palpite jamais au-delà du seuil de flash de WCAG, quoi que demande le monde', () => {
    for (let t = 0; t < 5; t += 0.01) expect(scintillement(t, 16, 0.5, false)).toBeLessThanOrEqual(SCINTILLEMENT_MAX)
  })

  // Mutation : `horlogeDuMonde` qui rend `t` tel quel (le décor glisse au lieu de sauter d'image en image).
  it('tient chaque image jusqu’à la suivante, à la cadence du monde', () => {
    expect(horlogeDuMonde(0.1, 16)).toBe(horlogeDuMonde(0.12, 16))
    expect(horlogeDuMonde(0.1, 16)).not.toBe(horlogeDuMonde(0.13, 16))
    expect(tremblement(0.1, 16, 0.8, false)).toEqual(tremblement(0.12, 16, 0.8, false))
    expect(horlogeDuMonde(0.1, null)).toBe(0.1)
  })
})
