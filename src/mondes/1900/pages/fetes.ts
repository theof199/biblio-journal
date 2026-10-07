import type { Recompense } from '../../../api/voyage'
import type { SalleFetee } from '../../../voyage/celebrations/lues'
import type { Scene } from '../../../voyage/celebrations/scenes'
import { LIEU } from '../gares'

/**
 * Les mots et les règles des fêtes des années 1900 (maquette « Voyage immobile 1900 », écran 13),
 * sans rendu : la voiture complète, l'étiquette de malle, la ligne bouclée et son « Bon pour ». La
 * scène « Étiquette collée » d'un badge, le tampon du douanier et l'adieu n'en sont pas.
 */
export const MOTS_DES_FETES = {
  voiture: 'Voiture complète',
  voitures: 'Voitures complètes',
  complet: 'Complet',
  guidon: 'Plus un film à y voir : le chef de gare lève le guidon.',
  malle: 'Les étiquettes de la malle',
  compagnie: 'Ch. de fer du Voyage',
  arrivees: 'Les arrivées de',
  bouclee: 'est bouclée',
  bon: 'Bon pour',
  entree: 'Entrée',
} as const

type SceneDeSalle = Extract<Scene, { type: 'salle' }>

/**
 * Le carton de la voiture, d'après celui de la scène (`cartonDeSalle`), sans recompter : une salle
 * est une voiture, son nom reste le sien.
 */
export function cartonDeLaVoiture(scene: SceneDeSalle, carton: { sur: string; titre: string }): { sur: string; titre: string } {
  if (scene.noms.length === 1) return { sur: MOTS_DES_FETES.voiture, titre: carton.titre }
  return { sur: /^Salles/.test(carton.sur) ? MOTS_DES_FETES.voitures : MOTS_DES_FETES.voiture, titre: carton.titre.replace('salle', 'voiture') }
}

/** Les fenêtres que la voiture montre à quai : quatre au plus. */
export const FENETRES = 4

export interface Fenetre {
  cle: string
  /** Le film derrière la vitre ; nul, une fenêtre sans film (la salle n'est pas connue). */
  titre: string | null
  affiche: string | null
}

/**
 * Les fenêtres de la voiture complète : les derniers films de la salle, la dernière fenêtre étant
 * celle qui s'allume. Sans salle (plusieurs à la fois, ou pas de fiche), quatre fenêtres sans film.
 */
export function fenetresDeLaVoiture(salle: SalleFetee | null): Fenetre[] {
  if (!salle) return Array.from({ length: FENETRES }, (_, i) => ({ cle: `vide-${i}`, titre: null, affiche: null }))
  return salle.films.slice(-FENETRES).map((f) => ({ cle: f.id, titre: f.titre, affiche: f.affiche }))
}

/** La forme de chaque étiquette (maquette : `.etq.lion`, `.ours`, `.palme`) : ronde, carrée, ovale. */
export const FORME_DE_L_ETIQUETTE: Readonly<Record<Recompense, 'ronde' | 'carree' | 'ovale'>> = { lion: 'ronde', ours: 'carree', palme: 'ovale' }

/**
 * Où une étiquette passée est collée sur la malle, et de combien elle penche : neuf places autour de
 * celle du milieu, que la neuve prend. Un décor : la place ne dit rien de l'année.
 */
const PLACES: readonly { left: number; top: number; angle: number }[] = [
  { left: 10, top: 4, angle: 9 },
  { left: 178, top: 8, angle: -12 },
  { left: 180, top: 122, angle: 6 },
  { left: 8, top: 120, angle: -8 },
  { left: 94, top: 0, angle: -4 },
  { left: 96, top: 128, angle: 5 },
  { left: 2, top: 62, angle: 12 },
  { left: 188, top: 66, angle: -7 },
  { left: 140, top: 96, angle: 10 },
]
export const placeDeLEtiquette = (rang: number): { left: number; top: number; angle: number } => PLACES[rang % PLACES.length]!

/** La ligne du « Bon pour » : d'où l'on vient, et la gare où le ticket mène quand elle a un lieu. */
export const trajetDuBon = (annee: number, ticket: number): string => `de ${annee} à ${LIEU[ticket] ?? ticket}`
