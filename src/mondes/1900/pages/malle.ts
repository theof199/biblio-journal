import type { Malle, PlaceDeMalle } from '../../../api/voyage'
import { jourDeParis } from '../../../voyage/passeport'

/**
 * La malle aux étiquettes des années 1900 (maquette, écran 18 ; plan des écrans des lots, brief 1) :
 * ce qu'une place de la malle est, ce qu'elle dit, et de quoi son badge est fait ; puis ce que disent
 * la ligne de la malle dans la sacoche et la fiche d'une place (brief 2). Sans rendu ni lecture : les
 * dessins sont `BadgeDeMalle.tsx` et `MalleDeLaSacoche.tsx`.
 *
 * « Étiquette » seul est déjà pris (la récompense collée à la fête, `EtiquetteDeMalle.tsx`) : le dessin
 * d'une place de la malle s'appelle ici un **badge**.
 */

/** Les cinq formes de la maquette, et la forme neutre d'une clé que l'appli ne connaît pas. Dans une vue de 100 sur 100. */
export const FORMES = {
  rond: 'M50 3 A47 47 0 1 1 49.99 3 Z',
  ovale: 'M50 12 A48 38 0 1 1 49.99 12 Z',
  ecusson: 'M7 6 H93 V50 C93 76 72 90 50 97 C28 90 7 76 7 50 Z',
  losange: 'M50 1 L99 50 L50 99 L1 50 Z',
  pans: 'M16 12 H84 L97 25 V75 L84 88 H16 L3 75 V25 Z',
  neutre: 'M13 14 H87 A7 7 0 0 1 94 21 V79 A7 7 0 0 1 87 86 H13 A7 7 0 0 1 6 79 V21 A7 7 0 0 1 13 14 Z',
} as const
export type FormeDeBadge = keyof typeof FORMES

export const DESSINS_DE_BADGE = ['kepi', 'camera', 'pochoir', 'tete', 'portevoix', 'clandestin', 'aiguillage', 'lune', 'roue', 'omnibus', 'globe', 'chou', 'masque', 'rails', 'billet'] as const
export type DessinDeBadge = (typeof DESSINS_DE_BADGE)[number]

/**
 * De quoi un badge est fait : sa forme, son papier, ses trois encres, son dessin, et son nom court,
 * en une ou deux lignes. **Ses couleurs sont sa donnée**, comme celles d'une affiche : elles ne passent
 * pas par un jeton, et aucune feuille ne les porte. Le nom entier, la devise, la règle et ce que
 * compte la progression viennent du contrat, jamais d'ici.
 */
export type Badge = {
  court: readonly string[]
  forme: FormeDeBadge
  papier: string
  encres: readonly [string, string, string]
  /** Nul pour le repli : une clé inconnue n'a pas de dessin. */
  dessin: DessinDeBadge | null
}

/**
 * Les quinze badges de la décennie, **par `cle` du contrat**, jamais par numéro : la place d'une
 * étiquette dans la malle est au serveur. Portés de la maquette (`ETIQUETTES`, l. 3758-3774).
 */
export const BADGES: Readonly<Record<string, Badge>> = {
  'chef-de-gare': { court: ['Le chef', 'de gare'], forme: 'ecusson', papier: '#efe6d0', encres: ['#1d3767', '#a8352a', '#c9a257'], dessin: 'kepi' },
  'operateur-lumiere': { court: ['L’opérateur Lumière'], forme: 'rond', papier: '#f1dfae', encres: ['#221910', '#a8352a', '#1d3767'], dessin: 'camera' },
  coloriste: { court: ['Le coloriste'], forme: 'ovale', papier: '#efe6d0', encres: ['#a8352a', '#2f6b47', '#e0a52c'], dessin: 'pochoir' },
  'tete-en-caoutchouc': { court: ['La tête', 'en caoutchouc'], forme: 'pans', papier: '#e9d9b4', encres: ['#5d3f8c', '#a8352a', '#c9a257'], dessin: 'tete' },
  bonimenteur: { court: ['Le bonimenteur'], forme: 'losange', papier: '#efe6d0', encres: ['#a8352a', '#221910', '#c9a257'], dessin: 'portevoix' },
  'passager-clandestin': { court: ['Passager', 'clandestin'], forme: 'pans', papier: '#d9cdb2', encres: ['#221910', '#5a3a1c', '#a8352a'], dessin: 'clandestin' },
  correspondance: { court: ['La correspondance'], forme: 'rond', papier: '#dfe8e2', encres: ['#2f6b47', '#a8352a', '#1d3767'], dessin: 'aiguillage' },
  'train-de-nuit': { court: ['Train de nuit'], forme: 'ovale', papier: '#1d2a4a', encres: ['#efe6d0', '#c9a257', '#f0d27a'], dessin: 'lune' },
  express: { court: ['L’Express'], forme: 'ecusson', papier: '#efe6d0', encres: ['#a8352a', '#221910', '#c9a257'], dessin: 'roue' },
  omnibus: { court: ['L’Omnibus'], forme: 'pans', papier: '#f1dfae', encres: ['#2f6b47', '#a8352a', '#221910'], dessin: 'omnibus' },
  'tour-du-monde': { court: ['Le tour du monde'], forme: 'rond', papier: '#efe6d0', encres: ['#1d3767', '#a8352a', '#c9a257'], dessin: 'globe' },
  pionniere: { court: ['La pionnière'], forme: 'ovale', papier: '#f3dcd2', encres: ['#2f6b47', '#a8352a', '#c9a257'], dessin: 'chou' },
  'hold-up': { court: ['Le hold-up'], forme: 'losange', papier: '#f1dfae', encres: ['#221910', '#a8352a', '#a8352a'], dessin: 'masque' },
  'voie-parallele': { court: ['Voie', 'parallèle'], forme: 'ecusson', papier: '#dfe8e2', encres: ['#1d3767', '#5d3f8c', '#a8352a'], dessin: 'rails' },
  'billet-de-faveur': { court: ['Billet de faveur'], forme: 'rond', papier: '#a8352a', encres: ['#efe6d0', '#f0d27a', '#f0d27a'], dessin: 'billet' },
}

/** Au-delà, le nom servi d'une clé inconnue se coupe en deux lignes, à l'espace le plus proche de son milieu. */
const LIGNE_DU_REPLI = 14

function enLignes(nom: string): string[] {
  if (nom.length <= LIGNE_DU_REPLI) return [nom]
  const milieu = nom.length / 2
  const espaces = [...nom.matchAll(/ /g)].map((m) => m.index)
  if (espaces.length === 0) return [nom]
  const coupe = espaces.reduce((mieux, i) => (Math.abs(i - milieu) < Math.abs(mieux - milieu) ? i : mieux))
  return [nom.slice(0, coupe), nom.slice(coupe + 1)]
}

/**
 * Le badge d'une clé. **Une clé que l'appli ne connaît pas garde sa place** (le serveur peut en servir
 * une de plus avant que l'appli soit livrée) : une forme neutre, sans dessin, et le nom servi.
 * `hasOwnProperty` : `constructor` est une clé possible, pas un badge.
 */
export function badgeDe(cle: string, nom: string | null): Badge {
  if (Object.prototype.hasOwnProperty.call(BADGES, cle)) return BADGES[cle]!
  return { court: enLignes(nom ?? ''), forme: 'neutre', papier: '#e6dcc4', encres: ['#3e3a35', '#6e5222', '#a8853f'], dessin: null }
}

/** L'état d'une place : son étiquette collée, sa trace de colle, ou une cachée qui ne dit rien d'elle. */
export type EtatDePlace = 'cachee' | 'collee' | 'trace'

/**
 * **Cachée non gagnée quand `cle` est nul, pas quand `cachee` est vrai** : `cachee` reste vrai une fois
 * l'étiquette gagnée, et elle se montre alors comme les autres. Collée quand `collee_le` ne l'est pas,
 * et alors seulement : `fait` au seuil sans `collee_le` reste une trace, pleine (le serveur ne colle
 * qu'après un geste, ce `GET` n'écrit rien).
 */
export function etatDeLaPlace(place: PlaceDeMalle): EtatDePlace {
  if (place.cle === null) return 'cachee'
  return place.collee_le !== null ? 'collee' : 'trace'
}

export const MOTS_DE_LA_MALLE = {
  cachee: 'Une étiquette cachée : elle ne se montre qu’une fois gagnée.',
  aGagner: 'à gagner',
  sur: 'sur',
  signeDeLaCachee: '?',
  titre: 'La malle',
  sous: 'les étiquettes de la décennie',
  etiquette: 'étiquette',
  nouvelle: 'nouvelle',
  collee: 'collée le',
  ouverte: {
    titre: 'La malle aux étiquettes',
    refermer: 'Refermer la malle',
    compagnie: 'Ch. de fer du Voyage',
    numero: 'Étiquette nº',
    trace: 'trace de colle',
    cachee: 'cachée',
    nomDeLaCachee: 'Une étiquette cachée',
    regleDeLaCachee: 'Sa règle ne se dit pas. Elle ne se montre qu’une fois gagnée ; d’ici là, cette place reste vide.',
    collee: 'Collée le',
  },
} as const

/** Le compte d'une trace de colle : « 3 sur 4 », et « à gagner » pour un seuil de un (jamais « 0 sur 1 »). */
export function compteDeLaTrace({ fait, seuil }: { fait: number; seuil: number }): string {
  return seuil === 1 ? MOTS_DE_LA_MALLE.aGagner : `${fait} ${MOTS_DE_LA_MALLE.sur} ${seuil}`
}

/**
 * Ce que dit une trace de colle : « `fait` sur `seuil` · `quoi` », avec le `quoi` du contrat. Nul pour
 * une place collée ou cachée, dont le contrat ne sert pas la progression.
 */
export function ceQueDitLaTrace(place: PlaceDeMalle): string | null {
  if (etatDeLaPlace(place) !== 'trace' || place.progression === null) return null
  const compte = compteDeLaTrace(place.progression)
  return place.quoi === null ? compte : `${compte} · ${place.quoi}`
}

/**
 * Le nom lu d'une place (maquette, l. 3854), avec ce que le contrat sert : le nom, la règle, et le jour
 * du collage dit à Paris. **Une cachée non gagnée ne dit rien d'elle** : ni nom, ni règle, ni clé, même
 * si un champ en venait.
 */
export function nomLuDeLaPlace(place: PlaceDeMalle): string {
  const etat = etatDeLaPlace(place)
  if (etat === 'cachee') return MOTS_DE_LA_MALLE.cachee
  const regle = place.regle === null ? '' : ` ${place.regle}`
  if (etat === 'collee') return `${place.nom}, étiquette collée le ${jourDeParis(place.collee_le!)}.${regle}`
  const p = place.progression
  const compte = p !== null && p.seuil > 1 ? `, ${compteDeLaTrace(p)}` : ''
  return `${place.nom}, pas encore gagnée${compte}.${regle}`
}

const pluriel = (n: number) => (n > 1 ? 's' : '')

/** « 5 étiquettes sur 15 », sur la ligne de la sacoche : **le total est celui que le serveur sert**, jamais quinze en dur. */
export const compteDeLaLigne = ({ collees, total }: Pick<Malle, 'collees' | 'total'>): string =>
  `${collees} ${MOTS_DE_LA_MALLE.etiquette}${pluriel(collees)} ${MOTS_DE_LA_MALLE.sur} ${total}`

/** « 5 sur 15 », à côté du titre de la malle ouverte. */
export const compteDeLaMalle = ({ collees, total }: Pick<Malle, 'collees' | 'total'>): string => `${collees} ${MOTS_DE_LA_MALLE.sur} ${total}`

/** « 1 nouvelle », « 2 nouvelles » : les étiquettes collées depuis ma dernière visite. */
export const nouvellesDites = (n: number): string => `${n} ${MOTS_DE_LA_MALLE.nouvelle}${pluriel(n)}`

/**
 * L'étiquette collée en dernier, nulle tant qu'aucune ne l'est. **Deux instants se comparent, jamais
 * deux chaînes** (`…T09:00:00Z` est avant `…T09:00:00.500Z`, et après lui dans l'ordre du texte) ; à
 * instants égaux, la première servie reste.
 */
export function derniereCollee(places: readonly PlaceDeMalle[]): PlaceDeMalle | null {
  let derniere: PlaceDeMalle | null = null
  for (const p of places) {
    if (etatDeLaPlace(p) !== 'collee') continue
    if (derniere === null || Date.parse(p.collee_le!) > Date.parse(derniere.collee_le!)) derniere = p
  }
  return derniere
}

/** « La Correspondance, collée le 29 septembre 2026 » : le jour se dit à Paris. Pour une place collée. */
export const derniereDite = (place: PlaceDeMalle): string => `${place.nom}, ${MOTS_DE_LA_MALLE.collee} ${jourDeParis(place.collee_le!)}`

/** La place que la malle montre en s'ouvrant : la dernière collée, sinon la première servie. */
export const placeAuDepart = (places: readonly PlaceDeMalle[]): PlaceDeMalle | null => derniereCollee(places) ?? places[0] ?? null

/** « Étiquette nº 7 · nouvelle », « … · trace de colle », « … · cachée » : la tête de la fiche d'une place (maquette, l. 3865-3869). */
export function teteDeLaFiche(place: PlaceDeMalle, nouvelle: boolean): string {
  const o = MOTS_DE_LA_MALLE.ouverte
  const etat = etatDeLaPlace(place)
  const precision = etat === 'cachee' ? o.cachee : etat === 'trace' ? o.trace : nouvelle ? MOTS_DE_LA_MALLE.nouvelle : null
  return `${o.numero} ${place.numero}${precision === null ? '' : ` · ${precision}`}`
}

/** « 1900–1909 », sur la plaque de la malle : la décennie que le serveur sert. */
export const plaqueDeLaMalle = (decennie: number): string => `${decennie}–${decennie + 9}`

/** Le travers d'une place : chaque étiquette est collée un peu de travers, toujours du même (maquette, `ROT`, l. 3842-3851). */
const TRAVERS = [-6, 4, -3, 7, 5, -8, 3, -4, 6, -5, 8, -2, 4, -7, 0] as const
export const traversDeLaPlace = (rang: number): { r: number; x: number; y: number } => ({ r: TRAVERS[rang % TRAVERS.length]!, x: ((rang * 7) % 5) - 2, y: ((rang * 5) % 7) - 3 })
