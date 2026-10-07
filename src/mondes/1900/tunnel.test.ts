import { describe, expect, it } from 'vitest'
import { creerMonde1900 } from '.'
import type { CaseVue, VueMonde } from '../types'
import { vueFactice } from '../../test/vueFactice'
import { trajetRalenti } from '../../carte/camera'
import { TUNNEL } from './donnees'
import { LIEU } from './gares'
import { rangSurLaLigne } from './habillage'
import { forceDuTemps } from './meteo'
import { ANNEES, ARRETS, B1, E, PAS, S1, U0 } from './trace'
import { bornesDuTunnel, K_BOUCHE, K_PAROI, L_BOUCHE, L_PAROI, ralentisDuTunnel, sousLaVoute, tunnelALEcran, type TunnelALEcran } from './tunnel'

/**
 * Le tunnel (lot 2 bis, idée 71 ; son ralenti, lot « moteur »). Ces tests ne portent que sur les
 * règles (`tunnel.ts`) : aucun ne fige les appels de canvas du trait (`voute.ts`).
 */

/** L'avance de la caméra pour un rang sur la ligne, en gares depuis 1900. */
const a = (rang: number): number => B1 + rang * PAS
const tunnel = (rang: number, W = 390, vivant = true): TunnelALEcran | null => tunnelALEcran({ W, avance: a(rang), vivant })
/** Les rangs d'une gare à l'autre, bornes comprises, par pas d'un deux-centième de gare. */
const rangs = (de: number, vers: number): number[] => Array.from({ length: Math.round((vers - de) * 200) + 1 }, (_, k) => de + k / 200)
/** La suite des temps traversés, chacun dit une fois ; « jour » quand il n'y a pas de tunnel. */
const temps = (liste: number[], W = 390): string[] =>
  liste.map((rang) => tunnel(rang, W)?.temps ?? 'jour').filter((t, k, tous) => t !== tous[k - 1])

describe('où est le tunnel', () => {
  // Mutations : `TUNNEL.de` à 1902 ; `milieu` à 0,3 ; `demi` à 0,3 ; `bornesDuTunnel` qui ignore la
  // table (3,33 et 3,67 en dur) ; `milieu` lu depuis `vers` (`lerp` retourné) ; `demi` ajouté des deux côtés.
  it('un seul, entre Longueville et Allaman, au milieu du chemin, écrit une fois dans la table', () => {
    expect([LIEU[TUNNEL.de], LIEU[TUNNEL.vers]]).toEqual(['Longueville', 'Allaman'])
    const bornes = bornesDuTunnel()
    expect(bornes.entree).toBeCloseTo(3.33, 9)
    expect(bornes.sortie).toBeCloseTo(3.67, 9)
    // Une autre table déplace tout : le dessin ne sait rien que la table ne dise.
    const ailleurs = { de: 1905, vers: 1906, milieu: 0.25, demi: 0.1 }
    expect(bornesDuTunnel(ailleurs).entree).toBeCloseTo(5.15, 9)
    expect(bornesDuTunnel(ailleurs).sortie).toBeCloseTo(5.35, 9)
    expect(tunnelALEcran({ W: 390, avance: a(5.25), vivant: true }, ailleurs)?.temps).toBe('paroi')
    expect(tunnelALEcran({ W: 390, avance: a(3.5), vivant: true }, ailleurs)).toBeNull()
  })
})

describe('les temps du tunnel', () => {
  // Mutations : `'paroi'` jamais rendu (`plein` faux) ; `'sortie'` et `'noir'` échangés ; le milieu qui
  // sépare le noir de la sortie déplacé à l'entrée ; les bouches qui viennent de la gauche (`pg - bornes`).
  it('dans le sens de la marche : la bouche, le noir, la paroi, la sortie ; au retour, l’envers', () => {
    const aller = rangs(3, 4)
    expect(temps(aller)).toEqual(['jour', 'bouche', 'noir', 'paroi', 'sortie', 'jour'])
    expect(temps([...aller].reverse())).toEqual(['jour', 'sortie', 'paroi', 'noir', 'bouche', 'jour'])
  })

  // Mutations : la garde `entree - L_BOUCHE >= v.W` retirée (une bouche annoncée hors de l'écran) ;
  // `PIED_DROIT` à -50 (du jour entre la bouche et le noir) ou à 500 (le noir avant la bouche).
  it('la bouche arrive par la droite, et le noir commence sous elle, jamais avant ni après', () => {
    for (const rang of rangs(3, 3.5)) {
      const t = tunnel(rang)
      if (!t) continue
      expect(t.entree - L_BOUCHE, String(rang)).toBeLessThan(390)
      if (t.temps === 'bouche') expect(t.noir, String(rang)).toBeNull()
      if (t.temps !== 'noir') continue
      expect(t.noir!.x, String(rang)).toBeGreaterThan(t.entree - L_BOUCHE)
      expect(t.noir!.x, String(rang)).toBeLessThan(t.entree)
    }
    // La première image où elle se voit : son bord touche le bord droit, à un deux-centième de gare près.
    const premier = rangs(3, 3.5).find((rang) => tunnel(rang) !== null)!
    expect(390 - (tunnel(premier)!.entree - L_BOUCHE)).toBeLessThan((E * K_BOUCHE) / 200 + 1e-6)
  })

  // Mutations : le noir collé à gauche à l'entrée (`x: 0`) ; `Math.min(v.W, …)` retiré (le noir
  // déborde de l'écran) ; `Math.max(0, …)` retiré ; le noir qui ne suit pas l'avance.
  it('le noir balaie la vitre de la droite vers la gauche, tient tout l’écran, puis s’en va par la gauche', () => {
    let avant: TunnelALEcran | null = null
    for (const rang of rangs(3, 4)) {
      const t = tunnel(rang)
      if (!t?.noir) continue
      expect(t.noir.x, String(rang)).toBeGreaterThanOrEqual(0)
      expect(t.noir.x + t.noir.w, String(rang)).toBeLessThanOrEqual(390)
      expect(t.noir.w, String(rang)).toBeGreaterThan(0)
      if (t.temps === 'noir') {
        expect(t.noir.x + t.noir.w, String(rang)).toBe(390)
        if (avant?.temps === 'noir') expect(t.noir.x).toBeLessThan(avant.noir!.x)
      }
      if (t.temps === 'paroi') expect(t.noir, String(rang)).toEqual({ x: 0, w: 390 })
      if (t.temps === 'sortie') {
        expect(t.noir.x, String(rang)).toBe(0)
        if (avant?.temps === 'sortie' && avant.noir) expect(t.noir.w).toBeLessThan(avant.noir.w)
      }
      avant = t
    }
    // Après le noir, l'autre bouche finit de passer : le jour est revenu, la sortie n'a pas quitté l'écran.
    const fin = rangs(3.5, 4).filter((rang) => tunnel(rang)?.temps === 'sortie' && !tunnel(rang)!.noir)
    expect(fin.length).toBeGreaterThan(0)
    for (const rang of fin) expect(tunnel(rang)!.sortie + L_BOUCHE).toBeGreaterThan(0)
  })

  // Mutations : `K_BOUCHE` à 1 (la bouche traînerait, et se verrait depuis la gare) ; `K_PAROI` à
  // `K_BOUCHE` ; la paroi figée (`paroi: 0`) ; le reste non refermé (`% L_PAROI` retiré) ; la paroi
  // qui défile à rebours.
  it('la bouche passe au premier plan, la paroi deux fois plus vite, sans jamais sortir de son motif', () => {
    const un = tunnel(3.5)!
    const deux = tunnel(3.51)!
    expect(un.entree - deux.entree).toBeCloseTo((E * K_BOUCHE) / 100, 6)
    expect(un.sortie - deux.sortie).toBeCloseTo((E * K_BOUCHE) / 100, 6)
    expect((deux.paroi - un.paroi + L_PAROI) % L_PAROI).toBeCloseTo((E * K_PAROI) / 100, 6)
    expect(K_PAROI).toBeGreaterThan(K_BOUCHE)
    // Plus vite que la toile des gares, qui fait `E` pixels par gare.
    expect(un.entree - deux.entree).toBeGreaterThan(E / 100)
    for (const rang of rangs(3, 4)) {
      const t = tunnel(rang)
      if (!t) continue
      expect(t.paroi, String(rang)).toBeGreaterThanOrEqual(0)
      expect(t.paroi, String(rang)).toBeLessThan(L_PAROI)
    }
  })

  // Mutations : une borne déplacée d'un seul côté (`sortie` calculée avec `demi / 2`) ; `PIED_DROIT`
  // appliqué d'un seul côté ; la présence qui ne s'efface qu'au départ de 1903.
  it('le retour est l’aller dans un miroir : à même distance du milieu, la même image retournée', () => {
    for (const W of [390, 1280]) {
      for (const d of [0.02, 0.1, 0.15, 0.2, 0.3, 0.4, 0.47]) {
        const avant = tunnel(3.5 - d, W)
        const apres = tunnel(3.5 + d, W)
        expect(avant === null, `${W}, ${d}`).toBe(apres === null)
        if (!avant || !apres) continue
        expect(apres.entree).toBeCloseTo(W - avant.sortie, 6)
        expect(apres.sortie).toBeCloseTo(W - avant.entree, 6)
        expect(apres.presence).toBeCloseTo(avant.presence, 9)
        expect(apres.noir === null).toBe(avant.noir === null)
        if (avant.noir && apres.noir) {
          expect(apres.noir.x).toBeCloseTo(W - avant.noir.x - avant.noir.w, 6)
          expect(apres.noir.w).toBeCloseTo(avant.noir.w, 6)
        }
      }
    }
  })
})

describe('où il n’y a pas de tunnel', () => {
  const LARGEURS = [320, 390, 430, 768, 1280, 2560]

  // Mutations : la présence retirée (`presence = 1`) : sur un écran de 1280, la bouche se verrait depuis
  // la gare de Longueville ; `ABORD` à 0,5 (le tunnel pâle sur un téléphone) ; la garde `presence <= 0` retirée.
  it('rien en gare ni hors du chemin de 1903 à 1904, sur tout écran ; entier sur un téléphone', () => {
    for (const W of LARGEURS) {
      for (const arret of ARRETS) expect(tunnelALEcran({ W, avance: arret, vivant: true }), `${W}, ${arret}`).toBeNull()
      for (const rang of [...rangs(0, 3), ...rangs(4, 9)]) expect(tunnel(rang, W), `${W}, ${rang}`).toBeNull()
      // Le témoin : au milieu du chemin, il est là.
      expect(tunnel(3.5, W), String(W)).not.toBeNull()
    }
    // Sur un téléphone, du premier bord de la bouche au dernier, il ne pâlit jamais.
    for (const W of [320, 390, 430]) {
      const vus = rangs(3, 4).map((rang) => tunnel(rang, W)).filter((t) => t !== null)
      expect(Math.min(...vus.map((t) => t.presence)), String(W)).toBeGreaterThan(0.97)
    }
    // Sur un écran large, il paraît au départ au lieu de se montrer en gare.
    const pale = tunnel(3.02, 1280)!
    expect(pale.presence).toBeGreaterThan(0)
    expect(pale.presence).toBeLessThan(0.5)
  })

  // Mutations : la présence retirée (`presence = 1`) ; la garde `presence <= 0` retirée. La table du
  // monde ne met pas le passage en jeu : une table où le tunnel suit la gare de 1900 le met à l'épreuve.
  it('pendant le passage de la foire au train, aucun tunnel, quelle que soit la table et l’écran', () => {
    const table = { de: 1900, vers: 1901, milieu: 0.2, demi: 0.17 }
    for (const W of LARGEURS) {
      for (const avance of [-600, U0, 0, S1, B1 - 200, B1 - 1, B1]) {
        expect(tunnelALEcran({ W, avance, vivant: true }, table), `${W}, ${avance}`).toBeNull()
        expect(tunnelALEcran({ W, avance, vivant: true }), `${W}, ${avance}`).toBeNull()
      }
    }
    // Le témoin : la même table donne son tunnel dès qu'on a quitté la gare de 1900.
    expect(tunnelALEcran({ W: 390, avance: a(0.2), vivant: true }, table)?.temps).toBe('paroi')
  })

  // Mutation : la garde `!v.vivant` retirée de `tunnelALEcran`.
  it('avec moins d’animations, pas de tunnel, d’un bout à l’autre', () => {
    for (const rang of rangs(3, 4)) expect(tunnel(rang, 390, false), String(rang)).toBeNull()
    expect(tunnel(3.5, 390, true)).not.toBeNull()
  })
})

describe('ce que le tunnel couvre', () => {
  // Mutations : `sousLaVoute` vrai dès qu'il y a un tunnel ; vrai pendant le noir qui balaie ; la
  // présence non lue (un noir pâle laisserait voir une vitre sans heure ni météo).
  it('seul le noir plein, sur tout l’écran, dispense de dessiner ce qui est dessous', () => {
    expect(sousLaVoute(null)).toBe(false)
    for (const rang of rangs(3, 4)) {
      const t = tunnel(rang)
      expect(sousLaVoute(t), String(rang)).toBe(t?.temps === 'paroi')
    }
    // Un tunnel collé à sa gare tient tout l'écran avant d'être plein : la vitre se voit encore au travers.
    const colle = tunnelALEcran({ W: 390, avance: a(3.045), vivant: true }, { de: 1903, vers: 1904, milieu: 0.5, demi: 0.49 })!
    expect(colle.temps).toBe('paroi')
    expect(colle.presence).toBeLessThan(1)
    expect(sousLaVoute(colle)).toBe(false)
  })

  // La neige d'Allaman commence dans le tunnel : elle est déjà là quand le jour revient.
  // Mutations : `TUNNEL.milieu` à 0,2 (le tunnel fini avant la neige) ; les seuils de `forceDuTemps`
  // resserrés (0,1 et 0,2 : pas de neige à la sortie).
  it('le jour revient sur la neige d’Allaman', () => {
    const sortie = rangs(3.5, 4).filter((rang) => tunnel(rang)?.temps === 'sortie')
    expect(sortie.length).toBeGreaterThan(0)
    for (const rang of sortie) expect(forceDuTemps(a(rang)).neige, String(rang)).toBeGreaterThan(0)
    // Et le noir tient déjà tout l'écran quand elle commence : elle ne paraît pas avant le tunnel.
    const premiere = rangs(3, 4).find((rang) => forceDuTemps(a(rang)).neige > 0)!
    expect(tunnel(premiere)?.temps).toBe('paroi')
  })
})

describe('le tunnel dans l’image du monde', () => {
  /** Les dix années : les `n` premières quittées sauf la dernière, en cours ; le reste fermé. */
  const casesOuvertes = (n: number): CaseVue[] =>
    ANNEES.map((annee, i) => ({ annee, etat: i < n - 1 ? 'passee' : i === n - 1 ? 'encours' : 'verrou', attente: false, profondeur: 0, affiches: [], x: 195, y: 0, pop: -9 }))
  /** Ce que le monde pose par-dessus tout, lu comme une suite d'appels : comparé seulement à une autre image du même dessin. */
  const dessus = (rang: number, surcharge: Partial<VueMonde> & { t: number; vivant: boolean }): unknown => {
    const f = vueFactice({ avance: a(rang), cases: casesOuvertes(10), ouverte: { annee: 1909, t0: -9 }, ...surcharge })
    creerMonde1900().dessinerSurLaBrume(f.vue)
    return JSON.parse(JSON.stringify(f.appels))
  }

  // Mutations : `dessinerTunnel` retiré de `dessinerSurLaBrume` (le témoin tombe : la même image
  // vivante et au calme) ; la lueur des lampes qui respire avec l'horloge dans `voute.ts`. La paroi,
  // cuite, ne se dessine pas sous jsdom : la faire glisser d'après l'horloge n'est pas vu d'ici.
  it('il ne suit que l’avance : deux instants donnent la même image, que le calme n’a pas', () => {
    for (const rang of [3.2, 3.35, 3.4]) {
      expect(dessus(rang, { t: 1.4, vivant: true }), String(rang)).toEqual(dessus(rang, { t: 9, vivant: true }))
    }
    expect(dessus(3.35, { t: 1.4, vivant: true })).not.toEqual(dessus(3.35, { t: 1.4, vivant: false }))
    expect(dessus(3.35, { t: 1.4, vivant: true })).not.toEqual(dessus(3.36, { t: 1.4, vivant: true }))
  })

  // Allaman fermée : sa lanterne, à portée du milieu du tunnel, respire avec l'horloge.
  // Mutation : la garde `!sousLaVoute(tunnel)` retirée de `dessinerSurLaBrume` (la lampe respire sous le noir).
  it('sous le noir plein, rien de ce qui est dessous ne se dessine : la lampe d’une plaque fermée n’y respire plus', () => {
    const fermees = { cases: casesOuvertes(4), ouverte: { annee: 1903, t0: -9 } }
    expect(dessus(3.5, { t: 1.4, vivant: true, ...fermees })).toEqual(dessus(3.5, { t: 3.4, vivant: true, ...fermees }))
    // Le témoin : avant le noir plein, la lampe respire.
    expect(dessus(3.34, { t: 1.4, vivant: true, ...fermees })).not.toEqual(dessus(3.34, { t: 3.4, vivant: true, ...fermees }))
  })

  // Le test d'avant ne dit pas que le tunnel, lui, se dessine sous son noir plein : sans lui, il
  // comparerait deux images vides. Au milieu du tunnel (rang 3,5), la photographie du compartiment
  // n'a qu'un lecteur, le reflet sur la vitre : la même image avec et sans elle n'est pas la même.
  // L'image au calme ne ferait pas ce témoin : sans tunnel, elle porte l'heure, et diffère de toute façon.
  // Mutation : `if (tunnel && !sousLaVoute(tunnel)) dessinerTunnel(…)` dans `dessinerSurLaBrume`.
  it('sous son noir plein, le tunnel se dessine : le reflet du compartiment y paraît dès que sa photographie est là', () => {
    const photo = { width: 1200, height: 800 } as unknown as CanvasImageSource
    const sans = dessus(3.5, { t: 1.4, vivant: true })
    const avec = dessus(3.5, { t: 1.4, vivant: true, image: () => photo })
    expect(avec).not.toEqual(sans)
    // Le témoin : au calme, sans tunnel, personne ne demande cette photographie à cet endroit.
    expect(dessus(3.5, { t: 1.4, vivant: false, image: () => photo })).toEqual(dessus(3.5, { t: 1.4, vivant: false }))
  })
})

describe('le ralenti du tunnel (lot « moteur »)', () => {
  const scene = creerMonde1900().scene!
  /** Ce que le meneur lit pour rouler (`MoteurCarte.ralentis`), le haut de la section pris pour zéro : un coût ne dépend pas de l'origine. */
  const surLaCarte = (ralentis = scene.ralentis) => ralentis.map((r) => ({ haut: r.de, bas: r.a, allure: r.allure }))
  const arret = (annee: number): number => scene.arrets[annee - 1900]!
  const LONGUEUR = 2 * TUNNEL.demi * PAS
  /** Ce par quoi la durée d'un roulement de `longueur` pixels se multiplie quand il traverse tout le tunnel. */
  const allonge = (longueur: number): number => (longueur - LONGUEUR + LONGUEUR / TUNNEL.allure) / longueur

  // Le ralenti se tire de la table du dessin, pas d'un second jeu de nombres : là où il commence, le
  // bout de la bouche d'entrée est au milieu de l'écran ; là où il finit, celui de la bouche de sortie.
  // Mutations : une gare de décalage (`entree + 1`) ; `E` pour `PAS` (l'unité de la toile, pas celle
  // du geste) ; `B1` oublié (un rang compté depuis le haut de la section) ; `demi` doublée ; les
  // bornes en dur (3071 et 3309) ; `table.allure` remplacée par 0,36 en dur.
  it('un seul palier, d’une bouche à l’autre, en `y` de la section, à l’allure de la table', () => {
    const [r, ...autres] = ralentisDuTunnel()
    expect(autres).toEqual([])
    const bornes = bornesDuTunnel()
    expect(rangSurLaLigne(r!.de)).toBeCloseTo(bornes.entree, 9)
    expect(rangSurLaLigne(r!.a)).toBeCloseTo(bornes.sortie, 9)
    for (const W of [320, 390, 1280]) {
      expect(tunnelALEcran({ W, avance: r!.de, vivant: true })!.entree).toBeCloseTo(W / 2, 6)
      expect(tunnelALEcran({ W, avance: r!.a, vivant: true })!.sortie).toBeCloseTo(W / 2, 6)
    }
    expect(r!.allure).toBe(TUNNEL.allure)
    // Une autre table déplace le ralenti avec le tunnel, et change son allure.
    const ailleurs = { de: 1905, vers: 1906, milieu: 0.25, demi: 0.1, allure: 0.5 }
    const [d] = ralentisDuTunnel(ailleurs)
    expect(rangSurLaLigne(d!.de)).toBeCloseTo(5.15, 9)
    expect(rangSurLaLigne(d!.a)).toBeCloseTo(5.35, 9)
    expect(d!.allure).toBe(0.5)
  })

  // Le contrat de `SceneCollante.ralentis`, que le moteur ne garde pas : il ignore en silence une
  // allure hors de `]0, 1[`, additionne les coûts de deux intervalles qui se chevauchent, et ferait
  // rouler au pas le rappel à un arrêt pris dans un intervalle.
  // Mutations : `ralentis: []` remis dans `creerMonde1900` ; `TUNNEL.allure` à 1, à 0, à 1,2 ;
  // `TUNNEL.demi` à 0,5 (le palier touche les deux arrêts) ; `TUNNEL.milieu` à 0,17 (il touche celui
  // de 1903) ; `de` et `a` échangés ; un second palier qui chevauche le premier ; `TUNNEL.de` à 1902.
  it('le monde le déclare : une allure qui ralentit, des intervalles croissants et disjoints, strictement entre l’arrêt de 1903 et celui de 1904', () => {
    expect(scene.ralentis).toEqual(ralentisDuTunnel())
    expect(scene.ralentis.length).toBeGreaterThan(0)
    scene.ralentis.forEach((r, i) => {
      expect(r.allure).toBeGreaterThan(0)
      expect(r.allure).toBeLessThan(1)
      expect(r.de).toBeLessThan(r.a)
      expect(r.de).toBeGreaterThan(i ? scene.ralentis[i - 1]!.a : arret(1903))
      expect(r.a).toBeLessThan(arret(1904))
      // Aucun arrêt dans un intervalle, bords compris ; rien avant le premier arrêt.
      for (const y of scene.arrets) expect(y < r.de || y > r.a, String(y)).toBe(true)
      expect(r.de).toBeGreaterThanOrEqual(scene.arrets[0]!)
    })
  })

  // Ce que le roulement en fait, par le calcul même du meneur (`trajetRalenti`, `src/carte/camera.ts`),
  // sur les arrêts et les ralentis du monde réel : nul, le roulement garde sa durée de base.
  // Mutations : `TUNNEL.de` à 1902 (l'avancée de 1902 à 1903 ralentirait) ; `E` pour `PAS` (le palier
  // tomberait entre 1904 et 1905) ; `TUNNEL.allure` à 0,2 (plus du double de la durée) ; `ralentis: []`.
  // `TUNNEL.allure` à 0,5 ou à 0,3 survit, exprès : c'est un réglage, la table seule le dit.
  it('seule l’avancée de 1903 à 1904 dure plus longtemps, à l’aller comme au retour ; ni les autres, ni le passage', () => {
    for (const annee of ANNEES.slice(0, -1)) {
      const lent = trajetRalenti(arret(annee), arret(annee + 1), surLaCarte())
      const retour = trajetRalenti(arret(annee + 1), arret(annee), surLaCarte())
      if (annee !== 1903) {
        expect([lent, retour], String(annee)).toEqual([null, null])
        continue
      }
      expect(lent!.allonge).toBeCloseTo(allonge(PAS), 9)
      expect(retour!.allonge).toBeCloseTo(allonge(PAS), 9)
      // Une fois et six dixièmes à l'allure de 0,36. L'allure se règle à l'essai, dans la table seule ;
      // mais la carte est inerte tout ce temps : jamais le double de la durée de base.
      expect(lent!.allonge).toBeGreaterThan(1)
      expect(lent!.allonge).toBeLessThan(2)
    }
    // Le passage de la foire au train et son rappel au premier arrêt ne croisent aucun ralenti.
    expect(trajetRalenti(U0, arret(1900), surLaCarte())).toBeNull()
    expect(trajetRalenti(S1, arret(1900), surLaCarte())).toBeNull()
    // Un rattrapage qui traverse le tunnel n'en paie que la longueur.
    expect(trajetRalenti(arret(1902), arret(1905), surLaCarte())!.allonge).toBeCloseTo(allonge(3 * PAS), 9)
  })

  // À même part de sa courbe, le train va dans le tunnel à l'allure de la table de ce qu'il va
  // dehors, et il y est bien de la bouche d'entrée à celle de sortie.
  // Mutations : `TUNNEL.allure` à 0,5 dans la seule règle (`allure: 0.5` en dur) ; une gare de
  // décalage ; `demi` doublée dans la seule règle (le pas resterait lent hors des bouches).
  it('de 1903 à 1904, le train roule entre les bouches à l’allure de la table, et hors d’elles comme partout', () => {
    const lent = trajetRalenti(arret(1903), arret(1904), surLaCarte())!
    const N = 2000
    const libre = (allonge(PAS) * PAS) / N
    const vus = { avant: 0, dedans: 0, apres: 0 }
    for (let k = 0; k < N; k++) {
      const [y0, y1] = [lent.y(k / N), lent.y((k + 1) / N)]
      const [r0, r1] = [rangSurLaLigne(y0), rangSurLaLigne(y1)]
      const { entree, sortie } = bornesDuTunnel()
      if (r1 <= entree || r0 >= sortie) {
        expect(y1 - y0).toBeCloseTo(libre, 6)
        vus[r1 <= entree ? 'avant' : 'apres']++
      } else if (r0 >= entree && r1 <= sortie) {
        expect(y1 - y0).toBeCloseTo(libre * TUNNEL.allure, 6)
        vus.dedans++
      }
    }
    expect(lent.y(0)).toBe(arret(1903))
    expect(lent.y(1)).toBeCloseTo(arret(1904), 9)
    // Les trois parts du trajet, à leur longueur : le pas du tunnel n'est pas celui de tout le chemin.
    expect(vus.avant / N).toBeCloseTo((0.5 - TUNNEL.demi) / allonge(PAS), 2)
    expect(vus.dedans / N).toBeCloseTo(LONGUEUR / TUNNEL.allure / (allonge(PAS) * PAS), 2)
    expect(vus.apres / N).toBeCloseTo((0.5 - TUNNEL.demi) / allonge(PAS), 2)
  })
})
