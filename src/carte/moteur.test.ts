import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { A_L_ARRET, CORAIL, DUREE_DE_L_ENVOL, DUREE_DU_ROULEMENT, MAX_TUILES, MoteurCarte, REPOS_DU_DEFILEMENT, type CaseCarte, type Dependances, type EtatCarte, type Rappels } from './moteur'
import { contexteFactice, type Appel } from '../test/contexteFactice'
import { MARGE_HAUT } from './placement'
import { mondeAVenir } from '../mondes/avenir'
import type { BobinePerdue, DateVraie, Monde, MusiqueDuMonde, SuiviGare, VueMonde } from '../mondes/types'
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
 * donne (option `arrets`) : sans eux, la caméra n'y est jamais rappelée.
 */
const HAUT_1900 = MARGE_HAUT + mondeAVenir(1890).trace([1895, 1896, 1897, 1898, 1899]).hauteur
const quai = (annee: number) => (annee <= 1904 ? { x: 45 + (annee - 1900) * 75, y: 655 } : null)
const OU_SUIVI = { x: 330, y: 130 }
const MUSIQUE_1900: MusiqueDuMonde = { battue: 0.5, temps: 16, volume: 0.4, filtre: 1800, jouer: () => undefined }
/** Les Voyages suivis que le monde collant a été prié de dessiner. */
const suivis: SuiviGare[] = []
function mondeDEssai(decennie: number, collant = false, arrets: readonly number[] = []): Monde {
  const base = mondeAVenir(decennie)
  const scene: Monde['scene'] =
    collant && decennie === 1900
      ? {
          ecranDeLaCase: (_, annee) => quai(annee),
          dessinerSuivi: (v, suivi) => {
            suivis.push(suivi)
            v.zone('roulotte', OU_SUIVI.x, OU_SUIVI.y, 36, undefined, 2)
          },
          dessinerBande: () => () => null,
          entree: [],
          arrets,
        }
      : null
  return {
    ...base,
    scene,
    // Une rampe et un ciel marqués : ce que le moteur dessine pour le monde collant se reconnaît.
    couleur: scene ? (hex, a = 1) => `collant(${hex},${a})` : base.couleur,
    palette: scene ? { ...base.palette, ciel: [250, 10, 10], cielJour: [250, 10, 10], cielCrepuscule: [250, 10, 10] } : base.palette,
    traitement: { cadence: 16, tremblement: 0.8, scintillement: 0.03, grain: 0.09, virage: { couleur: [150, 104, 58], alpha: 0.13 }, affiches: 'sepia' },
    dates: decennie === 1890 ? [DATE] : [],
    bobines: decennie === 1890 ? [BOBINE] : [],
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
    },
    reagir: (id) => void reactions.push(id),
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
  } = {},
) {
  vus.length = 0
  reactions.length = 0
  suivis.length = 0
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
      const m = mondeDEssai(d, options.collant, options.arrets)
      const { chantier1898, particules } = options
      return {
        ...m,
        palette: options.sansColonne ? { ...m.palette, colonne: null } : m.palette,
        dessinerCiel: options.cielSage ? (v) => (v.vivant ? m.dessinerCiel(v) : void vus.push(v)) : m.dessinerCiel,
        siteDuChantier: (annee) => (chantier1898 !== undefined && annee === 1898 ? chantier1898 : m.siteDuChantier(annee)),
        bobines: options.deuxBobines && d === 1890 ? [BOBINE, AUTRE_BOBINE] : m.bobines,
        dessinerProche: (v) => {
          if (options.deuxBobines && d === 1890) v.bobine(1, OU_AUTRE_BOBINE.x * v.k, v.ecranY(OU_AUTRE_BOBINE.y, 1), 8)
          if (!particules) return
          v.etincelles(10, 10, 1, '#abcdef')
          v.confettis(10, 10, ['#abcdef'])
          v.fumee(10, 10, 1, 4)
        },
      }
    },
  }
  const rappels: Rappels = { toucherAnnee: vi.fn(), apercu: vi.fn(), finApercu: vi.fn(), ensemble: vi.fn(), defilerVers: vi.fn(), date: vi.fn(), roulotte: vi.fn(), avatarVisible: vi.fn(), bobine: vi.fn(), bobineArrivee: vi.fn(), cibleBobines: vi.fn(() => ({ x: 350, y: 40 })), clap: vi.fn(), presences: vi.fn() }
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
  moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte })
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
    moteur.majEtat({ cases, anneeAvatar: 1897, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases: cases.map((c) => (c.annee === 1898 ? { ...c, attente: true, jauge: null } : c)), anneeAvatar: 1898, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases: cases.map((c) => (c.annee === 1898 ? { ...c, attente, jauge: attente ? null : c.jauge } : c)), anneeAvatar: 1898, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte: null })
    moteur.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
    // La marche finie, la page avance l'avatar.
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    moteur.image(1200)
    const { ouverte, t } = vus[vus.length - 1]!
    expect(ouverte.annee).toBe(1899)
    expect(ouverte.t0).toBeGreaterThan(0)
    expect(t - ouverte.t0).toBeLessThan(0.2)
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte: null })
    moteur.image(1300)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
  })

  // Idée 8. Mutation : `this.t` au lieu de `this.instant()` : tant que l'horloge
  // est figée, `chantier` pose tout bâti (`vivant` faux) ; mais l'année ouverte serait datée, et son
  // chantier se jouerait au retour des animations, pour une arrivée que personne n'a vue.
  it('pose l’année ouverte déjà bâtie quand le visiteur demande moins d’animations', () => {
    const { moteur, cases } = monter({ calme: true })
    moteur.image(1000)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
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
    vu.moteur.majEtat({ cases: vu.cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    for (let i = 1; i <= 8; i++) vu.moteur.image(1000 + i * 50)
    expect(vu.rappels.defilerVers).not.toHaveBeenCalled()
    const calme = monter({ calme: true })
    calme.moteur.image(1000)
    calme.moteur.defiler(calme.moteur.ecranDeLAnnee(1899).y - 350)
    calme.moteur.majEtat({ cases: calme.cases, anneeAvatar: 1899, tampons: [], roulotte: null })
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
    moteur.majEtat({ cases: relues, anneeAvatar: 1898, tampons: [], roulotte: null })
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
      banc.moteur.majEtat({ cases, anneeAvatar: enCours, tampons: [], roulotte: banc.roulotte })
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
      const enGare = (options: Parameters<typeof auTrain>[0] & { ailleurs?: boolean; sansCollant?: boolean } = {}) => {
        const banc = options.ailleurs ? monter({ collant: true, arrets: ARRETS, ...options }) : options.sansCollant ? monter(options) : auTrain({ arrets: ARRETS, ...options })
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
