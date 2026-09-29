import brut from '../../contract/openapi.json?raw'

/**
 * Les réponses des tests viennent des exemples du contrat (spec du Journal web, « Les tests ») :
 * une forme qui dérive côté API fait tomber le test ici, au lieu d'être recopiée à la main.
 * Importé en texte (`?raw`, Vite) plutôt qu'en JSON : `tsc` n'a pas à inférer le type d'un
 * fichier de deux mégaoctets, et le dépôt n'a pas `@types/node`.
 */
type Contrat = {
  paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { examples?: Record<string, { value: unknown }> }> }> }>>
}
const contrat = JSON.parse(brut) as Contrat

/** Une copie profonde de l'exemple « Réponse type » : le test peut la modifier sans toucher aux autres. */
export function exemple<T>(chemin: string, methode: 'get' | 'post', statut: number): T {
  const valeur = contrat.paths[chemin]?.[methode]?.responses[String(statut)]?.content?.['application/json']?.examples?.['Réponse type']?.value
  if (valeur === undefined) throw new Error(`pas d'exemple pour ${methode.toUpperCase()} ${chemin} ${statut}`)
  return structuredClone(valeur) as T
}
