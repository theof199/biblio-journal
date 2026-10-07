import { describe, expect, it, vi } from 'vitest'
import { creerMonde1900 } from '.'
import type { CaseVue, VueMonde } from '../types'
import { vueFactice } from '../../test/vueFactice'
import { auTempo } from '../../voyage/tempo'
import { ENTREE } from './entree'
import { borneALEcran, departALEcran, ecranDeLaCase, milieuDeLaGare } from './gares'
import { assise, bouffee, cadrageDuQuai, dessousDevant, interieurALEcran, jonctionALEcran, montee, ouverture, quaiALEcran, trajet, VITRE, vitreALEcran, vitreOuverte } from './passage'
import { dansLaFenetre, decalages } from './toiles'
import { A1, ANNEES, ARRETS, B1, E, JONCTION, S1, U0 } from './trace'

/**
 * Le passage de la foire au train (plan 3b, tâche 12). Décision 12 du plan : ces tests ne portent
 * que sur la logique (la liste des positions, les moitiés exactes, les fonctions pures d'`avance`
 * que le dessin lit). Aucun ne fige les appels de canvas d'un moment du passage : là où une image
 * entière est lue, elle n'est comparée qu'à une autre image du même dessin.
 */

const FICHE = Object.values(import.meta.glob<string>('/docs/maquettes/voyage-immobile-1900-donnees.md', { query: '?raw', import: 'default', eager: true }))[0] ?? ''
/** Les durées de l'endroit telles qu'on les voit à l'écran, lues dans la fiche de données (« Ce que 12 joue », la table `TEMPS`). */
const A_L_ECRAN: Record<string, number> = Object.fromEntries([...FICHE.matchAll(/^\| `(\w+)` \| (\d+) \|$/gm)].map(([, nom, ms]) => [nom!, Number(ms)]))

const PHOTO = {} as CanvasImageSource
const lus = (appels: unknown): unknown => JSON.parse(JSON.stringify(appels))
/** Les dix années ouvertes, le membre en 1909 : aucune plaque à développer, aucune lampe qui respire. */
const TOUTES: CaseVue[] = ANNEES.map((annee) => ({ annee, etat: annee === 1909 ? 'encours' : 'passee', profondeur: 0, x: 195, y: 0, pop: -9 }))
const vueA = (avance: number, surcharge: Partial<VueMonde> = {}) => vueFactice({ avance, cases: TOUTES, ouverte: { annee: 1909, t0: -9 }, image: () => PHOTO, ...surcharge })
const ecran = (avance: number) => ({ W: 390, H: 700, avance })

/** Une image entière du monde : tous ses plans, dans l'ordre du moteur, et le Voyage suivi garé en 1900. */
function image(v: VueMonde): void {
  const m = creerMonde1900()
  m.dessinerCiel(v)
  m.dessinerLointain(v)
  m.dessinerMoyen(v)
  m.dessinerSol(v, { x: 0, y: 0 })
  m.dessinerProche(v)
  m.scene!.dessinerSuivi(v, { pseudo: 'lea', annee: 1900 })
  m.dessinerSurLaBrume(v)
  m.dessinerAdieu(v)
}

/** Des avances de chaque moment : la foire, la descente, le quai, la montée, assis, le trajet, la gare. */
const MOMENTS = [U0, -300, -40, 60, A1, 250, 330, 380, S1, 470, 560, 650, 700, B1]

describe('les positions du passage', () => {
  // Mutations : deux positions échangées dans `ENTREE` ; la dernière posée ailleurs qu'en gare de 1900.
  it('sont quatre, de la foire à la gare de 1900, dans l’ordre où la caméra descend', () => {
    const entree = creerMonde1900().scene!.entree
    expect(entree).toBe(ENTREE)
    expect(entree.map((x) => x.y)).toEqual([U0, A1, S1, B1])
    entree.slice(1).forEach((x, i) => expect(x.y).toBeGreaterThan(entree[i]!.y))
    expect(entree[3]!.y).toBe(creerMonde1900().scene!.arrets[0])
    // Le premier temps est au-dessus de la section, sur la foire ; le quai, une jonction sous son haut.
    expect(U0).toBeLessThan(0)
    expect(A1).toBe(JONCTION)
  })

  // Mutations : `auTempo` posé sur une seule valeur, tour à tour sur chacune des cinq (elle double) ;
  // une valeur qui dérive d'un cran.
  it('portent chacune la moitié exacte de ce que la fiche de données montre à l’écran', () => {
    expect(A_L_ECRAN).toEqual({ descente: 2600, quai: 1100, montee: 2200, assis: 1000, trajet: 4600 })
    const [foire, quai, assis, gare] = [ENTREE[0]!, ENTREE[1]!, ENTREE[2]!, ENTREE[3]!]
    expect(auTempo(quai.duree)).toBe(A_L_ECRAN.descente)
    expect(auTempo(quai.arret)).toBe(A_L_ECRAN.quai)
    expect(auTempo(assis.duree)).toBe(A_L_ECRAN.montee)
    expect(auTempo(assis.arret)).toBe(A_L_ECRAN.assis)
    expect(auTempo(gare.duree)).toBe(A_L_ECRAN.trajet)
    // Ni pause sur la foire, ni pause en gare : le passage finit à l'arrivée.
    expect([foire.arret, gare.arret]).toEqual([0, 0])
    expect(ENTREE).toHaveLength(4)
  })

  // Mutation : l'arrêt du quai à zéro ; les deux arrêts échangés.
  it('s’arrêtent au quai, le temps de lire : le plus long des deux arrêts', () => {
    expect(ENTREE[1]!.arret).toBeGreaterThan(0)
    expect(ENTREE[1]!.arret).toBeGreaterThan(ENTREE[2]!.arret)
    expect(Math.max(...ENTREE.map((x) => x.arret))).toBe(ENTREE[1]!.arret)
  })
})

describe('le passage ne dépend que de l’avance', () => {
  // Mutations : un dessin du passage lu sur `v.t` (la bouffée qui dérive avec l'horloge) ; sur
  // `v.entree` (les mots du quai éteints hors du passage joué).
  it('décor vivant, à avance égale : la même image pour deux instants, et que le passage se joue ou non', () => {
    for (const avance of MOMENTS) {
      const dessin = (t: number, entree: number) => {
        const f = vueA(avance, { t, entree, vivant: true })
        image(f.vue)
        return lus(f.appels)
      }
      const reference = dessin(1.4, -1)
      expect(dessin(9, -1)).toEqual(reference)
      expect(dessin(1.4, 3)).toEqual(reference)
      expect(dessin(7.3, 0.2)).toEqual(reference)
    }
  })

  // Le témoin du test d'avant : d'un moment au suivant, l'image change, et chaque moment dessine.
  it('et change avec elle, à chaque moment', () => {
    const dessins = MOMENTS.map((avance) => {
      const f = vueA(avance)
      image(f.vue)
      return JSON.stringify(f.appels)
    })
    dessins.forEach((d) => expect(d.length).toBeGreaterThan(2))
    expect(new Set(dessins).size).toBe(MOMENTS.length)
  })
})

describe('les cinq moments', () => {
  // Mutation : `dessousDevant` toujours faux (la jonction et le quai passeraient sous le décor de la foire).
  it('la foire à l’écran : la jonction et le quai se dessinent après tous les plans, rien du train avant', () => {
    for (const avance of [U0, -300, -1, 0, 100, A1]) {
      expect(vitreALEcran(ecran(avance))).toBeNull()
      expect(dessousDevant(ecran(avance))).toBe(true)
      const m = creerMonde1900()
      const avant = vueA(avance)
      m.dessinerCiel(avant.vue)
      m.dessinerLointain(avant.vue)
      m.dessinerMoyen(avant.vue)
      m.dessinerSol(avant.vue, { x: 0, y: 0 })
      m.dessinerProche(avant.vue)
      expect(avant.appels).toEqual([])
      const apres = vueA(avance)
      m.dessinerSurLaBrume(apres.vue)
      expect(apres.appels.length).toBeGreaterThan(0)
    }
    // Assis, la vitre existe : ce qui est dessous passe avant les toiles, au premier plan appelé.
    expect(dessousDevant(ecran(S1))).toBe(false)
    const assis = vueA(S1)
    creerMonde1900().dessinerCiel(assis.vue)
    expect(assis.appels.length).toBeGreaterThan(0)
  })

  // Mutations : la jonction qui ne glisse pas avec la foire (`y: 0`) ; le quai qui n'attend pas la jonction (`A1` retiré).
  it('on quitte la foire : la jonction glisse sous la carte, le quai entre par le bas, juste dessous', () => {
    expect(jonctionALEcran(ecran(-700))).toBeNull()
    expect(jonctionALEcran(ecran(-300))).toEqual({ y: 300 })
    expect(quaiALEcran(ecran(-300))!.y).toBe(300 + JONCTION)
    expect(quaiALEcran(ecran(A1 - 700))).toBeNull()
    // Au quai, la jonction est sortie par le haut, et n'est plus dessinée ensuite.
    expect(jonctionALEcran(ecran(A1))!.y).toBe(-JONCTION)
    expect(jonctionALEcran(ecran(A1 + 3))).toBeNull()
  })

  // Mutations : le quai déjà grossi à son arrêt ; ses mots déjà éteints ; la bouffée déjà levée.
  it('le quai : à son arrêt il remplit l’écran, sa plaque lisible, sans vapeur ni compartiment', () => {
    expect(quaiALEcran(ecran(A1))).toEqual({ y: 0, zoom: 1, mots: 1 })
    expect(bouffee(A1)).toBe(0)
    expect(interieurALEcran(A1)).toBeNull()
    for (const [W, H] of [[390, 700], [360, 640], [820, 1180], [1280, 720]] as const) {
      const cadrage = cadrageDuQuai(W, H, [624, 459])
      expect(cadrage.x).toBeLessThanOrEqual(0)
      expect(cadrage.y).toBeLessThanOrEqual(0)
      expect(cadrage.x + cadrage.w).toBeGreaterThanOrEqual(W - 1e-9)
      expect(cadrage.y + cadrage.h).toBeGreaterThanOrEqual(H - 1e-9)
      expect(cadrage.w / cadrage.h).toBeCloseTo(624 / 459, 9)
      expect(cadrage.fondu[0]).toBeGreaterThanOrEqual(0)
      expect(cadrage.fondu[1]).toBeGreaterThan(cadrage.fondu[0])
      expect(cadrage.fondu[1]).toBeLessThanOrEqual(1)
    }
  })

  // Mutations : la bouffée décalée (`lisse(0.33, 0.47, …)` devenu `lisse(0.2, 0.3, …)`) ; le quai
  // qui ne grossit plus ; le compartiment qui paraît avant la vapeur.
  it('la montée : le quai grossit, et la vapeur couvre le moment où le compartiment le remplace', () => {
    let zoom = 1
    for (let avance = A1; avance < S1; avance += 4) {
      const q = quaiALEcran(ecran(avance))!
      expect(q.zoom).toBeGreaterThanOrEqual(zoom)
      zoom = q.zoom
      const a = assise(avance)
      if (a > 0 && a <= 0.5) expect(bouffee(avance)).toBeGreaterThan(0.9)
      if (bouffee(avance) === 0) expect(a === 0 || a === 1).toBe(true)
    }
    expect(zoom).toBeCloseTo(2.3, 9)
    // Les mots du quai sont éteints avant que la vapeur ne soit pleine.
    expect(quaiALEcran(ecran(A1 + 0.25 * 560))!.mots).toBe(0)
  })

  // Mutations : le départ retiré de `decalages` (assis, on verrait déjà la gare de 1900 loin à droite
  // et rien dans la vitre) ; `T_DEPART` sous `T_ASSIS` (le train partirait avant qu'on soit assis).
  it('assis, encore à quai : la vitre est dans sa cloison, et montre le quai de 1899 qu’on vient de quitter', () => {
    const v = ecran(S1)
    expect(assise(S1)).toBe(1)
    expect(interieurALEcran(S1)).toEqual({ alpha: 1, echelle: 1 })
    expect(trajet(S1)).toBe(0)
    const vitre = vitreALEcran(v)!
    expect(vitre.alpha).toBe(1)
    expect(vitre.x).toBeCloseTo(390 * VITRE.x, 9)
    expect(vitre.y).toBeCloseTo(700 * VITRE.y, 9)
    expect(vitre.w).toBeCloseTo(390 * VITRE.w, 9)
    expect(vitre.h).toBeCloseTo(700 * VITRE.h, 9)
    expect(vitre.cadre).toEqual({ x: vitre.x, y: vitre.y, sx: 1, sy: 1 })
    // Le quai de départ est au milieu de l'écran, une gare avant celle de 1900 ; remonté, il tient dans la vitre.
    expect(decalages(S1).gares).toBe(-E)
    expect(decalages(U0)).toEqual(decalages(S1))
    const depart = departALEcran(v)
    expect(depart.x + depart.w / 2).toBeCloseTo(195, 9)
    expect(depart.y + depart.h / 2 + vitre.dy).toBeGreaterThan(vitre.y)
    expect(depart.y + depart.h + vitre.dy).toBeLessThanOrEqual(vitre.y + vitre.h)
    // Sans cette remontée, il serait sous la vitre : son haut plus bas que le milieu de la cloison.
    expect(depart.y).toBeGreaterThan(vitre.y + vitre.h / 2 - depart.h / 2)
    expect(milieuDeLaGare(v, 0)).toBeCloseTo(195 + E, 9)
    // Personne n'est en route avant d'être assis.
    for (let avance = U0; avance <= B1; avance += 3) if (trajet(avance) > 0) expect(assise(avance)).toBe(1)
  })

  // Mutations : la vitre qui rétrécit (`lerp(1, sx1, o)` retourné) ; la borne posée hors du trajet
  // (`milieuDeLaGare(v, -1.5)`) ; les toiles qui reculent pendant le trajet.
  it('le départ : le train ne recule jamais, la vitre grandit sans se refermer, la borne passe au milieu du trajet', () => {
    let avant = { gares: decalages(S1).gares, w: 0, h: 0, dy: -Infinity }
    for (let avance = S1; avance <= B1; avance += 2) {
      const vitre = vitreALEcran(ecran(avance))!
      const gares = decalages(avance).gares
      expect(gares).toBeGreaterThanOrEqual(avant.gares)
      expect(vitre.w).toBeGreaterThanOrEqual(avant.w - 1e-9)
      expect(vitre.h).toBeGreaterThanOrEqual(avant.h - 1e-9)
      expect(vitre.dy).toBeGreaterThanOrEqual(avant.dy)
      expect(vitre.x).toBeGreaterThanOrEqual(0)
      expect(vitre.x + vitre.w).toBeLessThanOrEqual(390 + 1e-9)
      expect(vitre.y + vitre.h).toBeLessThanOrEqual(700 + 1e-9)
      avant = { gares, w: vitre.w, h: vitre.h, dy: vitre.dy }
    }
    // La borne de frontière est au milieu de l'écran quand la moitié du trajet est faite.
    const mi = ARRETS[0]! - (B1 - (A1 + (B1 - A1) * 0.73))
    expect(trajet(mi)).toBeCloseTo(0.5, 9)
    expect(borneALEcran(ecran(mi)).x).toBeCloseTo(195, 6)
    expect(montee(mi)).toBeCloseTo(0.73, 9)
  })

  // Mutations : la vitre encore dans son cadre en gare (`o >= 0.999` retiré) ; un reste de vapeur ou
  // de compartiment à l'arrêt ; `decalages` qui n'arrive pas à zéro en gare.
  it('la première gare : la vitre a rempli l’écran, il ne reste rien du passage, la gare de 1900 est au milieu', () => {
    const v = ecran(B1)
    expect(vitreALEcran(v)).toEqual({ x: 0, y: 0, w: 390, h: 700, rayon: 0, alpha: 1, dy: 0, cadre: null })
    expect(ouverture(B1)).toBe(1)
    expect(vitreOuverte(B1)).toBe(true)
    expect(quaiALEcran(v)).toBeNull()
    expect(jonctionALEcran(v)).toBeNull()
    expect(interieurALEcran(B1)).toBeNull()
    expect(bouffee(B1)).toBe(0)
    expect(decalages(B1).gares).toBe(0)
    expect(milieuDeLaGare(v, 0)).toBeCloseTo(195, 9)
    // Au-delà, le passage ne laisse rien : à chaque arrêt, l'image est celle du train seul.
    for (const arret of ARRETS) {
      expect(vitreOuverte(arret)).toBe(true)
      expect(interieurALEcran(arret)).toBeNull()
      expect(bouffee(arret)).toBe(0)
    }
  })
})

describe('ce qui se touche pendant le passage', () => {
  // Mutations : la garde `vitreOuverte` retirée de `dansLaFenetre` ; le seuil de `vitreOuverte` abaissé.
  it('rien : ni année, ni dépêche, ni bobine, ni voiture tant que la vitre n’a pas rempli l’écran', () => {
    const touche = (avance: number) => {
      const bobine = vi.fn()
      const f = vueA(avance, { bobine })
      image(f.vue)
      return { zones: [...new Set(f.zones.map((z) => z.id))].sort(), bobines: bobine.mock.calls.length, annee: ecranDeLaCase(f.vue, 1900) !== null }
    }
    // Soixante pixels avant la gare : la gare de 1900 est déjà à l'écran derrière la vitre, sa
    // dépêche, sa bobine et la voiture garée aussi. Rien ne s'inscrit.
    const presque = B1 - 60
    expect(vitreOuverte(presque)).toBe(false)
    expect(milieuDeLaGare(ecran(presque), 0)).toBeLessThan(390)
    expect(touche(presque)).toEqual({ zones: [], bobines: 0, annee: false })
    for (const avance of MOMENTS.filter((a) => a <= 650)) expect(touche(avance)).toEqual({ zones: [], bobines: 0, annee: false })
    for (let avance = U0; avance < B1 - 50; avance += 7) expect(dansLaFenetre(ecran(avance), 350)).toBe(false)
    // Dès que quelque chose se touche, les toiles sont à leur place : ni remontées, ni découpées.
    for (let avance = U0; avance <= B1; avance += 1) {
      if (!dansLaFenetre(ecran(avance), 350)) continue
      expect(vitreALEcran(ecran(avance))).toMatchObject({ dy: 0, cadre: null, x: 0, y: 0, w: 390, h: 700 })
    }
    // Le témoin : en gare, tout se touche.
    expect(touche(B1)).toEqual({ zones: ['date', 'roulotte'], bobines: 1, annee: true })
  })
})
