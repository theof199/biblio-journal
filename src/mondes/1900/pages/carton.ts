import { auTempo } from '../../../voyage/tempo'

/**
 * Les mots et les règles du composteur et du carton Edmondson, le billet de séance des années 1900
 * (maquette « Voyage immobile 1900 », écrans 6 et 7), sans rendu. La mention de classe de la maquette
 * (« 1ʳᵉ cl. ») n'est pas reprise (plan des pages 1900, décision 6), ni le poinçon doré du
 * contrôleur, qui attend son lot. Les mots du bouton et du tampon sont ceux du monde (`mots.billet`).
 */
export const MOTS_DU_COMPOSTEUR = {
  compagnie: 'Ch. de fer du Voyage',
  tonBillet: 'Ton billet',
  tonBilletSous: 'numéroté dans la décennie',
  date: 'La date',
  dateSous: 'pressée sur la tranche',
  aujourdhui: 'Aujourd’hui',
  hier: 'Hier',
  note: 'La note',
  noteSous: 'un trou par point',
  sansNote: 'sans note',
  reactions: 'Réactions',
  reactionsSous: 'douze coupons au plus',
  remarque: 'Remarque',
  remarqueSous: 'le carnet : toi seul le lis',
  remarqueVide: 'Ce que tu en retiens, pour toi…',
  /** Ce que le poinçon doré dit à qui ne le voit pas : le carton ne le porte que si on le lui passe. */
  poincon: 'Poinçon doré du contrôleur',
  corriger: 'Corriger le billet',
  corrigerSous: 'il garde son numéro',
  modele: 'Le modèle',
  modeleSous: 'billets du Métropolitain, 1900',
  modeleDit: 'Fac-similés des trois billets du Métropolitain, 1900 : première classe, deuxième classe, aller et retour',
  legende: 'Revue générale des chemins de fer, 1901 : les trois billets du Métropolitain parisien.',
  format: 'Un carton de 57 sur 31 millimètres, le format de Thomas Edmondson. Le numéro est le rang du visionnage dans la décennie.',
} as const

/** Les mois du dateur à presse, en deux lettres (maquette : « 30 SE 26 », « 19 JA 26 », « 08 MR 26 »). */
const MOIS_DE_LA_PRESSE = ['JA', 'FE', 'MR', 'AV', 'MA', 'JN', 'JL', 'AO', 'SE', 'OC', 'NO', 'DE'] as const

/** Les trois molettes de la presse à dater : le jour, le mois en deux lettres, l'année sur deux chiffres. */
export function molettesDeLaPresse(iso: string): readonly [string, string, string] {
  const [a, m, j] = iso.split('-')
  return [j!, MOIS_DE_LA_PRESSE[Number(m) - 1]!, a!.slice(2)]
}

/** La date pressée sur la tranche du carton, d'un jour du calendrier (`AAAA-MM-JJ`) : « 30 SE 26 ». */
export const datePressee = (iso: string): string => molettesDeLaPresse(iso).join(' ')

/** Les trous d'un carton : dix places, toujours. */
export const PLACES = 10

/** Les dix places du carton, percées de la première à la note : un trou par point, aucun sans note. */
export const trousDuCarton = (note: number | null): boolean[] => Array.from({ length: PLACES }, (_, i) => note !== null && i < note)

/** La note au pied du carton : « 8 / 10 », ou « sans note ». */
export const noteDuCarton = (note: number | null): string => (note !== null ? `${note} / ${PLACES}` : MOTS_DU_COMPOSTEUR.sansNote)

/** La ligne du film sur le carton (maquette : « Edwin S. Porter · gare de 1903 ») ; sans réalisateur, la gare seule. */
export const ligneDuFilm = (realisateur: string | null, annee: number): string => [realisateur?.trim() || null, `gare de ${annee}`].filter(Boolean).join(' · ')

/** « 1 coupon détaché », « 3 coupons détachés », « aucun coupon ». */
export const compteDesCoupons = (n: number): string => (n === 0 ? 'aucun coupon' : `${n} coupon${n > 1 ? 's' : ''} détaché${n > 1 ? 's' : ''}`)

/** L'écart entre deux trous que la pince perce d'un même geste, en millisecondes, au tempo. */
export const ENTRE_DEUX_TROUS = auTempo(55)
