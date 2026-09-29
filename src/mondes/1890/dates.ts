import type { DateVraie } from '../types'

/**
 * Les dates vraies de la maquette du 29 septembre 2026 (`DATES`), recopiées telles quelles (les
 * jours de la semaine recalculés le 29 septembre). Chacune n'apparaît qu'à son année ouverte et
 * s'ouvre en petite affiche. Coordonnées de la section 1890.
 */
export const DATES: readonly DateVraie[] = [
  { an: 1895, x: 38, y: 112, court: '22 mars', lieu: 'Paris · rue de Rennes', titre: 'La première projection', jour: 'Vendredi 22 mars 1895',
    texte: 'Devant la Société d’encouragement pour l’industrie nationale, Louis Lumière projette La Sortie de l’usine Lumière à Lyon.',
    image: null },
  { an: 1895, x: 180, y: 116, court: '1er nov.', lieu: 'Berlin · Wintergarten', titre: 'Le Bioscop', jour: 'Vendredi 1er novembre 1895',
    texte: 'Max et Emil Skladanowsky présentent leur Bioscop au théâtre du Wintergarten : un quart d’heure de vues au milieu d’un programme de variétés.',
    image: null },
  { an: 1895, x: 38, y: 222, court: '28 déc.', lieu: 'Paris · boulevard des Capucines', titre: 'Le Grand Café', jour: 'Samedi 28 décembre 1895',
    texte: 'Au Salon indien du Grand Café, première séance publique et payante du Cinématographe Lumière. Entrée : un franc.',
    image: null },
  { an: 1896, x: 184, y: 304, court: '1896', lieu: 'Paris · place de l’Opéra', titre: 'Le trucage par substitution', jour: 'Au cours de 1896',
    texte: 'Selon le récit de Méliès, sa caméra s’enraye place de l’Opéra ; à la reprise, un omnibus est devenu corbillard. L’arrêt de caméra entre dans ses films.',
    image: null },
  { an: 1896, x: 352, y: 322, court: '23 avril', lieu: 'New York · Koster & Bial’s', titre: 'Le Vitascope', jour: 'Jeudi 23 avril 1896',
    texte: 'Première projection publique du Vitascope, présenté comme une invention d’Edison, au music-hall Koster & Bial’s.',
    image: null },
  { an: 1897, x: 38, y: 505, court: '1897', lieu: 'Montreuil-sous-Bois', titre: 'Le studio de verre', jour: 'Bâti de septembre 1896 à mars 1897',
    texte: 'Méliès fait construire dans sa propriété un atelier vitré, tourné vers la lumière : l’un des tout premiers studios bâtis pour le cinéma.',
    image: null },
  { an: 1897, x: 206, y: 456, court: '4 mai', lieu: 'Paris · rue Jean-Goujon', titre: 'Le Bazar de la Charité', jour: 'Mardi 4 mai 1897',
    texte: 'Pendant une séance de cinématographe, le feu prend près de la lampe du projecteur ; l’incendie du Bazar de la Charité fait plus de cent victimes.',
    image: null },
]
