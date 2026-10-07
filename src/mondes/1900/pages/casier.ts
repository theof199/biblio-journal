import type { Billet } from '../../../voyage/billets'
import { auTempo } from '../../../voyage/tempo'

/**
 * Les mots et les règles du casier du contrôleur, la boîte à billets des années 1900 (maquette
 * « Voyage immobile 1900 », écran 8), sans rendu. Le titre de la page, « Tous », « Ranger au casier »
 * et la phrase d'une case sans billet sont ceux du monde (`mots.boite`) ; les mots du carton, ceux du
 * composteur (`carton.ts`).
 */
export const MOTS_DU_CASIER = {
  cases: 'Les cases',
  pied: 'Une case par année, comme les casiers à billets des guichets : une case par destination.',
  vide: 'vide',
  toute: 'Toute la liasse',
  aucun: 'Aucun billet au casier.',
  range: 'rangé à l’instant',
  reactions: 'Tes réactions',
} as const

const billets = (n: number): string => `${n} billet${n > 1 ? 's' : ''}`

/** Sous une case : « 15 billets », « 1 billet », « vide ». */
export const compteDeLaCase = (n: number): string => (n === 0 ? MOTS_DU_CASIER.vide : billets(n))

/** Le titre de la liasse sortie : « La liasse de 1903 », ou « Toute la liasse » sous « Tous ». */
export const titreDeLaLiasse = (annee: number | null): string => (annee === null ? MOTS_DU_CASIER.toute : `La liasse de ${annee}`)

/** À côté du titre de la liasse : « 15 billets », « aucun billet ». */
export const compteDeLaLiasse = (n: number): string => (n === 0 ? 'aucun billet' : billets(n))

/**
 * La liasse d'une case, du plus ancien billet au plus récent (maquette, écran 8), quel que soit l'ordre
 * où la page les passe (la boîte de la foire les veut le dernier devant). Le rang est le numéro du
 * billet, celui de la page : rien n'est renuméroté ici.
 */
export const liasseDe = (liste: readonly Billet[]): Billet[] => [...liste].sort((a, b) => a.numero - b.numero)

/** Les cartons qu'on voit empilés dans la fente d'une case : un pour deux ou trois billets, douze au plus (le dessin de la maquette). */
export const pilesDeLaCase = (n: number): number => Math.min(12, Math.ceil(n / 2.4))

/** L'écart entre deux cartons d'une liasse qui sort, en millisecondes, au tempo ; au-delà du huitième, ils sortent ensemble. */
export const ENTRE_DEUX_CARTONS = auTempo(60)
export const CARTONS_ECHELONNES = 8
