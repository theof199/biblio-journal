import type { DateVraie } from '../types'
import { ARRETS } from './trace'

/**
 * Les dépêches épinglées aux quais (fiche de données, « Les dépêches » ; maquette : `DATES`,
 * l. 2724-2728, le jour de 1902 corrigé par la fiche). `dx` et `bas` disent où la dépêche tient
 * dans sa gare : en pixels du milieu, et en pourcentage de la hauteur de l'écran depuis le bas.
 */
const DEPECHES = [
  { an: 1900, dx: -44, bas: 53, court: '14 avril', lieu: 'Paris', titre: 'L’Exposition ouvre', jour: 'Samedi 14 avril 1900',
    texte: 'L’Exposition universelle ouvre ses portes. Au Trocadéro, le Panorama transsibérien fait voyager des spectateurs assis dans de vraies voitures.' },
  { an: 1902, dx: -128, bas: 47, court: 'sept. 1902', lieu: 'Paris · théâtre Robert-Houdin', titre: 'Le Voyage dans la Lune', jour: 'Septembre 1902',
    texte: 'Georges Méliès présente Le Voyage dans la Lune, tourné dans son studio de verre de Montreuil.' },
  { an: 1903, dx: 110, bas: 47, court: 'déc. 1903', lieu: 'New York · Edison', titre: 'The Great Train Robbery', jour: 'Décembre 1903',
    texte: 'Edwin S. Porter sort The Great Train Robbery : un train arrêté dans le New Jersey, et un bandit qui tire vers la salle.' },
] as const

/** Où chaque dépêche tient dans sa gare, au rang de `DATES`. */
export const PLACES_DES_DEPECHES: ReadonlyArray<{ dx: number; bas: number }> = DEPECHES.map(({ dx, bas }) => ({ dx, bas }))

/**
 * Les dates vraies du monde. La section est collante : `x` est le milieu de l'écran plus `dx`, en
 * repère 390, et `y` l'arrêt de la gare où la dépêche se lit.
 */
export const DATES: readonly DateVraie[] = DEPECHES.map(({ an, dx, court, lieu, titre, jour, texte }) => ({
  an, x: 195 + dx, y: ARRETS[an - 1900]!, court, lieu, titre, jour, texte, image: null,
}))
