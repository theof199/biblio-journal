import { useCallback, useEffect, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

// Une mémoire par client de requêtes, c'est-à-dire par chargement de l'app (`main.tsx` n'en crée
// qu'un) : chaque test, qui monte son propre client, repart de mois tous enroulés.
const memoire = new WeakMap<QueryClient, ReadonlySet<string>>()

/**
 * Les mois du journal déroulés en planche-contact (leur clé `AAAA-MM`), mémorisés pour la session.
 * `coque/defilement.ts` rend sa position à la page quand on revient d'une fiche : un mois qui se
 * serait enroulé de lui-même la laisserait plus courte que la position retenue, et la sentinelle
 * irait chercher des pages du journal que personne n'a demandées. Jumeau de `useFiltresMemorises`.
 */
export function useMoisDeroules() {
  const client = useQueryClient()
  const [deroules, setDeroules] = useState<ReadonlySet<string>>(() => memoire.get(client) ?? new Set())

  useEffect(() => {
    memoire.set(client, deroules)
  }, [client, deroules])

  const basculer = useCallback((cle: string) => {
    setDeroules((avant) => {
      const apres = new Set(avant)
      if (!apres.delete(cle)) apres.add(cle)
      return apres
    })
  }, [])

  return [deroules, basculer] as const
}
