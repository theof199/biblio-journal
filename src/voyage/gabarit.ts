import type { ClesSansDefaut, GabaritsDesPages, Monde } from '../mondes/types'

/**
 * Le composant d'une section de page : celui que le monde fournit (`Monde.pages.gabarits`), sinon le
 * composant par défaut de la page. Les deux reçoivent les mêmes propriétés : la page écrit son JSX
 * une fois, sans jamais demander quel monde elle habille.
 *
 * Toute lecture d'un gabarit qui a un défaut passe par ici : `<Section … />` devient
 * `const Section = gabaritDe(monde, 'cle', Defaut)`, et rien d'autre ne change dans la page.
 */
export function gabaritDe<C extends Exclude<keyof GabaritsDesPages, ClesSansDefaut>>(monde: Monde, cle: C, defaut: GabaritsDesPages[C]): GabaritsDesPages[C] {
  return monde.pages.gabarits[cle] ?? defaut
}

/**
 * Le composant d'une section **sans défaut** (`ClesSansDefaut`) : celui du monde, ou rien. Le bloc qui
 * le lit ne se monte que s'il existe, et ne lit rien sinon : c'est ce qui tient les écrans des lots
 * hors de 1890 et du monde « à venir », sans qu'aucune page demande quel monde elle habille.
 */
export function gabaritSeul<C extends ClesSansDefaut>(monde: Monde, cle: C): GabaritsDesPages[C] | null {
  return monde.pages.gabarits[cle] ?? null
}
