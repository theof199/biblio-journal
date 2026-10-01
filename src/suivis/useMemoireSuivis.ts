import { useCallback, useEffect, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { SourceSuivi } from './liste'

interface Memoire {
  onglet: SourceSuivi
  archivesOuvertes: ReadonlySet<SourceSuivi>
}

const DEPART: Memoire = { onglet: 'realisateurs', archivesOuvertes: new Set() }

// Une mémoire par client de requêtes, c'est-à-dire par chargement de l'app (`main.tsx` n'en crée
// qu'un) : chaque test, qui monte son propre client, repart de l'intercalaire des rétrospectives,
// archives fermées.
const memoire = new WeakMap<QueryClient, Memoire>()

/**
 * L'intercalaire choisi (rétrospectives ou cycles) et les archives dépliées, mémorisés pour la
 * session. `coque/defilement.ts` rend sa position à la page quand on revient d'une fiche : une page
 * qui reviendrait sur l'autre intercalaire, ou archives repliées, serait plus courte que la position
 * retenue. Jumeau de `useMoisDeroules`. Le panneau de recherche, lui, ne se retient pas : on revient
 * à une page de suivis, pas à une recherche.
 */
export function useMemoireSuivis() {
  const client = useQueryClient()
  const [etat, setEtat] = useState<Memoire>(() => memoire.get(client) ?? DEPART)

  useEffect(() => {
    memoire.set(client, etat)
  }, [client, etat])

  const choisirOnglet = useCallback((onglet: SourceSuivi) => setEtat((avant) => ({ ...avant, onglet })), [])

  const basculerArchives = useCallback((source: SourceSuivi) => {
    setEtat((avant) => {
      const archivesOuvertes = new Set(avant.archivesOuvertes)
      if (!archivesOuvertes.delete(source)) archivesOuvertes.add(source)
      return { ...avant, archivesOuvertes }
    })
  }, [])

  return { onglet: etat.onglet, archivesOuvertes: etat.archivesOuvertes, choisirOnglet, basculerArchives }
}
