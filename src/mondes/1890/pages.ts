import type { HabillagePages } from '../types'
import { dessinerBandeau } from './bandeau'
import { dessinerScene } from './scene'
import { dessinerEstrade } from './estrade'
import { dessinerMonument } from './monument'
import { dessinerGuichet } from './guichetPage'

/**
 * Les pages des années 1890 : l'affiche de la baraque, la projection, le billet, le prospectus du
 * chroniqueur (maquette des écrans 1890, écrans I, II, III, V, VI, VIII). Les jetons sont le
 * `:root` de la maquette (lignes 4 à 12 de l'empreinte `50d01cc1…`), les mots ses textes.
 */
export const PAGES_1890: HabillagePages = {
  jetons: {
    '--m-fond': '#140e09',
    '--m-tel': '#1d150d',
    '--m-papier': '#e8d8bf',
    '--m-papier2': '#decaac',
    '--m-carton': '#cdb892',
    '--m-encre': '#1c140c',
    '--m-encre2': '#452f1d',
    '--m-or': '#c9a15f',
    '--m-or2': '#e3c78a',
    '--m-rouge': '#794229',
    '--m-velours': '#602e1e',
    '--m-doux': 'rgba(232, 216, 191, 0.76)',
    '--m-pale': 'rgba(232, 216, 191, 0.52)',
    '--m-filet': 'rgba(201, 161, 95, 0.28)',
    '--m-ombre': 'rgba(0, 0, 0, 0.5)',
    '--m-grain': 'rgba(90, 62, 36, 0.1)',
    '--m-or3': '#b8904f',
    '--m-bois': '#6b4a2a',
    // Hors de la maquette 1890, qui n'a ni plaque d'émail ni encre de tampon à part : son velours et
    // son rouge. Aucune feuille ne les lit encore (plan des pages 1900, brief 0).
    '--m-email': '#602e1e',
    '--m-violet': '#794229',
    '--m-f-titre': "'Fraunces', Georgia, serif",
    '--m-f-affiche': "'Limelight', Didot, Georgia, serif",
    '--m-f-texte': "'IM Fell English', 'Iowan Old Style', Georgia, serif",
    '--m-f-capitales': "'IM Fell English SC', Georgia, serif",
    '--m-f-corps': "'Manrope', system-ui, sans-serif",
    '--m-f-pochoir': "'Stardos Stencil', Georgia, serif",
    '--m-f-presse': "'IM Fell English SC', Georgia, serif",
  },
  mots: {
    annonce: { enCours: 'Grande attraction', bouclee: 'Soirée de gala', fermee: 'Prochainement', attente: 'En montage' },
    boniment: 'Boniment d’ouverture',
    lireOuverture: 'Lire l’ouverture',
    echos: 'Échos de l’année',
    programme: { sur: 'Au programme ce soir', titre: 'Prochain pas' },
    parade: { titre: 'La parade', sous: 'le podium' },
    seance: { titre: 'Ce soir', sous: 'à la baraque' },
    nouvelleSalle: 'Le chroniqueur propose des pistes ; une phrase suffit.',
    jury: 'Le jury',
    introuvable: 'perdu',
    fermee: { pancarte: 'Fermé jusqu’au ticket', dejaVus: 'Déjà vus', enAvance: 'en avance' },
    intertitre: 'La manivelle, les forains, le train qui fonce sur la salle.',
    feuille: { tete: 'Aujourd’hui · entrée libre', titre: 'Le Boniment', sous: 'du chroniqueur', pied: 'Le chroniqueur', imprimeur: 'Imprimerie du Voyage · composé à la main' },
    billet: { tete: 'Cinématographe · billet de séance', titre: 'Séance du', valider: 'Tamponner « Vu »', validerSous: 'et ranger le billet', tampon: 'VU', tamponAutour: 'Cinématographe · séance du', ouvrir: 'Je l’ai vu', ouvrirSous: 'poinçonner mon billet' },
    decennie: { annonce: 'Le manège des années', toucher: 'touchez un cheval pour ouvrir son année', passeport: 'Passeport', palissade: { titre: 'La palissade', sous: 'affiches par année' }, registre: 'Registre des recettes', prochainement: 'Prochainement' },
    boite: { sur: 'Collection', titre: 'La boîte à billets', etiquette: 'CINÉMATOGRAPHE · BILLETS', tous: 'Tous', vide: 'Aucun billet pour cette année.', ranger: 'Ranger le billet' },
    recherche: { champ: 'Quel film cherchez-vous ?', catalogue: 'Catalogue des vues', affiche: 'Les plus demandées au guichet', vide: 'Aucune vue à ce nom au catalogue.', ouvrir: 'Ouvrir la fiche', partout: 'Chercher hors du Voyage' },
    manivelle: { tirer: 'Tirez pour recharger la bobine', relacher: 'Relâchez : la bobine se recharge', charge: 'La bobine se recharge…', fait: 'La bobine est rechargée, le Voyage est à jour.', bouton: 'Recharger la bobine' },
  },
  gabarits: {},
  hauteurs: { bandeau: 250, scene: 300, estrade: 190, monument: 330, guichet: 170 },
  // Portés de la maquette : `dessinBandeau`, `dessinTheatre`, `dessinEstrade`.
  dessinerBandeau,
  dessinerScene,
  dessinerEstrade,
  // Portés de la maquette : `dessinManege`, `dessinGuichet`.
  dessinerMonument,
  dessinerGuichet,
}
