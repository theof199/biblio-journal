import type { Monde } from './types'
import { mondeAVenir } from './avenir'
import { creerMonde1890 } from './1890'
import { creerMonde1900 } from './1900'

/**
 * Le registre des mondes : une ligne par monde qui a son chantier. Toute autre décennie prend le
 * monde « à venir ». Un registre par moteur : rien de ce qu'un monde tient ne passe d'une carte
 * montée à l'autre.
 */
const FABRIQUES: Record<number, () => Monde> = {
  1890: creerMonde1890,
  1900: creerMonde1900,
}

export function creerRegistre(): (decennie: number) => Monde {
  const cache = new Map<number, Monde>()
  return (decennie) => {
    let m = cache.get(decennie)
    if (!m) {
      m = FABRIQUES[decennie]?.() ?? mondeAVenir(decennie)
      cache.set(decennie, m)
    }
    return m
  }
}
