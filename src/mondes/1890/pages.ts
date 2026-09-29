import type { HabillagePages } from '../types'
import { dessinerBandeau } from './bandeau'
import { dessinerScene } from './scene'
import { dessinerEstrade } from './estrade'

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
    '--m-f-titre': "'Fraunces', Georgia, serif",
    '--m-f-affiche': "'Limelight', Didot, Georgia, serif",
    '--m-f-texte': "'IM Fell English', 'Iowan Old Style', Georgia, serif",
    '--m-f-capitales': "'IM Fell English SC', Georgia, serif",
    '--m-f-corps': "'Manrope', system-ui, sans-serif",
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
    billet: { tete: 'Cinématographe · billet de séance', titre: 'Séance du', valider: 'Composter le billet', validerSous: 'et revenir à l’année' },
  },
  hauteurs: { bandeau: 250, scene: 300, estrade: 190 },
  // Portés de la maquette : `dessinBandeau`, `dessinTheatre`, `dessinEstrade`.
  dessinerBandeau,
  dessinerScene,
  dessinerEstrade,
}
