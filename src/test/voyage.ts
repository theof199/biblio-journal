import type {
  AnneeCarte,
  FicheEnAttente,
  FichePrete,
  FicheVerrouillee,
  FilmDeSalle,
  FilmSeance,
  Malle,
  Salle,
  Seance,
  Voyage,
  Voyageur,
} from '../api/voyage'
import { exemple } from './contrat'

/** La carte de l'exemple du contrat, ramenée aux années 1890. */
export function voyage1890(anneeEnCours: number, annees: Partial<AnneeCarte>[], surcharge: Partial<Voyage> = {}): Voyage {
  const base = exemple<Voyage>('/me/voyage', 'get', 200)
  const modele = base.annees[0]!
  return {
    ...base,
    annee_en_cours: anneeEnCours,
    ticket_a_montrer: null,
    tampons: [],
    seance_prise: null,
    annees: annees.map((a) => ({ ...modele, ...a }) as AnneeCarte),
    ...surcharge,
  }
}

export function annee(a: Partial<AnneeCarte> & { annee: number }): AnneeCarte {
  const modele = exemple<Voyage>('/me/voyage', 'get', 200).annees[0]!
  return { ...modele, ...a }
}

export const fichePrete = (surcharge: Partial<FichePrete> = {}): FichePrete => ({
  ...exemple<FichePrete>('/me/voyage/annees/{annee}', 'get', 200),
  ...surcharge,
})

/** Le contrat n'a d'exemple que pour `prete` et le `202` : ces deux formes s'écrivent ici, typées. */
export const ficheVerrouillee = (annee: number, surcharge: Partial<FicheVerrouillee> = {}): FicheVerrouillee => ({
  configure: true,
  statut: 'verrouillee',
  annee,
  profondeur: 0,
  podium: [null, null, null],
  ...surcharge,
})

export const ficheEnAttente = (annee: number, surcharge: Partial<FicheEnAttente> = {}): FicheEnAttente => ({
  configure: true,
  statut: 'en_attente',
  annee,
  profondeur: 0,
  podium: [null, null, null],
  ...surcharge,
})

/** Un film de salle, aux seules valeurs que le test pose : le reste vient du premier film de l'exemple. */
export function filmDeSalle(f: Partial<FilmDeSalle> & { id: string; tmdb_id: number }): FilmDeSalle {
  const modele = exemple<FichePrete>('/me/voyage/annees/{annee}', 'get', 200).salles[0]!.films[0]!
  return { ...modele, programme: null, note: null, ...f }
}

/** Une salle, sans fournée en cours ni épuisée, à moins que le test ne le dise. */
export function salle(s: Partial<Salle> & { id: string; films: FilmDeSalle[] }): Salle {
  const modele = exemple<FichePrete>('/me/voyage/annees/{annee}', 'get', 200).salles[0]!
  return { ...modele, cle: null, epuisee: false, fournee_en_cours: false, contexte: null, ...s }
}

/** Un morceau de séance, d'après un film de salle. */
export const morceau = (f: FilmDeSalle, salleNom = 'Les essentiels'): FilmSeance => ({
  film_id: f.id,
  tmdb_id: f.tmdb_id,
  title: f.title,
  cover_url: f.cover_url,
  salle: salleNom,
  etat: f.etat,
  plex_url: f.plex_url,
  bobine: null,
})

export function seance(s: Partial<Seance> & { id: string; rang: number; long: FilmSeance }): Seance {
  const modele = exemple<FichePrete>('/me/voyage/annees/{annee}', 'get', 200).seances[0]!
  return { ...modele, statut: 'proposee', court: null, ...s }
}

/**
 * Ce que la carte de 1900 lit en plus de la carte et des tickets (lot d'écrans, briefs 4 et 5) : l'état
 * d'un voyageur qui n'a rien ramassé ni rien ouvert, et une malle de 1900 où rien n'est collé. Un test
 * de la carte qui ne regarde ni les objets ni le point rouge les sert tels quels : rien ne s'allume.
 */
export const VOYAGEUR_VIDE: Voyageur = {
  objets: [],
  rubriques: ['etiquette', 'objet', 'bobine', 'courrier'].map((rubrique) => ({ rubrique, vue_le: null })),
  controleur: { attend: false, billet: null },
  poincons: [],
}
export const malleVide = (decennie: number): Malle => ({ decennie, total: 0, collees: 0, etiquettes: [] })
export const ROUTES_DU_JEU: Record<string, () => Response> = {
  'GET /api/me/voyage/voyageur': () => new Response(JSON.stringify(VOYAGEUR_VIDE)),
  'GET /api/me/voyage/decennies/1900/etiquettes': () => new Response(JSON.stringify(malleVide(1900))),
}

