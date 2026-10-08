import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireVoyageur, marquerRubriqueVue, type Voyageur } from '../../api/voyage'
import type { Rubrique } from '../voyageur'

/**
 * Ma visite d'une rubrique de la sacoche (`etiquette`, `objet`, `courrier`), pour le bloc qui la
 * montre : il lit l'état du voyageur (une seule clé, `cles.voyageur`) et rend **le `vue_le` lu à
 * l'arrivée, figé pour la visite** — c'est sur lui que « nouvelle » se calcule (`estNouveau`), si bien
 * qu'elle ne s'efface pas sous les yeux quand la marque part. Nul tant que l'état n'est pas lu, et s'il
 * est en panne : rien n'est alors nouveau, et rien n'est marqué.
 *
 * **La rubrique se marque vue une fois par visite**, quand le bloc la montre (`montree` : ses données
 * lues, non vides) et que l'état est lu : jamais en panne, jamais deux fois (un verrou, pas
 * `isPending`). La date est celle du serveur ; le cache n'apprend que ce champ (les autres écritures
 * de l'état rendent chacune leur morceau), pour le point rouge de la carte. Un échec se tait : la
 * visite suivante remarquera.
 */
export function useVisiteDeRubrique(rubrique: Rubrique, montree: boolean): { vueLe: string | null } | null {
  const client = useQueryClient()
  const voyageur = useQuery({ queryKey: cles.voyageur, queryFn: ({ signal }) => lireVoyageur(signal) })
  const [arrivee, setArrivee] = useState<{ vueLe: string | null } | null>(null)
  // Figé au premier état lu : ni le `POST` ni une relecture ne le changent plus.
  if (arrivee === null && voyageur.data) setArrivee({ vueLe: voyageur.data.rubriques.find((r) => r.rubrique === rubrique)?.vue_le ?? null })

  const { mutate } = useMutation({
    mutationFn: () => marquerRubriqueVue(rubrique),
    onSuccess: (vue) =>
      client.setQueryData<Voyageur>(cles.voyageur, (v) => (v ? { ...v, rubriques: v.rubriques.map((r) => (r.rubrique === vue.rubrique ? vue : r)) } : v)),
  })
  const partie = useRef(false)
  const aMarquer = montree && arrivee !== null
  useEffect(() => {
    if (!aMarquer || partie.current) return
    partie.current = true
    mutate()
  }, [aMarquer, mutate])

  return arrivee
}
