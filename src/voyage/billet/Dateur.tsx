import { decalerJour, molettes, peutAvancer, raccourci } from '../billet'
import { formatDateVisionnage, jourLocal } from '../../ui/format'
import styles from './Dateur.module.css'

/** La hauteur d'un cran de molette, en px : celle de la maquette (`.roue`, 40 px). */
const CRAN = 40

const JOURS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
/** Les mois en capitales d'affiche, tels que `molettes` les écrit. */
const MOIS = Array.from({ length: 12 }, (_, i) => molettes(`2000-${String(i + 1).padStart(2, '0')}-01`).mois)

function Roue({ valeurs, index, mois = false }: { valeurs: readonly string[]; index: number; mois?: boolean }) {
  return (
    <span className={`${styles.roue} ${mois ? styles.mois : ''}`}>
      <span className={styles.piste} style={{ transform: `translateY(${-index * CRAN}px)` }}>
        {valeurs.map((v) => (
          <span key={v}>{v}</span>
        ))}
      </span>
    </span>
  )
}

interface Props {
  /** Le jour du visionnage, en calendrier du téléphone (`AAAA-MM-JJ`). */
  date: string
  onChange: (date: string) => void
}

/**
 * Le dateur à molettes du billet (maquette 1890 : `.dateur`, `initNotation`) : le jour, le mois,
 * l'année, qui roulent d'un cran à l'autre (CSS, immobiles au calme) ; « ‹ » et « › » d'un jour, « › »
 * éteinte à aujourd'hui ; « Aujourd'hui » et « Hier ». Les molettes ne se lisent pas : la date, en
 * toutes lettres, est dite à part.
 */
export default function Dateur({ date, onChange }: Props) {
  const aujourdhui = jourLocal()
  const allume = raccourci(date, aujourdhui)
  const { jour, an } = molettes(date)
  const annee = Number(an)
  const cetteAnnee = Number(aujourdhui.slice(0, 4))
  // Les années de la molette : les deux dernières au moins, et jusqu'à celle du billet (une correction
  // peut dater d'avant, ou, lue depuis un fuseau à l'ouest, du lendemain).
  const debut = Math.min(annee, cetteAnnee - 2)
  const fin = Math.max(annee, cetteAnnee)
  const annees = Array.from({ length: fin - debut + 1 }, (_, i) => String(debut + i))

  return (
    <div className={styles.dateur} role="group" aria-label="Date du visionnage">
      <div className={styles.ligne}>
        <button type="button" className={styles.fleche} aria-label="Jour précédent" onClick={() => onChange(decalerJour(date, -1))}>
          ‹
        </button>
        <span className={styles.roues} aria-hidden="true">
          <Roue valeurs={JOURS} index={Number(jour) - 1} />
          <Roue valeurs={MOIS} index={Number(date.slice(5, 7)) - 1} mois />
          <Roue valeurs={annees} index={annee - debut} />
        </span>
        <button
          type="button"
          className={styles.fleche}
          aria-label="Jour suivant"
          disabled={!peutAvancer(date, aujourdhui)}
          onClick={() => onChange(decalerJour(date, 1))}
        >
          ›
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {formatDateVisionnage(date)}
      </p>
      <div className={styles.raccourcis}>
        <button type="button" aria-pressed={allume === 'aujourdhui'} onClick={() => onChange(aujourdhui)}>
          Aujourd’hui
        </button>
        <button type="button" aria-pressed={allume === 'hier'} onClick={() => onChange(decalerJour(aujourdhui, -1))}>
          Hier
        </button>
      </div>
    </div>
  )
}
