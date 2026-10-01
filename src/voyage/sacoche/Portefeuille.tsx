import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { lireTickets, lireVoyage, utiliserTicket, type Ticket } from '../../api/voyage'
import Panne from '../../ui/Panne'
import { jourDeParis } from '../passeport'
import { ticketOffert } from '../regles'
import commun from './Sacoche.module.css'
import styles from './Portefeuille.module.css'

/**
 * Le portefeuille (reprise de `PortefeuilleCard`, Android) : les tickets à utiliser d'abord, puis
 * les utilisés, pâlis, avec le jour (à Paris) où ils l'ont été. Un ticket a le papier
 * d'un billet de la boîte (le carton du monde, ses deux encoches). « Utiliser » ne s'offre que sur le
 * ticket que la carte offre (`ticketOffert`) ; le geste suit la carte : encaisser, puis la carte,
 * qui joue l'avancée. Lit les tickets et la carte sous leurs clés de la carte, jamais une fiche.
 */
export default function Portefeuille() {
  const client = useQueryClient()
  const naviguer = useNavigate()
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
    utiliser.mutate(annee, {
      onSuccess: () => naviguer('/voyage'),
      onSettled: () => void (envoi.current = false),
    })
  }

  const offert = voyage.data && tickets.data ? ticketOffert(voyage.data.annee_en_cours, tickets.data.tickets) : undefined
  const liste = tickets.data?.tickets ?? []
  const aUtiliser = liste.filter((t) => t.utilise_le === null)
  const utilises = liste.filter((t) => t.utilise_le !== null)

  const ligne = (t: Ticket) => (
    <li key={t.annee} className={t.utilise_le ? `${styles.ticket} ${styles.utilise}` : styles.ticket}>
      <span className={styles.texte}>
        <span className={styles.sur}>Ticket pour</span>
        <span className={styles.annee}>{t.annee}</span>
        {t.utilise_le ? (
          <span className={styles.detail}>
            utilisé le <time dateTime={t.utilise_le}>{jourDeParis(t.utilise_le)}</time>
          </span>
        ) : t.motif ? (
          <span className={styles.detail}>{t.motif}</span>
        ) : null}
      </span>
      {offert && t.annee === offert.annee ? (
        <button
          type="button"
          className={commun.bouton}
          disabled={utiliser.isPending}
          onClick={() => encaisser(t.annee)}
          aria-label={`Utiliser le ticket pour ${t.annee}`}
        >
          Utiliser
        </button>
      ) : null}
    </li>
  )

  return (
    <section className={commun.bloc} aria-label="Portefeuille">
      <h2 className={commun.titreSec}>
        Portefeuille <small>les tickets</small>
      </h2>
      {tickets.error ? (
        <div className={commun.panne}>
          <Panne erreur={tickets.error} onReessayer={() => void tickets.refetch()} />
        </div>
      ) : !tickets.data ? (
        <p className={commun.vide}>…</p>
      ) : liste.length === 0 ? (
        <p className={commun.vide}>Aucun ticket</p>
      ) : (
        <ul className={styles.liste}>
          {aUtiliser.map(ligne)}
          {utilises.map(ligne)}
        </ul>
      )}
      {utiliser.error ? (
        <p role="alert" className={commun.panne}>
          {utiliser.error instanceof ApiError ? utiliser.error.message : 'Le ticket n’a pas pu être utilisé. Réessaie.'}
        </p>
      ) : null}
    </section>
  )
}
