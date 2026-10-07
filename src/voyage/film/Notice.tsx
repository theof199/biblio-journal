import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { JournalItem } from '../../api/journal'
import type { FilmDeSalle, Salle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { formatDateVisionnage } from '../../ui/format'
import { precisionsDuFilm } from '../film'
import styles from './Notice.module.css'

/**
 * Ce que reçoit la notice de la fiche d'un film, par défaut ou du monde
 * (`GabaritsDesPages.noticeDuFilm`) : tout ce que la page a lu, et ses deux sections déjà montées.
 * Qui la compose ne lit rien, et rend le programme et le guichet tels qu'il les reçoit.
 */
export interface PropsNotice {
  monde: Monde
  salle: Salle
  film: FilmDeSalle
  /** Les réalisateurs que TMDB a résolus, chacun vers sa page des Suivis ; aucun, le nom de la salle (`film.realisateur`). */
  realisateurs: readonly { tmdb_id: number; name: string }[]
  /** Mon dernier visionnage, retrouvé dans mon journal : seulement pour un film vu, et peut manquer. */
  entree: JournalItem | undefined
  /** La phrase d'une réaction, par sa clé ; la clé elle-même tant que le catalogue n'a pas répondu. */
  phrase: (cle: string) => string
  /** Le programme et ses bobines ; nul pour un film seul. */
  programme: ReactNode
  guichet: ReactNode
}

/** La notice par défaut (maquette 1890 : `initFilm`, écran V) : l'enseigne de la salle, le titre, les réalisateurs, la raison, ta note, le programme, le guichet. */
export default function Notice({ salle, film, realisateurs, entree, phrase, programme, guichet }: PropsNotice) {
  const meta = precisionsDuFilm(film)
  return (
    <div className={styles.fiche}>
      <span className={styles.enseigne}>
        <i aria-hidden="true" />
        {`Salle · ${salle.nom}`}
      </span>
      <h1 className={styles.titre}>{film.title}</h1>
      {film.original_title && film.original_title !== film.title ? <p className={styles.original}>{film.original_title}</p> : null}
      <p className={styles.meta}>
        {realisateurs.length > 0 ? (
          realisateurs.map((r, i) => (
            <span key={r.tmdb_id}>
              {i > 0 ? ', ' : ''}
              <Link to={`/suivis/realisateurs/${r.tmdb_id}`} className={styles.real}>
                {`${r.name} ›`}
              </Link>
            </span>
          ))
        ) : film.realisateur ? (
          <span>{film.realisateur}</span>
        ) : null}
        {meta ? <span>{`${realisateurs.length > 0 || film.realisateur ? '· ' : ''}${meta}`}</span> : null}
      </p>
      {film.raison ? <p className={styles.boniment}>{film.raison}</p> : null}

      {film.etat === 'vu' ? <TaNote note={film.note} entree={entree} phrase={phrase} /> : null}
      {programme}
      {guichet}
    </div>
  )
}

/**
 * Ta note (maquette 1890 : `.ta-note`) : la note que l'API rend pour ce film, en perforations (dix
 * trous, `note` percés), la date et les réactions de mon dernier visionnage quand il est retrouvé.
 * La remarque (`carnet.comment`) est privée : elle ne s'affiche jamais ici.
 */
function TaNote({ note, entree, phrase }: { note: number | null; entree: JournalItem | undefined; phrase: (cle: string) => string }) {
  return (
    <section className={styles.note} aria-label="Ta note">
      <span className={styles.sc}>{entree ? `Ta note · vu le ${formatDateVisionnage(entree.entry.finished_at)}` : 'Ta note'}</span>
      <div className={styles.perfo} role="img" aria-label={note !== null ? `${note} sur 10` : 'sans note'}>
        {Array.from({ length: 10 }, (_, i) => {
          const perce = note !== null && i < note
          return (
            <i key={i} className={perce ? styles.troue : undefined} data-perce={perce} aria-hidden="true">
              {i + 1}
            </i>
          )
        })}
      </div>
      {entree && entree.carnet.reactions.length > 0 ? (
        <ul className={styles.cartons} aria-label="Tes réactions">
          {entree.carnet.reactions.map((cle) => (
            <li key={cle}>{phrase(cle)}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
