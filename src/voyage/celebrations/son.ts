import { lireSon } from '../../carte/memoire'
import { ambianceDeLaPage, type Ambiance } from '../../carte/son'

/**
 * Le son d'une fête : le clap et le carillon de l'ambiance de la carte (`carte/son.ts`), aucun son
 * nouveau, et **seulement si le membre a allumé le son de la carte** : son réglage le dit
 * (`carte/memoire.ts`) et l'ambiance est en marche (après un rechargement, seul le bouton « Son »
 * la recrée). Nul sinon : la fête reste muette, et rien ne se réveille.
 */
export function sonDeLaFete(membre: string): Ambiance | null {
  if (!lireSon(membre)) return null
  const ambiance = ambianceDeLaPage(membre)
  return ambiance.enMarche ? ambiance : null
}
