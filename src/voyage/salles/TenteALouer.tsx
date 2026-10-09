import type { DemandeSalle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import type { ZoneNouvelleSalle } from '../salles'
import styles from './NouvelleSalle.module.css'

/** Ce que `NouvelleSalle` passe au dessin de sa zone, que le monde peut composer (`GabaritsDesPages.nouvelleSalle`). */
export interface PropsNouvelleSalle {
  monde: Monde
  annee: number
  /** Ce que la zone montre (`zoneNouvelleSalle`) : le bouton, la salle qui s'écrit, ou le refus. */
  zone: ZoneNouvelleSalle
  /** La demande en cours ou refusée : son texte, et le motif du refus. */
  demande: DemandeSalle | null
  /** Le guet de la salle qui s'écrit a atteint son plafond : le chroniqueur n'a pas répondu. */
  abandon: boolean
  /** Ouvrir le feuillet « Quelle salle ? ». */
  onOuvrir: () => void
  /** Relancer le guet après un abandon. */
  onReessayer: () => void
}

/** La tente à louer de la maquette (`TENTE`). */
function Tente() {
  return (
    <svg className={styles.tente} viewBox="0 0 90 54" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3">
      <path d="M8 50V22L45 4l37 18v28" />
      <path d="M8 22h74M36 50V32h18v18" />
      <path d="M45 4V0" strokeDasharray="none" />
    </svg>
  )
}

/**
 * La zone de la nouvelle salle, par défaut (maquette 1890 : `.nouvelle`, ligne 199) : la tente à louer
 * et le bouton, la salle qui s'écrit (l'étagère fantôme), ou le refus (son motif, et le bouton pour en
 * demander une autre). Elle ne lit ni n'écrit rien : la zone, la demande, l'abandon du guet et les deux
 * gestes viennent de `NouvelleSalle`.
 */
export default function TenteALouer({ monde, zone, demande, abandon, onOuvrir, onReessayer }: PropsNouvelleSalle) {
  if (zone === 'fantome') {
    return (
      <section className={styles.fantome} aria-label="La salle qui s’écrit">
        <p className={styles.demande}>{demande?.demande}</p>
        {abandon ? (
          <div role="alert">
            <p>Le chroniqueur n’a pas répondu, reviens plus tard.</p>
            <button type="button" className={styles.bouton} onClick={onReessayer}>
              Réessayer
            </button>
          </div>
        ) : (
          <p role="status">{monde.pages.mots.salleNeuve.sEcrit}</p>
        )}
        <div className={styles.cadres} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
    )
  }
  return (
    <div className={styles.nouvelle}>
      <Tente />
      {zone === 'refus' ? (
        <p role="alert" className={styles.motif}>
          {demande?.motif ?? 'Le chroniqueur n’a pas trouvé de quoi ouvrir cette salle.'}
        </p>
      ) : (
        <p>{monde.pages.mots.nouvelleSalle}</p>
      )}
      <button type="button" className={styles.bouton} onClick={onOuvrir}>
        {monde.pages.mots.salleNeuve.ouvrir}
      </button>
    </div>
  )
}
