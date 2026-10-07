import type { FilmDeSalle, Marche, Salle } from '../../../api/voyage'

/**
 * Les mots et les règles des trois classes (le podium) et du train du soir (la séance) d'une gare
 * (maquette « Voyage immobile 1900 », écrans 3 et 17), sans rendu. Le wagon-restaurant de l'écran 17
 * (la séance à deux) n'est pas repris : il attend le lot À deux.
 */
export const MOTS_DES_CLASSES = {
  libre: 'place libre',
  aChoisir: 'à choisir',
  changer: 'Changer',
  sansAffiche: 'sans affiche',
  aide: 'Toucher une portière pour ouvrir son film · la tenir pour la vider',
  aideSansFilm: 'Toucher une portière pour y installer un film · la tenir pour la vider',
} as const

export const MOTS_DU_SOIR = {
  affiche: 'Train de plaisir',
  heure: 'ce soir à 8 h ½',
  enComposition: 'en composition',
  entree: 'Entrée libre',
  long: 'La voiture · le long',
  court: 'En tête · en ouverture',
  trajet: 'Pendant le trajet',
  prise: 'Prise',
  rendre: 'À rendre avant minuit',
  composer: 'Composer une séance',
  compose: 'Le chroniqueur compose la séance…',
  passees: 'Séances passées',
} as const

const CLASSES = [
  { chiffre: 'I', nom: '1ʳᵉ classe' },
  { chiffre: 'II', nom: '2ᵉ classe' },
  { chiffre: 'III', nom: '3ᵉ classe' },
] as const

/** La classe d'une place du podium : son chiffre romain, peint sur la caisse, et son nom. */
export const classeDe = (place: number): { chiffre: string; nom: string } => CLASSES[place - 1] ?? { chiffre: String(place), nom: `${place}ᵉ classe` }

/**
 * Le film de la fiche qu'une marche occupée désigne, pour ouvrir sa page : un programme par son
 * identifiant, un film par son numéro TMDB (jamais un programme, qui en porte un aussi). Nul quand la
 * marche est vide, ou que son film n'est dans aucune salle de l'année (un film du journal, ou une année
 * en attente, sans salles) : la portière n'a alors aucune page à ouvrir.
 */
export function filmDeLaMarche(marche: Marche | null, salles: readonly Pick<Salle, 'films'>[]): FilmDeSalle | null {
  if (!marche) return null
  const films = salles.flatMap((s) => s.films)
  if (marche.programme_id !== null) return films.find((f) => f.id === marche.programme_id) ?? null
  return films.find((f) => f.programme === null && f.tmdb_id === marche.tmdb_id) ?? null
}
