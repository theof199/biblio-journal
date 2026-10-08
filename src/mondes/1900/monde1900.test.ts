import { describe, expect, it, vi } from 'vitest'
import { creerMonde1900 } from '.'
import { mondeAVenir } from '../avenir'
import { PAGES_1900 } from './pages'
import { trace1890, traceAVenir, HAUTEUR_MIN_SECTION, type Trace } from '../trace'
import type { CaseVue, VueMonde } from '../types'
import { placerCarte } from '../../carte/placement'
import { construireRoute } from '../../carte/route'
import { vueFactice } from '../../test/vueFactice'
import { contexteFactice } from '../../test/contexteFactice'
import { aDevelopper, developpement, ecranDeLaCase, estFermee, gareALEcran, milieuDeLaGare, objetsSurLeQuai, RAYON_D_OBJET } from './gares'
import { OBJETS, phraseDeLObjet } from './objets'
import { CACHETTES } from './bobines'
import { DATES, PLACES_DES_DEPECHES } from './depeches'
import { vitreOuverte } from './passage'
import { aUnChef, forceDeLaLanterne, lanterneALEcran } from './habillage'
import { decalages, fenetre, RAPPORTS } from './toiles'
import { ANNEES, ARRETS, B1, E, HAUTEUR, PAS, S1, trace1900 } from './trace'
import { ENTREE } from './entree'
import { DEVELOPPEMENT } from './durees'
import { lectureDeLaBande, vignette } from './bande'
import { voitureALEcran } from './suivi'

/**
 * Le monde 1900 (plan 3b, tâche 11a). Décision 12 du plan : ces tests ne portent que sur la logique
 * (la géométrie, les durées, « moins d'animations », ce qui se montre ou non). Aucun ne fige le
 * dessin d'un décor : là où une image entière est lue, elle n'est comparée qu'à une autre image du
 * même dessin, jamais à une suite d'appels attendue.
 */

const SOURCES = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true })

/** Les dix années : les `ouvertes` premières quittées sauf la dernière, en cours ; le reste fermé. */
const cases = (ouvertes: number): CaseVue[] =>
  ANNEES.map((annee, i) => ({ annee, etat: i < ouvertes - 1 ? 'passee' : i === ouvertes - 1 ? 'encours' : 'verrou', attente: false, profondeur: 0, affiches: [], x: 195, y: 0, pop: -9 }))

/** Le train arrêté en gare de `annee`, les `ouvertes` premières années ouvertes, le membre dans la dernière. */
function enGare(annee: number, ouvertes: number, surcharge: Partial<VueMonde> = {}) {
  const bobine = vi.fn()
  const zones: Array<{ id: string; data: number | undefined; x: number }> = []
  const f = vueFactice({ avance: ARRETS[annee - 1900]!, cases: cases(ouvertes), ouverte: { annee: 1899 + ouvertes, t0: -9 }, bobine, ...surcharge })
  // Les zones avec leur place à l'écran : une dépêche hors de l'écran n'est pas montrée.
  f.vue.zone = (id, lx, _ly, _lr, data) => void zones.push({ id, data, x: f.vue.ctx.getTransform().e + lx })
  return { ...f, zones, bobine }
}

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
/** Les appels tels qu'ils se comparent : un dégradé garde ses arrêts, pas la fonction qui les reçoit. */
const lus = (appels: unknown): unknown => JSON.parse(JSON.stringify(appels))

describe('le monde des années 1900', () => {
  // Mutations : `pages: PAGES_A_VENIR` (les pages du monde « à venir ») ; `siteDuChantier` qui rend un `y` ; `entree` vidée (le passage : `passage.test.ts`).
  it('porte les champs du voyage immobile, ses propres pages, aucun chantier, et son passage', () => {
    const m = creerMonde1900()
    expect([m.cle, m.decennie, m.aVenir, m.chapitre, m.nom, m.sous, m.titreVoyageur, m.adieu]).toEqual(['1900', 1900, false, 'Chapitre II', 'Le voyage immobile', 'le train', 'Spectateur du voyage immobile', 0])
    expect(m.pages).toBe(PAGES_1900)
    expect(m.pages).not.toBe(mondeAVenir(1900).pages)
    expect(ANNEES.map((a) => m.siteDuChantier(a))).toEqual(ANNEES.map(() => null))
    expect(m.scene!.entree).toBe(ENTREE)
    expect(ENTREE.length).toBeGreaterThan(0)
    expect(m.musique).not.toBeNull()
    expect(m.musique!.temps).toBeGreaterThan(0)
  })

  // Mutations : une bobine ou une dépêche de la maquette non corrigée par la fiche de données.
  it('porte les bobines et les dépêches de la fiche de données', () => {
    const m = creerMonde1900()
    expect(m.bobines.map((b) => [b.cle, b.qui])).toEqual([
      ['soldiers', 'Joseph Perry et Herbert Booth, 1900'],
      ['hamlet', 'Georges Méliès, 1907'],
      ['fairylogue', 'Francis Boggs et Otis Turner, 1908'],
    ])
    expect(m.dates.map((d) => [d.an, d.court, d.jour, d.image])).toEqual([
      [1900, '14 avril', 'Samedi 14 avril 1900', null],
      [1902, 'sept. 1902', 'Septembre 1902', null],
      [1903, 'déc. 1903', 'Décembre 1903', null],
    ])
  })
})

describe('le tracé de 1900', () => {
  // Mutation : `PAS` à 600 ; un arrêt hors de son point de case ; les arrêts dans le désordre.
  it('pose une gare par année, à 700 px de geste l’une de l’autre, sous la zone du passage', () => {
    const t = trace1900(ANNEES)
    const m = creerMonde1900()
    expect(m.scene!.arrets).toHaveLength(10)
    expect(m.scene!.arrets.map((y) => y - m.scene!.arrets[0]!)).toEqual(ANNEES.map((_, i) => i * 700))
    expect(m.scene!.arrets[0]).toBeGreaterThan(0)
    expect(t.cases.map((w) => t.points[w]![1])).toEqual(m.scene!.arrets)
    expect(t.hauteur).toBeGreaterThanOrEqual(HAUTEUR_MIN_SECTION)
    // La caméra posée en gare de 1909 ne montre rien de la section suivante.
    expect(t.hauteur - m.scene!.arrets[9]!).toBeGreaterThanOrEqual(1000)
    expect(() => trace1900([1901, 1902])).toThrow()
  })

  // Mutation : le deuxième point du tracé changé (`[110, 170]` en `[195, 170]`) ; le premier aussi.
  it('ne déplace pas le bas de 1890 : sa route est celle que donne le monde « à venir »', () => {
    const annees = [1895, 1896, 1897, 1898, 1899, ...ANNEES]
    const route = (de1900: (a: readonly number[]) => Trace) => {
      const plan = placerCarte(annees, (d, a) => (d === 1890 ? trace1890(a) : d === 1900 ? de1900(a) : traceAVenir(a)))
      const haut = plan.sections[1]!.y0
      return { haut, pts: construireRoute(plan.points, 1).pts.filter((p) => p.y < haut) }
    }
    const avec = route(trace1900)
    const sans = route(traceAVenir)
    expect(trace1900(ANNEES).points.slice(0, 2)).toEqual([[195, 40], [110, 170]])
    expect(avec.haut).toBe(sans.haut)
    // La courbe sous la porte de 1890 en fait partie : c'est elle que les premiers points de 1900 tiennent.
    expect(avec.pts.some((p) => p.y > avec.haut - 300)).toBe(true)
    expect(avec.pts).toEqual(sans.pts)
  })
})

describe('les quatre toiles', () => {
  // Mutation : deux rapports échangés (`fond` et `loin`, `gares` et `ballast`).
  it('défilent chacune à son rapport : le fond soixante fois moins que le ballast', () => {
    expect(RAPPORTS).toEqual({ fond: 1 / 60, loin: 2 / 15, gares: 2 / 5, ballast: 1 })
    const a = decalages(B1 + 150)
    const b = decalages(B1 + 150 + PAS)
    const d = { fond: b.fond - a.fond, loin: b.loin - a.loin, gares: b.gares - a.gares, ballast: b.ballast - a.ballast }
    expect(d.gares).toBeCloseTo(E, 6)
    expect(d.ballast / d.fond).toBeCloseTo(60, 6)
    expect(d.loin / d.ballast).toBeCloseTo(2 / 15, 6)
    expect(d.gares / d.ballast).toBeCloseTo(2 / 5, 6)
  })

  // Mutation : la borne retirée de `decalages` (la toile défilerait sous la foire, ou sous 1909).
  // Depuis la tâche 12, le train vient du quai de 1899 : avant le départ, les toiles sont une gare
  // plus tôt, immobiles (`passage.test.ts` garde le trajet).
  it('ne bougent ni avant le départ du quai, ni après la gare de 1909', () => {
    expect(decalages(-400)).toEqual(decalages(S1))
    expect(decalages(S1).gares).toBe(-E)
    expect(decalages(B1).ballast).toBe(0)
    expect(decalages(HAUTEUR)).toEqual(decalages(ARRETS[9]!))
  })

  // Mutation : `E` et `PAS` confondus dans `decalages`.
  it('amènent chaque gare au milieu de l’écran à son arrêt', () => {
    ANNEES.forEach((_, i) => expect(milieuDeLaGare({ W: 390, avance: ARRETS[i]! }, i)).toBeCloseTo(195, 6))
    const g = gareALEcran({ W: 390, H: 700, avance: ARRETS[4]! }, 4)
    expect(g.x + g.w / 2).toBeCloseTo(195, 6)
    expect(g.y + g.h).toBeCloseTo(700 * 0.81, 6)
  })

  // Mutation : la fenêtre toujours pleine (le train couvrirait le bas de la foire, ou la section suivante).
  it('ne couvrent que la part de l’écran où la section se tient', () => {
    expect(fenetre({ H: 700, avance: -300 })).toEqual([300, 700])
    expect(fenetre({ H: 700, avance: 2000 })).toEqual([0, 700])
    expect(fenetre({ H: 700, avance: HAUTEUR - 200 })).toEqual([0, 200])
    // La section sortie par le haut de l'écran, le train à sa place : rien ne se dessine (la foire
    // à l'écran, c'est le passage qui couvre : `passage.test.ts`).
    const { vue, appels } = vueFactice({ avance: HAUTEUR + 5 })
    image(vue)
    expect(appels).toEqual([])
  })
})

describe('moins d’animations', () => {
  // Mutations : une toile lue sur `v.t` (`decalages(v.avance + v.t)`) ; `!v.vivant` retiré de `developpement`.
  it('au calme, deux images à deux instants sont la même, une plaque qui s’ouvre comprise', () => {
    const dessin = (t: number, vivant: boolean) => {
      const f = enGare(1902, 3, { t, vivant, ouverte: { annee: 1902, t0: 1 }, image: () => PHOTO })
      image(f.vue)
      return lus(f.appels)
    }
    expect(dessin(1.4, false)).toEqual(dessin(9, false))
    // Le témoin : vivant, la plaque se développe entre ces deux instants.
    expect(dessin(1.4, true)).not.toEqual(dessin(9, true))
    expect(developpement({ vivant: false, t: 1.4, ouverte: { annee: 1902, t0: 1 } }, 1902)).toBe(1)
  })
})

describe('la plaque d’une année', () => {
  // Mutations : `t0` ignoré (`v.t * 1000 / DEVELOPPEMENT`) ; la durée portée au-delà de neuf secondes.
  it('est posée développée sans ouverture sous les yeux', () => {
    // -9 : neuf secondes avant toute horloge. Dès l'instant 0, la plaque est développée.
    for (const t of [0, 0.4, 3.2]) expect(developpement({ vivant: true, t, ouverte: { annee: 1902, t0: -9 } }, 1902)).toBe(1)
    expect(DEVELOPPEMENT).toBeLessThan(9000)
  })

  // Mutations : le développement daté de l'horloge seule ; joué pour une autre année que celle qui s'ouvre.
  it('se développe à l’ouverture, sur sa durée, pour la seule année qui s’ouvre', () => {
    const v = (t: number) => ({ vivant: true, t, ouverte: { annee: 1902, t0: 10 } })
    expect(developpement(v(10), 1902)).toBe(0)
    expect(developpement(v(10 + DEVELOPPEMENT / 2000), 1902)).toBeCloseTo(0.5, 6)
    expect(developpement(v(10 + DEVELOPPEMENT / 1000 + 1), 1902)).toBe(1)
    expect(developpement(v(10), 1901)).toBe(1)
  })

  // Mutations : une année fermée tenue pour développée ; la garde `annee > ouverte.annee` retirée.
  it('reste à développer tant que l’année est fermée, ou que le membre n’y est pas arrivé', () => {
    const v = { cases: cases(3), ouverte: { annee: 1902, t0: -9 } }
    expect(ANNEES.map((a) => aDevelopper(v, a))).toEqual([false, false, false, true, true, true, true, true, true, true])
    // L'année vient de s'ouvrir, le train roule encore vers sa gare : la page n'avance `ouverte` qu'à l'arrivée.
    const enRoute = { cases: cases(4), ouverte: { annee: 1902, t0: -9 } }
    expect(aDevelopper(enRoute, 1903)).toBe(true)
    expect(aDevelopper({ ...enRoute, ouverte: { annee: 1903, t0: 4 } }, 1903)).toBe(false)
  })
})

// Revue du lot 2 (I1) : un membre hors IA arrivé dans une année que le Voyage suivi n'a pas encore
// ouverte. La case commune, le corail et la bande la tiennent pour fermée : la gare aussi.
describe('une année en attente du Voyage suivi', () => {
  /** Les `ouvertes` premières années ouvertes, le membre arrivé dans la dernière ; `annee` porte `sur`. */
  const avec = (ouvertes: number, annee: number, sur: Partial<CaseVue>) => cases(ouvertes).map((k) => (k.annee === annee ? { ...k, ...sur } : k))
  const moyen = (annee: number, ouvertes: number, lesCases: CaseVue[]) => {
    const f = enGare(annee, ouvertes, { cases: lesCases, image: () => PHOTO })
    creerMonde1900().dessinerMoyen(f.vue)
    return { appels: lus(f.appels), dates: f.zones.filter((z) => z.id === 'date').length, bobines: f.bobine.mock.calls.length }
  }

  // Mutation : `|| a.attente === true` retiré d'`estFermee` (la garde de la gare et celle de la bande, d'un coup).
  it('est fermée, quel que soit son état, comme une année verrouillée ou sans case', () => {
    expect(estFermee({ etat: 'encours', attente: true })).toBe(true)
    expect(estFermee({ etat: 'lion', attente: true })).toBe(true)
    expect(estFermee({ etat: 'verrou', attente: false })).toBe(true)
    expect(estFermee(undefined)).toBe(true)
    expect(estFermee({ etat: 'encours', attente: false })).toBe(false)
    expect(estFermee({ etat: 'passee', attente: false })).toBe(false)
  })

  // Mutations : la garde d'`estFermee` retirée ; `aDevelopper` revenu à la seule lecture de `etat`.
  it('n’est pas développée dans sa gare : la plaque à développer sous sa lanterne, ni dépêche, ni bobine, ni chef', () => {
    // Le membre est arrivé en 1903, en cours, et le Voyage suivi ne l'a pas ouverte.
    const v = { cases: avec(4, 1903, { attente: true }), ouverte: { annee: 1903, t0: -9 }, t: 3, vivant: true, W: 390, H: 700, avance: ARRETS[3]! }
    expect(ANNEES.map((a) => aDevelopper(v, a))).toEqual([false, false, false, true, true, true, true, true, true, true])
    expect(forceDeLaLanterne(v, 1903)).toBe(1)
    expect(lanterneALEcran(v, 1903)).not.toBeNull()
    // Une année quittée en attente n'a pas son chef de gare ; ouverte, elle l'a.
    expect(aUnChef({ ...v, cases: avec(4, 1902, { attente: true }) }, 1902)).toBe(false)
    expect(aUnChef({ ...v, cases: cases(4) }, 1902)).toBe(true)
    // 1903 porte une dépêche, 1904 une bobine.
    expect(moyen(1903, 4, cases(4)).dates).toBe(1)
    expect(moyen(1903, 4, avec(4, 1903, { attente: true })).dates).toBe(0)
    expect(moyen(1904, 5, cases(5)).bobines).toBe(1)
    expect(moyen(1904, 5, avec(5, 1904, { attente: true })).bobines).toBe(0)
  })

  // Deux images comparées entre elles, aucune suite d'appels attendue. Mutation : la garde d'`estFermee` retirée.
  it('se dessine dans sa gare comme la même année verrouillée, pas comme une année ouverte', () => {
    const attente = moyen(1903, 4, avec(4, 1903, { attente: true })).appels
    expect(attente).toEqual(moyen(1903, 4, avec(4, 1903, { etat: 'verrou' })).appels)
    expect(attente).not.toEqual(moyen(1903, 4, cases(4)).appels)
  })

  // Mutation : `dessinerBande` revenu à `a.etat === 'verrou'` seul.
  it('se dessine dans la bande comme la même année verrouillée, pas comme une année ouverte', () => {
    const bande = (etat: CaseVue['etat'], attente: boolean) => {
      const { ctx, appels } = contexteFactice()
      const annees = ANNEES.map((annee) => (annee === 1903 ? { annee, etat, attente } : { annee, etat: 'passee' as const, attente: false }))
      creerMonde1900().scene!.dessinerBande(ctx, { x: 10, y: 400, w: 370, h: 60, e: 1, image: () => PHOTO }, { annees, anneeAvatar: 1903 })
      return lus(appels)
    }
    expect(bande('encours', true)).toEqual(bande('verrou', false))
    expect(bande('encours', true)).not.toEqual(bande('encours', false))
  })
})

describe('les dépêches et les bobines', () => {
  const dates = (f: ReturnType<typeof enGare>) => f.zones.filter((z) => z.id === 'date' && z.x >= 0 && z.x <= 390).map((z) => z.data)
  const bobines = (f: ReturnType<typeof enGare>) => f.bobine.mock.calls.filter((a) => a[1] >= 0 && a[1] <= 390).map((a) => a[0])
  const montre = (annee: number, ouvertes: number) => {
    const f = enGare(annee, ouvertes)
    creerMonde1900().dessinerMoyen(f.vue)
    return { dates: dates(f), bobines: bobines(f) }
  }

  // Mutation : la garde `aDevelopper` retirée devant les dépêches ; devant les bobines.
  it('ne se montrent pas pour une année fermée', () => {
    // 1903 porte une dépêche, 1904 une bobine : fermées, elles n'en montrent rien.
    expect(montre(1903, 3)).toEqual({ dates: [], bobines: [] })
    expect(montre(1904, 3)).toEqual({ dates: [], bobines: [] })
    expect(montre(1903, 4)).toEqual({ dates: [2], bobines: [] })
    expect(montre(1904, 5)).toEqual({ dates: [], bobines: [2] })
  })

  // Mutation : *Hamlet* remise en gare de 1902 ; une dépêche déplacée d'une gare.
  it('se tiennent en gare de 1900, 1901 et 1904 pour les bobines, de 1900, 1902 et 1903 pour les dépêches', () => {
    expect(ANNEES.map((a) => montre(a, 10))).toEqual([
      { dates: [0], bobines: [0] },
      { dates: [], bobines: [1] },
      { dates: [1], bobines: [] },
      { dates: [2], bobines: [] },
      { dates: [], bobines: [2] },
      { dates: [], bobines: [] },
      { dates: [], bobines: [] },
      { dates: [], bobines: [] },
      { dates: [], bobines: [] },
      { dates: [], bobines: [] },
    ])
  })

  // Mutation : `y` d'une dépêche à l'arrêt d'une autre gare (l'aperçu d'une date s'y ancrerait).
  it('une dépêche porte l’arrêt de sa gare', () => {
    expect(creerMonde1900().dates.map((d) => d.y)).toEqual([ARRETS[0], ARRETS[2], ARRETS[3]])
  })
})

describe('où se tient une année à l’écran', () => {
  // Mutation : la borne retirée d'`ecranDeLaCase` (une gare hors de l'écran resterait touchable).
  it('est nul pour une gare hors de l’écran, pour une année d’ailleurs, et hors de la fenêtre de la section', () => {
    const m = creerMonde1900()
    const { vue } = enGare(1903, 10)
    const p = m.scene!.ecranDeLaCase(vue, 1903)!
    expect(p.x).toBeGreaterThan(0)
    expect(p.x).toBeLessThan(390)
    expect(p.y).toBeGreaterThan(0)
    expect(p.y).toBeLessThan(700)
    expect(ANNEES.filter((a) => m.scene!.ecranDeLaCase(vue, a) !== null)).toEqual([1903])
    expect(m.scene!.ecranDeLaCase(vue, 1899)).toBeNull()
    expect(m.scene!.ecranDeLaCase(vue, 1910)).toBeNull()
    // La section commence sous l'écran : la gare de 1900 n'y est pas encore.
    expect(ecranDeLaCase(vueFactice({ avance: -700 }).vue, 1900)).toBeNull()
  })

  // Mutation : une zone inscrite, ou un dessin, dans `ecranDeLaCase` (le moteur l'appelle hors d'une image).
  it('est pure : ni dessin, ni zone', () => {
    const f = enGare(1903, 10)
    creerMonde1900().scene!.ecranDeLaCase(f.vue, 1903)
    expect(f.appels).toEqual([])
    expect(f.zones).toEqual([])
  })
})

// Plan des écrans des lots, brief 4 : un objet oublié par gare, sur son quai. Les règles seulement
// (lequel se propose, où, quand) : rien ici ne regarde son tracé.
describe('les objets oubliés sur le quai', () => {
  const aLEcran = (f: ReturnType<typeof enGare>) => objetsSurLeQuai(f.vue).filter((o) => o.x >= 0 && o.x <= 390).map((o) => o.rang)

  // Mutations : `objets: []` au monde ; une clé hors du contrat ; la phrase sans son accord.
  it('le monde cache les dix objets du catalogue, par clé du contrat, chacun avec sa phrase accordée', () => {
    const m = creerMonde1900()
    expect(m.objets.map((o) => o.cle)).toEqual(['lanterne', 'melon', 'parapluie', 'montre', 'programme', 'facteur', 'longuevue', 'eventail', 'sifflet', 'valise'])
    expect(m.objets.map((o) => o.cle)).toEqual(OBJETS.map((o) => o.cle))
    expect(m.objets[0]!.phrase).toBe('Une lanterne de chef de gare, oubliée en gare de 1900 : elle attend dans la sacoche.')
    expect(m.objets[1]!.phrase).toBe('Un chapeau melon, oublié en gare de 1901 : il attend dans la sacoche.')
    expect(m.objets.map((o) => o.phrase)).toEqual(OBJETS.map(phraseDeLObjet))
  })

  // Mutation : un objet déplacé d'une gare (`annee` lue ailleurs, ou `o.annee - 1899`).
  it('chacun se tient dans la gare de son année, un par gare, de 1900 à 1909', () => {
    expect(ANNEES.map((a) => aLEcran(enGare(a, 10)))).toEqual(ANNEES.map((_, i) => [i]))
    expect(OBJETS.map((o) => o.annee)).toEqual([...ANNEES])
  })

  // La règle pure du brief. Mutation : la garde `aDevelopper` ôtée d'`objetsSurLeQuai`.
  it('aucun ne se propose dans une gare à développer : fermée, en attente du Voyage suivi, ou pas encore atteinte', () => {
    // La montre attend en 1903. Trois années ouvertes : la gare est fermée.
    expect(aLEcran(enGare(1903, 3))).toEqual([])
    expect(aLEcran(enGare(1903, 4))).toEqual([3])
    // En attente du Voyage suivi : fermée partout, plaque comprise.
    expect(aLEcran(enGare(1903, 4, { cases: cases(4).map((k) => (k.annee === 1903 ? { ...k, attente: true } : k)) }))).toEqual([])
    // L'année vient de s'ouvrir, le train roule encore vers sa gare : `ouverte` n'y est pas.
    expect(aLEcran(enGare(1903, 4, { ouverte: { annee: 1902, t0: -9 } }))).toEqual([])
  })

  // « Ce qui se touche » : rien tant que la vitre n'a pas rempli l'écran, ni hors de la part de l'écran
  // où la section se voit. Mutation : `dansLaFenetre` remplacé par vrai dans `objetsSurLeQuai`.
  it('aucun ne se propose tant que la vitre n’a pas rempli l’écran, ni là où la section ne se voit pas', () => {
    let fermees = 0
    for (let avance = -700; avance <= ARRETS[0]!; avance += 20) {
      if (vitreOuverte(avance)) continue
      fermees += 1
      expect(objetsSurLeQuai(enGare(1900, 10, { avance }).vue), `avance ${avance}`).toEqual([])
    }
    // Le plancher : le balayage a bien traversé le passage, et la gare de 1900 offre sa lanterne.
    expect(fermees).toBeGreaterThan(10)
    expect(aLEcran(enGare(1900, 10))).toEqual([0])
    expect(objetsSurLeQuai(enGare(1909, 10, { avance: HAUTEUR - 300 }).vue)).toEqual([])
  })

  // Le monde pose ce qui se propose, à son rang et à son rayon, et rien de ce qui est déjà ramassé :
  // le moteur n'inscrit alors aucune zone. Mutations : `v.objet` appelé pour un objet ramassé (le
  // monde le dessinerait encore) ; un autre rang que celui du catalogue ; `objetsSurLeQuai` non lu.
  it('le monde pose l’objet de la gare tant qu’il n’est pas ramassé, et ne le pose plus ensuite', () => {
    const poses = (ramasse: (i: number) => boolean) => {
      const objet = vi.fn()
      const f = enGare(1903, 10, { objet, objetRamasse: ramasse })
      creerMonde1900().dessinerMoyen(f.vue)
      return objet.mock.calls.filter((a) => a[1] >= 0 && a[1] <= 390)
    }
    const [ici] = objetsSurLeQuai(enGare(1903, 10).vue).filter((o) => o.x >= 0 && o.x <= 390)
    expect(poses(() => false)).toEqual([[3, ici!.x, ici!.y, RAYON_D_OBJET]])
    expect(poses((i) => i === 3)).toEqual([])
    expect(poses((i) => i !== 3)).toHaveLength(1)
  })

  // Les places de la lanterne et du parapluie sont posées ici, hors maquette : aucune ne tombe sur la
  // bobine ou la dépêche de sa gare, dont la zone la couvrirait (ou l'inverse). Les zones se
  // comptent à leur rayon inscrit : 1,6 fois le rayon pour l'objet et la bobine, 26 px pour la dépêche.
  // Mutations : la lanterne posée à la place de la bobine de 1900 (`dx: -122, bas: 33`) ; dans
  // `objetsSurLeQuai`, la place prise à un autre repère que celui de la bobine.
  it('aucun objet ne se pose sur la bobine ni sur la dépêche de sa gare', () => {
    const heurts: string[] = []
    for (const H of [640, 760, 900]) {
      for (const [rang, o] of OBJETS.entries()) {
        // La place vient de la règle elle-même, le train arrêté dans sa gare : rien n'est recalculé ici.
        const { vue } = enGare(o.annee, 10, { H })
        const pose = objetsSurLeQuai(vue).find((p) => p.rang === rang)
        if (!pose) {
          heurts.push(`${o.cle} ne se propose pas, H ${H}`)
          continue
        }
        const ici = { x: pose.x - milieuDeLaGare(vue, rang), y: pose.y }
        CACHETTES.filter((b) => b.an === o.annee).forEach((b) => {
          if (Math.hypot(ici.x - b.dx, ici.y - (H * (1 - b.bas / 100) - 12)) < (RAYON_D_OBJET + 8) * 1.6) heurts.push(`${o.cle} et la bobine, H ${H}`)
        })
        DATES.forEach((d, rang) => {
          const place = PLACES_DES_DEPECHES[rang]!
          if (d.an === o.annee && Math.hypot(ici.x - place.dx, ici.y - (H * (1 - place.bas / 100) - 10)) < RAYON_D_OBJET * 1.6 + 26) heurts.push(`${o.cle} et la dépêche, H ${H}`)
        })
      }
    }
    expect(heurts).toEqual([])
    // Le plancher : la comparaison a bien des voisins à qui se mesurer.
    expect(OBJETS.filter((o) => CACHETTES.some((b) => b.an === o.annee) || DATES.some((d) => d.an === o.annee)).map((o) => o.cle)).toEqual(['lanterne', 'melon', 'parapluie', 'montre', 'programme'])
  })
})

describe('ce qui se touche hors de la fenêtre de la section', () => {
  // Mutations : la borne `dansLaFenetre` retirée devant la dépêche ; devant la bobine ; devant la zone `roulotte`.
  it('n’inscrit ni dépêche, ni bobine, ni voiture là où la section ne se voit pas', () => {
    const m = creerMonde1900()
    const touche = (avance: number, suivi: number) => {
      const f = enGare(1900, 10, { avance })
      m.dessinerMoyen(f.vue)
      m.scene!.dessinerSuivi(f.vue, { pseudo: 'lea', annee: suivi })
      return { zones: f.zones.map((z) => z.id).sort(), bobines: f.bobine.mock.calls.length }
    }
    // Le haut de la section est la zone du passage, où rien ne se touche (`passage.test.ts`) : le
    // haut de 1900 à 500 px du haut de l'écran, la foire de 1890 au-dessus, rien ne s'inscrit.
    expect(touche(-500, 1900)).toEqual({ zones: [], bobines: 0 })
    // Le témoin : en gare de 1900, tout se touche.
    expect(touche(ARRETS[0]!, 1900)).toEqual({ zones: ['date', 'roulotte'], bobines: 1 })
    // Le bas de la section à 300 px du haut : la voiture garée en 1909 est coupée, elle ne se touche plus.
    expect(touche(HAUTEUR - 300, 1909)).toEqual({ zones: [], bobines: 0 })
    expect(touche(ARRETS[9]!, 1909)).toEqual({ zones: ['roulotte'], bobines: 0 })
  })
})

describe('l’heure du visiteur', () => {
  // Mutations : une teinte multipliée par `v.nuit` ; par `v.lum` ; un `v.feu` ajouté.
  it('ne change rien à l’image, et n’allume aucun feu', () => {
    const dessin = (surcharge: Partial<VueMonde>) => {
      const f = enGare(1902, 3, { image: () => PHOTO, ...surcharge })
      image(f.vue)
      return f
    }
    expect(lus(dessin({ nuit: 0 }).appels)).toEqual(lus(dessin({ nuit: 1 }).appels))
    expect(lus(dessin({ lum: 0.45 }).appels)).toEqual(lus(dessin({ lum: 1.3 }).appels))
    const f = dessin({ nuit: 1, lum: 1.3 })
    expect(f.appels.length).toBeGreaterThan(0)
    expect(f.vue.feu).not.toHaveBeenCalled()
  })
})

describe('le toucher du décor', () => {
  // Mutation : un `clap` ajouté dans `reagir` (`ambianceDeLaPage(…).clap()`), ou une particule.
  it('ne sonne ni n’anime rien', () => {
    const f = enGare(1902, 3)
    creerMonde1900().reagir('date', 0, f.vue, { x: 100, y: 100 })
    creerMonde1900().reagir('gare', null, f.vue, { x: 100, y: 100 })
    for (const espion of [f.vue.marquer, f.vue.etincelles, f.vue.confettis, f.vue.fumee, f.vue.feu, f.bobine]) expect(espion).not.toHaveBeenCalled()
    expect(f.appels).toEqual([])
    // L'ambiance de la carte (`carte/son`) est la seule porte du son : aucun fichier du monde ne l'importe.
    expect(Object.keys(SOURCES)).toContain('./index.ts')
    expect(Object.entries(SOURCES).filter(([, code]) => /carte\/son|AudioContext\(/.test(code)).map(([f2]) => f2)).toEqual([])
  })
})

describe('le Voyage suivi', () => {
  // Mutations : la voiture garée dans une autre gare ; la zone `roulotte` oubliée, ou inscrite hors de l'écran.
  it('est garé dans la gare de son année, et s’y touche', () => {
    const m = creerMonde1900()
    const ici = enGare(1902, 3)
    const p = voitureALEcran(ici.vue, 1902)!
    expect(p.x + p.w / 2).toBeCloseTo(195 + 70, 6)
    m.scene!.dessinerSuivi(ici.vue, { pseudo: 'lea', annee: 1902 })
    expect(ici.zones.map((z) => z.id)).toEqual(['roulotte'])
    const ailleurs = enGare(1905, 3)
    expect(voitureALEcran(ailleurs.vue, 1902)).toBeNull()
    m.scene!.dessinerSuivi(ailleurs.vue, { pseudo: 'lea', annee: 1902 })
    expect(ailleurs.zones).toEqual([])
    expect(voitureALEcran(ici.vue, 1897)).toBeNull()
  })
})

describe('la bande de la vue d’ensemble', () => {
  const cadre = { x: 10, y: 400, w: 370, h: 60, e: 1, image: () => null }
  const etat = { annees: ANNEES.map((annee) => ({ annee, etat: 'verrou' as const, attente: false })), anneeAvatar: 1899 }

  // Mutation : deux vignettes échangées (dans `vignette`, ou dans la lecture).
  it('rend l’année sous le doigt, chacune dans sa vignette, de gauche à droite', () => {
    const { ctx } = contexteFactice()
    const lire = creerMonde1900().scene!.dessinerBande(ctx, cadre, etat)
    // Là où chaque vignette est dessinée, et à un point écrit en clair : 37 px par année depuis 10.
    ANNEES.forEach((a, i) => {
      const r = vignette(cadre, 10, i)
      expect(lire(r.x + r.w / 2, r.y + r.h / 2)).toBe(a)
      expect(lire(10 + 37 * i + 18, 430)).toBe(a)
    })
    expect(lire(10, 400)).toBe(1900)
    expect(lire(379.9, 459.9)).toBe(1909)
  })

  // Mutation : la borne du cadre retirée de la lecture.
  it('ne rend rien hors du cadre', () => {
    const lire = lectureDeLaBande(cadre, ANNEES)
    for (const [x, y] of [[9, 430], [380, 430], [195, 399], [195, 460], [-50, -50]] as const) expect(lire(x, y)).toBeNull()
    expect(lectureDeLaBande(cadre, [])(195, 430)).toBeNull()
  })
})
