import { useEffect, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { FILTRES_INITIAUX, type FiltresMesFilms } from './filtres'

// Une mémoire par client de requêtes, c'est-à-dire par chargement de l'app (`main.tsx` n'en crée
// qu'un) : chaque test, qui monte son propre client, repart des filtres initiaux.
const memoire = new WeakMap<QueryClient, FiltresMesFilms>()

/**
 * Les filtres de « Mes films », mémorisés pour la session : ouvrir une fiche puis revenir les
 * retrouve, recharger l'app les remet à zéro — jumeau de `FiltresFilmsViewModel`, indexé sur
 * l'Activité dans l'appli Android (décision du propriétaire du 24 septembre 2026). Un `useState`
 * seul les perdait à chaque démontage de la page, donc à chaque film ouvert.
 */
export function useFiltresMemorises() {
  const client = useQueryClient()
  const [filtres, setFiltres] = useState<FiltresMesFilms>(() => memoire.get(client) ?? FILTRES_INITIAUX)

  useEffect(() => {
    memoire.set(client, filtres)
  }, [client, filtres])

  return [filtres, setFiltres] as const
}
