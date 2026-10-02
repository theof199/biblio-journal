import type { Reaction } from '../api/reactions'

/** Combien de réactions le formulaire montre d'emblée : les autres se déplient. */
export const REACTIONS_D_EMBLEE = 3

/**
 * Les clés des réactions d'emblée visibles : les plus posées du journal (`posees`, la plus fréquente
 * d'abord, `compterReactions`), puis, quand le journal n'en a pas assez, les premières du
 * catalogue. Un journal pas encore chargé donne donc les trois premières du catalogue.
 */
export function reactionsFavorites(posees: readonly { cle: string }[], catalogue: readonly Reaction[]): string[] {
  const favorites = new Set(posees.slice(0, REACTIONS_D_EMBLEE).map((reaction) => reaction.cle))
  for (const reaction of catalogue) {
    if (favorites.size >= REACTIONS_D_EMBLEE) break
    favorites.add(reaction.cle)
  }
  return [...favorites]
}

/**
 * Les réactions à montrer : toutes une fois dépliées ; sinon les favorites, puis celles que le
 * membre a cochées, qui ne se cachent jamais — chaque groupe dans l'ordre du catalogue.
 */
export function reactionsVisibles(
  catalogue: readonly Reaction[],
  favorites: readonly string[],
  cochees: readonly string[],
  depliees: boolean,
): Reaction[] {
  if (depliees) return [...catalogue]
  const parmiLesFavorites = (reaction: Reaction) => favorites.includes(reaction.cle)
  return [
    ...catalogue.filter(parmiLesFavorites),
    ...catalogue.filter((reaction) => !parmiLesFavorites(reaction) && cochees.includes(reaction.cle)),
  ]
}
