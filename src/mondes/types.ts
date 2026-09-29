import type { Rgb } from '../carte/outils'
import type { Rampe } from '../carte/rampe'
import type { Trace } from './trace'
import type { EtatCase } from '../voyage/regles'

/**
 * Ce qui fait un monde (décision du propriétaire du 28 septembre 2026) : sa palette, son décor,
 * son monument, son traitement d'image. Le moteur de la carte (`src/carte/`) ne connaît que
 * cette interface ; ajouter les années 1900 crée `src/mondes/1900/` et une ligne dans
 * `src/mondes/index.ts`, rien d'autre. Le papier, les cadres et les sons s'y ajouteront avec les
 * pages qui les demandent (plans 2b et 2c).
 */
export interface Palette {
  /** Le fond, en haut, au milieu et en bas du ciel (maquette : `ciel`, `fond`, et le bas de `scene`). */
  ciel: Rgb
  fond: Rgb
  bas: Rgb
  /** Au jour et au crépuscule (maquette : `scene`, branches `jourF` et `crep`). */
  cielJour: Rgb
  fondJour: Rgb
  basJour: Rgb
  cielCrepuscule: Rgb
  fondCrepuscule: Rgb
  brume: Rgb
  nuage: string
  /** L'accent du monde : le titre du HUD, la porte, la marquise de la vue d'ensemble. Jamais le corail. */
  accent: string
  /** La pellicule de la route : bord, fond, perforations, cœur. */
  route: { bord: string; fond: string; perforations: string; coeur: string }
  /** Les cases : dessus clair et sombre, flanc clair et sombre, plaque du millésime. */
  caseFaite: { dessus: [string, string]; flanc: [string, string]; plaque: string }
  caseVerrou: { dessus: [string, string] }
  /**
   * La colonne Morris : fût sombre et clair, penchée ou non. Nulle : le monde ne porte pas de
   * colonne, et ses cases ne demandent aucune affiche (1890, maquette du 29 septembre 2026).
   */
  colonne: { fonce: string; clair: string; penche: number } | null
  /** La porte de fin de monde (maquette : `PORTE_OR`). */
  porte: { poteau: string; or: string; fond: string; texte: string; amp: string; ampH: string; cadre: string; tampon: string }
}

export interface Traitement {
  /** Les images par seconde du décor (16 pour la manivelle) ; nulle : continu. */
  cadence: number | null
  /** L'amplitude du tremblement du cadre, en px. */
  tremblement: number
  /** L'opacité maximale du voile qui palpite, plafonnée par `SCINTILLEMENT_MAX`. */
  scintillement: number
  /** L'opacité du grain. */
  grain: number
  /** Le virage posé sur tout le monde (sépia en 1890), sous la couche corail. */
  virage: { couleur: Rgb; alpha: number } | null
  /** Le traitement des affiches TMDB : par composition, jamais par lecture de pixels (canvas teinté). */
  affiches: 'sepia' | 'gris' | 'couleur'
}

/**
 * Une date vraie de l'histoire du cinéma, semée sur la carte (maquette du 29 septembre 2026 :
 * `DATES`). En coordonnées de la section ; elle ne se montre que pour une année ouverte.
 */
export interface DateVraie {
  an: number
  x: number
  y: number
  /** Sur l'affichette : « 22 mars ». */
  court: string
  lieu: string
  titre: string
  jour: string
  texte: string
  /** L'affiche ou le photogramme d'époque de la petite affiche, avec sa légende de crédit ; nul sans image. */
  image: { url: string; legende: string } | null
}

/** Une case telle que le monde la voit pour y poser ses figurants. */
export interface CaseVue {
  annee: number
  etat: EtatCase
  profondeur: number
  /** À l'écran, en px CSS. */
  x: number
  y: number
  /** Le moment (horloge du moteur) où la case vient de changer d'état, pour la faire « pousser ». */
  pop: number
}

/** Ce que le moteur passe à un monde pour qu'il dessine sa part d'image. */
export interface VueMonde {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  k: number
  /** L'horloge du décor, déjà tenue à la cadence du monde. */
  t: number
  /** Faux quand le visiteur demande moins d'animations : le décor se pose, immobile. */
  vivant: boolean
  /** La présence du monde à l'écran, de 0 à 1 (les fondus aux frontières). */
  presence: number
  /** Lumière (0,45 le jour, 1,3 la nuit) et nuit (0 à 1), d'après l'heure du visiteur. */
  lum: number
  nuit: number
  /** Un `y` du repère du monde, à l'écran, pour un plan de parallaxe `f` (1 : le sol). */
  ecranY: (yLocal: number, f: number) => number
  /** Inscrit une zone touchable dans le repère courant du contexte. */
  zone: (id: string, lx: number, ly: number, lr: number, data?: number, prio?: number) => void
  /** Un halo de nuit (maquette : `feu`) dans le repère courant. */
  feu: (x: number, y: number, r: number, couleur: string, force?: number) => void
  /** Depuis combien de secondes le décor `cle` a été touché (99 : jamais) ; `marquer` le touche. */
  age: (cle: string) => number
  marquer: (cle: string) => void
  /** Les particules du moteur, en px d'écran ; sans effet quand le visiteur demande moins d'animations. */
  etincelles: (x: number, y: number, n: number, couleur: string) => void
  confettis: (x: number, y: number, couleurs: readonly string[]) => void
  fumee: (x: number, y: number, n: number, large: number) => void
  /** Une image du monde (planche, photogramme), nulle tant qu'elle charge ; le moteur redessine à son arrivée. */
  image: (url: string) => CanvasImageSource | null
  cases: readonly CaseVue[]
  /** Le nombre d'années quittées de ce monde, et la dernière qui vient de l'être (sa nacelle pousse). */
  bati: { n: number; nouvelle: number | null; t0: number }
  bouclee: boolean
  /** Le pseudo de qui mène ce Voyage, quand sa roulotte traverse le monde ; nul quand elle est garée ailleurs ou absente. */
  roulotte: string | null
  /** Les secondes écoulées depuis que ce monde dit adieu (la cinématique de sortie) ; -1 hors adieu. */
  adieu: number
  /**
   * L'année où se tient l'avatar (`EtatCarte.anneeAvatar`, que la page n'avance qu'après la
   * marche), et le moment (horloge du moteur, avant sa cadence) où il y est arrivé en marchant :
   * la foire qui se bâtit à l'ouverture d'une année (idée 8). `t0` vaut -9 quand aucune marche ne
   * l'y a mené sous les yeux (ouverture de la carte, retour depuis une fiche, rechargement), au
   * recul, et quand le visiteur demande moins d'animations : ce qui s'y bâtit est déjà fini.
   */
  ouverte: { annee: number; t0: number }
  /** Le haut de la brume de l'avenir, en `y` du repère de la section ; négatif : toute la section y est. */
  brume: number
}

export interface Monde {
  cle: string
  decennie: number
  /** Vrai pour une décennie sans chantier : la vue d'ensemble la replie en une marquise. */
  aVenir: boolean
  nom: string
  sous: string
  /** « Chapitre I » ; nul pour un monde à venir. */
  chapitre: string | null
  /** Le titre du passeport (« Spectateur des origines ») ; nul pour un monde à venir. */
  titreVoyageur: string | null
  palette: Palette
  traitement: Traitement
  /** La rampe du monde : toute couleur du dessin y passe, sauf le corail. */
  couleur: Rampe['couleur']
  /** Les dates vraies semées sur le monde ; aucune pour un monde à venir. */
  dates: readonly DateVraie[]
  /** La durée, en secondes, de la cinématique de sortie ; 0 : le monde s'en va sans rien dire. */
  adieu: number
  trace: (annees: readonly number[]) => Trace
  /** Les plans, du plus lointain au plus proche. Chacun ne dessine rien si `presence` est nulle. */
  dessinerCiel: (v: VueMonde) => void
  dessinerLointain: (v: VueMonde) => void
  dessinerMoyen: (v: VueMonde) => void
  /** Au sol, après la route : repères, porte, figurants. */
  dessinerSol: (v: VueMonde, porte: { x: number; y: number }) => void
  dessinerProche: (v: VueMonde) => void
  /**
   * Par-dessus la brume de l'avenir et la roulotte garée, sous l'adieu : ce qu'une année ouverte
   * montre même quand la brume la couvre encore (le guichet de 1897, l'écriteau d'un chantier).
   */
  dessinerSurLaBrume: (v: VueMonde) => void
  /**
   * Où se bâtit ce qu'ouvre `annee` : un `y` du repère de la section, nul si rien ne s'y bâtit. La
   * caméra va l'y chercher quand le chantier commence hors de l'écran (idée 8 ; maquette :
   * `montrerChantier`).
   */
  siteDuChantier: (annee: number) => number | null
  /** La cinématique de sortie, par-dessus la brume, sous les voiles et le corail ; rien si `v.adieu < 0`. */
  dessinerAdieu: (v: VueMonde) => void
  /** Un toucher sur une zone du décor : `data` est celle de la zone, `ou` son centre à l'écran (d'où partent confettis et étincelles). */
  reagir: (id: string, data: number | null, v: VueMonde, ou: { x: number; y: number }) => void
}
