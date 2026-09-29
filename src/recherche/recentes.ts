/**
 * Les dix dernières recherches (reprise de `search/RecentSearches.kt`, appli Android) : gardées
 * localement, jamais envoyées au back — une recherche n'a rien à faire dans le journal de
 * quelqu'un d'autre.
 */
const CLE_STOCKAGE = 'journal.recherches-recentes'
export const MAX_RECHERCHES_RECENTES = 10

/**
 * [requete] en tête, sans doublon (insensible à la casse), plafonné à [max] — fonction pure,
 * testée par sa mutation. Une requête vide ou blanche ne s'ajoute pas.
 */
export function ajouterRechercheRecente(
  existantes: string[],
  requete: string,
  max = MAX_RECHERCHES_RECENTES,
): string[] {
  const nettoyee = requete.trim()
  if (!nettoyee) return existantes
  const sansDoublon = existantes.filter((r) => r.toLowerCase() !== nettoyee.toLowerCase())
  return [nettoyee, ...sansDoublon].slice(0, max)
}

/** `localStorage` peut être absent (navigation privée) ou lever : on se replie sur une liste vide plutôt que de casser l'écran. */
export function lireRecherchesRecentes(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE)
    if (!brut) return []
    const valeur = JSON.parse(brut) as unknown
    return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function ecrireRecherchesRecentes(valeur: string[]): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(valeur))
  } catch {
    // Rien à faire : la recherche fonctionne toujours, seul l'historique ne survit pas.
  }
}
