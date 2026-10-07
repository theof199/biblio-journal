import { auTempo } from '../../../voyage/tempo'

/**
 * Les mots et les règles du guichet des années 1900, la recherche du Voyage (maquette « Voyage
 * immobile 1900 », écran 11), sans rendu. Le titre de la page, le nom du champ, « À voir en priorité »,
 * la phrase d'une recherche vaine et le lien hors du Voyage sont ceux du monde (`mots.recherche`) ;
 * l'état d'un film et les phrases d'attente, ceux de la page (`voyage/recherche/lisible.tsx`).
 */
export const MOTS_DU_GUICHET = {
  annees: 'Années',
  annee: 'Année',
  film: 'Film',
  voie: 'Voie',
} as const

/** Le fronton du guichet : « Billets · 1900 à 1909 ». */
export const frontonDuGuichet = (decennie: number): string => `Billets · ${decennie} à ${decennie + 9}`

/**
 * Ce qui sépare le réalisateur de l'état du film, sous le titre d'un départ : « Georges Méliès — vu ·
 * ★ 8 ». Jamais posé sans réalisateur : une bobine n'en a pas au contrat, son état se dit seul.
 */
export const ENTRE_LE_NOM_ET_L_ETAT = ' — '

/** L'écart entre deux réglettes qui glissent dans le tableau, en millisecondes, au tempo ; au-delà de la huitième, elles glissent ensemble. */
export const ENTRE_DEUX_REGLETTES = auTempo(40)
export const REGLETTES_ECHELONNEES = 8
