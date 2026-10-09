import type { HabillagePages, JetonDePage } from '../types'
import { VERT } from './couleur'
import Affiche from './pages/Affiche'
import BadgeColleSurLaMalle from './pages/BadgeColleSurLaMalle'
import BilletDuCasier from './pages/BilletDuCasier'
import CasierDuControleur from './pages/CasierDuControleur'
import Classes from './pages/Classes'
import Composteur from './pages/Composteur'
import Compteur from './pages/Compteur'
import Correspondances from './pages/Correspondances'
import ControleurDeLaCarte from './pages/ControleurDeLaCarte'
import HalteDeLaCarte from './pages/HalteDeLaCarte'
import CoulissesDeLaSacoche from './pages/CoulissesDeLaSacoche'
import CourrierDeLaSacoche from './pages/CourrierDeLaSacoche'
import Courroie from './pages/Courroie'
import EtiquetteDeMalle from './pages/EtiquetteDeMalle'
import Frontiere from './pages/Frontiere'
import Gare from './pages/Gare'
import Grille from './pages/Grille'
import GuichetDuFilm from './pages/GuichetDuFilm'
import Guide from './pages/Guide'
import HoraireDeLaGare from './pages/HoraireDeLaGare'
import Hale from './pages/Hale'
import Indicateur from './pages/Indicateur'
import IndicateurDeLaLigne from './pages/IndicateurDeLaLigne'
import LiensDeLaLigne from './pages/LiensDeLaLigne'
import LigneBouclee from './pages/LigneBouclee'
import LigneDesAnnees from './pages/LigneDesAnnees'
import NoticeDuFilm from './pages/NoticeDuFilm'
import MalleDeLaSacoche from './pages/MalleDeLaSacoche'
import ObjetsDeLaSacoche from './pages/ObjetsDeLaSacoche'
import PageDeLaSacoche from './pages/PageDeLaSacoche'
import PasseportDeLaSacoche from './pages/PasseportDeLaSacoche'
import PortefeuilleDeLaSacoche from './pages/PortefeuilleDeLaSacoche'
import Rabat from './pages/Rabat'
import SousLaTete from './pages/SousLaTete'
import TableauDesDeparts from './pages/TableauDesDeparts'
import Tete from './pages/Tete'
import TitreDeLaLigne from './pages/TitreDeLaLigne'
import TrainDuSoir from './pages/TrainDuSoir'
import Voie from './pages/Voie'
import VoieFermee from './pages/VoieFermee'
import VoitureComplete from './pages/VoitureComplete'
import PorteDuWagon from './pages/PorteDuWagon'
import WagonRestaurant from './pages/WagonRestaurant'

/** Le teck des panneaux : le fond de toute page du monde (maquette : `.ecr`, `--bois`). */
const TECK = '#2b1d13'

const JETONS: Readonly<Record<JetonDePage, string>> = {
  '--m-fond': '#15110d',
  '--m-tel': TECK,
  '--m-papier': '#eee4cf',
  '--m-papier2': '#ddd3bb',
  '--m-carton': '#dcc79c',
  '--m-encre': '#221910',
  '--m-encre2': '#3e3a35',
  '--m-or': '#c9a257',
  '--m-or2': '#e9cf8a',
  '--m-rouge': '#a8352a',
  // Le cuir de la courroie : ce que 1890 donnait au velours (rubans, ombres des titres).
  '--m-velours': '#4a2812',
  '--m-doux': 'rgba(238, 228, 207, 0.76)',
  '--m-pale': 'rgba(238, 228, 207, 0.52)',
  '--m-filet': 'rgba(201, 162, 87, 0.28)',
  '--m-ombre': 'rgba(0, 0, 0, 0.5)',
  '--m-grain': 'rgba(34, 25, 16, 0.08)',
  '--m-or3': '#a8853f',
  '--m-bois': '#6e5222',
  '--m-email': '#1d3767',
  '--m-violet': '#5d3f8c',
  '--m-vert': VERT,
  '--m-f-titre': "'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif",
  '--m-f-affiche': "'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif",
  '--m-f-texte': "'Spectral', 'Iowan Old Style', Georgia, serif",
  '--m-f-capitales': "'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif",
  '--m-f-corps': "'Manrope', system-ui, sans-serif",
  '--m-f-pochoir': "'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif",
  '--m-f-presse': "'Courier Prime', 'Courier New', ui-monospace, monospace",
}

/** Une toile sans dessin : le teck de la page, jusqu'au brief qui compose sa section. */
const unie = (v: { ctx: CanvasRenderingContext2D; W: number; H: number }): void => {
  v.ctx.fillStyle = TECK
  v.ctx.fillRect(0, 0, v.W, v.H)
}

/**
 * Les pages des années 1900 (maquette « Voyage immobile 1900 », écrans 1 à 17) : les jetons sont son
 * `:root`, les mots ceux de ses écrans. Un mot que la maquette ne donne pas est celui du monde « à
 * venir » (`docs/cerveau/pages-1900.md` les nomme). Les sections que le monde compose lui-même sont
 * dans `gabarits` ; les autres gardent le composant par défaut, à ces jetons et à ces mots.
 */
export const PAGES_1900: HabillagePages = {
  jetons: JETONS,
  mots: {
    annonce: { enCours: 'Gare ouverte', bouclee: 'Ligne bouclée', fermee: 'Plaque à développer', attente: 'Voie fermée' },
    boniment: 'Guide du voyageur',
    lireOuverture: 'Lire l’ouverture',
    echos: 'Les faits de l’année',
    programme: { sur: 'L’indicateur', titre: 'Arrivées' },
    parade: { titre: 'Les trois classes', sous: 'ton podium' },
    seance: { titre: 'Ce soir', sous: 'en gare' },
    nouvelleSalle: 'Le chroniqueur propose des pistes ; une phrase suffit.',
    jury: 'Le jury',
    introuvable: 'introuvable',
    fermee: { pancarte: 'Une plaque de verre', dejaVus: 'Déjà vus', enAvance: 'en avance' },
    intertitre: 'Quatre toiles défilent derrière la vitre d’un train qui ne bouge pas.',
    feuille: { tete: 'Guide du voyageur', titre: 'Le Guide', sous: 'du chroniqueur', pied: 'Le chroniqueur', imprimeur: 'Le Voyage' },
    billet: { tete: 'Le composteur', titre: 'Séance du', valider: 'Composter le billet', validerSous: 'il part au casier', tampon: 'VU', tamponAutour: 'Le voyage immobile · vu le', ouvrir: 'Composter une séance', ouvrirSous: 'ouvre le composteur' },
    decennie: { annonce: 'La ligne des années', toucher: null, passeport: 'Passeport du Voyage', palissade: { titre: 'Les affiches', sous: 'par année' }, registre: 'L’indicateur de la ligne', prochainement: 'Plaque à développer' },
    boite: { sur: 'Collection', titre: 'Le casier du contrôleur', etiquette: 'LE VOYAGE IMMOBILE · BILLETS', tous: 'Tous', vide: 'Aucun billet pour cette année.', ranger: 'Ranger au casier' },
    recherche: { champ: 'Quel film ?', catalogue: 'Le guichet', affiche: 'À voir en priorité', vide: 'Aucun départ pour ce nom. Essayez un réalisateur.', ouvrir: 'Ouvrir la fiche', partout: 'Chercher hors du Voyage' },
    manivelle: { tirer: 'Tire la courroie', relacher: 'Relâche la courroie', charge: 'L’indicateur se met à jour…', fait: 'L’indicateur est à jour.', bouton: 'Tirer la courroie pour mettre l’indicateur à jour' },
  },
  // La tête de la gare porte l'année, titre de la page : le fronton et le corps fermé ne la répètent pas.
  // Le compteur des arrivées tient la place de la corde, le guide celle du boniment, l'indicateur
  // celle du programme, la courroie celle de la manivelle dessinée ; les salles sont des voies de
  // correspondance, et une salle ouverte, une voiture. La gare range ses sections : l'indicateur
  // passe au-dessus du guide. Le podium est une voiture à trois portières, la séance un train du soir.
  // La fiche d'un film se regarde du fond d'un Hale's Tours : la fausse voiture tient la place de la
  // projection, la notice et le guichet sont ceux de l'écran 5. Le billet de séance est un carton
  // Edmondson sous son composteur (écrans 6 et 7). La boîte à billets est le casier du contrôleur, une
  // case par année, d'où sort une liasse de cartons (écran 8). La page d'une décennie est la ligne :
  // l'affiche à la place du monument, l'indicateur de la ligne à celle du registre, le passeport en
  // page à tampons de frontière, sans palissade (écrans 1 et 9). Le guichet est une grille de laiton,
  // sa réponse un tableau des départs (écran 11). La sacoche est de cuir, à fermoir de laiton : ses
  // pages de passeport en papier, ses tickets en carton, ses coulisses dans un casier (écran 15), et deux
  // clés sans défaut : la malle aux étiquettes (sa ligne de cuir, et la malle ouverte par-dessus,
  // écran 18) et les objets trouvés (dix places de consigne, `objets.ts` en porte le catalogue).
  // Les fêtes se jouent dans le train : la voiture complète, l'étiquette de malle, la ligne bouclée
  // et son « Bon pour » en carton (écran 13).
  gabarits: {
    teteDAnnee: Tete,
    fronton: SousLaTete,
    anneeFermee: VoieFermee,
    corde: Compteur,
    boniment: Guide,
    programme: Indicateur,
    tirette: Courroie,
    salles: Correspondances,
    salle: Voie,
    ordreDAnnee: Gare,
    horaireDeLAnnee: HoraireDeLaGare,
    parade: Classes,
    seance: TrainDuSoir,
    projection: Hale,
    noticeDuFilm: NoticeDuFilm,
    guichetDuFilm: GuichetDuFilm,
    billetDeSeance: Composteur,
    casier: CasierDuControleur,
    billetEnGrand: BilletDuCasier,
    monument: Affiche,
    frontonDeDecennie: TitreDeLaLigne,
    livret: Frontiere,
    registre: IndicateurDeLaLigne,
    liensDeDecennie: LiensDeLaLigne,
    ordreDeDecennie: LigneDesAnnees,
    teteDuGuichet: Grille,
    catalogueDuGuichet: TableauDesDeparts,
    teteDeLaSacoche: Rabat,
    passeportDeLaSacoche: PasseportDeLaSacoche,
    pageDuPasseport: PageDeLaSacoche,
    portefeuille: PortefeuilleDeLaSacoche,
    coulisses: CoulissesDeLaSacoche,
    malleDeLaSacoche: MalleDeLaSacoche,
    courrierDeLaSacoche: CourrierDeLaSacoche,
    objetsDeLaSacoche: ObjetsDeLaSacoche,
    feteDeLaSalle: VoitureComplete,
    feteDeLaRecompense: EtiquetteDeMalle,
    feteDuBadge: BadgeColleSurLaMalle,
    feteDeLAnnee: LigneBouclee,
    controleurDeLaCarte: ControleurDeLaCarte,
    halteDeLaCarte: HalteDeLaCarte,
    wagonRestaurant: WagonRestaurant,
    porteDuWagon: PorteDuWagon,
  },
  // `guichet` : ce qui tient au-dessus de la tablette (le retour, le fronton, la grille), la place que la
  // page ajoute en bas pour que la tablette monte au-dessus du clavier.
  hauteurs: { bandeau: 230, scene: 240, estrade: 150, monument: 240, guichet: 230 },
  // La tête de la fiche d'année est un gabarit : cette toile ne se peint plus sur sa page.
  dessinerBandeau: unie,
  // La projection de la fiche d'un film aussi (`Hale`).
  dessinerScene: unie,
  // L'estrade du chroniqueur, que la maquette ne dessine pas : un fond uni (plan des pages 1900, décision 9).
  dessinerEstrade: unie,
  // Le monument de la décennie est un gabarit (`Affiche`) : cette toile ne se peint plus sur sa page.
  dessinerMonument: unie,
  // La tête du guichet aussi (`Grille`).
  dessinerGuichet: unie,
}
