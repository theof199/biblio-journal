import { describe, expect, it } from 'vitest'
import { creerMonde1900 } from '.'
import type { CaseVue } from '../types'
import { vueFactice } from '../../test/vueFactice'
import { METEO } from './donnees'
import { LIEU } from './gares'
import { voileDuLaboratoire } from './habillage'
import { forceDuTemps, glissement, GOUTTES, goutteALEcran, NEIGE, partsDuTemps, PLUIE, tempsDeLaGare } from './meteo'
import { ANNEES, ARRETS, B1, PAS, S1 } from './trace'

/**
 * La météo par la vitre (lot 2 bis, idée 70 sans la buée). Ces tests ne portent que sur les règles
 * (`meteo.ts`) : aucun ne fige les appels de canvas du trait (`intemperies.ts`).
 */

const arret = (annee: number): number => ARRETS[annee - 1900]!
/** Les dix années : les `ouvertes` premières quittées sauf la dernière, en cours ; le reste fermé. */
const cases = (ouvertes: number): CaseVue[] =>
  ANNEES.map((annee, i) => ({ annee, etat: i < ouvertes - 1 ? 'passee' : i === ouvertes - 1 ? 'encours' : 'verrou', profondeur: 0, affiches: [], x: 195, y: 0, pop: -9 }))
const vue = (annee: number, ouvertes: number) => ({ avance: arret(annee), cases: cases(ouvertes), ouverte: { annee: 1899 + ouvertes, t0: -9 }, t: 3.2, vivant: true })

describe('quelle gare a quel temps', () => {
  // Mutations : une gare de plus dans `METEO` (la buée de Creil devenue pluie) ; Brest en neige ; une
  // gare suisse retirée ; `tempsDeLaGare` qui rend 'pluie' par défaut.
  it('il pleut à Couville et à Brest, il neige à Allaman et à Bassersdorf, et nulle part ailleurs', () => {
    const parLieu = Object.fromEntries(ANNEES.map((annee) => [LIEU[annee]!, tempsDeLaGare(annee)]))
    expect(parLieu).toEqual({
      'Paris, l’Exposition': null, Creil: null, Couville: 'pluie', Longueville: null, Allaman: 'neige',
      Bassersdorf: 'neige', Brest: 'pluie', 'Monte-Carlo': null, Ponteland: null, Iguerande: null,
    })
    // Toute ligne de la table est une année de la ligne : aucune ne reste lettre morte.
    expect(Object.keys(METEO).map(Number).filter((annee) => !ANNEES.includes(annee))).toEqual([])
  })

  // Mutations : `forceDuTemps` qui ignore la table (pleine partout) ; les deux temps confondus dans une
  // seule force ; le rang lu de travers (`i + 1`).
  it('à l’arrêt de chaque gare, son temps est plein, lui seul, et rien dans une gare sans météo', () => {
    for (const annee of ANNEES) {
      const temps = tempsDeLaGare(annee)
      expect(forceDuTemps(arret(annee)), String(annee)).toEqual({ pluie: temps === 'pluie' ? 1 : 0, neige: temps === 'neige' ? 1 : 0 })
    }
  })
})

describe('la force du temps en roulant', () => {
  // Mutations : les seuils 0,3 et 0,56 déplacés (0,5 et 0,9 : la pluie de Couville atteindrait
  // Longueville à mi-chemin) ; `Math.max` remplacé par une somme (la neige dépasserait 1 entre les
  // deux gares suisses) ; `Math.abs` retiré (rien avant la gare).
  it('pleine jusqu’à 30 % du chemin, nulle à 56 %, des deux côtés de la gare', () => {
    const couville = arret(1902)
    for (const sens of [-1, 1]) {
      expect(forceDuTemps(couville + sens * PAS * 0.3).pluie).toBe(1)
      const mi = forceDuTemps(couville + sens * PAS * 0.43).pluie
      expect(mi).toBeGreaterThan(0.2)
      expect(mi).toBeLessThan(0.8)
      expect(forceDuTemps(couville + sens * PAS * 0.56).pluie).toBe(0)
    }
    // Entre Allaman et Bassersdorf, la neige faiblit sans cesser ni dépasser sa pleine force.
    for (let f = 0; f <= 1; f += 0.05) {
      const neige = forceDuTemps(arret(1904) + f * PAS).neige
      expect(neige).toBeGreaterThan(0)
      expect(neige).toBeLessThanOrEqual(1)
    }
    expect(forceDuTemps(arret(1904) + PAS / 2).neige).toBeLessThan(1)
    // Deux gares du même temps ne s'ajoutent pas : à 48 % du chemin, la neige est celle de la plus proche, seule.
    const pres = arret(1904) + PAS * 0.48
    expect(forceDuTemps(pres, { 1905: 'neige' }).neige).toBeGreaterThan(0)
    expect(forceDuTemps(pres).neige).toBe(forceDuTemps(pres, { 1904: 'neige' }).neige)
    // De la neige de Bassersdorf à la pluie de Brest, les deux se croisent sans se confondre.
    const entre = forceDuTemps(arret(1905) + PAS / 2)
    expect(entre.neige).toBeCloseTo(entre.pluie, 9)
    expect(entre.neige).toBeGreaterThan(0)
  })

  // Mutation : la garde `avance < B1` retirée de `forceDuTemps`. La table du monde ne la met pas en
  // jeu (1900 et 1901 n'ont pas de météo) : une table où il pleut dès 1900 la met à l'épreuve.
  it('pendant le passage de la foire au train, aucune météo, quelle que soit la table', () => {
    const table = { 1900: 'pluie', 1901: 'neige' } as const
    for (const avance of [-600, 0, S1, B1 - 200, B1 - 1]) {
      expect(forceDuTemps(avance, table), String(avance)).toEqual({ pluie: 0, neige: 0 })
      expect(forceDuTemps(avance), String(avance)).toEqual({ pluie: 0, neige: 0 })
    }
    // Le témoin : la même table donne sa pluie dès la gare de 1900.
    expect(forceDuTemps(B1, table).pluie).toBe(1)
  })

})

describe('la météo sous la lanterne', () => {
  // Mutations : le voile de neige qui garde 20 % sous la lanterne (`1 - 0.8 * voile`, la maquette) ;
  // le voile de pluie qui ne lit pas la lanterne ; la pluie elle-même éteinte par la lanterne.
  it('ce qui tombe garde sa force sur une plaque à développer ; le voile de pluie y perd la moitié, celui de neige s’y efface', () => {
    // Une seule année ouverte : Couville et Allaman sont des plaques à développer.
    expect(partsDuTemps(vue(1902, 1))).toEqual({ pluie: 1, voileDePluie: 0.5, neige: 0, voileDeNeige: 0 })
    expect(partsDuTemps(vue(1904, 1))).toEqual({ pluie: 0, voileDePluie: 0, neige: 1, voileDeNeige: 0 })
    // Les dix années ouvertes : plus de lanterne, les voiles sont pleins.
    expect(partsDuTemps(vue(1902, 10))).toEqual({ pluie: 1, voileDePluie: 1, neige: 0, voileDeNeige: 0 })
    expect(partsDuTemps(vue(1904, 10))).toEqual({ pluie: 0, voileDePluie: 0, neige: 1, voileDeNeige: 1 })
  })

  // Couville fermée, à quatre dixièmes du chemin : sa lanterne n'est plus pleine, sa pluie non plus.
  // Mutations : `1 - 0.5 * voile * voile` (juste à 0 et à 1, faux entre les deux) ;
  // `1 - 0.5 * Math.round(voile)` ; la force de la pluie oubliée du voile (`1 - 0.5 * voile` seul).
  it('sous une lanterne à demi allumée, le voile de pluie perd la moitié de ce que la lanterne a pris', () => {
    for (const sens of [-1, 1]) {
      const v = { ...vue(1902, 1), avance: arret(1902) + sens * PAS * 0.4 }
      const voile = voileDuLaboratoire(v)
      expect(voile).toBeGreaterThan(0.3)
      expect(voile).toBeLessThan(0.7)
      const parts = partsDuTemps(v)
      expect(parts.pluie).toBeGreaterThan(0.3)
      expect(parts.pluie).toBeLessThan(0.9)
      expect(parts.voileDePluie).toBeCloseTo(parts.pluie * (1 - voile / 2), 9)
      // Ni lanterne ignorée, ni lanterne prise pour pleine.
      expect(parts.voileDePluie).toBeLessThan(parts.pluie * 0.9)
      expect(parts.voileDePluie).toBeGreaterThan(parts.pluie * 0.6)
    }
  })

  // Mutation : `partsDuTemps` qui ne lit pas la table (ou la force) et pose un voile partout.
  it('rien du tout dans une gare sans météo, ouverte ou fermée', () => {
    for (const annee of ANNEES.filter((a) => tempsDeLaGare(a) === null)) {
      for (const ouvertes of [1, 10]) expect(partsDuTemps(vue(annee, ouvertes)), `${annee}, ${ouvertes}`).toEqual({ pluie: 0, voileDePluie: 0, neige: 0, voileDeNeige: 0 })
    }
  })
})

describe('ce qui tombe', () => {
  const plans = [PLUIE, ...NEIGE]

  // Mutations : la garde `!v.vivant` retirée de `glissement` ; la même retirée de `goutteALEcran`
  // (`REPOS` jamais pris) ; `REPOS` mis à 0 (les gouttes au-dessus de l'écran, invisibles au calme).
  it('au calme, est un état fixe : les motifs posés, chaque goutte à sa place, à tout instant', () => {
    for (const plan of plans) {
      for (const t of [0, 1.4, 9, 123.456]) expect(glissement(plan, { t, vivant: false })).toEqual({ dx: 0, dy: 0 })
    }
    GOUTTES.forEach((g, k) => {
      const a = goutteALEcran({ W: 390, H: 700, t: 1.4, vivant: false }, k)
      expect(goutteALEcran({ W: 390, H: 700, t: 9, vivant: false }, k)).toEqual(a)
      // Elle se voit : à sa place, dans l'écran.
      expect(a.y).toBeCloseTo(g.y * 700, 9)
      expect(a.y).toBeGreaterThan(0)
      expect(a.y).toBeLessThan(700)
      expect(a.x).toBeGreaterThan(0)
      expect(a.x).toBeLessThan(390)
    })
  })

  // Mutations : `glissement` qui ne lit pas l'horloge ; la boucle non refermée (`part` retiré : le
  // motif s'en va sans revenir) ; `dx` et `dy` échangés ; la durée lue en secondes.
  it('vivant, chaque motif glisse avec l’horloge, vers le bas et la gauche, et reprend à chaque boucle', () => {
    for (const plan of plans) {
      const quart = glissement(plan, { t: (plan.duree * 0.25) / 1000, vivant: true })
      expect(quart.dx).toBeCloseTo(plan.dx * 0.25, 6)
      expect(quart.dy).toBeCloseTo(plan.dy * 0.25, 6)
      expect(quart.dy).toBeGreaterThan(0)
      expect(quart.dx).toBeLessThan(0)
      expect(glissement(plan, { t: (plan.duree * 0.5) / 1000, vivant: true }).dy).toBeCloseTo(plan.dy * 0.5, 6)
      const plusTard = glissement(plan, { t: (plan.duree * 7.25) / 1000, vivant: true })
      expect(plusTard.dx).toBeCloseTo(quart.dx, 6)
      expect(plusTard.dy).toBeCloseTo(quart.dy, 6)
      // Jamais plus d'une boucle : le rectangle du motif reste borné.
      expect(Math.abs(plusTard.dy)).toBeLessThan(Math.abs(plan.dy))
    }
  })

  // Mutation : une boucle de neige qui ne retombe pas sur sa tuile (`dy: 200` sur une tuile de 160) :
  // le motif sauterait à chaque boucle.
  it('la neige retombe sur son motif : une boucle glisse d’une tuile entière, et les plans proches tombent plus vite', () => {
    for (const plan of NEIGE) {
      expect(Math.abs(plan.dx) % plan.l).toBe(0)
      expect(plan.dy % plan.h).toBe(0)
    }
    expect(PLUIE.dy % PLUIE.h).toBe(0)
    const vitesses = NEIGE.map((plan) => plan.dy / plan.duree)
    expect(vitesses[1]!).toBeGreaterThan(vitesses[0]!)
    expect(vitesses[2]!).toBeGreaterThan(vitesses[1]!)
  })

  // Mutations : le décalage de la goutte ignoré (toutes coulent ensemble) ; la goutte qui ne sort
  // pas de l'écran (`v.H + 80` remplacé par `y`) ; l'horloge ignorée.
  it('vivante, une goutte entre par le haut, passe à sa place, sort par le bas et recommence, chacune à son heure', () => {
    const H = 700
    GOUTTES.forEach((g, k) => {
      const a = (p: number) => goutteALEcran({ W: 390, H, t: (p * g.duree - g.decalage) / 1000, vivant: true }, k)
      expect(a(0).y).toBeLessThan(0)
      expect(a(0.58).y).toBeCloseTo(g.y * H, 6)
      expect(a(0.999).y).toBeGreaterThan(H)
      expect(a(1.3).y).toBeCloseTo(a(0.3).y, 6)
      // Elle ne remonte jamais.
      for (let p = 0.05; p < 1; p += 0.05) expect(a(p).y).toBeGreaterThanOrEqual(a(p - 0.05).y)
    })
    // Au même instant, elles ne sont pas toutes au même moment de leur course.
    const hauteurs = GOUTTES.map((g, k) => goutteALEcran({ W: 390, H, t: 3.2, vivant: true }, k).y / (g.y * H))
    expect(new Set(hauteurs.map((h) => h.toFixed(2))).size).toBeGreaterThan(5)
  })
})

describe('la météo dans l’image du monde', () => {
  /** Ce que le monde pose par-dessus tout, lu comme une suite d'appels : comparé seulement à une autre image du même dessin. */
  const dessus = (annee: number, surcharge: { t: number; vivant: boolean }): unknown => {
    const f = vueFactice({ avance: arret(annee), cases: cases(10), ouverte: { annee: 1909, t0: -9 }, ...surcharge })
    creerMonde1900().dessinerSurLaBrume(f.vue)
    return JSON.parse(JSON.stringify(f.appels))
  }

  // Mutations : `dessinerMeteo` retiré de `dessinerSurLaBrume` (le témoin tombe : plus rien ne bouge à
  // Couville) ; les gouttes dessinées d'après une vue toujours vivante (`{ ...v, vivant: true }`).
  it('au calme, deux images de Couville à deux instants sont la même ; vivante, la pluie y coule', () => {
    expect(dessus(1902, { t: 1.4, vivant: false })).toEqual(dessus(1902, { t: 9, vivant: false }))
    expect(dessus(1902, { t: 1.4, vivant: true })).not.toEqual(dessus(1902, { t: 3.4, vivant: true }))
    // Longueville n'a pas de météo : toutes années ouvertes, rien n'y suit l'horloge.
    expect(dessus(1903, { t: 1.4, vivant: true })).toEqual(dessus(1903, { t: 3.4, vivant: true }))
  })
})
