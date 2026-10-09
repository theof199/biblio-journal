import type { Rgb } from '../carte/outils'
import type { Rampe } from '../carte/rampe'
import type { Trace } from './trace'
import type { EtatCase } from '../voyage/regles'
import type { EtatCheval } from '../voyage/decennie'
import type { Recompense } from '../api/voyage'
import type { ComponentType } from 'react'
import type { PropsAnneeFermee } from '../voyage/annee/AnneeFermee'
import type { PropsTeteDAnnee } from '../voyage/annee/Bandeau'
import type { PropsBoniment } from '../voyage/annee/Boniment'
import type { PropsCordeDAnnee } from '../voyage/annee/Corde'
import type { PropsFronton } from '../voyage/annee/Fronton'
import type { PropsHoraireDeLAnnee } from '../voyage/annee/Horaire'
import type { PropsHalteDeLaCarte } from '../voyage/halte/Halte'
import type { PropsWagonRestaurant } from '../voyage/wagon/tables'
import type { PropsTirette } from '../voyage/annee/Manivelle'
import type { PropsProgramme } from '../voyage/annee/Programme'
import type { PropsOrdreDAnnee } from '../voyage/annee/Ordre'
import type { PropsBilletDeSeance } from '../voyage/billet/BilletDeSeance'
import type { PropsBilletEnGrand } from '../voyage/boite/BilletEnGrand'
import type { PropsControleurDeLaCarte } from '../voyage/controleur/Controleur'
import type { PropsCasier } from '../voyage/boite/Casier'
import type { PropsFeteDeLAnnee } from '../voyage/celebrations/DessinDeLAnnee'
import type { PropsFeteDeLaRecompense } from '../voyage/celebrations/DessinDeLaRecompense'
import type { PropsFeteDeLaSalle } from '../voyage/celebrations/DessinDeLaSalle'
import type { PropsFeteDuBadge } from '../voyage/celebrations/BadgeColle'
import type { PropsFrontonDeDecennie } from '../voyage/decennie/FrontonDeDecennie'
import type { PropsLiens } from '../voyage/decennie/Liens'
import type { PropsLivret } from '../voyage/decennie/Livret'
import type { PropsMonument } from '../voyage/decennie/Monument'
import type { PropsOrdreDeDecennie } from '../voyage/decennie/Ordre'
import type { PropsRegistre } from '../voyage/decennie/Registre'
import type { PropsComptoir } from '../voyage/film/Comptoir'
import type { PropsNotice } from '../voyage/film/Notice'
import type { PropsProjection } from '../voyage/film/Projection'
import type { PropsMarches } from '../voyage/parade/Marches'
import type { PropsCatalogueDuGuichet } from '../voyage/recherche/Catalogue'
import type { PropsTeteDuGuichet } from '../voyage/recherche/Tete'
import type { PropsPageDuPasseport } from '../voyage/sacoche/Page'
import type { PropsPasseportDeLaSacoche } from '../voyage/sacoche/Pages'
import type { PropsMalleDeLaSacoche } from '../voyage/sacoche/Malle'
import type { PropsCourrierDeLaSacoche } from '../voyage/sacoche/Courrier'
import type { PropsObjetsDeLaSacoche } from '../voyage/sacoche/Objets'
import type { PropsCoulisses } from '../voyage/sacoche/Repli'
import type { PropsTeteDeLaSacoche } from '../voyage/sacoche/Tete'
import type { PropsPortefeuille } from '../voyage/sacoche/Tickets'
import type { PropsRayons } from '../voyage/salles/Rayons'
import type { PropsSalle } from '../voyage/salles/Salle'
import type { PropsProspectus } from '../voyage/seance/Prospectus'

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

/**
 * L'horaire accepté sur une année (`GET /me/voyage`, `annees[].horaire`) : où il en est, et le jour de
 * son échéance, `AAAA-MM-JJ`, à Paris. Une date sans heure : elle ne passe jamais par le fuseau de
 * l'appareil. Le serveur décide de l'état, le monde ne le recalcule pas d'après l'horloge.
 */
export interface HoraireVue {
  etat: 'accepte' | 'tenu' | 'manque'
  echeance: string
}

/**
 * Une halte servie (`GET /me/voyage`, `haltes[]`) : sa clé, son nom tel que servi (le poteau de
 * l'embranchement l'écrit, brief 12 des écrans des lots), l'année après laquelle elle s'embranche
 * (le tronçon entre `apres` et `apres + 1`), et de quoi dire « 2 sur 3 » : les films vus, sur ceux
 * que le serveur sert. Aucun catalogue dans l'appli : une halte que le serveur ne sert pas n'existe pas.
 */
export interface HalteVue {
  cle: string
  nom: string
  apres: number
  vus: number
  total: number
}

/** Une case telle que le monde la voit pour y poser ses figurants. */
export interface CaseVue {
  annee: number
  etat: EtatCase
  /**
   * En attente du Voyage suivi (`EtatCarte.cases`) : à montrer fermée, quel que soit `etat`. Requis :
   * le moteur le remplit toujours, et un banc de test le dit lui aussi.
   */
  attente: boolean
  /**
   * L'horaire accepté sur cette année (`CaseCarte.horaire`), nul si le membre n'en a pas pris. Requis
   * comme `attente` : le moteur le remplit toujours, et un banc de test le dit lui aussi.
   */
  horaire: HoraireVue | null
  profondeur: number
  /**
   * Les adresses des affiches de l'année (`CaseCarte.affiches`), dans l'ordre où la page les donne ;
   * vide sans affiche. Le moteur ne les charge pas pour le monde : il les demande par `image`.
   */
  affiches: readonly string[]
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
  /**
   * La présence du monde à l'écran, de 0 à 1 : un fondu à la frontière de deux sections ordinaires,
   * et à la sortie d'une section collante vers une section ordinaire. À l'entrée d'une section
   * collante, aucun fondu : le monde quitté vaut 1 tant que sa section est à l'écran, le monde à
   * `scene` dès que la sienne y entre, tous deux à 1 tant que la frontière est à l'écran.
   */
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
   * Pose l'objet caché `i` (`Monde.objets`) dans le repère courant, centré en `lx`, `ly`, de rayon
   * `r` : le moteur inscrit sa zone `objet` (priorité 3, rayon `r × 1,6`, comme une bobine) et **ne
   * dessine rien**, le monde dessine son objet. Aucune zone pour un objet déjà ramassé, ni pour un
   * rang inconnu.
   */
  objet: (i: number, lx: number, ly: number, r: number) => void
  /** Vrai pour un objet déjà ramassé (ou inconnu) : le monde ne le dessine plus. Le jumeau de `bobineTrouvee`. */
  objetRamasse: (i: number) => boolean
  /**
   * De combien la caméra est entrée dans la section : `camY − y0`, en pixels de carte (négatif tant
   * que le haut de la section est sous le haut de l'écran). Un monde à `scene` en tire tout ce qui
   * bouge ; le moteur le donne à tous les mondes.
   */
  avance: number
  /** Les secondes écoulées depuis le début du passage d'entrée joué (`SceneCollante.entree`) ; -1 hors passage. Le jumeau de `adieu`. */
  entree: number
  /**
   * Le passage d'entrée du monde d'après, quand la section qui suit celle-ci en a un
   * (`SceneCollante.entree`) : l'appeler le joue à l'endroit, par `MoteurCarte.direBonjour`, ce que
   * fait le bouton de la page, au calme compris. Nul sinon : aucune section ne suit (la carte cache
   * une décennie que le membre n'a pas atteinte), ou elle n'a pas de passage. Un décor s'en sert
   * depuis `reagir` (la halte au bout de la foire de 1890), jamais en dessinant.
   */
  passer: (() => void) | null
  /**
   * Un ticket qui mène dans la décennie d'après, ou plus loin, a-t-il été émis ? Vrai dès qu'il est
   * gagné et pour toujours : l'utiliser ne l'efface pas. Il ne dit pas que cette décennie est
   * ouverte (`passer` le dit) : entre les deux, le membre tient son ticket sans l'avoir utilisé.
   */
  ticketDApres: boolean
  /**
   * Les haltes servies qui s'embranchent après une année **de cette section** (`EtatCarte.haltes`),
   * dans l'ordre où la page les donne ; aucune : `[]`. Le monde qui en dessine l'embranchement y
   * inscrit lui-même la zone `aiguillage` (`zone`), dont `data` est **le rang de la halte dans cette
   * liste** : le moteur ne la passe jamais à `reagir`, il dit sa clé à la page
   * (`Rappels.aiguillage`), au calme aussi.
   */
  haltes: readonly HalteVue[]
}

/**
 * Un temps du passage d'entrée d'un monde (`SceneCollante.entree`) : la caméra se tient à `y` et y
 * marque une pause, qu'elle y soit venue d'un autre temps ou qu'elle y ait été posée d'un coup (le
 * premier temps du sens joué). Joué à l'envers, le passage est le retournement exact de l'endroit.
 * « Le temps i » désigne ici le rang du temps dans la liste, quel que soit le sens joué. Les durées
 * s'écrivent en millisecondes **de base, sans tempo** : le moteur seul les joue au tempo
 * (`voyage/tempo.ts`), là où il les joue.
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
   * La pause tenue à ce temps, en millisecondes de base, dans les deux sens. Elle se tient à chaque
   * temps joué, y compris celui où la caméra est posée d'un coup (le premier du sens joué) ; le
   * passage finit après la pause du dernier temps joué. Un monde qui ne veut pas de pause écrit 0.
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
  /**
   * L'ouverture de la vue d'ensemble, de 0 à 1 : l'opacité de ce qui s'y dessine. Le contexte la
   * porte déjà à l'appel de `dessinerBande` (`g.globalAlpha` vaut `e`) : un monde qui la multiplierait
   * encore l'appliquerait deux fois.
   */
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
 * Un ralenti du roulement (lot « moteur ») : de `de` à `a` (`de < a`), en `y` de la section comme
 * `SceneCollante.arrets`, la caméra qui roule ne garde que la part `allure` de sa vitesse, dans
 * `]0, 1]` (1 : aucun ralenti ; 0,36 : près de trois fois moins vite). Un rapport, pas une durée :
 * rien ici ne passe par le tempo.
 */
export interface Ralenti {
  de: number
  a: number
  allure: number
}

/**
 * La scène collante d'un monde (plan 3a ; spec du monde 1900, « `Monde.scene` ») : sa section ne
 * glisse plus sous la caméra, le monde dessine lui-même ses années d'après `VueMonde.avance`, et
 * prend à sa charge ce que le moteur dessinait (la route, les cases, l'avatar, la roulotte garée,
 * la brume, sa bande de la vue d'ensemble).
 */
export interface SceneCollante {
  /**
   * Où se tient `annee` à l'écran, en px CSS ; nul hors de vue. Le moteur y inscrit la zone `case` et
   * y pose le corail. Elle doit être pure : le moteur l'appelle pour chaque année de la section à
   * chaque image où le monde est présent, et aussi hors d'une image, pour l'ancre d'un aperçu (avec
   * une vue de présence 1, sur le contexte tel que la dernière image l'a laissé). Elle ne dessine
   * rien, n'inscrit aucune zone et ne retient rien.
   */
  ecranDeLaCase: (v: VueMonde, annee: number) => { x: number; y: number } | null
  /** Le Voyage suivi garé dans son année ; le monde inscrit lui-même sa zone `roulotte` (`v.zone`). */
  dessinerSuivi: (v: VueMonde, suivi: SuiviGare) => void
  /**
   * La bande du monde dans la vue d'ensemble, dessinée dans `cadre`. Rend de quoi lire un toucher ou un
   * pincement (`LectureDeBande`). Le moteur n'y peint ni fond ni marquise : seul le voile plein écran
   * de la vue d'ensemble reste commun, et le monde peint le fond de sa bande. Ce qu'il laisse sur le
   * contexte (opacité, coupe, repère) est défait après l'appel.
   */
  dessinerBande: (g: CanvasRenderingContext2D, cadre: CadreDeBande, etat: EtatDeBande) => LectureDeBande
  /**
   * Les temps du passage d'entrée, dans l'ordre où il se joue à l'endroit. Vide : aucun passage. Le
   * dernier temps est le premier arrêt (`arrets[0]`) : la zone où le geste lance le passage finit au
   * dernier temps, le rappel à l'arrêt ne vaut pas avant le premier arrêt. Plus haut, il reste entre
   * les deux une zone où la caméra laissée n'est ni prise par le passage ni rappelée ; plus bas, le
   * passage finit hors d'un arrêt, et le premier défilement constaté ensuite (l'écho que la page
   * rend de sa fin compris) rappelle la caméra à l'arrêt le plus proche.
   */
  entree: readonly TempsDEntree[]
  /**
   * Les `y` de la section où la caméra se pose, un par année, dans l'ordre des années, et croissants :
   * le moteur tient le premier de la liste pour le plus haut (le rappel ne vaut pas avant lui) et, au
   * calme, lit la liste dans son ordre pour trouver l'arrêt suivant dans le sens du geste.
   */
  arrets: readonly number[]
  /**
   * Où la caméra qui roule ralentit (lot « moteur »), croissants et disjoints, **tous à partir du
   * premier arrêt** (`de >= arrets[0]`) : rien ne ralentit la zone du passage d'entrée. Vide : aucun
   * ralenti. Le moteur les relit à chaque roulement (une avancée, « Tu es ici », le rappel à
   * l'arrêt), et là seulement : le doigt n'est jamais freiné, le passage d'entrée garde ses durées,
   * et au calme la caméra se pose d'un coup. Un roulement qui traverse un ralenti dure plus
   * longtemps d'autant ; celui dont le trajet n'en croise aucun, ou ne fait qu'en toucher le bord,
   * est inchangé. Le moteur ignore une allure hors de `]0, 1[` ; ce qu'un intervalle a au-delà de
   * ce que le défilement atteint n'est sur le trajet d'aucun roulement.
   */
  ralentis: readonly Ralenti[]
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
 * Un objet caché dans le décor d'un monde, à ramasser d'un toucher : le jumeau de `BobinePerdue`.
 * Le moteur n'en lit que la clé et n'en joue ni envol ni son ; le monde le dessine dans son décor.
 * La page, qui écrit le ramassage, en lit de quoi le dire et de quoi le faire voler vers la sacoche.
 */
export interface ObjetCache {
  /** Stable d'une version à l'autre, unique sur toute la carte : c'est elle que le moteur retient et dit à la page, pas le rang. Celle du contrat (`POST /me/voyage/objets/{cle}/ramasser`). */
  cle: string
  /** Ce que la page dit une fois l'objet rangé, sous son compte : une phrase entière, faite pour l'affichage. */
  phrase: string
  /** Son dessin, muet (`aria-hidden`), qui remplit le carré où la page le pose pour l'envol. Il ne lit rien. */
  Dessin: ComponentType
}

/**
 * La musique d'un monde (plan 2d ; maquette carte v2 : l'orgue de barbarie de 1890, `PAR_TEMPS`,
 * `noteOrgue`, `planifier`). L'ambiance de la carte (`carte/son.ts`) la joue temps après temps,
 * au volume du poids de mélange du monde ; elle seule crée le contexte audio, au geste « Son ».
 */
export interface MusiqueDuMonde {
  /** La durée d'un temps, en secondes (maquette : `BATTUE`). */
  battue: number
  /** Le nombre de temps de l'air ; il reprend au premier ensuite. */
  temps: number
  /** Le volume à plein poids de mélange (maquette : 0,5 pour l'orgue). */
  volume: number
  /** La coupure du passe-bas de sa sortie, en Hz (maquette : 2300 pour l'orgue). */
  filtre: number
  /** Joue le temps `pas` (de 0 à `temps` − 1), à l'instant `t0` du contexte, dans `sortie`. */
  jouer: (ctx: BaseAudioContext, sortie: AudioNode, pas: number, t0: number) => void
}

/**
 * Un glissement horizontal, en px CSS de l'écran (le repère de `VueMonde.zone`) : `x`, `y` où est
 * le doigt, `x0`, `y0` où il s'est posé. À la `fin`, `x`, `y` sont ceux du lever, ou du dernier
 * mouvement quand le geste est repris sans lever.
 */
export interface Glissement {
  phase: 'debut' | 'suite' | 'fin'
  x: number
  y: number
  x0: number
  y0: number
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
  /** Un toucher sur une zone du décor : `data` est celle de la zone, `ou` son centre à l'écran (d'où partent confettis et étincelles). Jamais au calme, sauf pour un identifiant de `touchesAuCalme`. Jamais pour une zone que le moteur traite lui-même (`aiguillage` en est). */
  reagir: (id: string, data: number | null, v: VueMonde, ou: { x: number; y: number }) => void
  /** Les pages du Voyage de ce monde : la fiche d'une année, la fiche d'un film, le billet, la feuille (plan 2b). */
  pages: HabillagePages
  /** La musique du monde quand le son est allumé ; nulle : le monde ne joue rien (le monde « à venir »). */
  musique: MusiqueDuMonde | null
  /** Les bobines perdues que cache le décor, que le monde pose par `VueMonde.bobine` ; aucune pour un monde à venir. */
  bobines: readonly BobinePerdue[]
  /** Les objets cachés du décor, que le monde pose par `VueMonde.objet` et dessine lui-même ; le moteur les lit au rang de la zone touchée. Aucun : `[]`. */
  objets: readonly ObjetCache[]
  /**
   * Les identifiants de zone de ce monde dont le toucher est un acte et non un décor : `reagir` les
   * reçoit **aussi** quand le visiteur demande moins d'animations, avec une vue où `vivant` est faux.
   * Tout autre identifiant ne lui parvient pas au calme. Aucun : `[]`.
   *
   * Le piège : au calme l'horloge du décor est figée. Une réaction reçue alors ne date rien
   * (`v.marquer` daterait de l'horloge figée, et `v.age` vaudrait zéro pour toujours) : elle pose un état.
   */
  touchesAuCalme: readonly string[]
  /**
   * Le glissement horizontal d'un doigt (ou de la souris, bouton tenu) sur la carte ; nul : le
   * monde n'en reçoit aucun (1890, le monde « à venir »). Le moteur l'appelle pour le monde de **la
   * décennie à l'écran** au `debut`, avec une vue de présence 1, au calme comme en mouvement
   * (`v.vivant` le dit) : c'est une manipulation, pas une animation, et elle ne date rien.
   *
   * Ce qu'il rend n'est lu qu'au `debut`. Vrai : le monde prend le geste, reçoit chaque `suite` et
   * une `fin`, une seule, et la page retient le défilement natif entre-temps. Faux : il ne reçoit
   * plus rien de cet appui, et le doigt défile comme toujours. La `fin` arrive au lever, mais aussi
   * quand le navigateur reprend le geste (`pointercancel`), quand un second doigt se pose, quand un
   * passage commence ou que la vue d'ensemble s'ouvre : elle ne dit pas que le doigt s'est levé.
   * Aucun glissement ne commence pendant un pincement ni sous la vue d'ensemble, et un glissement
   * n'est jamais un toucher : les zones sous le doigt ne reçoivent rien.
   */
  glisser: ((g: Glissement, v: VueMonde) => boolean) | null
  /**
   * La scène collante du monde ; nulle : sa section glisse sous la caméra et le moteur y dessine la
   * route, les cases et l'avatar (1890, le monde « à venir »).
   */
  scene: SceneCollante | null
}

/**
 * Les variables CSS des pages du Voyage. Un monde les pose toutes sur la racine de chaque page ; une
 * feuille de `src/voyage/`, `src/pages/Voyage*.module.css` ou d'un monde (`src/mondes/`) ne lit
 * aucune couleur ni police ailleurs (`src/voyage/habillage.test.ts`). Une couleur de maquette qui n'y trouve pas sa place
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
  /** L'émail : l'aplat d'une plaque (maquette 1900 : `--email`, le bleu des plaques de gare). */
  '--m-email',
  /** L'encre des tampons (maquette 1900 : `--violet`). */
  '--m-violet',
  /** Le vert : l'encre du tampon « Vu ensemble », une place prise à table, la plaque d'une halte (maquette 1900 : `--halte`, `--etq`, `#2f6b47` ; décision 12 du lot d'écrans). */
  '--m-vert',
  '--m-f-titre',
  '--m-f-affiche',
  '--m-f-texte',
  '--m-f-capitales',
  '--m-f-corps',
  /** Les millésimes au pochoir (maquette 1890 : `--f-poch`, la palissade de l'écran IV). */
  '--m-f-pochoir',
  /** Ce qu'une presse ou un composteur frappe : dates, numéros (maquette 1900 : `--f-presse`). */
  '--m-f-presse',
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
   * court autour de lui avant la date (maquette 1890 : `encreVu`). `ouvrir` et `ouvrirSous` nomment,
   * au guichet de la fiche d'un film, le geste qui mène à ce billet (« Je l’ai vu »).
   */
  billet: { tete: string; titre: string; valider: string; validerSous: string; tampon: string; tamponAutour: string; ouvrir: string; ouvrirSous: string }
  /**
   * La page d'une décennie (plan 2c ; maquette 1890, écran IV). `toucher` finit la phrase qui nomme
   * le monument, après « annonce décennie : » et sans point (« touchez un cheval pour ouvrir son
   * année ») ; nul, la phrase s'arrête à la décennie : le monument du monde n'a rien à toucher.
   */
  decennie: { annonce: string; toucher: string | null; passeport: string; palissade: { titre: string; sous: string }; registre: string; prochainement: string }
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

/**
 * Les sections de page qu'un monde peut composer lui-même (plan des pages 1900, brief 0) : pour une
 * clé, un composant qui reçoit **les mêmes propriétés** que le composant par défaut de `src/voyage/`
 * et se monte à sa place (`gabaritDe`, `src/voyage/gabarit.ts`). La page garde tout le reste : les
 * lectures, les mutations, les calques de l'adresse, le retour d'un billet, les fêtes, la navigation.
 * Un gabarit ne lit donc jamais l'API, et ne monte pas la section d'un autre.
 *
 * **Une clé s'ajoute dans la tâche qui la remplit, jamais d'avance** : la clé ici, typée par les
 * propriétés exportées du composant par défaut, la lecture dans la page, et le test qui prouve que le
 * défaut reste sans gabarit.
 */
export interface GabaritsDesPages {
  /** Le corps d'une année fermée ou en attente, son fronton compris (`voyage/annee/AnneeFermee.tsx`). */
  anneeFermee: ComponentType<PropsAnneeFermee>
  /**
   * La tête d'une fiche d'année, dans ses quatre modes et dès le chargement (`voyage/annee/Bandeau.tsx`).
   * Le lien de retour et la plaque du chapitre restent à la page, posés par-dessus.
   */
  teteDAnnee: ComponentType<PropsTeteDAnnee>
  /**
   * Le fronton d'une fiche prête ou en préparation (`voyage/annee/Fronton.tsx`), qui porte par défaut
   * le titre de la page. Un monde dont la tête porte déjà l'année le remplace pour ne pas la répéter ;
   * le titre de niveau 1 doit alors venir de sa tête. Le corps d'une année fermée monte le sien.
   */
  fronton: ComponentType<PropsFronton>
  /**
   * La corde des billets d'une fiche prête (`voyage/annee/Corde.tsx`) : où en est l'année, et ce que
   * le retour d'un billet vient d'y gagner. La région d'état qui dit le gain reste à la page.
   */
  corde: ComponentType<PropsCordeDAnnee>
  /** Le boniment d'une fiche prête (`voyage/annee/Boniment.tsx`), avec ses deux gestes : lire l'ouverture, et le générique. */
  boniment: ComponentType<PropsBoniment>
  /**
   * Le programme d'une fiche prête (`voyage/annee/Programme.tsx`) : ce qu'il reste à faire. La page le
   * monte sur toute fiche prête ; le défaut ne rend rien hors de l'année en cours.
   */
  programme: ComponentType<PropsProgramme>
  /**
   * Le dessin de ce qu'on tire pour recharger (`voyage/annee/Manivelle.tsx`, `Poignee`). Lue par
   * `Manivelle`, qui garde le geste, les seuils, les écouteurs, la région d'état et le bouton du bas.
   */
  tirette: ComponentType<PropsTirette>
  /**
   * Le cadre des salles d'une fiche prête (`voyage/salles/Rayons.tsx`) : ce qui les entoure, leur
   * titre. Il reçoit les salles déjà montées, une par salle ; la nouvelle salle et la feuille du
   * contexte restent à la page, après lui.
   */
  salles: ComponentType<PropsRayons>
  /**
   * Une salle de la fiche d'année (`voyage/salles/Salle.tsx`) : ses films, leur état, le contexte,
   * « En voir plus ». Lue par `voyage/salles/Salles.tsx`, qui garde le guet de la fournée, la requête
   * du contexte et le calque `voiture` de l'adresse.
   */
  salle: ComponentType<PropsSalle>
  /**
   * L'ordre des sections d'une fiche prête (`voyage/annee/Ordre.tsx`) : la corde, le boniment, le
   * programme, la parade, la séance, les salles et la ligne du bas, que la page monte et lui passe. Un
   * monde qui le remplit les range autrement, sans en composer ni en omettre aucune.
   */
  ordreDAnnee: ComponentType<PropsOrdreDAnnee>
  /**
   * Le podium d'une année (`voyage/parade/Marches.tsx`), sur une fiche prête comme sur une année en
   * attente. Lu par `voyage/parade/Parade.tsx`, qui garde le feuillet d'une marche (le calque
   * `marche` de l'adresse) et les écritures, et lui passe les deux gestes : ouvrir le feuillet, vider.
   */
  parade: ComponentType<PropsMarches>
  /**
   * La séance du soir (`voyage/seance/Prospectus.tsx`) : composer, la composition en cours, la séance
   * et ses quatre talons, les séances passées. Lue par `voyage/seance/Seance.tsx`, qui garde les
   * écritures et leur verrou, le guet et le feuillet des remplacements. La page ne la monte qu'au
   * compte IA, sur l'année en cours.
   */
  seance: ComponentType<PropsProspectus>
  /**
   * La projection en tête de la fiche d'un film (`voyage/film/Projection.tsx`) : par défaut la scène
   * du monde sur une toile. Elle reçoit l'image que la page a choisie et chargée, et le calme. Le lien
   * de retour reste à la page, posé par-dessus.
   */
  projection: ComponentType<PropsProjection>
  /**
   * La notice de la fiche d'un film (`voyage/film/Notice.tsx`) : le titre de la page, les réalisateurs
   * et leurs liens vers les Suivis, la raison, ce que j'en ai dit. Elle reçoit le programme et le
   * guichet déjà montés par la page et les rend tels quels ; la feuille du chroniqueur reste à la page.
   */
  noticeDuFilm: ComponentType<PropsNotice>
  /**
   * Le dessin du guichet de la fiche d'un film (`voyage/film/Comptoir.tsx`). Lu par
   * `voyage/film/Guichet.tsx`, qui garde les écritures et leur verrou, les adresses du billet et le
   * feuillet du podium, et lui passe les gestes offerts (`boutonsDuFilm`) : le dessin n'en ajoute aucun.
   */
  guichetDuFilm: ComponentType<PropsComptoir>
  /**
   * Le dessin du billet de séance (`voyage/billet/BilletDeSeance.tsx`) : la tête, la date, la note, les
   * réactions, la remarque, le tampon, le numéro, le bouton. Lu par `pages/VoyageBillet.tsx`, qui garde
   * le brouillon et sa garde, l'écriture et la suppression, la lecture de la boîte où se lit le numéro,
   * la séquence du compostage (ses attentes, sa vibration, « la page est-elle montée ? ») et le retour
   * à l'année. Le dessin reçoit l'étape et le tirage en cours : il ne les décide pas.
   */
  billetDeSeance: ComponentType<PropsBilletDeSeance>
  /**
   * Le casier de la boîte à billets (`voyage/boite/Casier.tsx`) : les intercalaires, « Tous », et les
   * billets du casier ouvert. Lu par `pages/VoyageBoite.tsx`, qui garde les deux lectures (la carte, mes
   * films de la décennie), l'intercalaire et le billet ouvert dans l'adresse, et le billet rangé, montré
   * une fois. Les billets lui arrivent numérotés, le dernier devant (`casier`) : il ne numérote rien.
   */
  casier: ComponentType<PropsCasier>
  /**
   * Le dessin d'un billet de la boîte ouvert en grand (`voyage/boite/BilletEnGrand.tsx`) : la date, la
   * note, les réactions, ma remarque, « Corriger » quand la page l'offre. Lu par
   * `voyage/boite/Visionneuse.tsx`, qui garde la lecture du catalogue des réactions. Il se tient en
   * dialogue (`useDialogue`) : le focus pris et rendu, Échap.
   */
  billetEnGrand: ComponentType<PropsBilletEnGrand>
  /**
   * Le monument en tête de la page d'une décennie (`voyage/decennie/Monument.tsx`) : par défaut la
   * toile du monde, dont une figure touchée ouvre son année. La page garde la navigation, le lien de
   * retour et la plaque du chapitre, posés par-dessus.
   */
  monument: ComponentType<PropsMonument>
  /**
   * Le fronton de la page d'une décennie (`voyage/decennie/FrontonDeDecennie.tsx`), qui porte le titre
   * de niveau 1. Il reçoit les arrêts de la ligne : de quoi dire où j'en suis, sans rien recompter.
   */
  frontonDeDecennie: ComponentType<PropsFrontonDeDecennie>
  /**
   * Le passeport de la page d'une décennie (`voyage/decennie/Livret.tsx`) : le tampon ou sa place, ce
   * qui manque (la phrase, son attente, sa panne, que la page décide), et la frontière passée : le
   * tampon de la décennie d'avant, l'entrée faite ou non. La page garde la lecture des tickets.
   */
  livret: ComponentType<PropsLivret>
  /**
   * Le registre de la page d'une décennie (`voyage/decennie/Registre.tsx`) : une ligne par année, lien
   * vers sa page quand elle en a une (`ouvrable`). C'est le chemin du clavier et du lecteur d'écran.
   */
  registre: ComponentType<PropsRegistre>
  /** Les liens de la page d'une décennie vers sa boîte et son guichet (`voyage/decennie/Liens.tsx`). */
  liensDeDecennie: ComponentType<PropsLiens>
  /**
   * L'ordre des sections de la page d'une décennie, sous le monument et le fronton
   * (`voyage/decennie/Ordre.tsx`) : le passeport, la palissade, le registre et les liens, que la page
   * monte et lui passe. Un monde les range autrement ; la palissade est la seule qu'il peut ne pas montrer.
   */
  ordreDeDecennie: ComponentType<PropsOrdreDeDecennie>
  /**
   * La tête du guichet, la recherche du Voyage (`voyage/recherche/Tete.tsx`) : par défaut le bandeau
   * du monde sur une toile et la fenêtre du guichet. Lue par `pages/VoyageRecherche.tsx`, qui garde la
   * saisie et sa mémoire, le comportement du champ au doigt (il monte au-dessus du clavier) et le
   * retour : elle passe le formulaire et le champ tout réglés, et le lien de retour monté.
   */
  teteDuGuichet: ComponentType<PropsTeteDuGuichet>
  /**
   * Le catalogue du guichet (`voyage/recherche/Catalogue.tsx`) : les années qui se cochent, le titre
   * de la page, les vues trouvées ou « les plus demandées », l'attente, la panne, le vide. La page
   * garde les lectures et la recherche : les vues arrivent cherchées, rien ne part à la frappe.
   */
  catalogueDuGuichet: ComponentType<PropsCatalogueDuGuichet>
  /**
   * La tête de la sacoche du voyageur (`voyage/sacoche/Tete.tsx`), qui porte le titre de niveau 1.
   * Lue par `pages/VoyageSacoche.tsx` au monde de mon année en cours ; le lien de retour reste à la page.
   */
  teteDeLaSacoche: ComponentType<PropsTeteDeLaSacoche>
  /**
   * Le cadre du passeport de la sacoche (`voyage/sacoche/Pages.tsx`) : son titre, l'attente, la
   * panne, « aucun tampon ». Lu par `voyage/sacoche/Passeport.tsx` au monde de mon année en cours, qui
   * garde la région du bloc (elle ne se remonte pas quand le monde change) ; les pages lui arrivent
   * montées, une par décennie, et il n'en habille aucune.
   */
  passeportDeLaSacoche: ComponentType<PropsPasseportDeLaSacoche>
  /**
   * Une page du passeport de la sacoche (`voyage/sacoche/Page.tsx`) : le tampon de la décennie, ou
   * son anneau, et le lien vers sa page. **Lue au monde de la décennie de la page**, jamais à celui
   * de l'année en cours : chaque décennie garde son dessin dans la sacoche d'une autre.
   */
  pageDuPasseport: ComponentType<PropsPageDuPasseport>
  /**
   * Le dessin du portefeuille de la sacoche (`voyage/sacoche/Tickets.tsx`) : les tickets rangés,
   * l'attente, la panne, le refus. Lu par `voyage/sacoche/Portefeuille.tsx`, qui garde les lectures,
   * l'encaissement et son verrou, et la navigation ; « Utiliser » n'arrive que sur le ticket offert.
   */
  portefeuille: ComponentType<PropsPortefeuille>
  /**
   * Le dessin des Coulisses de la sacoche (`voyage/sacoche/Repli.tsx`) : le pli, les dépenses, les
   * crédits. Lu par `voyage/sacoche/Coulisses.tsx`, qui garde le pli et la lecture des dépenses,
   * partie au dépli seulement.
   */
  coulisses: ComponentType<PropsCoulisses>
  /**
   * La malle aux étiquettes de la sacoche (plan des écrans des lots, brief 2) : sa ligne, et la malle
   * ouverte. **Sans défaut** (`ClesSansDefaut`) : un monde qui ne la compose pas ne monte pas le bloc
   * `voyage/sacoche/Malle.tsx`, qui ne lit alors ni la malle ni l'état du voyageur. Le bloc garde la
   * région, les lectures, la marque « vue », ce qui est nouveau et le calque de l'adresse.
   */
  malleDeLaSacoche: ComponentType<PropsMalleDeLaSacoche>
  /**
   * Les objets trouvés de la sacoche (plan des écrans des lots, brief 3) : les places de consigne du
   * monde, qui porte le catalogue (les clés, les noms, les dessins). **Sans défaut** : un monde qui ne
   * la compose pas ne monte pas le bloc `voyage/sacoche/Objets.tsx`, qui ne lit alors pas l'état du
   * voyageur. Le bloc garde la région, la lecture et la marque « vue » ; il passe ce que le serveur
   * sert, tel quel.
   */
  objetsDeLaSacoche: ComponentType<PropsObjetsDeLaSacoche>
  /**
   * Le courrier de la sacoche (plan des écrans des lots, brief 13) : mes cartes postales reçues et
   * envoyées, et la carte ouverte. **Sans défaut** (`ClesSansDefaut`) : un monde qui ne la compose pas
   * ne monte pas le bloc `voyage/sacoche/Courrier.tsx`, qui ne lit alors ni ma boîte ni l'état du
   * voyageur, et la carte ne lit pas la boîte pour le point rouge. Le bloc garde la région, la
   * lecture, la rubrique marquée vue, la carte reçue marquée lue et le calque de l'adresse.
   */
  courrierDeLaSacoche: ComponentType<PropsCourrierDeLaSacoche>
  /**
   * Le dessin de la salle bouclée (`voyage/celebrations/DessinDeLaSalle.tsx`) : le rideau, le carton.
   * Lu par `voyage/celebrations/SalleBouclee.tsx`, qui garde le cadre (le dialogue, le toucher,
   * Échap), le déroulé, le clap et la vibration. Il reçoit la salle telle que la fiche la montre.
   */
  feteDeLaSalle: ComponentType<PropsFeteDeLaSalle>
  /**
   * Le dessin de la récompense (`voyage/celebrations/DessinDeLaRecompense.tsx`) : la presse, l'emblème,
   * son nom. Lu par `voyage/celebrations/PresseAMedailles.tsx`, qui garde le cadre, le déroulé et ce
   * qui s'entend. Il reçoit les récompenses des années d'avant de la décennie, lues de la carte.
   */
  feteDeLaRecompense: ComponentType<PropsFeteDeLaRecompense>
  /**
   * Le dessin d'une étiquette de la malle qui vient de se coller (plan des écrans des lots, brief 6 ;
   * un badge : « étiquette » seul est la récompense). Lu par `voyage/celebrations/BadgeColle.tsx`,
   * qui garde le cadre, le déroulé et ce qui s'entend. **Sans défaut** (`ClesSansDefaut`) : un monde
   * qui ne la compose pas ne lit la malle ni sur le billet (`pages/VoyageBillet.tsx`) ni au retour
   * (`pages/VoyageAnnee.tsx`), et le séquenceur ne joue aucune scène de badge.
   */
  feteDuBadge: ComponentType<PropsFeteDuBadge>
  /**
   * Le dessin de l'année bouclée (`voyage/celebrations/DessinDeLAnnee.tsx`) : le fronton, la médaille,
   * les confettis, le billet tendu. Lu par `voyage/celebrations/AnneeBouclee.tsx`, qui garde le cadre,
   * le déroulé, le choix (« Le garder », « L’utiliser »), sa garde et le ticket montré une fois. Il
   * reçoit les arrivées de l'année, calculées par la règle de la fiche.
   */
  feteDeLAnnee: ComponentType<PropsFeteDeLAnnee>
  /**
   * Le contrôleur des billets qui passe sur la carte (plan des écrans des lots, brief 7) : son
   * dialogue entier, la demande, les deux réponses, la portière qu'on referme. **Sans défaut**
   * (`ClesSansDefaut`), que `pages/Carte.tsx` lit au monde de mon année en cours (avec `halteDeLaCarte`, lue au monde de la halte) : un
   * monde qui ne la compose pas ne lit pas l'état du voyageur pour lui et ne monte pas
   * `voyage/controleur/Controleur.tsx`, qui garde la lecture du billet, l'écriture de la réponse, son
   * verrou, Échap et le focus.
   */
  controleurDeLaCarte: ComponentType<PropsControleurDeLaCarte>
  /**
   * L'horaire d'une gare, sur la fiche de son année (plan des écrans des lots, brief 10) : ce que la
   * gare propose, l'horaire accepté et ses deux gestes, tenu, manqué. **Sans défaut**
   * (`ClesSansDefaut`) : un monde qui ne la compose pas ne monte pas `voyage/annee/Horaire.tsx`, qui
   * garde les deux écritures et leur verrou, et la page ne dit alors rien de l'horaire à sa tête ni à
   * son programme. Le bloc ne lit aucune route : tout vient de la fiche que la page tient.
   */
  horaireDeLAnnee: ComponentType<PropsHoraireDeLAnnee>
  /**
   * Une halte ouverte sur la carte (plan des écrans des lots, brief 12) : son dialogue entier, le nom
   * servi, le compte, ses films, « Revenir sur la ligne ». **Sans défaut** (`ClesSansDefaut`), lue par
   * `pages/Carte.tsx` au monde **de la décennie de la halte** (son `apres`) : un monde qui ne la
   * compose pas n'ouvre rien, même si un aiguillage dit sa clé, et ne monte pas
   * `voyage/halte/Halte.tsx`, qui garde Échap, le focus et le compte. Rien n'y lit ni n'y écrit.
   */
  halteDeLaCarte: ComponentType<PropsHalteDeLaCarte>
  /**
   * Le wagon-restaurant (plan des écrans des lots, brief 15) : mes tables, dans l'ordre servi, ce que
   * chacune dit de ses deux convives, et les deux gestes de l'invité. **Sans défaut**
   * (`ClesSansDefaut`), lue par `pages/VoyageWagonRestaurant.tsx` au monde **de mon année en cours** :
   * dans un monde qui ne la compose pas, la page renvoie à la carte et ne lit aucune table.
   */
  wagonRestaurant: ComponentType<PropsWagonRestaurant>
}

/**
 * Les clés **sans défaut** (décision 1 du propriétaire, 8 octobre 2026 : les écrans des lots sont de
 * 1900 seulement) : aucun composant de `src/voyage/` ne les dessine. Elles se lisent par
 * `gabaritSeul` (`src/voyage/gabarit.ts`), qui rend le composant du monde ou rien, jamais par
 * `gabaritDe` ; sans composant, le bloc lecteur ne se monte pas et aucune requête ne part.
 */
export type ClesSansDefaut = 'malleDeLaSacoche' | 'objetsDeLaSacoche' | 'courrierDeLaSacoche' | 'feteDuBadge' | 'controleurDeLaCarte' | 'horaireDeLAnnee' | 'halteDeLaCarte' | 'wagonRestaurant'

export interface HabillagePages {
  jetons: Readonly<Record<JetonDePage, string>>
  mots: MotsDesPages
  /**
   * Les sections que ce monde compose lui-même ; une clé absente garde le composant par défaut.
   * Aucune (`{}`) : 1890 et le monde « à venir », dont les pages sont les défauts mêmes.
   */
  gabarits: Readonly<Partial<GabaritsDesPages>>
  /** Les hauteurs logiques des toiles (la maquette : 250, 300, 190, puis 330 et 170). */
  hauteurs: { bandeau: number; scene: number; estrade: number; monument: number; guichet: number }
  dessinerBandeau: (v: VueBandeau) => void
  dessinerScene: (v: VueScene) => void
  dessinerEstrade: (v: VueEstrade) => void
  dessinerMonument: (v: VueMonument) => void
  dessinerGuichet: (v: VueGuichet) => void
}
