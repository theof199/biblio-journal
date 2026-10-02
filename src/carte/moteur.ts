import { clamp, ease, lerp, mixc, rgba, type Rgb } from './outils'
import { construireRoute, pointA, type Route } from './route'
import { placerCarte, type PlanCarte } from './placement'
import { cibleCamera, poidsSections, presencesSections } from './camera'
import { ecranDe, rayonEcran, trouverZone, type Zone } from './zones'
import { genreDeBande, geoEnsemble } from './ensemble'
import { ambianceDeLHeure } from './heure'
import { Lru } from './lru'
import { horlogeDuMonde, scintillement, tremblement } from './traitement'
import { Geste, lirePincement } from './geste'
import type { DateVraie, Monde, MusiqueDuMonde, SceneCollante, VueMonde } from '../mondes/types'
import type { EtatCase } from '../voyage/regles'
import { dessinerCase, dessinerCorail } from './dessin/cases'
import { dessinerAvatar } from './dessin/avatar'
import { bandesDuSol, couperAuxBandes, dessinerSol, TUILE, type Bande } from './dessin/sol'
import { dessinerEnsemble, type BandeLue } from './dessin/ensemble'
import { Particules } from './dessin/particules'
import { Effets, type Feu } from './dessin/effets'
import { afficheTraitee } from './dessin/affiches'
import { dessinerPlaqueRoulotte, dessinerRoulotte } from './dessin/roulotte'
import { imageCommune } from './images'
import { dessinerBobinePerdue, dessinerEnvol } from './dessin/bobines'
import { auTempo } from '../voyage/tempo'

/** Le corail : ce que le joueur déclenche. Jamais sous un voile, jamais teinté (spec, « Le rendu »). */
export const CORAIL = '#FF6B57'
/** L'envol d'une bobine ramassée vers le compteur, en secondes : une seconde de base, au tempo (`voyage/tempo.ts`). */
export const DUREE_DE_L_ENVOL = auTempo(1000) / 1000
/** Les tuiles du sol gardées en mémoire (voir `Lru`). */
export const MAX_TUILES = 6
/**
 * Le roulement de la caméra vers un arrêt d'une section collante (plan 3a), en millisecondes **de
 * base** : `rouler` le joue au tempo (`voyage/tempo.ts`), là et nulle part ailleurs. La même durée
 * quelle que soit la distance.
 */
export const DUREE_DU_ROULEMENT = 600
/**
 * Le défilement est arrêté quand `defiler` s'est tu depuis ce temps, en millisecondes de l'horloge
 * des images. Un seuil de détection, comme ceux du geste (`geste.ts`), pas une animation : il ne
 * suit pas le tempo.
 */
export const REPOS_DU_DEFILEMENT = 150
/** À moins de cet écart d'un arrêt, en px, la caméra y est posée : la page rend un défilement arrondi. */
export const A_L_ARRET = 1.5
/** Le sens d'un passage d'entrée (`direBonjour`) : dans l'ordre de `SceneCollante.entree`, ou retourné. */
export type SensDuPassage = 'endroit' | 'envers'

export interface CaseCarte {
  annee: number
  etat: EtatCase
  attente: boolean
  profondeur: number
  jauge: { vus: number; total: number } | null
  affiches: readonly string[]
}
export interface EtatCarte {
  cases: readonly CaseCarte[]
  /**
   * L'année où se tient l'avatar ; la page la fait avancer après la marche, jamais avant. C'est
   * aussi le signal qui ouvre l'année au monde (idée 8, `VueMonde.ouverte`).
   */
  anneeAvatar: number
  tampons: readonly number[]
  /**
   * La roulotte de qui mène le Voyage (idée 1, 29 septembre 2026). `annee` : l'année où ce Voyage
   * est rendu, la roulotte descend s'y garer. Nulle : on mène soi-même, la roulotte traverse le
   * monde (`VueMonde.roulotte`). Absente (`null`) : pas de roulotte.
   */
  roulotte: { pseudo: string; annee: number | null } | null
}
export interface Rappels {
  toucherAnnee: (annee: number) => void
  apercu: (annee: number, ancre: { x: number; y: number }) => void
  finApercu: () => void
  ensemble: (ouvert: boolean) => void
  /** Le moteur veut la caméra ailleurs : la page pose `scrollTop`, le défilement reste natif. */
  defilerVers: (y: number) => void
  /** Une affichette touchée : la page ouvre sa petite affiche. */
  date: (d: DateVraie) => void
  /** La roulotte garée touchée : la page dit où en est le Voyage suivi. */
  roulotte: () => void
  /** L'avatar entre dans l'écran, ou en sort : la page ne propose « Tu es ici » que tant qu'il est hors de vue. */
  avatarVisible: (visible: boolean) => void
  /**
   * Une bobine perdue vient d'être ramassée (plan 2d) : la page la retient sur l'appareil et sonne
   * le carillon. Elle vole alors vers le compteur, et `bobineArrivee` dit qu'elle y est ; les deux
   * d'un coup quand le visiteur demande moins d'animations.
   */
  bobine: (cle: string) => void
  bobineArrivee: (cle: string) => void
  /** Où vole la bobine ramassée, à l'écran : le compteur du HUD (maquette : `cibleHud`). Relu à chaque image. */
  cibleBobines: () => { x: number; y: number }
  /** Le clap a claqué (maquette : `claquer`, `sonClap`). */
  clap: () => void
  /**
   * Les mondes de la carte et leur poids de mélange, de 0 à 1 : l'ambiance y règle le volume de
   * chaque musique (maquette : `majSon`). Et la décennie à l'écran, celle du monde au plus fort
   * poids de mélange (le premier des deux à égalité) : le compteur de bobines la montre. Nulle
   * sur une carte sans section. Dit à chaque image : à qui l'écoute de ne retenir que ses changements.
   */
  presences: (liste: ReadonlyArray<{ musique: MusiqueDuMonde | null; poids: number }>, decennie: number | null) => void
  /**
   * La décennie dont le passage d'entrée est à portée de geste (plan 3a) : la caméra est au bas de
   * la section qui précède une section collante, à un écran au plus de son premier temps. Nulle
   * sinon, et tant qu'un passage se joue. Dit quand cela change seulement ; jamais dit sur une carte
   * où rien n'est proche. Optionnel : une page qui n'offre pas le passage ne l'écoute pas.
   */
  entreeProche?: (decennie: number | null) => void
}
/** Sous cette hauteur d'écran, l'avatar est sous le bandeau du haut (le HUD de la page) : il n'est pas vu. */
export const HAUT_MASQUE = 110
/** Au-dessus de ce vide, au bas de l'écran, il est déjà collé au bord. */
export const BAS_MASQUE = 30
export interface Toile {
  width: number
  height: number
  getContext: (type: '2d') => CanvasRenderingContext2D | null
}
export interface Dependances {
  creerToile: (w: number, h: number) => Toile
  /** Une affiche prête à dessiner, nulle tant qu'elle charge ; `pret` rappelé au chargement. */
  image: (url: string, pret: () => void) => CanvasImageSource | null
  demanderImage: (f: (t: number) => void) => number
  annulerImage: (id: number) => void
  /** L'heure du visiteur, de 0 à 24. */
  heure: () => number
  mondeDe: (decennie: number) => Monde
}

interface Marche {
  d0: number
  d1: number
  t0: number
  dur: number
  fin: () => void
}

/** La caméra qui roule vers un arrêt. `fin` : la promesse de `marcher` ; nul quand personne n'attend (le rappel, « Tu es ici »). */
interface Roulement {
  y0: number
  y1: number
  /** Où il en est : ce qu'il a posé en dernier. */
  y: number
  t0: number
  dur: number
  fin: (() => void) | null
}

/**
 * Le passage d'entrée qui se joue (`direBonjour`). `cles` : où la caméra doit être, en `y` de carte,
 * à chaque moment charnière, en secondes depuis `t0` : elle tient la pause d'un temps entre deux
 * clés de même `y`, et glisse entre deux clés de `y` différents. `fins` : qui attend sa fin.
 */
interface Passage {
  decennie: number
  t0: number
  cles: Array<{ t: number; y: number }>
  fins: Array<() => void>
}

/**
 * Le moteur de la carte (spec du Journal web, « La carte est un moteur à part ») : un état, un
 * `<canvas>`, des touchers rendus en rappels. Aucun import de React ni de l'API, aucun écouteur
 * du DOM : `CarteCanvas.tsx` lui relaie mesures, défilement, pointeurs et réglages. D'où un
 * moteur qu'un test fait dessiner image par image dans un contexte factice.
 */
export class MoteurCarte {
  private W = 390
  private H = 700
  private k = 1
  private dpr = 1
  private camY = 0
  private t = 0
  private dernier = 0
  private raf = 0
  private visible = true
  private calme = false
  private etat: EtatCarte = { cases: [], anneeAvatar: 0, tampons: [], roulotte: null }
  private plan: PlanCarte = { points: [], cases: [], sections: [], hauteur: 0 }
  private route: Route = { pts: [], dWay: [] }
  private chemin: Path2D | null = null
  /** Les sections collantes du plan (`Monde.scene`), par rang de section : le moteur s'y efface (plan 3a). */
  private collantes: boolean[] = []
  /** Où le sol, le chemin parcouru et la brume se dessinent : tout sauf les sections collantes. Nul sans elles : rien à couper. */
  private bandes: Bande[] | null = null
  private readonly tuiles = new Lru<number, Toile>(MAX_TUILES)
  /** Les affiches traitées, par monde et par adresse : quarante-huit toiles de 52 × 76. */
  private readonly affiches = new Lru<string, Toile>(48)
  private zones: Zone[] = []
  private feux: Feu[] = []
  private readonly effets: Effets
  private readonly reactions = new Map<string, number>()
  /** Le moment où chaque année a changé d'état : sa case « pousse », sa nacelle s'allume. */
  private readonly pops = new Map<number, number>()
  private readonly particules = new Particules()
  private readonly avatar: { d: number; marche: Marche | null; claque: number } = { d: 0, marche: null, claque: -9 }
  private suivre = false
  /** Ce que la page sait de l'avatar ; nul tant qu'on ne le lui a pas dit. */
  private avatarVu: boolean | null = null
  private ens = { q: 0, cible: 0 }
  private fogY = 0
  private fogCible = 0
  private pincement: number | null = null
  /** Le moment où la roulotte a commencé de descendre vers son année. */
  private roulotteT0 = -9
  /** La cinématique de sortie d'un monde, tant qu'elle dure. */
  private adieu: { decennie: number; t0: number; fin: () => void } | null = null
  /** L'année ouverte au monde et le moment où l'avatar y est arrivé (idée 8) ; -9 : déjà fini. */
  private ouverte = { annee: 0, t0: -9 }
  /** Où la caméra glisse pour montrer un chantier qui commence hors de l'écran (idée 8) ; nulle sinon. */
  private visee: number | null = null
  /** Les bobines perdues trouvées sur cet appareil (plan 2d), par clé : ni dessinées, ni touchables. */
  private trouvees = new Set<string>()
  /** La bobine qui vole vers le compteur, d'où elle part et depuis quand ; nulle sinon. */
  private envol: { cle: string; x0: number; y0: number; t0: number } | null = null
  /** La caméra qui roule vers un arrêt d'une section collante (plan 3a) ; nul sinon. */
  private roulement: Roulement | null = null
  /**
   * Le défilement à constater : `aDater` dit qu'il vient de bouger (la prochaine image le date),
   * `depuis` le moment de l'image qui l'a daté ; nul une fois son arrêt constaté.
   */
  private defilement: { aDater: boolean; depuis: number | null } = { aDater: false, depuis: null }
  /** Au calme, l'arrêt que le geste en cours a posé ; nul hors d'un geste. */
  private pose: number | null = null
  /** Vrai tant que le pointeur est bas ; le navigateur le relève (`pointercancel`) dès qu'il prend le geste pour défiler. */
  private pointeurBas = false
  /** Le nombre de doigts posés sur l'écran, que la page relaie (`doigtsPoses`) : lui survit au défilement natif. */
  private touchers = 0
  /** Le passage d'entrée qui se joue (plan 3a) ; nul sinon. */
  private passage: Passage | null = null
  /** D'où est parti le défilement à constater, en `y` de carte : de quoi dire par quel bord il est entré dans une zone des temps. Nul au repos. */
  private depart: number | null = null
  /** Ce que la page sait de l'entrée à portée de geste (`Rappels.entreeProche`). */
  private entreeDite: number | null = null
  /**
   * Ce que les mondes à `scene` ont rendu à la dernière image dessinée de la vue d'ensemble
   * (`SceneCollante.dessinerBande`) : de quoi lire l'année sous un toucher ou un pincement. Vide
   * tant qu'aucune image de la vue d'ensemble n'est dessinée, et dès qu'elle ne l'est plus.
   */
  private lectures: BandeLue[] = []
  /**
   * Où la sortie de la vue d'ensemble vient de poser la caméra : ce que la page en rend est son
   * écho, pas un geste du membre. Nul dès qu'un défilement mène ailleurs.
   */
  private sortie: number | null = null
  private readonly geste: Geste
  private readonly ctx: CanvasRenderingContext2D | null
  private readonly canvas: Toile

  constructor(
    canvas: Toile,
    private readonly rappels: Rappels,
    private readonly deps: Dependances,
  ) {
    // Sans contexte (jsdom, ou un navigateur qui refuse), le moteur reste inerte : la liste des
    // années de la page suffit pour naviguer.
    this.ctx = canvas.getContext('2d')
    this.canvas = canvas
    this.effets = new Effets(deps.creerToile)
    // L'horloge du geste est celle du mur, pas celle du décor : figée quand le visiteur demande
    // moins d'animations, elle ferait d'un appui de dix secondes un toucher.
    this.geste = new Geste(
      { maintenant: () => performance.now(), programmer: (f, ms) => setTimeout(f, ms), annuler: (j) => clearTimeout(j as ReturnType<typeof setTimeout>) },
      (x, y) => {
        const z = trouverZone(this.zones, x, y)
        return z?.id === 'case' ? z.data : null
      },
      (s) => {
        if (s.type === 'toucher') this.toucher(s.x, s.y)
        else if (s.type === 'appuiLong') this.rappels.apercu(s.annee, this.ecranDeLAnnee(s.annee))
        else this.rappels.finApercu()
      },
    )
  }

  // --- ce que la page relaie -------------------------------------------------------------

  mesurer(W: number, H: number, dpr: number): void {
    this.W = W
    this.H = H
    this.dpr = Math.min(2, dpr || 1)
    this.canvas.width = Math.round(W * this.dpr)
    this.canvas.height = Math.round(H * this.dpr)
    this.k = W / 390
    this.effets.mesurer(W, H, this.dpr)
    this.reconstruire()
  }

  /** La hauteur du défilement à donner à l'espaceur (`hauteur - H`). */
  get hauteur(): number {
    return this.plan.hauteur
  }

  get tuilesEnMemoire(): number {
    return this.tuiles.taille
  }

  defiler(scrollTop: number): void {
    const avant = this.camY
    this.camY = scrollTop
    this.constaterLeDefilement(avant)
    this.demander()
  }

  majEtat(etat: EtatCarte): void {
    const avant = this.etat
    const etatsAvant = new Map(avant.cases.map((c) => [c.annee, c.etat]))
    for (const c of etat.cases) {
      const e = etatsAvant.get(c.annee)
      if (e !== undefined && e !== c.etat) this.pops.set(c.annee, this.instant())
    }
    if ((avant.roulotte?.annee ?? null) !== (etat.roulotte?.annee ?? null)) this.roulotteT0 = this.instant()
    // L'année ouverte (idée 8) : datée seulement quand l'avatar avance sur une carte déjà montrée,
    // c'est-à-dire au bout d'une marche. Au premier état (ouverture, retour, rechargement) et au
    // recul, ce qu'elle bâtit est déjà fini.
    const ouvre = etat.anneeAvatar !== this.ouverte.annee
    if (ouvre) {
      const avance = avant.cases.length > 0 && etat.anneeAvatar > avant.anneeAvatar
      this.ouverte = { annee: etat.anneeAvatar, t0: avance ? this.instant() : -9 }
    }
    this.etat = etat
    const memesAnnees = avant.cases.length === etat.cases.length && avant.cases.every((c, i) => c.annee === etat.cases[i]!.annee)
    if (!memesAnnees) this.reconstruire()
    else this.tuiles.clear() // les photogrammes allumés du sol dépendent des profondeurs
    if (!this.avatar.marche) this.poserAvatar(etat.anneeAvatar)
    if (ouvre) this.montrerChantier()
    this.demander()
  }

  /**
   * L'année où se tient l'avatar s'ouvre sous les yeux, sans marche (idée 8) : la toute première
   * visite d'un membre au départ du Voyage, que seule la page reconnaît (la mémoire de l'appareil).
   * Rien pour une autre année ; déjà finie quand le visiteur demande moins d'animations.
   */
  ouvrirSousLesYeux(annee: number): void {
    if (annee !== this.etat.anneeAvatar) return
    this.ouverte = { annee, t0: this.instant() }
    this.montrerChantier()
    this.demander()
  }

  reglerCalme(calme: boolean): void {
    this.calme = calme
    // L'horloge s'arrête : une marche ou un adieu en cours n'arriveraient jamais au bout.
    if (calme) this.achever()
    this.demander()
  }

  /** Les bobines perdues que l'appareil a déjà trouvées (plan 2d) : elles ne se dessinent plus, leur zone non plus. */
  reglerBobines(cles: readonly string[]): void {
    this.trouvees = new Set(cles)
    if (this.envol) this.trouvees.add(this.envol.cle)
    this.demander()
  }

  reglerVisible(visible: boolean): void {
    this.visible = visible
    this.demander()
  }

  pointeur(type: 'bas' | 'bouge' | 'haut' | 'annule' | 'quitte', x: number, y: number, souris: boolean): void {
    if (type === 'bas') {
      this.pointeurBas = true
      this.reprendreLaCamera()
    } else if (type !== 'bouge') this.pointeurBas = false
    // Un toucher pendant le passage le pose à sa fin, et rien d'autre : le doigt qui se pose, comme
    // celui qui se lève d'un appui d'avant le passage, n'est pas relayé au geste, et n'ouvre pas
    // l'année qui se trouve sous lui.
    if (this.passage && (type === 'bas' || type === 'haut')) {
      this.finirLePassage()
      return
    }
    if (this.ens.cible) {
      if (type === 'haut') this.quitterEnsemble({ x, y })
      return
    }
    if (type === 'bas') this.geste.baisser(x, y, souris)
    else if (type === 'bouge') this.geste.bouger(x, y, souris)
    else if (type === 'haut') this.geste.lever(x, y)
    else if (type === 'annule') this.geste.annulerAppui()
    else this.geste.quitter()
  }

  /**
   * Le nombre de doigts posés sur la carte (`targetTouches.length` de `touchstart`, `touchend`,
   * `touchcancel`). Tant qu'il en reste un, le moteur ne rappelle ni ne pose la caméra : il
   * combattrait le défilement que le doigt mène. Il reprend au lever du dernier.
   */
  doigtsPoses(nombre: number): void {
    this.touchers = nombre
    if (nombre > 0) this.reprendreLaCamera()
  }

  /**
   * Deux doigts : `ecart` nul les relâche ; `xMilieu`, `yMilieu` : le milieu des deux doigts, à
   * l'écran. Rend vrai quand le geste est pris (la page appelle alors `preventDefault`).
   */
  pincer(ecart: number | null, xMilieu: number, yMilieu: number): boolean {
    if (ecart === null) {
      this.pincement = null
      return false
    }
    if (this.pincement === null) {
      this.pincement = ecart
      return false
    }
    const lu = lirePincement(this.pincement, ecart, this.ens.cible === 1)
    if (lu === 'ouvrir') this.entrerEnsemble()
    if (lu === 'fermer') this.quitterEnsemble({ x: xMilieu, y: yMilieu })
    if (lu) this.pincement = null
    return true
  }

  // --- ce que la page commande -------------------------------------------------------------

  /**
   * Ramène la caméra sur l'avatar ; `instant` à l'ouverture de la carte, sans glisser depuis le haut.
   * Dans une section collante, à l'arrêt de l'année où se tient le membre.
   */
  allerIci(instant = false): void {
    this.basculerEnsemble(false)
    this.arreterLePassage()
    const arret = this.arretDe(this.etat.anneeAvatar)
    if (arret !== undefined) {
      if (arret !== null && instant) this.poser(arret)
      else if (arret !== null) this.rouler(arret, null)
      this.demander()
      return
    }
    const p = pointA(this.route, this.avatar.d)
    if (instant || this.calme) this.rappels.defilerVers(cibleCamera(p.y, this.H, this.plan.hauteur))
    else this.suivre = true
    this.demander()
  }

  basculerEnsemble(ouvert: boolean): void {
    if (ouvert) this.entrerEnsemble()
    else this.quitterEnsemble(null)
  }

  /**
   * L'avatar marche jusqu'à la case de `annee`. Instantané quand le visiteur demande moins
   * d'animations. Dans une section collante, on ne marche pas, on roule : la caméra glisse jusqu'à
   * l'arrêt de `annee`, et la promesse se résout à l'arrivée.
   */
  marcher(annee: number): Promise<void> {
    const c = this.plan.cases.find((x) => x.annee === annee)
    if (!c) return Promise.resolve()
    const arret = this.arretDe(annee)
    if (arret === null) return Promise.resolve()
    if (arret !== undefined) return new Promise((fin) => this.rouler(arret, fin))
    return this.marcherVers(this.route.dWay[c.w] ?? 0, c.y)
  }

  /** L'avatar marche jusqu'à la porte de sa section. Depuis une section collante, il n'y a pas d'avatar à faire marcher : rien ne bouge. */
  passerLaPorte(): Promise<void> {
    const ici = this.plan.cases.find((x) => x.annee === this.etat.anneeAvatar)
    const s = ici ? this.plan.sections[ici.section] : undefined
    if (!s || !ici || this.sceneDe(ici.section)) return Promise.resolve()
    return this.marcherVers((this.route.dWay[s.porte] ?? 0) + 6, this.plan.points[s.porte]![1])
  }

  /**
   * Le monde de `decennie` dit adieu (idée 7, 29 septembre 2026) : la caméra remonte en haut de sa
   * section et la cinématique dure `monde.adieu` secondes. Rien quand le visiteur demande moins
   * d'animations : le carton de l'année suivante porte seul la nouvelle.
   */
  direAdieu(decennie: number): Promise<void> {
    const s = this.plan.sections.find((x) => x.decennie === decennie)
    const duree = this.deps.mondeDe(decennie).adieu
    if (!s || duree <= 0 || this.calme) return Promise.resolve()
    this.adieu?.fin()
    // La visée d'un chantier, elle, n'est pas lâchée : l'adieu ne l'a jamais arrêtée.
    this.prendreLaCamera(false)
    this.camY = s.y0
    this.rappels.defilerVers(s.y0)
    return new Promise((fin) => {
      this.adieu = { decennie, t0: this.t, fin }
      this.demander()
    })
  }

  /**
   * Le monde de `decennie` dit bonjour (plan 3a) : son passage d'entrée se joue, à l'endroit ou à
   * l'envers. La caméra est d'abord posée, d'un coup, au premier temps du sens joué, où qu'elle
   * soit ; elle y tient sa pause, puis glisse d'un temps au suivant, chaque durée et chaque pause
   * au tempo (`voyage/tempo.ts`), ici et nulle part ailleurs. Le monde reçoit `VueMonde.entree`.
   * La promesse se résout à la fin : après la pause du dernier temps joué ; aussitôt pour un monde
   * sans `scene` ou sans temps ; aussitôt quand le visiteur demande moins d'animations, la caméra
   * posée au dernier temps du sens joué. Un seul passage à la fois : demandé pendant qu'un autre
   * joue, il ne relance rien et se résout avec lui. Un seul glissement à la fois : il arrête ceux
   * d'avant.
   */
  direBonjour(decennie: number, sens: SensDuPassage): Promise<void> {
    const enCours = this.passage
    if (enCours) return new Promise((fin) => enCours.fins.push(fin))
    const temps = this.tempsDe(this.plan.sections.findIndex((s) => s.decennie === decennie))
    if (temps.length === 0) return Promise.resolve()
    // Les temps dans l'ordre joué, chacun avec la durée du segment qui y mène : à l'envers, celle
    // que la liste donne au temps d'où l'on vient (la durée appartient au segment, pas au sens).
    const joues = sens === 'envers' ? temps.map((x, i) => ({ ...x, duree: temps[i + 1]?.duree ?? 0 })).reverse() : temps
    // Aucun passage ne joue ici (plus haut) : il n'y en a pas à arrêter.
    this.prendreLaCamera()
    // Le défilement qui a mené ici n'a plus rien à constater : le passage commande la caméra.
    this.oublierLeDefilement()
    if (this.calme) {
      this.poser(joues[joues.length - 1]!.y)
      this.demander()
      return Promise.resolve()
    }
    this.poser(joues[0]!.y)
    const cles: Passage['cles'] = []
    let t = 0
    joues.forEach((x, i) => {
      if (i > 0) t += auTempo(x.duree) / 1000
      cles.push({ t, y: x.y })
      t += auTempo(x.arret) / 1000
      cles.push({ t, y: x.y })
    })
    return new Promise((fin) => {
      this.passage = { decennie, t0: this.t, cles, fins: [fin] }
      this.demander()
    })
  }

  /** Où se tient la roulotte garée, à l'écran ; nulle quand elle traverse, ou sans roulotte. */
  ecranDeLaRoulotte(): { x: number; y: number } | null {
    const r = this.roulotteGaree()
    return r ? { x: r.x, y: r.y } : null
  }

  claquer(): void {
    this.avatar.claque = this.instant()
    this.rappels.clap()
    this.demander()
  }

  detruire(): void {
    if (this.raf) this.deps.annulerImage(this.raf)
    this.raf = 0
    this.tuiles.clear()
  }

  /** Une image, à l'instant `maintenant` (ms) : la boucle l'appelle, un test aussi. */
  image(maintenant: number): void {
    const dt = this.dernier ? Math.min(0.05, (maintenant - this.dernier) / 1000) : 0.016
    this.dernier = maintenant
    if (!this.calme) this.t += dt
    this.constaterLeRepos(maintenant)
    this.maj(dt)
    this.signalerAvatar()
    this.signalerEntree()
    this.dessiner()
  }

  // --- l'intérieur -----------------------------------------------------------------------------

  private reconstruire(): void {
    const annees = this.etat.cases.map((c) => c.annee)
    this.plan = placerCarte(annees, (d, a) => this.deps.mondeDe(d).trace(a))
    this.route = construireRoute(this.plan.points, this.k)
    this.chemin = typeof Path2D === 'function' ? new Path2D() : null
    this.route.pts.forEach((p, i) => (i ? this.chemin?.lineTo(p.x, p.y) : this.chemin?.moveTo(p.x, p.y)))
    this.collantes = this.plan.sections.map((s) => this.deps.mondeDe(s.decennie).scene !== null)
    this.bandes = bandesDuSol(this.plan.sections, (d) => this.deps.mondeDe(d))
    this.tuiles.clear()
    if (!this.avatar.marche) this.poserAvatar(this.etat.anneeAvatar)
  }

  /** La scène collante de la section de rang `section` ; nulle pour une section ordinaire. */
  private sceneDe(section: number): SceneCollante | null {
    const s = this.plan.sections[section]
    return s && this.collantes[section] ? this.deps.mondeDe(s.decennie).scene : null
  }

  /** Vrai quand le `y` de carte tombe dans une section collante. */
  private collanteEn(y: number): boolean {
    return this.plan.sections.some((s, i) => this.collantes[i] && y >= s.y0 && y < s.y0 + s.hauteur)
  }

  /** Les arrêts de la section de rang `section`, en `y` de carte, bornés à ce que le défilement atteint ; aucun pour une section ordinaire. */
  private arretsDe(section: number): number[] {
    const s = this.plan.sections[section]
    const scene = this.sceneDe(section)
    if (!s || !scene) return []
    const fond = Math.max(0, this.plan.hauteur - this.H)
    return scene.arrets.map((y) => clamp(s.y0 + y, 0, fond))
  }

  /**
   * Où la caméra se pose pour `annee`, en `y` de carte : son arrêt, dans une section collante (nul
   * si le monde n'en donne pas) ; `undefined` dans une section ordinaire, ou pour une année inconnue.
   */
  private arretDe(annee: number): number | null | undefined {
    const c = this.plan.cases.find((x) => x.annee === annee)
    if (!c || !this.sceneDe(c.section)) return undefined
    return this.arretsDe(c.section)[this.plan.sections[c.section]!.annees.indexOf(annee)] ?? null
  }

  /**
   * Les temps du passage d'entrée de la section de rang `section`, en `y` de carte, bornés à ce que
   * le défilement atteint ; aucun pour une section ordinaire, inconnue, ou dont le monde n'en donne pas.
   */
  private tempsDe(section: number): Array<{ y: number; duree: number; arret: number }> {
    const s = this.plan.sections[section]
    const scene = this.sceneDe(section)
    if (!s || !scene) return []
    const fond = Math.max(0, this.plan.hauteur - this.H)
    return scene.entree.map((x) => ({ y: clamp(s.y0 + x.y, 0, fond), duree: x.duree, arret: x.arret }))
  }

  /** La zone des temps de chaque section qui a un passage : du premier temps au dernier, en `y` de carte. */
  private zonesDesTemps(): Array<{ decennie: number; haut: number; bas: number }> {
    return this.plan.sections.flatMap((s, section) => {
      const temps = this.tempsDe(section)
      const premier = temps[0]
      const dernier = temps[temps.length - 1]
      return premier && dernier ? [{ decennie: s.decennie, haut: premier.y, bas: dernier.y }] : []
    })
  }

  /**
   * Le passage que le geste lance : la caméra est laissée dans une zone des temps, entre ses deux
   * bords, par un défilement parti de `depart`, au-dessus (il est entré par le haut : à l'endroit)
   * ou au-dessous (par le bas : à l'envers). Nul pour un défilement parti dans la zone.
   */
  private entreeAuGeste(depart: number): { decennie: number; sens: SensDuPassage } | null {
    for (const z of this.zonesDesTemps()) {
      if (this.camY <= z.haut + A_L_ARRET || this.camY >= z.bas - A_L_ARRET) continue
      if (depart <= z.haut + A_L_ARRET) return { decennie: z.decennie, sens: 'endroit' }
      if (depart >= z.bas - A_L_ARRET) return { decennie: z.decennie, sens: 'envers' }
    }
    return null
  }

  /** Le passage s'arrête où il en est : un autre glissement prend la caméra. Qui l'attendait est libéré. */
  private arreterLePassage(): void {
    const p = this.passage
    if (!p) return
    this.passage = null
    for (const fin of p.fins) fin()
  }

  /** Le passage est posé à sa fin, d'un coup : son dernier temps joué. Qui l'attendait est libéré. */
  private finirLePassage(): void {
    const p = this.passage
    if (!p) return
    this.poser(p.cles[p.cles.length - 1]!.y)
    this.arreterLePassage()
    this.demander()
  }

  /**
   * Dit à la page la décennie dont l'entrée est à portée de geste, quand cela change seulement : la
   * caméra au-dessus du premier temps d'une section collante, à un écran au plus (elle est donc au
   * bas de la section qui précède), ou posée à ce temps. Nulle tant qu'un passage se joue.
   */
  private signalerEntree(): void {
    if (!this.bandes) return
    const proche = this.passage ? undefined : this.zonesDesTemps().find((z) => this.camY >= z.haut - this.H && this.camY <= z.haut + A_L_ARRET)
    const decennie = proche?.decennie ?? null
    if (decennie === this.entreeDite) return
    this.entreeDite = decennie
    this.rappels.entreeProche?.(decennie)
  }

  /** Vrai tant qu'un doigt est posé, d'où que vienne l'information : le pointeur, ou les touchers que la page relaie. */
  private get doigt(): boolean {
    return this.pointeurBas || this.touchers > 0
  }

  /** Le doigt qui se pose reprend la caméra au rappel et à « Tu es ici » ; l'arrêt du défilement se constatera au lever. */
  private reprendreLaCamera(): void {
    if (!this.roulement || this.roulement.fin) return
    this.arreterLeRoulement()
    this.defilement.aDater = true
  }

  /**
   * Les arrêts de la section collante où la caméra est laissée sans être posée à l'un d'eux : du
   * premier arrêt au bas de la section, sous le dernier arrêt compris. Nul avant le premier arrêt
   * (la zone du passage d'entrée), dans une section ordinaire, et à un arrêt.
   */
  private arretsAutour(): number[] | null {
    const section = this.plan.sections.findIndex((s) => this.camY >= s.y0 && this.camY < s.y0 + s.hauteur)
    const arrets = this.arretsDe(section)
    if (arrets.length === 0 || this.camY <= arrets[0]!) return null
    return arrets.some((a) => Math.abs(a - this.camY) <= A_L_ARRET) ? null : arrets
  }

  /**
   * Un seul glissement à la fois : qui prend la caméra arrête le roulement et le passage en cours
   * (qui les attendait est libéré), et la caméra cesse de suivre l'avatar. `visee` faux : la visée
   * d'un chantier est laissée (l'adieu).
   */
  private prendreLaCamera(visee = true): void {
    this.arreterLeRoulement()
    this.arreterLePassage()
    this.suivre = false
    if (visee) this.visee = null
  }

  /** Le défilement en cours n'a plus rien à constater : ni son départ, ni son repos, ni l'arrêt qu'il a choisi au calme. */
  private oublierLeDefilement(): void {
    this.defilement = { aDater: false, depuis: null }
    this.pose = null
    this.depart = null
  }

  /** La caméra à `y`, d'un coup. */
  private poser(y: number): void {
    this.camY = y
    this.rappels.defilerVers(y)
  }

  /**
   * La caméra roule jusqu'à l'arrêt `y`, en `DUREE_DU_ROULEMENT` au tempo, et `fin` est rappelé à
   * l'arrivée. D'un coup quand le visiteur demande moins d'animations (l'horloge figée, le
   * roulement n'arriverait jamais), et quand elle y est déjà. Un seul glissement à la fois : celui
   * qui commence arrête les autres.
   */
  private rouler(y: number, fin: (() => void) | null): void {
    this.prendreLaCamera()
    if (this.calme || Math.abs(y - this.camY) <= A_L_ARRET) {
      this.poser(y)
      fin?.()
    } else {
      this.roulement = { y0: this.camY, y1: y, y: this.camY, t0: this.t, dur: auTempo(DUREE_DU_ROULEMENT) / 1000, fin }
    }
    this.demander()
  }

  /** Le roulement en cours s'arrête où il est ; qui l'attendait est libéré. */
  private arreterLeRoulement(): void {
    const r = this.roulement
    if (!r) return
    this.roulement = null
    r.fin?.()
  }

  /**
   * `defiler` vient de bouger la caméra depuis `avant`. Le moteur n'a pas d'autre signal : l'arrêt
   * du défilement se constate aux images (`constaterLeRepos`). Au calme, c'est ici que le geste
   * pose son arrêt, une fois : les défilements qui le suivent n'en posent pas d'autre.
   */
  private constaterLeDefilement(avant: number): void {
    // Sans section collante sur la carte, il n'y a rien à constater : la boucle ne tient pas pour lui.
    if (!this.bandes) return
    // Le passage commande la caméra : ce que la page rend n'est que l'écho de ce qu'il pose, et un
    // défilement du membre ne le détourne pas (un toucher, lui, le pose à sa fin).
    if (this.passage) return
    // La sortie de la vue d'ensemble a posé la caméra : la page le rend, à l'arrondi près. Cet écho
    // n'est le départ d'aucun geste : il ne lance ni passage d'entrée, ni rappel.
    if (this.sortie !== null) {
      if (Math.abs(this.camY - this.sortie) <= A_L_ARRET) return
      this.sortie = null
    }
    const r = this.roulement
    if (r) {
      // La page rend ce que le roulement a posé, tôt ou tard : tout ce qui tombe entre son départ
      // et là où il en est est un écho, pas un geste. Un vrai geste reprend la caméra au rappel et
      // à « Tu es ici » ; il ne détourne pas la marche qu'on attend.
      const echo = this.camY >= Math.min(r.y0, r.y) - A_L_ARRET && this.camY <= Math.max(r.y0, r.y) + A_L_ARRET
      if (r.fin || echo) return
      this.arreterLeRoulement()
    }
    this.defilement.aDater = true
    if (this.depart === null) this.depart = avant
    if (!this.calme || this.pose !== null) return
    const arrets = this.arretsAutour()
    if (!arrets) return
    // L'arrêt suivant dans le sens du geste : le dernier que ce défilement a franchi, sinon le premier devant lui.
    const descend = this.camY > avant
    const devant = descend ? arrets.filter((a) => a > avant + A_L_ARRET) : arrets.filter((a) => a < avant - A_L_ARRET).reverse()
    const franchis = devant.filter((a) => (descend ? a < this.camY : a > this.camY))
    this.pose = franchis[franchis.length - 1] ?? devant[0] ?? null
    // Sous un doigt posé, l'arrêt est choisi mais pas encore posé : il le sera au repos, le doigt levé.
    if (this.pose !== null && !this.doigt) this.poser(this.pose)
  }

  /**
   * Le défilement s'est arrêté : `defiler` s'est tu depuis `REPOS_DU_DEFILEMENT`, et aucun doigt
   * n'est posé (le rappel le combattrait). La caméra laissée dans une section collante, hors d'un
   * arrêt, revient au plus proche en roulant ; au calme, elle se pose d'un coup à celui
   * que le geste a choisi. Laissée dans une zone des temps où le geste est entré par un bord, elle
   * joue le passage d'entrée, sous la même garde : jamais sous un doigt posé. Les deux ne se
   * disputent pas la même fin de défilement : le passage passe d'abord, et le rappel ne vaut pas
   * avant le premier arrêt.
   */
  private constaterLeRepos(maintenant: number): void {
    const d = this.defilement
    if (d.aDater) {
      d.aDater = false
      d.depuis = maintenant
    }
    if (d.depuis === null || maintenant - d.depuis < REPOS_DU_DEFILEMENT || this.doigt) return
    d.depuis = null
    const pose = this.pose
    this.pose = null
    const depart = this.depart
    this.depart = null
    const entree = depart === null ? null : this.entreeAuGeste(depart)
    if (entree) {
      void this.direBonjour(entree.decennie, entree.sens)
      return
    }
    const arrets = this.arretsAutour()
    if (!arrets || this.roulement) return
    const proche = arrets.reduce((a, b) => (Math.abs(b - this.camY) < Math.abs(a - this.camY) ? b : a))
    this.rouler(pose ?? proche, null)
  }

  /**
   * Dit à la page si l'avatar est à l'écran, quand cela change seulement. Dans une section
   * collante, il n'y a pas d'avatar : c'est la caméra posée à l'arrêt de l'année du membre.
   */
  private signalerAvatar(): void {
    const arret = this.bandes ? this.arretDe(this.etat.anneeAvatar) : undefined
    const y = pointA(this.route, this.avatar.d).y - this.camY
    const vu = arret === undefined ? y >= HAUT_MASQUE && y <= this.H - BAS_MASQUE : arret !== null && Math.abs(this.camY - arret) <= A_L_ARRET
    if (vu === this.avatarVu) return
    this.avatarVu = vu
    this.rappels.avatarVisible(vu)
  }

  /**
   * La date d'un effet borné dans le temps (la case qui pousse, « +1 nacelle », le clap). Quand
   * le visiteur demande moins d'animations, l'horloge est figée : daté d'elle, l'effet resterait
   * à son premier instant pour toujours. Daté de -9 (« jamais »), il est déjà à son état final.
   */
  private instant(): number {
    return this.calme ? -9 : this.t
  }

  private achever(): void {
    // La caméra qui glissait vers un chantier s'y pose d'un coup. L'année ouverte, elle, n'est pas
    // achevée : son chantier reprend là où il en était quand les animations reviennent.
    if (this.visee !== null) {
      this.camY = this.visee
      this.rappels.defilerVers(this.visee)
      this.visee = null
    }
    // La caméra qui roulait vers un arrêt s'y pose d'un coup, et qui l'attendait est libéré.
    const r = this.roulement
    if (r) {
      this.roulement = null
      this.poser(r.y1)
      r.fin?.()
    }
    // Le passage d'entrée est posé à sa fin, et qui l'attendait est libéré.
    this.finirLePassage()
    const m = this.avatar.marche
    if (m) {
      this.avatar.marche = null
      this.avatar.d = m.d1
      this.fogY = this.fogCible
      m.fin()
    }
    const a = this.adieu
    if (a) {
      this.adieu = null
      a.fin()
    }
    // La bobine en vol arrive d'un coup : l'horloge figée la laisserait en l'air.
    this.atterrir()
  }

  /**
   * La roulotte descend depuis l'entrée de la section de son année et se gare 44 px avant la
   * case (maquette : `roulotteCarte`, `dCase(1) - 44`), en sept secondes. Le point 0 de chaque
   * tracé est l'entrée de sa section (`mondes/trace.ts`).
   */
  private roulotteGaree(): { x: number; y: number; dir: number; roule: boolean; posee: boolean; section: number } | null {
    const r = this.etat.roulotte
    if (!r || r.annee === null) return null
    const c = this.plan.cases.find((x) => x.annee === r.annee)
    const premiere = c ? this.plan.cases.find((x) => x.section === c.section) : undefined
    if (!c || !premiere) return null
    const depart = this.route.dWay[premiere.w - 1] ?? 0
    const garage = Math.max(depart, (this.route.dWay[c.w] ?? 0) - 44)
    const u = this.calme ? 1 : clamp((this.t - this.roulotteT0) / 7, 0, 1)
    const d = lerp(depart, garage, ease(u))
    const p = pointA(this.route, d)
    const a = pointA(this.route, Math.max(0, d - 4))
    const b = pointA(this.route, d + 4)
    return { x: p.x, y: p.y - this.camY, dir: b.x >= a.x ? 1 : -1, roule: u < 1 && !this.calme, posee: u >= 1, section: c.section }
  }

  /**
   * Un chantier qui commence hors de l'écran : la caméra va l'y chercher (idée 8 ; maquette :
   * `montrerChantier`, à 60 px des bords, vers `site − hauteur / 2`). Rien pour une année posée
   * bâtie (`t0` à -9) : ni au premier état, ni quand le visiteur demande moins d'animations.
   */
  private montrerChantier(): void {
    const { annee, t0 } = this.ouverte
    if (t0 < 0) return
    const c = this.plan.cases.find((x) => x.annee === annee)
    const s = c ? this.plan.sections[c.section] : undefined
    const site = s ? this.deps.mondeDe(s.decennie).siteDuChantier(annee) : null
    if (!s || site === null) return
    const y = s.y0 + site
    if (y >= this.camY + 60 && y <= this.camY + this.H - 60) return
    // La caméra cesse de suivre l'avatar (au bout d'une marche, elle le rejoint encore) : deux
    // glissements à la fois la laisseraient à mi-chemin.
    this.suivre = false
    this.visee = clamp(y - this.H / 2, 0, Math.max(0, this.plan.hauteur - this.H))
  }

  private poserAvatar(annee: number): void {
    const c = this.plan.cases.find((x) => x.annee === annee)
    if (!c) return
    this.avatar.d = this.route.dWay[c.w] ?? 0
    this.fogY = this.fogCible = c.y + 95
  }

  private marcherVers(d1: number, yCible: number): Promise<void> {
    this.fogCible = yCible + 95
    return new Promise((fin) => {
      if (this.calme) {
        this.avatar.d = d1
        this.fogY = this.fogCible
        this.rappels.defilerVers(cibleCamera(pointA(this.route, d1).y, this.H, this.plan.hauteur))
        this.demander()
        fin()
        return
      }
      const dur = clamp(650 + Math.abs(d1 - this.avatar.d) * 1.5, 700, 2200)
      this.avatar.marche = { d0: this.avatar.d, d1, t0: this.t, dur: dur / 1000, fin }
      this.suivre = true
      this.demander()
    })
  }

  private toucher(x: number, y: number): void {
    this.rappels.finApercu()
    const z = trouverZone(this.zones, x, y)
    if (!z) return
    if (z.id === 'case' && z.data !== null) {
      this.rappels.toucherAnnee(z.data)
      return
    }
    if (z.id === 'clap') {
      this.claquer()
      return
    }
    if (z.id === 'roulotte') {
      this.rappels.roulotte()
      return
    }
    const section = this.plan.sections.findIndex((s) => this.camY + y >= s.y0 && this.camY + y < s.y0 + s.hauteur)
    const s = this.plan.sections[section]
    // Une bobine se ramasse aussi quand le visiteur demande moins d'animations : elle arrive d'un coup.
    if (z.id === 'bobine' && z.data !== null) {
      const b = s ? this.deps.mondeDe(s.decennie).bobines[z.data] : undefined
      if (b) this.ramasser(b.cle, z.x, z.y)
      return
    }
    // Une date s'ouvre aussi quand le visiteur demande moins d'animations : c'est une lecture, pas un décor.
    if (z.id === 'date' && z.data !== null) {
      const d = s ? this.deps.mondeDe(s.decennie).dates[z.data] : undefined
      if (d) {
        this.reactions.set(`date:${z.data}`, this.t)
        this.rappels.date(d)
      }
      return
    }
    if (this.calme) return
    if (s) this.deps.mondeDe(s.decennie).reagir(z.id, z.data, this.vueMonde(section, 1), { x: z.x, y: z.y })
    this.demander()
  }

  /** Maquette : `ramasser`. La bobine quitte le décor tout de suite ; l'envol dure une seconde au tempo. */
  private ramasser(cle: string, x: number, y: number): void {
    if (this.trouvees.has(cle)) return
    this.trouvees.add(cle)
    // Celle qui vole encore arrive d'abord : la page ne compterait pas la nouvelle à son arrivée.
    this.atterrir()
    this.rappels.bobine(cle)
    if (this.calme) {
      this.rappels.bobineArrivee(cle)
    } else {
      this.envol = { cle, x0: x, y0: y, t0: this.t }
      this.particules.etincelles(x, y, 18, '#F6D98A')
    }
    this.demander()
  }

  /** La bobine en vol, s'il y en a une, est arrivée. */
  private atterrir(): void {
    const v = this.envol
    if (!v) return
    this.envol = null
    this.rappels.bobineArrivee(v.cle)
  }

  /** Où en est l'envol (maquette : `volPos`) : une parabole vers le compteur, `u` de 0 à 1. */
  private ouVole(): { x: number; y: number; u: number; e: number } | null {
    const v = this.envol
    if (!v) return null
    const cible = this.rappels.cibleBobines()
    const u = clamp((this.t - v.t0) / DUREE_DE_L_ENVOL, 0, 1)
    const e = ease(u)
    return { x: lerp(v.x0, cible.x, e), y: lerp(v.y0, cible.y, e) - Math.sin(u * Math.PI) * 80, u, e }
  }

  /**
   * Le centre de la case de `annee`, à l'écran (l'ancre de l'aperçu). Dans une section collante,
   * c'est le monde qui dit où se tient l'année (`SceneCollante.ecranDeLaCase`) ; hors de vue, comme
   * pour une année inconnue, le milieu de l'écran.
   */
  ecranDeLAnnee(annee: number): { x: number; y: number } {
    const milieu = { x: this.W / 2, y: this.H / 2 }
    const c = this.plan.cases.find((x) => x.annee === annee)
    if (!c) return milieu
    const scene = this.sceneDe(c.section)
    if (!scene) return { x: c.x * this.k, y: c.y - this.camY }
    return (this.ctx ? scene.ecranDeLaCase(this.vueMonde(c.section, 1), annee) : null) ?? milieu
  }

  private entrerEnsemble(): void {
    if (this.ens.cible === 1) return
    this.ens.cible = 1
    if (this.calme) this.ens.q = 1
    this.rappels.finApercu()
    this.rappels.ensemble(true)
    this.demander()
  }

  /**
   * Ferme la vue d'ensemble. `point` : où le toucher ou le pincement la quitte, à l'écran ; nul
   * quand elle se ferme sans désigner d'endroit (le bouton, « Tu es ici », Échap) : la caméra ne
   * bouge pas.
   */
  private quitterEnsemble(point: { x: number; y: number } | null): void {
    if (this.ens.cible === 0 && this.ens.q === 0) return
    const y = point ? this.sortieDeLEnsemble(point.x, point.y) : null
    if (y !== null) {
      // Sur une carte à section collante, la sortie prend la caméra : un seul glissement à la fois,
      // et le défilement d'avant n'a plus rien à constater (son départ dirait un geste entré dans
      // une zone des temps, son repos un rappel). Sur une carte ordinaire, rien de cela : la caméra
      // qui suivait l'avatar ou visait un chantier y repart à l'image suivante, comme avant le plan 3a.
      if (this.bandes) {
        this.prendreLaCamera()
        this.oublierLeDefilement()
        this.sortie = y
      }
      this.poser(y)
    }
    this.ens.cible = 0
    if (this.calme) this.ens.q = 0
    this.rappels.ensemble(false)
    this.demander()
  }

  /**
   * Où la caméra se pose quand la vue d'ensemble est quittée au point (`x`, `y`) de l'écran, en `y`
   * de carte ; nul : elle reste où elle est.
   *
   * Dans la bande d'un monde à `scene`, à l'arrêt de l'année que le monde désigne sous le point
   * (`LectureDeBande`, rendue à la dernière image dessinée de la vue d'ensemble). Nul si aucune
   * image de la vue d'ensemble n'a été dessinée, si le point n'y désigne aucune année, ou si l'année
   * désignée n'a pas d'arrêt.
   *
   * Dans une bande ordinaire, l'endroit touché au milieu de l'écran ; jamais dans une section
   * collante : touché près du haut de sa section, il laisserait la caméra entre deux arrêts de la
   * section d'avant, et elle se tient alors au haut de la section touchée.
   */
  private sortieDeLEnsemble(x: number, y: number): number | null {
    const geo = this.geoEnsemble()
    const section = geo.bandeSous(y)
    const s = this.plan.sections[section]
    if (!s) return null
    if (this.sceneDe(section)) {
      const annee = this.lectures.find((l) => l.section === section)?.lire(x, y) ?? null
      return annee === null ? null : (this.arretDe(annee) ?? null)
    }
    const fond = Math.max(0, this.plan.hauteur - this.H)
    const cible = clamp(geo.versMonde(y) - this.H * 0.5, 0, fond)
    return this.collanteEn(cible) ? clamp(s.y0, 0, fond) : cible
  }

  private geoEnsemble() {
    const ici = this.plan.cases.find((c) => c.annee === this.etat.anneeAvatar)
    const sources = this.plan.sections.map((s, i) => ({
      y0: s.y0,
      hauteur: s.hauteur,
      detaillee: genreDeBande(this.deps.mondeDe(s.decennie), i === ici?.section) === 'detaillee',
    }))
    return geoEnsemble(sources, this.H, 132, 64)
  }

  private demander(): void {
    if (!this.raf) this.raf = this.deps.demanderImage((t) => this.boucle(t))
  }

  private boucle(maintenant: number): void {
    this.raf = 0
    this.image(maintenant)
    const anime = !this.calme && this.visible
    const defile = this.defilement.aDater || this.defilement.depuis !== null
    if (anime || this.avatar.marche || this.adieu || this.suivre || this.envol || this.roulement || this.passage || defile || this.ens.q !== this.ens.cible) this.demander()
    else this.dernier = 0
  }

  private maj(dt: number): void {
    const m = this.avatar.marche
    if (m) {
      const pr = clamp((this.t - m.t0) / m.dur, 0, 1)
      this.avatar.d = lerp(m.d0, m.d1, ease(pr))
      if (pr >= 1) {
        this.avatar.marche = null
        m.fin()
      }
    }
    const a = this.adieu
    if (a && this.t - a.t0 >= this.deps.mondeDe(a.decennie).adieu) {
      this.adieu = null
      a.fin()
    }
    // Un seul glissement à la fois : celui qui a commencé après le roulement ou le passage l'emporte.
    if (this.suivre || this.visee !== null) {
      this.arreterLeRoulement()
      this.arreterLePassage()
    }
    const p = this.passage
    if (p) {
      const ecoule = this.t - p.t0
      const i = p.cles.findIndex((c) => c.t > ecoule)
      if (i < 0) this.finirLePassage()
      else {
        const avant = p.cles[i - 1]!
        const apres = p.cles[i]!
        const y = avant.y === apres.y ? avant.y : lerp(avant.y, apres.y, ease((ecoule - avant.t) / (apres.t - avant.t)))
        // Pendant une pause, la caméra y est déjà : rien à redire à la page.
        if (y !== this.camY) this.poser(y)
      }
    }
    const r = this.roulement
    if (r) {
      const pr = clamp((this.t - r.t0) / r.dur, 0, 1)
      r.y = pr >= 1 ? r.y1 : lerp(r.y0, r.y1, ease(pr))
      this.poser(r.y)
      if (pr >= 1) {
        this.roulement = null
        r.fin?.()
      }
    }
    if (this.suivre) {
      const cible = cibleCamera(pointA(this.route, this.avatar.d).y, this.H, this.plan.hauteur)
      const suivant = this.camY + (cible - this.camY) * Math.min(1, dt * 6)
      this.rappels.defilerVers(suivant)
      this.camY = suivant
      if (!this.avatar.marche && Math.abs(cible - suivant) < 1.5) this.suivre = false
    }
    if (this.visee !== null) {
      const suivant = this.camY + (this.visee - this.camY) * Math.min(1, dt * 6)
      this.rappels.defilerVers(suivant)
      this.camY = suivant
      if (Math.abs(this.visee - suivant) < 1.5) this.visee = null
    }
    this.fogY += (this.fogCible - this.fogY) * Math.min(1, dt * 1.6)
    if (this.ens.q !== this.ens.cible) this.ens.q = this.ens.cible > this.ens.q ? Math.min(1, this.ens.q + dt / 0.85) : Math.max(0, this.ens.q - dt / 0.85)
    if (!this.calme) this.particules.maj(dt)
    const vol = this.ouVole()
    if (vol) {
      // La traînée d'étincelles (maquette : la particule poussée à chaque image de `maj`).
      this.particules.etincelles(vol.x, vol.y, 1, '#F6D98A')
      if (vol.u >= 1) this.atterrir()
    }
  }

  /** La vue qu'un monde reçoit pour dessiner sa part : son repère, son horloge, ses zones. */
  private vueMonde(section: number, presence: number): VueMonde {
    const s = this.plan.sections[section]!
    const monde = this.deps.mondeDe(s.decennie)
    const ctx = this.ctx!
    const camC = this.camY + this.H / 2
    const ambiance = ambianceDeLHeure(this.deps.heure())
    const bati = this.plan.cases.filter((c) => c.section === section)
    const etats = new Map(this.etat.cases.map((c) => [c.annee, c]))
    const quittee = (annee: number) => !['verrou', 'encours'].includes(etats.get(annee)?.etat ?? 'verrou')
    const quittees = bati.filter((c) => quittee(c.annee))
    const zone = (id: string, lx: number, ly: number, lr: number, data?: number, prio = 0) => {
      const m = ctx.getTransform()
      const p = ecranDe(m, this.dpr, lx, ly)
      this.zones.push({ id, x: p.x, y: p.y, r: rayonEcran(m, this.dpr, lr), data: data ?? null, prio })
    }
    const t = horlogeDuMonde(this.t, monde.traitement.cadence)
    const trouvee = (i: number) => {
      const b = monde.bobines[i]
      return !b || this.trouvees.has(b.cle)
    }
    const derniere = quittees.reduce<{ rang: number; t0: number } | null>((acc, c) => {
      const t0 = this.pops.get(c.annee)
      return t0 !== undefined && (!acc || t0 > acc.t0) ? { rang: bati.indexOf(c), t0 } : acc
    }, null)
    return {
      ctx,
      W: this.W,
      H: this.H,
      k: this.k,
      t,
      vivant: !this.calme,
      presence,
      lum: ambiance.lum,
      nuit: ambiance.nuit,
      ecranY: (yLocal, f) => this.H / 2 + (s.y0 + yLocal - camC) * f,
      zone,
      feu: (x, y, r, c, force) => {
        const m = ctx.getTransform()
        const p = ecranDe(m, this.dpr, x, y)
        this.feux.push({ x: p.x, y: p.y, r: (r * Math.hypot(m.a, m.b)) / this.dpr, c, w: force ?? ctx.globalAlpha })
      },
      age: (cle) => {
        const t0 = this.reactions.get(cle)
        return t0 === undefined ? 99 : this.t - t0
      },
      marquer: (cle) => void this.reactions.set(cle, this.t),
      etincelles: (x, y, n, c) => (this.calme ? undefined : this.particules.etincelles(x, y, n, c)),
      confettis: (x, y, cs) => (this.calme ? undefined : this.particules.confettis(x, y, cs)),
      fumee: (x, y, n, l) => (this.calme ? undefined : this.particules.fumee(x, y, n, l)),
      image: (url) => this.deps.image(url, () => this.demander()),
      cases: bati.map((c) => ({
        annee: c.annee,
        etat: etats.get(c.annee)?.etat ?? 'verrou',
        profondeur: etats.get(c.annee)?.profondeur ?? 0,
        x: c.x * this.k,
        y: c.y - this.camY,
        pop: this.pops.get(c.annee) ?? -9,
      })),
      bati: { n: quittees.length, nouvelle: derniere?.rang ?? null, t0: derniere?.t0 ?? -9 },
      bouclee: this.etat.tampons.includes(s.decennie),
      roulotte: this.etat.roulotte && this.etat.roulotte.annee === null ? this.etat.roulotte.pseudo : null,
      adieu: this.adieu && this.adieu.decennie === s.decennie ? this.t - this.adieu.t0 : -1,
      ouverte: this.ouverte,
      brume: this.fogY - s.y0,
      // Plan 2d (maquette : `bobinePerdue`) : la zone d'une bobine passe devant tout le décor (priorité 3).
      bobine: (i, lx, ly, r) => {
        if (trouvee(i)) return
        dessinerBobinePerdue(ctx, lx, ly, r, i, t, !this.calme, monde.couleur)
        zone('bobine', lx, ly, r * 1.6, i, 3)
      },
      bobineTrouvee: trouvee,
      avance: this.camY - s.y0,
      entree: this.passage && this.passage.decennie === s.decennie ? this.t - this.passage.t0 : -1,
    }
  }

  private dessiner(): void {
    const g = this.ctx
    if (!g) return
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.zones = []
    this.feux = []
    const camC = this.camY + this.H / 2
    // Deux nombres par monde (plan 3a). Le poids de mélange : ce qui se mêle d'un monde à l'autre
    // (le ciel, le virage, la musique), et qui désigne la décennie à l'écran (le plus fort). La
    // présence : ce que le monde reçoit pour dessiner. Ils ne diffèrent qu'à l'entrée d'une
    // section collante, où la présence vaut 1 sans fondu et où le mélange suit la part de l'écran.
    const entrees = { H: this.H, collante: this.collantes }
    const poids = poidsSections(camC, this.plan.sections, entrees)
    const presence = presencesSections(camC, this.plan.sections, entrees)
    const sectionP = this.plan.sections[poids.indexOf(Math.max(...poids))]
    this.rappels.presences(this.plan.sections.map((s, i) => ({ musique: this.deps.mondeDe(s.decennie).musique, poids: poids[i] ?? 0 })), sectionP?.decennie ?? null)
    const mondeP = sectionP ? this.deps.mondeDe(sectionP.decennie) : null
    const e = this.ens.q ? ease(this.ens.q) : 0
    if (e < 0.999) {
      g.save()
      if (mondeP?.traitement.cadence) {
        const { dx, dy } = tremblement(this.t, mondeP.traitement.cadence, mondeP.traitement.tremblement, this.calme)
        g.translate(dx, dy)
      }
      this.scene(poids, presence, mondeP)
      g.restore()
    }
    // Ce que les mondes à `scene` rendent pour lire leur bande ne vaut que pour l'image qui vient d'être dessinée.
    this.lectures =
      e > 0.001 ? dessinerEnsemble(g, this.W, this.H, e, this.geoEnsemble(), this.plan, this.etat, (d) => this.deps.mondeDe(d), (url) => this.deps.image(url, () => this.demander())) : []
    const vol = this.ouVole()
    if (vol) dessinerEnvol(g, vol.x, vol.y, vol.e, this.t)
    this.particules.dessiner(g, true)
  }

  /** L'ordre des couches. Le corail vient en dernier : rien ne le voile ni ne le teinte. */
  private scene(poids: number[], presence: number[], principal: Monde | null): void {
    const g = this.ctx!
    const actifs = this.plan.sections.map((_, i) => i).filter((i) => presence[i]! > 0.01)
    const monde = (i: number) => this.deps.mondeDe(this.plan.sections[i]!.decennie)
    const vues = new Map(actifs.map((i) => [i, this.vueMonde(i, presence[i]!)]))
    const vue = (i: number) => vues.get(i)!
    const ambiance = ambianceDeLHeure(this.deps.heure())
    const mele = (choix: (m: Monde) => Rgb) => melanger(actifs.map((i) => choix(monde(i))), actifs.map((i) => poids[i]!))
    // 1. Le ciel, mêlé entre les mondes présents, selon l'heure (maquette : `scene`, bloc `ING.heure`).
    const { jourF, crep, nuitF } = ambiance
    const haut = mixc(mixc(mixc(mele((m) => m.palette.ciel), mele((m) => m.palette.cielJour), jourF), mele((m) => m.palette.cielCrepuscule), crep * 0.7), [3, 3, 7], nuitF * 0.5)
    const milieu = mixc(mixc(mixc(mele((m) => m.palette.fond), mele((m) => m.palette.fondJour), jourF), mele((m) => m.palette.fondCrepuscule), crep * 0.55), [10, 9, 12], nuitF * 0.45)
    const bas = mixc(mixc(mele((m) => m.palette.bas), mele((m) => m.palette.basJour), jourF), [12, 10, 10], nuitF * 0.4)
    const gr = g.createLinearGradient(0, 0, 0, this.H)
    gr.addColorStop(0, rgba(haut))
    gr.addColorStop(0.55, rgba(milieu))
    gr.addColorStop(1, rgba(bas))
    g.fillStyle = gr
    g.fillRect(0, 0, this.W, this.H)
    // 2. Les plans lointains et moyens de chaque monde présent (le monument est au plan moyen).
    for (const i of actifs) monde(i).dessinerCiel(vue(i))
    for (const i of actifs) monde(i).dessinerLointain(vue(i))
    for (const i of actifs) monde(i).dessinerMoyen(vue(i))
    // 3. Le sol : les tuiles de la route (pré-rendues, bornées par `MAX_TUILES`). Il est coupé net
    // au haut d'une section collante : dans la tuile par `dessinerSol`, ici pour le chemin parcouru.
    const i0 = Math.floor(this.camY / TUILE)
    const i1 = Math.floor((this.camY + this.H) / TUILE)
    for (let i = Math.max(0, i0); i <= i1 && i * TUILE < this.plan.hauteur; i++) {
      g.drawImage(this.tuile(i) as unknown as CanvasImageSource, 0, i * TUILE - this.camY, this.W, TUILE)
    }
    this.effets.parcouru(g, this.route, this.avatar.d, this.camY, this.t, !this.calme, this.bandes)
    // 4. Au sol : repères, portes, figurants ; puis les cases et l'avatar.
    for (const i of actifs) {
      const s = this.plan.sections[i]!
      const [px, py] = this.plan.points[s.porte]!
      monde(i).dessinerSol(vue(i), { x: px * this.k, y: py - this.camY })
    }
    // Dans une section collante, ni case commune, ni avatar : le monde dessine ses années, et le
    // moteur n'inscrit que la zone `case`, au point que le monde rend.
    const parAnnee = new Map(this.etat.cases.map((c) => [c.annee, c]))
    const chezLeMonde = new Map<number, { x: number; y: number }>()
    for (const c of this.plan.cases) {
      const y = c.y - this.camY
      const etat = parAnnee.get(c.annee)
      const collante = this.sceneDe(c.section)
      if (collante) {
        const v = vues.get(c.section)
        const p = v && etat ? collante.ecranDeLaCase(v, c.annee) : null
        if (p) {
          chezLeMonde.set(c.annee, p)
          this.zones.push({ id: 'case', x: p.x, y: p.y, r: 34, data: c.annee, prio: 1 })
        }
        continue
      }
      if (y < -110 || y > this.H + 70 || !etat) continue
      const m = this.deps.mondeDe(this.plan.sections[c.section]!.decennie)
      dessinerCase(g, c.x * this.k, y, etat, m, this.t, !this.calme, (url) => afficheTraitee(url, m.traitement, this.deps, this.affiches, () => this.demander()))
      this.zones.push({ id: 'case', x: c.x * this.k, y: y - 4, r: 34, data: c.annee, prio: 1 })
    }
    const pa = pointA(this.route, this.avatar.d)
    if (!this.collanteEn(pa.y)) {
      dessinerAvatar(g, pa.x, pa.y - this.camY, this.t - this.avatar.claque, !!this.avatar.marche, !this.calme)
      this.zones.push({ id: 'clap', x: pa.x, y: pa.y - this.camY - 16, r: 22, data: null, prio: 2 })
      this.effets.lumiere(g, pa.x, pa.y - this.camY - 4, this.t, !this.calme)
    }
    // 5. Les plans proches, les particules du monde, la brume de l'avenir.
    for (const i of actifs) monde(i).dessinerProche(vue(i))
    this.particules.dessiner(g, false)
    const brume = this.plan.sections.find((s) => this.fogY >= s.y0 && this.fogY < s.y0 + s.hauteur)
    // Aucune brume de l'avenir sur une section collante : le monde montre lui-même ses années fermées.
    if (this.bandes) {
      g.save()
      couperAuxBandes(g, this.bandes, -this.camY, -8, this.W + 16)
    }
    this.effets.brouillard(g, this.camY, this.fogY, (brume ? this.deps.mondeDe(brume.decennie) : principal)?.palette.brume ?? [40, 38, 36], this.t, !this.calme)
    if (this.bandes) g.restore()
    // La roulotte garée passe au-dessus de la brume : le Voyage suivi peut être loin devant.
    const rg = this.roulotteGaree()
    const roul = this.etat.roulotte
    const garage = rg ? this.sceneDe(rg.section) : null
    if (rg && roul && garage) {
      // Dans une section collante, le monde dessine le Voyage suivi et inscrit sa zone `roulotte`.
      const v = vues.get(rg.section)
      if (v && roul.annee !== null) garage.dessinerSuivi(v, { pseudo: roul.pseudo, annee: roul.annee })
    } else if (rg && roul) {
      const m = this.deps.mondeDe(this.plan.sections[rg.section]!.decennie)
      const url = imageCommune('roulotte.webp')
      const planche = url ? this.deps.image(url, () => this.demander()) : null
      dessinerRoulotte(g, rg.x, rg.y + 8, rg.dir, rg.roule, this.t, !this.calme, 0.42, roul.pseudo, m.couleur, ambiance.nuit, planche)
      if (rg.posee) dessinerPlaqueRoulotte(g, rg.x, rg.y - 48, `${roul.pseudo} est rendu en ${roul.annee}`, m.couleur)
      this.zones.push({ id: 'roulotte', x: rg.x, y: rg.y - 8, r: 36, data: null, prio: 2 })
    }
    // Ce qu'une année ouverte montre par-dessus la brume (idée 8 : le guichet de 1897, l'écriteau d'un chantier).
    for (const i of actifs) monde(i).dessinerSurLaBrume(vue(i))
    // L'adieu d'un monde, par-dessus tout son décor.
    for (const i of actifs) monde(i).dessinerAdieu(vue(i))
    // 6. Les voiles : la nuit et ses feux, le virage de chaque monde, la palpitation, la vignette, le grain.
    this.effets.nuit(g, this.feux, ambiance)
    for (const i of actifs) {
      const v = monde(i).traitement.virage
      if (!v) continue
      g.fillStyle = rgba(v.couleur, v.alpha * poids[i]!)
      g.fillRect(0, 0, this.W, this.H)
    }
    if (principal) {
      const a = scintillement(this.t, principal.traitement.cadence ?? 16, principal.traitement.scintillement, this.calme)
      if (a > 0) {
        g.fillStyle = `rgba(0,0,0,${a})`
        g.fillRect(0, 0, this.W, this.H)
      }
    }
    this.effets.vignette(g)
    this.effets.grain(g, principal?.traitement.grain ?? 0, this.t, !this.calme)
    // 7. Le corail, en dernier : la jauge et le millésime de l'année en cours — celle que la carte
    // dit `encours`, pas celle où se tient l'avatar (pendant une marche, ce ne sont pas les mêmes).
    // Jamais une année en attente du Voyage suivi : elle se dessine comme fermée, plaque comprise.
    const enCours = this.etat.cases.find((c) => c.etat === 'encours' && !c.attente)
    const place = enCours ? this.plan.cases.find((c) => c.annee === enCours.annee) : undefined
    // Dans une section collante, au point où le monde tient l'année ; rien si elle est hors de vue.
    const ou = !place ? undefined : this.sceneDe(place.section) ? chezLeMonde.get(place.annee) : { x: place.x * this.k, y: place.y - this.camY }
    if (enCours && ou) dessinerCorail(g, ou.x, ou.y, enCours, this.t, !this.calme)
  }

  private tuile(i: number): Toile {
    const deja = this.tuiles.get(i)
    if (deja) return deja
    const toile = this.deps.creerToile(Math.ceil(this.W * this.dpr), TUILE * this.dpr)
    const x = toile.getContext('2d')
    if (x && this.chemin) {
      x.scale(this.dpr, this.dpr)
      x.translate(0, -i * TUILE)
      dessinerSol(x, this.chemin, this.route, this.plan, this.etat, (d) => this.deps.mondeDe(d))
    }
    this.tuiles.set(i, toile)
    return toile
  }
}

/** La moyenne des couleurs, pondérée (les poids des sections présentes somment à 1). */
function melanger(couleurs: readonly Rgb[], poids: readonly number[]): Rgb {
  const total = poids.reduce((a, b) => a + b, 0) || 1
  const somme = [0, 1, 2].map((k) => couleurs.reduce((acc, c, i) => acc + c[k]! * poids[i]!, 0) / total)
  return [Math.round(somme[0]!), Math.round(somme[1]!), Math.round(somme[2]!)]
}
