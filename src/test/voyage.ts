import type { AnneeCarte, FichePrete, Voyage } from '../api/voyage'
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
