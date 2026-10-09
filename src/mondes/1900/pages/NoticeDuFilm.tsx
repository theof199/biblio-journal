import { Link } from 'react-router-dom'
import { formatDateVisionnage } from '../../../ui/format'
import { precisionsDuFilm } from '../../../voyage/film'
import type { PropsNotice } from '../../../voyage/film/Notice'
import { imageDu1900 } from '../images'
import { MOTS_DE_LA_SEANCE, phraseDesSeances } from './hale'
import Rubrique from './Rubrique'
import styles from './Hale.module.css'

/**
 * La notice d'un film des années 1900 (maquette, écran 5) : la voiture (sa salle), le titre de la
 * page, les réalisateurs et leurs liens vers les Suivis, la raison ; « La séance Hale's Tours », la
 * vignette de l'entrée d'un Hale's Tours et sa légende ; « Tes séances » pour un film vu ; puis le
 * programme et le guichet, que la page a montés. Rien n'y bouge.
 */
export default function NoticeDuFilm({ salle, film, realisateurs, entree, phrase, programme, guichet }: PropsNotice) {
  const precisions = precisionsDuFilm(film)
  const vignette = imageDu1900('hale')
  const [avant, gras, apres] = MOTS_DE_LA_SEANCE.legende
  const signe = realisateurs.length > 0 || !!film.realisateur
  return (
    <div className={styles.notice}>
      <p className={styles.voiture}>{`${MOTS_DE_LA_SEANCE.voiture} · ${salle.nom}`}</p>
      <h1 className={styles.titre}>{film.title}</h1>
      {film.original_title && film.original_title !== film.title ? <p className={styles.original}>{film.original_title}</p> : null}
      {signe || precisions ? (
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
            <b>{film.realisateur}</b>
          ) : null}
          {precisions ? <span>{`${signe ? '· ' : ''}${precisions}`}</span> : null}
        </p>
      ) : null}
      {film.raison ? <p className={styles.raison}>{film.raison}</p> : null}

      <Rubrique>{MOTS_DE_LA_SEANCE.titre}</Rubrique>
      <figure className={styles.entree}>
        {vignette ? <img src={vignette} alt={MOTS_DE_LA_SEANCE.vignette} width={520} height={691} loading="lazy" decoding="async" /> : null}
        <figcaption>
          {avant}
          <b>{gras}</b>
          {apres}
        </figcaption>
      </figure>

      {film.etat === 'vu' ? (
        <section aria-label={MOTS_DE_LA_SEANCE.seances}>
          <Rubrique>{MOTS_DE_LA_SEANCE.seances}</Rubrique>
          <p className={styles.txt}>
            {phraseDesSeances(film.note, entree ? { date: formatDateVisionnage(entree.entry.finished_at), reactions: entree.carnet.reactions.map(phrase) } : null)}
          </p>
        </section>
      ) : null}
      {programme}
      {guichet}
    </div>
  )
}
