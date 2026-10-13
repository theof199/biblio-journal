import type { Vue } from './vues'

/** Le titre de chaque vue, tel que le bandeau et un retour le disent. */
export const NOMS: Record<Vue['nom'], string> = {
  telecommande: 'Télécommande',
  'en-cours': 'En cours',
  ajouter: 'Ajouter une série',
  'a-deux': 'Vu à deux',
  fiche: 'Fiche',
}

/** La vue où ramène le retour d'une vue ouverte par son adresse : la fiche vient de la liste, le reste de la télécommande. */
export const PARENTES: Record<Exclude<Vue['nom'], 'telecommande'>, Vue> = {
  'en-cours': { nom: 'telecommande' },
  ajouter: { nom: 'telecommande' },
  'a-deux': { nom: 'telecommande' },
  fiche: { nom: 'en-cours' },
}
