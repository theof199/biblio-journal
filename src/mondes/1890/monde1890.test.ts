import { describe, expect, it, vi } from 'vitest'
import { creerMonde1890 } from '.'
import { ampoules, PALIERS, quantites, remplissage } from './foire'
import { chantier, ELEMENTS } from './chantier'
import { DATES } from './dates'
import { vueFactice } from '../../test/vueFactice'
import { SCINTILLEMENT_MAX } from '../../carte/traitement'
import type { CaseVue, VueMonde } from '../types'
import { c } from './couleur'
import type { Appel } from '../../test/contexteFactice'

const cases = (etats: CaseVue['etat'][], profondeur = 0): CaseVue[] =>
  etats.map((etat, i) => ({ annee: 1895 + i, etat, attente: false, profondeur, affiches: [], x: 100, y: 100, pop: -9 }))
const textes = (appels: { nom: string; args: unknown[] }[]) => appels.filter((a) => a.nom === 'fillText').map((a) => a.args[0])

describe('le monde des années 1890', () => {
  // Mutation : `couleur` rendue telle quelle ; un virage remis par-dessus la rampe ; une colonne Morris.
  it('porte la manivelle et le sépia de la maquette, sans colonne ni second virage', () => {
    const m = creerMonde1890()
    expect(m.traitement.cadence).toBe(16)
    expect(m.traitement.tremblement).toBeGreaterThan(0)
    expect(m.traitement.scintillement).toBeGreaterThan(0)
    expect(m.traitement.scintillement).toBeLessThanOrEqual(SCINTILLEMENT_MAX)
    expect(m.traitement.affiches).toBe('sepia')
    expect(m.traitement.virage).toBeNull()
    expect(m.couleur('#3E5360')).toBe('rgb(78,67,56)')
    expect(m.palette.colonne).toBeNull()
  })

  /** La section 1890 : `quittees` années bouclées, puis l'année en cours et ses `films`, le reste verrouillé. */
  const foire = (quittees: number, films: number, horsEnCours = 0): CaseVue[] =>
    [1895, 1896, 1897, 1898, 1899].map((annee, i) => {
      const bouclee: readonly CaseVue['etat'][] = ['passee', 'ours', 'lion', 'palme']
      const etat: CaseVue['etat'] = i < quittees ? bouclee[i % 4]! : i === quittees ? 'encours' : 'verrou'
      return { annee, etat, attente: false, profondeur: i === quittees ? films : horsEnCours, affiches: [], x: 100, y: 100, pop: -9 }
    })

  // Mutation : `if (bouclee) return 1` retiré ; ou la foire pleine dès les cinq années bouclées, sans le tampon.
  it('n’est pleine qu’avec le tampon de la décennie', () => {
    expect(remplissage(foire(5, 0), false)).toBeLessThan(1)
    expect(remplissage(foire(5, 0), true)).toBe(1)
    expect(remplissage(foire(0, 0), true)).toBe(1)
  })

  // Mutation : un palier par case hors `verrou` (l'année en cours comptée) ; ou par récompense seulement (`passee` oubliée).
  it('monte d’un palier par année bouclée', () => {
    expect(remplissage(foire(0, 0), false)).toBe(0)
    expect(remplissage(foire(1, 0), false)).toBe(1 / PALIERS)
    expect(remplissage(foire(4, 0), false)).toBe(4 / PALIERS)
    expect(remplissage(foire(5, 0), false)).toBe(5 / PALIERS)
  })

  // Mutations : la montée plafonnée (`Math.min(1, films / 4)`) atteint le palier suivant ; la montée
  // retirée ne bouge plus d'un film à l'autre.
  it('monte à chaque film de l’année en cours, sans jamais atteindre le palier suivant', () => {
    let avant = remplissage(foire(2, 0), false)
    for (const films of [1, 2, 3, 4, 10, 100, 100000]) {
      const r = remplissage(foire(2, films), false)
      expect(r, `${films} films`).toBeGreaterThan(avant)
      expect(r, `${films} films`).toBeLessThan(3 / PALIERS)
      avant = r
    }
  })

  // Mutation : additionner les `profondeur` de toutes les cases : les films vus en avance (années
  // verrouillées) et ceux des années bouclées pousseraient la foire au-delà de son palier.
  it('ne compte que les films de l’année en cours', () => {
    expect(remplissage(foire(2, 0, 50), false)).toBe(2 / PALIERS)
    expect(remplissage(foire(5, 0, 50), false)).toBe(5 / PALIERS)
  })

  // Mutation : les seuils des guirlandes (0,35 et 0,7) échangés ou retirés.
  it('ajoute spectateurs, fanions et lampions à mesure qu’elle se remplit', () => {
    expect(quantites(0)).toEqual({ fanions: 4, file: 2, fouleManege: 0, fouleLanterne: 0, lampions: [2, 0, 0] })
    expect(quantites(0.5).lampions).toEqual([6, 4, 0])
    expect(quantites(1)).toEqual({ fanions: 10, file: 11, fouleManege: 7, fouleLanterne: 5, lampions: [10, 7, 6] })
  })

  // Mutation : `i < quittees` sans `bouclee`.
  it('allume une ampoule par année quittée, toutes quand le passeport porte la décennie', () => {
    expect(ampoules(3, false)).toEqual([true, true, true, false, false])
    expect(ampoules(0, false)).toEqual([false, false, false, false, false])
    expect(ampoules(2, true)).toEqual([true, true, true, true, true])
  })

  // Mutation : semer les dates sans regarder l'état des cases.
  it('ne sème les dates vraies que sur les années ouvertes', () => {
    const monde = creerMonde1890()
    const lues = (etats: CaseVue['etat'][]) => {
      const { vue, zones } = vueFactice({ cases: cases(etats) })
      monde.dessinerSol(vue, { x: 195, y: 820 })
      return zones.filter((z) => z.id === 'date').map((z) => z.data)
    }
    expect(lues(['encours', 'verrou', 'verrou', 'verrou', 'verrou'])).toEqual([0, 1, 2])
    expect(lues(['lion', 'passee', 'encours', 'verrou', 'verrou'])).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  // Mutation : une apostrophe droite, un champ vide, une date hors de la section.
  it('donne à chaque date sa petite affiche complète, en français typographique', () => {
    expect(DATES.length).toBeGreaterThan(0)
    for (const d of DATES) {
      expect(d.an).toBeGreaterThanOrEqual(1895)
      expect(d.an).toBeLessThanOrEqual(1899)
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThanOrEqual(390)
      for (const texte of [d.court, d.lieu, d.titre, d.jour, d.texte]) {
        expect(texte.trim()).not.toBe('')
        expect(texte).not.toContain("'")
      }
    }
  })

  // Mutation : le feu d'artifice dès que les cinq cases sont bouclées (`v.cases.every(…)`), sans le tampon.
  it('ne tire le feu d’artifice qu’à la décennie bouclée, jamais pendant l’adieu', () => {
    const monde = creerMonde1890()
    const fete = (bouclee: boolean, adieu = -1) => {
      const { vue, appels } = vueFactice({ cases: cases(['lion', 'lion', 'lion', 'lion', 'lion']), bouclee, adieu })
      monde.dessinerProche(vue)
      return textes(appels).includes('Fête complète · 1899 bouclée')
    }
    expect(fete(false)).toBe(false)
    expect(fete(true)).toBe(true)
    expect(fete(true, 1)).toBe(false)
  })

  // Mutation : dessiner la roulotte qui traverse sans regarder `v.roulotte`.
  it('fait traverser la foire à la roulotte de qui mène son Voyage, et à elle seule', () => {
    const monde = creerMonde1890()
    const enseigne = (roulotte: string | null) => {
      const { vue, appels } = vueFactice({ roulotte })
      monde.dessinerSol(vue, { x: 195, y: 820 })
      return textes(appels).filter((t) => String(t).endsWith('ET CIE'))
    }
    expect(enseigne('Théo')).toEqual(['THÉO ET CIE'])
    expect(enseigne(null)).toEqual([])
  })

  // Mutation : dessiner l'affiche de 1900 sans regarder `v.adieu`.
  it('ne pose l’affiche de 1900 que pendant l’adieu', () => {
    const monde = creerMonde1890()
    const hors = vueFactice({ adieu: -1 })
    monde.dessinerAdieu(hors.vue)
    expect(hors.appels).toEqual([])
    const pendant = vueFactice({ adieu: 99 })
    monde.dessinerAdieu(pendant.vue)
    expect(textes(pendant.appels)).toContain('LA FÉERIE')
  })

  // Mutation : une zone inscrite sans réaction. Toute réaction passe par `marquer` : l'état du
  // décor se déduit de `age(cle)`, jamais d'une variable cachée.
  it('tout décor touchable réagit', () => {
    const monde = creerMonde1890()
    const { vue, zones } = vueFactice({ cases: cases(['lion', 'lion', 'lion', 'encours', 'verrou']) })
    monde.dessinerCiel(vue)
    monde.dessinerLointain(vue)
    monde.dessinerMoyen(vue)
    monde.dessinerSol(vue, { x: 195, y: 820 })
    monde.dessinerProche(vue)
    expect(zones.length).toBeGreaterThan(0)
    for (const z of zones) {
      const temoin = vueFactice()
      monde.reagir(z.id, z.data ?? null, temoin.vue, { x: 100, y: 100 })
      expect(temoin.vue.marquer, `la zone ${z.id} ne réagit pas`).toHaveBeenCalled()
    }
  })
})

/**
 * Idée 8 : la foire se bâtit (29 septembre 2026). Ceux qui ne lisent que `chantier` ont tourné le
 * 29 au soir, leurs mutations vues tomber ; ceux qui lisent le dessin porté, non.
 */
describe('la foire qui se bâtit', () => {
  const ANNEES = [1895, 1896, 1897, 1898, 1899]
  const etats = (ouverte: VueMonde['ouverte'], t: number, vivant = true) => ANNEES.map((a) => chantier(a, ouverte, t, vivant).etat)
  const FIN_1899 = { etat: 'chantier', k: 1 }

  // Mutation : `annee > ouverte.annee` retiré de `chantier` (toute la foire dès 1895).
  it('ne montre rien d’une année pas encore ouverte', () => {
    expect(etats({ annee: 1895, t0: -9 }, 3)).toEqual(['bati', 'absent', 'absent', 'absent', 'absent'])
    expect(etats({ annee: 1897, t0: -9 }, 3)).toEqual(['bati', 'bati', 'bati', 'absent', 'absent'])
  })

  // Mutations : `k` tiré de `t` seul, sans `t0` ; la durée ignorée ; les années déjà ouvertes remises
  // en chantier (`annee < ouverte.annee` retiré).
  it('bâtit l’année ouverte en quatre à cinq secondes depuis l’arrivée de l’avatar, et elle seule', () => {
    for (const e of ELEMENTS) {
      expect(e.duree, String(e.annee)).toBeGreaterThanOrEqual(4)
      expect(e.duree, String(e.annee)).toBeLessThanOrEqual(5)
    }
    const ouverte = { annee: 1898, t0: 10 }
    expect(chantier(1898, ouverte, 10, true)).toEqual({ etat: 'chantier', k: 0 })
    expect(chantier(1898, ouverte, 12.5, true)).toEqual({ etat: 'chantier', k: 0.5 })
    expect(chantier(1898, ouverte, 15, true)).toEqual({ etat: 'bati' })
    expect(chantier(1897, ouverte, 10, true)).toEqual({ etat: 'bati' })
  })

  // Mutation : l'arrivée ramenée à l'origine de l'horloge (`Math.max(0, ouverte.t0)`) : une année
  // ouverte sans marche sous les yeux se bâtirait à chaque ouverture de la carte.
  it('pose bâtie une année ouverte sans marche sous les yeux', () => {
    expect(chantier(1898, { annee: 1898, t0: -9 }, 0, true)).toEqual({ etat: 'bati' })
    expect(etats({ annee: 1898, t0: -9 }, 0.5)).toEqual(['bati', 'bati', 'bati', 'bati', 'absent'])
  })

  // Mutation : `!vivant` retiré : l'horloge figée laisserait le chantier à mi-course.
  it('pose tout bâti quand le visiteur demande moins d’animations, même au milieu d’un chantier', () => {
    expect(etats({ annee: 1898, t0: 10 }, 12, false)).toEqual(['bati', 'bati', 'bati', 'bati', 'absent'])
    expect(chantier(1899, { annee: 1899, t0: 10 }, 12, false)).toEqual(FIN_1899)
  })

  // Mutation : `permanent` retiré de 1899 (ou la fin toujours `bati`).
  it('ne termine jamais le chantier de 1899', () => {
    expect(chantier(1899, { annee: 1899, t0: 0 }, 1e6, true)).toEqual(FIN_1899)
    expect(chantier(1899, { annee: 1899, t0: -9 }, 0, true)).toEqual(FIN_1899)
    expect(chantier(1899, { annee: 1905, t0: -9 }, 0, true)).toEqual(FIN_1899)
  })

  const moyen = (ouverte: VueMonde['ouverte']) => {
    const { vue, appels, zones } = vueFactice({ ouverte })
    creerMonde1890().dessinerMoyen(vue)
    return { textes: textes(appels), zones: zones.map((z) => z.id) }
  }

  // Mutations : `guichet()` et `prochainement()` sans condition (la maquette `2b7e8544…`) ; la zone
  // du manège inscrite sans regarder son chantier ; le dessin qui ignore `chantier(…)`.
  it('ne dessine ni ne rend touchable rien d’une année pas encore ouverte', () => {
    const a1896 = moyen({ annee: 1896, t0: -9 })
    expect(a1896.textes).not.toContain('ENTRÉE · 1 FR')
    expect(a1896.textes).not.toContain('PROCHAINEMENT')
    expect(a1896.zones).not.toContain('carrousel')
    expect(moyen({ annee: 1897, t0: -9 }).textes).toContain('ENTRÉE · 1 FR')
    const a1898 = moyen({ annee: 1898, t0: -9 })
    expect(a1898.zones).toContain('carrousel')
    expect(a1898.textes).not.toContain('PROCHAINEMENT')
    expect(moyen({ annee: 1899, t0: -9 }).textes).toContain('PROCHAINEMENT')
  })

  // Mutations : l'écriteau posé d'après l'année ouverte seule, à pleine opacité (ni l'état de son
  // chantier ni son `k` : retirer la seule condition d'état laisserait l'opacité à 0 pour une année
  // bâtie, et le `return` sous 0,01 le tairait encore — une mutation équivalente) ; l'écriteau
  // dessiné sous la brume (dans `dessinerProche`).
  it('montre l’écriteau du chantier par-dessus la brume, pendant la construction seulement', () => {
    const ecrit = (surcharge: Partial<VueMonde>) => {
      const { vue, appels } = vueFactice({ ouverte: { annee: 1897, t0: 0 }, t: 2, ...surcharge })
      creerMonde1890().dessinerSurLaBrume(vue)
      return textes(appels).includes('On pose le guichet')
    }
    expect(ecrit({})).toBe(true)
    expect(ecrit({ ouverte: { annee: 1897, t0: -9 } })).toBe(false)
    expect(ecrit({ vivant: false })).toBe(false)
  })

  // Mutations : le guichet redessiné sans regarder `v.brume` ; jamais redessiné ; redessiné avant 1897.
  it('fait percer la brume au guichet de 1897 quand elle le couvre', () => {
    const perce = (ouverte: VueMonde['ouverte'], brume: number) => {
      const { vue, appels } = vueFactice({ ouverte, brume })
      creerMonde1890().dessinerSurLaBrume(vue)
      return textes(appels).includes('ENTRÉE · 1 FR')
    }
    expect(perce({ annee: 1897, t0: -9 }, 515)).toBe(true)
    expect(perce({ annee: 1897, t0: -9 }, 700)).toBe(false)
    expect(perce({ annee: 1896, t0: -9 }, 380)).toBe(false)
  })

  // Mutations : les confettis de fin sans la garde `t0 ≥ 0` (ils partiraient à chaque ouverture de
  // la carte) ; sans la garde `age` (ils repartiraient à chaque image).
  it('ne lance les confettis de fin de chantier qu’une fois, au bout d’une construction vue', () => {
    const fin = (t0: number, deja = false) => {
      const { vue } = vueFactice({ ouverte: { annee: 1898, t0 }, t: 5.2, age: (cle) => (deja && cle === 'chantier:1898' ? 0.1 : 99) })
      creerMonde1890().dessinerSurLaBrume(vue)
      return vi.mocked(vue.confettis).mock.calls.length
    }
    expect(fin(0)).toBeGreaterThan(0)
    expect(fin(-9)).toBe(0)
    expect(fin(0, true)).toBe(0)
  })

  // Relecture du 29 au soir (n'a pas tourné). Mutations : `siteDuChantier: () => null` (la caméra
  // n'irait jamais chercher un chantier) ; `site[0]` au lieu de `site[1]` (un `x` pris pour un `y`).
  it('dit au moteur où se bâtit chaque année, pour que la caméra aille l’y chercher', () => {
    const m = creerMonde1890()
    // Le manège de 1898 se monte en 300, bien au-dessus de sa case (560) : sur un petit écran, hors de vue.
    expect(m.siteDuChantier(1898)).toBe(300)
    expect(m.siteDuChantier(1897)).toBe(530)
    expect(m.siteDuChantier(1900)).toBeNull()
  })
})

/**
 * La relecture de la tâche 7 (29 septembre 2026) : ce que le décor porté faisait autrement que la
 * maquette, et les jumeaux que les tests du plan ne gardaient pas.
 */
describe('le décor porté, tel que la maquette le montre', () => {
  const monde = creerMonde1890()
  /** Les lueurs des lampions : un disque en `lighter` d'une couleur pleine (les halos sont des dégradés). */
  const lueurs = (appels: Appel[], y?: number) =>
    appels.filter((a) => a.nom === 'arc' && a.composite === 'lighter' && typeof a.fillStyle === 'string' && (y === undefined || a.args[1] === y)).length
  const moyen = (surcharge: Partial<VueMonde>) => {
    const { vue, appels } = vueFactice(surcharge)
    monde.dessinerMoyen(vue)
    return appels
  }

  // Mutations : `const k96 = 1` (la baraque dès 1895, la séance jamais) ; `if (k96 < 1)` retiré devant la séance.
  it('tend le drap de la séance en 1895 et ne monte la baraque qu’en 1896', () => {
    const drap = (appels: Appel[]) => appels.some((a) => a.nom === 'fillRect' && JSON.stringify(a.args) === '[262,147,76,52]')
    const a1895 = moyen({ ouverte: { annee: 1895, t0: -9 } })
    expect(textes(a1895)).not.toContain('CINÉMATOGRAPHE')
    expect(drap(a1895)).toBe(true)
    const a1896 = moyen({ ouverte: { annee: 1896, t0: -9 } })
    expect(textes(a1896)).toContain('CINÉMATOGRAPHE')
    expect(drap(a1896)).toBe(false)
  })

  // Mutation : l'emballement lu sans regarder le chantier de 1898 (le `D.carrV = 0` de la maquette oublié).
  it('ne fait s’emballer le manège qu’une fois monté : un toucher d’avant est perdu', () => {
    const manege = (age: number) =>
      JSON.stringify(moyen({ ouverte: { annee: 1898, t0: 0 }, t: 10, age: (cle) => (cle === 'carrousel' ? age : 99) }).map((a) => [a.nom, a.args]))
    const jamais = manege(99)
    expect(manege(7), 'touché en 3 s, le manège à 0,6').toBe(jamais)
    expect(manege(2), 'touché en 8 s, le manège monté').not.toBe(jamais)
  })

  // Mutations : `extinction(v)` retiré de `lampion` (la baraque, ses ampoules et le manège restent
  // allumés, seules les guirlandes s'éteignent) ; retiré de `lanterneMagique`.
  it('éteint toutes les lumières de la foire pendant l’adieu, baraque, manège et lanterne compris', () => {
    const avant = moyen({ nuit: 1, adieu: -1 })
    expect(lueurs(avant)).toBeGreaterThan(0)
    const pendant = moyen({ nuit: 1, adieu: 1.7 })
    expect(lueurs(pendant)).toBe(0)
    const lampe = (appels: Appel[]) => appels.find((a) => a.nom === 'arc' && a.args[0] === 334 && a.args[1] === 468)?.fillStyle
    expect(lampe(avant)).not.toBe(c('#FADEA0', 0))
    expect(lampe(pendant)).toBe(c('#FADEA0', 0))
  })

  // Mutation : le plancher de nuit des ampoules retiré (`nuitMin` ignoré) : en plein jour, une année
  // quittée ne se verrait plus au fronton.
  it('fait briller une ampoule par année quittée, même en plein jour', () => {
    expect(lueurs(moyen({ nuit: 0, bati: { n: 3, nouvelle: null, t0: -9 } }), 142)).toBe(3)
    expect(lueurs(moyen({ nuit: 0, bati: { n: 1, nouvelle: null, t0: -9 } }), 142)).toBe(1)
  })

  // Mutations : le toit qui se pose avec ses lampions allumés (`lampes: 1`) ; les ampoules du
  // chantier sans attendre 0,8.
  it('n’allume la baraque en chantier qu’à la fin de sa construction', () => {
    const baraque = (k: number) => moyen({ nuit: 1, ouverte: { annee: 1896, t0: 0 }, t: k * 4.6 })
    expect(lueurs(baraque(0.6))).toBe(0)
    expect(lueurs(baraque(0.95))).toBeGreaterThan(0)
  })

  // Mutation : `Math.max(0, …)` retiré de l'âge d'une affichette : l'horloge du décor retarde sur
  // celle qui date le `pop`, et l'affichette neuve se montrerait en entier une image avant de se coller.
  it('ne montre une affichette neuve qu’en la collant, même quand l’horloge du décor retarde', () => {
    const affichette = (pop: number) => {
      const { vue, appels } = vueFactice({ t: 3.2, cases: [{ annee: 1895, etat: 'encours', attente: false, profondeur: 0, affiches: [], x: 100, y: 100, pop }] })
      monde.dessinerSol(vue, { x: 195, y: 820 })
      return textes(appels).includes('22 mars')
    }
    expect(affichette(3.24)).toBe(false)
    expect(affichette(3.2)).toBe(false)
    expect(affichette(2.9)).toBe(true)
    expect(affichette(-9)).toBe(true)
  })

  // Mutations : la fenêtre de 0,65 à 2,05 s retirée (le billet resterait posé sur son ampoule) ; le
  // billet dessiné en « moins d'animations » (l'horloge figée le laisserait en l'air).
  it('fait voler le billet de la case quittée vers son ampoule, le temps du vol seulement', () => {
    const billet = (bati: VueMonde['bati'], vivant = true) => {
      const { vue, appels } = vueFactice({ cases: cases(['passee', 'encours', 'verrou', 'verrou', 'verrou']), bati, vivant })
      monde.dessinerProche(vue)
      return textes(appels).includes('1895')
    }
    expect(billet({ n: 1, nouvelle: 0, t0: 3.2 - 1 })).toBe(true)
    expect(billet({ n: 1, nouvelle: 0, t0: 3.2 - 0.3 })).toBe(false)
    expect(billet({ n: 1, nouvelle: 0, t0: 3.2 - 2.5 })).toBe(false)
    expect(billet({ n: 1, nouvelle: 0, t0: 3.2 - 1 }, false)).toBe(false)
    expect(billet({ n: 1, nouvelle: null, t0: 3.2 - 1 })).toBe(false)
  })

  // Mutations : `v.W` à la place de la largeur de la section (390) pour borner l'écriteau, et pour
  // semer la poussière du sol : sur un écran étroit, tout se tasserait à gauche.
  it('pose le décor sur toute la largeur de la section, quelle que soit celle de l’écran', () => {
    const W = 300
    const brume = vueFactice({ W, k: W / 390, ouverte: { annee: 1899, t0: 0 }, t: 2 })
    monde.dessinerSurLaBrume(brume.vue)
    expect(brume.appels.find((a) => a.nom === 'fillText' && a.args[0] === 'Une grande baraque en chantier')?.args[1]).toBe(322)
    const ciel = vueFactice({ W, k: W / 390 })
    monde.dessinerCiel(ciel.vue)
    const traits = ciel.appels.filter((a) => a.nom === 'fillRect' && a.fillStyle === c('#000000', 0.16)).map((a) => a.args[0] as number)
    expect(traits).toHaveLength(70)
    expect(Math.max(...traits)).toBeGreaterThan(W)
  })

  // Mutation : redessiner l'année sous un `court` qui est déjà l'année (« 1896 / 1896 »).
  it('ne dit l’année qu’une fois sur une affichette connue à l’année seulement', () => {
    const monde = creerMonde1890()
    const { vue, appels } = vueFactice({ cases: cases(['encours', 'encours', 'encours', 'encours', 'encours']) })
    monde.dessinerSol(vue, { x: 195, y: 820 })
    const lues = textes(appels)
    for (const an of new Set(DATES.map((d) => d.an))) {
      const attendu = DATES.filter((d) => d.an === an).length
      expect(lues.filter((t) => t === String(an)), String(an)).toHaveLength(attendu)
    }
  })

  // Mutations : une date hors de la section (`y`) ; une date rangée sous une autre année que la sienne.
  it('range chaque date vraie dans la section et sous son année', () => {
    for (const d of DATES) {
      expect(d.y, d.titre).toBeGreaterThanOrEqual(0)
      expect(d.y, d.titre).toBeLessThanOrEqual(1240)
      expect(d.jour, d.titre).toContain(String(d.an))
    }
  })

  // Mutation : `k` qui n'est plus borné à 0 : l'horloge du décor retarde d'au plus 1/16 s sur celle
  // qui date l'arrivée de l'avatar.
  it('tient un chantier à son premier coup de marteau tant que l’horloge du décor n’a pas rattrapé l’arrivée', () => {
    expect(chantier(1898, { annee: 1898, t0: 10 }, 9.95, true)).toEqual({ etat: 'chantier', k: 0 })
  })

  // Mutation : `DEMI_PALIER` changé : la vitesse de la montée que le propriétaire jugera à l'œil.
  it('mène l’année en cours à mi-palier au quatrième film', () => {
    expect(remplissage(cases(['passee', 'ours', 'encours', 'verrou', 'verrou'], 4), false)).toBe(2.5 / PALIERS)
  })
})
