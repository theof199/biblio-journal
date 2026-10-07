import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { lireTickets, lireVoyage, utiliserTicket } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { historiqueDerriere } from '../../ui/revenir'
import { gabaritDe } from '../gabarit'
import { ticketOffert } from '../regles'
import commun from './Sacoche.module.css'
import TicketsParDefaut from './Tickets'

/**
 * Le portefeuille de la sacoche : les tickets à utiliser d'abord, puis les utilisés. « Utiliser » ne
 * s'offre que sur le ticket que la carte offre (`ticketOffert`) ; le geste suit la carte : encaisser,
 * puis la carte, qui joue l'avancée. Lit les tickets et la carte sous leurs clés de la carte, jamais
 * une fiche. Le dessin est celui du monde de mon année en cours (`portefeuille`), que la page lui
 * passe : il ne lit ni n'écrit rien.
 */
export default function Portefeuille({ monde }: { monde: Monde }) {
  const client = useQueryClient()
  const naviguer = useNavigate()
  const { key } = useLocation()
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const tickets = useQuery({ queryKey: cles.tickets, queryFn: ({ signal }) => lireTickets(signal) })
  const utiliser = useMutation({
    mutationFn: (annee: number) => utiliserTicket(annee),
    // La carte et les tickets (sous le même préfixe) : ce que la carte doit apprendre survit au départ.
    onSuccess: () => void client.invalidateQueries({ queryKey: cles.voyage }),
  })
  // `isPending` ne se voit qu'au rendu suivant : deux touchers rapprochés encaisseraient deux fois
  // (le second répondrait 404, « déjà utilisé »). Le même verrou que la carte.
  const envoi = useRef(false)
  const encaisser = (annee: number) => {
    if (envoi.current) return
    envoi.current = true
    // Vers la carte sans empiler la sacoche derrière elle (le retour du téléphone y ramènerait) :
    // reculer quand l'historique porte la carte (la sacoche s'ouvre d'elle), sinon la remplacer.
    utiliser.mutate(annee, {
      onSuccess: () => (historiqueDerriere(key) ? naviguer(-1) : naviguer('/voyage', { replace: true })),
      onSettled: () => void (envoi.current = false),
    })
  }

  const offert = voyage.data && tickets.data ? ticketOffert(voyage.data.annee_en_cours, tickets.data.tickets) : undefined
  const liste = tickets.data?.tickets
  // Les tickets à utiliser d'abord, les utilisés dessous : le dessin les reçoit rangés.
  const ranges = liste ? [...liste.filter((t) => t.utilise_le === null), ...liste.filter((t) => t.utilise_le !== null)] : null

  const Tickets = gabaritDe(monde, 'portefeuille', TicketsParDefaut)
  return (
    <section className={commun.bloc} aria-label="Portefeuille">
      <Tickets
        panne={tickets.error ? { erreur: tickets.error, reessayer: () => void tickets.refetch() } : null}
        tickets={ranges ? ranges.map((t) => ({ ticket: t, utiliser: offert && t.annee === offert.annee ? () => encaisser(t.annee) : null })) : null}
        enCours={utiliser.isPending}
        refus={utiliser.error ? (utiliser.error instanceof ApiError ? utiliser.error.message : 'Le ticket n’a pas pu être utilisé. Réessaie.') : null}
      />
    </section>
  )
}
