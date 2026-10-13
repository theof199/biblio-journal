import { useCallback, useReducer } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Les entrées d'historique où « Tes séances » a été laissée dépliée, par leur clé (`location.key`),
 * à la manière des positions de `coque/defilement.ts` : en mémoire, jamais sur l'appareil. La section
 * est démontée quand on ouvre une fiche ; au retour sur la même entrée elle doit se rendre comme on
 * l'a quittée, sans quoi la position que la coque restaure ne correspond plus à rien.
 */
const deplies = new Set<string>()

/** Pour les tests : `MemoryRouter` donne la même clé (`default`) à la première entrée de chaque test. */
export const oublierLesDeplis = () => deplies.clear()

/**
 * L'état déplié de « Tes séances » pour l'entrée d'historique affichée. Une entrée neuve (toute
 * navigation qui n'est pas un retour ou une avance) a une clé neuve : elle part repliée.
 */
export function useDepliMemorise(): [boolean, (deplie: boolean) => void] {
  const { key } = useLocation()
  const [, rendre] = useReducer((n: number) => n + 1, 0)
  const poser = useCallback(
    (deplie: boolean) => {
      if (deplie) deplies.add(key)
      else deplies.delete(key)
      rendre()
    },
    [key],
  )
  return [deplies.has(key), poser]
}
