import { Link } from 'react-router-dom'
import Affiche from '../ui/Affiche'
import { formatJourBref } from '../ui/format'
import { realisateurEtAnnee } from './ensuite'
import SigneDeFilm from './SigneDeFilm'
import type { JournalItem } from '../api/journal'
import type { MoisDuJournal } from './journalParMois'
import styles from './Pellicule.module.css'

/** « 1 séance », « 4 séances » : le compte d'un mois, à droite de son titre. */
const compteSeances = (nombre: number): string => `${nombre} séance${nombre > 1 ? 's' : ''}`

/** Jusqu'à ce nombre de films, la bande suffit (la planche n'en ferait qu'une rangée) : « Dérouler » n'est proposé qu'au-delà. */
const SEUIL_DE_LA_PLANCHE = 3

/** Une vignette de la pellicule : sa date vue (sauf sur la planche) et son rang sur le bord, le film (lien vers sa fiche) et sous lui, son réalisateur et son année. */
function Vignette({ item, rang, planche }: { item: JournalItem; rang: number; planche: boolean }) {
  const { entry, media } = item
  const legende = realisateurEtAnnee(media.director, media.year)
  return (
    <li className={styles.vignette}>
      <div className={styles.impression} aria-hidden="true">
        {planche ? null : <span>{formatJourBref(entry.finished_at)}</span>}
        <span className={styles.numero}>{rang}</span>
      </div>
      <Link to={`/journal/${entry.id}`} state={{ item }} className={styles.lien}>
        <Affiche
          src={media.cover_url}
          titre={media.title}
          note={entry.rating}
          className={styles.affiche}
          substitut={media.cover_url ? undefined : <SigneDeFilm titre={media.title} annee={media.year} />}
        />
      </Link>
      {legende ? <p className={styles.legende}>{legende}</p> : null}
    </li>
  )
}

/**
 * Un mois du journal en bande de pellicule 35 mm : son nom et son compte, puis les films vus qui
 * défilent de côté, chacun dans sa vignette, et pour finir l'amorce (le compte à rebours) et le bout
 * déchiré. La bande va jusqu'au bord droit de l'écran ; elle commence à la marge de la page.
 * « Dérouler » la pose à plat en planche-contact (trois colonnes, tous les films du mois, sans
 * perforations ni date) ; l'état est à l'appelant, qui le garde d'une visite à l'autre (`useMoisDeroules`).
 */
export default function Pellicule({ mois, deroulee, onBasculer }: { mois: MoisDuJournal; deroulee: boolean; onBasculer: () => void }) {
  const titreId = `mois-${mois.cle}`
  const bandeId = `bande-${mois.cle}`
  const basculable = mois.items.length > SEUIL_DE_LA_PLANCHE
  // Un mois resté déroulé qui retombe à une rangée redevient une bande plutôt que de rester coincé à plat.
  const planche = deroulee && basculable
  return (
    <section className={styles.mois} aria-labelledby={titreId}>
      <div className={styles.entete}>
        <h3 id={titreId} className={styles.titre}>
          {mois.libelle}
        </h3>
        <p className={styles.compte}>{compteSeances(mois.items.length)}</p>
        {basculable ? (
          <button type="button" className={styles.bascule} aria-expanded={planche} aria-controls={bandeId} onClick={onBasculer}>
            {planche ? 'Rembobiner' : 'Dérouler'} <span className="sr-only">{mois.libelle}</span>
          </button>
        ) : null}
      </div>
      <div id={bandeId} className={planche ? styles.planche : styles.defilement}>
        <ul className={styles.film}>
          {mois.items.map((item, indice) => (
            <Vignette key={item.entry.id} item={item} rang={indice + 1} planche={planche} />
          ))}
          {planche ? null : (
            <li className={styles.amorce} aria-hidden="true">
              <span className={styles.decompte}>3</span>
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
