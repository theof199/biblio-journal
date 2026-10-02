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
 * Ce qui est figé : chaque appel au contexte, avec l'état que le banc tient (`contexteFactice`), et
 * chaque écriture de propriété (`lineWidth`, `font`, `lineCap`…), que le banc avale et qu'un témoin
 * local note (`temoin`). Les nombres sont arrondis à six décimales avant d'être hachés : un dernier
 * chiffre qui diffère d'une machine à l'autre ne fait pas tomber la référence, un pixel si.
 *
 * Une empreinte ne se recopie pas pour faire passer un test : elle ne se refait (l'échec imprime
 * les empreintes reçues) que si le changement de dessin est voulu, et dit dans le commit.
 *
 * Lire un échec. Une empreinte ne dit pas quel appel a bougé : la suite, si. Avec la variable
 * `VITE_REFERENCE_1890_SORTIE` posée sur un dossier en chemin absolu, **hors du dépôt**, chaque cas
 * y écrit sa suite, un appel par ligne, dans un fichier à son nom (l'image, puis chaque toile).
 * Sans elle, rien ne s'écrit. Pour comparer deux commits :
 *
 *   VITE_REFERENCE_1890_SORTIE=/tmp/reference-avant npx vitest run src/carte/reference1890.test.ts
 *   (changer de commit)
 *   VITE_REFERENCE_1890_SORTIE=/tmp/reference-apres npx vitest run src/carte/reference1890.test.ts
 *   diff -r /tmp/reference-avant /tmp/reference-apres
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

/** L'empreinte d'un texte (cyrb53, cinquante-trois bits) : jsdom n'a pas de quoi hacher, et le dépôt n'a pas les types de Node. */
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

/** Le nom que le témoin donne à une écriture de propriété, devant celui de la propriété. */
const ECRITURE = '= '

/**
 * Le témoin : le banc n'écrit que ce que son état tient (`fillStyle`, `strokeStyle`, l'alpha, la
 * composition, le décalage du pointillé) et avale le reste. Ici, toute écriture de propriété entre
 * dans la suite, à sa place, avec sa valeur : une largeur de trait ou une police qui change se voit.
 */
function temoin(f: { ctx: CanvasRenderingContext2D; appels: Appel[] }): CanvasRenderingContext2D {
  return new Proxy(f.ctx, {
    set(cible, cle, valeur: unknown) {
      const ecrit = Reflect.set(cible, cle, valeur)
      if (typeof cle === 'string') {
        f.appels.push({ nom: `${ECRITURE}${cle}`, args: [valeur], fillStyle: cible.fillStyle, strokeStyle: cible.strokeStyle, alpha: cible.globalAlpha, composite: cible.globalCompositeOperation, dash: cible.lineDashOffset })
      }
      return ecrit
    },
  })
}

/** Les appels d'une suite, sans les écritures de propriétés : ce qu'un contexte qui ne note rien ne rendrait pas. */
const appelsDe = (suite: readonly Appel[]) => suite.filter((a) => !a.nom.startsWith(ECRITURE))

interface Jeu {
  /** La suite de la dernière image, sur le contexte principal : ses appels et ses écritures de propriétés. */
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
  const ctxPrincipal = temoin(principal)
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
      const ctx = temoin(f)
      // Numérotée par ordre de création (comme le banc de `moteur.test.ts`) : deux tuiles échangées
      // à l'écran se voient dans l'argument du `drawImage` de l'image principale.
      const toile = { width: w, height: h, numero: toiles.length, getContext: () => ctx }
      toiles.push({ nom: `${toiles.length} ${w}x${h}`, appels: f.appels })
      return toile
    },
    image: () => ({}) as CanvasImageSource,
    demanderImage: () => 1,
    annulerImage: () => undefined,
    heure: () => cas.heure ?? 12,
    mondeDe,
  }
  const rien = () => undefined
  const rappels: Rappels = { toucherAnnee: rien, apercu: rien, finApercu: rien, ensemble: rien, defilerVers: rien, date: rien, roulotte: rien, avatarVisible: rien, bobine: rien, bobineArrivee: rien, cibleBobines: () => ({ x: 350, y: 40 }), clap: rien, presences: rien }
  const moteur = new MoteurCarte({ width: 0, height: 0, getContext: () => ctxPrincipal }, rappels, deps)
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
  return [`image ${jeu.image.length} ${hacher(ecrire(jeu.image))}`, ...jeu.toiles.map((t) => `toile ${t.nom} ${t.appels.length} ${hacher(ecrire(t.appels))}`)]
}

/** Six décimales : sous le millionième de pixel, un écart n'est pas un dessin qui change. */
const arrondir = (_cle: string, v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)

/** Une suite en texte, une ligne par appel ou par écriture, les nombres arrondis : ce qui est haché, et ce que le diagnostic écrit. */
const ecrire = (suite: readonly Appel[]): string => suite.map((a) => JSON.stringify(a, arrondir)).join('\n')

/** Le dossier du diagnostic (voir l'en-tête) ; vide : rien ne s'écrit. */
const SORTIE: string = import.meta.env.VITE_REFERENCE_1890_SORTIE ?? ''

/** Le diagnostic : la suite d'un cas, dans un fichier à son nom. Jamais sans `SORTIE`, jamais en chemin relatif. */
async function sortir(cas: Cas, jeu: Jeu): Promise<void> {
  if (!SORTIE) return
  if (!SORTIE.startsWith('/')) throw new Error(`VITE_REFERENCE_1890_SORTIE veut un chemin absolu, hors du dépôt : reçu « ${SORTIE} »`)
  // Le dépôt n'a pas les types de Node : le module se charge par son nom, et ne sert qu'ici.
  const module = 'node:fs'
  const fs: { mkdirSync: (dossier: string, options: { recursive: boolean }) => void; writeFileSync: (fichier: string, texte: string) => void } = await import(/* @vite-ignore */ module)
  const fichier = cas.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  const texte = [`# image`, ecrire(jeu.image), ...jeu.toiles.flatMap((t) => [`# toile ${t.nom}`, ecrire(t.appels)])].join('\n')
  fs.mkdirSync(SORTIE, { recursive: true })
  fs.writeFileSync(`${SORTIE}/${fichier}.txt`, `${texte}\n`)
}

/** Les trois motifs du grain, les premières toiles de chaque montage : les mêmes pour tous les cas. */
const GRAIN: readonly string[] = [
  'toile 0 128x128 2 051358ee03649b',
  'toile 1 128x128 2 1912e957808390',
  'toile 2 128x128 2 157f2cfa79db20',
]

/** Les empreintes, cas par cas : `image`, le contexte principal à la dernière image (le nombre d'appels et d'écritures, puis leur empreinte) ; `toile`, chaque toile dans l'ordre de sa création (son rang, sa taille, ses appels). Les toiles de 780 × 1024 sont les tuiles du sol. */
const REFERENCE: Record<string, readonly string[]> = {
  'en haut de 1890, au calme': [
    'image 4193 1966bcdae370b8',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'en haut de 1890, en mouvement': [
    'image 4262 02bff8260c6761',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'sur 1897, au calme': [
    'image 4350 1025fa804c866e',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'sur 1897, en mouvement': [
    'image 4419 02aa726e1c66f6',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'sur la porte, au calme': [
    'image 4061 01249951890ee0',
    ...GRAIN,
    'toile 3 780x1024 146 113ccfd3042ee9',
    'toile 4 780x1024 146 02139b68ae2928',
  ],
  'sur la porte, en mouvement': [
    'image 4122 0dd869e0800a46',
    ...GRAIN,
    'toile 3 780x1024 146 113ccfd3042ee9',
    'toile 4 780x1024 146 02139b68ae2928',
  ],
  'à cheval sur la frontière de 1900, au calme': [
    'image 4053 06701609f9bee6',
    ...GRAIN,
    'toile 3 780x1024 146 02139b68ae2928',
    'toile 4 780x1024 146 0700d6e654936f',
  ],
  'à cheval sur la frontière de 1900, en mouvement': [
    'image 4106 1c6ebd2f9c10e0',
    ...GRAIN,
    'toile 3 780x1024 146 02139b68ae2928',
    'toile 4 780x1024 146 0700d6e654936f',
  ],
  'dans 1900, au calme': [
    'image 1272 04e1363e742d68',
    ...GRAIN,
    'toile 3 780x1024 146 0700d6e654936f',
    'toile 4 780x1024 146 01f3b45f116c6a',
    'toile 5 780x1024 146 05c99fc3ca5fcc',
  ],
  'dans 1900, en mouvement': [
    'image 1286 03980a31e34109',
    ...GRAIN,
    'toile 3 780x1024 146 0700d6e654936f',
    'toile 4 780x1024 146 01f3b45f116c6a',
    'toile 5 780x1024 146 05c99fc3ca5fcc',
  ],
  'la vue d’ensemble ouverte, au calme': [
    'image 346 044f4092c6b3e0',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'la vue d’ensemble qui s’ouvre, en mouvement': [
    'image 4607 011cf019442224',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'une roulotte garée en 1896, au calme': [
    'image 4473 0298eff42fa85c',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'une roulotte qui descend vers 1896, en mouvement': [
    'image 4510 1a3ac52efa1638',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  'une bobine déjà trouvée, au calme': [
    'image 4020 13f9b4801dce83',
    ...GRAIN,
    'toile 3 780x1024 146 113ccfd3042ee9',
    'toile 4 780x1024 146 02139b68ae2928',
  ],
  'une bobine déjà trouvée, en mouvement': [
    'image 4081 16908ef958d7cf',
    ...GRAIN,
    'toile 3 780x1024 146 113ccfd3042ee9',
    'toile 4 780x1024 146 02139b68ae2928',
  ],
  '1900 ouverte, sur la porte, au calme': [
    'image 5135 185a7dce8ed9b8',
    ...GRAIN,
    'toile 3 780x1024 242 182073565237ab',
    'toile 4 780x1024 242 1c0a48c9163572',
  ],
  '1900 ouverte, sur la porte, en mouvement': [
    'image 5204 1844f8a7923207',
    ...GRAIN,
    'toile 3 780x1024 242 182073565237ab',
    'toile 4 780x1024 242 1c0a48c9163572',
  ],
  '1900 ouverte, à cheval sur la frontière, au calme': [
    'image 5077 03223a2fb1fc21',
    ...GRAIN,
    'toile 3 780x1024 242 1c0a48c9163572',
    'toile 4 780x1024 242 18177a5a7b7140',
    'toile 5 52x76 5 19a5836027e192',
  ],
  'de nuit, sur 1897, en mouvement': [
    'image 4556 080e67614c93af',
    ...GRAIN,
    'toile 3 780x1024 146 1e22da48e2edd8',
    'toile 4 780x1024 146 113ccfd3042ee9',
  ],
  '1890 bouclée, en haut de 1890, en mouvement': [
    'image 6542 0d178b4d829f03',
    ...GRAIN,
    'toile 3 780x1024 242 17c4df36dc45e1',
    'toile 4 780x1024 242 182073565237ab',
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
  // photogramme décalée dans `dessin/sol.ts` (le sol, qui ne vit que dans les tuiles) ; une largeur
  // de trait changée dans le même fichier (une propriété que le banc avale) ; un contexte factice
  // qui ne note rien (la référence vide).
  it.each(CAS)('ne laisse pas bouger le dessin : $nom', async (cas) => {
    const jeu = jouer(cas)
    await sortir(cas, jeu)
    expect(appelsDe(jeu.image).length).toBeGreaterThan(100)
    const tuiles = jeu.toiles.filter((t) => t.nom.endsWith(' 780x1024'))
    expect(tuiles.length).toBeGreaterThan(0)
    for (const t of jeu.toiles) expect(appelsDe(t.appels).length, t.nom).toBeGreaterThan(0)
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
