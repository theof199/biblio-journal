import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { A_L_ARRET, CORAIL, DUREE_DE_L_ENVOL, DUREE_DU_ROULEMENT, MAX_TUILES, MoteurCarte, REPOS_DU_DEFILEMENT, type CaseCarte, type Dependances, type EtatCarte, type Rappels } from './moteur'
import { contexteFactice, type Appel } from '../test/contexteFactice'
import { cibleCamera } from './camera'
import { APPUI_LONG_MS } from './geste'
import { TUILE } from './dessin/sol'
import { MARGE_HAUT } from './placement'
import { mondeAVenir } from '../mondes/avenir'
import type { BobinePerdue, CadreDeBande, DateVraie, EtatDeBande, Glissement, HalteVue, HoraireVue, Monde, MusiqueDuMonde, ObjetCache, Ralenti, SuiviGare, TempsDEntree, VueMonde } from '../mondes/types'
import { auTempo, TEMPO } from '../voyage/tempo'

const W = 390
const H = 700

/**
 * Un monde d'essai qui porte tout ce qu'un monde peut demander au moteur — un virage, une
 * palpitation, une cadence — et qui dessine d'après l'horloge qu'il reçoit : si elle bouge,
 * l'image bouge.
 */
const vus: VueMonde[] = []
/** Une date vraie du monde d'essai, et l'endroit de l'écran où il pose son affichette. */
const DATE: DateVraie = { an: 1895, x: 60, y: 90, court: '22 mars', lieu: 'Paris', titre: 'La première projection', jour: 'Vendredi 22 mars 1895', texte: 'Un texte.', image: null }
/** Idée 8 : où se bâtit 1899 dans le monde d'essai, en `y` de la section 1890 (qui commence à 0). */
const SITE_1899 = 200
/** Un manège du monde d'essai, loin des cases et de l'affichette : un toucher le fait réagir. */
const MANEGE = { x: 300, y: 90 }
/**
 * Plan 2d : la bobine perdue du monde d'essai, posée à côté de l'affichette, sa zone mordant sur
 * la sienne : un toucher entre les deux qui ne trouve plus la bobine tombe sur l'affichette. Et sa
 * musique.
 */
const BOBINE: BobinePerdue = { cle: 'les-quatre-diables', titre: 'Les Quatre Diables', qui: 'F. W. Murnau, 1928' }
const OU_BOBINE = { x: DATE.x + 30, y: DATE.y }
/** Un point des deux zones à la fois, celle de la bobine et celle de l'affichette. */
const ENTRE_LES_DEUX = { x: DATE.x + 12, y: DATE.y }
/** Une seconde bobine, loin de la première, pour le monde qui en cache deux (option `deuxBobines`). */
const AUTRE_BOBINE: BobinePerdue = { cle: 'la-tete-de-janus', titre: 'La Tête de Janus', qui: 'F. W. Murnau, 1920' }
const OU_AUTRE_BOBINE = { x: 190, y: DATE.y }
/**
 * Lot « moteur » : l'objet caché de chaque monde d'essai (option `objets`), au même rang 0 chez l'un
 * et chez l'autre. Celui de 1890 mord sur le manège : un toucher qui ne le trouve plus tombe sur le
 * manège. Celui du monde collant se pose à l'écran, en haut, comme sa dépêche.
 */
const OBJET: ObjetCache = { cle: 'la-lorgnette', phrase: '', Dessin: () => null }
const OBJET_1900: ObjetCache = { cle: 'le-sifflet', phrase: '', Dessin: () => null }
const OU_OBJET = { x: MANEGE.x + 12, y: MANEGE.y }
const OU_OBJET_1900 = { x: 130, y: 60 }
// Brief 9 des écrans des lots : trois haltes, une sur la foire et deux sur la ligne, que la page donne
// dans cet ordre. Le rang d'un aiguillage se lit dans celles de sa section, pas dans la liste entière.
const HALTE_DE_LA_FOIRE: HalteVue = { cle: 'la-baraque', apres: 1897, vus: 0, total: 1 }
const HALTE_MELIES: HalteVue = { cle: 'melies', apres: 1902, vus: 2, total: 3 }
const HALTE_ZECCA: HalteVue = { cle: 'zecca', apres: 1901, vus: 0, total: 2 }
const HALTES = [HALTE_DE_LA_FOIRE, HALTE_MELIES, HALTE_ZECCA]
/** Où le monde collant pose l'aiguillage de la halte de rang `i`, à l'écran. */
const ouAiguillage1900 = (i: number) => ({ x: 80 + 130 * i, y: 60 })
/** Les vues que les mondes d'essai ont reçues avec une réaction. */
const vuesDesReactions: VueMonde[] = []
const MUSIQUE: MusiqueDuMonde = { battue: 0.36, temps: 24, volume: 0.5, filtre: 2300, jouer: () => undefined }
/** La couleur de la joue d'une bobine terne (`dessinerBobine`), passée par la rampe du monde d'essai. */
const JOUE = mondeAVenir(1890).couleur('#6b6258')
/** Les réactions demandées au monde d'essai, par zone touchée. */
const reactions: string[] = []
/**
 * Plan 3a : le monde d'essai collant de 1900 (option `collant`). Sa section commence sous celle de
 * 1890 (cinq années du tracé « à venir »). Il tient ses cinq premières années sur un quai fixe, au
 * bas de l'écran, loin de la place que le tracé leur donne ; les suivantes sont hors de vue. Il
 * gare le Voyage suivi en `OU_SUIVI`, et joue sa propre musique. Il n'a d'arrêts que ceux qu'on lui
 * donne (option `arrets`) : sans eux, la caméra n'y est jamais rappelée. De même pour les temps de son
 * passage d'entrée (option `entree`) : sans eux, aucun passage.
 */
const HAUT_1900 = MARGE_HAUT + mondeAVenir(1890).trace([1895, 1896, 1897, 1898, 1899]).hauteur
const quai = (annee: number) => (annee <= 1904 ? { x: 45 + (annee - 1900) * 75, y: 655 } : null)
const OU_SUIVI = { x: 330, y: 130 }
const MUSIQUE_1900: MusiqueDuMonde = { battue: 0.5, temps: 16, volume: 0.4, filtre: 1800, jouer: () => undefined }
/** Les Voyages suivis que le monde collant a été prié de dessiner. */
const suivis: SuiviGare[] = []
/**
 * Les bandes de la vue d'ensemble que le monde collant a été prié de dessiner : ce qu'il a reçu. Il
 * y range ses dix années de gauche à droite, en dix vignettes égales, et ne désigne rien hors de
 * son cadre.
 */
const bandes: Array<{ cadre: CadreDeBande; etat: EtatDeBande }> = []
/**
 * Plan 3b : le monde collant « garni » (option `garni`) porte sa propre date, sa propre bobine et un
 * sémaphore qui réagit, tous trois posés à l'écran, en haut : là où, la caméra à la frontière, le
 * bas de 1890 se voit encore. Les mêmes rangs que ceux de 1890 (la date 0, la bobine 0).
 */
const DEPECHE: DateVraie = { an: 1900, x: 0, y: 0, court: '14 avril', lieu: 'Paris', titre: 'L’Exposition ouvre', jour: 'Samedi 14 avril 1900', texte: 'Une dépêche.', image: null }
const BOBINE_1900: BobinePerdue = { cle: 'le-voyage-a-travers-l-impossible', titre: 'Une bobine de 1900', qui: 'Inconnu, 1900' }
const OU_DEPECHE = { x: 60, y: 50 }
const OU_SEMAPHORE = { x: 200, y: 50 }
const OU_BOBINE_1900 = { x: 330, y: 50 }
/** Les réactions demandées aux mondes d'essai, avec le monde qui les a reçues. */
const reagis: Array<{ decennie: number; id: string }> = []
/** Les glissements livrés aux mondes d'essai, avec le monde qui les a reçus et la vue qu'il a reçue. */
const glisses: Array<{ decennie: number; g: Glissement; v: VueMonde }> = []
function mondeDEssai(decennie: number, collant = false, arrets: readonly number[] = [], entree: readonly TempsDEntree[] = [], garni = false, ralentis: readonly Ralenti[] = []): Monde {
  const base = mondeAVenir(decennie)
  const scene: Monde['scene'] =
    collant && decennie === 1900
      ? {
          ecranDeLaCase: (_, annee) => quai(annee),
          dessinerSuivi: (v, suivi) => {
            suivis.push(suivi)
            v.zone('roulotte', OU_SUIVI.x, OU_SUIVI.y, 36, undefined, 2)
          },
          dessinerBande: (g, cadre, etat) => {
            bandes.push({ cadre, etat })
            g.fillText('bande 1900', cadre.x, cadre.y)
            return (x, y) => (x >= cadre.x && x < cadre.x + cadre.w && y >= cadre.y && y < cadre.y + cadre.h ? 1900 + Math.floor(((x - cadre.x) / cadre.w) * 10) : null)
          },
          entree,
          arrets,
          ralentis,
        }
      : null
  return {
    ...base,
    scene,
    // Une rampe et un ciel marqués : ce que le moteur dessine pour le monde collant se reconnaît.
    couleur: scene ? (hex, a = 1) => `collant(${hex},${a})` : base.couleur,
    palette: scene ? { ...base.palette, ciel: [250, 10, 10], cielJour: [250, 10, 10], cielCrepuscule: [250, 10, 10] } : base.palette,
    traitement: { cadence: 16, tremblement: 0.8, scintillement: 0.03, grain: 0.09, virage: { couleur: [150, 104, 58], alpha: 0.13 }, affiches: 'sepia' },
    dates: decennie === 1890 ? [DATE] : scene && garni ? [DEPECHE] : [],
    bobines: decennie === 1890 ? [BOBINE] : scene && garni ? [BOBINE_1900] : [],
    musique: decennie === 1890 ? MUSIQUE : scene ? MUSIQUE_1900 : null,
    adieu: decennie === 1890 ? 2 : 0,
    dessinerCiel: (v) => {
      vus.push(v)
      v.ctx.fillRect(v.t, 0, 1, 1)
    },
    dessinerSol: (v, porte) => {
      base.dessinerSol(v, porte)
      if (decennie === 1890) v.zone('date', DATE.x * v.k, v.ecranY(DATE.y, 1), 20, 0)
      if (decennie === 1890) v.zone('manege', MANEGE.x * v.k, v.ecranY(MANEGE.y, 1), 20)
      if (decennie === 1890) v.bobine(0, OU_BOBINE.x * v.k, v.ecranY(OU_BOBINE.y, 1), 8)
      if (scene && garni) {
        v.zone('date', OU_DEPECHE.x, OU_DEPECHE.y, 20, 0)
        v.zone('semaphore', OU_SEMAPHORE.x, OU_SEMAPHORE.y, 20)
        v.bobine(0, OU_BOBINE_1900.x, OU_BOBINE_1900.y, 8)
      }
    },
    reagir: (id, _data, v) => {
      vuesDesReactions.push(v)
      reactions.push(id)
      reagis.push({ decennie, id })
    },
    // Idée 8 : un repère dans la suite des appels, pour lire où le moteur place ce plan.
    dessinerSurLaBrume: (v) => v.ctx.fillText('sur la brume', 0, 0),
    // Idée 8 : 1899 se bâtit en haut de la section, loin de sa case (850).
    siteDuChantier: (annee) => (decennie === 1890 && annee === 1899 ? SITE_1899 : null),
  }
}

function monter(
  options: {
    calme?: boolean
    affiches?: boolean
    heure?: number
    roulotte?: EtatCarte['roulotte']
    sansColonne?: boolean
    /** Où se bâtit 1898 (le monde d'essai n'en dit rien sans elle). */
    chantier1898?: number | null
    /** Le monde demande des étincelles, des confettis et de la fumée en dessinant ses plans proches. */
    particules?: boolean
    /** Le ciel du monde d'essai n'écrit son horloge que s'il est vivant : l'image ne dépend plus que du dessin commun. */
    cielSage?: boolean
    /** Le monde d'essai cache une seconde bobine, en `OU_AUTRE_BOBINE`. */
    deuxBobines?: boolean
    /** Plan 3a : le monde d'essai de 1900 a une `scene`, sa section est collante. */
    collant?: boolean
    /** Plan 3a : les arrêts de la section collante, en `y` de la section, un par année. */
    arrets?: readonly number[]
    /** Plan 3a : les temps du passage d'entrée de la section collante, en `y` de la section. */
    entree?: readonly TempsDEntree[]
    /** Plan 3b : le monde collant porte une date, une bobine et un sémaphore (`DEPECHE`, `BOBINE_1900`). */
    garni?: boolean
    /** Lot « moteur » : les ralentis du roulement de la section collante, en `y` de la section. */
    ralentis?: readonly Ralenti[]
    /** Lot « moteur » : chaque monde d'essai cache un objet (`OBJET`, `OBJET_1900`), qu'il pose sans que rien ne le dessine. */
    objets?: boolean
    /** Lot « moteur » : les identifiants de zone dont le toucher vaut au calme, par décennie (`Monde.touchesAuCalme`). */
    auCalme?: Record<number, readonly string[]>
    /** Brief 9 des écrans des lots : chaque monde d'essai inscrit une zone `aiguillage` par halte reçue (`VueMonde.haltes`), à son rang ; 1890 sur le manège. */
    aiguillages?: boolean
    /** Brief 9 : 1890 inscrit sur le manège un aiguillage sans rang (`'nu'`), ou d'un rang qu'aucune halte ne tient (`'inconnu'`). */
    aiguillagePerdu?: 'nu' | 'inconnu'
    /** Brief 9 : 1890 inscrit sur le manège la zone `halte` de sa petite gare (`mondes/1890/halte.ts`), un rang en `data`, devant tout le décor. */
    halteDeLaFoire?: boolean
    /** Lot « moteur » : 1890 pose, sur le manège, un objet d'un rang qu'il ne déclare pas. */
    objetInconnu?: boolean
    /** Lot « moteur » : les mondes qui reçoivent un glissement, par décennie, et ce qu'ils rendent au début (vrai : ils le prennent). Les autres ont `glisser: null`. */
    glisser?: Record<number, boolean>
  } = {},
) {
  vus.length = 0
  reactions.length = 0
  reagis.length = 0
  glisses.length = 0
  vuesDesReactions.length = 0
  suivis.length = 0
  bandes.length = 0
  const principal = contexteFactice()
  const toiles: Appel[][] = []
  /** Les images que le moteur a demandées et qu'aucun test n'a encore jouées : sa boucle, pour qui veut la faire tourner. */
  const demandees: Array<(t: number) => void> = []
  const deps: Dependances = {
    creerToile: (w, h) => {
      const f = contexteFactice()
      // Numérotée par ordre de création : dans la suite des appels, deux toiles (les trois motifs
      // du grain, deux tuiles) ne se confondent pas.
      const toile = { width: w, height: h, numero: toiles.length, getContext: () => f.ctx }
      toiles.push(f.appels)
      return toile
    },
    image: () => ({}) as CanvasImageSource,
    demanderImage: (f) => demandees.push(f),
    annulerImage: vi.fn(),
    heure: () => options.heure ?? 12,
    mondeDe: (d) => {
      const m = mondeDEssai(d, options.collant, options.arrets, options.entree, options.garni, options.ralentis)
      const { chantier1898, particules } = options
      return {
        ...m,
        palette: options.sansColonne ? { ...m.palette, colonne: null } : m.palette,
        dessinerCiel: options.cielSage ? (v) => (v.vivant ? m.dessinerCiel(v) : void vus.push(v)) : m.dessinerCiel,
        siteDuChantier: (annee) => (chantier1898 !== undefined && annee === 1898 ? chantier1898 : m.siteDuChantier(annee)),
        bobines: options.deuxBobines && d === 1890 ? [BOBINE, AUTRE_BOBINE] : m.bobines,
        objets: !options.objets ? m.objets : d === 1890 ? [OBJET] : m.scene ? [OBJET_1900] : [],
        touchesAuCalme: options.auCalme?.[d] ?? m.touchesAuCalme,
        glisser:
          options.glisser?.[d] === undefined
            ? m.glisser
            : (g, v) => {
                glisses.push({ decennie: d, g, v })
                return options.glisser![d]!
              },
        dessinerProche: (v) => {
          if (options.objets && d === 1890) v.objet(0, OU_OBJET.x * v.k, v.ecranY(OU_OBJET.y, 1), 8)
          if (options.objetInconnu && d === 1890) v.objet(7, MANEGE.x * v.k, v.ecranY(MANEGE.y, 1), 8)
          if (options.aiguillages) v.haltes.forEach((_h, i) => (m.scene ? v.zone('aiguillage', ouAiguillage1900(i).x, ouAiguillage1900(i).y, 20, i, 3) : d === 1890 ? v.zone('aiguillage', MANEGE.x * v.k, v.ecranY(MANEGE.y, 1), 20, i, 3) : undefined))
          if (options.halteDeLaFoire && d === 1890) v.zone('halte', MANEGE.x * v.k, v.ecranY(MANEGE.y, 1), 20, 0, 3)
          if (options.aiguillagePerdu && d === 1890) v.zone('aiguillage', MANEGE.x * v.k, v.ecranY(MANEGE.y, 1), 20, options.aiguillagePerdu === 'inconnu' ? 7 : undefined, 3)
          if (options.objets && m.scene) v.objet(0, OU_OBJET_1900.x, OU_OBJET_1900.y, 8)
          if (options.deuxBobines && d === 1890) v.bobine(1, OU_AUTRE_BOBINE.x * v.k, v.ecranY(OU_AUTRE_BOBINE.y, 1), 8)
          if (!particules) return
          v.etincelles(10, 10, 1, '#abcdef')
          v.confettis(10, 10, ['#abcdef'])
          v.fumee(10, 10, 1, 4)
        },
      }
    },
  }
  const rappels: Rappels = { toucherAnnee: vi.fn(), apercu: vi.fn(), finApercu: vi.fn(), ensemble: vi.fn(), defilerVers: vi.fn(), date: vi.fn(), roulotte: vi.fn(), avatarVisible: vi.fn(), bobine: vi.fn(), bobineArrivee: vi.fn(), cibleBobines: vi.fn(() => ({ x: 350, y: 40 })), clap: vi.fn(), presences: vi.fn(), entreeProche: vi.fn(), objet: vi.fn(), aiguillage: vi.fn() }
  const moteur = new MoteurCarte({ width: 0, height: 0, getContext: () => principal.ctx }, rappels, deps)
  moteur.mesurer(W, H, 2)
  moteur.reglerCalme(options.calme ?? false)
  const cases: CaseCarte[] = Array.from({ length: 2026 - 1895 + 1 }, (_, i) => {
    const annee = 1895 + i
    return {
      annee,
      etat: annee < 1898 ? 'lion' : annee === 1898 ? 'encours' : 'verrou',
      attente: false,
      profondeur: annee <= 1898 ? 4 : 0,
      jauge: annee === 1898 ? { vus: 3, total: 5 } : null,
      affiches: options.affiches && annee <= 1898 ? ['https://image.tmdb.org/t/p/w500/a.jpg'] : [],
    }
  })
  const roulotte = options.roulotte ?? null
  moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], tickets: [], roulotte })
  return { moteur, appels: principal.appels, toiles, rappels, deps, cases, roulotte, demandees }
}

const pleinEcran = (a: Appel) => (a.nom === 'fillRect' || a.nom === 'drawImage') && a.args.slice(-2).join() === `${W},${H}`

describe('le moteur de la carte', () => {
  beforeEach(() => {
    vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutation : dessiner la couche corail avant les voiles (virage, palpitation).
  it('pose le corail après tous les voiles de l’écran', () => {
    const { moteur, appels } = monter()
    moteur.image(1000)
    const dernierVoile = appels.map(pleinEcran).lastIndexOf(true)
    const premierCorail = appels.findIndex((a) => a.fillStyle === CORAIL || a.strokeStyle === CORAIL)
    expect(dernierVoile).toBeGreaterThan(-1)
    expect(premierCorail).toBeGreaterThan(dernierVoile)
  })

  // Mutation : poser le corail sur la case où se tient l'avatar : pendant une marche, l'année
  // quittée garderait la jauge et la nouvelle année n'aurait pas son millésime.
  it('marque en corail l’année en cours, même quand l’avatar n’y est pas encore', () => {
    const { moteur, appels, cases } = monter()
    moteur.majEtat({ cases, anneeAvatar: 1897, tampons: [], tickets: [], roulotte: null })
    appels.length = 0
    moteur.image(1000)
    const premierCorail = appels.findIndex((a) => a.fillStyle === CORAIL || a.strokeStyle === CORAIL)
    const millesime = appels.slice(premierCorail).find((a) => a.nom === 'fillText')
    expect(millesime?.args[0]).toBe('1898')
  })

  // La lectrice (option A) : son année en cours que le Voyage suivi n'a pas encore ouverte se dessine
  // en attente (comme fermée, le pointillé or) : jamais le corail de l'année en cours, que le manège
  // de la page d'une décennie ne lui donne pas non plus (sa plaque terne : `dessin.test.ts`).
  // Mutation : la couche corail posée sur une année en attente.
  it('ne marque pas en corail une année en attente du Voyage suivi', () => {
    const { moteur, appels, cases } = monter()
    moteur.majEtat({ cases: cases.map((c) => (c.annee === 1898 ? { ...c, attente: true, jauge: null } : c)), anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null })
    moteur.image(1000)
    expect(appels.some((a) => a.fillStyle === CORAIL || a.strokeStyle === CORAIL)).toBe(false)
  })

  // Le jumeau, dans la vue d'ensemble : la marquise de l'année en cours est corail ; celle d'une année
  // en attente, comme une année fermée. Mutation : la marquise lue sur le seul état de la case.
  it.each([
    { attente: false, corail: true },
    { attente: true, corail: false },
  ])('la vue d’ensemble ne marque en corail que l’année en cours ouverte (attente : $attente)', ({ attente, corail }) => {
    const { moteur, appels, cases } = monter({ calme: true })
    moteur.majEtat({ cases: cases.map((c) => (c.annee === 1898 ? { ...c, attente, jauge: attente ? null : c.jauge } : c)), anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null })
    moteur.image(1000)
    moteur.basculerEnsemble(true)
    appels.length = 0
    moteur.image(1001)
    const millesimes = appels.filter((a) => a.nom === 'fillText' && a.args[0] === '1898')
    expect(millesimes.length).toBeGreaterThan(0)
    expect(millesimes.some((a) => a.fillStyle === CORAIL)).toBe(corail)
  })

  // Mutation : laisser avancer l'horloge quand le visiteur demande moins d'animations.
  it('fige l’image quand le visiteur demande moins d’animations', () => {
    const { moteur, appels } = monter({ calme: true })
    moteur.image(1000)
    const premiere = JSON.stringify(appels)
    appels.length = 0
    moteur.image(2600)
    expect(JSON.stringify(appels)).toBe(premiere)
    expect(vus.every((v) => !v.vivant)).toBe(true)
  })

  // Mutation : une dépendance à `t` quand `vivant` est faux dans un dessin porté (le pouls ou les
  // perforations d'une case, la roue ou les chevaux de la roulotte, la fumée, le faisceau, la
  // brume, le pointillé du parcouru). Le test d'à côté pose le calme avant la première image, à
  // `t` = 0 : il ne voit rien. Ici, l'horloge a tourné avant le calme, et l'image figée doit être
  // celle qu'aurait posée un calme demandé dès l'ouverture.
  it('fige la même image, à quelque instant que le visiteur demande moins d’animations', () => {
    const roulotte = { pseudo: 'theo', annee: 1896 }
    // Défilée de 300 px : la brume de 1898 (775) entre à l'écran, avec les cases qu'elle couvre.
    const tot = monter({ calme: true, roulotte, cielSage: true, affiches: true })
    tot.moteur.defiler(300)
    tot.moteur.image(1000)
    const tard = monter({ roulotte, cielSage: true, affiches: true })
    tard.moteur.defiler(300)
    for (let i = 0; i <= 40; i++) tard.moteur.image(1000 + i * 37)
    tard.moteur.reglerCalme(true)
    tard.appels.length = 0
    tard.moteur.image(9000)
    expect(tard.appels.length).toBeGreaterThan(100)
    expect(JSON.stringify(tard.appels)).toBe(JSON.stringify(tot.appels))
  })

  // Mutation : `getImageData` pour virer les affiches au sépia (la toile teintée lèverait en ligne).
  it('ne lit jamais les pixels d’une affiche', () => {
    const { moteur, toiles } = monter({ affiches: true })
    moteur.image(1000)
    const lectures = toiles.flat().filter((a) => ['getImageData', 'toDataURL', 'toBlob'].includes(a.nom))
    expect(toiles.flat().some((a) => a.nom === 'drawImage')).toBe(true)
    expect(lectures).toEqual([])
  })

  // Mutation : retirer la garde `y < -110 || y > H + 70` dessine les cent trente années à chaque image.
  it('ne dessine que les années à l’écran', () => {
    const { moteur, appels } = monter()
    moteur.defiler(0)
    moteur.image(1000)
    const ecrits = appels.filter((a) => a.nom === 'fillText').map((a) => a.args[0])
    expect(ecrits).toContain('1896')
    expect(ecrits).not.toContain('2026')
  })

  // Mutation : un `Map` sans borne à la place du `Lru`.
  it('ne garde pas plus de tuiles du sol que sa borne, même après toute la carte', () => {
    const { moteur } = monter()
    for (let y = 0; y < moteur.hauteur; y += 300) {
      moteur.defiler(y)
      moteur.image(1000 + y)
    }
    expect(moteur.tuilesEnMemoire).toBeLessThanOrEqual(MAX_TUILES)
  })

  // Mutation : `rappels.apercu` au toucher, ou la zone de la case oubliée.
  it('un toucher sur une case ouvre son année', () => {
    const { moteur, rappels } = monter()
    moteur.defiler(0)
    moteur.image(1000)
    const { x, y } = moteur.ecranDeLAnnee(1896)
    moteur.pointeur('bas', x, y, false)
    moteur.pointeur('haut', x, y, false)
    expect(rappels.toucherAnnee).toHaveBeenCalledWith(1896)
  })

  // Mutation : ne pas noter le changement d'état (`pops`) : la nacelle neuve ne pousse jamais.
  it('signale au monde l’année qui vient d’être quittée, pour que son monument grandisse', () => {
    const { moteur, cases: initiales } = monter()
    moteur.image(1000)
    const avant = vus[vus.length - 1]!.bati
    const cases = initiales.map((c) =>
      c.annee === 1898 ? { ...c, etat: 'passee' as const } : c.annee === 1899 ? { ...c, etat: 'encours' as const } : c,
    )
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null })
    moteur.image(1100)
    const apres = vus[vus.length - 1]!.bati
    expect(apres.n).toBe(avant.n + 1)
    expect(apres.nouvelle).toBe(3)
  })

  // Mutation : dater le changement d'état ou le clap de `this.t` quand l'horloge est figée : la case
  // qui pousse, « +1 nacelle » et le clap resteraient à leur premier instant, jamais à leur fin.
  it('pose d’emblée à leur état final l’année quittée et le clap, quand le visiteur demande moins d’animations', () => {
    const { moteur, appels, cases: initiales } = monter({ calme: true })
    moteur.image(1000)
    const cases = initiales.map((c) =>
      c.annee === 1898 ? { ...c, etat: 'passee' as const } : c.annee === 1899 ? { ...c, etat: 'encours' as const } : c,
    )
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    moteur.image(1100)
    const vue = vus[vus.length - 1]!
    expect(vue.bati.nouvelle).toBe(3)
    expect(vue.t - vue.bati.t0).toBeGreaterThan(2)
    appels.length = 0
    moteur.image(1200)
    const repos = JSON.stringify(appels)
    appels.length = 0
    moteur.claquer()
    moteur.image(1300)
    expect(JSON.stringify(appels)).toBe(repos)
  })

  // Mutation : ignorer `calme` dans `marcherVers` fait attendre une animation qui ne viendra pas.
  it('marche sans animer quand le visiteur demande moins d’animations', async () => {
    const { moteur, rappels } = monter({ calme: true })
    await moteur.marcher(1899)
    expect(rappels.defilerVers).toHaveBeenCalled()
  })

  // Mutation : `nuit: 0` dans `vueMonde`, ou l'heure du visiteur ignorée : la foire resterait de jour à minuit.
  it('donne au monde la nuit de l’heure du visiteur', () => {
    monter({ heure: 23 }).moteur.image(1000)
    expect(vus[vus.length - 1]!.nuit).toBe(1)
    monter({ heure: 12 }).moteur.image(1000)
    expect(vus[vus.length - 1]!.nuit).toBe(0)
  })

  // Mutation : garer la roulotte sur `anneeAvatar` au lieu de l'année du Voyage suivi ; ou traiter
  // son toucher après `if (this.calme) return`.
  it('gare la roulotte suivie juste avant l’année où son Voyage est rendu, et la touche', () => {
    const { moteur, rappels } = monter({ calme: true, roulotte: { pseudo: 'theo', annee: 1896 } })
    moteur.defiler(0)
    moteur.image(1000)
    const r = moteur.ecranDeLaRoulotte()!
    const theo = moteur.ecranDeLAnnee(1896)
    const moi = moteur.ecranDeLAnnee(1898)
    expect(Math.hypot(r.x - theo.x, r.y - theo.y)).toBeLessThan(60)
    expect(Math.hypot(r.x - moi.x, r.y - moi.y)).toBeGreaterThan(100)
    moteur.pointeur('bas', r.x, r.y - 8, false)
    moteur.pointeur('haut', r.x, r.y - 8, false)
    expect(rappels.roulotte).toHaveBeenCalled()
    expect(rappels.toucherAnnee).not.toHaveBeenCalled()
  })

  // Mutation : garer aussi la roulotte de qui mène son propre Voyage, ou la dire au monde quand elle est garée.
  it('laisse la roulotte au monde, sans la garer, pour qui mène son propre Voyage', () => {
    const { moteur } = monter({ roulotte: { pseudo: 'theo', annee: null } })
    moteur.image(1000)
    expect(moteur.ecranDeLaRoulotte()).toBeNull()
    expect(vus[vus.length - 1]!.roulotte).toBe('theo')
    monter({ roulotte: { pseudo: 'theo', annee: 1896 } }).moteur.image(1000)
    expect(vus[vus.length - 1]!.roulotte).toBeNull()
  })

  // Mutation : traiter la date après `if (this.calme) return` : elle ne s'ouvrirait plus pour qui
  // demande moins d'animations.
  it('un toucher sur une affichette ouvre sa date, même quand le visiteur demande moins d’animations', () => {
    const { moteur, rappels } = monter({ calme: true })
    // La caméra au bord de la section 1890 : un `y` d'écran est un `y` de la section.
    moteur.defiler(MARGE_HAUT)
    moteur.image(1000)
    moteur.pointeur('bas', DATE.x, DATE.y, false)
    moteur.pointeur('haut', DATE.x, DATE.y, false)
    expect(rappels.date).toHaveBeenCalledWith(DATE)
    expect(rappels.toucherAnnee).not.toHaveBeenCalled()
  })

  // Décision du propriétaire du 2 octobre 2026 : l'adieu lâche la visée d'un chantier, que l'adieu
  // d'avant laissait courir par oubli. Mutations : `this.visee = null` retiré de `prendreLaCamera`,
  // ou `prendreLaCamera()` retiré de `direAdieu` (la caméra posée au haut du monde repartirait vers
  // le chantier, image après image).
  it('l’adieu lâche la visée d’un chantier : la caméra posée au haut du monde n’en repart pas', () => {
    const { moteur, rappels, cases } = monter()
    moteur.image(1000)
    moteur.defiler(moteur.ecranDeLAnnee(1899).y - 350)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    for (let i = 1; i <= 3; i++) moteur.image(1000 + i * 50)
    // Le témoin : la visée courait bien, la caméra glissait vers le chantier.
    expect(vi.mocked(rappels.defilerVers).mock.calls.length).toBeGreaterThan(1)
    expect(rappels.defilerVers).not.toHaveBeenLastCalledWith(MARGE_HAUT)
    vi.mocked(rappels.defilerVers).mockClear()
    void moteur.direAdieu(1890)
    for (let i = 4; i <= 40; i++) moteur.image(1000 + i * 50)
    expect(vi.mocked(rappels.defilerVers).mock.calls).toEqual([[MARGE_HAUT]])
  })

  // Mutation : un adieu qui ne se résout jamais, ou `adieu: -1` toujours dans `vueMonde`.
  it('dit adieu au monde quitté : il en reçoit le temps écoulé, puis la carte reprend', async () => {
    const { moteur, rappels } = monter()
    let fini = false
    const adieu = moteur.direAdieu(1890).then(() => void (fini = true))
    expect(rappels.defilerVers).toHaveBeenLastCalledWith(MARGE_HAUT)
    for (let i = 0; i < 30; i++) moteur.image(1000 + i * 50)
    expect(vus[vus.length - 1]!.adieu).toBeGreaterThan(1)
    await Promise.resolve()
    expect(fini).toBe(false)
    for (let i = 30; i < 50; i++) moteur.image(1000 + i * 50)
    await expect(adieu).resolves.toBeUndefined()
    expect(vus[vus.length - 1]!.adieu).toBe(-1)
  })

  // Mutation : ignorer `calme` dans `direAdieu` : l'horloge figée, la promesse n'arriverait jamais.
  it('ne joue pas l’adieu quand le visiteur demande moins d’animations', async () => {
    const { moteur, rappels } = monter({ calme: true })
    await expect(moteur.direAdieu(1890)).resolves.toBeUndefined()
    expect(rappels.defilerVers).not.toHaveBeenCalled()
  })

  // Mutation : `this.avatar.marche?.fin()` retiré de `marcherVers` : la marche remplacée ne rendrait
  // jamais sa promesse, et qui l'attend (l'avancée de la page) attendrait pour toujours.
  it('une marche qui en remplace une autre libère qui attendait la première, et court seule jusqu’au bout', async () => {
    const { moteur } = monter()
    const finies: string[] = []
    void moteur.marcher(1899).then(() => void finies.push('première'))
    moteur.image(1000)
    void moteur.passerLaPorte().then(() => void finies.push('porte'))
    await Promise.resolve()
    expect(finies).toEqual(['première'])
    void moteur.marcher(1899).then(() => void finies.push('seconde'))
    await Promise.resolve()
    expect(finies).toEqual(['première', 'porte'])
    // La dernière n'est pas libérée d'avance : elle marche, et n'arrive qu'aux images.
    for (let t = 1016; t < 8000; t += 16) moteur.image(t)
    await Promise.resolve()
    expect(finies).toEqual(['première', 'porte', 'seconde'])
  })

  // Mutation : `reglerCalme` sans `achever()` : l'horloge figée, la marche en cours ne finirait jamais.
  it('achève la marche en cours quand le visiteur demande moins d’animations en chemin', async () => {
    const { moteur } = monter()
    const marche = moteur.marcher(1899)
    moteur.image(1000)
    moteur.reglerCalme(true)
    await expect(marche).resolves.toBeUndefined()
  })

  // Mutation : dessiner la colonne sans regarder `palette.colonne` : un monde sans colonne chargerait des affiches pour rien.
  it('ne demande aucune affiche à un monde sans colonne', () => {
    const { moteur, toiles } = monter({ affiches: true, sansColonne: true })
    moteur.image(1000)
    expect(toiles.flat().filter((a) => a.nom === 'drawImage')).toEqual([])
  })

  // Idée 8. Mutations : dater aussi le premier `majEtat` (la foire se rebâtirait à
  // chaque ouverture de la carte) ; l'année ouverte prise de la case `encours` (elle se bâtirait
  // pendant la marche qui y mène) ; `!==` au lieu de `>` (un recul rebâtirait).
  it('donne au monde l’année où l’avatar arrive, datée de son arrivée, jamais de l’ouverture de la carte', () => {
    const { moteur, cases: initiales } = monter()
    moteur.image(1000)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
    // La carte relue après l'encaissement : 1899 est en cours, l'avatar n'a pas encore marché.
    const cases = initiales.map((c) =>
      c.annee === 1898 ? { ...c, etat: 'passee' as const } : c.annee === 1899 ? { ...c, etat: 'encours' as const } : c,
    )
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null })
    moteur.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
    // La marche finie, la page avance l'avatar.
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    moteur.image(1200)
    const { ouverte, t } = vus[vus.length - 1]!
    expect(ouverte.annee).toBe(1899)
    expect(ouverte.t0).toBeGreaterThan(0)
    expect(t - ouverte.t0).toBeLessThan(0.2)
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null })
    moteur.image(1300)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
  })

  // Idée 8. Mutation : `this.t` au lieu de `this.instant()` : tant que l'horloge
  // est figée, `chantier` pose tout bâti (`vivant` faux) ; mais l'année ouverte serait datée, et son
  // chantier se jouerait au retour des animations, pour une arrivée que personne n'a vue.
  it('pose l’année ouverte déjà bâtie quand le visiteur demande moins d’animations', () => {
    const { moteur, cases } = monter({ calme: true })
    moteur.image(1000)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    moteur.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1899, t0: -9 })
  })

  // Idée 8. Mutations : `brume: this.fogY`, sans le `- s.y0` de la section ; `brume: 0`.
  it('donne à chaque monde le haut de la brume, dans son repère', () => {
    const { moteur } = monter()
    moteur.defiler(MARGE_HAUT)
    moteur.image(1000)
    // La caméra au bord de la section 1890 : un `y` d'écran est un `y` de la carte, moins le vide du haut.
    const y1898 = moteur.ecranDeLAnnee(1898).y
    const y1900 = moteur.ecranDeLAnnee(1900).y
    expect(vus.find((v) => v.cases.some((c) => c.annee === 1898))!.brume).toBeCloseTo(y1898 + 95, 0)
    vus.length = 0
    moteur.defiler(y1900 - 350)
    moteur.image(1100)
    expect(vus.find((v) => v.cases.some((c) => c.annee === 1900))!.brume).toBeLessThan(0)
  })

  // Plan 3a. Mutation : `avance: this.camY`, sans le `- s.y0` de la section (1890 commence à
  // `MARGE_HAUT`, pas à 0 : le défilement seul n'est l'avance d'aucun monde).
  it('donne à chaque monde son avance : le défilement moins le haut de sa section', () => {
    const { moteur } = monter()
    // Le haut de 1900 : le vide du haut de la carte, puis la section 1890 du monde d'essai (cinq années).
    const haut1900 = MARGE_HAUT + mondeAVenir(1890).trace([1895, 1896, 1897, 1898, 1899]).hauteur
    const vueDe = (annee: number) => vus.find((v) => v.cases.some((c) => c.annee === annee))!
    vus.length = 0
    moteur.defiler(300)
    moteur.image(1100)
    expect(vueDe(1898).avance).toBe(300 - MARGE_HAUT)
    // À la frontière, les deux mondes à l'écran : chacun compte depuis le haut de sa section, et
    // celui d'en bas, que la caméra n'a pas atteint, est en négatif.
    vus.length = 0
    moteur.defiler(haut1900 - 350)
    moteur.image(1200)
    expect(vueDe(1898).avance).toBe(haut1900 - 350 - MARGE_HAUT)
    expect(vueDe(1900).avance).toBe(-350)
  })

  // Plan 3a. Mutation : `entree: 0` dans `vueMonde` : le monde jouerait son entrée dès qu'il est à
  // l'écran, sans qu'aucun passage n'ait commencé.
  it('dit au monde qu’aucun passage d’entrée ne se joue : ni au repos, ni en marche, ni pendant un adieu', () => {
    const { moteur } = monter()
    moteur.image(1000)
    void moteur.marcher(1899)
    moteur.image(1050)
    void moteur.direAdieu(1890)
    moteur.image(1100)
    expect(vus[vus.length - 1]!.adieu).toBeGreaterThanOrEqual(0)
    expect(vus.length).toBeGreaterThan(2)
    expect(vus.map((v) => v.entree)).toEqual(vus.map(() => -1))
  })

  // Idée 8. Mutations : `dessinerSurLaBrume` appelé avec les plans proches, sous la
  // brume et la roulotte ; jamais appelé ; appelé après les voiles.
  it('laisse le monde dessiner par-dessus la brume et la roulotte garée, sous les voiles', () => {
    const { moteur, appels } = monter({ calme: true, roulotte: { pseudo: 'theo', annee: 1896 } })
    moteur.defiler(0)
    moteur.image(1000)
    const ecrit = (s: string) => appels.findIndex((a) => a.nom === 'fillText' && a.args[0] === s)
    const plaque = ecrit('theo est rendu en 1896')
    const surLaBrume = ecrit('sur la brume')
    expect(plaque).toBeGreaterThan(-1)
    expect(surLaBrume).toBeGreaterThan(plaque)
    expect(appels.map(pleinEcran).lastIndexOf(true)).toBeGreaterThan(surLaBrume)
  })

  // Idée 8, relecture du 29 au soir. Mutations : `ouvrirSousLesYeux` sans effet ;
  // sans la garde `annee !== this.etat.anneeAvatar` (la page ouvrirait une année où l'avatar n'est
  // pas) ; `this.t` au lieu de `this.instant()` (la séance se jouerait au retour des animations).
  it('ouvre sous les yeux l’année où se tient l’avatar quand la page le demande, et elle seule', () => {
    const { moteur } = monter()
    moteur.image(1000)
    moteur.ouvrirSousLesYeux(1899)
    moteur.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
    moteur.ouvrirSousLesYeux(1898)
    moteur.image(1200)
    const { ouverte, t } = vus[vus.length - 1]!
    expect(ouverte.annee).toBe(1898)
    expect(ouverte.t0).toBeGreaterThan(0)
    expect(t - ouverte.t0).toBeLessThan(0.2)
    const calme = monter({ calme: true }).moteur
    calme.image(1000)
    calme.ouvrirSousLesYeux(1898)
    calme.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
  })

  // Idée 8, relecture du 29 au soir. Mutations : `achever` qui pose aussi l'année
  // ouverte finie (`this.ouverte = { …, t0: -9 }`, le jumeau de la marche et de l'adieu) ;
  // `reglerCalme(false)` qui la redate.
  it('reprend un chantier interrompu là où il en était quand les animations reviennent', () => {
    const { moteur, cases } = monter()
    moteur.image(1000)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    moteur.image(1100)
    // Une copie : la vue porte l'objet du moteur, qu'un redatage en place changerait sous nos yeux.
    const avant = { ...vus[vus.length - 1]!.ouverte }
    expect(avant.t0).toBeGreaterThan(0)
    moteur.reglerCalme(true)
    moteur.image(1200)
    moteur.reglerCalme(false)
    moteur.image(1300)
    expect(vus[vus.length - 1]!.ouverte).toEqual(avant)
  })

  // Idée 8, relecture du 29 au soir. Mutations : `montrerChantier` retiré de
  // `majEtat` (la caméra resterait sur l'avatar) ; `achever` qui laisse la caméra glisser quand le
  // visiteur demande moins d'animations en chemin.
  it('va chercher un chantier qui commence hors de l’écran, et s’y pose d’un coup si le visiteur demande moins d’animations en chemin', () => {
    const { moteur, rappels, cases } = monter()
    moteur.image(1000)
    // La caméra à 0, un `y` d'écran est un `y` de la carte ; puis posée sur 1899.
    const y1899 = moteur.ecranDeLAnnee(1899).y
    moteur.defiler(y1899 - 350)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    for (let i = 1; i <= 3; i++) moteur.image(1000 + i * 50)
    const vers = () => vi.mocked(rappels.defilerVers).mock.calls.map(([y]) => y)
    expect(vers().length).toBeGreaterThan(0)
    expect(vers()[vers().length - 1]!).toBeLessThan(y1899 - 350)
    // La cible : le site au milieu de l'écran, bornée au haut de la carte.
    const cible = Math.max(0, MARGE_HAUT + SITE_1899 - H / 2)
    moteur.reglerCalme(true)
    expect(rappels.defilerVers).toHaveBeenLastCalledWith(cible)
    const n = vers().length
    for (let i = 4; i <= 8; i++) moteur.image(1000 + i * 50)
    expect(vers().length).toBe(n)
  })

  // Idée 8, relecture du 29 au soir. Mutation : `this.suivre = false` retiré de
  // `montrerChantier` : la caméra, tirée vers l'avatar et vers le chantier, s'arrêterait entre les deux.
  it('détourne vers le chantier la caméra qui suivait l’avatar', () => {
    const { moteur, rappels, cases } = monter()
    moteur.image(1000)
    moteur.defiler(moteur.ecranDeLAnnee(1899).y - 350)
    // « Tu es ici » sans `instant` : la caméra suit l'avatar, comme au bout d'une marche.
    moteur.allerIci()
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    for (let i = 1; i <= 60; i++) moteur.image(1000 + i * 50)
    const vers = vi.mocked(rappels.defilerVers).mock.calls.map(([y]) => y)
    // Le site de 1899 (haut de sa section) au milieu de l'écran, et non la case de 1899, 850 px plus bas.
    expect(vers[vers.length - 1]!).toBeLessThan(MARGE_HAUT + SITE_1899 - H / 2 + 2)
  })

  // Idée 8, relecture du 29 au soir. Mutations : la garde des 60 px retirée (la
  // caméra partirait vers un chantier déjà à l'écran) ; la garde `ouverte.t0 < 0` retirée (elle
  // partirait vers une année posée bâtie, en « moins d'animations » comme à l'ouverture de la carte).
  it('ne bouge pas la caméra pour un chantier déjà à l’écran, ni pour une année posée bâtie', () => {
    const vu = monter()
    vu.moteur.defiler(0)
    vu.moteur.image(1000)
    vu.moteur.majEtat({ cases: vu.cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    for (let i = 1; i <= 8; i++) vu.moteur.image(1000 + i * 50)
    expect(vu.rappels.defilerVers).not.toHaveBeenCalled()
    const calme = monter({ calme: true })
    calme.moteur.image(1000)
    calme.moteur.defiler(calme.moteur.ecranDeLAnnee(1899).y - 350)
    calme.moteur.majEtat({ cases: calme.cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
    for (let i = 1; i <= 8; i++) calme.moteur.image(1000 + i * 50)
    expect(calme.rappels.defilerVers).not.toHaveBeenCalled()
  })

  // Relecture de la tâche 5 : les jumeaux de l'idée 8. Mutations : `montrerChantier` retiré
  // d'`ouvrirSousLesYeux` (le jumeau de celui de `majEtat`) ; la marge de 60 px ramenée à 0 ou
  // portée à 100 ; la moitié basse de la garde retirée (un chantier sous l'écran) ; `site === null`
  // retiré de la garde (un monde qui ne bâtit rien enverrait la caméra en haut de sa section).
  it('va chercher le chantier ouvert sous les yeux à moins de 60 px d’un bord, en haut comme en bas, jamais pour un monde qui ne bâtit rien', () => {
    const camera = 100
    const bouge = (site: number | null) => {
      // `site` est un `y` de la carte ; le monde d'essai le compte depuis le haut de sa section.
      const { moteur, rappels } = monter({ chantier1898: site === null ? null : site - MARGE_HAUT })
      moteur.defiler(camera)
      moteur.image(1000)
      vi.mocked(rappels.defilerVers).mockClear()
      moteur.ouvrirSousLesYeux(1898)
      for (let i = 1; i <= 3; i++) moteur.image(1000 + i * 50)
      return vi.mocked(rappels.defilerVers).mock.calls.length > 0
    }
    expect(bouge(camera + 30)).toBe(true)
    expect(bouge(camera + 90)).toBe(false)
    expect(bouge(camera + H - 90)).toBe(false)
    expect(bouge(camera + H - 30)).toBe(true)
    expect(bouge(null)).toBe(false)
  })

  // Relecture de la tâche 5. Mutation : `duree <= 0` retiré de la garde de `direAdieu` : la caméra
  // remonterait en haut d'une section dont le monde n'a aucune cinématique à montrer.
  it('ne remonte pas la caméra pour un monde qui n’a pas d’adieu', async () => {
    const { moteur, rappels } = monter()
    const adieu = moteur.direAdieu(1900)
    expect(rappels.defilerVers).not.toHaveBeenCalled()
    moteur.image(1000)
    await expect(adieu).resolves.toBeUndefined()
  })

  // Relecture de la tâche 5. Mutation : `if (this.calme) return` retiré de `toucher` : le monde
  // réagirait sous une horloge figée, et sa réaction resterait à son premier instant.
  it('ne fait pas réagir le décor quand le visiteur demande moins d’animations', () => {
    const toucherLeManege = (calme: boolean) => {
      const { moteur } = monter({ calme })
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      moteur.pointeur('bas', MANEGE.x, MANEGE.y, false)
      moteur.pointeur('haut', MANEGE.x, MANEGE.y, false)
      return [...reactions]
    }
    expect(toucherLeManege(false)).toEqual(['manege'])
    expect(toucherLeManege(true)).toEqual([])
  })

  // Relecture de la tâche 5. Mutations : la garde `this.calme` retirée d'`etincelles`, de
  // `confettis` ou de `fumee` dans `vueMonde` : sous l'horloge figée, les particules demandées à
  // chaque image s'entasseraient, immobiles.
  it('ne lance aucune particule quand le visiteur demande moins d’animations, même si le monde en demande', () => {
    const { moteur, appels } = monter({ calme: true, particules: true })
    moteur.image(1000)
    const premiere = JSON.stringify(appels)
    appels.length = 0
    moteur.image(2600)
    expect(JSON.stringify(appels)).toBe(premiere)
  })

  // Relecture de la tâche 5. Mutations : `if (this.calme) this.ens.q = 1` retiré
  // d'`entrerEnsemble`, ou `= 0` de `quitterEnsemble` : la vue d'ensemble glisserait.
  it('ouvre et ferme la vue d’ensemble d’un coup quand le visiteur demande moins d’animations', () => {
    const { moteur } = monter({ calme: true })
    moteur.image(1000)
    moteur.basculerEnsemble(true)
    vus.length = 0
    moteur.image(1001)
    // La vue d'ensemble ouverte en entier, la scène des mondes n'est plus dessinée.
    expect(vus).toEqual([])
    moteur.basculerEnsemble(false)
    moteur.image(1002)
    expect(vus.length).toBeGreaterThan(0)
  })

  // Relecture de la tâche 5. Mutation : `|| this.calme` retiré d'`allerIci` : la caméra glisserait vers l'avatar.
  it('ramène la caméra sur l’avatar d’un coup quand le visiteur demande moins d’animations', () => {
    const { moteur, rappels } = monter({ calme: true })
    moteur.defiler(5000)
    moteur.allerIci()
    expect(rappels.defilerVers).toHaveBeenCalledTimes(1)
    for (let i = 1; i <= 5; i++) moteur.image(1000 + i * 50)
    expect(rappels.defilerVers).toHaveBeenCalledTimes(1)
  })

  // Relecture de la tâche 5. Mutations : `this.calme ? 1 :` retiré de `roulotteGaree` (une descente
  // en cours resterait en chemin sous l'horloge figée) ; `roulotteT0` daté de `this.t` au lieu
  // d'`instant()` (garée en « moins d'animations », elle redescendrait au retour des animations).
  it('gare d’un coup la roulotte quand le visiteur demande moins d’animations, et l’y laisse quand elles reviennent', () => {
    const roulotte = { pseudo: 'theo', annee: 1896 }
    const garee = (moteur: MoteurCarte) => {
      const r = moteur.ecranDeLaRoulotte()!
      const c = moteur.ecranDeLAnnee(1896)
      return Math.hypot(r.x - c.x, r.y - c.y) < 60
    }
    const enChemin = monter({ roulotte }).moteur
    enChemin.defiler(0)
    enChemin.image(1000)
    expect(garee(enChemin)).toBe(false)
    enChemin.reglerCalme(true)
    enChemin.image(1050)
    expect(garee(enChemin)).toBe(true)
    const deja = monter({ calme: true, roulotte }).moteur
    deja.defiler(0)
    deja.image(1000)
    deja.reglerCalme(false)
    deja.image(1050)
    expect(garee(deja)).toBe(true)
  })

  // Relecture de la tâche 5. Mutation : `this.fogY = this.fogCible` retiré d'`achever` (le jumeau
  // de la marche sans animation) : la brume, arrêtée en chemin, ne se lèverait plus jusqu'à l'année atteinte.
  it('lève la brume jusqu’à l’année atteinte quand la marche s’achève en chemin', async () => {
    const { moteur } = monter()
    const marche = moteur.marcher(1899)
    moteur.image(1000)
    moteur.reglerCalme(true)
    await marche
    moteur.image(1050)
    const lesVues = vus.filter((x) => x.cases.some((c) => c.annee === 1899))
    const v = lesVues[lesVues.length - 1]!
    const case1899 = v.cases.find((c) => c.annee === 1899)!
    // `ecranY(0, 1)` est le haut de la section à l'écran : la case, dans le repère de la section.
    expect(v.brume).toBeCloseTo(case1899.y - v.ecranY(0, 1) + 95, 0)
  })

  // Relecture de la tâche 5. Mutation : `else this.tuiles.clear()` retiré de `majEtat` : une carte
  // relue garderait le sol d'avant, dont les photogrammes allumés dépendent des profondeurs.
  it('redessine le sol quand la carte relue change, même sans nouvelle année', () => {
    const { moteur, toiles, cases } = monter()
    moteur.image(1000)
    const avant = toiles.length
    const relues = cases.map((c) => (c.annee === 1898 ? { ...c, profondeur: 5 } : c))
    moteur.majEtat({ cases: relues, anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null })
    moteur.image(1100)
    expect(toiles.length).toBeGreaterThan(avant)
  })

  // Relecture de la tâche 5. Mutation : `detruire` sans `annulerImage` : la boucle d'une carte
  // démontée continuerait de tourner.
  it('arrête sa boucle quand la carte est démontée', () => {
    const { moteur, deps } = monter()
    moteur.detruire()
    expect(deps.annulerImage).toHaveBeenCalledWith(1)
  })

  describe('la section collante (plan 3a)', () => {
    type Options = NonNullable<Parameters<typeof monter>[0]>
    /** Le membre a pris le train : 1890 quittée, `enCours` en cours (1900 sans autre mot), l'avatar dessus. Collant, sauf pour le témoin. */
    const auTrain = (options: Options & { enCours?: number } = {}) => {
      const enCours = options.enCours ?? 1900
      const banc = monter({ collant: true, ...options })
      const cases = banc.cases.map((c): CaseCarte =>
        c.annee < enCours ? { ...c, etat: 'lion', profondeur: 30, jauge: null } : c.annee === enCours ? { ...c, etat: 'encours', profondeur: 30, jauge: { vus: 3, total: 5 } } : c,
      )
      banc.moteur.majEtat({ cases, anneeAvatar: enCours, tampons: [], tickets: [], roulotte: banc.roulotte })
      return { ...banc, cases }
    }
    /** Le haut de 1900 à cent pixels du haut de l'écran : le bas de 1890 et quatre années de 1900 y tiennent. */
    const CAMERA = HAUT_1900 - 100
    const toucher = (moteur: MoteurCarte, x: number, y: number) => {
      moteur.pointeur('bas', x, y, false)
      moteur.pointeur('haut', x, y, false)
    }
    /** Où le tracé pose la case de `annee`, à l'écran, à la dernière image : là où le moteur la dessinait. */
    const anciennePlace = (annee: number) => {
      const c = vus.flatMap((v) => v.cases).filter((x) => x.annee === annee).pop()!
      return { x: c.x, y: c.y }
    }
    /**
     * Ce que la coupe en vigueur à l'appel `i` laisse voir de la ligne `y` (dans le repère où la
     * coupe a été posée) : vrai sans coupe, ou si l'un de ses rectangles tient la ligne. Rejoue
     * `save`, `restore`, `beginPath`, `rect` et `clip`.
     */
    const visible = (appels: Appel[], i: number, y: number): boolean => {
      let coupe: number[][] | null = null
      let chemin: number[][] = []
      const pile: Array<number[][] | null> = []
      for (const a of appels.slice(0, i)) {
        if (a.nom === 'save') pile.push(coupe)
        else if (a.nom === 'restore') coupe = pile.pop() ?? null
        else if (a.nom === 'beginPath') chemin = []
        else if (a.nom === 'rect') chemin.push(a.args as number[])
        else if (a.nom === 'clip') coupe = chemin
      }
      return coupe === null || coupe.some(([, ry, , rh]) => y >= ry! && y < ry! + rh!)
    }
    /** Les lignes d'une section collante de 1900 à sonder, depuis `haut` : la première, la suivante, le milieu, la dernière. */
    const lignesDe1900 = (haut: number) => {
      const hauteur = mondeAVenir(1900).trace([1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909]).hauteur
      return [haut, haut + 1, haut + hauteur / 2, haut + hauteur - 1]
    }
    const estUnPhotogramme = (a: Appel) => a.nom === 'fillRect' && a.composite === 'lighter'
    /** Le `y` de carte de chaque photogramme allumé pour le monde collant, dans une tuile : son `translate`. */
    const photogrammesDuCollant = (tuile: Appel[]) =>
      tuile.flatMap((a, i) =>
        estUnPhotogramme(a) && String(a.fillStyle).startsWith('collant(#FFDEA0') ? [tuile.slice(0, i).filter((b) => b.nom === 'translate').pop()!.args[1] as number] : [],
      )
    const ecrits = (appels: Appel[]) => appels.filter((a) => a.nom === 'fillText').map((a) => a.args[0])
    const AVATAR = '#231e19'
    const estLaPoussiere = (a: Appel) => String(a.fillStyle).startsWith('rgba(255,242,218')
    const estLaBrume = (a: Appel) => a.nom === 'fillRect' && a.args[0] === -8 && (a.fillStyle as { arrets?: unknown[] }).arrets?.length === 3

    // Revue du lot 2 (I1). Mutation : la ligne `attente` retirée des `cases` de `vueMonde` : le monde ne
    // saurait plus qu'une année attend le Voyage suivi, et montrerait sa gare ouverte.
    it('dit au monde quelles années attendent le Voyage suivi', () => {
      const banc = auTrain({ calme: true, enCours: 1902 })
      banc.moteur.majEtat({ cases: banc.cases.map((c) => (c.annee === 1902 ? { ...c, attente: true } : c)), anneeAvatar: 1902, tampons: [], tickets: [], roulotte: null })
      banc.moteur.defiler(CAMERA)
      vus.length = 0
      banc.moteur.image(1000)
      const lues = vus.find((v) => v.cases.some((c) => c.annee === 1902))!.cases
      expect(lues.filter((c) => c.annee >= 1900 && c.annee <= 1903).map((c) => [c.annee, c.etat, c.attente])).toEqual([
        [1900, 'lion', false],
        [1901, 'lion', false],
        [1902, 'encours', true],
        [1903, 'verrou', false],
      ])
    })

    // Idée 72. Mutations : la ligne `affiches` retirée des `cases` de `vueMonde` (le monde ne connaît
    // plus aucune adresse) ; une liste vide rendue à toutes ; la seule première adresse rendue.
    it('dit au monde les affiches de chaque année, dans l’ordre de la page, et une liste vide sans affiche', () => {
      const banc = auTrain({ calme: true, enCours: 1902 })
      const affiches = new Map([[1900, ['/covers/thumb/a.webp', '/covers/thumb/b.webp']], [1901, ['/covers/thumb/c.webp']]])
      banc.moteur.majEtat({ cases: banc.cases.map((c) => ({ ...c, affiches: affiches.get(c.annee) ?? [] })), anneeAvatar: 1902, tampons: [], tickets: [], roulotte: null })
      banc.moteur.defiler(CAMERA)
      vus.length = 0
      banc.moteur.image(1000)
      const lues = vus.find((v) => v.cases.some((c) => c.annee === 1902))!.cases
      expect(lues.filter((c) => c.annee >= 1900 && c.annee <= 1902).map((c) => [c.annee, c.affiches])).toEqual([
        [1900, ['/covers/thumb/a.webp', '/covers/thumb/b.webp']],
        [1901, ['/covers/thumb/c.webp']],
        [1902, []],
      ])
    })

    // Mutations : la garde retirée autour de `dessinerCase` (les cases communes de 1901 et 1902
    // reviennent) ; la garde retirée autour de l'avatar, de sa zone `clap` ou de sa lumière.
    it('n’y dessine ni case commune, ni avatar, ni lumière, et n’y inscrit pas la zone du clap', () => {
      const jouer = (collant: boolean) => {
        const banc = auTrain({ calme: true, collant })
        banc.moteur.defiler(CAMERA)
        banc.moteur.image(1000)
        const avatar = anciennePlace(1900)
        toucher(banc.moteur, avatar.x, avatar.y - 16)
        return banc
      }
      // Le témoin : la même carte sans section collante dessine tout cela, là où on le cherche.
      const temoin = jouer(false)
      expect(ecrits(temoin.appels)).toEqual(expect.arrayContaining(['1901', '1902']))
      expect(temoin.appels.some((a) => a.fillStyle === AVATAR)).toBe(true)
      expect(temoin.appels.some(estLaPoussiere)).toBe(true)
      expect(temoin.rappels.clap).toHaveBeenCalledTimes(1)
      const collant = jouer(true)
      expect(ecrits(collant.appels)).not.toContain('1901')
      expect(ecrits(collant.appels)).not.toContain('1902')
      expect(collant.appels.filter((a) => String(a.fillStyle).startsWith('collant(') || String(a.strokeStyle).startsWith('collant('))).toEqual([])
      expect(collant.appels.some((a) => a.fillStyle === AVATAR)).toBe(false)
      expect(collant.appels.some(estLaPoussiere)).toBe(false)
      expect(collant.rappels.clap).not.toHaveBeenCalled()
    })

    // Mutation : la coupe retirée de `dessinerSol` (la route et les photogrammes descendent dans la
    // section collante) ; les bandes de la coupe décalées d'un pixel, vers le haut ou vers le bas.
    it('coupe net la route et les photogrammes au haut de la section, dans les tuiles', () => {
      const { moteur, toiles } = auTrain({ calme: true })
      moteur.defiler(CAMERA)
      moteur.image(1000)
      // Une tranche plus haut : celle d'en dessous, entièrement dans la section collante, n'a pas de tuile (plan 3b).
      moteur.defiler(CAMERA - TUILE)
      moteur.image(1040)
      const tuiles = toiles.filter((t) => t.some((a) => a.nom === 'stroke'))
      expect(tuiles.length).toBeGreaterThan(1)
      for (const tuile of tuiles) {
        const dessins = tuile.flatMap((a, i) => (a.nom === 'stroke' || a.nom === 'fillRect' ? [i] : []))
        expect(dessins.length).toBeGreaterThan(5)
        for (const i of dessins) {
          for (const y of lignesDe1900(HAUT_1900)) expect(visible(tuile, i, y), `${tuile[i]!.nom} à ${y}`).toBe(false)
          // Rien n'est sauté au-dessus, ni sous la section : la dernière ligne de 1890, la première de 1910.
          expect(visible(tuile, i, HAUT_1900 - 1)).toBe(true)
          expect(visible(tuile, i, lignesDe1900(HAUT_1900)[3]! + 1)).toBe(true)
        }
      }
    })

    // Mutation : la case d'une section collante sautée dans `dessinerSol` : les photogrammes qui
    // mènent à 1900 s'éteindraient dès la case de 1899, dans la section d'avant.
    it('laisse allumés, au-dessus de la coupe, les photogrammes qui mènent à la première année de la section', () => {
      const { moteur, toiles } = auTrain({ calme: true })
      moteur.defiler(CAMERA)
      moteur.image(1000)
      const ys = toiles.flatMap(photogrammesDuCollant)
      const case1899 = anciennePlace(1899).y + CAMERA
      const audessus = ys.filter((y) => y > case1899 && y < HAUT_1900)
      expect(audessus.length).toBeGreaterThan(3)
    })

    // Mutation : la coupe retirée de `Effets.parcouru` (décision 2 : le chemin parcouru est du sol).
    it('coupe net le chemin parcouru au haut de la section', () => {
      const { moteur, appels } = auTrain({ calme: true })
      moteur.defiler(CAMERA)
      moteur.image(1000)
      const traits = appels.flatMap((a, i) => (a.nom === 'stroke' && (a.strokeStyle === '#F2CB6A' || a.strokeStyle === 'rgba(230,185,74,.1)') ? [i] : []))
      expect(traits).toHaveLength(2)
      for (const i of traits) {
        for (const y of lignesDe1900(HAUT_1900 - CAMERA)) expect(visible(appels, i, y), `à ${y}`).toBe(false)
        expect(visible(appels, i, HAUT_1900 - CAMERA - 1)).toBe(true)
      }
      // La coupe ne déborde pas du chemin parcouru : la suite de l'image n'est pas coupée.
      expect(visible(appels, appels.length, HAUT_1900 - CAMERA)).toBe(true)
    })

    // Mutation : la garde retirée autour de `brouillard`. Le membre est encore en 1898 : la brume de
    // l'avenir couvre tout l'écran sous lui, et s'arrête au haut de 1900.
    it('ne pose pas la brume de l’avenir sur la section', () => {
      const { moteur, appels } = monter({ calme: true, collant: true })
      moteur.defiler(CAMERA)
      moteur.image(1000)
      const brume = appels.findIndex(estLaBrume)
      expect(brume).toBeGreaterThan(-1)
      for (const y of lignesDe1900(HAUT_1900 - CAMERA)) expect(visible(appels, brume, y), `à ${y}`).toBe(false)
      expect(visible(appels, brume, HAUT_1900 - CAMERA - 1)).toBe(true)
      // Ses volutes non plus, et la coupe se referme avant la suite de l'image.
      const volutes = appels.flatMap((a, i) => (a.nom === 'arc' && i > brume && i < brume + 60 && a.args[2] === 60 ? [i] : []))
      expect(volutes).toHaveLength(4)
      for (const i of volutes) expect(visible(appels, i, HAUT_1900 - CAMERA)).toBe(false)
      expect(visible(appels, appels.length, HAUT_1900 - CAMERA)).toBe(true)
    })

    // Mutations : la zone `case` inscrite à `c.x`, `c.y` (l'ancienne place) ; inscrite aussi pour une
    // année que le monde dit hors de vue.
    it('ouvre l’année au point que le monde rend, plus à l’ancienne place de la case', () => {
      const { moteur, rappels } = auTrain({ calme: true })
      moteur.defiler(CAMERA)
      moteur.image(1000)
      for (const annee of [1901, 1902]) {
        const ancienne = anciennePlace(annee)
        expect(ancienne.y).toBeGreaterThan(0)
        expect(ancienne.y).toBeLessThan(H)
        expect(Math.hypot(ancienne.x - quai(annee)!.x, ancienne.y - quai(annee)!.y)).toBeGreaterThan(80)
        toucher(moteur, ancienne.x, ancienne.y - 4)
      }
      expect(rappels.toucherAnnee).not.toHaveBeenCalled()
      toucher(moteur, quai(1902)!.x, quai(1902)!.y)
      expect(rappels.toucherAnnee).toHaveBeenCalledTimes(1)
      expect(rappels.toucherAnnee).toHaveBeenLastCalledWith(1902)
      // 1905 est hors de vue pour le monde : aucune zone, où que le tracé la pose.
      moteur.defiler(HAUT_1900 + 600)
      moteur.image(1050)
      const ancienne1905 = anciennePlace(1905)
      expect(ancienne1905.y).toBeGreaterThan(0)
      expect(ancienne1905.y).toBeLessThan(H)
      toucher(moteur, ancienne1905.x, ancienne1905.y - 4)
      expect(rappels.toucherAnnee).toHaveBeenCalledTimes(1)
    })

    // Mutations : `ecranDeLAnnee` resté sur le tracé (l'aperçu s'ancrerait à l'ancienne place) ; le
    // milieu de l'écran non rendu pour une année hors de vue.
    it('ancre l’aperçu au point que le monde rend, au milieu de l’écran pour une année hors de vue', () => {
      const { moteur } = auTrain({ calme: true })
      moteur.defiler(CAMERA)
      moteur.image(1000)
      expect(moteur.ecranDeLAnnee(1902)).toEqual(quai(1902))
      expect(moteur.ecranDeLAnnee(1905)).toEqual({ x: W / 2, y: H / 2 })
      // 1890 reste sur son tracé.
      expect(moteur.ecranDeLAnnee(1899)).toEqual(anciennePlace(1899))
    })

    // Mutations : le corail posé à `place.x`, `place.y` (l'ancienne place) ; posé là quand le monde
    // dit l'année hors de vue ; posé avant les voiles.
    it('pose le corail de l’année en cours au point du monde, après tous les voiles, et nulle part si elle est hors de vue', () => {
      const { moteur, appels } = auTrain({ calme: true })
      moteur.defiler(CAMERA)
      moteur.image(1000)
      const premierCorail = appels.findIndex((a) => a.fillStyle === CORAIL || a.strokeStyle === CORAIL)
      expect(premierCorail).toBeGreaterThan(appels.map(pleinEcran).lastIndexOf(true))
      // La jauge se dessine autour de (x, y + 1) : `dessinerCorail`.
      const ou = appels.slice(0, premierCorail).filter((a) => a.nom === 'translate').pop()!.args
      expect(ou).toEqual([quai(1900)!.x, quai(1900)!.y + 1])
      const millesime = appels.slice(premierCorail).find((a) => a.nom === 'fillText')
      expect(millesime?.args[0]).toBe('1900')
      const horsDeVue = auTrain({ calme: true, enCours: 1905 })
      horsDeVue.moteur.defiler(HAUT_1900 + 600)
      horsDeVue.moteur.image(1000)
      expect(horsDeVue.appels.length).toBeGreaterThan(100)
      expect(horsDeVue.appels.some((a) => a.fillStyle === CORAIL || a.strokeStyle === CORAIL)).toBe(false)
    })

    const vueDe = (annee: number) => vus.filter((v) => v.cases.some((c) => c.annee === annee)).pop()
    /** Une image à ce défilement : la présence donnée à chaque monde, et ce que l'ambiance reçoit. */
    const a = (banc: ReturnType<typeof monter>, camY: number) => {
      vus.length = 0
      banc.appels.length = 0
      banc.moteur.defiler(camY)
      banc.moteur.image(1000)
      const liste = vi.mocked(banc.rappels.presences).mock.lastCall![0]
      const ciel = banc.appels.find(pleinEcran)!.fillStyle as { arrets: Array<[number, string]> }
      const virages = banc.appels.filter((x) => pleinEcran(x) && String(x.fillStyle).startsWith('rgba(150,104,58,'))
      return {
        de1890: vueDe(1898)?.presence,
        de1900: vueDe(1900)?.presence,
        melange1890: liste.find((p) => p.musique === MUSIQUE)!.poids,
        melange1900: liste.find((p) => p.musique === MUSIQUE_1900)!.poids,
        musiques: liste.filter((p) => p.musique).reduce((somme, p) => somme + p.poids, 0),
        ciel: ciel.arrets[0]![1].match(/\d+/g)!.slice(0, 3).map(Number),
        virage: virages.reduce((somme, x) => somme + Number(String(x.fillStyle).match(/([\d.e-]+)\)$/)![1]), 0),
      }
    }
    /** L'entrée de la section : du dernier défilement où 1900 est sous l'écran au premier où 1890 est au-dessus. */
    const ENTREE = { debut: HAUT_1900 - H, fin: HAUT_1900 }

    // Mutation : la présence prise à `poidsSections` (un demi à la frontière, et un fondu autour).
    it('garde à 1 la présence du monde quitté tant que sa section est à l’écran, et donne 1 au monde collant dès que la sienne y entre', () => {
      const banc = monter({ calme: true, collant: true })
      // 1900 sous l'écran : son monde n'est pas dessiné.
      expect(a(banc, ENTREE.debut)).toMatchObject({ de1890: 1, de1900: undefined })
      for (const camY of [ENTREE.debut + 1, ENTREE.debut + 60, HAUT_1900 - H / 2, ENTREE.fin - 60, ENTREE.fin - 1]) {
        expect(a(banc, camY), `à ${camY}`).toMatchObject({ de1890: 1, de1900: 1 })
      }
      // 1890 au-dessus de l'écran : son monde n'est plus dessiné.
      expect(a(banc, ENTREE.fin)).toMatchObject({ de1890: undefined, de1900: 1 })
    })

    /** Les défilements voisins d'un pixel à sonder : serrés aux deux bouts de l'entrée, espacés entre eux. */
    const VOISINS = [
      ...Array.from({ length: 12 }, (_, i) => ENTREE.debut - 6 + i),
      ...Array.from({ length: 13 }, (_, i) => ENTREE.debut + 50 * (i + 1)),
      ...Array.from({ length: 12 }, (_, i) => ENTREE.fin - 6 + i),
    ]

    // Mutation : le poids de mélange égal à la présence (le ciel et le virage sautent quand la
    // section entre à l'écran, et quand celle d'avant en sort) ; le virage pesé à la présence.
    it('ne fait pas sauter le ciel à l’entrée de la section : d’un pixel à l’autre, le mélange bouge de moins d’un centième', () => {
      const banc = monter({ calme: true, collant: true })
      for (const camY of VOISINS) {
        const ici = a(banc, camY)
        const voisin = a(banc, camY + 1)
        expect(Math.abs(voisin.melange1890 - ici.melange1890), `1890 à ${camY}`).toBeLessThan(0.01)
        expect(Math.abs(voisin.melange1900 - ici.melange1900), `1900 à ${camY}`).toBeLessThan(0.01)
        // Le ciel dessiné : aucune composante ne bouge de plus de deux crans sur 255.
        voisin.ciel.forEach((c, k) => expect(Math.abs(c - ici.ciel[k]!), `le ciel à ${camY}`).toBeLessThanOrEqual(2))
        // Les virages des deux mondes ne s'empilent pas : à eux deux, celui d'un seul.
        expect(ici.virage, `le virage à ${camY}`).toBeCloseTo(0.13, 6)
      }
      // Le mélange est la part de l'écran : rien avant l'entrée, la moitié à la frontière, tout après.
      expect(a(banc, ENTREE.debut)).toMatchObject({ melange1890: 1, melange1900: 0 })
      expect(a(banc, HAUT_1900 - H / 2).melange1900).toBeCloseTo(0.5, 6)
      expect(a(banc, HAUT_1900 - H / 4).melange1900).toBeCloseTo(0.75, 6)
      expect(a(banc, ENTREE.fin)).toMatchObject({ melange1890: 0, melange1900: 1 })
      // Et le ciel a bien changé d'un bout à l'autre : il n'est pas resté celui de 1890.
      expect(a(banc, ENTREE.fin).ciel).not.toEqual(a(banc, ENTREE.debut).ciel)
    })

    // Mutation : la présence passée à `rappels.presences` (les deux musiques à plein volume, ensemble).
    it('ne joue jamais deux musiques dont les poids somment à plus de 1', () => {
      const banc = monter({ calme: true, collant: true })
      for (const camY of VOISINS) expect(a(banc, camY).musiques, `à ${camY}`).toBeCloseTo(1, 6)
    })

    // Tâche 7 : le compteur de bobines montre la décennie à l'écran. Mutations : la décennie prise à
    // la présence (elle vaut 1 pour les deux mondes dans toute l'entrée : 1890 jusqu'à la frontière) ;
    // celle de la première section, ou de l'avatar ; jamais dite (nulle).
    it('dit avec les présences la décennie à l’écran : celle du plus fort poids de mélange, pas de la présence', () => {
      const banc = monter({ calme: true, collant: true })
      const decennie = (camY: number) => {
        banc.moteur.defiler(camY)
        banc.moteur.image(1000)
        return vi.mocked(banc.rappels.presences).mock.lastCall![1]
      }
      expect(decennie(ENTREE.debut)).toBe(1890)
      // Les deux mondes sont présents à 1 : le mélange tranche, au quart puis aux trois quarts de l'écran.
      expect(decennie(HAUT_1900 - (3 * H) / 4)).toBe(1890)
      expect(decennie(HAUT_1900 - H / 4)).toBe(1900)
      expect(decennie(ENTREE.fin)).toBe(1900)
    })

    // Mutations : `dessinerSuivi` jamais appelé ; la roulotte commune, sa plaque ou sa zone gardées
    // dans la section collante.
    it('laisse le monde garer le Voyage suivi, sans roulotte commune', () => {
      const roulotte = { pseudo: 'theo', annee: 1901 }
      const jouer = (collant: boolean) => {
        const banc = auTrain({ calme: true, collant, roulotte })
        banc.moteur.defiler(CAMERA)
        banc.moteur.image(1000)
        return banc
      }
      const temoin = jouer(false)
      const commune = temoin.moteur.ecranDeLaRoulotte()!
      expect(ecrits(temoin.appels)).toContain('theo est rendu en 1901')
      expect(ecrits(temoin.appels)).toContain('THEO ET CIE')
      expect(suivis).toEqual([])
      toucher(temoin.moteur, commune.x, commune.y - 8)
      expect(temoin.rappels.roulotte).toHaveBeenCalledTimes(1)
      const collant = jouer(true)
      expect(suivis).toEqual([roulotte])
      expect(ecrits(collant.appels)).not.toContain('theo est rendu en 1901')
      expect(ecrits(collant.appels)).not.toContain('THEO ET CIE')
      toucher(collant.moteur, commune.x, commune.y - 8)
      expect(collant.rappels.roulotte).not.toHaveBeenCalled()
      toucher(collant.moteur, OU_SUIVI.x, OU_SUIVI.y)
      expect(collant.rappels.roulotte).toHaveBeenCalledTimes(1)
    })

    describe('la caméra d’une section collante (plan 3a)', () => {
      /** Un arrêt par année de 1900, tous les 200 px de la section : loin des cases du tracé (170 px), le dernier 220 px au-dessus du bas de la section. */
      const ARRETS = Array.from({ length: 10 }, (_, i) => i * 200)
      /** Le bas de la section 1900 : le haut de la suivante. */
      const BAS_1900 = HAUT_1900 + mondeAVenir(1900).trace([1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909]).hauteur
      const arret = (annee: number) => HAUT_1900 + ARRETS[annee - 1900]!
      /** Le banc, une première image jouée, et de quoi jouer les suivantes : une toutes les 40 ms d'horloge. */
      const enGare = (options: Parameters<typeof auTrain>[0] & { ailleurs?: boolean } = {}) => {
        const banc = options.ailleurs ? monter({ collant: true, arrets: ARRETS, ...options }) : auTrain({ arrets: ARRETS, ...options })
        let ms = 1000
        banc.moteur.image(ms)
        const filer = (duree: number) => {
          for (const fin = ms + duree; ms < fin; ) banc.moteur.image((ms += 40))
        }
        const vers = () => vi.mocked(banc.rappels.defilerVers).mock.calls.map(([y]) => y)
        /** La caméra posée à l'arrêt de `annee`, le défilement reposé, les rappels oubliés. */
        const poserA = (y: number) => {
          banc.moteur.defiler(y)
          filer(REPOS_DU_DEFILEMENT + 120)
          vi.mocked(banc.rappels.defilerVers).mockClear()
        }
        /** Un témoin posé dans le `then` d'une promesse du moteur. */
        const temoin = (promesse: Promise<void>) => {
          const t = { fini: false }
          void promesse.then(() => void (t.fini = true))
          return t
        }
        return { ...banc, filer, vers, poserA, temoin }
      }
      const ROULEMENT = auTempo(DUREE_DU_ROULEMENT)

      // Mutations : la promesse résolue à l'appel ; `auTempo` retiré de `rouler` (elle se résoudrait
      // à mi-chemin de l'horloge attendue) ; le roulement remplacé par la marche de l'avatar.
      it('marcher y fait rouler la caméra jusqu’à l’arrêt de l’année, au tempo, et ne se résout qu’à l’arrivée', async () => {
        const banc = enGare()
        banc.poserA(arret(1900))
        const marche = banc.temoin(banc.moteur.marcher(1901))
        await Promise.resolve()
        expect(marche.fini).toBe(false)
        banc.filer(ROULEMENT - 40)
        await Promise.resolve()
        expect(marche.fini).toBe(false)
        // En chemin, la caméra glisse entre les deux arrêts, toujours vers le suivant.
        const enChemin = banc.vers()
        expect(enChemin.length).toBeGreaterThan(10)
        enChemin.forEach((y, i) => {
          expect(y).toBeGreaterThanOrEqual(i ? enChemin[i - 1]! : arret(1900))
          expect(y).toBeLessThan(arret(1901))
        })
        banc.filer(80)
        await Promise.resolve()
        expect(marche.fini).toBe(true)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1901))
        // Arrivée, elle ne bouge plus.
        const n = banc.vers().length
        banc.filer(600)
        expect(banc.vers().length).toBe(n)
      })

      // Mutations : la garde `this.roulement` retirée de `constaterLeRepos` (le rappel au plus
      // proche remplacerait le roulement attendu, et libérerait `marcher` au repos du défilement) ;
      // `r.fin ||` retiré de `constaterLeDefilement` (un défilement en chemin arrêterait la marche).
      it('ni le repos du défilement, ni un défilement en chemin, ne libèrent marcher avant l’arrivée', async () => {
        const banc = enGare()
        // La caméra laissée entre deux arrêts, et la marche demandée avant que le défilement ne repose.
        banc.moteur.defiler(arret(1900) + 90)
        const marche = banc.temoin(banc.moteur.marcher(1902))
        // Dix images de 40 ms : le repos du défilement est passé, le roulement non.
        expect(REPOS_DU_DEFILEMENT + 40).toBeLessThan(400)
        banc.filer(400)
        banc.moteur.defiler(arret(1900) + 30)
        banc.filer(ROULEMENT - 400 - 40)
        await Promise.resolve()
        expect(marche.fini).toBe(false)
        banc.filer(80)
        await Promise.resolve()
        expect(marche.fini).toBe(true)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1902))
      })

      // Mutation : la garde `this.calme` retirée de `rouler` : l'horloge figée, le roulement
      // n'arriverait jamais, et le témoin resterait faux.
      it('au calme, marcher pose la caméra à l’arrêt d’un coup et se résout sans qu’aucune image ne soit jouée', async () => {
        const banc = auTrain({ calme: true, arrets: ARRETS })
        banc.moteur.defiler(arret(1900))
        let fini = false
        void banc.moteur.marcher(1901).then(() => void (fini = true))
        await Promise.resolve()
        expect(fini).toBe(true)
        expect(vi.mocked(banc.rappels.defilerVers).mock.calls).toEqual([[arret(1901)]])
      })

      // Mutation : `Math.abs(y - this.camY) <= A_L_ARRET` retiré de `rouler` : la caméra déjà à
      // l'arrêt ferait attendre tout un roulement immobile.
      it('marcher vers l’arrêt où la caméra est déjà posée se résout aussitôt', async () => {
        const banc = enGare()
        banc.poserA(arret(1900))
        const marche = banc.temoin(banc.moteur.marcher(1900))
        await Promise.resolve()
        expect(marche.fini).toBe(true)
      })

      // Mutation : la garde `this.sceneDe(ici.section)` retirée de `passerLaPorte` : l'avatar, que
      // personne ne voit, marcherait vers la porte, et la caméra le suivrait.
      it('passer la porte depuis la section se résout aussitôt, sans rien déplacer', async () => {
        const banc = enGare()
        banc.poserA(arret(1900))
        const porte = banc.temoin(banc.moteur.passerLaPorte())
        await Promise.resolve()
        expect(porte.fini).toBe(true)
        banc.filer(600)
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
      })

      // Mutations : le bloc du roulement retiré d'`achever` (l'horloge figée, la marche ne finirait
      // jamais) ; `this.poser(r.y1)` retiré (libérée, mais la caméra laissée en chemin).
      it('achève le roulement quand le visiteur demande moins d’animations en chemin : la caméra à l’arrêt, marcher libéré', async () => {
        const banc = enGare()
        banc.poserA(arret(1900))
        const marche = banc.temoin(banc.moteur.marcher(1901))
        banc.filer(200)
        banc.moteur.reglerCalme(true)
        await Promise.resolve()
        expect(marche.fini).toBe(true)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1901))
        const n = banc.vers().length
        banc.filer(600)
        expect(banc.vers().length).toBe(n)
      })

      // Mutations : le rappel retiré de `constaterLeRepos` (la caméra resterait entre deux arrêts) ;
      // le premier arrêt pris au lieu du plus proche ; le défilement daté une seule fois (`d.aDater
      // && d.depuis === null`) : le rappel partirait pendant que le membre défile encore.
      it.each([
        { ecart: 90, vers: 1902 },
        { ecart: 160, vers: 1903 },
      ])('ramène au plus proche la caméra laissée entre deux arrêts, une fois le défilement arrêté (à $ecart px de 1902 : $vers)', ({ ecart, vers }) => {
        const banc = enGare()
        banc.poserA(arret(1901))
        // Tant que le défilement dure, rien : un `defiler` toutes les 80 ms, plus court que le repos.
        for (let i = 0; i <= 10; i++) {
          banc.moteur.defiler(arret(1902) + (ecart * i) / 10)
          banc.filer(80)
        }
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
        banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
        const ou = banc.vers()
        expect(ou.length).toBeGreaterThan(10)
        expect(ou[ou.length - 1]).toBe(arret(vers))
        // Elle y roule, sans jamais sortir de l'intervalle qui la sépare de l'arrêt.
        const bornes = [arret(1902) + ecart, arret(vers)].sort((a, b) => a - b)
        ou.forEach((y) => expect(y >= bornes[0]! && y <= bornes[1]!).toBe(true))
      })

      // La spec, « Le posé à l'arrêt » : le rappel vaut dans toute la section, sous le dernier arrêt
      // compris. Mutations : la borne `camY >= dernier arrêt` remise dans `arretsAutour` (la caméra
      // resterait sous le dernier arrêt) ; la section cherchée par ses arrêts et non par ses bornes
      // (un défilement arrêté dans la section suivante serait rappelé).
      it('ramène au dernier arrêt la caméra laissée sous lui dans la section, jamais celle qui s’arrête dans la section suivante', () => {
        const banc = enGare()
        banc.poserA(arret(1909))
        expect(arret(1909) + 150).toBeLessThan(BAS_1900)
        banc.moteur.defiler(arret(1909) + 150)
        banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1909))
        vi.mocked(banc.rappels.defilerVers).mockClear()
        banc.moteur.defiler(BAS_1900 - 1)
        banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1909))
        vi.mocked(banc.rappels.defilerVers).mockClear()
        banc.moteur.defiler(BAS_1900)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        banc.moteur.defiler(BAS_1900 + 300)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
      })

      // Avant le premier arrêt, c'est la zone du passage d'entrée : la caméra y reste où on la laisse.
      // Mutation : `this.camY <= arrets[0]!` retiré d'`arretsAutour`.
      it('ne rappelle pas la caméra laissée dans la section avant le premier arrêt', () => {
        const banc = enGare({ arrets: ARRETS.map((y) => y / 2 + 300) })
        banc.poserA(HAUT_1900 + 300)
        banc.moteur.defiler(HAUT_1900 + 150)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        banc.moteur.defiler(HAUT_1900 - 60)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
        // Le témoin : sous le premier arrêt, la même caméra est rappelée.
        banc.moteur.defiler(HAUT_1900 + 330)
        banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(HAUT_1900 + 300)
      })

      // Mutation : `arrets.length < 2` remis dans `arretsAutour` (une section à un seul arrêt
      // laisserait la caméra n'importe où).
      it('ramène la caméra à l’arrêt d’une section qui n’en a qu’un', () => {
        const banc = enGare({ arrets: [400] })
        banc.poserA(HAUT_1900 + 400)
        banc.moteur.defiler(HAUT_1900 + 700)
        banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(HAUT_1900 + 400)
        // Au calme, d'un coup, une fois le défilement arrêté : aucun arrêt n'est devant le geste.
        const calme = enGare({ arrets: [400], calme: true })
        calme.poserA(HAUT_1900 + 400)
        calme.moteur.defiler(HAUT_1900 + 700)
        expect(calme.rappels.defilerVers).not.toHaveBeenCalled()
        calme.filer(REPOS_DU_DEFILEMENT + 600)
        expect(calme.vers()).toEqual([HAUT_1900 + 400])
      })

      // Sur une carte sans section collante (1890 aujourd'hui), le défilement ne se constate pas :
      // au calme, la boucle joue une image par défilement et se rendort. Mutation : la garde
      // `!this.bandes` retirée de `constaterLeDefilement` (la boucle tiendrait jusqu'au repos).
      it('sans section collante sur la carte, la boucle ne tient pas après un défilement', () => {
        const banc = monter({ calme: true })
        for (const f of banc.demandees.splice(0)) f(1000)
        expect(banc.demandees).toEqual([])
        banc.moteur.defiler(300)
        for (const f of banc.demandees.splice(0)) f(1040)
        expect(banc.demandees).toEqual([])
        // Le témoin : avec une section collante, elle tient.
        const collant = monter({ calme: true, collant: true, arrets: ARRETS })
        for (const f of collant.demandees.splice(0)) f(1000)
        collant.moteur.defiler(300)
        for (const f of collant.demandees.splice(0)) f(1040)
        expect(collant.demandees.length).toBe(1)
      })

      // Sur un écran tactile, le navigateur relève le pointeur (`pointercancel`) dès qu'il prend le
      // geste pour défiler : la page relaie alors le nombre de doigts posés. Mutations :
      // `|| this.touchers > 0` retiré de `doigt` ; `reprendreLaCamera` retiré de `doigtsPoses` (le
      // rappel en cours tirerait la caméra sous le doigt qui se pose) ; sa garde `nombre > 0` retirée
      // (un `touchcancel` sans doigt arrêterait le rappel).
      it('ne rappelle pas la caméra tant qu’un doigt est posé, même après le pointercancel, et reprend au lever du dernier', () => {
        const banc = enGare()
        banc.poserA(arret(1901))
        banc.moteur.doigtsPoses(1)
        banc.moteur.pointeur('bas', 200, 300, false)
        banc.moteur.defiler(arret(1902) + 40)
        banc.moteur.pointeur('annule', 200, 300, false)
        banc.moteur.pointeur('quitte', 200, 300, false)
        banc.moteur.defiler(arret(1902) + 90)
        banc.filer(REPOS_DU_DEFILEMENT + 1000)
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
        // Un second doigt posé puis levé : le premier reste, rien ne part.
        banc.moteur.doigtsPoses(2)
        banc.moteur.pointeur('bas', 100, 300, false)
        banc.moteur.pointeur('haut', 100, 300, false)
        banc.moteur.doigtsPoses(1)
        banc.filer(REPOS_DU_DEFILEMENT + 1000)
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
        // Le dernier doigt levé, le rappel part ; un doigt reposé en chemin l'arrête.
        banc.moteur.doigtsPoses(0)
        banc.filer(200)
        expect(banc.vers().length).toBeGreaterThan(0)
        // Aucun doigt posé (un `touchcancel` tardif) : le rappel continue.
        const enRoute = banc.vers().length
        banc.moteur.doigtsPoses(0)
        banc.filer(40)
        const n = banc.vers().length
        expect(n).toBe(enRoute + 1)
        expect(banc.vers()[n - 1]).not.toBe(arret(1902))
        banc.moteur.doigtsPoses(1)
        banc.filer(REPOS_DU_DEFILEMENT + 1000)
        expect(banc.vers().length).toBe(n)
        banc.moteur.doigtsPoses(0)
        banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1902))
      })

      // Mutation : `&& !this.doigt` retiré de la pose du geste, dans `constaterLeDefilement` : au
      // calme, l'arrêt serait posé sous le doigt qui défile.
      it('au calme, ne pose l’arrêt du geste qu’une fois le doigt levé et le défilement arrêté', () => {
        const banc = enGare({ calme: true })
        banc.poserA(arret(1902))
        banc.moteur.doigtsPoses(1)
        banc.moteur.defiler(arret(1902) + 30)
        banc.moteur.defiler(arret(1902) + 70)
        banc.filer(REPOS_DU_DEFILEMENT + 1000)
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
        banc.moteur.doigtsPoses(0)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        // L'arrêt suivant dans le sens du geste, pas le plus proche (1902, à 70 px).
        expect(banc.vers()).toEqual([arret(1903)])
      })

      // Mutation : `this.arreterLeRoulement()` retiré de `rouler` : la promesse du roulement
      // remplacé ne se résoudrait jamais.
      it('un roulement qui en remplace un autre libère qui attendait le premier', async () => {
        const banc = enGare()
        banc.poserA(arret(1900))
        const premiere = banc.temoin(banc.moteur.marcher(1901))
        banc.filer(200)
        const seconde = banc.temoin(banc.moteur.marcher(1902))
        await Promise.resolve()
        expect(premiere.fini).toBe(true)
        expect(seconde.fini).toBe(false)
        banc.filer(ROULEMENT + 40)
        await Promise.resolve()
        expect(seconde.fini).toBe(true)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1902))
      })

      // Mutations : `|| this.doigt` retiré de `constaterLeRepos` ; l'arrêt du roulement retiré de
      // `pointeur` (le rappel en cours tirerait la caméra sous le doigt qui vient de se poser) ;
      // `this.defilement.aDater = true` retiré au même endroit (le doigt levé, la caméra resterait
      // entre deux arrêts).
      it('ne rappelle pas la caméra tant que le pointeur est bas, et lui rend celle qui roulait', () => {
        const banc = enGare()
        banc.poserA(arret(1901))
        banc.moteur.defiler(arret(1902) + 90)
        banc.moteur.pointeur('bas', 200, 300, false)
        banc.filer(REPOS_DU_DEFILEMENT + 1000)
        expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
        // Le doigt levé, le rappel part ; le doigt reposé en chemin, il s'arrête.
        banc.moteur.pointeur('annule', 200, 300, false)
        banc.filer(200)
        const n = banc.vers().length
        expect(n).toBeGreaterThan(0)
        expect(banc.vers()[n - 1]).not.toBe(arret(1902))
        banc.moteur.pointeur('bas', 200, 300, false)
        banc.filer(REPOS_DU_DEFILEMENT + 1000)
        expect(banc.vers().length).toBe(n)
        // Levé de nouveau, la caméra n'est pas laissée là.
        banc.moteur.pointeur('annule', 200, 300, false)
        banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1902))
      })

      // Un défilement sans doigt que le moteur connaisse (la molette, l'élan d'un lancer) : il ne voit
      // que `defiler`. Mutations : la reconnaissance de l'écho retirée de `constaterLeDefilement`
      // (ce que le roulement a posé, rendu par la page, l'arrêterait) ; l'écho reconnu à la seule
      // dernière valeur posée (un `scroll` rendu deux images plus tard l'arrêterait) ;
      // `this.arreterLeRoulement()` retiré au même endroit (le rappel combattrait le défilement).
      it('le rappel en cours cède au défilement du membre, pas à l’écho de ce qu’il vient de poser', () => {
        const banc = enGare()
        banc.poserA(arret(1901))
        banc.moteur.defiler(arret(1902) + 90)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        const n = banc.vers().length
        // L'écho : la page rend, arrondi, un défilement que le moteur a posé, fût-ce quelques images plus tôt.
        expect(n).toBeGreaterThan(3)
        expect(Math.abs(banc.vers()[n - 1]! - banc.vers()[n - 3]!)).toBeGreaterThan(A_L_ARRET)
        banc.moteur.defiler(Math.round(banc.vers()[n - 3]!))
        banc.filer(40)
        expect(banc.vers().length).toBe(n + 1)
        // Le geste : le membre repart vers le bas.
        banc.moteur.defiler(arret(1902) + 140)
        banc.filer(REPOS_DU_DEFILEMENT - 40)
        expect(banc.vers().length).toBe(n + 1)
        banc.filer(ROULEMENT + 300)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1903))
      })

      // Mutations : le rappel au plus proche employé au calme (trente pixels sous 1902 rendraient
      // 1902) ; le premier arrêt devant pris même quand le défilement en a franchi d'autres ; la
      // garde `this.calme` retirée de `rouler` (au repos, la caméra glisserait).
      it('au calme, chaque geste pose l’arrêt suivant dans son sens, d’un seul defilerVers', () => {
        const banc = enGare({ calme: true })
        banc.poserA(arret(1902))
        banc.moteur.defiler(arret(1902) + 30)
        expect(banc.vers()).toEqual([arret(1903)])
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        expect(banc.vers()).toEqual([arret(1903)])
        banc.moteur.defiler(arret(1903) - 30)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        expect(banc.vers()).toEqual([arret(1903), arret(1902)])
        // Un défilement qui franchit plusieurs arrêts d'un coup se pose au dernier franchi.
        banc.moteur.defiler(arret(1906) + 20)
        banc.filer(REPOS_DU_DEFILEMENT + 600)
        expect(banc.vers()).toEqual([arret(1903), arret(1902), arret(1906)])
        // Posée entre deux arrêts sans qu'aucun geste ne l'y mène (le calme demandé là) : au plus proche, d'un coup.
        const laissee = enGare()
        laissee.poserA(arret(1901))
        laissee.moteur.defiler(arret(1902) + 90)
        laissee.moteur.reglerCalme(true)
        laissee.filer(REPOS_DU_DEFILEMENT + 600)
        expect(laissee.vers()).toEqual([arret(1902)])
      })

      // Au calme, la boucle du moteur dort : c'est elle qui doit tenir jusqu'au repos du défilement.
      // Mutations : `defile ||` retiré de `boucle` (le geste fini, la caméra resterait où le doigt
      // l'a traînée) ; la garde `this.pose !== null` retirée de `constaterLeDefilement` (la suite du
      // même geste poserait l'arrêt d'après).
      it('au calme, la suite du geste ne pose pas d’autre arrêt, et la boucle tient jusqu’au repos pour y ramener la caméra', () => {
        const banc = auTrain({ calme: true, arrets: ARRETS })
        let ms = 1000
        const tourner = (duree: number) => {
          for (const fin = ms + duree; ms < fin; ) {
            ms += 40
            for (const f of banc.demandees.splice(0)) f(ms)
          }
        }
        banc.moteur.defiler(arret(1902))
        tourner(REPOS_DU_DEFILEMENT + 400)
        // Reposée, la boucle se rendort.
        expect(banc.demandees).toEqual([])
        banc.moteur.defiler(arret(1902) + 30)
        banc.moteur.defiler(arret(1903) + 40)
        banc.moteur.defiler(arret(1903) + 80)
        expect(vi.mocked(banc.rappels.defilerVers).mock.calls).toEqual([[arret(1903)]])
        tourner(REPOS_DU_DEFILEMENT + 400)
        expect(vi.mocked(banc.rappels.defilerVers).mock.calls).toEqual([[arret(1903)], [arret(1903)]])
        expect(banc.demandees).toEqual([])
      })

      // La page cachée, la boucle ne tourne que pour ce qui doit finir. Mutation : `this.roulement`
      // retiré de `boucle` : le roulement s'arrêterait à sa première image, et `marcher` avec lui.
      it('la boucle tient jusqu’au bout du roulement, même quand la carte n’est pas visible', async () => {
        const banc = auTrain({ arrets: ARRETS })
        let ms = 1000
        const tourner = (duree: number) => {
          for (const fin = ms + duree; ms < fin; ) {
            ms += 40
            for (const f of banc.demandees.splice(0)) f(ms)
          }
        }
        banc.moteur.reglerVisible(false)
        banc.moteur.defiler(arret(1900))
        tourner(REPOS_DU_DEFILEMENT + 400)
        expect(banc.demandees).toEqual([])
        let fini = false
        void banc.moteur.marcher(1901).then(() => void (fini = true))
        tourner(ROULEMENT + 200)
        await Promise.resolve()
        expect(fini).toBe(true)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1901))
        expect(banc.demandees).toEqual([])
      })

      // Mutations : `avatarVisible` calculé sur l'avatar de la route (à l'arrêt de 1903, la case de
      // 1905 est à l'écran ; à celui de 1905, elle est au-dessus) ; l'écart `A_L_ARRET` ramené à 0
      // (la page rend un défilement arrondi) ; `allerIci` qui viserait l'avatar de la route.
      it('dit le membre en vue quand la caméra est posée à l’arrêt de son année, et « Tu es ici » y ramène', () => {
        const banc = enGare({ enCours: 1905 })
        const vu = () => vi.mocked(banc.rappels.avatarVisible).mock.lastCall![0]
        banc.poserA(arret(1903))
        expect(vu()).toBe(false)
        banc.moteur.allerIci(true)
        expect(banc.vers()).toEqual([arret(1905)])
        banc.filer(40)
        expect(vu()).toBe(true)
        banc.moteur.defiler(arret(1905) + A_L_ARRET - 0.5)
        banc.filer(40)
        expect(vu()).toBe(true)
        // Sans `instant`, la caméra y roule ; au calme, elle s'y pose d'un coup.
        banc.poserA(arret(1903))
        banc.moteur.allerIci()
        banc.filer(ROULEMENT / 2)
        expect(banc.vers().length).toBeGreaterThan(10)
        expect(vu()).toBe(false)
        banc.filer(ROULEMENT / 2 + 40)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1905))
        expect(vu()).toBe(true)
        const calme = enGare({ enCours: 1905, calme: true })
        calme.poserA(arret(1903))
        calme.moteur.allerIci()
        expect(calme.vers()).toEqual([arret(1905)])
      })

      // Mutation : la borne retirée d'`arretsDe` : un arrêt écrit sous le bas de la carte, que le
      // défilement n'atteint pas, rappellerait la caméra sans fin.
      it('borne un arrêt à ce que le défilement atteint', async () => {
        const banc = auTrain({ calme: true, arrets: [...ARRETS.slice(0, 9), 1e6] })
        await banc.moteur.marcher(1909)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(banc.moteur.hauteur - H)
      })

      // Un seul glissement à la fois. Mutations : `this.suivre = false` ou `this.visee = null` retiré
      // de `rouler` (le glissement d'avant arrêterait le roulement, et libérerait `marcher` à la
      // première image) ; la ligne « celui qui a commencé après l'emporte » retirée de `maj` (deux
      // `defilerVers` par image, qui se disputent la caméra) ; `arreterLeRoulement` retiré de
      // `direAdieu` (le rappel tirerait la caméra hors de l'adieu).
      it.each(['suivre', 'visee'] as const)('le roulement arrête le glissement d’avant (%s), et cède à celui d’après', async (glissement) => {
        // Le membre est resté en 1898 : « Tu es ici » fait suivre l'avatar, 1898 ouverte sous les yeux fait viser son chantier.
        const banc = enGare({ ailleurs: true, chantier1898: 0 })
        banc.poserA(arret(1900))
        if (glissement === 'suivre') banc.moteur.allerIci()
        else banc.moteur.ouvrirSousLesYeux(1898)
        const marche = banc.temoin(banc.moteur.marcher(1901))
        banc.filer(ROULEMENT - 40)
        await Promise.resolve()
        expect(marche.fini).toBe(false)
        expect(banc.vers().every((y) => y >= arret(1900))).toBe(true)
        // En chemin, l'autre glissement repart : lui seul commande la caméra, et `marcher` est libéré.
        vi.mocked(banc.rappels.defilerVers).mockClear()
        if (glissement === 'suivre') banc.moteur.allerIci()
        else banc.moteur.ouvrirSousLesYeux(1898)
        banc.filer(200)
        await Promise.resolve()
        expect(marche.fini).toBe(true)
        expect(banc.vers().length).toBe(5)
      })

      it('l’adieu d’un monde arrête le rappel en cours', () => {
        const banc = enGare({ ailleurs: true })
        banc.poserA(arret(1901))
        banc.moteur.defiler(arret(1902) + 90)
        banc.filer(REPOS_DU_DEFILEMENT + 200)
        expect(banc.vers().length).toBeGreaterThan(0)
        void banc.moteur.direAdieu(1890)
        banc.filer(400)
        expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(MARGE_HAUT)
      })

      describe('la vue d’ensemble d’un monde à scène (plan 3a)', () => {
        /** Un passage dont la zone des temps commence dans le bas de 1890 et tient les arrêts de 1901 à 1903. */
        const TEMPS: TempsDEntree[] = [
          { y: -600, duree: 0, arret: 200 },
          { y: 300, duree: 500, arret: 100 },
          { y: 700, duree: 800, arret: 300 },
        ]
        type Banc = ReturnType<typeof enGare>
        /** La vue d'ensemble ouverte, `duree` millisecondes d'images jouées, les rappels oubliés : rend le cadre donné au monde à la dernière. */
        const ouvrir = (banc: Banc, duree = 1000) => {
          banc.moteur.basculerEnsemble(true)
          banc.filer(duree)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          vi.mocked(banc.rappels.ensemble).mockClear()
          return bandes[bandes.length - 1]!.cadre
        }
        /** Le milieu de la vignette de `annee`, dans la bande du monde d'essai. */
        const pointDe = (cadre: CadreDeBande, annee: number) => ({ x: cadre.x + ((annee - 1900 + 0.5) * cadre.w) / 10, y: cadre.y + cadre.h / 2 })
        /** Deux doigts qui s'écartent autour du point : le pincement qui referme la vue d'ensemble. */
        const ecarter = (moteur: MoteurCarte, x: number, y: number) => {
          moteur.pincer(100, x, y)
          moteur.pincer(200, x, y)
        }
        /** Où la caméra est, d'après la dernière image dessinée où `annee` avait sa section à l'écran ; nul si aucune. */
        const camera = (annee: number, haut: number) => {
          const v = vueDe(annee)
          return v ? v.avance + haut : null
        }
        const passageJoue = () => vus.some((v) => v.entree >= 0)
        const DECENNIES = 14

        // Mutations : dans `geoEnsemble` du moteur, `detaillee` laissé à `!aVenir || i === ici?.section`
        // (le membre dans 1900, sa bande pèserait la hauteur de sa section : 202 px au lieu de 36) ;
        // la ligne `scene` retirée de `genreDeBande` ; le cadre décalé ; `attente` ou l'état oubliés ;
        // le rappel de `cadre.image` vidé (l'image arrivée, la bande ne serait pas redessinée).
        it('donne au monde le cadre d’une bande repliée, l’état de ses années et ses images, et n’y pose aucune marquise', () => {
          const banc = auTrain({ calme: true, arrets: ARRETS })
          banc.moteur.majEtat({ cases: banc.cases.map((c) => (c.annee === 1900 ? { ...c, attente: true } : c)), anneeAvatar: 1900, tampons: [], tickets: [], roulotte: null })
          const image = vi.spyOn(banc.deps, 'image')
          const tourner = () => {
            for (let ms = 1000; banc.demandees.length; ms += 40) for (const f of banc.demandees.splice(0)) f(ms)
          }
          tourner()
          banc.moteur.basculerEnsemble(true)
          banc.appels.length = 0
          tourner()
          const { cadre, etat } = bandes[bandes.length - 1]!
          const hauteur = (H - 132 - 64) / DECENNIES
          expect(cadre.x).toBe(10)
          expect(cadre.w).toBe(W - 20)
          expect(cadre.y).toBeCloseTo(132 + hauteur, 6)
          expect(cadre.h).toBeCloseTo(hauteur, 6)
          expect(cadre.e).toBe(1)
          expect(etat.anneeAvatar).toBe(1900)
          expect(etat.annees.map((x) => x.annee)).toEqual([1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909])
          expect(etat.annees.slice(0, 2)).toEqual([
            { annee: 1900, etat: 'encours', attente: true },
            { annee: 1901, etat: 'verrou', attente: false },
          ])
          // Le monde a dessiné sa bande ; le moteur n'y a écrit aucun millésime, ni la décennie.
          expect(ecrits(banc.appels)).toContain('bande 1900')
          expect(ecrits(banc.appels)).toContain('1910 – 1919')
          for (const texte of ['1900', '1905', '1909', '1900 – 1909']) expect(ecrits(banc.appels)).not.toContain(texte)
          // L'image que le monde demande passe par les dépendances du moteur, qui redessine à son arrivée.
          image.mockClear()
          expect(banc.demandees).toEqual([])
          expect(cadre.image('gare.webp')).not.toBeNull()
          expect(image).toHaveBeenCalledTimes(1)
          expect(image.mock.calls[0]![0]).toBe('gare.webp')
          image.mock.calls[0]![1]()
          expect(banc.demandees.length).toBe(1)
        })

        // Mutations : `x` non passé à `quitterEnsemble` depuis `pointeur` (un `x` fixe : la même année
        // pour les deux touchers, ou aucune) ; l'année lue sur le seul `y` (l'ancien chemin : la
        // caméra posée d'après la hauteur du toucher dans la bande).
        it('un toucher dans la bande du monde mène à l’arrêt de l’année que le monde désigne sous le point, et la caméra y reste', () => {
          for (const annee of [1906, 1902]) {
            const banc = enGare()
            banc.poserA(arret(1900))
            const cadre = ouvrir(banc)
            const p = pointDe(cadre, annee)
            toucher(banc.moteur, p.x, p.y)
            expect(banc.rappels.ensemble).toHaveBeenLastCalledWith(false)
            expect(banc.vers()).toEqual([arret(annee)])
            // La page rend ce défilement ; au repos, rien ne reprend la caméra.
            banc.moteur.defiler(arret(annee))
            banc.filer(REPOS_DU_DEFILEMENT + 1500)
            expect(banc.vers()).toEqual([arret(annee)])
            expect(camera(1900, HAUT_1900)).toBe(arret(annee))
          }
        })

        // Mutation : le seul `y` du milieu passé à `quitterEnsemble` depuis `pincer` (un `x` fixe).
        it('un pincement qui referme dans la bande du monde mène à l’arrêt de l’année sous le milieu des doigts', () => {
          for (const annee of [1907, 1903]) {
            const banc = enGare()
            banc.poserA(arret(1900))
            const cadre = ouvrir(banc)
            const p = pointDe(cadre, annee)
            ecarter(banc.moteur, p.x, p.y)
            expect(banc.rappels.ensemble).toHaveBeenLastCalledWith(false)
            expect(banc.vers()).toEqual([arret(annee)])
          }
        })

        // Les replis : la sortie ferme la vue d'ensemble et laisse la caméra où elle est. Mutations :
        // une année nulle rendue au chemin des bandes ordinaires (la caméra posée d'après le seul
        // `y`) ; les lectures gardées quand la vue d'ensemble n'est plus dessinée (celle d'une
        // ouverture d'avant lue à la réouverture) ; l'arrêt manquant remplacé par un nombre (`?? 0`).
        it('ne bouge pas la caméra quand aucune image de la vue d’ensemble n’a été dessinée, quand le point ne désigne aucune année, ou quand l’année n’a pas d’arrêt', () => {
          const banc = enGare({ calme: true })
          banc.poserA(arret(1900))
          const fermee = () => {
            expect(banc.rappels.ensemble).toHaveBeenLastCalledWith(false)
            banc.filer(REPOS_DU_DEFILEMENT + 400)
            expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
          }
          // Aucune image dessinée : ni à la première ouverture, ni à une réouverture.
          banc.moteur.basculerEnsemble(true)
          toucher(banc.moteur, W / 2, 132 + ((H - 132 - 64) / DECENNIES) * 1.5)
          fermee()
          const cadre = ouvrir(banc, 80)
          const p = pointDe(cadre, 1906)
          banc.moteur.basculerEnsemble(false)
          banc.filer(80)
          banc.moteur.basculerEnsemble(true)
          toucher(banc.moteur, p.x, p.y)
          fermee()
          // Le point de la bande que le monde ne range sous aucune année : à gauche de son cadre.
          ouvrir(banc, 80)
          toucher(banc.moteur, cadre.x - 5, p.y)
          fermee()
          ouvrir(banc, 80)
          ecarter(banc.moteur, cadre.x - 5, p.y)
          fermee()
          // Le témoin : le même point, une image dessinée, mène à l'arrêt.
          ouvrir(banc, 80)
          toucher(banc.moteur, p.x, p.y)
          expect(banc.vers()).toEqual([arret(1906)])
          // Un monde qui ne donne pas d'arrêt à l'année qu'il désigne.
          const court = enGare({ calme: true, arrets: ARRETS.slice(0, 5) })
          court.poserA(arret(1900))
          const q = pointDe(ouvrir(court, 80), 1907)
          toucher(court.moteur, q.x, q.y)
          expect(court.rappels.ensemble).toHaveBeenLastCalledWith(false)
          court.filer(REPOS_DU_DEFILEMENT + 400)
          expect(court.rappels.defilerVers).not.toHaveBeenCalled()
        })

        // Relecture de la tâche 5 : la sortie défilait sans poser la caméra, et l'écho de ce défilement
        // passait pour un geste entré dans la zone des temps. Mutations : `this.poser(y)` remplacé
        // par le seul `rappels.defilerVers(y)` (l'image d'après est dessinée à l'ancienne place) ; le
        // défilement d'avant non oublié (parti d'au-dessus de la zone, il lance le passage au repos).
        it('la sortie dans la bande du monde pose la caméra à l’arrêt d’un coup, et n’y lance aucun passage d’entrée', () => {
          const banc = enGare({ entree: TEMPS })
          banc.poserA(MARGE_HAUT)
          // Un défilement encore à constater, parti d'au-dessus de la zone des temps.
          banc.moteur.defiler(MARGE_HAUT + 10)
          const cadre = ouvrir(banc, 80)
          const p = pointDe(cadre, 1902)
          expect(arret(1902)).toBeGreaterThan(HAUT_1900 + TEMPS[0]!.y)
          expect(arret(1902)).toBeLessThan(HAUT_1900 + TEMPS[2]!.y)
          toucher(banc.moteur, p.x, p.y)
          expect(banc.vers()).toEqual([arret(1902)])
          vus.length = 0
          banc.filer(40)
          expect(camera(1900, HAUT_1900)).toBe(arret(1902))
          banc.moteur.defiler(arret(1902))
          banc.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(banc.vers()).toEqual([arret(1902)])
          expect(passageJoue()).toBe(false)
        })

        // Le rappel de la tâche 4 qui roulait à la sortie. Mutation : `arreterLeRoulement()` retiré
        // de `quitterEnsemble` (le rappel reprendrait la caméra à l'image suivante, vers son arrêt).
        it('la sortie dans la bande du monde arrête le rappel qui roulait : la caméra reste à l’arrêt désigné', () => {
          const banc = enGare()
          banc.poserA(arret(1902))
          banc.moteur.defiler(arret(1902) + 90)
          banc.filer(REPOS_DU_DEFILEMENT + 120)
          // Le rappel roule vers 1902, et n'y est pas encore.
          expect(banc.vers().length).toBeGreaterThan(0)
          expect(banc.vers()).not.toContain(arret(1902))
          const cadre = ouvrir(banc, 80)
          const p = pointDe(cadre, 1906)
          ecarter(banc.moteur, p.x, p.y)
          banc.moteur.defiler(arret(1906))
          banc.filer(ROULEMENT + 600)
          expect(banc.vers()).toEqual([arret(1906)])
          expect(camera(1900, HAUT_1900)).toBe(arret(1906))
        })

        /** Une marche de 1898 vers 1896 commencée, la caméra qui suit l'avatar, puis la vue d'ensemble quittée d'un toucher tout en bas de l'écran. */
        const quitterEnMarchant = (banc: Banc) => {
          void banc.moteur.marcher(1896)
          banc.filer(80)
          banc.moteur.basculerEnsemble(true)
          banc.filer(80)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          toucher(banc.moteur, W / 2, H - 70)
          const ou = banc.vers()[0]!
          banc.filer(3000)
          return ou
        }

        // Décision du propriétaire du 2 octobre 2026 : la sortie prend la caméra sur toute carte, 1890
        // comprise. Mutations : `prendreLaCamera()` remis sous la garde `this.bandes` de
        // `quitterEnsemble` (la caméra remonterait vers l'avatar, image après image) ;
        // `this.suivre = false` retiré de `prendreLaCamera`.
        it('sur une carte sans section collante, la sortie par un toucher arrête le suivi : la caméra reste où l’on a touché, la marche finit hors champ', async () => {
          const banc = enGare({ ailleurs: true, collant: false })
          const marche = banc.temoin(banc.moteur.marcher(1896))
          banc.filer(80)
          // Le témoin : avant la sortie, la caméra suivait l'avatar.
          expect(banc.vers().length).toBeGreaterThan(0)
          banc.moteur.basculerEnsemble(true)
          banc.filer(80)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          toucher(banc.moteur, W / 2, H - 70)
          const ou = banc.vers()[0]!
          banc.filer(3000)
          // Loin de l'avatar, tout en bas de la carte.
          expect(ou).toBeGreaterThan(5000)
          expect(banc.vers()).toEqual([ou])
          // La marche, elle, va au bout : qui l'attendait est libéré.
          await Promise.resolve()
          expect(marche.fini).toBe(true)
        })

        // Le jumeau, pour la visée d'un chantier. Mutations : `prendreLaCamera()` remis sous la garde
        // `this.bandes` de `quitterEnsemble`, ou `this.visee = null` retiré de `prendreLaCamera` (la
        // caméra repartirait vers le chantier).
        it('sur une carte sans section collante, la sortie par un toucher lâche la visée d’un chantier : la caméra reste où l’on a touché', () => {
          const banc = enGare({ ailleurs: true, collant: false })
          banc.moteur.defiler(banc.moteur.ecranDeLAnnee(1899).y - 350)
          banc.moteur.majEtat({ cases: banc.cases, anneeAvatar: 1899, tampons: [], tickets: [], roulotte: null })
          banc.filer(120)
          // Le témoin : la visée courait, la caméra glissait vers le chantier.
          expect(banc.vers().length).toBeGreaterThan(1)
          banc.moteur.basculerEnsemble(true)
          banc.filer(80)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          toucher(banc.moteur, W / 2, H - 70)
          const ou = banc.vers()[0]!
          banc.filer(3000)
          expect(ou).toBeGreaterThan(5000)
          expect(banc.vers()).toEqual([ou])
        })

        // Le même geste sur une carte à section collante : la sortie prend la caméra, et elle reste
        // où l'on a touché. Mutation : `this.suivre = false` retiré de `prendreLaCamera`.
        it('sur une carte à section collante, le même geste arrête le suivi : la caméra reste où l’on a touché', () => {
          const banc = enGare({ ailleurs: true })
          const ou = quitterEnMarchant(banc)
          expect(ou).toBeGreaterThan(5000)
          expect(banc.vers()).toEqual([ou])
        })

        /** Le bas de la bande de 1890, juste au-dessus de celle du monde : la sortie y mène dans le bas de 1890. */
        const basDe1890 = (cadre: CadreDeBande) => ({ x: W / 2, y: cadre.y - 1 })
        const cibleDuBasDe1890 = (cadre: CadreDeBande) => MARGE_HAUT + ((cadre.h - 1) / cadre.h) * (HAUT_1900 - MARGE_HAUT) - H / 2

        // Le jumeau, dans une bande ordinaire : la caméra posée dans la zone des temps, venue d'en
        // dessous. Mutations : les mêmes (`poser` remplacé par `defilerVers` ; le défilement d'avant
        // non oublié : parti d'en dessous de la zone, il lance le passage à l'envers).
        it('la sortie dans une bande ordinaire pose la caméra d’un coup, et ne lance aucun passage d’entrée', () => {
          const banc = enGare({ entree: TEMPS })
          banc.poserA(arret(1905))
          banc.moteur.defiler(arret(1905) + 30)
          const cadre = ouvrir(banc, 80)
          const cible = cibleDuBasDe1890(cadre)
          expect(cible).toBeGreaterThan(HAUT_1900 + TEMPS[0]!.y + 50)
          const p = basDe1890(cadre)
          toucher(banc.moteur, p.x, p.y)
          expect(banc.vers().length).toBe(1)
          expect(banc.vers()[0]).toBeCloseTo(cible, 6)
          vus.length = 0
          banc.filer(40)
          expect(camera(1895, MARGE_HAUT)).toBeCloseTo(cible, 6)
          banc.moteur.defiler(Math.round(cible))
          banc.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(banc.vers().length).toBe(1)
          expect(passageJoue()).toBe(false)
        })

        // L'écho, lui-même : la page rend le défilement arrondi, et la sortie posée à un pixel et
        // demi du premier temps passerait, arrondie, pour un geste qui vient d'entrer dans la zone.
        // Mutations : la garde `this.sortie` retirée de `constaterLeDefilement` ; la garde qui ne se
        // lève jamais (`this.sortie = null` retiré, et tout défilement tenu pour un écho).
        it('l’écho de la sortie, rendu arrondi par la page, n’est pas pris pour un geste entré dans la zone des temps', () => {
          const essai = enGare({ entree: TEMPS })
          essai.poserA(arret(1905))
          const cible = cibleDuBasDe1890(ouvrir(essai, 80))
          // Le premier temps à 1,4 px au-dessus de la sortie : elle y est posée (`A_L_ARRET`), son écho non.
          expect(A_L_ARRET).toBeGreaterThan(1.4)
          const banc = enGare({ entree: [{ ...TEMPS[0]!, y: cible - 1.4 - HAUT_1900 }, TEMPS[1]!, TEMPS[2]!] })
          banc.poserA(arret(1905))
          const p = basDe1890(ouvrir(banc, 80))
          toucher(banc.moteur, p.x, p.y)
          expect(banc.vers()[0]).toBeCloseTo(cible, 6)
          vus.length = 0
          banc.moteur.defiler(cible + 0.4)
          banc.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(banc.vers().length).toBe(1)
          expect(passageJoue()).toBe(false)
          // Un vrai geste, ensuite, n'est pas avalé : laissée entre deux arrêts, la caméra est rappelée.
          banc.moteur.defiler(arret(1904) + 90)
          banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1904))
        })

        // Touchée près du haut de sa section, une année ordinaire laisserait la caméra un demi-écran
        // plus haut : dans la section collante d'avant, entre deux arrêts, où rien ne la laisse au
        // repos. Mutation : la garde `collanteEn` retirée de `sortieDeLEnsemble`.
        it('la sortie dans une bande ordinaire ne laisse pas la caméra dans la section collante d’avant', () => {
          const banc = enGare()
          banc.poserA(arret(1900))
          const cadre = ouvrir(banc)
          toucher(banc.moteur, W / 2, cadre.y + cadre.h + 1)
          expect(banc.vers()).toEqual([BAS_1900])
          banc.moteur.defiler(BAS_1900)
          banc.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(banc.vers()).toEqual([BAS_1900])
        })
      })

      describe('le passage d’entrée (plan 3a)', () => {
        /**
         * Trois temps, en `y` de la section et en millisecondes de base : des durées et des pauses
         * toutes différentes, et une durée au premier temps que personne ne doit lire. Le premier
         * est au-dessus de la section : le bas de 1890 y est encore à l'écran.
         */
        const TEMPS: TempsDEntree[] = [
          { y: -100, duree: 7000, arret: 200 },
          { y: 300, duree: 500, arret: 100 },
          { y: 700, duree: 800, arret: 300 },
        ]
        /** Les gares commencent où le passage finit : le premier arrêt est le dernier temps. */
        const GARES = Array.from({ length: 10 }, (_, i) => 700 + i * 130)
        const T = TEMPS.map((x) => HAUT_1900 + x.y)
        /** Ce que dure le passage, dans un sens comme dans l'autre : ses deux segments et ses trois pauses. */
        const BASE = TEMPS[0]!.arret + TEMPS[1]!.duree + TEMPS[1]!.arret + TEMPS[2]!.duree + TEMPS[2]!.arret
        const auPassage = (options: Parameters<typeof enGare>[0] = {}) => enGare({ arrets: GARES, entree: TEMPS, ...options })
        const entreeDe = (annee: number) => vueDe(annee)!.entree

        // Mutation : la garde `temps.length === 0` retirée de `direBonjour`.
        it('se résout aussitôt, sans bouger la caméra, pour un monde sans temps, sans scène, ou inconnu de la carte', async () => {
          const sansTemps = enGare()
          sansTemps.poserA(arret(1900))
          const vide = sansTemps.temoin(sansTemps.moteur.direBonjour(1900, 'endroit'))
          await Promise.resolve()
          expect(vide.fini).toBe(true)
          const banc = auPassage()
          banc.poserA(T[2]!)
          const sansScene = banc.temoin(banc.moteur.direBonjour(1890, 'endroit'))
          const inconnu = banc.temoin(banc.moteur.direBonjour(1700, 'envers'))
          await Promise.resolve()
          expect(sansScene.fini).toBe(true)
          expect(inconnu.fini).toBe(true)
          banc.filer(200)
          expect(sansTemps.rappels.defilerVers).not.toHaveBeenCalled()
          expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
          expect(entreeDe(1900)).toBe(-1)
        })

        // Mutations : `auTempo` retiré d'une durée ou d'une pause (la promesse résolue trop tôt) ;
        // appliqué deux fois (trop tard) ; la pose du premier temps retirée ; `this.passage = null`
        // retiré (l'entrée ne reviendrait pas à -1) ; `entree` donnée à tous les mondes.
        it('pose la caméra au premier temps où qu’elle soit, joue chaque durée et chaque pause au tempo, et rend l’entrée à -1 à la fin', async () => {
          const banc = auPassage()
          banc.poserA(HAUT_1900 + GARES[5]!)
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          expect(banc.vers()).toEqual([T[0]])
          // La pause du premier temps, où la caméra a été posée d'un coup : rien ne bouge.
          vus.length = 0
          banc.filer(auTempo(TEMPS[0]!.arret) - 40)
          expect(banc.vers()).toEqual([T[0]])
          expect(entreeDe(1900)).toBeCloseTo((auTempo(TEMPS[0]!.arret) - 40) / 1000, 6)
          // Le monde quitté, encore à l'écran, n'est pas en passage.
          expect(entreeDe(1898)).toBe(-1)
          // Le premier segment dure la durée du deuxième temps, puis sa pause.
          banc.filer(auTempo(TEMPS[1]!.duree) + 80)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[1])
          const n = banc.vers().length
          banc.filer(auTempo(TEMPS[1]!.arret) - 80)
          expect(banc.vers().length).toBe(n)
          // En chemin, la caméra ne recule jamais et ne dépasse aucun temps.
          banc.vers().forEach((y, i, tous) => expect(y >= (i ? tous[i - 1]! : T[0]!) && y <= T[1]!).toBe(true))
          // Jusque-là : quarante millisecondes de moins que les deux pauses et le segment.
          banc.filer(auTempo(BASE) - auTempo(TEMPS[0]!.arret + TEMPS[1]!.duree + TEMPS[1]!.arret))
          await Promise.resolve()
          expect(bonjour.fini).toBe(false)
          expect(entreeDe(1900)).toBeCloseTo((auTempo(BASE) - 40) / 1000, 6)
          banc.filer(80)
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
          expect(entreeDe(1900)).toBe(-1)
          // Fini, il ne bouge plus rien : le dernier temps est un arrêt, le rappel n'a rien à y faire.
          const fin = banc.vers().length
          banc.filer(REPOS_DU_DEFILEMENT + 600)
          expect(banc.vers().length).toBe(fin)
        })

        // Mutations : `sens` ignoré (il finirait au dernier temps) ; la durée d'un segment prise au
        // temps où l'on arrive, comme à l'endroit, au lieu du temps d'où l'on vient.
        it('à l’envers, part du dernier temps, finit au premier, et chaque segment garde sa durée', async () => {
          const banc = auPassage()
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'envers'))
          expect(banc.vers()).toEqual([T[2]])
          // La pause du dernier temps, puis le segment qui le relie au deuxième : la caméra y est en pause.
          banc.filer(auTempo(TEMPS[2]!.arret + TEMPS[2]!.duree) + 80)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[1])
          banc.filer(auTempo(BASE) - auTempo(TEMPS[2]!.arret + TEMPS[2]!.duree) - 120)
          await Promise.resolve()
          expect(bonjour.fini).toBe(false)
          banc.filer(80)
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[0])
        })

        // Mutation : la garde `this.calme` retirée de `direBonjour` : la caméra posée au premier
        // temps, puis une attente sans fin sous l'horloge figée.
        it.each([
          { sens: 'endroit' as const, dernier: T[2]! },
          { sens: 'envers' as const, dernier: T[0]! },
        ])('au calme, se résout aussitôt, d’un seul defilerVers, vers le dernier temps du sens joué ($sens)', async ({ sens, dernier }) => {
          const banc = auPassage({ calme: true })
          banc.poserA(HAUT_1900 + GARES[5]!)
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, sens))
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          banc.filer(REPOS_DU_DEFILEMENT + 600)
          expect(banc.vers()).toEqual([dernier])
          expect(entreeDe(1900)).toBe(-1)
        })

        /** Le manège de 1890 touché, la caméra en haut de la carte : la vue que son monde a reçue avec la réaction. */
        const vueDuManege = (banc: ReturnType<typeof enGare>) => {
          banc.poserA(MARGE_HAUT)
          toucher(banc.moteur, MANEGE.x, MANEGE.y)
          expect(reactions).toEqual(['manege'])
          return vuesDesReactions[vuesDesReactions.length - 1]!
        }

        // Mutations : `passer` toujours nul ; `'envers'` au lieu de `'endroit'` ; la décennie de la
        // section elle-même (`s.decennie`) au lieu de celle d'après ; `this.meneur.direBonjour` appelé
        // sans passer par la méthode publique que le bouton appelle.
        it('donne au décor le passage du monde d’après, joué par `direBonjour` à l’endroit, comme le bouton de la page', () => {
          const banc = auPassage()
          const bonjour = vi.spyOn(banc.moteur, 'direBonjour')
          const { passer } = vueDuManege(banc)
          expect(bonjour).not.toHaveBeenCalled()
          expect(banc.vers()).toEqual([])
          passer!()
          expect(bonjour.mock.calls).toEqual([[1900, 'endroit']])
          // La caméra est posée au premier temps, et le passage se joue.
          expect(banc.vers()).toEqual([T[0]])
          banc.filer(40)
          expect(entreeDe(1900)).toBeGreaterThanOrEqual(0)
        })

        // Mutations : la garde des temps retirée (`suivante` seule) ; `section` au lieu de
        // `section + 1` dans `tempsDe` ; la section d'après lue deux rangs plus loin.
        it('ne donne aucun passage au décor quand le monde d’après n’en a pas, ou quand aucune section ne suit', () => {
          // Une scène collante sans temps d'entrée : rien à jouer.
          expect(vueDuManege(enGare()).passer).toBeNull()
          // Le monde collant lui-même : ce qui le suit est un monde « à venir ».
          const garni = auPassage({ garni: true })
          garni.poserA(T[2]!)
          toucher(garni.moteur, OU_SEMAPHORE.x, OU_SEMAPHORE.y)
          expect(reagis[reagis.length - 1]).toEqual({ decennie: 1900, id: 'semaphore' })
          expect(vuesDesReactions[vuesDesReactions.length - 1]!.passer).toBeNull()
          // La décennie d'après cachée par la page : la carte s'arrête à 1899.
          const seul = auPassage()
          seul.moteur.majEtat({ cases: seul.cases.filter((c) => c.annee < 1900), anneeAvatar: 1899, tampons: [], tickets: [], roulotte: seul.roulotte })
          expect(vueDuManege(seul).passer).toBeNull()
        })

        // Mutations : `ticketDApres` toujours faux, ou toujours vrai ; `s.decennie` au lieu de
        // `s.decennie + 10` (un ticket de 1899 ferait venir le train) ; `passer !== null` à sa place
        // (le ticket en main ne compterait pas, la décennie d'après étant encore cachée).
        it('dit au décor si un ticket pour le monde d’après a été émis, que ce monde soit ouvert ou non, le ticket utilisé ou non', () => {
          const avec = (tickets: readonly number[], cachee = false) => {
            const banc = auPassage()
            banc.moteur.majEtat({ cases: cachee ? banc.cases.filter((c) => c.annee < 1900) : banc.cases, anneeAvatar: 1899, tampons: [], tickets, roulotte: banc.roulotte })
            reactions.length = 0
            return vueDuManege(banc).ticketDApres
          }
          expect(avec([])).toBe(false)
          expect(avec([1896, 1899])).toBe(false)
          expect(avec([1899, 1900])).toBe(true)
          // Le ticket en main, 1900 encore caché par la page : le moteur ne lit pas la carte pour le dire.
          expect(avec([1900], true)).toBe(true)
          // Un ticket qui saute plus loin que la première année vaut aussi.
          expect(avec([1902])).toBe(true)
        })

        // Mutation : la branche du calme retirée de `Meneur.direBonjour` (le passage se jouerait).
        it('au calme, le passage que le décor appelle pose la caméra en gare, d’un coup, comme le fait le bouton', async () => {
          const banc = auPassage({ calme: true, auCalme: { 1890: ['manege'] } })
          const { passer, vivant } = vueDuManege(banc)
          expect(vivant).toBe(false)
          passer!()
          expect(banc.vers()).toEqual([T[2]])
          banc.filer(400)
          expect(banc.vers()).toEqual([T[2]])
          expect(entreeDe(1900)).toBe(-1)
        })

        // Mutation : le `return` retiré après `finirLePassage` dans `pointeur` (le décor recevrait le
        // toucher, et le train de la foire relancerait le passage qu'on vient de poser).
        it('un toucher sur le décor pendant le passage le pose à sa fin : le décor ne reçoit rien, et rien ne relance le passage', async () => {
          const banc = auPassage({ garni: true })
          const bonjour = vi.spyOn(banc.moteur, 'direBonjour')
          const joue = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          toucher(banc.moteur, OU_SEMAPHORE.x, OU_SEMAPHORE.y)
          await Promise.resolve()
          expect(joue.fini).toBe(true)
          expect(reagis).toEqual([])
          expect(bonjour).toHaveBeenCalledTimes(1)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
          // Le témoin : le passage fini, le même toucher atteint le décor.
          toucher(banc.moteur, OU_SEMAPHORE.x, OU_SEMAPHORE.y)
          expect(reagis).toEqual([{ decennie: 1900, id: 'semaphore' }])
        })

        // Mutations : le `return` retiré après `finirLePassage` dans `pointeur` (le toucher relayé
        // ouvrirait l'année sous le doigt) ; `finirLePassage` retiré (le passage continuerait).
        it('un toucher pendant le passage le pose à sa fin, sans ouvrir l’année qui se trouve sous le doigt', async () => {
          const banc = auPassage()
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          toucher(banc.moteur, quai(1900)!.x, quai(1900)!.y)
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          expect(banc.rappels.toucherAnnee).not.toHaveBeenCalled()
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
          const n = banc.vers().length
          banc.filer(600)
          expect(banc.vers().length).toBe(n)
          expect(entreeDe(1900)).toBe(-1)
          // Le témoin : le passage fini, le même toucher ouvre l'année.
          toucher(banc.moteur, quai(1900)!.x, quai(1900)!.y)
          expect(banc.rappels.toucherAnnee).toHaveBeenCalledTimes(1)
          expect(banc.rappels.toucherAnnee).toHaveBeenLastCalledWith(1900)
          // Un doigt posé avant le passage et levé pendant : un toucher lui aussi, qui n'ouvre rien.
          vi.mocked(banc.rappels.toucherAnnee).mockClear()
          banc.moteur.pointeur('bas', quai(1900)!.x, quai(1900)!.y, false)
          const second = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          await Promise.resolve()
          expect(second.fini).toBe(false)
          banc.moteur.pointeur('haut', quai(1900)!.x, quai(1900)!.y, false)
          await Promise.resolve()
          expect(second.fini).toBe(true)
          expect(banc.rappels.toucherAnnee).not.toHaveBeenCalled()
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
        })

        // Mutations : le bloc du passage retiré d'`achever` (la promesse en suspens sous l'horloge
        // figée) ; `this.poser(…)` retiré de `finirLePassage` (libérée, la caméra laissée en chemin).
        it('s’achève quand le visiteur demande moins d’animations en chemin : la caméra au dernier temps, la promesse résolue', async () => {
          const banc = auPassage()
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          expect(banc.vers()[banc.vers().length - 1]!).toBeLessThan(T[1]!)
          banc.moteur.reglerCalme(true)
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
          const n = banc.vers().length
          banc.filer(600)
          expect(banc.vers().length).toBe(n)
          expect(entreeDe(1900)).toBe(-1)
        })

        // Mutation : la garde `if (enCours)` retirée de `direBonjour` : le second reposerait la
        // caméra à son premier temps, et le premier ne se résoudrait jamais.
        it('demandé pendant qu’un autre joue, ne relance rien et se résout avec lui', async () => {
          const banc = auPassage()
          const premier = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          const avant = entreeDe(1900)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          const second = banc.temoin(banc.moteur.direBonjour(1900, 'envers'))
          expect(banc.vers()).toEqual([])
          banc.filer(40)
          expect(entreeDe(1900)).toBeCloseTo(avant + 0.04, 6)
          banc.filer(auTempo(BASE) - auTempo(TEMPS[0]!.arret) - 200 - 80)
          await Promise.resolve()
          expect(premier.fini).toBe(false)
          expect(second.fini).toBe(false)
          banc.filer(80)
          await Promise.resolve()
          expect(premier.fini).toBe(true)
          expect(second.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
        })

        // Mutations : `|| this.doigt` retiré de `constaterLeRepos` (le passage partirait sous le
        // doigt) ; le déclenchement retiré de `constaterLeRepos` ; le sens tiré du seul fait d'être
        // dans la zone (`depart` ignoré).
        it('le défilement qui entre par le haut dans la zone des temps lance le passage à l’endroit, une fois le dernier doigt levé', async () => {
          const banc = auPassage()
          banc.poserA(T[0]! - 200)
          banc.moteur.doigtsPoses(1)
          banc.moteur.pointeur('bas', 200, 300, false)
          banc.moteur.defiler(T[0]! - 100)
          banc.moteur.pointeur('annule', 200, 300, false)
          banc.moteur.defiler(T[0]! + 150)
          // Le geste continue dans la zone : c'est d'où il est parti qui dit par où il est entré.
          banc.moteur.defiler(T[0]! + 180)
          banc.filer(REPOS_DU_DEFILEMENT + 1000)
          expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
          expect(entreeDe(1900)).toBe(-1)
          banc.moteur.doigtsPoses(0)
          banc.filer(80)
          expect(banc.vers()).toEqual([T[0]])
          expect(entreeDe(1900)).toBeGreaterThanOrEqual(0)
          // La page rend ce que le passage pose : cet écho ne le relance pas, ni en chemin ni à la fin.
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          banc.moteur.defiler(Math.round(banc.vers()[banc.vers().length - 1]!))
          banc.filer(auTempo(BASE))
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
          const n = banc.vers().length
          banc.moteur.defiler(Math.round(T[2]!))
          banc.filer(REPOS_DU_DEFILEMENT + 1000)
          expect(banc.vers().length).toBe(n)
          expect(entreeDe(1900)).toBe(-1)
        })

        // Mutations : le sens « envers » rendu pour toute entrée ; ou « endroit » ; le bord du bas
        // lu sans sa marge (posée au dernier temps à un pixel près, la caméra relancerait le passage).
        it('le défilement qui y entre par le bas le lance à l’envers ; celui qui ne fait que la traverser ne lance rien', () => {
          const banc = auPassage()
          // Du bas de la foire à la première gare, d'un trait : la zone est traversée, pas habitée.
          banc.poserA(T[0]! - 200)
          banc.moteur.defiler(T[2]! - 1)
          banc.filer(REPOS_DU_DEFILEMENT + 1000)
          expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
          banc.moteur.defiler(T[2]! - 250)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          expect(banc.vers()).toEqual([T[2]])
          banc.filer(auTempo(BASE) + 80)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[0])
          // Arrivée au premier temps, elle y reste : ni rappel, ni second passage.
          const n = banc.vers().length
          banc.moteur.defiler(Math.round(T[0]!))
          banc.filer(REPOS_DU_DEFILEMENT + 1000)
          expect(banc.vers().length).toBe(n)
        })

        // Un monde dont le passage descend sous son premier arrêt : le rappel de la tâche 4 y vaut
        // aussi. Mutations : `if (this.passage) return` retiré de `constaterLeDefilement` (l'écho de
        // ce que le passage pose serait pris pour un défilement, et le rappel au plus proche arrêt
        // arrêterait le passage au repos suivant) ; le défilement en attente non oublié par
        // `direBonjour` (le rappel qu'il devait lancer partirait en plein passage).
        it('le rappel à l’arrêt ne prend pas la caméra au passage qui joue', async () => {
          const banc = enGare({ entree: TEMPS })
          banc.poserA(arret(1906))
          // Un défilement que le passage interrompt avant son repos.
          banc.moteur.defiler(arret(1905) + 90)
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'envers'))
          // La pause du dernier temps, entre deux arrêts, dure plus que le repos du défilement.
          expect(T[2]!).toBeGreaterThan(arret(1903) + A_L_ARRET)
          expect(T[2]!).toBeLessThan(arret(1904) - A_L_ARRET)
          expect(auTempo(TEMPS[2]!.arret)).toBeGreaterThan(REPOS_DU_DEFILEMENT + 200)
          banc.filer(REPOS_DU_DEFILEMENT + 200)
          await Promise.resolve()
          expect(bonjour.fini).toBe(false)
          expect(banc.vers()).toEqual([T[2]])
          // En chemin, entre deux arrêts, la page rend ce que le passage vient de poser.
          banc.filer(auTempo(TEMPS[2]!.arret) - REPOS_DU_DEFILEMENT - 200 + 400)
          const ou = banc.vers()[banc.vers().length - 1]!
          expect(ou).toBeGreaterThan(arret(1903) + A_L_ARRET)
          expect(ou).toBeLessThan(T[2]!)
          banc.moteur.defiler(Math.round(ou))
          banc.filer(REPOS_DU_DEFILEMENT + 200)
          await Promise.resolve()
          expect(bonjour.fini).toBe(false)
          expect(entreeDe(1900)).toBeGreaterThan(0)
          banc.filer(auTempo(BASE))
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
        })

        // Mutation : la borne retirée de `tempsDe` : un temps écrit sous le bas de la carte, que le
        // défilement n'atteint pas, y enverrait la caméra.
        it('borne un temps à ce que le défilement atteint', async () => {
          const banc = enGare({ calme: true, entree: [TEMPS[0]!, { y: 1e6, duree: 500, arret: 0 }] })
          banc.poserA(arret(1900))
          await banc.moteur.direBonjour(1900, 'endroit')
          expect(banc.vers()).toEqual([banc.moteur.hauteur - H])
        })

        // La carte cachée, la boucle ne tourne que pour ce qui doit finir. Mutation : `this.passage`
        // retiré de `boucle` : le passage s'arrêterait à sa première image, sa promesse en suspens.
        it('la boucle tient jusqu’au bout du passage, même quand la carte n’est pas visible', async () => {
          const banc = auTrain({ arrets: GARES, entree: TEMPS })
          let ms = 1000
          const tourner = (duree: number) => {
            for (const fin = ms + duree; ms < fin; ) {
              ms += 40
              for (const f of banc.demandees.splice(0)) f(ms)
            }
          }
          banc.moteur.reglerVisible(false)
          tourner(200)
          expect(banc.demandees).toEqual([])
          let fini = false
          void banc.moteur.direBonjour(1900, 'endroit').then(() => void (fini = true))
          tourner(auTempo(BASE) + 200)
          await Promise.resolve()
          expect(fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[2])
        })

        // Un seul glissement à la fois. Mutations : `arreterLeRoulement` retiré de `direBonjour` (le
        // roulement d'avant se disputerait la caméra, et `marcher` resterait en suspens) ;
        // `this.suivre = false` retiré de `direBonjour` (« Tu es ici » d'avant arrêterait le passage
        // à sa première image) ; `arreterLePassage` retiré de `rouler`, de la ligne de `maj`,
        // d'`allerIci` ou de `direAdieu` (le passage reprendrait la caméra à celui d'après).
        it('le passage arrête le glissement d’avant, et cède à celui d’après, qui libère sa promesse', async () => {
          const banc = auPassage()
          banc.poserA(HAUT_1900 + GARES[0]!)
          const marche = banc.temoin(banc.moteur.marcher(1903))
          banc.filer(200)
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          await Promise.resolve()
          expect(marche.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(T[0])
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          expect(banc.vers().slice(-5).every((y) => y >= T[0]! && y < T[1]!)).toBe(true)
          await Promise.resolve()
          expect(bonjour.fini).toBe(false)
          // Un roulement demandé en chemin : le passage s'arrête où il est, la caméra roule.
          const suite = banc.temoin(banc.moteur.marcher(1901))
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          banc.filer(40)
          expect(entreeDe(1900)).toBe(-1)
          banc.filer(ROULEMENT + 40)
          await Promise.resolve()
          expect(suite.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(HAUT_1900 + GARES[1]!)
          // « Tu es ici », d'un coup : la caméra reste où il la pose.
          const encore = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          banc.moteur.allerIci(true)
          await Promise.resolve()
          expect(encore.fini).toBe(true)
          const n = banc.vers().length
          banc.filer(600)
          expect(banc.vers().length).toBe(n)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(HAUT_1900 + GARES[0]!)
          // L'adieu d'un monde : la caméra reste en haut de sa section.
          const adieu = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          void banc.moteur.direAdieu(1890)
          await Promise.resolve()
          expect(adieu.fini).toBe(true)
          banc.filer(400)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(MARGE_HAUT)
        })

        // Le membre resté en 1898 : « Tu es ici » fait suivre l'avatar, 1898 ouverte sous les yeux
        // fait viser son chantier. Avant, le passage arrête ce glissement ; après, il lui cède.
        // Mutations : `this.suivre = false` ou `this.visee = null` retiré de `direBonjour` ;
        // `arreterLePassage` retiré de la ligne « celui qui a commencé après l'emporte » de `maj`.
        it.each(['suivre', 'visee'] as const)('le passage arrête le glissement d’avant (%s), et cède à celui d’après', async (glissement) => {
          const banc = auPassage({ ailleurs: true, chantier1898: 0 })
          const glisser = () => (glissement === 'suivre' ? banc.moteur.allerIci() : banc.moteur.ouvrirSousLesYeux(1898))
          banc.poserA(T[0]! + 300)
          glisser()
          banc.filer(80)
          expect(banc.vers().length).toBe(2)
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          vi.mocked(banc.rappels.defilerVers).mockClear()
          banc.filer(auTempo(TEMPS[0]!.arret) + 200)
          await Promise.resolve()
          expect(bonjour.fini).toBe(false)
          expect(banc.vers().length).toBeGreaterThan(0)
          expect(banc.vers().every((y) => y >= T[0]!)).toBe(true)
          glisser()
          banc.filer(40)
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          expect(entreeDe(1900)).toBe(-1)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          banc.filer(200)
          expect(banc.vers().length).toBe(5)
        })

        // Mutations : la comparaison retirée de `signalerEntree` (dit à chaque image) ; la borne
        // d'un écran retirée (dit de partout au-dessus) ; `this.passage ?` retiré (dit pendant le
        // passage, posé à son premier temps) ; dit pour un monde sans temps.
        it('dit à la page l’entrée à portée de geste, au bas de la section qui précède, quand cela change seulement', () => {
          const banc = auPassage()
          const dits = () => vi.mocked(banc.rappels.entreeProche!).mock.calls.map(([d]) => d)
          const a = (y: number) => {
            banc.moteur.defiler(y)
            banc.filer(80)
          }
          // Loin au-dessus : rien n'est proche, et rien n'est dit.
          a(T[0]! - H - 10)
          expect(dits()).toEqual([])
          a(T[0]! - H + 10)
          expect(dits()).toEqual([1900])
          a(T[0]! - 100)
          a(T[0]!)
          expect(dits()).toEqual([1900])
          // Dans la zone des temps, puis en gare : l'entrée est derrière.
          a(T[0]! + 10)
          expect(dits()).toEqual([1900, null])
          a(T[2]!)
          a(T[0]! - H - 10)
          expect(dits()).toEqual([1900, null])
          a(T[0]! - 100)
          expect(dits()).toEqual([1900, null, 1900])
          // Pendant le passage, plus rien n'est à portée : la caméra est menée.
          void banc.moteur.direBonjour(1900, 'endroit')
          banc.filer(80)
          expect(dits()).toEqual([1900, null, 1900, null])
          banc.filer(auTempo(BASE) + 80)
          expect(dits()).toEqual([1900, null, 1900, null])
          // Un monde collant sans temps n'a pas d'entrée à offrir.
          const sansTemps = enGare()
          sansTemps.moteur.defiler(HAUT_1900 - 100)
          sansTemps.filer(80)
          expect(sansTemps.rappels.entreeProche).not.toHaveBeenCalled()
        })
      })

      describe('les cinq défauts de la revue du lot 1 (plan 3b)', () => {
        type Banc = ReturnType<typeof enGare>
        /** Un passage dont la zone des temps commence dans le bas de 1890 : « Tu es ici », la marche et un chantier de 1890 y laissent la caméra. */
        const ENTREE: TempsDEntree[] = [
          { y: -900, duree: 0, arret: 200 },
          { y: 300, duree: 500, arret: 100 },
          { y: 700, duree: 800, arret: 300 },
        ]
        const ZONE = { haut: HAUT_1900 + ENTREE[0]!.y, bas: HAUT_1900 + ENTREE[2]!.y }
        const dansLaZone = (y: number) => y > ZONE.haut + A_L_ARRET && y < ZONE.bas - A_L_ARRET
        const passageJoue = () => vus.some((v) => v.entree >= 0)
        /**
         * Les images jouées comme la page les voit : après chacune, elle rend le dernier `defilerVers`
         * reçu, au demi-pixel (l'écran du banc est de densité 2).
         */
        const enEcho = (banc: Banc, duree: number) => {
          for (let i = 0; i < duree / 40; i++) {
            const n = banc.vers().length
            banc.filer(40)
            const vers = banc.vers()
            if (vers.length > n) banc.moteur.defiler(Math.round(vers[vers.length - 1]! * 2) / 2)
          }
        }
        /** Où le tracé pose la case de `annee`, en `y` de carte. */
        const yDeLaCase = (banc: Banc, annee: number) => banc.moteur.ecranDeLAnnee(annee).y
        const ouvrir = (banc: Banc) => {
          banc.moteur.basculerEnsemble(true)
          banc.filer(1000)
          vi.mocked(banc.rappels.defilerVers).mockClear()
        }

        // Défaut 1, « Tu es ici » d'un coup et la marche au calme (`demanderALaPage`) : la page est
        // priée de défiler sans que la caméra soit écrite, et ce qu'elle rend, parti d'au-dessus de
        // la zone des temps et arrivé dedans, passait pour un geste qui y entre.
        // Mutation : `this.attendu = …` retiré de `demanderALaPage`.
        it.each([
          { site: '« Tu es ici », d’un coup', options: { enCours: 1899 }, demander: (b: Banc): void => b.moteur.allerIci(true), annee: 1899 },
          { site: '« Tu es ici », au calme', options: { enCours: 1899, calme: true }, demander: (b: Banc): void => b.moteur.allerIci(), annee: 1899 },
          { site: 'la marche, au calme', options: { ailleurs: true, calme: true }, demander: (b: Banc): void => void b.moteur.marcher(1899), annee: 1899 },
        ])('l’écho du défilement demandé à la page ne lance pas le passage d’entrée ($site)', ({ options, demander, annee }) => {
          const banc = enGare({ entree: ENTREE, ...options })
          // La caméra en haut de la carte, au-dessus de la zone ; l'année visée, elle, la met dedans.
          const cible = cibleCamera(yDeLaCase(banc, annee), H, banc.moteur.hauteur)
          expect(ZONE.haut).toBeGreaterThan(A_L_ARRET)
          expect(dansLaZone(cible)).toBe(true)
          expect(cible).toBeLessThan(HAUT_1900)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          vus.length = 0
          demander(banc)
          expect(banc.vers()).toEqual([cible])
          banc.moteur.defiler(Math.round(cible))
          banc.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(passageJoue()).toBe(false)
          expect(banc.vers()).toEqual([cible])
          // Un vrai geste, ensuite, n'est pas avalé : sorti de la zone par le haut puis revenu dedans, il lance le passage.
          banc.moteur.defiler(ZONE.haut - 50)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          banc.moteur.defiler(cible)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          expect(banc.vers()[1]).toBe(options.calme ? ZONE.bas : ZONE.haut)
        })

        // Défaut 1, la caméra qui suit l'avatar (`avancer`, `suivre`) : chaque image dit à la page où
        // elle est, et la page le rend. Partie d'au-dessus de la zone des temps, arrivée dedans, la
        // suite de ces échos passait pour un geste qui y entre. Mutation : `this.attendu = …` retiré
        // du bloc `suivre` d'`avancer`.
        it('l’écho de la caméra qui suit l’avatar ne lance pas le passage d’entrée', async () => {
          const banc = enGare({ ailleurs: true, entree: ENTREE })
          const cible = cibleCamera(yDeLaCase(banc, 1899), H, banc.moteur.hauteur)
          expect(dansLaZone(cible)).toBe(true)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          vus.length = 0
          const marche = banc.temoin(banc.moteur.marcher(1899))
          enEcho(banc, 4000)
          await Promise.resolve()
          expect(marche.fini).toBe(true)
          enEcho(banc, REPOS_DU_DEFILEMENT + 1500)
          expect(passageJoue()).toBe(false)
          expect(Math.abs(banc.vers()[banc.vers().length - 1]! - cible)).toBeLessThan(1.5)
          // Arrivée, elle ne bouge plus ; et un vrai geste, ensuite, n'est pas avalé.
          const n = banc.vers().length
          enEcho(banc, 600)
          expect(banc.vers().length).toBe(n)
          banc.moteur.defiler(ZONE.haut - 50)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          banc.moteur.defiler(cible)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          expect(banc.vers()[n]).toBe(ZONE.haut)
        })

        // Défaut 1, la caméra qui va chercher un chantier (`avancer`, `visee`) : de même.
        // Mutation : `this.attendu = …` retiré du bloc `visee` d'`avancer`.
        it('l’écho de la caméra qui va chercher un chantier ne lance pas le passage d’entrée', () => {
          // 1898 se bâtit cent pixels au-dessus de 1900 : hors de l'écran depuis le haut de la carte.
          const banc = enGare({ ailleurs: true, entree: ENTREE, chantier1898: HAUT_1900 - 100 - MARGE_HAUT })
          const cible = HAUT_1900 - 100 - H / 2
          expect(dansLaZone(cible)).toBe(true)
          vi.mocked(banc.rappels.defilerVers).mockClear()
          vus.length = 0
          banc.moteur.ouvrirSousLesYeux(1898)
          enEcho(banc, 3000)
          enEcho(banc, REPOS_DU_DEFILEMENT + 1500)
          expect(passageJoue()).toBe(false)
          expect(Math.abs(banc.vers()[banc.vers().length - 1]! - cible)).toBeLessThan(1.5)
          const n = banc.vers().length
          expect(n).toBeGreaterThan(5)
          banc.moteur.defiler(ZONE.haut - 50)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          banc.moteur.defiler(cible)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          expect(banc.vers()[n]).toBe(ZONE.haut)
        })

        // Défaut 1, la suite : tant que la caméra glisse, tout ce qui tombe entre son départ et là où
        // elle en est passe pour un écho. Un autre meneur la prend : il n'en reste que le dernier
        // point, et un vrai geste dans l'ancien intervalle n'est pas avalé. Mutation : l'intervalle
        // non ramené à son dernier point dans `prendreLaCamera`.
        it('la caméra reprise à l’avatar qu’elle suivait, un geste là où elle a glissé reste un geste', async () => {
          const banc = enGare({ ailleurs: true })
          banc.poserA(arret(1905))
          banc.moteur.allerIci()
          enEcho(banc, 200)
          const ou = banc.vers()[banc.vers().length - 1]!
          expect(ou).toBeLessThan(arret(1903))
          // Un roulement prend la caméra, et arrive.
          const marche = banc.temoin(banc.moteur.marcher(1903))
          enEcho(banc, ROULEMENT + 200)
          await Promise.resolve()
          expect(marche.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1903))
          // Le geste : laissée plus près de 1904, là où elle glissait tout à l'heure, la caméra y est rappelée.
          banc.moteur.defiler(arret(1904) - 60)
          banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1904))
        })

        // Défaut 1, la fin du passage (`finirLePassage`, par `poser`) : un monde dont le passage finit
        // entre deux arrêts y tient la caméra. Le passage fini, plus rien ne gardait l'écho de sa
        // dernière pose : il passait pour un geste, et le rappel emmenait la caméra à l'arrêt voisin.
        // Mutation : `this.attendu = …` retiré de `finirLePassage`.
        it('l’écho de la fin du passage ne rappelle pas la caméra à un arrêt', async () => {
          const banc = enGare({ entree: ENTREE })
          banc.poserA(arret(1905))
          expect(ZONE.bas).toBeGreaterThan(arret(1903) + A_L_ARRET)
          expect(ZONE.bas).toBeLessThan(arret(1904) - A_L_ARRET)
          const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
          enEcho(banc, auTempo(ENTREE[0]!.arret + ENTREE[1]!.duree + ENTREE[1]!.arret + ENTREE[2]!.duree + ENTREE[2]!.arret) + 80)
          await Promise.resolve()
          expect(bonjour.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(ZONE.bas)
          const n = banc.vers().length
          enEcho(banc, REPOS_DU_DEFILEMENT + ROULEMENT + 400)
          expect(banc.vers().length).toBe(n)
          // Un vrai geste, ensuite, n'est pas avalé : laissée entre deux arrêts, la caméra est rappelée.
          banc.moteur.defiler(arret(1905) + 90)
          banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1905))
        })

        // Défaut 1, la fin du passage au calme (`direBonjour`, sa branche calme) : la jumelle de la
        // précédente. Le passage se pose d'un coup à son dernier temps ; son écho, pris pour un geste,
        // posait l'arrêt du dessus, puis rejouait le passage à l'envers. Mutation : `this.attendu = …`
        // retiré de la branche calme de `direBonjour`.
        it('au calme, l’écho de la fin du passage ne pose pas d’arrêt et ne rejoue pas le passage', async () => {
          const banc = enGare({ entree: ENTREE, calme: true })
          banc.poserA(arret(1905))
          expect(ZONE.bas).toBeGreaterThan(arret(1903) + A_L_ARRET)
          expect(ZONE.bas).toBeLessThan(arret(1904) - A_L_ARRET)
          await banc.moteur.direBonjour(1900, 'endroit')
          expect(banc.vers()).toEqual([ZONE.bas])
          banc.moteur.defiler(Math.round(ZONE.bas))
          banc.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(banc.vers()).toEqual([ZONE.bas])
          // Un vrai geste, ensuite, n'est pas avalé : il pose le dernier arrêt qu'il a franchi.
          banc.moteur.defiler(arret(1905) + 90)
          banc.filer(REPOS_DU_DEFILEMENT + 80)
          expect(banc.vers().slice(1).every((y) => y === arret(1905))).toBe(true)
          expect(banc.vers().length).toBeGreaterThan(1)
        })

        // Défaut 2 : un doigt posé sur une case avant le passage, levé pendant. Le passage prend ce
        // lever, que le geste n'apprend pas : sa minuterie d'appui long courait toujours, et ouvrait
        // l'aperçu de l'année sans qu'aucun doigt ne soit posé. Mutation : `this.geste.annulerAppui()`
        // retiré de `pointeur`. (Pas `lever` : il émettrait un toucher, et ouvrirait l'année.)
        it('le doigt levé pendant le passage ne laisse pas d’appui long derrière lui', () => {
          vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
          try {
            const GARES = Array.from({ length: 10 }, (_, i) => 700 + i * 130)
            const TEMPS: TempsDEntree[] = [{ y: -100, duree: 7000, arret: 200 }, { y: 300, duree: 500, arret: 100 }, { y: 700, duree: 800, arret: 300 }]
            const banc = enGare({ arrets: GARES, entree: TEMPS })
            banc.poserA(HAUT_1900 + GARES[0]!)
            const p = quai(1900)!
            // Le témoin : sans passage, le même doigt tenu ouvre l'aperçu.
            banc.moteur.pointeur('bas', p.x, p.y, false)
            vi.advanceTimersByTime(APPUI_LONG_MS)
            expect(banc.rappels.apercu).toHaveBeenCalledTimes(1)
            banc.moteur.pointeur('haut', p.x, p.y, false)
            vi.mocked(banc.rappels.apercu).mockClear()
            // Le doigt posé avant le passage, levé pendant.
            banc.moteur.pointeur('bas', p.x, p.y, false)
            void banc.moteur.direBonjour(1900, 'endroit')
            banc.filer(80)
            banc.moteur.pointeur('haut', p.x, p.y, false)
            vi.advanceTimersByTime(APPUI_LONG_MS + 100)
            expect(banc.rappels.apercu).not.toHaveBeenCalled()
            expect(banc.rappels.toucherAnnee).not.toHaveBeenCalled()
          } finally {
            vi.useRealTimers()
          }
        })

        // Défaut 3 : une tranche du sol entièrement dans une section collante ne porte rien (le sol y
        // est coupé), et sa tuile, une toile de la largeur de l'écran, était fabriquée et gardée quand
        // même. Mutation : la garde `solEn` retirée de la boucle des tuiles de `scene`.
        it('ne fabrique aucune tuile du sol pour une tranche entièrement dans la section collante', () => {
          const banc = auTrain({ arrets: ARRETS })
          // L'écran tient dans deux tranches, toutes deux dans la section.
          const y = Math.ceil(HAUT_1900 / TUILE) * TUILE
          expect(Math.floor((y + H) / TUILE) * TUILE + TUILE).toBeLessThanOrEqual(BAS_1900)
          banc.moteur.defiler(y)
          banc.moteur.image(1000)
          banc.moteur.image(1040)
          expect(banc.moteur.tuilesEnMemoire).toBe(0)
          // Le témoin : à cheval sur la frontière, la tranche qui porte le bas de 1890 est fabriquée.
          banc.moteur.defiler(CAMERA)
          banc.moteur.image(1080)
          expect(banc.moteur.tuilesEnMemoire).toBeGreaterThan(0)
        })

        // Défaut 4 : le monde d'une zone se lisait à `camY + y`, le `y` de carte du doigt. Une section
        // collante ne glisse pas : ce que son monde pose en haut de l'écran, la caméra à la frontière,
        // tombe sur le bas de 1890. Mutations : dans `toucher`, la section relue par `camY + y` (la
        // date et la bobine de 1890 sortent, `reagir` va à 1890) ; `reagir` seul envoyé au monde lu
        // par `camY + y` ; la clé des réactions écrite sans monde (`date:0` marque aussi 1890).
        describe('une zone appartient au monde qui l’a inscrite', () => {
          const aLaFrontiere = (options: Options = {}) => {
            const banc = auTrain({ garni: true, ...options })
            banc.moteur.defiler(CAMERA)
            banc.moteur.image(1000)
            return banc
          }

          it('la date et la bobine du monde collant, touchées devant le bas de 1890, sont les siennes', () => {
            // Le doigt est sur le bas de 1890, en `y` de carte : c'est là que l'ancien calcul lisait le monde.
            expect(CAMERA + OU_DEPECHE.y).toBeLessThan(HAUT_1900)
            const banc = aLaFrontiere()
            toucher(banc.moteur, OU_DEPECHE.x, OU_DEPECHE.y)
            expect(vi.mocked(banc.rappels.date).mock.calls).toEqual([[DEPECHE]])
            toucher(banc.moteur, OU_BOBINE_1900.x, OU_BOBINE_1900.y)
            expect(vi.mocked(banc.rappels.bobine).mock.calls).toEqual([[BOBINE_1900.cle]])
            // Au calme aussi : une date se lit, une bobine se ramasse.
            const calme = aLaFrontiere({ calme: true })
            toucher(calme.moteur, OU_DEPECHE.x, OU_DEPECHE.y)
            expect(vi.mocked(calme.rappels.date).mock.calls).toEqual([[DEPECHE]])
          })

          it('le décor du monde collant, touché devant le bas de 1890, réagit chez lui', () => {
            const banc = aLaFrontiere()
            toucher(banc.moteur, OU_SEMAPHORE.x, OU_SEMAPHORE.y)
            expect(reagis).toEqual([{ decennie: 1900, id: 'semaphore' }])
          })

          it('la date 0 du monde collant, ouverte, ne marque pas la date 0 de 1890', () => {
            const banc = aLaFrontiere()
            expect(vueDe(1898)!.age('date:0')).toBe(99)
            expect(vueDe(1900)!.age('date:0')).toBe(99)
            toucher(banc.moteur, OU_DEPECHE.x, OU_DEPECHE.y)
            banc.moteur.image(1040)
            expect(vueDe(1900)!.age('date:0')).toBeLessThan(1)
            expect(vueDe(1898)!.age('date:0')).toBe(99)
            // Ce que le monde marque lui-même (`v.marquer`) est rangé de même : chez lui seul.
            vueDe(1898)!.marquer('cloche')
            expect(vueDe(1898)!.age('cloche')).toBeLessThan(1)
            expect(vueDe(1900)!.age('cloche')).toBe(99)
          })
        })

        // Défaut 5 : la vue d'ensemble ouverte, la carte est sous elle. Un défilement n'y lance ni
        // rappel ni passage. Mutation : la garde `this.terrain.ensemble()` retirée de
        // `constaterLeDefilement`.
        it('la vue d’ensemble ouverte, un défilement ne lance ni rappel à un arrêt, ni passage d’entrée', () => {
          const banc = enGare()
          banc.poserA(arret(1901))
          ouvrir(banc)
          banc.moteur.defiler(arret(1902) + 90)
          banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 400)
          expect(banc.vers()).toEqual([])
          const passage = enGare({ entree: ENTREE })
          passage.poserA(MARGE_HAUT)
          ouvrir(passage)
          vus.length = 0
          passage.moteur.defiler(arret(1902))
          passage.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(passage.vers()).toEqual([])
          expect(passageJoue()).toBe(false)
        })

        // Défaut 5 : le défilement qui attendait son repos quand la vue d'ensemble s'ouvre est oublié
        // (choix du plan 3b : oublié, pas différé à la fermeture). Mutation : l'oubli retiré
        // d'`entrerEnsemble`.
        it('le défilement d’avant la vue d’ensemble ne lance rien pendant qu’elle est ouverte, ni à sa fermeture', () => {
          const banc = enGare()
          banc.poserA(arret(1901))
          banc.moteur.defiler(arret(1902) + 90)
          banc.moteur.basculerEnsemble(true)
          banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 400)
          expect(banc.vers()).toEqual([])
          const passage = enGare({ entree: ENTREE })
          passage.poserA(MARGE_HAUT)
          vus.length = 0
          passage.moteur.defiler(arret(1902))
          passage.moteur.basculerEnsemble(true)
          passage.filer(REPOS_DU_DEFILEMENT + 1500)
          expect(passage.vers()).toEqual([])
          expect(passageJoue()).toBe(false)
          // Sous un doigt posé, le repos attend le lever : fermée sans désigner d'endroit, la vue
          // d'ensemble ne rend pas la main à ce défilement-là.
          for (const essai of [enGare(), enGare({ entree: ENTREE })]) {
            essai.poserA(MARGE_HAUT)
            vus.length = 0
            essai.moteur.doigtsPoses(1)
            essai.moteur.defiler(arret(1902) + 90)
            essai.moteur.basculerEnsemble(true)
            essai.filer(400)
            essai.moteur.basculerEnsemble(false)
            essai.moteur.doigtsPoses(0)
            essai.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 1500)
            expect(essai.vers()).toEqual([])
            expect(passageJoue()).toBe(false)
          }
        })

        // Défaut 5, au calme : la boucle tient tant qu'un défilement attend son repos, et sous un
        // doigt posé il attend. La vue d'ensemble ouverte, plus rien ne bouge : aucune image de plus.
        // Mutation : l'oubli retiré d'`entrerEnsemble`.
        it('au calme, la vue d’ensemble ouverte, la boucle ne tient pas pour un défilement d’avant', () => {
          const banc = auTrain({ calme: true, arrets: ARRETS })
          let ms = 1000
          const tourner = (images: number) => {
            for (let i = 0; i < images && banc.demandees.length; i++) for (const f of banc.demandees.splice(0)) f((ms += 40))
          }
          tourner(50)
          expect(banc.demandees).toEqual([])
          banc.moteur.doigtsPoses(1)
          banc.moteur.defiler(arret(1902) + 90)
          // Le témoin : le doigt posé, le défilement attend, et la boucle tient.
          tourner(50)
          expect(banc.demandees.length).toBe(1)
          banc.moteur.basculerEnsemble(true)
          tourner(50)
          expect(banc.demandees).toEqual([])
          expect(banc.rappels.defilerVers).not.toHaveBeenCalled()
        })

        // Lot « moteur », tâche 2 : le second ramassable (la zone `objet`, que le monde dessine lui-même)
        // et le toucher du décor qui vaut au calme (`Monde.touchesAuCalme`).
        describe('l’objet caché et le toucher au calme (lot « moteur »)', () => {
          const devantLeManege = (options: Options = {}) => {
            const banc = monter({ objets: true, ...options })
            banc.moteur.defiler(MARGE_HAUT)
            banc.moteur.image(1000)
            return banc
          }
          const aLaFrontiere = (options: Options = {}) => {
            const banc = auTrain({ garni: true, objets: true, ...options })
            banc.moteur.defiler(CAMERA)
            banc.moteur.image(1000)
            return banc
          }
          /** Les clés dites à la page. L'endroit se lit au calme seulement : vivante, l'image tremble. */
          const cles = (banc: ReturnType<typeof monter>) => vi.mocked(banc.rappels.objet!).mock.calls.map((a) => a[0])
          const derniereVueDe = (annee: number) => vus.filter((v) => v.cases.some((c) => c.annee === annee)).pop()!

          // Mutation : la branche `objet` de `toucher` placée après la garde du calme.
          it('un objet se ramasse, au calme aussi : sa clé part, avec l’endroit, et rien d’autre', () => {
            for (const calme of [false, true]) {
              const banc = devantLeManege({ calme })
              toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
              expect(cles(banc)).toEqual([OBJET.cle])
              if (calme) expect(banc.rappels.objet).toHaveBeenCalledWith(OBJET.cle, { x: OU_OBJET.x, y: OU_OBJET.y })
              expect(banc.rappels.bobine).not.toHaveBeenCalled()
              expect(reactions).toEqual([])
            }
          })

          // Mutations : `ramasses.add` retiré de `toucher` ; la garde `ramasse(i)` retirée de
          // `VueMonde.objet` (la zone resterait devant le manège) ; la garde `ramasses.has` retirée de
          // `toucher` (la zone de l'image d'avant ramasserait encore).
          it('un objet ramassé ne se ramasse pas deux fois, et sa zone ne se touche plus', () => {
            const banc = devantLeManege()
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(false)
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            // Avant toute image neuve : la zone est encore là, la clé est déjà retenue.
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(banc.rappels.objet).toHaveBeenCalledTimes(1)
            expect(reactions).toEqual([])
            banc.moteur.image(1040)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(true)
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(banc.rappels.objet).toHaveBeenCalledTimes(1)
            expect(reactions).toEqual(['manege'])
          })

          // Mutations : `objetRamasse` qui rend faux pour un rang que le monde ne déclare pas ; une
          // zone inscrite pour ce rang (muette, de priorité 3, elle avalerait le toucher du manège).
          it('un rang inconnu passe pour ramassé, et n’inscrit aucune zone', () => {
            const banc = devantLeManege({ objets: false, objetInconnu: true })
            expect(derniereVueDe(1898).objetRamasse(7)).toBe(true)
            toucher(banc.moteur, MANEGE.x, MANEGE.y)
            expect(banc.rappels.objet).not.toHaveBeenCalled()
            expect(reactions).toEqual(['manege'])
          })

          // Le doigt est au centre du manège, à douze pixels de celui de l'objet. Mutation : la zone
          // `objet` inscrite sans sa priorité (0 au lieu de 3).
          it('la zone d’un objet passe devant le décor', () => {
            const banc = devantLeManege()
            toucher(banc.moteur, MANEGE.x, MANEGE.y)
            expect(cles(banc)).toEqual([OBJET.cle])
            expect(reactions).toEqual([])
          })

          // Mutations : `reglerObjets` qui n'alimente pas `ramasses` ; `ramasse` qui ne lit pas la table
          // (toujours faux pour un rang connu) ; la table complétée au lieu d'être remplacée.
          it('`reglerObjets` retire la zone d’un objet connu de la page, et la rend si la page l’oublie', () => {
            const banc = monter({ objets: true })
            banc.moteur.reglerObjets([OBJET.cle])
            banc.moteur.defiler(MARGE_HAUT)
            banc.moteur.image(1000)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(true)
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(banc.rappels.objet).not.toHaveBeenCalled()
            expect(reactions).toEqual(['manege'])
            banc.moteur.reglerObjets([])
            banc.moteur.image(1040)
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(cles(banc)).toEqual([OBJET.cle])
          })

          // Lot d'écrans, brief 4 : la page rend sa liste à chaque relecture de l'état du voyageur, souvent
          // avant que son écriture ait répondu. Ce qu'un toucher vient de prendre n'y est pas encore : il
          // reste pris. Mutations : `reglerObjets` tel qu'il était (la table écrasée en entier, `enMain`
          // vidé avec elle) ; `ramasse` qui ne lit pas `enMain` ; la garde `enMain.has` retirée de `toucher`.
          it('un objet que le toucher vient de prendre le reste quand la page rend sa liste sans lui', () => {
            const banc = devantLeManege()
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            banc.moteur.reglerObjets([])
            banc.moteur.image(1040)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(true)
            banc.moteur.reglerObjets(['un-autre'])
            // Avant toute image neuve, la zone de l'image d'avant ne ramasse pas non plus.
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            banc.moteur.image(1080)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(true)
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(cles(banc)).toEqual([OBJET.cle])
          })

          // L'écriture refusée ou en panne : la page rend l'objet, il revient dans le décor et se
          // retouche, au calme aussi (une image est demandée). Mutations : `rendreObjet` qui ne retire
          // rien d'`enMain` ; sans `this.demander()`.
          it('un objet rendu par la page revient dans le décor, et se retouche', () => {
            const banc = devantLeManege({ calme: true })
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            for (let i = 0; i < 50 && banc.demandees.length; i++) for (const f of banc.demandees.splice(0)) f(1040 + i)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(true)
            banc.moteur.rendreObjet(OBJET.cle)
            expect(banc.demandees.length).toBe(1)
            for (const f of banc.demandees.splice(0)) f(1200)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(false)
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(cles(banc)).toEqual([OBJET.cle, OBJET.cle])
          })

          // Confirmé par la liste de la page, l'objet ne tient plus qu'à elle : si une relecture ne le
          // nomme plus, il revient. Et le rendre après coup ne défait pas ce que la page dit ramassé.
          // Mutations : la confirmation retirée de `reglerObjets` (`enMain` jamais allégé : l'objet
          // resterait pris à jamais) ; `rendreObjet` qui retire aussi de `ramasses`.
          it('un objet que la page a confirmé ne tient plus qu’à sa liste', () => {
            const banc = devantLeManege()
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            banc.moteur.reglerObjets([OBJET.cle])
            banc.moteur.reglerObjets([])
            banc.moteur.image(1040)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(false)
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            banc.moteur.reglerObjets([OBJET.cle])
            banc.moteur.rendreObjet(OBJET.cle)
            banc.moteur.image(1080)
            expect(derniereVueDe(1898).objetRamasse(0)).toBe(true)
          })

          // Au calme la boucle s'arrête : sans image demandée, l'objet ramassé (ou que la page vient de
          // dire ramassé) resterait dessiné par son monde. Mutations : `this.demander()` retiré de
          // `reglerObjets` ; retiré de la branche `objet` de `toucher`.
          it('un objet ramassé et `reglerObjets` demandent une image, au calme aussi', () => {
            const banc = devantLeManege({ calme: true })
            let ms = 1000
            const tourner = () => {
              for (let i = 0; i < 50 && banc.demandees.length; i++) for (const f of banc.demandees.splice(0)) f((ms += 40))
            }
            tourner()
            expect(banc.demandees).toEqual([])
            toucher(banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(cles(banc)).toEqual([OBJET.cle])
            expect(banc.demandees.length).toBe(1)
            tourner()
            expect(banc.demandees).toEqual([])
            banc.moteur.reglerObjets([])
            expect(banc.demandees.length).toBe(1)
          })

          // Le doigt est sur le bas de 1890, en `y` de carte, et 1890 porte un objet au même rang.
          // Mutation : le monde lu d'après le `y` du doigt au lieu de `z.section`.
          it('la clé dite à la page est celle du monde qui a posé l’objet', () => {
            expect(CAMERA + OU_OBJET_1900.y).toBeLessThan(HAUT_1900)
            for (const calme of [false, true]) {
              const banc = aLaFrontiere({ calme })
              toucher(banc.moteur, OU_OBJET_1900.x, OU_OBJET_1900.y)
              expect(cles(banc)).toEqual([OBJET_1900.cle])
            }
          })

          // Le moteur n'inscrit que la zone : à part la lecture du repère, l'image est la même, au bit
          // près, que le monde pose un objet ou non. Mutation : un appel au contexte dans `VueMonde.objet`.
          it('le moteur ne dessine rien pour un objet', () => {
            const trait = (objets: boolean) => {
              const banc = devantLeManege({ objets, cielSage: true })
              return { banc, appels: JSON.stringify(banc.appels.filter((a) => a.nom !== 'getTransform')), toiles: JSON.stringify(banc.toiles) }
            }
            const avec = trait(true)
            const sans = trait(false)
            expect(avec.appels.length).toBeGreaterThan(1000)
            expect(avec.appels).toBe(sans.appels)
            expect(avec.toiles).toBe(sans.toiles)
            // Le témoin : l'objet était bien posé dans l'image comparée.
            toucher(avec.banc.moteur, OU_OBJET.x, OU_OBJET.y)
            expect(avec.banc.rappels.objet).toHaveBeenCalledTimes(1)
          })

          // Mutations : `touchesAuCalme` ignoré (la garde du calme nue) ; la garde retirée.
          it('au calme, le décor ne réagit que pour un identifiant que son monde déclare, et sous une vue immobile', () => {
            const declare = devantLeManege({ objets: false, calme: true, auCalme: { 1890: ['manege'] } })
            toucher(declare.moteur, MANEGE.x, MANEGE.y)
            expect(reactions).toEqual(['manege'])
            expect(vuesDesReactions.map((v) => v.vivant)).toEqual([false])
            const autre = devantLeManege({ objets: false, calme: true, auCalme: { 1890: ['rideau'] } })
            toucher(autre.moteur, MANEGE.x, MANEGE.y)
            expect(reactions).toEqual([])
            // Hors calme, la déclaration ne change rien : tout décor réagit.
            const vivant = devantLeManege({ objets: false, auCalme: { 1890: ['rideau'] } })
            toucher(vivant.moteur, MANEGE.x, MANEGE.y)
            expect(reactions).toEqual(['manege'])
            expect(vuesDesReactions.map((v) => v.vivant)).toEqual([true])
          })

          // Mutation : la déclaration lue chez un autre monde que celui qui a inscrit la zone (le
          // monde sous le `y` du doigt, ou n'importe quel monde du plan).
          it('au calme, la déclaration d’un autre monde ne vaut pas pour la zone', () => {
            expect(CAMERA + OU_SEMAPHORE.y).toBeLessThan(HAUT_1900)
            const chezLAutre = aLaFrontiere({ calme: true, auCalme: { 1890: ['semaphore'] } })
            toucher(chezLAutre.moteur, OU_SEMAPHORE.x, OU_SEMAPHORE.y)
            expect(reagis).toEqual([])
            const chezLui = aLaFrontiere({ calme: true, auCalme: { 1900: ['semaphore'] } })
            toucher(chezLui.moteur, OU_SEMAPHORE.x, OU_SEMAPHORE.y)
            expect(reagis).toEqual([{ decennie: 1900, id: 'semaphore' }])
          })
        })

        // Lot d'écrans, brief 9 : la carte en sait plus. Le monde reçoit l'horaire d'une année et les
        // haltes de sa section ; la septième zone du moteur, `aiguillage`, dit la clé de sa halte à la
        // page. Rien ne se dessine : aucun de ces tests ne regarde un trait.
        describe('l’horaire, les haltes et l’aiguillage (lot d’écrans, brief 9)', () => {
          const HORAIRE: HoraireVue = { etat: 'accepte', echeance: '2026-10-11' }
          /** 1903 en cours, la frontière à l'écran ; `etat` : ce que la page ajoute aux cases et à l'état. */
          const aLaFrontiere = (options: Options = {}, haltes: readonly HalteVue[] | null = HALTES) => {
            const banc = auTrain({ enCours: 1903, aiguillages: true, ...options })
            const cases = banc.cases.map((c): CaseCarte => (c.annee === 1902 ? { ...c, horaire: HORAIRE } : c.annee === 1901 ? { ...c, horaire: null } : c))
            banc.moteur.majEtat({ cases, anneeAvatar: 1903, tampons: [], tickets: [], roulotte: null, ...(haltes ? { haltes } : null) })
            banc.moteur.defiler(CAMERA)
            banc.moteur.image(1000)
            return banc
          }
          const devantLeManege = (options: Options = {}, haltes: readonly HalteVue[] = HALTES) => {
            const banc = monter(options)
            banc.moteur.majEtat({ cases: banc.cases, anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null, haltes })
            banc.moteur.defiler(MARGE_HAUT)
            banc.moteur.image(1000)
            return banc
          }
          const cles = (banc: ReturnType<typeof monter>) => vi.mocked(banc.rappels.aiguillage!).mock.calls.map((a) => a[0])
          const derniereVueDe = (annee: number) => vus.filter((v) => v.cases.some((c) => c.annee === annee)).pop()!

          // Mutations : le champ oublié dans `vueMonde` ; `?? null` retiré (une case sans horaire, ou
          // dont la page n'a rien dit, se lirait `undefined`).
          it('l’horaire d’une case arrive au monde tel que la page le donne, et nul pour une case qui n’en a pas', () => {
            aLaFrontiere()
            const horaires = new Map(derniereVueDe(1902).cases.map((c) => [c.annee, c.horaire]))
            expect(horaires.get(1902)).toEqual(HORAIRE)
            // 1901 : nul dit par la page ; 1903 : le champ absent de la case ; 1905 : une année fermée.
            expect(horaires.get(1901)).toBeNull()
            expect(horaires.get(1903)).toBeNull()
            expect(horaires.get(1905)).toBeNull()
            expect(derniereVueDe(1897).cases.map((c) => c.horaire)).toEqual([null, null, null, null, null])
          })

          // Mutations : `haltes: this.etat.haltes ?? []` (chaque monde les recevrait toutes) ; le filtre
          // sur la décennie de la section au lieu de ses années ne se distingue pas ici, et n'est pas gardé.
          it('un monde reçoit les haltes qui s’embranchent après une de ses années, dans l’ordre de la page, et aucune sans halte servie', () => {
            aLaFrontiere()
            expect(derniereVueDe(1902).haltes).toEqual([HALTE_MELIES, HALTE_ZECCA])
            expect(derniereVueDe(1897).haltes).toEqual([HALTE_DE_LA_FOIRE])
            // L'état sans le champ (un banc d'avant le brief), puis vide.
            aLaFrontiere({}, null)
            expect(derniereVueDe(1902).haltes).toEqual([])
            expect(derniereVueDe(1897).haltes).toEqual([])
            aLaFrontiere({}, [])
            expect(derniereVueDe(1902).haltes).toEqual([])
          })

          // Mutations : `aiguillage` retiré des identifiants du moteur (le toucher irait à `reagir`) ;
          // sa branche placée après la garde du calme ; le rang lu dans la liste entière (le rang 0 de
          // la ligne dirait la halte de la foire).
          it('un aiguillage touché dit à la page la clé de sa halte, au calme aussi, et jamais à `reagir`', () => {
            for (const calme of [false, true]) {
              const banc = aLaFrontiere({ calme })
              toucher(banc.moteur, ouAiguillage1900(0).x, ouAiguillage1900(0).y)
              expect(cles(banc)).toEqual(['melies'])
              toucher(banc.moteur, ouAiguillage1900(1).x, ouAiguillage1900(1).y)
              expect(cles(banc)).toEqual(['melies', 'zecca'])
              expect(reagis).toEqual([])
              expect(banc.rappels.objet).not.toHaveBeenCalled()
              expect(banc.rappels.date).not.toHaveBeenCalled()
              expect(banc.rappels.toucherAnnee).not.toHaveBeenCalled()
            }
          })

          // Mutation : les haltes lues au monde sous le `y` de carte du doigt au lieu de `z.section`
          // ne se distingue pas ici (le manège est dans 1890) ; celle-ci tient l'autre moitié de la
          // règle du rang : la foire lit sa halte, pas la première de la ligne.
          it('l’aiguillage de la foire dit la halte de la foire', () => {
            const banc = devantLeManege({ aiguillages: true }, [HALTE_MELIES, HALTE_DE_LA_FOIRE])
            toucher(banc.moteur, MANEGE.x, MANEGE.y)
            expect(cles(banc)).toEqual(['la-baraque'])
            expect(reactions).toEqual([])
          })

          // `halte` est la petite gare au bout de la foire, pas un embranchement (constat 5 du plan) :
          // sa zone reste au monde, une halte servie au rang de sa `data` ou non, et au calme par
          // `touchesAuCalme` comme avant. Mutation : `halte` joint à `aiguillage` dans la branche du moteur.
          it('la zone `halte` de la foire va toujours à `reagir`, jamais au rappel de l’aiguillage', () => {
            for (const calme of [false, true]) {
              const banc = devantLeManege({ halteDeLaFoire: true, calme, auCalme: { 1890: ['halte'] } })
              toucher(banc.moteur, MANEGE.x, MANEGE.y)
              expect(reactions).toEqual(['halte'])
              expect(banc.rappels.aiguillage).not.toHaveBeenCalled()
            }
          })

          // Un aiguillage est au moteur, avec ou sans halte à son rang : le monde ne le reçoit jamais.
          // Mutation : `z.data !== null` dans la condition de la branche (sans rang, il irait à
          // `reagir`) ; `return` gardé au seul cas d'une halte trouvée (le rang inconnu irait à `reagir`).
          it('un aiguillage sans rang, ou d’un rang qu’aucune halte ne tient, ne dit rien, ni à la page ni au monde', () => {
            for (const aiguillagePerdu of ['nu', 'inconnu'] as const) {
              for (const calme of [false, true]) {
                const banc = devantLeManege({ aiguillagePerdu, calme })
                toucher(banc.moteur, MANEGE.x, MANEGE.y)
                expect(banc.rappels.aiguillage).not.toHaveBeenCalled()
                expect(reactions).toEqual([])
              }
            }
            // Le témoin : sans cette zone, le manège est bien sous le doigt.
            const temoin = devantLeManege()
            toucher(temoin.moteur, MANEGE.x, MANEGE.y)
            expect(reactions).toEqual(['manege'])
          })
        })

        describe('les mineurs de la caméra laissés par le lot 2 (lot « moteur »)', () => {
          const PASSAGE = auTempo(ENTREE[0]!.arret + ENTREE[1]!.duree + ENTREE[1]!.arret + ENTREE[2]!.duree + ENTREE[2]!.arret)
          /** La boucle du moteur, pour qui veut savoir si elle tient : les images demandées, jouées une à une. */
          const boucle = (banc: Banc) => {
            let ms = 1000
            return (images: number) => {
              for (let i = 0; i < images && banc.demandees.length; i++) for (const f of banc.demandees.splice(0)) f((ms += 40))
            }
          }

          // L'intervalle `attendu` ne retombait à nul que par un défilement tombé hors de lui : son
          // écho rendu, il restait, et le geste qui s'y arrêtait ensuite passait pour un second écho.
          // Mutation : dans `constaterLeDefilement`, l'intervalle laissé en place après son écho
          // (`this.attendu = null` gardé pour le seul défilement tombé dehors).
          it('l’écho de la fin du passage une fois rendu, un geste d’un pixel au même endroit reste un geste', async () => {
            const banc = enGare({ entree: ENTREE })
            banc.poserA(arret(1905))
            const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
            enEcho(banc, PASSAGE + 80)
            await Promise.resolve()
            expect(bonjour.fini).toBe(true)
            expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(ZONE.bas)
            // Le témoin : l'écho est rendu, et rien ne bouge.
            const n = banc.vers().length
            enEcho(banc, REPOS_DU_DEFILEMENT + ROULEMENT + 400)
            expect(banc.vers().length).toBe(n)
            // Le geste : un pixel vers le bas, entre deux arrêts. La caméra est rappelée au plus proche.
            expect(arret(1904) - (ZONE.bas + 1)).toBeLessThan(ZONE.bas + 1 - arret(1903))
            banc.moteur.defiler(ZONE.bas + 1)
            banc.filer(REPOS_DU_DEFILEMENT + ROULEMENT + 200)
            expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1904))
          })

          // Ce que l'écho rendu lève, c'est le dernier point d'une caméra qui ne glisse plus. Tant
          // qu'elle suit l'avatar, l'intervalle tient : une page en retard rend deux valeurs à la
          // file, et la seconde, privée de son intervalle par la première, passait pour un geste parti
          // d'au-dessus de la zone des temps. Mutation : l'intervalle levé à tout écho, que la caméra
          // glisse ou non.
          it('la caméra qui suit l’avatar garde son intervalle tant qu’elle glisse, même son écho rendu', async () => {
            const banc = enGare({ ailleurs: true, entree: ENTREE })
            const cible = cibleCamera(yDeLaCase(banc, 1899), H, banc.moteur.hauteur)
            expect(dansLaZone(cible)).toBe(true)
            vi.mocked(banc.rappels.defilerVers).mockClear()
            vus.length = 0
            const marche = banc.temoin(banc.moteur.marcher(1899))
            banc.filer(80)
            // La page, en retard de deux images, les rend à la file : la première d'au-dessus de la zone.
            const [premier, second] = banc.vers()
            expect(banc.vers().length).toBe(2)
            expect(premier!).toBeLessThan(ZONE.haut)
            expect(second! - premier!).toBeGreaterThan(A_L_ARRET)
            // Un doigt reste posé sans rien mener : le repos ne se constatera qu'à son lever, la caméra arrivée.
            banc.moteur.doigtsPoses(1)
            banc.moteur.defiler(premier!)
            banc.moteur.defiler(second!)
            enEcho(banc, 4000)
            await Promise.resolve()
            expect(marche.fini).toBe(true)
            banc.moteur.doigtsPoses(0)
            enEcho(banc, REPOS_DU_DEFILEMENT + 1500)
            expect(passageJoue()).toBe(false)
            expect(Math.abs(banc.vers()[banc.vers().length - 1]! - cible)).toBeLessThan(1.5)
          })

          // `achever` pose la visée d'un coup, sans dire qu'il en attend l'écho : hors de l'intervalle
          // du chemin déjà fait, cet écho passait pour un geste, et, au calme, posait l'arrêt du dessus.
          // Le chantier d'essai est placé de sorte que la visée tombe entre deux arrêts de 1900 : c'est
          // le meneur qu'on éprouve, pas la géographie d'un monde. Mutation : `this.attendu = …` retiré
          // de la pose de la visée, dans `achever`.
          it('l’écho de la visée achevée par le calme ne pose pas d’arrêt', () => {
            const cible = arret(1902) + 90
            const banc = enGare({ ailleurs: true, chantier1898: cible + H / 2 - MARGE_HAUT })
            vi.mocked(banc.rappels.defilerVers).mockClear()
            banc.moteur.ouvrirSousLesYeux(1898)
            enEcho(banc, 200)
            // Le témoin : la caméra glisse, elle est en chemin.
            expect(banc.vers().length).toBeGreaterThan(2)
            expect(banc.vers()[banc.vers().length - 1]!).toBeLessThan(cible - 100)
            banc.moteur.reglerCalme(true)
            expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(cible)
            const n = banc.vers().length
            banc.moteur.defiler(Math.round(cible))
            banc.filer(REPOS_DU_DEFILEMENT + 600)
            expect(banc.vers().length).toBe(n)
            // Un vrai geste, ensuite, n'est pas avalé : au calme, il pose l'arrêt suivant dans son sens.
            banc.moteur.defiler(cible + 30)
            expect(banc.vers().slice(n)).toEqual([arret(1903)])
          })

          // La jumelle : `achever` pose le roulement à son arrêt, et la garde du roulement tombe avec
          // lui. À un arrêt, l'écho pris pour un geste ne rappelle rien, mais il date un défilement :
          // la boucle tient pour lui, le temps de constater son repos. Mutation : `this.attendu = …`
          // retiré de la pose du roulement, dans `achever`.
          it('l’écho du roulement achevé par le calme ne date aucun défilement : la boucle ne tient pas pour lui', async () => {
            const banc = enGare()
            const tourner = boucle(banc)
            banc.poserA(arret(1900))
            const marche = banc.temoin(banc.moteur.marcher(1901))
            tourner(3)
            // Le témoin : la caméra roule, elle est en chemin, et la boucle tient.
            expect(banc.vers().length).toBeGreaterThan(0)
            expect(banc.vers()[banc.vers().length - 1]!).toBeLessThan(arret(1901) - A_L_ARRET)
            expect(banc.demandees.length).toBe(1)
            banc.moteur.reglerCalme(true)
            await Promise.resolve()
            expect(marche.fini).toBe(true)
            expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1901))
            tourner(50)
            expect(banc.demandees).toEqual([])
            // L'écho : il demande son image, et rien après elle.
            banc.moteur.defiler(Math.round(arret(1901)))
            expect(banc.demandees.length).toBe(1)
            tourner(1)
            expect(banc.demandees).toEqual([])
            // Le second témoin : un geste, lui, date son défilement, et la boucle tient.
            banc.moteur.doigtsPoses(1)
            banc.moteur.defiler(arret(1901) + 30)
            tourner(1)
            expect(banc.demandees.length).toBe(1)
          })

          // Le doigt qui se pose reprend la caméra au rappel ; sous la vue d'ensemble, il touche une
          // bande, pas la carte, et il arrêtait quand même le rappel, laissant la caméra entre deux
          // arrêts tant qu'il restait posé. Mutation : `if (this.terrain.ensemble()) return` retiré de
          // `reprendreLaCamera`.
          it.each([
            { par: 'le pointeur', poser: (b: Banc): void => b.moteur.pointeur('bas', 200, 300, false) },
            { par: 'les touchers', poser: (b: Banc): void => b.moteur.doigtsPoses(1) },
          ])('sous la vue d’ensemble, un doigt posé n’arrête pas le rappel en cours ($par)', ({ poser }) => {
            const banc = enGare()
            banc.poserA(arret(1901))
            banc.moteur.defiler(arret(1902) + 90)
            banc.filer(REPOS_DU_DEFILEMENT + 120)
            // Le témoin : le rappel roule, il n'est pas arrivé.
            expect(banc.vers().length).toBeGreaterThan(0)
            expect(banc.vers()[banc.vers().length - 1]!).toBeGreaterThan(arret(1902) + A_L_ARRET)
            banc.moteur.basculerEnsemble(true)
            poser(banc)
            banc.filer(ROULEMENT + 200)
            expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1902))
          })

          // Le jumeau du défaut 2 : le doigt posé sur une case avant le passage, et qui y reste. Aucun
          // lever n'annulait son appui : la minuterie de `Geste` ouvrait l'aperçu pendant le passage.
          // Mutation : `this.geste.annulerAppui()` retiré de `MoteurCarte.direBonjour`.
          it('le doigt resté posé quand le passage commence n’ouvre pas d’aperçu', () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
            try {
              const GARES = Array.from({ length: 10 }, (_, i) => 700 + i * 130)
              const TEMPS: TempsDEntree[] = [{ y: -100, duree: 7000, arret: 200 }, { y: 300, duree: 500, arret: 100 }, { y: 700, duree: 800, arret: 300 }]
              const banc = enGare({ arrets: GARES, entree: TEMPS })
              banc.poserA(HAUT_1900 + GARES[0]!)
              const p = quai(1900)!
              // Le témoin : sans passage, le même doigt tenu ouvre l'aperçu.
              banc.moteur.pointeur('bas', p.x, p.y, false)
              vi.advanceTimersByTime(APPUI_LONG_MS)
              expect(banc.rappels.apercu).toHaveBeenCalledTimes(1)
              banc.moteur.pointeur('haut', p.x, p.y, false)
              vi.mocked(banc.rappels.apercu).mockClear()
              // Le doigt posé avant le passage, et qui ne se lève pas.
              banc.moteur.pointeur('bas', p.x, p.y, false)
              void banc.moteur.direBonjour(1900, 'endroit')
              banc.filer(80)
              vi.advanceTimersByTime(APPUI_LONG_MS + 100)
              expect(banc.rappels.apercu).not.toHaveBeenCalled()
              // Le second témoin : un passage qui ne joue rien (un monde sans temps) laisse l'appui courir.
              const sans = enGare({ arrets: GARES })
              sans.poserA(HAUT_1900 + GARES[0]!)
              sans.moteur.pointeur('bas', p.x, p.y, false)
              void sans.moteur.direBonjour(1900, 'endroit')
              vi.advanceTimersByTime(APPUI_LONG_MS)
              expect(sans.rappels.apercu).toHaveBeenCalledTimes(1)
              // Au calme, le passage ne joue pas mais pose la caméra ailleurs, sous le doigt : son appui tombe aussi.
              // Mutation : la clause `this.camY !== avant` retirée.
              const calme = enGare({ arrets: GARES, entree: TEMPS, calme: true })
              calme.poserA(HAUT_1900 + GARES[0]!)
              calme.moteur.pointeur('bas', p.x, p.y, false)
              void calme.moteur.direBonjour(1900, 'envers')
              expect(calme.vers()).toEqual([HAUT_1900 + TEMPS[0]!.y])
              vi.advanceTimersByTime(APPUI_LONG_MS + 100)
              expect(calme.rappels.apercu).not.toHaveBeenCalled()
            } finally {
              vi.useRealTimers()
            }
          })
        })

        describe('le glissement horizontal (lot « moteur »)', () => {
          const OU = { x: 200, y: 300 }
          /** Un doigt posé loin de toute case, qui part de trente pixels vers la droite : le geste est décidé. */
          const commencer = (moteur: MoteurCarte, y = OU.y) => {
            moteur.pointeur('bas', OU.x, y, false)
            moteur.pointeur('bouge', OU.x + 30, y, false)
          }
          const phases = () => glisses.map((x) => `${x.decennie}:${x.g.phase}`)
          /** La caméra posée à `camY`, une image jouée. */
          const aLEcran = (camY: number, options: Options = {}) => {
            const banc = monter({ collant: true, calme: true, glisser: { 1890: true, 1900: true }, ...options })
            banc.moteur.defiler(camY)
            banc.moteur.image(1000)
            return banc
          }
          /** Les deux mondes sont à l'écran et présents à 1 : le mélange seul tranche. */
          const SUR_1890 = HAUT_1900 - (3 * H) / 4
          const SUR_1900 = HAUT_1900 - H / 4

          // Le doigt est chaque fois posé sur la part d'écran de l'autre monde : 1900 tient le bas de
          // l'écran (sous 525 px, puis sous 175 px). À mi-écran les deux poids sont égaux, et c'est le
          // premier, comme pour `Rappels.presences`. Mutations : le premier monde du plan
          // (`sections[0]`) ; le monde sous le `y` du doigt ; le dernier des égaux (`lastIndexOf`
          // dans `sectionALEcran`) ; `vueMonde(section, 0.5)`.
          it('va au monde de la décennie à l’écran, celle que le moteur dit à la page, avec une vue de présence 1', () => {
            for (const [camY, decennie, y] of [[SUR_1890, 1890, 600], [SUR_1900, 1900, 100], [HAUT_1900 - H / 2, 1890, 600]] as const) {
              const banc = aLEcran(camY)
              // Le témoin : c'est la décennie que `dessiner` nomme.
              expect(vi.mocked(banc.rappels.presences).mock.lastCall![1]).toBe(decennie)
              commencer(banc.moteur, y)
              expect(phases()).toEqual([`${decennie}:debut`])
              expect(glisses[0]!.g).toEqual({ phase: 'debut', x: OU.x + 30, y, x0: OU.x, y0: y })
              expect(glisses[0]!.v.presence).toBe(1)
              expect(glisses[0]!.v.cases.some((c) => c.annee === decennie + 5)).toBe(true)
            }
          })

          // Mutation : la section relue à chaque signal au lieu d'être retenue au début.
          it('la suite et la fin vont au monde du début, où que la caméra soit passée entre-temps', () => {
            const banc = aLEcran(SUR_1890)
            commencer(banc.moteur)
            banc.moteur.defiler(HAUT_1900)
            banc.moteur.image(1040)
            expect(vi.mocked(banc.rappels.presences).mock.lastCall![1]).toBe(1900)
            banc.moteur.pointeur('bouge', OU.x + 60, OU.y - 40, false)
            banc.moteur.pointeur('haut', OU.x + 61, OU.y - 41, false)
            expect(phases()).toEqual(['1890:debut', '1890:suite', '1890:fin'])
            expect(glisses[2]!.g).toEqual({ phase: 'fin', x: OU.x + 61, y: OU.y - 41, x0: OU.x, y0: OU.y })
          })

          // Mutations : le retour de `glisser` ignoré (le monde qui refuse recevrait la suite, et la
          // page retiendrait le défilement) ; `glissePris` vrai dès le début, pris ou non.
          it('un monde qui refuse le début ne reçoit plus rien de cet appui, et le geste n’est pas pris', () => {
            const banc = aLEcran(SUR_1890, { glisser: { 1890: false, 1900: true } })
            commencer(banc.moteur)
            expect(banc.moteur.glissePris).toBe(false)
            banc.moteur.pointeur('bouge', OU.x + 60, OU.y, false)
            banc.moteur.pointeur('haut', OU.x + 60, OU.y, false)
            expect(phases()).toEqual(['1890:debut'])
            expect(banc.moteur.glissePris).toBe(false)
          })

          // Mutations : `this.glissement = null` retiré de la fin (la page retiendrait le défilement
          // pour toujours) ; la fin non livrée au monde.
          it('un geste pris l’est du début à la fin, au lever comme à l’annulation, et le monde reçoit sa fin', () => {
            for (const fin of ['haut', 'annule'] as const) {
              const banc = aLEcran(SUR_1900)
              expect(banc.moteur.glissePris).toBe(false)
              commencer(banc.moteur)
              expect(banc.moteur.glissePris).toBe(true)
              banc.moteur.pointeur('bouge', OU.x + 60, OU.y, false)
              expect(banc.moteur.glissePris).toBe(true)
              banc.moteur.pointeur(fin, OU.x + 70, OU.y, false)
              expect(banc.moteur.glissePris).toBe(false)
              expect(phases()).toEqual(['1900:debut', '1900:suite', '1900:fin'])
            }
          })

          // 1890 et le monde « à venir » : `glisser` nul. Mutation : le geste dit pris sans monde pour le prendre.
          it('un monde sans glisser ne prend rien, et un geste vertical ne lui est pas livré', () => {
            const sans = aLEcran(SUR_1890, { glisser: {} })
            commencer(sans.moteur)
            expect(sans.moteur.glissePris).toBe(false)
            const banc = aLEcran(SUR_1900)
            banc.moteur.pointeur('bas', OU.x, OU.y, false)
            banc.moteur.pointeur('bouge', OU.x + 2, OU.y - 40, false)
            banc.moteur.pointeur('bouge', OU.x + 80, OU.y - 42, false)
            expect(glisses).toEqual([])
            expect(banc.moteur.glissePris).toBe(false)
          })

          // Une manipulation, pas une animation. Mutation : `if (this.calme) return` en tête de `glisser`.
          it('se reçoit au calme comme en mouvement, et la vue dit lequel', () => {
            for (const calme of [false, true]) {
              const banc = aLEcran(SUR_1900, { calme })
              commencer(banc.moteur)
              expect(phases()).toEqual(['1900:debut'])
              expect(glisses[0]!.v.vivant).toBe(!calme)
            }
          })

          // Mutation : `this.demander()` retiré de `glisser` (au calme la boucle dort : l'essuyage ne se verrait pas).
          it('demande une image à chaque glissement livré, et aucune pour un glissement refusé', () => {
            const vider = (banc: ReturnType<typeof monter>) => {
              let ms = 1000
              for (let i = 0; i < 200 && banc.demandees.length; i++) for (const f of banc.demandees.splice(0)) f((ms += 40))
              // Le témoin : la boucle dort.
              expect(banc.demandees).toHaveLength(0)
            }
            for (const [pris, attendues] of [[true, 1], [false, 0]] as const) {
              const banc = aLEcran(SUR_1900, { glisser: { 1900: pris } })
              vider(banc)
              // Le témoin : le doigt qui se pose ne réveille rien.
              banc.moteur.pointeur('bas', OU.x, OU.y, false)
              expect(banc.demandees).toHaveLength(0)
              banc.moteur.pointeur('bouge', OU.x + 30, OU.y, false)
              expect(banc.demandees).toHaveLength(attendues)
            }
          })

          // Le 1 × 3 du balayage : le passage qui commence annule l'appui, donc finit l'essuyage.
          // Mutation : `this.geste.annulerAppui()` retiré de `MoteurCarte.direBonjour`.
          it('un passage qui commence finit le glissement en cours, et le doigt resté posé ne glisse plus', () => {
            const GARES = Array.from({ length: 10 }, (_, i) => 700 + i * 130)
            const TEMPS: TempsDEntree[] = [{ y: -100, duree: 7000, arret: 200 }, { y: 300, duree: 500, arret: 100 }, { y: 700, duree: 800, arret: 300 }]
            const banc = enGare({ arrets: GARES, entree: TEMPS, glisser: { 1900: true } })
            banc.poserA(HAUT_1900 + GARES[0]!)
            commencer(banc.moteur)
            expect(banc.moteur.glissePris).toBe(true)
            void banc.moteur.direBonjour(1900, 'endroit')
            expect(banc.moteur.glissePris).toBe(false)
            expect(phases()).toEqual(['1900:debut', '1900:fin'])
            banc.filer(80)
            banc.moteur.pointeur('bouge', OU.x + 90, OU.y, false)
            expect(phases()).toEqual(['1900:debut', '1900:fin'])
          })

          // Sous la vue d'ensemble `pointeur` ne relaie plus rien au geste : le lever n'y finirait rien.
          // Mutation : `this.geste.annulerAppui()` retiré d'`entrerEnsemble`.
          it('la vue d’ensemble qui s’ouvre finit le glissement en cours', () => {
            const banc = aLEcran(SUR_1900)
            commencer(banc.moteur)
            banc.moteur.basculerEnsemble(true)
            expect(banc.moteur.glissePris).toBe(false)
            expect(phases()).toEqual(['1900:debut', '1900:fin'])
            // Et rien n'y commence.
            commencer(banc.moteur)
            expect(phases()).toEqual(['1900:debut', '1900:fin'])
          })

          // La souris sort de la toile, bouton tenu : son lever n'arrivera pas (aucune capture du
          // pointeur). Mutation : le glissement ouvert laissé tel quel par `Geste.quitter`.
          it('la souris qui quitte la toile finit le glissement en cours, et revenue sans bouton ne glisse plus', () => {
            const banc = aLEcran(SUR_1900)
            banc.moteur.pointeur('bas', OU.x, OU.y, true)
            banc.moteur.pointeur('bouge', OU.x + 30, OU.y, true)
            expect(banc.moteur.glissePris).toBe(true)
            banc.moteur.pointeur('quitte', OU.x + 30, OU.y, true)
            expect(banc.moteur.glissePris).toBe(false)
            expect(phases()).toEqual(['1900:debut', '1900:fin'])
            banc.moteur.pointeur('bouge', OU.x + 90, OU.y, true)
            expect(phases()).toEqual(['1900:debut', '1900:fin'])
          })

          // Deux doigts qui se resserrent bougent à l'horizontale : ce n'est pas un essuyage.
          // Mutation : la garde `this.pincement !== null` retirée du début.
          it('aucun glissement ne commence pendant un pincement', () => {
            const banc = aLEcran(SUR_1900)
            banc.moteur.pincer(100, 195, 300)
            commencer(banc.moteur)
            expect(glisses).toEqual([])
            expect(banc.moteur.glissePris).toBe(false)
            // Le témoin : les deux doigts relâchés, le même geste glisse.
            banc.moteur.pointeur('haut', OU.x + 30, OU.y, false)
            banc.moteur.pincer(null, 0, 0)
            commencer(banc.moteur)
            expect(phases()).toEqual(['1900:debut'])
          })

          // Un glissement n'est jamais un toucher : parti d'une case, il n'ouvre pas son année.
          // Mutation : `toucher` appelé à la fin d'un glissement.
          it('un glissement parti d’une case ne la touche pas', () => {
            const banc = auTrain({ calme: true, glisser: { 1900: true } })
            banc.moteur.defiler(CAMERA)
            banc.moteur.image(1000)
            const p = quai(1900)!
            // Le témoin : la case se touche.
            toucher(banc.moteur, p.x, p.y)
            expect(banc.rappels.toucherAnnee).toHaveBeenCalledTimes(1)
            banc.moteur.pointeur('bas', p.x, p.y, false)
            banc.moteur.pointeur('bouge', p.x + 14, p.y, false)
            banc.moteur.pointeur('haut', p.x + 14, p.y, false)
            expect(banc.rappels.toucherAnnee).toHaveBeenCalledTimes(1)
          })
        })
      })
      describe('le ralenti du roulement (lot « moteur »)', () => {
        /** Entre l'arrêt de 1901 (200) et celui de 1902 (400) : 100 px au quart de la vitesse. Le trajet de l'un à l'autre coûte 500 pour 200 px. */
        const LENT: Ralenti = { de: 250, a: 350, allure: 0.25 }
        const ALLONGE = (200 + 100 * 3) / 200
        /** Les positions que le moteur a dites à la page, image par image, jusqu'à ce qu'il se taise `duree` millisecondes durant. */
        const rouler = (banc: ReturnType<typeof enGare>, duree: number) => {
          banc.filer(duree)
          return banc.vers()
        }

        // L'invariant premier : un roulement dont le trajet ne croise aucun ralenti est, au bit
        // près, celui d'un monde qui n'en déclare aucun, à la même image. Le monde en déclare ici
        // plus haut (leur coût, qui ne tombe pas juste et passe 4096, change l'arrondi de tout ce
        // qui se calculerait par lui : à coût voisin du `y`, les deux calculs rendent les mêmes
        // bits et le test ne garderait rien), aux deux bords du premier trajet, qu'ils ne font que
        // toucher, et un d'allure 1 en plein milieu.
        // Mutations : le filtre de `trajetRalenti` retiré (tout ralenti déclaré passerait par le
        // coût) ; `defiler` qui passerait `scrollTop` par le coût. Le bord touché compté (`>=`) et
        // l'allure de 1 passée par le coût rendent ici les mêmes bits : c'est `geometrie.test.ts`
        // qui les refuse, sur `trajetRalenti` rendu nul.
        it('sans ralenti sur son trajet, un roulement dit les mêmes positions aux mêmes images qu’un monde sans ralenti', async () => {
          const AILLEURS: Ralenti[] = [{ de: 250, a: 350, allure: 0.02 }, { de: 633.3, a: 777.7, allure: 0.3 }, { de: 790, a: 800, allure: 0.5 }, { de: 850, a: 950, allure: 1 }, { de: 1000, a: 1100, allure: 0.5 }]
          for (const [de, vers] of [[1904, 1905], [1905, 1904], [1906, 1907], [1908, 1907], [1908, 1909], [1909, 1906]] as const) {
            const trajets = [[], AILLEURS].map((ralentis) => {
              const banc = enGare({ ralentis, enCours: 1909 })
              banc.poserA(arret(de))
              const marche = banc.temoin(banc.moteur.marcher(vers))
              return { banc, marche }
            })
            for (const t of trajets) t.banc.filer(ROULEMENT - 40)
            await Promise.resolve()
            expect(trajets.map((t) => t.marche.fini)).toEqual([false, false])
            for (const t of trajets) t.banc.filer(80)
            await Promise.resolve()
            expect(trajets.map((t) => t.marche.fini)).toEqual([true, true])
            const [sans, avec] = trajets.map((t) => t.banc.vers())
            expect(sans!.length).toBeGreaterThan(20)
            expect(sans![sans!.length - 1]).toBe(arret(vers))
            expect(avec).toEqual(sans)
          }
        })

        // Mutations : la durée non multipliée dans `rouler` (`dur` seul) ; `r.lent` oublié dans
        // `avancer` (la droite : l'arrivée tiendrait, pas le chemin) ; `s.y0` oublié dans
        // `MoteurCarte.ralentis` (le ralenti tomberait dans 1890, hors du trajet) ; l'inverse du
        // coût décalé d'un intervalle (la caméra reculerait, ou sortirait du trajet).
        it('un roulement qui traverse un ralenti dure plus longtemps du coût de son trajet, arrive à son arrêt et rappelle fin', async () => {
          const banc = enGare({ ralentis: [LENT], enCours: 1905 })
          banc.poserA(arret(1901))
          const marche = banc.temoin(banc.moteur.marcher(1902))
          // La durée de base passée, il roule encore.
          banc.filer(ROULEMENT + 80)
          await Promise.resolve()
          expect(marche.fini).toBe(false)
          expect(banc.vers()[banc.vers().length - 1]).toBeLessThan(arret(1902) - 20)
          banc.filer(ROULEMENT * ALLONGE - (ROULEMENT + 80) - 40)
          await Promise.resolve()
          expect(marche.fini).toBe(false)
          banc.filer(80)
          await Promise.resolve()
          expect(marche.fini).toBe(true)
          const dites = banc.vers()
          expect(dites[dites.length - 1]).toBe(arret(1902))
          dites.forEach((y, i) => {
            expect(y).toBeGreaterThanOrEqual(i ? dites[i - 1]! : arret(1901))
            expect(y).toBeLessThanOrEqual(arret(1902) + 1e-9)
          })
          // Arrivée, elle ne bouge plus.
          const n = dites.length
          banc.filer(600)
          expect(banc.vers().length).toBe(n)
        })

        // Au même instant de la courbe (la même part de la durée de chacun), le roulement ralenti
        // va, hors de l'intervalle, à la vitesse du roulement libre, et dedans à cette vitesse
        // multipliée par l'allure. Les deux durées (1200 et 3000 ms) tombent sur les images : deux
        // images du libre valent cinq du ralenti.
        // Mutations : l'allure lue à l'envers (`r.allure - 1` dans `coutDe`) ; la durée non
        // multipliée (dehors, la caméra irait `ALLONGE` fois trop vite) ; `r.lent` oublié.
        it('dans l’intervalle, la caméra roule à la vitesse d’un roulement libre multipliée par l’allure ; hors de lui, à la même', () => {
          const [libre, lent] = [[], [LENT]].map((ralentis) => {
            const banc = enGare({ ralentis, enCours: 1905 })
            banc.poserA(arret(1901))
            void banc.moteur.marcher(1902)
            return [arret(1901), ...rouler(banc, ROULEMENT * ALLONGE)]
          })
          expect(libre).toHaveLength(1 + ROULEMENT / 40)
          expect(lent).toHaveLength(1 + (ROULEMENT * ALLONGE) / 40)
          const haut = HAUT_1900 + LENT.de
          const bas = HAUT_1900 + LENT.a
          const vus = { avant: 0, dedans: 0, apres: 0 }
          for (let m = 0; m < ROULEMENT / 80; m++) {
            const [a, b] = [lent![5 * m]!, lent![5 * m + 5]!]
            const rapport = (b - a) / 200 / ((libre![2 * m + 2]! - libre![2 * m]!) / 80)
            if (b <= haut || a >= bas) {
              expect(rapport).toBeCloseTo(1, 9)
              vus[b <= haut ? 'avant' : 'apres']++
            } else if (a >= haut && b <= bas) {
              expect(rapport).toBeCloseTo(LENT.allure, 9)
              vus.dedans++
            }
          }
          expect(vus.avant).toBeGreaterThan(0)
          expect(vus.dedans).toBeGreaterThan(0)
          expect(vus.apres).toBeGreaterThan(0)
        })

        // Le rappel à l'arrêt est un roulement comme un autre : la caméra lâchée dans un ralenti
        // en sort au pas, et le doigt qui se repose la reprend, comme toujours.
        // Mutations : `constaterLeRepos` qui roulerait sans lire les ralentis (un `rouler` jumeau
        // sans `trajetRalenti`) ; le ralenti compté sur tout son intervalle pour un trajet qui n'en
        // couvre qu'une part (`clamp` retiré de `coutDe`).
        it('le rappel d’une caméra lâchée dans un ralenti y roule au pas, de ce que son trajet en traverse', () => {
          // De 220 à 300 : la caméra lâchée à 260 revient à l'arrêt de 1901 (200), 40 px au quart de la vitesse sur 60.
          const banc = enGare({ ralentis: [{ de: 220, a: 300, allure: 0.25 }], enCours: 1905 })
          banc.poserA(arret(1901))
          banc.moteur.defiler(arret(1901) + 60)
          banc.filer(REPOS_DU_DEFILEMENT + 40)
          const allonge = (20 + 40 * 4) / 60
          banc.filer(ROULEMENT * allonge - 120)
          expect(banc.vers()[banc.vers().length - 1]).toBeGreaterThan(arret(1901))
          banc.filer(160)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1901))
        })

        // Le ralenti ne freine jamais le doigt : sous lui, la caméra est où la page défile, et le
        // moteur ne lui redit rien. Mutation : `defiler` qui passerait `scrollTop` par le coût.
        it('sous le doigt, la caméra traverse le ralenti où la page la met, sans que le moteur la reprenne', () => {
          const banc = enGare({ ralentis: [LENT], enCours: 1905 })
          banc.poserA(arret(1901))
          banc.moteur.doigtsPoses(1)
          for (let y = arret(1901) + 20; y < arret(1902); y += 20) {
            banc.moteur.defiler(y)
            banc.filer(40)
            expect(vus.filter((v) => v.cases.some((c) => c.annee === 1901)).pop()!.avance).toBe(y - HAUT_1900)
          }
          expect(banc.vers()).toEqual([])
        })

        // Mutation : la garde du calme retirée de `rouler` (l'horloge figée, le roulement ralenti
        // n'arriverait jamais) ; le jumeau, avec un ralenti, du test du calme plus haut.
        it('au calme, la caméra se pose d’un coup à l’arrêt, ralenti ou non', async () => {
          const banc = auTrain({ calme: true, arrets: ARRETS, ralentis: [LENT], enCours: 1905 })
          banc.moteur.defiler(arret(1901))
          let fini = false
          void banc.moteur.marcher(1902).then(() => void (fini = true))
          await Promise.resolve()
          expect(fini).toBe(true)
          expect(vi.mocked(banc.rappels.defilerVers).mock.calls).toEqual([[arret(1902)]])
        })

        // Un roulement ralenti qu'on interrompt en demandant moins d'animations arrive d'un coup.
        // Mutation : dans `achever`, la pose à `r.y` (où il en est) plutôt qu'à `r.y1`.
        it('moins d’animations demandées en plein ralenti : la caméra est posée à l’arrêt et marcher se résout', async () => {
          const banc = enGare({ ralentis: [LENT], enCours: 1905 })
          banc.poserA(arret(1901))
          const marche = banc.temoin(banc.moteur.marcher(1902))
          banc.filer(ROULEMENT)
          await Promise.resolve()
          expect(marche.fini).toBe(false)
          banc.moteur.reglerCalme(true)
          await Promise.resolve()
          expect(marche.fini).toBe(true)
          expect(banc.rappels.defilerVers).toHaveBeenLastCalledWith(arret(1902))
        })

        // Le passage d'entrée n'est pas un roulement : un ralenti posé sur sa zone, contre le
        // contrat de `SceneCollante.ralentis`, n'en change ni les durées ni les positions.
        // Mutation : dans `avancer`, le glissement entre deux clés du passage mené par
        // `trajetRalenti` ; les durées de `direBonjour` multipliées par un `allonge`.
        it('le passage d’entrée garde ses positions et ses durées sous un ralenti', async () => {
          const TEMPS: TempsDEntree[] = [{ y: -900, duree: 0, arret: 200 }, { y: 300, duree: 500, arret: 100 }, { y: 700, duree: 800, arret: 300 }]
          const GARES = Array.from({ length: 10 }, (_, i) => 700 + i * 130)
          const duree = auTempo(200 + 500 + 100 + 800 + 300)
          const passages = [[], [{ de: -600, a: 100, allure: 0.2 }, { de: 400, a: 650, allure: 0.3 }]].map((ralentis) => {
            const banc = enGare({ arrets: GARES, entree: TEMPS, ralentis, enCours: 1905 })
            banc.poserA(HAUT_1900 + GARES[4]!)
            const bonjour = banc.temoin(banc.moteur.direBonjour(1900, 'endroit'))
            return { banc, bonjour }
          })
          for (const p of passages) p.banc.filer(duree - 80)
          await Promise.resolve()
          expect(passages.map((p) => p.bonjour.fini)).toEqual([false, false])
          for (const p of passages) p.banc.filer(160)
          await Promise.resolve()
          expect(passages.map((p) => p.bonjour.fini)).toEqual([true, true])
          const [sans, avec] = passages.map((p) => p.banc.vers())
          expect(sans!.length).toBeGreaterThan(20)
          expect(avec).toEqual(sans)
        })
      })
    })
  })

  describe('les bobines perdues et le son (plan 2d)', () => {
    const toucher = (moteur: MoteurCarte, x: number, y: number) => {
      moteur.pointeur('bas', x, y, false)
      moteur.pointeur('haut', x, y, false)
    }
    const joues = (appels: Appel[]) => appels.filter((a) => a.fillStyle === JOUE).length

    // Mutations : la garde `trouvee(i)` retirée de `VueMonde.bobine` (la bobine trouvée resterait
    // dessinée et sa zone prendrait le toucher) ; la zone inscrite même pour une bobine trouvée (le
    // toucher ne tomberait plus sur l'affichette en dessous) ; `trouvees.add` retiré de `ramasser`.
    it('une bobine trouvée n’est plus dessinée, et sa zone ne se touche plus', () => {
      const { moteur, appels, rappels } = monter({ calme: true })
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      expect(joues(appels)).toBeGreaterThan(0)
      toucher(moteur, ENTRE_LES_DEUX.x, ENTRE_LES_DEUX.y)
      expect(rappels.bobine).toHaveBeenCalledWith(BOBINE.cle)
      expect(rappels.date).not.toHaveBeenCalled()
      appels.length = 0
      moteur.image(1050)
      expect(joues(appels)).toBe(0)
      toucher(moteur, ENTRE_LES_DEUX.x, ENTRE_LES_DEUX.y)
      expect(rappels.bobine).toHaveBeenCalledTimes(1)
      expect(rappels.date).toHaveBeenCalledWith(DATE)
    })

    // Mutation : `reglerBobines` qui n'alimente pas `trouvees` : une bobine trouvée la veille
    // reviendrait au rechargement.
    it('ne cache plus ce que l’appareil a déjà trouvé', () => {
      const { moteur, appels, rappels } = monter()
      moteur.reglerBobines([BOBINE.cle])
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      expect(joues(appels)).toBe(0)
      toucher(moteur, OU_BOBINE.x, OU_BOBINE.y)
      expect(rappels.bobine).not.toHaveBeenCalled()
    })

    // Mutation : la bobine traitée après `if (this.calme) return` : qui demande moins d'animations
    // ne pourrait plus la ramasser ; ou `bobineArrivee` jamais appelé au calme (le compteur resterait).
    it('au calme, la bobine se ramasse et arrive d’un coup, sans envol', () => {
      const { moteur, appels, rappels } = monter({ calme: true })
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      toucher(moteur, OU_BOBINE.x, OU_BOBINE.y)
      expect(rappels.bobine).toHaveBeenCalledWith(BOBINE.cle)
      expect(rappels.bobineArrivee).toHaveBeenCalledWith(BOBINE.cle)
      appels.length = 0
      moteur.image(1050)
      expect(appels.some((a) => a.fillStyle === '#b8862b')).toBe(false)
    })

    // Mutations : `DUREE_DE_L_ENVOL = 1` (sans le tempo) ; l'arrivée dite au toucher ; un envol qui
    // n'arrive jamais ; l'envol non achevé quand le visiteur demande moins d'animations en route.
    it('la bobine vole vers le compteur au tempo, puis y arrive', () => {
      expect(DUREE_DE_L_ENVOL).toBe(TEMPO)
      const { moteur, appels, rappels } = monter()
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      toucher(moteur, OU_BOBINE.x, OU_BOBINE.y)
      expect(rappels.bobine).toHaveBeenCalledWith(BOBINE.cle)
      let ms = 1000
      const filer = (s: number) => {
        for (const fin = ms + s * 1000; ms < fin; ) moteur.image((ms += 16))
      }
      filer(DUREE_DE_L_ENVOL - 0.5)
      expect(rappels.bobineArrivee).not.toHaveBeenCalled()
      expect(rappels.cibleBobines).toHaveBeenCalled()
      expect(appels.some((a) => a.fillStyle === '#b8862b')).toBe(true)
      filer(0.6)
      expect(rappels.bobineArrivee).toHaveBeenCalledWith(BOBINE.cle)
    })

    // Mutation : `atterrir()` retiré d'`achever` : la bobine resterait en l'air, l'horloge figée.
    it('une bobine en vol arrive d’un coup quand le visiteur demande moins d’animations', () => {
      const { moteur, rappels } = monter()
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      toucher(moteur, OU_BOBINE.x, OU_BOBINE.y)
      moteur.image(1016)
      expect(rappels.bobineArrivee).not.toHaveBeenCalled()
      moteur.reglerCalme(true)
      expect(rappels.bobineArrivee).toHaveBeenCalledWith(BOBINE.cle)
    })

    // Mutation : `atterrir()` appelé après `rappels.bobine` dans `ramasser` : la page compterait la
    // seconde à l'arrivée de la première (« Bobine retrouvée 2/3 » pour la première, le compteur à 2
    // la seconde encore en l'air, et les trois annoncées avant que la dernière arrive).
    it('une bobine ramassée pendant qu’une autre vole fait d’abord arriver celle qui vole', () => {
      const { moteur, rappels } = monter({ deuxBobines: true })
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      toucher(moteur, OU_BOBINE.x, OU_BOBINE.y)
      moteur.image(1016)
      toucher(moteur, OU_AUTRE_BOBINE.x, OU_AUTRE_BOBINE.y)
      expect(rappels.bobine).toHaveBeenNthCalledWith(2, AUTRE_BOBINE.cle)
      expect(rappels.bobineArrivee).toHaveBeenCalledTimes(1)
      expect(rappels.bobineArrivee).toHaveBeenCalledWith(BOBINE.cle)
      const arrivee = vi.mocked(rappels.bobineArrivee).mock.invocationCallOrder[0]!
      const seconde = vi.mocked(rappels.bobine).mock.invocationCallOrder[1]!
      expect(arrivee).toBeLessThan(seconde)
    })

    // Mutation : `this.rappels.clap()` retiré de `claquer` : le clap ne sonnerait jamais.
    it('dit le clap à l’ambiance', () => {
      const { moteur, rappels } = monter()
      moteur.claquer()
      expect(rappels.clap).toHaveBeenCalledTimes(1)
    })

    // Mutations : la musique d'un autre monde, ou un poids pris à la mauvaise section.
    it('donne à l’ambiance la musique de chaque monde et sa présence à l’écran', () => {
      const { moteur, rappels } = monter()
      moteur.defiler(MARGE_HAUT)
      moteur.image(1000)
      const liste = vi.mocked(rappels.presences).mock.lastCall![0]
      const de1890 = liste.find((p) => p.musique === MUSIQUE)
      expect(de1890?.poids).toBeGreaterThan(0.9)
      expect(liste.filter((p) => p.musique !== MUSIQUE).every((p) => p.musique === null && p.poids < 0.1)).toBe(true)
    })
  })
})
