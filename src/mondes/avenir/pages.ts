import type { HabillagePages } from '../types'

/**
 * Les pages d'une année « à venir » : l'identité « papier et pellicule » du Voyage
 * (`src/ui/voyage.css`, `biblio-android/docs/design.md`), sans décor. Les toiles se posent d'un
 * fond uni : rien ne s'y dessine avant le chantier du monde.
 */
export const PAGES_A_VENIR: HabillagePages = {
  jetons: {
    '--m-fond': '#151009',
    '--m-tel': '#1d1710',
    '--m-papier': '#f2e8d5',
    '--m-papier2': '#e4d8c2',
    '--m-carton': '#cfc3ae',
    '--m-encre': '#1a1510',
    '--m-encre2': '#3d342a',
    '--m-or': '#e6b94a',
    '--m-or2': '#f0d48a',
    '--m-rouge': '#9a4a36',
    '--m-velours': '#4a2a22',
    '--m-doux': 'rgba(242, 232, 213, 0.76)',
    '--m-pale': 'rgba(242, 232, 213, 0.52)',
    '--m-filet': 'rgba(230, 185, 74, 0.28)',
    '--m-ombre': 'rgba(0, 0, 0, 0.45)',
    '--m-grain': 'rgba(61, 52, 42, 0.08)',
    '--m-f-titre': "'Fraunces', Georgia, serif",
    '--m-f-affiche': "'Limelight', Georgia, serif",
    '--m-f-texte': "'Fraunces', Georgia, serif",
    '--m-f-capitales': "'Manrope', system-ui, sans-serif",
    '--m-f-corps': "'Manrope', system-ui, sans-serif",
  },
  mots: {
    annonce: { enCours: 'L’année en cours', bouclee: 'Une année bouclée', fermee: 'Prochainement', attente: 'Bientôt ouverte' },
    boniment: 'L’ouverture',
    lireOuverture: 'Lire l’ouverture',
    echos: 'Les faits de l’année',
    programme: { sur: 'Pour avancer', titre: 'Prochain pas' },
    parade: { titre: 'Le podium', sous: 'tes trois films' },
    seance: { titre: 'Ce soir', sous: 'la séance' },
    nouvelleSalle: 'Le chroniqueur propose des pistes ; une phrase suffit.',
    jury: 'Le jury',
    introuvable: 'introuvable',
    fermee: { pancarte: 'Fermée jusqu’au ticket', dejaVus: 'Déjà vus', enAvance: 'en avance' },
    intertitre: 'Un monde à venir.',
    feuille: { tete: 'La feuille', titre: 'Le chroniqueur', sous: 'écrit pour toi', pied: 'Le chroniqueur', imprimeur: 'Le Voyage' },
    billet: { tete: 'Le visionnage', titre: 'Vu le', valider: 'Je l’ai vu', validerSous: 'enregistrer' },
  },
  hauteurs: { bandeau: 200, scene: 240, estrade: 150 },
  dessinerBandeau: (v) => {
    v.ctx.fillStyle = '#151009'
    v.ctx.fillRect(0, 0, v.W, v.H)
  },
  dessinerScene: (v) => {
    v.ctx.fillStyle = '#151009'
    v.ctx.fillRect(0, 0, v.W, v.H)
  },
  dessinerEstrade: (v) => {
    v.ctx.fillStyle = '#151009'
    v.ctx.fillRect(0, 0, v.W, v.H)
  },
}
