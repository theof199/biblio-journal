import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerMonde1900 } from '.'
import type { CaseVue, VueMonde } from '../types'
import { vueFactice } from '../../test/vueFactice'
import { AMBIANCE, CADRE_LOIN, FENETRES, HEURES, LABO, LUNE, POSE, SUITE_LOIN } from './donnees'
import { DEVELOPPEMENT, SOUFFLE_DE_LA_LAMPE } from './durees'
import { gareALEcran } from './gares'
import {
  ambiances, aUnChef, chefALEcran, fenetresALEcran, forceDeLaLanterne, GUIDON, heureSurLaLigne, lanterneALEcran, leveeDuGuidon, luneALEcran,
  motsDeLEtiquette, partDeLHeure, partsDeLHeure, souffleDeLaLampe, voileDuLaboratoire,
} from './habillage'
import { largeurDeLaVue, vueDeRang, vuesALEcran } from './lointain'
import { ANNEES, ARRETS, PAS } from './trace'

/**
 * L'habillage du monde 1900 (plan 3b, tâche 11b). Décision 12 : ces tests ne portent que sur la
 * logique, par les fonctions pures que le dessin lit (`habillage.ts`). Aucun ne fige les appels de
 * canvas d'un décor ; là où une image entière est lue, elle n'est comparée qu'à une autre image du
 * même dessin.
 */

/** Les dix années : les `ouvertes` premières quittées sauf la dernière, en cours ; le reste fermé. */
const cases = (ouvertes: number): CaseVue[] =>
  ANNEES.map((annee, i) => ({ annee, etat: i < ouvertes - 1 ? 'passee' : i === ouvertes - 1 ? 'encours' : 'verrou', attente: false, profondeur: 0, affiches: [], x: 195, y: 0, pop: -9 }))

/** La vue du train à `avance`, les `ouvertes` premières années ouvertes, le membre dans la dernière. */
function vueA(avance: number, ouvertes: number, surcharge: Partial<VueMonde> = {}) {
  return vueFactice({ avance, cases: cases(ouvertes), ouverte: { annee: 1899 + ouvertes, t0: -9 }, ...surcharge })
}
const enGare = (annee: number, ouvertes: number, surcharge: Partial<VueMonde> = {}) => vueA(ARRETS[annee - 1900]!, ouvertes, surcharge)

/** Une image entière du monde : tous ses plans, dans l'ordre du moteur, et le Voyage suivi. */
function image(v: VueMonde): void {
  const m = creerMonde1900()
  m.dessinerCiel(v)
  m.dessinerLointain(v)
  m.dessinerMoyen(v)
  m.dessinerSol(v, { x: 0, y: 0 })
  m.dessinerProche(v)
  m.scene!.dessinerSuivi(v, { pseudo: 'lea', annee: 1902 })
  m.dessinerSurLaBrume(v)
  m.dessinerAdieu(v)
}
const PHOTO = {} as CanvasImageSource
const lus = (appels: unknown): unknown => JSON.parse(JSON.stringify(appels))
const dessin = (f: ReturnType<typeof vueFactice>) => {
  image(f.vue)
  return lus(f.appels)
}

describe('les tables de l’habillage', () => {
  // Mutations : une place de repli changée (1902 remise à la place de 1905) ; une ligne de `POSE` ; un cadre.
  it('sont celles de la fiche de données, replis de 1901 à 1904 compris', () => {
    expect(POSE).toEqual({
      quai: [10, 8], 1900: [16, 15], 1901: [22, 10], 1902: [22, 10], 1903: [14, 10], 1904: [16, 10],
      1905: [20, 12], 1906: [26, 12], 1907: [14, 16], 1908: [18, 10], 1909: [18, 10],
    })
    expect(LABO).toEqual({
      1901: [-112, 27, 0, 0, -3], 1902: [104, 25, 30, 34, 2.5], 1903: [-30, 29.5, -34, 46, -5], 1904: [124, 26.5, 22, -6, 1.5],
      1905: [-112, 27, 0, 0, -3], 1906: [104, 25, 30, 34, 2.5], 1907: [-30, 29.5, -34, 46, -5], 1908: [124, 26.5, 22, -6, 1.5],
      1909: [-132, 28.5, -8, 40, -2],
    })
    expect(CADRE_LOIN).toEqual({ loin1: [0.01, 0.99, 0, 34], loin2: [0.19, 0.93, 14, 38], loin3: [0.01, 0.56, 6, 32] })
    expect(SUITE_LOIN.map((s) => s.nom + (s.miroir ? ' m' : '')).join(', ')).toBe('loin1, loin2, loin3 m, loin3, loin2 m, loin2, loin3 m, loin3, loin2 m, loin1 m, loin1, loin2, loin3 m, loin3')
    expect(LUNE).toEqual([72, 19])
    expect(HEURES.map((h) => [h.nom, h.lx, h.ly, h.sol, h.nuit])).toEqual([
      ['aube', 80, 29, 1, 0.3], ['petit matin', 72, 23, 1, 0], ['matinée', 64, 14, 0.5, 0], ['fin de matinée', 56, 9, 0, 0], ['plein midi', 50, 6, 0, 0],
      ['début d’après-midi', 44, 10, 0, 0], ['fin d’après-midi', 36, 20, 0.6, 0], ['crépuscule', 28, 30, 1, 0.45], ['heure bleue', 20, 33, 0, 0.75], ['nuit', 72, 19, 0, 1],
    ])
    expect(HEURES.map((h) => [...h.haut, ...h.bas, ...h.lueur].join(' '))).toEqual([
      '172 168 200 250 212 182 255 168 118 0.5', '204 215 232 255 236 208 255 226 180 0.3', '228 236 242 255 248 232 255 240 210 0.2',
      '244 247 248 255 253 244 255 250 230 0.14', '255 255 255 255 255 250 255 255 240 0.16', '255 250 236 255 244 220 255 240 200 0.16',
      '250 232 200 250 222 176 255 214 150 0.28', '150 128 172 250 160 110 255 130 60 0.6', '84 98 152 140 130 168 210 120 130 0.28', '58 72 124 88 98 146 150 170 230 0.16',
    ])
    // Trois gares seulement ont des fenêtres allumées : 1907, 1908 (la rame de douze et trois autres), 1909.
    expect(Object.fromEntries(Object.entries(FENETRES).map(([i, l]) => [i, [l.length, l.filter((f) => f[4] === 1).length]]))).toEqual({ 7: [5, 0], 8: [15, 1], 9: [6, 2] })
    expect(FENETRES[9]![0]).toEqual([0.477, 0.305, 0.023, 0.107])
    expect(FENETRES[8]![11]![0]).toBeCloseTo(0.112 + 11 * 0.027, 9)
  })
})

describe('le fond en quatre ambiances', () => {
  // Mutation : deux ambiances échangées dans `AMBIANCE` (la mer en gare de 1904) ; `ambiances` lue un rang plus loin.
  it('à l’arrêt de chaque année, est celui que la fiche de données lui donne, et lui seul', () => {
    const attendu = ['ville', 'ville', 'campagne', 'campagne', 'montagne', 'montagne', 'mer', 'mer', 'campagne', 'campagne']
    expect(AMBIANCE).toEqual(attendu)
    ANNEES.forEach((_, i) => {
      const parts = ambiances(ARRETS[i]!)
      expect(Object.entries(parts).filter(([, part]) => part > 0)).toEqual([[attendu[i], 1]])
    })
  })

  // Mutation : le fondu retiré (`f` à 0 : l'ambiance sauterait en gare) ; les deux parts qui ne font plus un.
  it('se fond de l’une à l’autre en roulant, sans trou', () => {
    // À mi-chemin de 1901 (ville) à 1902 (campagne) : moitié, moitié.
    const milieu = ambiances(ARRETS[1]! + PAS / 2)
    expect([milieu.ville, milieu.campagne]).toEqual([expect.closeTo(0.5, 9), expect.closeTo(0.5, 9)])
    expect([milieu.montagne, milieu.mer]).toEqual([0, 0])
    // Entre deux gares de la même ambiance, rien ne se fond.
    expect(ambiances(ARRETS[0]! + PAS / 2)).toEqual({ ville: 1, campagne: 0, montagne: 0, mer: 0 })
    for (let a = ARRETS[0]!; a <= ARRETS[9]!; a += 35) expect(Object.values(ambiances(a)).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9)
    // Avant la gare de 1900 (le passage), et sous celle de 1909 : l'ambiance de la gare.
    expect(ambiances(0)).toEqual(ambiances(ARRETS[0]!))
    expect(ambiances(ARRETS[9]! + 400)).toEqual(ambiances(ARRETS[9]!))
  })
})

describe('les vues lointaines', () => {
  // Mutation : le cadre ignoré (`x1 - x0` retiré : la vue posée entière, comme en 11a).
  it('sont recadrées : leur largeur est celle de leur cadre', () => {
    expect(largeurDeLaVue('loin1', 448)).toBeCloseTo((448 * 883 * 0.98) / 469, 6)
    expect(largeurDeLaVue('loin3', 448)).toBeCloseTo((448 * 893 * 0.55) / 493, 6)
  })

  // Mutation : la suite finie (`SUITE_LOIN[k]` sans reprise : plus de vue au-delà de la quatorzième).
  it('se suivent dans l’ordre de la maquette, et la suite reprend au bout : la toile ne s’arrête pas avant 1909', () => {
    expect([0, 2, 9, 13].map(vueDeRang)).toEqual([{ nom: 'loin1', miroir: false }, { nom: 'loin3', miroir: true }, { nom: 'loin1', miroir: true }, { nom: 'loin3', miroir: false }])
    expect([14, 16, 27, 28].map(vueDeRang)).toEqual([0, 2, 13, 0].map(vueDeRang))
    // Un écran couché, en gare de 1909 : la suite seule (quatorze vues) finirait avant le bord droit.
    const couche = { W: 2600, H: 400, avance: ARRETS[9]! }
    const vues = vuesALEcran(couche)
    expect(vues.length).toBeGreaterThan(0)
    const derniere = vues[vues.length - 1]!
    expect(derniere.x + derniere.w).toBeGreaterThanOrEqual(couche.W)
    // Le témoin : il y faut plus que les quatorze vues de la suite.
    expect(derniere.rang).toBeGreaterThanOrEqual(14)
    // Chaque vue commence 130 px avant la fin de la précédente, sur laquelle elle se fond.
    vues.slice(1).forEach((vue, n) => expect(vue.x).toBeCloseTo(vues[n]!.x + vues[n]!.w - 130, 6))
    // Sur un téléphone debout, rien hors de l'écran n'est rendu.
    for (const vue of vuesALEcran({ W: 390, H: 700, avance: ARRETS[4]! })) {
      expect(vue.x + vue.w).toBeGreaterThan(0)
      expect(vue.x).toBeLessThan(390)
    }
  })
})

describe('une toile hors écran refusée', () => {
  afterEach(() => vi.restoreAllMocks())

  // Mutation : le refus non retenu (`refusee = true` retiré : une toile recréée par élément, à chaque image).
  it('n’est demandée qu’une fois : le refus est retenu', async () => {
    vi.resetModules()
    const { cuire } = await import('./cuisson')
    const creer = vi.spyOn(document, 'createElement')
    const peindre = vi.fn()
    // jsdom refuse tout contexte de canvas (`src/test/setup.ts`).
    expect(cuire('a', 10, 10, peindre)).toBeNull()
    expect(cuire('b', 10, 10, peindre)).toBeNull()
    expect(cuire('a', 10, 10, peindre)).toBeNull()
    expect(creer.mock.calls.filter((a) => a[0] === 'canvas')).toHaveLength(1)
    expect(peindre).not.toHaveBeenCalled()
  })
})

describe('l’heure de la gare', () => {
  // Mutations : deux heures échangées dans `HEURES` ; l'heure lue un rang plus loin ; une composante
  // mêlée à sa voisine (le vert lu sur le rouge, l'opacité de la lueur sur son bleu).
  it('est celle de sa gare à l’arrêt, et se fond entre deux gares', () => {
    ANNEES.forEach((_, i) => {
      const h = HEURES[i]!
      expect(heureSurLaLigne(ARRETS[i]!)).toEqual({ haut: h.haut, bas: h.bas, lueur: h.lueur, lx: h.lx, ly: h.ly, sol: h.sol, nuit: h.nuit })
    })
    const milieu = heureSurLaLigne(ARRETS[7]! + PAS / 2)
    expect(milieu.nuit).toBeCloseTo((0.45 + 0.75) / 2, 9)
    expect(milieu.haut[0]).toBeCloseTo((150 + 84) / 2, 9)
    // Chaque composante se mêle à la sienne : le haut, le bas et la lueur, opacité comprise.
    const proche = (v: readonly number[]) => v.map((x) => expect.closeTo(x, 9))
    expect(milieu.haut).toEqual(proche([117, 113, 162]))
    expect(milieu.bas).toEqual(proche([195, 145, 139]))
    expect(milieu.lueur).toEqual(proche([232.5, 125, 95, 0.44]))
    expect(milieu.lx).toBeCloseTo(24, 9)
  })

  // Mutations : la part de nuit ignorée (`etoiles: jour`, `lune: jour`) ; les fenêtres allumées à toute heure.
  it('ne montre ni étoile, ni lune, ni fenêtre allumée hors de la nuit', () => {
    // Plein midi en gare de 1904, toute la ligne ouverte.
    expect(partsDeLHeure(enGare(1904, 10).vue)).toEqual({ teinte: 1, soleil: 0, lune: 0, etoiles: 0, fenetres: 0 })
    expect(partsDeLHeure(enGare(1901, 10).vue)).toEqual({ teinte: 1, soleil: 1, lune: 0, etoiles: 0, fenetres: 0 })
    // Le témoin : la nuit de 1909, ouverte.
    expect(partsDeLHeure(enGare(1909, 10).vue)).toEqual({ teinte: 1, soleil: 0, lune: 1, etoiles: 1, fenetres: 1 })
    // L'heure bleue de 1908 : des étoiles et des fenêtres, pas encore de lune.
    const bleue = partsDeLHeure(enGare(1908, 10).vue)
    expect(bleue.etoiles).toBeCloseTo(0.5625, 9)
    expect(bleue.fenetres).toBeGreaterThan(0.5)
    expect(bleue.lune).toBe(0)
  })

  // Mutations : le voile de la lanterne retiré (`partDeLHeure` à 1) ; retiré pour les seules étoiles, la
  // seule lune, les seules fenêtres ; la part de la maquette remise (`1 - 0.86 * voile`).
  it('s’efface sous la lanterne : à l’arrêt d’une année fermée, ni teinte, ni étoile, ni lune, ni fenêtre', () => {
    for (const annee of [1903, 1907, 1908, 1909]) {
      const f = enGare(annee, annee - 1900)
      expect(voileDuLaboratoire(f.vue)).toBe(1)
      expect(partDeLHeure(f.vue)).toBe(0)
      expect(partsDeLHeure(f.vue)).toEqual({ teinte: 0, soleil: 0, lune: 0, etoiles: 0, fenetres: 0 })
    }
    // Le témoin : la même gare, ouverte.
    expect(partsDeLHeure(enGare(1909, 10).vue).etoiles).toBe(1)
    // En gare de 1905 ouverte, la lanterne de 1906 est à 900 px de toile : l'heure est entière.
    expect(partDeLHeure(enGare(1905, 6).vue)).toBe(1)
    // En route vers une année fermée, elle s'efface peu à peu.
    const enRoute = partDeLHeure(vueA(ARRETS[5]! + PAS * 0.75, 6).vue)
    expect(enRoute).toBeGreaterThan(0)
    expect(enRoute).toBeLessThan(1)
  })

  // Mutations : la teinte de l'heure multipliée par `v.nuit` ; par `v.lum` ; un `v.feu` sous une fenêtre allumée.
  it('ne doit rien à l’heure du visiteur, fenêtres allumées comprises', () => {
    // La nuit de 1909, ouverte : la teinte, les étoiles, la lune et les fenêtres sont toutes à l'écran.
    const f = (surcharge: Partial<VueMonde>) => enGare(1909, 10, { image: () => PHOTO, ...surcharge })
    expect(dessin(f({ nuit: 0 }))).toEqual(dessin(f({ nuit: 1 })))
    expect(dessin(f({ lum: 0.45 }))).toEqual(dessin(f({ lum: 1.3 })))
    const nuit = f({ nuit: 1, lum: 1.3 })
    image(nuit.vue)
    expect(nuit.vue.feu).not.toHaveBeenCalled()
    expect(fenetresALEcran(nuit.vue, 9).length).toBe(6)
  })

  // Mutation : une fenêtre posée sur l'écran et non sur la photographie (`p.x`, `p.w` retirés).
  it('pose ses fenêtres sur la photographie de la gare, et la lune à sa place', () => {
    const { vue } = enGare(1909, 10)
    const p = gareALEcran(vue, 9)
    const [premiere] = fenetresALEcran(vue, 9)
    expect(premiere).toEqual({ x: p.x + 0.477 * p.w, y: p.y + 0.305 * p.h, w: 0.023 * p.w, h: 0.107 * p.h, halo: false })
    expect(fenetresALEcran(vue, 9).filter((f) => f.halo)).toHaveLength(2)
    expect(fenetresALEcran(vue, 3)).toEqual([])
    expect(luneALEcran({ W: 390, H: 700 })).toEqual({ x: 390 * 0.72, y: 700 * 0.19 })
  })
})

describe('le chef de gare', () => {
  // Mutations : la garde de l'état retirée (un chef partout) ; la garde inversée (le chef sur l'année
  // en cours et les fermées) ; la garde `aDevelopper` retirée.
  it('se tient sur le quai d’une année quittée, jamais sur l’année en cours ni sur une année fermée', () => {
    const { vue } = enGare(1903, 4)
    expect(ANNEES.filter((a) => aUnChef(vue, a))).toEqual([1900, 1901, 1902])
    // Une année quittée avec sa récompense reste quittée.
    const palme = { ...vue, cases: vue.cases.map((k) => (k.annee === 1901 ? { ...k, etat: 'palme' as const } : k)) }
    expect(aUnChef(palme, 1901)).toBe(true)
    expect(aUnChef(vue, 1899)).toBe(false)
    // Quittée mais pas encore rejointe par le membre : sa plaque est négative, le quai est vide.
    expect(aUnChef({ cases: cases(5), ouverte: { annee: 1901, t0: -9 } }, 1902)).toBe(false)
  })

  // Mutations : la levée gardée d'un seul côté (`v.avance - arret` sans valeur absolue) ; le seuil de
  // 5 px retiré ; le seuil de 0,8 pas retiré.
  it('lève son guidon d’après la seule distance, avant comme après l’arrêt de sa gare', () => {
    expect(GUIDON).toEqual({ pres: 5, loin: 560 })
    const a = ARRETS[2]!
    const levee = (avance: number) => leveeDuGuidon({ avance, vivant: true }, 1902)
    expect(levee(a + 100)).toBe(1)
    expect(levee(a - 100)).toBe(1)
    expect(levee(a)).toBe(0)
    expect(levee(a + 5)).toBe(0)
    expect(levee(a - 5)).toBe(0)
    expect(levee(a + 600)).toBe(0)
    expect(levee(a - 600)).toBe(0)
    expect(levee(a + 560)).toBe(0)
    expect(levee(a + 6)).toBeGreaterThan(0)
    expect(levee(a + 559)).toBeGreaterThan(0)
    expect(levee(a - 559)).toBeGreaterThan(0)
    // Entre deux gares, deux chefs voisins le lèvent ensemble (décision 5).
    expect(leveeDuGuidon({ avance: a + 350, vivant: true }, 1902)).toBe(1)
    expect(leveeDuGuidon({ avance: a + 350, vivant: true }, 1903)).toBe(1)
    expect(leveeDuGuidon({ avance: a + 100, vivant: true }, 1899)).toBe(0)
  })

  // Mutation : la garde de `vivant` retirée.
  it('ne le lève jamais au calme', () => {
    for (let d = -700; d <= 700; d += 20) expect(leveeDuGuidon({ avance: ARRETS[2]! + d, vivant: false }, 1902)).toBe(0)
  })

  // Mutations : le guidon lu sur `v.t` (une levée datée de l'horloge) ; une mémoire du dernier arrêt
  // gardée par le monde (le guidon levé pour la seule gare du dernier arrêt dessiné).
  it('ne dépend que d’`avance` : la même image pour deux instants, et quel que soit ce qui a été dessiné avant', () => {
    // À 100 px après la gare de 1901, quittée : son chef a le guidon levé. Aucune plaque ne se
    // développe, aucune lanterne n'est à l'écran : rien d'autre ne lit l'horloge.
    const ici = ARRETS[1]! + 100
    const a = (t: number) => vueA(ici, 6, { t, image: () => PHOTO })
    expect(leveeDuGuidon(a(1).vue, 1901)).toBe(1)
    expect(dessin(a(1.4))).toEqual(dessin(a(9)))
    const apres = (arret: number) => {
      image(vueA(arret, 6, { image: () => PHOTO }).vue)
      return dessin(a(3.2))
    }
    const seule = dessin(a(3.2))
    expect(apres(ARRETS[1]!)).toEqual(seule)
    expect(apres(ARRETS[4]!)).toEqual(seule)
    // Le témoin : le guidon se lit dans l'image, baissé au calme.
    expect(dessin(vueA(ici, 6, { vivant: false, image: () => PHOTO }))).not.toEqual(seule)
  })

  // Mutation : le chef posé au milieu de l'écran et non de sa gare.
  it('se tient 58 px à gauche du milieu de sa gare, les pieds sur le quai', () => {
    const { vue } = enGare(1902, 6)
    const p = chefALEcran(vue, 2)
    const gare = gareALEcran(vue, 2)
    expect(p.x + p.w / 2).toBeCloseTo(195 - 58, 6)
    expect(p.y + p.h).toBeCloseTo(gare.y + gare.h * 0.915, 6)
    expect(chefALEcran(vue, 3).x - p.x).toBeCloseTo(900, 6)
  })
})

describe('la lanterne d’une plaque', () => {
  // Mutations : une lanterne donnée à 1900 ; la lanterne éteinte d'un coup à l'ouverture ; jamais éteinte.
  it('brûle tant que la plaque est à développer, et s’éteint pendant qu’elle se développe', () => {
    const v = (t: number) => ({ cases: cases(4), ouverte: { annee: 1903, t0: 10 }, t, vivant: true })
    expect(ANNEES.map((a) => forceDeLaLanterne(v(99), a))).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 1, 1])
    expect(forceDeLaLanterne(v(10), 1903)).toBe(1)
    expect(forceDeLaLanterne(v(10 + DEVELOPPEMENT / 2000), 1903)).toBeCloseTo(0.5, 6)
    // Fermée, 1900 n'a pas de lanterne : ni la maquette ni la décision 6 ne lui en donnent.
    expect(forceDeLaLanterne({ cases: cases(0), ouverte: { annee: 1899, t0: -9 }, t: 3, vivant: true }, 1900)).toBe(0)
    // Au calme, la plaque est posée développée : la lanterne est éteinte.
    expect(forceDeLaLanterne({ ...v(10), vivant: false }, 1903)).toBe(0)
  })

  // Mutations : la lampe posée au milieu de la gare (`lx` ignoré) ; l'étiquette à la place de la lampe.
  it('pend à sa place : la lampe et l’étiquette de la fiche de données, autour du milieu de sa gare', () => {
    for (const annee of [1902, 1906, 1909]) {
      const [lx, ly, ex, ey, penche] = LABO[annee]!
      expect(lanterneALEcran(enGare(annee, 1).vue, annee)).toEqual({ milieu: 195, lampe: { x: 195 + lx, y: 7 * ly }, etiquette: { x: 195 + ex, y: 700 * 0.525 + ey, penche } })
    }
    expect(lanterneALEcran(enGare(1900, 1).vue, 1900)).toBeNull()
    // À une gare de là (900 px de toile), sa chambre de 1100 px est hors d'un écran de 390 ; à mi-chemin, elle y entre.
    expect(lanterneALEcran(enGare(1905, 1).vue, 1906)).toBeNull()
    expect(lanterneALEcran(vueA(ARRETS[5]! + PAS / 2, 1).vue, 1906)!.milieu).toBeCloseTo(195 + 450, 6)
  })

  // Mutation : l'écart compté depuis 1900 et non depuis l'année en cours ; le pluriel oublié.
  it('porte sur son étiquette le lieu, et ce qui la sépare de l’année en cours', () => {
    expect(motsDeLEtiquette({ cases: cases(4) }, 1904)).toEqual({ lieu: 'Allaman', sous: 'à 1 ticket de 1903' })
    expect(motsDeLEtiquette({ cases: cases(4) }, 1909)).toEqual({ lieu: 'Iguerande', sous: 'à 6 tickets de 1903' })
    expect(motsDeLEtiquette({ cases: cases(4) }, 1903)).toEqual({ lieu: 'Longueville', sous: '' })
  })
})

describe('moins d’animations, sous l’habillage', () => {
  // Mutations : une étoile qui scintille sur `v.t` sans lire `v.vivant` ; la lampe qui respire sans le
  // lire (les étoiles de la maquette ne scintillent pas : seule la lampe bat, et elle seule lit l'horloge).
  it('au calme, deux images à deux instants sont la même, lanterne à l’écran', () => {
    const f = (t: number, vivant: boolean) => enGare(1905, 5, { t, vivant, image: () => PHOTO })
    expect(dessin(f(1.4, false))).toEqual(dessin(f(9, false)))
    // La nuit de 1909, ouverte : les étoiles, la lune et les fenêtres sont à l'écran, et ne bougent pas.
    const nuit = (t: number) => enGare(1909, 10, { t, vivant: false, image: () => PHOTO })
    expect(dessin(nuit(1.4))).toEqual(dessin(nuit(9)))
    // Le témoin : vivante, la lampe respire entre ces deux instants.
    expect(dessin(f(1.4, true))).not.toEqual(dessin(f(3.4, true)))
    expect(souffleDeLaLampe({ t: 1.4, vivant: false })).toBe(1)
    expect(souffleDeLaLampe({ t: 0, vivant: true })).toBeCloseTo(0.66, 9)
    expect(souffleDeLaLampe({ t: SOUFFLE_DE_LA_LAMPE / 1000, vivant: true })).toBeCloseTo(1, 9)
  })
})

describe('ce que l’habillage n’inscrit pas', () => {
  // Mutation : une zone posée sur le chef de gare (`v.zone('chef', …)`), sur la lanterne, sur une fenêtre.
  it('aucune zone : seules les dépêches et la voiture du Voyage suivi se touchent', () => {
    for (const [annee, ouvertes] of [[1902, 6], [1905, 5], [1909, 10], [1900, 3]] as const) {
      const f = enGare(annee, ouvertes, { image: () => PHOTO })
      const zone = vi.fn()
      f.vue.zone = zone
      const m = creerMonde1900()
      m.dessinerCiel(f.vue)
      m.dessinerLointain(f.vue)
      m.dessinerSol(f.vue, { x: 0, y: 0 })
      m.dessinerProche(f.vue)
      m.dessinerSurLaBrume(f.vue)
      expect(zone).not.toHaveBeenCalled()
      // Le témoin : ces plans ont bien dessiné quelque chose.
      expect(f.appels.length).toBeGreaterThan(0)
      image(f.vue)
      expect([...new Set(zone.mock.calls.map((a) => a[0]))].filter((id) => id !== 'date' && id !== 'roulotte')).toEqual([])
    }
    // Un chef est bien à l'écran en gare de 1902, six années ouvertes.
    expect(aUnChef(enGare(1902, 6).vue, 1902)).toBe(true)
  })

  // Mutation : la garde `presence <= 0.01` retirée d'`ouvrir` (mineur 2 de la revue de 11a).
  it('rien du tout quand le monde n’est pas présent à l’écran', () => {
    const f = enGare(1905, 5, { presence: 0, image: () => PHOTO })
    image(f.vue)
    expect(f.appels).toEqual([])
  })
})
