import { describe, expect, it } from 'vitest'
import { creerMonde1900 } from '.'
import type { CaseVue, VueMonde } from '../types'
import { vueFactice } from '../../test/vueFactice'
import { TUNNEL } from './donnees'
import { LIEU } from './gares'
import { forceDuTemps } from './meteo'
import { ANNEES, ARRETS, B1, E, PAS, S1, U0 } from './trace'
import { bornesDuTunnel, K_BOUCHE, K_PAROI, L_BOUCHE, L_PAROI, sousLaVoute, tunnelALEcran, type TunnelALEcran } from './tunnel'

/**
 * Le tunnel (lot 2 bis, idée 71 sans le ralenti). Ces tests ne portent que sur les règles
 * (`tunnel.ts`) : aucun ne fige les appels de canvas du trait (`voute.ts`).
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
    ANNEES.map((annee, i) => ({ annee, etat: i < n - 1 ? 'passee' : i === n - 1 ? 'encours' : 'verrou', profondeur: 0, x: 195, y: 0, pop: -9 }))
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
})
