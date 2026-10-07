import type { FichePrete, Recompense, Voyage } from '../../api/voyage'
import { arriveesDeLAnnee, type Arrivee } from '../annee'
import { decennieDe } from '../regles'
import { numeroDeLaSalle, salleComplete } from '../salles'
import type { Scene } from './scenes'

/**
 * Ce que le séquenceur lit pour le dessin d'une fête, sans rendu ni requête : la fiche que la page
 * tient déjà, et la carte en cache. Le dessin (le défaut, ou celui d'un monde) ne lit rien.
 */

/** La salle qu'une fête montre : son numéro (celui de la page, jamais recalculé), son nom, ses films. */
export interface SalleFetee {
  numero: number
  nom: string
  films: readonly { id: string; titre: string; affiche: string | null }[]
}

/**
 * La salle bouclée, telle que la fiche la montre : la seule que la scène nomme, complète et hors
 * essentiels (le filtre d'`etatDeFete`). Nulle sans fiche, ou quand la scène en compte plusieurs.
 */
export function salleFetee(fiche: Pick<FichePrete, 'salles'> | null, scene: Extract<Scene, { type: 'salle' }>): SalleFetee | null {
  if (!fiche || scene.noms.length !== 1) return null
  const salle = fiche.salles.find((s) => s.cle !== 'essentiels' && s.nom === scene.noms[0] && salleComplete(s))
  return salle ? { numero: numeroDeLaSalle(salle), nom: salle.nom, films: salle.films.map((f) => ({ id: f.id, titre: f.title, affiche: f.cover_url })) } : null
}

export interface RecompensePassee {
  annee: number
  recompense: Recompense
}

/**
 * Les récompenses des années d'avant, lues de la carte : celles de la décennie de l'année fêtée,
 * avant elle, dans l'ordre des années. Jamais une année sans récompense, ni d'une autre décennie,
 * ni l'année fêtée elle-même (sa récompense est celle de la scène).
 */
export function recompensesDAvant(carte: Pick<Voyage, 'annees'> | undefined, annee: number): RecompensePassee[] {
  if (!carte) return []
  return carte.annees
    .filter((a) => decennieDe(a.annee) === decennieDe(annee) && a.annee < annee)
    .flatMap((a) => (a.recompense ? [{ annee: a.annee, recompense: a.recompense }] : []))
    .sort((a, b) => a.annee - b.annee)
}

/**
 * Les arrivées de l'année bouclée, par la seule règle qui les calcule (`arriveesDeLAnnee`) : la fête
 * ne les recompte pas. Nulles sans la fiche de cette année (le rattrapage de la carte n'en lit pas).
 */
export function arriveesFetees(fiche: Pick<FichePrete, 'annee' | 'profondeur' | 'progression' | 'recompense' | 'ticket'> | null, annee: number): Arrivee[] | null {
  if (!fiche || fiche.annee !== annee) return null
  return arriveesDeLAnnee(fiche.profondeur, fiche.progression, fiche.recompense, fiche.ticket)
}
