import type { Rgb } from '../carte/outils'
import type { Rampe } from '../carte/rampe'
import type { Trace } from './trace'
import type { EtatCase } from '../voyage/regles'
import type { Recompense } from '../api/voyage'

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
  /** Les pages du Voyage de ce monde : la fiche d'une année, la fiche d'un film, le billet, la feuille (plan 2b). */
  pages: HabillagePages
}

/**
 * Les variables CSS des pages du Voyage. Un monde les pose toutes sur la racine de chaque page ; une
 * feuille de `src/voyage/` ou `src/pages/Voyage*.module.css` ne lit aucune couleur ni police
 * ailleurs (`src/voyage/habillage.test.ts`). Une couleur de maquette qui n'y trouve pas sa place
 * s'ajoute ici, et dans chaque monde.
 */
export const JETONS_DE_PAGE = [
  '--m-fond',
  '--m-tel',
  '--m-papier',
  '--m-papier2',
  '--m-carton',
  '--m-encre',
  '--m-encre2',
  '--m-or',
  '--m-or2',
  '--m-rouge',
  '--m-velours',
  '--m-doux',
  '--m-pale',
  '--m-filet',
  '--m-ombre',
  /** Le grain du papier : les points d'encre semés sur un prospectus (maquette 1890 : `.prospectus`). */
  '--m-grain',
  /** Le bas du dégradé d'un bouton doré (maquette 1890 : `.bouton-or`, `#b8904f`). */
  '--m-or3',
  /** Le bois : l'ombre portée d'un bouton doré, les cadres (maquette 1890 : `#6b4a2a`). */
  '--m-bois',
  '--m-f-titre',
  '--m-f-affiche',
  '--m-f-texte',
  '--m-f-capitales',
  '--m-f-corps',
] as const

export type JetonDePage = (typeof JETONS_DE_PAGE)[number]

/** Les mots des pages : une rubrique change de nom avec le monde (maquette 1890 : « La parade », « Ce soir à la baraque »). */
export interface MotsDesPages {
  /** L'annonce du fronton, selon l'année : en cours, bouclée, fermée, en attente du Voyage suivi. */
  annonce: { enCours: string; bouclee: string; fermee: string; attente: string }
  boniment: string
  lireOuverture: string
  echos: string
  programme: { sur: string; titre: string }
  parade: { titre: string; sous: string }
  seance: { titre: string; sous: string }
  nouvelleSalle: string
  jury: string
  /** Le mot d'un film introuvable sous son affiche (« perdu » en 1890). */
  introuvable: string
  fermee: { pancarte: string; dejaVus: string; enAvance: string }
  /** La phrase d'ambiance de l'intertitre d'une année fermée, avant le titre du passeport. */
  intertitre: string
  feuille: { tete: string; titre: string; sous: string; pied: string; imprimeur: string }
  billet: { tete: string; titre: string; valider: string; validerSous: string }
}

/** Ce que la page passe au monde pour le bandeau d'une fiche d'année (maquette 1890 : `dessinBandeau`). */
export interface VueBandeau {
  ctx: CanvasRenderingContext2D
  /** La toile en unités logiques : 390 de large, comme la maquette ; la page la met à l'échelle. */
  W: number
  H: number
  t: number
  vivant: boolean
  /** La nuit de l'heure du visiteur, de 0 à 1 (`ambianceDeLHeure`). */
  nuit: number
  mode: 'encours' | 'bouclee' | 'fermee' | 'attente'
  annee: number
  recompense: Recompense | null
  /** Les années de ce monde telles que la carte les voit : de quoi remplir la foire et allumer le fronton. */
  cases: readonly Pick<CaseVue, 'annee' | 'etat' | 'profondeur'>[]
  /** Le passeport porte-t-il la décennie ? */
  bouclee: boolean
  /**
   * Le Voyage suivi, dans tous les modes dès que le membre en suit un : sa roulotte arrive en
   * attente (et dit où il en est), traverse sinon, jamais une année fermée ; nulle sans Voyage
   * suivi et pour le compte IA.
   */
  roulotte: { pseudo: string; annee: number } | null
  /** Le dernier toucher du bandeau, en secondes de `t` ; -9 : jamais. */
  touche: number
}

/** La scène de la fiche d'un film (maquette 1890 : `dessinTheatre`) : l'image du film projetée, et le public. */
export interface VueScene {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  t: number
  vivant: boolean
  /** L'image du film (fond TMDB, sinon l'affiche), nulle tant qu'elle charge ou sans image : l'écran reste blanc de lumière. */
  image: CanvasImageSource | null
  touche: number
}

/** L'estrade du chroniqueur, au-dessus de la feuille (maquette 1890 : `dessinEstrade`). */
export interface VueEstrade {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  t: number
  vivant: boolean
  /** Le chroniqueur se tait, tape (l'attente) ou parle (le texte se compose). */
  parle: 'non' | 'tape' | 'parle'
}

export interface HabillagePages {
  jetons: Readonly<Record<JetonDePage, string>>
  mots: MotsDesPages
  /** Les hauteurs logiques des trois toiles (la maquette : 250, 300, 190). */
  hauteurs: { bandeau: number; scene: number; estrade: number }
  dessinerBandeau: (v: VueBandeau) => void
  dessinerScene: (v: VueScene) => void
  dessinerEstrade: (v: VueEstrade) => void
}
