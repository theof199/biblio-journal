import type { Ticket } from '../../api/voyage'
import Panne from '../../ui/Panne'
import { jourDeParis } from '../passeport'
import type { PanneDeBloc } from '../sacoche'
import commun from './Sacoche.module.css'
import styles from './Portefeuille.module.css'

/** Un ticket du portefeuille, et le geste que la page offre sur lui. */
export interface TicketDuPortefeuille {
  ticket: Ticket
  /**
   * « Utiliser » : posé sur le seul ticket que la carte offre (`ticketOffert`), nul sur tous les
   * autres. Le dessin n'offre le geste que là où il le reçoit.
   */
  utiliser: (() => void) | null
}

/**
 * Ce que reçoit le portefeuille, par défaut ou du monde (`GabaritsDesPages.portefeuille`) : les
 * tickets déjà rangés (ceux à utiliser d'abord, puis les utilisés), l'attente, la panne, et le refus
 * d'un encaissement, posés dans la région « Portefeuille ». `Portefeuille.tsx` garde cette région,
 * les deux lectures, l'écriture et son verrou, la navigation vers la carte.
 */
export interface PropsPortefeuille {
  /** Les tickets sont en panne : le bloc le dit, et lui seul. */
  panne: PanneDeBloc | null
  /** Nul tant que les tickets n'ont pas répondu ; vide après une réponse sans ticket. */
  tickets: readonly TicketDuPortefeuille[] | null
  /** Un encaissement est parti : le geste ne se rejoue pas. */
  enCours: boolean
  /** Ce que l'API a répondu à un encaissement refusé. */
  refus: string | null
}

/**
 * Le portefeuille par défaut (reprise de `PortefeuilleCard`, Android) : un ticket a le papier d'un
 * billet de la boîte (le carton du monde, ses deux encoches) ; utilisé, il pâlit et dit son jour, à
 * Paris.
 */
export default function Tickets({ panne, tickets, enCours, refus }: PropsPortefeuille) {
  return (
    <>
      <h2 className={commun.titreSec}>
        Portefeuille <small>les tickets</small>
      </h2>
      {panne ? (
        <div className={commun.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : !tickets ? (
        <p className={commun.vide}>…</p>
      ) : tickets.length === 0 ? (
        <p className={commun.vide}>Aucun ticket</p>
      ) : (
        <ul className={styles.liste}>
          {tickets.map(({ ticket: t, utiliser }) => (
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
              {utiliser ? (
                <button type="button" className={commun.bouton} disabled={enCours} onClick={utiliser} aria-label={`Utiliser le ticket pour ${t.annee}`}>
                  Utiliser
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {refus ? (
        <p role="alert" className={commun.panne}>
          {refus}
        </p>
      ) : null}
    </>
  )
}
