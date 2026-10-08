import { A_L_HEURE, jourDArrivee, jourDeLEcheance } from '../../../voyage/horaire'

/**
 * Les mots de l'horaire d'une gare (maquette « Voyage immobile 1900 », écrans 2 et 14 : `.horaire-prop`,
 * `.chaix .tenu`, `.plaque em`). La maquette écrit « avant dimanche » en dur : ici le jour se lit dans
 * l'échéance servie (`jourDeLEcheance`), et rien ne se calcule. « Manqué » n'y a ni mot ni dessin :
 * une ligne, « rien ne se perd » (décision 7 du propriétaire).
 */
export const MOTS_DE_L_HORAIRE = {
  rubrique: 'L’horaire',
  facultatif: 'facultatif',
  tenir: 'Tenir l’horaire',
  sans: 'Sans horaire',
  /** Sur la plaque de la tête, sous l'année : le mot de la plaque de la carte (`horaireDePlaque`). */
  aLHeure: A_L_HEURE,
  /** En tête de l'indicateur. */
  tenu: 'Horaire tenu',
  manque: 'Horaire manqué',
} as const

/** « Proposé en gare de 1904 », « Accepté en gare de 1904 » : la petite ligne rouge de l'affichette. */
export const enGareDe = (annee: number, accepte: boolean): string => `${accepte ? 'Accepté' : 'Proposé'} en gare de ${annee}`

/** « Arriver avant dimanche 11 octobre 2026 » : le titre de l'affichette, sur l'échéance servie. */
export const arriverAvant = (echeance: string): string => `Arriver avant ${jourDeLEcheance(echeance)}`

/** Ce que l'horaire fait gagner, et ce qu'il ne coûte pas (maquette, écran 14). */
export const promesseDeLHoraire = (annee: number): string =>
  `Tenu, la plaque de ${annee} reçoit un filet doré et la mention « ${MOTS_DE_L_HORAIRE.aLHeure} » ; manqué, rien ne se perd.`

/**
 * Ce que mon geste vient de faire, pour la région d'état. La maquette ajoute « la plaque de 1904 le dit
 * sur la carte » : écrite avant que la carte le dise, la phrase ne le promet pas ; la plaque le dit
 * depuis le brief 11 (`gares.ts` › `horaireSurLaPlaque`), qui n'a pas demandé de la rallonger.
 */
export function ceQueLeGesteAFait(vient: 'accepte' | 'retire' | null, annee: number, echeance: string | null): string {
  if (vient === 'accepte' && echeance !== null) return `Horaire accepté : arriver avant ${jourDeLEcheance(echeance)}.`
  if (vient === 'retire') return `Sans horaire : la gare de ${annee} se boucle quand tu veux, rien ne se perd.`
  return ''
}

/** La ligne de l'indicateur d'une gare arrivée à l'heure : l'échéance, puis le jour de l'arrivée s'il est connu. */
export function phraseDeLHoraireTenu(echeance: string, arriveeLe: string | null): string {
  const avant = `Avant ${jourDeLEcheance(echeance)}`
  return arriveeLe === null ? `${avant}.` : `${avant} : arrivé le ${jourDArrivee(arriveeLe)}.`
}

/** La seule ligne d'un horaire manqué. */
export const phraseDeLHoraireManque = (echeance: string): string => `Il fallait arriver avant ${jourDeLEcheance(echeance)}. Rien ne se perd.`

/** Ce que la région d'état dit quand l'horaire vient d'être manqué sous mes yeux (un refus, puis la fiche relue). */
export const horaireManqueDit = (echeance: string): string => `${MOTS_DE_L_HORAIRE.manque}. ${phraseDeLHoraireManque(echeance)}`
