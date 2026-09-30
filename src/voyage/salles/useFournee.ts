import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { voirPlus, type FicheAnnee, type Salle } from '../../api/voyage'
import { RELECTURES, etatRelecture, type Relecture } from '../relecture'

/**
 * Relit la fiche de l'année toutes les `r.ms` tant que `enAttente` (une salle qui se remplit, une
 * salle nouvelle qui s'écrit), `r.plafond` fois au plus ; au plafond, `abandon`. La boucle vit le
 * temps de la page : une fiche rouverte pendant l'écriture (le retour d'un film) reprend le guet
 * depuis zéro, au lieu de laisser la salle « se remplir » pour toujours. Chaque relecture attend la
 * précédente : deux réponses identiques (partage structurel) ne coupent pas la boucle.
 */
export function useGuet(annee: number, enAttente: boolean, r: Relecture) {
  const client = useQueryClient()
  const lectures = useRef(0)
  const [abandon, setAbandon] = useState(false)
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    if (!enAttente) {
      lectures.current = 0
      setAbandon(false)
      return
    }
    let fini = false
    let minuteur: number | undefined
    const tour = () => {
      if (etatRelecture(true, lectures.current, r) === 'abandon') {
        setAbandon(true)
        return
      }
      minuteur = window.setTimeout(() => {
        lectures.current += 1
        void client.refetchQueries({ queryKey: cles.annee(annee), exact: true }).then(() => {
          if (!fini) tour()
        })
      }, r.ms)
    }
    tour()
    return () => {
      fini = true
      window.clearTimeout(minuteur)
    }
  }, [client, annee, enAttente, r, essai])

  /** « Réessayer » au plafond : le compte repart de zéro, et la fiche se relit tout de suite. */
  const reessayer = () => {
    lectures.current = 0
    setAbandon(false)
    setEssai((n) => n + 1)
    void client.refetchQueries({ queryKey: cles.annee(annee), exact: true })
  }

  return { abandon: enAttente && abandon, reessayer }
}

/** Une salle marquée dans la fiche en cache, sans attendre la relecture. */
export function majSalle(client: ReturnType<typeof useQueryClient>, annee: number, id: string, maj: (s: Salle) => Salle) {
  client.setQueryData<FicheAnnee>(cles.annee(annee), (f) =>
    f && 'statut' in f && f.statut === 'prete' ? { ...f, salles: f.salles.map((s) => (s.id === id ? maj(s) : s)) } : f,
  )
}

/**
 * « En voir plus » (portée de `voirPlus`, `AnneeViewModel.kt`) : une fournée enfilée (`202`) marque
 * tout de suite la salle « se remplit » — le bouton ne reste pas muet le temps d'un aller-retour —
 * puis la fiche se relit toutes les trois secondes tant que la salle se remplit, dix fois au plus ;
 * une salle déjà épuisée (`200`) relit la fiche une fois. Deux touchers rapprochés n'enfilent
 * qu'une fois : `isPending` ne se voit qu'au rendu suivant.
 */
export function useFournee(annee: number, salle: Pick<Salle, 'id' | 'fournee_en_cours'>) {
  const client = useQueryClient()
  const envoi = useRef(false)
  const mutation = useMutation({
    mutationFn: () => voirPlus(salle.id),
    onSuccess: (r) => {
      if (r.statut === 'epuisee') void client.invalidateQueries({ queryKey: cles.annee(annee), exact: true })
      else majSalle(client, annee, salle.id, (s) => ({ ...s, fournee_en_cours: true }))
    },
  })
  const demander = () => {
    if (envoi.current) return
    envoi.current = true
    mutation.mutate(undefined, { onSettled: () => void (envoi.current = false) })
  }
  const guet = useGuet(annee, salle.fournee_en_cours, RELECTURES.fournee)
  const erreur = mutation.error ? (mutation.error instanceof ApiError ? mutation.error.message : 'La salle n’a pas pu s’agrandir. Réessaie.') : null
  return { demander, erreur, ...guet }
}
