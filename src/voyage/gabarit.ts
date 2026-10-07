import type { GabaritsDesPages, Monde } from '../mondes/types'

/**
 * Le composant d'une section de page : celui que le monde fournit (`Monde.pages.gabarits`), sinon le
 * composant par défaut de la page. Les deux reçoivent les mêmes propriétés : la page écrit son JSX
 * une fois, sans jamais demander quel monde elle habille.
 *
 * Toute lecture d'un gabarit passe par ici : `<Section … />` devient
 * `const Section = gabaritDe(monde, 'cle', Defaut)`, et rien d'autre ne change dans la page.
 */
export function gabaritDe<C extends keyof GabaritsDesPages>(monde: Monde, cle: C, defaut: GabaritsDesPages[C]): GabaritsDesPages[C] {
  return monde.pages.gabarits[cle] ?? defaut
}
