import type { RubriqueVue } from '../api/voyage'

/**
 * L'état du voyageur, sans rendu : le point rouge de la sacoche, et ce qui est « nouveau » dans une
 * rubrique. **Le serveur ne calcule ni l'un ni l'autre** : il date ma dernière visite de chaque
 * rubrique (`vue_le`), l'appli compare.
 */

/** Les rubriques de la sacoche que l'appli connaît. Le contrat sert `rubrique` en chaîne : la liste peut s'allonger sans lui. */
export const RUBRIQUES = ['etiquette', 'objet', 'bobine', 'courrier'] as const
export type Rubrique = (typeof RUBRIQUES)[number]

const estConnue = (rubrique: string): rubrique is Rubrique => (RUBRIQUES as readonly string[]).includes(rubrique)

/**
 * Par rubrique, les dates de ses éléments, telles que le contrat les sert (des instants ISO) : un
 * `ramasse_le` par objet, un `collee_le` par place de la malle. Un élément sans date (une place pas
 * encore collée) se passe nul et ne compte pas. **Une rubrique dont rien n'est passé reste éteinte** :
 * l'appelant ne passe que celles dont il montre le bloc.
 */
export type DatesDesRubriques = Partial<Record<Rubrique, readonly (string | null)[]>>

/**
 * Un élément daté est-il nouveau depuis ma dernière visite ? Oui s'il est **strictement** après
 * `vueLe`, et toujours si je n'ai jamais ouvert la rubrique. Deux **instants** se comparent, jamais
 * deux chaînes : le serveur écrit `…T09:00:00Z` comme `…T09:00:00.500Z`, et le texte range le second
 * avant le premier. Une date nulle ou illisible n'est jamais nouvelle ; un `vueLe` illisible vaut jamais vue.
 */
export function estNouveau(date: string | null, vueLe: string | null): boolean {
  const instant = date === null ? Number.NaN : Date.parse(date)
  if (Number.isNaN(instant)) return false
  // Un `vue_le` illisible vaut « jamais vue », comme un `vue_le` nul : on ne sait pas dater la visite, la rubrique reste allumée.
  const visite = vueLe === null ? Number.NaN : Date.parse(vueLe)
  return Number.isNaN(visite) || instant > visite
}

/**
 * Les rubriques allumées, dans l'ordre où le serveur les sert : un élément daté après `vue_le`, ou
 * `vue_le` nul et la rubrique non vide. Une rubrique que l'appli ne connaît pas s'ignore, datée ou
 * non ; une rubrique servie deux fois ne s'allume qu'une.
 */
export function rubriquesAllumees(rubriques: readonly RubriqueVue[], dates: DatesDesRubriques): Rubrique[] {
  const allumees: Rubrique[] = []
  for (const { rubrique, vue_le: vueLe } of rubriques) {
    if (!estConnue(rubrique) || allumees.includes(rubrique)) continue
    // Jamais vue, elle ne s'allume que si elle n'est pas vide : `estNouveau` le dit de son premier élément daté.
    if ((dates[rubrique] ?? []).some((d) => estNouveau(d, vueLe))) allumees.push(rubrique)
  }
  return allumees
}
