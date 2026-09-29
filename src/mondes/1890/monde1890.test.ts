import { describe, expect, it, vi } from 'vitest'
import { creerMonde1890 } from '.'
import { ampoules, PALIERS, quantites, remplissage } from './foire'
import { chantier, ELEMENTS } from './chantier'
import { DATES } from './dates'
import { vueFactice } from '../../test/vueFactice'
import { SCINTILLEMENT_MAX } from '../../carte/traitement'
import type { CaseVue, VueMonde } from '../types'

const cases = (etats: CaseVue['etat'][], profondeur = 0): CaseVue[] =>
  etats.map((etat, i) => ({ annee: 1895 + i, etat, profondeur, x: 100, y: 100, pop: -9 }))
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
      return { annee, etat, profondeur: i === quittees ? films : horsEnCours, x: 100, y: 100, pop: -9 }
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
