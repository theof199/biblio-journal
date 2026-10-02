import type { Rgb } from '../carte/outils'
import type { Rampe } from '../carte/rampe'
import type { Trace } from './trace'
import type { EtatCase } from '../voyage/regles'
import type { EtatCheval } from '../voyage/decennie'
import type { Recompense } from '../api/voyage'

/**
 * Ce qui fait un monde (décision du propriétaire du 28 septembre 2026) : sa palette, son décor,
 * son monument, son traitement d'image. Le moteur de la carte (`src/carte/`) ne connaît que
 * cette interface ; ajouter les années 1900 crée `src/mondes/1900/` et une ligne dans
 * `src/mondes/index.ts`, rien d'autre. Le papier et les cadres sont venus avec les pages (plans 2b
 * et 2c) ; la musique et les bobines perdues avec le plan 2d.
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
  /**
   * Cache la bobine perdue `i` (`Monde.bobines`) dans le repère courant, centrée en `lx`, `ly`, de
   * rayon `r` : le moteur la dessine et inscrit sa zone. Rien, ni dessin ni zone, pour une bobine
   * déjà trouvée sur cet appareil (plan 2d).
   */
  bobine: (i: number, lx: number, ly: number, r: number) => void
  /** Vrai pour une bobine déjà trouvée (ou inconnue) : ce qui la trahit (une lueur dans la brume) se tait. */
  bobineTrouvee: (i: number) => boolean
  /**
   * De combien la caméra est entrée dans la section : `camY − y0`, en pixels de carte (négatif tant
   * que le haut de la section est sous le haut de l'écran). Un monde à `scene` en tire tout ce qui
   * bouge ; le moteur le donne à tous les mondes.
   */
  avance: number
  /** Les secondes écoulées depuis le début du passage d'entrée joué (`SceneCollante.entree`) ; -1 hors passage. Le jumeau de `adieu`. */
  entree: number
}

/**
 * Un temps du passage d'entrée d'un monde (`SceneCollante.entree`) : la caméra va jusqu'à `y`, puis
 * s'y arrête. Les durées s'écrivent en millisecondes **de base, sans tempo** : le moteur seul les
 * joue au tempo (`voyage/tempo.ts`), là où il les joue.
 */
export interface TempsDEntree {
  /** Où la caméra se pose, en `y` du repère de la section (comme `VueMonde.avance`). */
  y: number
  /**
   * La durée du segment qui relie ce temps à celui d'avant dans la liste, en millisecondes de base :
   * elle appartient au segment, pas au sens. À l'endroit, c'est le temps mis pour venir ici depuis
   * le temps d'avant ; à l'envers, le trajet du temps i+1 au temps i dure la `duree` du temps i+1.
   * Celle du premier temps de la liste n'est jamais lue : aucun segment ne le précède, et la caméra
   * se pose d'un coup au premier temps du sens joué.
   */
  duree: number
  /**
   * La pause tenue à ce temps quand la caméra y arrive, dans les deux sens, en millisecondes de
   * base. Le passage finit après la pause du dernier temps joué.
   */
  arret: number
}

/** Le Voyage suivi garé dans une année d'une section collante (`EtatCarte.roulotte`, son année connue). */
export interface SuiviGare {
  pseudo: string
  annee: number
}

/** Où tient la bande d'un monde dans la vue d'ensemble, en px CSS de l'écran, et l'ouverture de cette vue. */
export interface CadreDeBande {
  x: number
  y: number
  w: number
  h: number
  /** L'ouverture de la vue d'ensemble, de 0 à 1 : l'opacité de ce qui s'y dessine. */
  e: number
  /**
   * Une image du monde (les photos des gares), nulle tant qu'elle charge ; le moteur redessine à son
   * arrivée. La même que `VueMonde.image`.
   */
  image: (url: string) => CanvasImageSource | null
}

/** Ce que la carte sait des années d'un monde, pour sa bande de la vue d'ensemble. */
export interface EtatDeBande {
  /** Les années de la section, dans l'ordre ; `attente` : en attente du Voyage suivi, à montrer fermée. */
  annees: readonly { annee: number; etat: EtatCase; attente: boolean }[]
  /** L'année où se tient le membre (`EtatCarte.anneeAvatar`), qu'elle soit de ce monde ou non. */
  anneeAvatar: number
}

/**
 * Ce que rend `SceneCollante.dessinerBande` : l'année que désigne le point (`x`, `y`) de l'écran, en
 * px CSS, dans la bande qui vient d'être dessinée ; nulle s'il n'en désigne aucune.
 */
export type LectureDeBande = (x: number, y: number) => number | null

/**
 * La scène collante d'un monde (plan 3a ; spec du monde 1900, « `Monde.scene` ») : sa section ne
 * glisse plus sous la caméra, le monde dessine lui-même ses années d'après `VueMonde.avance`, et
 * prend à sa charge ce que le moteur dessinait (la route, les cases, l'avatar, la roulotte garée,
 * la brume, sa bande de la vue d'ensemble).
 */
export interface SceneCollante {
  /** Où se tient `annee` à l'écran, en px CSS ; nul hors de vue. Le moteur y inscrit la zone `case` et y pose le corail. */
  ecranDeLaCase: (v: VueMonde, annee: number) => { x: number; y: number } | null
  /** Le Voyage suivi garé dans son année ; le monde inscrit lui-même sa zone `roulotte` (`v.zone`). */
  dessinerSuivi: (v: VueMonde, suivi: SuiviGare) => void
  /** La bande du monde dans la vue d'ensemble, dessinée dans `cadre`. Rend de quoi lire un toucher ou un pincement (`LectureDeBande`). */
  dessinerBande: (g: CanvasRenderingContext2D, cadre: CadreDeBande, etat: EtatDeBande) => LectureDeBande
  /** Les temps du passage d'entrée, dans l'ordre où il se joue à l'endroit. Vide : aucun passage. */
  entree: readonly TempsDEntree[]
  /** Les `y` de la section où la caméra se pose, un par année, dans l'ordre des années. */
  arrets: readonly number[]
}

/**
 * Une bobine perdue (plan 2d ; maquette carte v2 : `BOBINES`) : un film réellement perdu, caché
 * dans le décor d'un monde, à ramasser d'un toucher. L'appareil la garde trouvée sous sa `cle`.
 */
export interface BobinePerdue {
  /** Stable d'une version à l'autre : c'est elle que l'appareil retient, pas le rang. */
  cle: string
  titre: string
  /** « F. W. Murnau, 1928 ». */
  qui: string
}

/**
 * La musique d'un monde (plan 2d ; maquette carte v2 : l'orgue de barbarie de 1890, `PAR_TEMPS`,
 * `noteOrgue`, `planifier`). L'ambiance de la carte (`carte/son.ts`) la joue temps après temps,
 * au volume de la présence du monde à l'écran ; elle seule crée le contexte audio, au geste « Son ».
 */
export interface MusiqueDuMonde {
  /** La durée d'un temps, en secondes (maquette : `BATTUE`). */
  battue: number
  /** Le nombre de temps de l'air ; il reprend au premier ensuite. */
  temps: number
  /** Le volume à pleine présence (maquette : 0,5 pour l'orgue). */
  volume: number
  /** La coupure du passe-bas de sa sortie, en Hz (maquette : 2300 pour l'orgue). */
  filtre: number
  /** Joue le temps `pas` (de 0 à `temps` − 1), à l'instant `t0` du contexte, dans `sortie`. */
  jouer: (ctx: BaseAudioContext, sortie: AudioNode, pas: number, t0: number) => void
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
  /** La musique du monde quand le son est allumé ; nulle : le monde ne joue rien (le monde « à venir »). */
  musique: MusiqueDuMonde | null
  /** Les bobines perdues que cache le décor, que le monde pose par `VueMonde.bobine` ; aucune pour un monde à venir. */
  bobines: readonly BobinePerdue[]
  /**
   * La scène collante du monde ; nulle : sa section glisse sous la caméra et le moteur y dessine la
   * route, les cases et l'avatar (1890, le monde « à venir »).
   */
  scene: SceneCollante | null
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
  /** Les millésimes au pochoir (maquette 1890 : `--f-poch`, la palissade de l'écran IV). */
  '--m-f-pochoir',
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
  /**
   * Le billet de séance ; `tampon` est le mot que le tampon frappe (« VU »), `tamponAutour` ce qui
   * court autour de lui avant la date (maquette 1890 : `encreVu`).
   */
  billet: { tete: string; titre: string; valider: string; validerSous: string; tampon: string; tamponAutour: string }
  /** La page d'une décennie (plan 2c ; maquette 1890, écran IV). */
  decennie: { annonce: string; passeport: string; palissade: { titre: string; sous: string }; registre: string; prochainement: string }
  /** La boîte à billets (idée 5 ; maquette 1890, écran VII). */
  boite: { sur: string; titre: string; etiquette: string; tous: string; vide: string; ranger: string }
  /** Le guichet, la recherche du Voyage (maquette 1890, écran X). */
  recherche: { champ: string; catalogue: string; affiche: string; vide: string; ouvrir: string; partout: string }
  /** Tirer pour rafraîchir (idée 6 ; maquette 1890, écran I). */
  manivelle: { tirer: string; relacher: string; charge: string; fait: string; bouton: string }
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

/** Le monument de la page d'une décennie (maquette 1890 : `dessinManege`, le manège à dix chevaux). */
export interface VueMonument {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  t: number
  vivant: boolean
  nuit: number
  /** Les dix années de la décennie, et l'état de leur figure (`chevaux`, `voyage/decennie.ts`). */
  annees: readonly { annee: number; etat: EtatCheval }[]
  /** Les années de ce monde telles que la carte les voit, et le tampon : de quoi remplir la foire, comme le bandeau. */
  cases: readonly Pick<CaseVue, 'annee' | 'etat' | 'profondeur'>[]
  bouclee: boolean
  /** Le dernier toucher du monument hors d'une figure, en secondes de `t` ; -9 : jamais (le manège s'emballe). */
  touche: number
  /**
   * Inscrit, pour cette image, où se tient la figure d'une année, en unités de la toile : la page y
   * cherche le toucher achevé (`Toile.onChoisir`, jamais le premier contact, qui commence aussi un
   * défilement), la figure la plus proche sous son rayon, et ouvre l'année. `devant` : la figure est
   * peinte au premier plan (devant le pilier du manège) ; sous un doigt qui tombe à la fois sur une
   * figure de devant et sur une de derrière, celle de devant l'emporte toujours (`figureTouchee`).
   */
  zone: (annee: number, x: number, y: number, r: number, devant: boolean) => void
}

/** Le bandeau du guichet, sur la recherche du Voyage (maquette 1890 : `dessinGuichet`). */
export interface VueGuichet {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  t: number
  vivant: boolean
  nuit: number
  /** La dernière lettre tapée dans le champ, en secondes de `t` ; -9 : jamais (la lampe se ravive, le guichetier se penche). */
  frappe: number
}

export interface HabillagePages {
  jetons: Readonly<Record<JetonDePage, string>>
  mots: MotsDesPages
  /** Les hauteurs logiques des toiles (la maquette : 250, 300, 190, puis 330 et 170). */
  hauteurs: { bandeau: number; scene: number; estrade: number; monument: number; guichet: number }
  dessinerBandeau: (v: VueBandeau) => void
  dessinerScene: (v: VueScene) => void
  dessinerEstrade: (v: VueEstrade) => void
  dessinerMonument: (v: VueMonument) => void
  dessinerGuichet: (v: VueGuichet) => void
}
