import type { Arrivee, Avancee } from '../../../voyage/annee'

/**
 * Les mots et les règles de l'indicateur d'une gare (maquette « Voyage immobile 1900 », écrans 2 et
 * 14), sans rendu. Ses lignes sont les arrivées que la fiche compte (`arriveesDeLAnnee`, décision 2
 * du plan des pages 1900) : la maquette y écrit des titres de films et des heures que rien ne calcule,
 * et qui ne sont pas repris. La première colonne porte donc la récompense, pas une heure.
 */

const NOMS: Record<Arrivee['cle'], string> = { films: 'Ours', essentiels: 'Lion', salles: 'Palme', ticket: 'Ticket' }

export interface LigneDIndicateur {
  /** Ce que la ligne fait gagner : l'Ours, le Lion, la Palme, le ticket. */
  nom: string
  libelle: string
  /** Ce qui fera arriver un ticket attendu, ou une Palme dont les salles sont déjà complètes ; nul ailleurs. */
  note: string | null
  /** « arrivé » ou « attendu », avec son compte quand il y en a un. */
  etat: string
}

/**
 * Les lignes qu'une année montre. Une année bouclée sans ticket est derrière soi (`estBouclee`),
 * ouverte par le rattrapage du Voyage suivi : son ticket n'a plus rien à ouvrir et ne se promet pas,
 * jumeau de `ligneDuBas` (`voyage/annee.ts`). L'indicateur ne rend pas la ligne, le compteur ne la
 * compte pas.
 */
export const lignesDeLAnnee = (arrivees: readonly Arrivee[], bouclee: boolean): Arrivee[] => arrivees.filter((a) => !(bouclee && a.cle === 'ticket' && !a.arrivee))

/**
 * Une ligne de l'indicateur. Une année sans essentiel le dit, sans compte : jamais « 0 sur 0 ». Le
 * Lion arrivé ne redit pas son compte, que les introuvables faussent ; l'Ours arrivé par une
 * récompense plus haute, sous son palier, non plus. Des salles complètes sans le Lion ne font pas la
 * Palme : la ligne dit ce qui lui manque. Le jury ne se promet qu'au compte IA.
 */
export function ligneDeLIndicateur(a: Arrivee, annee: number, ia: boolean): LigneDIndicateur {
  const nom = NOMS[a.cle]
  const mot = a.arrivee ? 'arrivé' : 'attendu'
  const compte = a.valeur === null || a.total === null ? mot : a.arrivee ? `arrivé · ${a.valeur}` : `attendu · ${a.valeur} sur ${a.total}`
  const sousLePalier = a.valeur !== null && a.total !== null && a.valeur < a.total
  if (a.cle === 'films') return { nom, libelle: `${a.total} films de ${annee}`, note: null, etat: a.arrivee && sousLePalier ? mot : compte }
  if (a.cle === 'essentiels') return a.total === null ? { nom, libelle: 'Aucun essentiel encore', note: null, etat: mot } : { nom, libelle: 'Tous les essentiels', note: null, etat: a.arrivee ? mot : compte }
  if (a.cle === 'salles') return { nom, libelle: `${a.total} salles complètes`, note: a.arrivee || sousLePalier ? null : 'avec le Lion', etat: compte }
  return { nom, libelle: `Le ticket pour ${annee + 1}`, note: a.arrivee ? null : ia ? 'au Lion, ou plus tôt si le jury le décide' : 'au Lion', etat: mot }
}

/**
 * Le gain qui pointe une ligne au retour d'un billet. Il ne vaut que pour la valeur qu'il annonce :
 * relue plus tard, la fiche l'a dépassé (la même garde que la corde par défaut).
 */
export const gainDe = (a: Arrivee, gains: readonly Avancee[]): Avancee | undefined => gains.find((g) => g.cle === a.cle && g.apres === a.valeur)

/** Les lignes que ce retour vient de faire arriver : celles dont le gain a franchi le palier. */
export const venuesDArriver = (arrivees: readonly Arrivee[], gains: readonly Avancee[]): Arrivee[] =>
  arrivees.filter((a) => {
    const g = gainDe(a, gains)
    return !!g && a.arrivee && a.total !== null && g.avant < a.total && g.apres >= a.total
  })

/** Ce que le compteur dit sous la tête : combien d'arrivées, sur combien de lignes montrées, et si la ligne est bouclée. */
export function phraseDuCompteur(arrivees: readonly Arrivee[], bouclee: boolean): string {
  const n = arrivees.filter((a) => a.arrivee).length
  return `${n > 1 ? 'arrivées' : 'arrivée'} sur ${lignesDeLAnnee(arrivees, bouclee).length}${bouclee ? ' : la ligne est bouclée.' : '.'}`
}
