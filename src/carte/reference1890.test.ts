import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MoteurCarte, type CaseCarte, type Dependances, type EtatCarte, type Rappels } from './moteur'
import { contexteFactice, type Appel } from '../test/contexteFactice'
import { creerRegistre } from '../mondes'
import { mondeAVenir } from '../mondes/avenir'
import type { Monde } from '../mondes/types'

/**
 * La référence de 1890 (plan 3a, tâche 1) : ce que le moteur dessine pour le vrai monde 1890 suivi
 * du monde « à venir », figé en empreintes avant que le moteur ne s'étende. Les tâches qui
 * étendent le moteur la laissent verte **sans y toucher** : une empreinte qui change dit qu'un
 * dessin de 1890, un dessin commun ou le sol a bougé.
 *
 * Une empreinte ne se recopie pas pour faire passer un test : elle ne se refait (l'échec imprime
 * les empreintes reçues) que si le changement de dessin est voulu, et dit dans le commit.
 */

const W = 390
const H = 700

/** Où la caméra se pose (`defiler`). 1890 commence à 190 (`MARGE_HAUT`) et finit à 1430, où 1900 commence. */
const CAMERA = {
  /** Le haut de la carte : 1895 vers le milieu de l'écran. */
  haut: 0,
  /** La case de 1897 (190 + 420) au milieu de l'écran. */
  sur1897: 260,
  /** La porte de 1890 (190 + 820) au milieu de l'écran. */
  porte: 660,
  /** La frontière (1430) au milieu de l'écran : les deux mondes sont présents. */
  frontiere: 1080,
  /** Six cents pixels sous la frontière : le monde « à venir » seul. */
  dans1900: 2030,
} as const

/** L'état de la carte : le départ (1898 en cours), 1900 ouverte (1890 quittée), ou 1890 bouclée (son tampon posé). */
type Etat = 'depart' | '1900 ouverte' | '1890 bouclee'

interface Cas {
  nom: string
  calme: boolean
  camera: number
  etat?: Etat
  roulotte?: EtatCarte['roulotte']
  bobines?: readonly string[]
  ensemble?: boolean
  /** L'heure du visiteur ; midi sans elle. */
  heure?: number
  /** Les images jouées après la première, à 40 ms l'une de l'autre ; douze sans elle. Une seule au calme. */
  images?: number
}

const FETE = '1890 bouclée, en haut de 1890, en mouvement'

const lieux: ReadonlyArray<[string, number]> = [
  ['en haut de 1890', CAMERA.haut],
  ['sur 1897', CAMERA.sur1897],
  ['sur la porte', CAMERA.porte],
  ['à cheval sur la frontière de 1900', CAMERA.frontiere],
  ['dans 1900', CAMERA.dans1900],
]
const allures: ReadonlyArray<[string, boolean]> = [
  ['au calme', true],
  ['en mouvement', false],
]
const CAS: readonly Cas[] = [
  ...lieux.flatMap(([lieu, camera]) => allures.map(([allure, calme]) => ({ nom: `${lieu}, ${allure}`, calme, camera }))),
  { nom: 'la vue d’ensemble ouverte, au calme', calme: true, camera: CAMERA.haut, ensemble: true },
  { nom: 'la vue d’ensemble qui s’ouvre, en mouvement', calme: false, camera: CAMERA.haut, ensemble: true },
  { nom: 'une roulotte garée en 1896, au calme', calme: true, camera: CAMERA.haut, roulotte: { pseudo: 'theo', annee: 1896 } },
  { nom: 'une roulotte qui descend vers 1896, en mouvement', calme: false, camera: CAMERA.haut, roulotte: { pseudo: 'theo', annee: 1896 } },
  { nom: 'une bobine déjà trouvée, au calme', calme: true, camera: CAMERA.porte, bobines: ['les-quatre-diables'] },
  { nom: 'une bobine déjà trouvée, en mouvement', calme: false, camera: CAMERA.porte, bobines: ['les-quatre-diables'] },
  { nom: '1900 ouverte, sur la porte, au calme', calme: true, camera: CAMERA.porte, etat: '1900 ouverte' },
  { nom: '1900 ouverte, sur la porte, en mouvement', calme: false, camera: CAMERA.porte, etat: '1900 ouverte' },
  { nom: '1900 ouverte, à cheval sur la frontière, au calme', calme: true, camera: CAMERA.frontiere, etat: '1900 ouverte' },
  // Les feux du décor (`VueMonde.feu`) ne se dessinent que la nuit.
  { nom: 'de nuit, sur 1897, en mouvement', calme: false, camera: CAMERA.sur1897, heure: 23 },
  // Le seul cas qui tire `Math.random` : la décennie bouclée lance des confettis (`mondes/1890/proches.ts`).
  // Quarante images : la première volée part à la trente et unième et vole encore à la dernière.
  { nom: FETE, calme: false, camera: CAMERA.haut, etat: '1890 bouclee', images: 40 },
]

/** Les cases de 1895 à 1912 : 1890 (cinq années), 1900 (dix) et le début de 1910 (trois). */
function casesDe(etat: Etat): CaseCarte[] {
  const enCours = etat === 'depart' ? 1898 : 1900
  const recompenses = ['lion', 'passee', 'palme', 'ours', 'passee'] as const
  return Array.from({ length: 1912 - 1895 + 1 }, (_, i) => {
    const annee = 1895 + i
    const ouverte = annee <= enCours
    return {
      annee,
      etat: annee < enCours ? recompenses[i % recompenses.length]! : annee === enCours ? 'encours' : 'verrou',
      attente: false,
      // Des profondeurs inégales : les photogrammes allumés du sol en dépendent.
      profondeur: ouverte ? [30, 12, 4, 3, 18, 6][i % 6]! : 0,
      jauge: annee === enCours ? { vus: 3, total: 5 } : null,
      affiches: ouverte ? [`https://image.tmdb.org/t/p/w500/${annee}.jpg`] : [],
    }
  })
}

/** Une suite fixe à la place de `Math.random` (un générateur congruentiel, repris à chaque montage). */
function suiteFixe(graine: number, compter: () => void): () => number {
  let s = graine
  return () => {
    compter()
    s = (s * 48271) % 2147483647
    return s / 2147483647
  }
}

/** L'empreinte d'un texte (cyrb53, cinquante-trois bits) : jsdom n'a pas de quoi hacher, et le dépôt n'importe pas `node:`. */
function hacher(texte: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

interface Jeu {
  /** Les appels de la dernière image, sur le contexte principal. */
  image: Appel[]
  /** Chaque toile créée par le moteur (le grain, les affiches traitées, les tuiles du sol), dans l'ordre. */
  toiles: Array<{ nom: string; appels: Appel[] }>
  /** Combien de fois le moteur et le monde ont tiré au hasard. */
  tirages: number
}

/** La graine de la suite qui double `Math.random` : celle des empreintes. */
const GRAINE = 20261002

/** Monte un moteur sur le vrai monde 1890 et joue le cas. */
function jouer(cas: Cas, graine = GRAINE): Jeu {
  let tirages = 0
  vi.spyOn(Math, 'random').mockImplementation(suiteFixe(graine, () => void tirages++))
  const principal = contexteFactice()
  const toiles: Jeu['toiles'] = []
  // Le vrai 1890 ; toute autre décennie prend `mondeAVenir`, importé d'ici : la référence ne dépend
  // pas des lignes que le registre gagnera.
  const registre = creerRegistre()
  const aVenir = new Map<number, Monde>()
  const mondeDe = (d: number): Monde => {
    if (d === 1890) return registre(1890)
    const m = aVenir.get(d) ?? mondeAVenir(d)
    aVenir.set(d, m)
    return m
  }
  const deps: Dependances = {
    creerToile: (w, h) => {
      const f = contexteFactice()
      toiles.push({ nom: `${toiles.length} ${w}x${h}`, appels: f.appels })
      return { width: w, height: h, getContext: () => f.ctx }
    },
    image: () => ({}) as CanvasImageSource,
    demanderImage: () => 1,
    annulerImage: () => undefined,
    heure: () => cas.heure ?? 12,
    mondeDe,
  }
  const rien = () => undefined
  const rappels: Rappels = { toucherAnnee: rien, apercu: rien, finApercu: rien, ensemble: rien, defilerVers: rien, date: rien, roulotte: rien, avatarVisible: rien, bobine: rien, bobineArrivee: rien, cibleBobines: () => ({ x: 350, y: 40 }), clap: rien, presences: rien }
  const moteur = new MoteurCarte({ width: 0, height: 0, getContext: () => principal.ctx }, rappels, deps)
  moteur.mesurer(W, H, 2)
  moteur.reglerCalme(cas.calme)
  const etat = cas.etat ?? 'depart'
  moteur.majEtat({ cases: casesDe(etat), anneeAvatar: etat === 'depart' ? 1898 : 1900, tampons: etat === '1890 bouclee' ? [1890] : [], roulotte: cas.roulotte ?? null })
  if (cas.bobines) moteur.reglerBobines(cas.bobines)
  moteur.defiler(cas.camera)
  moteur.image(1000)
  if (cas.ensemble) moteur.basculerEnsemble(true)
  // L'horloge fixée : en mouvement, des images à 40 ms l'une de l'autre ; au calme, une seule de plus.
  const images = cas.calme ? 1 : (cas.images ?? 12)
  for (let i = 1; i <= images; i++) {
    if (i === images) principal.appels.length = 0
    moteur.image(1000 + i * 40)
  }
  return { image: principal.appels, toiles, tirages }
}

/** Les empreintes d'un cas : le contexte principal, puis chaque toile à part (la route et les photogrammes vivent dans les tuiles). */
function empreintes(jeu: Jeu): string[] {
  return [`image ${jeu.image.length} ${hacher(JSON.stringify(jeu.image))}`, ...jeu.toiles.map((t) => `toile ${t.nom} ${t.appels.length} ${hacher(JSON.stringify(t.appels))}`)]
}

/** Les trois motifs du grain, les premières toiles de chaque montage : les mêmes pour tous les cas. */
const GRAIN: readonly string[] = [
  'toile 0 128x128 2 0972b9d3b955a0',
  'toile 1 128x128 2 0da230cb7e35b6',
  'toile 2 128x128 2 0f6f63e3bdea43',
]

/** Les empreintes, cas par cas : `image`, le contexte principal à la dernière image (le nombre d'appels, puis leur empreinte) ; `toile`, chaque toile dans l'ordre de sa création (son rang, sa taille, ses appels). Les toiles de 780 × 1024 sont les tuiles du sol. */
const REFERENCE: Record<string, readonly string[]> = {
  'en haut de 1890, au calme': [
    'image 3389 19f07b2f6a1c88',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'en haut de 1890, en mouvement': [
    'image 3437 1334619859d7dd',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'sur 1897, au calme': [
    'image 3520 0b827ca7f861d2',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'sur 1897, en mouvement': [
    'image 3568 0f3e06bbd40ee6',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'sur la porte, au calme': [
    'image 3276 03234f35998413',
    ...GRAIN,
    'toile 3 780x1024 105 0d302d0b43007a',
    'toile 4 780x1024 105 1cc5be02989263',
  ],
  'sur la porte, en mouvement': [
    'image 3317 17fd3b2408613b',
    ...GRAIN,
    'toile 3 780x1024 105 0d302d0b43007a',
    'toile 4 780x1024 105 1cc5be02989263',
  ],
  'à cheval sur la frontière de 1900, au calme': [
    'image 3255 0e3eca74b137c5',
    ...GRAIN,
    'toile 3 780x1024 105 1cc5be02989263',
    'toile 4 780x1024 105 0d3d922edbdcae',
  ],
  'à cheval sur la frontière de 1900, en mouvement': [
    'image 3289 08cb72d818f8bf',
    ...GRAIN,
    'toile 3 780x1024 105 1cc5be02989263',
    'toile 4 780x1024 105 0d3d922edbdcae',
  ],
  'dans 1900, au calme': [
    'image 1023 017c5c416d11f2',
    ...GRAIN,
    'toile 3 780x1024 105 0d3d922edbdcae',
    'toile 4 780x1024 105 192a8f0030442b',
    'toile 5 780x1024 105 00aaf72c024acf',
  ],
  'dans 1900, en mouvement': [
    'image 1033 0d4252cfec768b',
    ...GRAIN,
    'toile 3 780x1024 105 0d3d922edbdcae',
    'toile 4 780x1024 105 192a8f0030442b',
    'toile 5 780x1024 105 00aaf72c024acf',
  ],
  'la vue d’ensemble ouverte, au calme': [
    'image 256 074cc7ea9d4567',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'la vue d’ensemble qui s’ouvre, en mouvement': [
    'image 3692 0fcdc55bf4284a',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'une roulotte garée en 1896, au calme': [
    'image 3619 11d0a63341b3d2',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'une roulotte qui descend vers 1896, en mouvement': [
    'image 3641 189bef6dad12e8',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  'une bobine déjà trouvée, au calme': [
    'image 3241 03f82cf0fae0ef',
    ...GRAIN,
    'toile 3 780x1024 105 0d302d0b43007a',
    'toile 4 780x1024 105 1cc5be02989263',
  ],
  'une bobine déjà trouvée, en mouvement': [
    'image 3282 065fc3ea9656c8',
    ...GRAIN,
    'toile 3 780x1024 105 0d302d0b43007a',
    'toile 4 780x1024 105 1cc5be02989263',
  ],
  '1900 ouverte, sur la porte, au calme': [
    'image 4141 157320fbb78137',
    ...GRAIN,
    'toile 3 780x1024 177 08160a42394b4d',
    'toile 4 780x1024 177 046a5dea1014e0',
  ],
  '1900 ouverte, sur la porte, en mouvement': [
    'image 4189 149297802e3b5a',
    ...GRAIN,
    'toile 3 780x1024 177 08160a42394b4d',
    'toile 4 780x1024 177 046a5dea1014e0',
  ],
  '1900 ouverte, à cheval sur la frontière, au calme': [
    'image 4071 128a20b5e53fdf',
    ...GRAIN,
    'toile 3 780x1024 177 046a5dea1014e0',
    'toile 4 780x1024 177 0acf2e12c3fc47',
    'toile 5 52x76 2 0301dcf5fa40b7',
  ],
  'de nuit, sur 1897, en mouvement': [
    'image 3607 06cfa2fc528948',
    ...GRAIN,
    'toile 3 780x1024 105 1b338b9d56b774',
    'toile 4 780x1024 105 0d302d0b43007a',
  ],
  '1890 bouclée, en haut de 1890, en mouvement': [
    'image 5181 091ff84edf429f',
    ...GRAIN,
    'toile 3 780x1024 177 08274e45499ac1',
    'toile 4 780x1024 177 08160a42394b4d',
  ],
}

describe('la référence de 1890', () => {
  beforeEach(() => {
    // Un chemin qui garde ses points : la route tracée dans les tuiles se lit dans l'argument de `stroke`.
    vi.stubGlobal('Path2D', class {
      points: number[][] = []
      moveTo(x: number, y: number) { this.points.push([0, x, y]) }
      lineTo(x: number, y: number) { this.points.push([1, x, y]) }
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Mutations : une coordonnée décalée d'un pixel dans `mondes/1890/sol.ts` (un dessin de 1890) ;
  // l'appel à `dessinerAvatar` retiré de `moteur.ts` (un dessin commun) ; une coordonnée du
  // photogramme décalée dans `dessin/sol.ts` (le sol, qui ne vit que dans les tuiles) ; un contexte
  // factice qui ne note rien (la référence vide).
  it.each(CAS)('ne laisse pas bouger le dessin : $nom', (cas) => {
    const jeu = jouer(cas)
    expect(jeu.image.length).toBeGreaterThan(100)
    const tuiles = jeu.toiles.filter((t) => t.nom.endsWith(' 780x1024'))
    expect(tuiles.length).toBeGreaterThan(0)
    for (const t of jeu.toiles) expect(t.appels.length, t.nom).toBeGreaterThan(0)
    expect(empreintes(jeu)).toEqual(REFERENCE[cas.nom])
  })

  // Mutation : la doublure de `Math.random` retirée de `jouer` (les confettis de la fête divergent).
  it.each(CAS)('rend la même empreinte, jouée deux fois de suite : $nom', (cas) => {
    expect(empreintes(jouer(cas))).toEqual(empreintes(jouer(cas)))
  })

  // Sans ce cas, aucune image de la référence ne tirerait au hasard, et la doublure ne garderait rien.
  // Mutations : le tampon de 1890 retiré du cas de la fête (plus de tirage) ; ses images ramenées
  // à douze (la volée n'est pas encore partie).
  it('tire au hasard dans le cas de la fête, par la doublure', () => {
    const fete = CAS.find((c) => c.nom === FETE)!
    const jeu = jouer(fete)
    expect(jeu.tirages).toBeGreaterThan(0)
    // Les confettis volent encore à la dernière image, celle que l'empreinte garde : une autre
    // suite y donne une autre image.
    expect(empreintes(jouer(fete, GRAINE + 1))[0]).not.toBe(empreintes(jeu)[0])
  })
})
