import type { Malle, RubriqueVue, Voyageur } from '../api/voyage'
import type { ClesSansDefaut, Monde } from '../mondes/types'
import { gabaritSeul } from './gabarit'

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

/** Le nom du lien de la sacoche sur la carte, point éteint : il reste exactement celui-ci. */
export const NOM_DE_LA_SACOCHE = 'Sacoche du voyageur'

/** Ce que la carte a lu pour le point rouge : l'état du voyageur, et la malle de la décennie de mon année en cours. Absent : pas lu, ou en panne. */
export interface LuPourLaPastille {
  voyageur: Voyageur | undefined
  malle: Malle | undefined
}

/**
 * Une rubrique que le point rouge de la pastille regarde : le bloc de la sacoche qui la montre (une
 * clé sans défaut : sans lui, la sacoche ne la marquerait jamais vue), les dates de ses éléments dans
 * ce que la carte a lu, et ce que le nom du lien en dit.
 */
export interface RubriqueDeLaPastille {
  rubrique: Rubrique
  bloc: ClesSansDefaut
  /** Vrai si ses dates se lisent dans la malle de la décennie : la carte ne la lit que pour elle. */
  malle: boolean
  dates: (lu: LuPourLaPastille) => readonly (string | null)[] | undefined
  pourquoi: string
}

/**
 * **La liste des rubriques qui allument le point, écrite ici et nulle part ailleurs.** `bobine` n'y
 * sera jamais (ses éléments n'ont pas de date, et la sacoche n'en monte aucun bloc) ; `courrier` y
 * entre avec son bloc (plan des écrans des lots, brief 13), d'une ligne.
 */
export const RUBRIQUES_DE_LA_PASTILLE: readonly RubriqueDeLaPastille[] = [
  { rubrique: 'etiquette', bloc: 'malleDeLaSacoche', malle: true, dates: ({ malle }) => malle?.etiquettes.map((p) => p.collee_le), pourquoi: 'une étiquette vient d’être collée sur la malle' },
  { rubrique: 'objet', bloc: 'objetsDeLaSacoche', malle: false, dates: ({ voyageur }) => voyageur?.objets.map((o) => o.ramasse_le), pourquoi: 'un objet trouvé en gare' },
]

/**
 * Celles dont la sacoche de ce monde monte le bloc : le monde de mon année en cours, celui que la
 * sacoche habille. Vide pour 1890 et le monde « à venir » : la carte ne lit alors rien pour le point.
 */
export function rubriquesDeLaPastille(monde: Monde): readonly RubriqueDeLaPastille[] {
  return RUBRIQUES_DE_LA_PASTILLE.filter((r) => gabaritSeul(monde, r.bloc) !== null)
}

/**
 * Pourquoi le point est allumé : une phrase par rubrique allumée (`rubriquesAllumees`), dans l'ordre
 * de la liste. Vide, le point est éteint. Tant que l'état du voyageur n'est pas lu, ou en panne, rien
 * ne s'allume ; une rubrique dont les dates manquent (la malle pas lue, ou en panne) reste éteinte.
 */
export function nouveautesDeLaSacoche(montees: readonly RubriqueDeLaPastille[], lu: LuPourLaPastille): string[] {
  if (!lu.voyageur) return []
  const dates: DatesDesRubriques = {}
  for (const r of montees) dates[r.rubrique] = r.dates(lu) ?? []
  const allumees = rubriquesAllumees(lu.voyageur.rubriques, dates)
  return montees.filter((r) => allumees.includes(r.rubrique)).map((r) => r.pourquoi)
}

/** Le nom du lien : éteint, « Sacoche du voyageur » tel quel ; allumé, il dit pourquoi (maquette « Voyage immobile 1900 », `signalerSacoche`). */
export function nomDeLaSacoche(nouveautes: readonly string[]): string {
  return nouveautes.length === 0 ? NOM_DE_LA_SACOCHE : `${NOM_DE_LA_SACOCHE} : ${nouveautes.join(' et ')}`
}
