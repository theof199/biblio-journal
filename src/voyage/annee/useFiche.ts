import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireAnnee, type FicheAnnee } from '../../api/voyage'
import { RELECTURES, etatRelecture, intervalle } from '../relecture'

const enPreparation = (f: FicheAnnee | undefined): boolean => !!f && 'statut' in f && f.statut === 'en_preparation'

/**
 * La fiche d'une année, relue **à chaque ouverture**, même fraîche en cache (le verdict et le ticket
 * s'écrivent hors de la vue du membre), et toutes les cinq secondes tant que le chroniqueur écrit
 * l'ouverture (`202`), trente-six fois au plus. Le compte des « en préparation » est celui de cette
 * page ; « Réessayer » le remet à zéro.
 */
export function useFiche(annee: number) {
  const attente = useRef(0)
  const requete = useQuery({
    queryKey: cles.annee(annee),
    queryFn: async ({ signal }) => {
      const fiche = await lireAnnee(annee, signal)
      attente.current = enPreparation(fiche) ? attente.current + 1 : 0
      return fiche
    },
    refetchOnMount: 'always',
    refetchInterval: (q) => intervalle(enPreparation(q.state.data), attente.current, RELECTURES.annee),
  })
  // Une relecture qui rend la même attente garde la même donnée (partage structurel) : seul
  // `dataUpdatedAt` dit qu'une réponse est arrivée, et le lire abonne la page à chaque réponse. Sans
  // lui, la trente-sixième ne rendrait rien, et l'abandon ne se dirait jamais.
  const repondue = requete.dataUpdatedAt > 0
  const abandon = repondue && enPreparation(requete.data) && etatRelecture(true, attente.current, RELECTURES.annee) === 'abandon'
  const reessayer = () => {
    attente.current = 0
    void requete.refetch()
  }
  return { requete, abandon, reessayer }
}
