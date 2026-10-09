import { Link } from 'react-router-dom'
import type { FilmDeSalle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { dureeLisible } from '../film'
import { etiquetteEtat } from '../salles'
import styles from './Programme.module.css'

/** Le traitement des affiches du monde, par `filter` CSS : jamais une lecture de pixels. */
const TRAITEMENT = { sepia: styles.sepia, gris: styles.gris, couleur: '' } as const

/** Ce que la page passe au programme d'un film, que le monde peut composer (`GabaritsDesPages.programmeDuFilm`). */
export interface PropsProgrammeDuFilm {
  monde: Monde
  annee: number
  /** Le film de la salle, qui porte le programme ; sa ligne (`id`) est celle du billet de chaque bobine. */
  film: FilmDeSalle
  programme: NonNullable<FilmDeSalle['programme']>
}

/**
 * Le programme d'un film de salle (portée de `ProgrammeBobines`, `FicheVoyageScreen.kt`) : « Programme
 * · 12 min », puis une ligne par bobine, sa durée et son état. Un programme se note bobine par
 * bobine : une bobine non vue ouvre le billet du programme avec `?bobine=<tmdb_id>` (tâche 11 :
 * `bobineDuFilm`, `candidatDuBillet(film, bobine)`).
 */
export default function Programme({ monde, annee, film, programme }: PropsProgrammeDuFilm) {
  const perdu = monde.pages.mots.introuvable
  return (
    <section className={styles.programme} aria-label="Programme">
      <p className={styles.tete}>{`Programme · ${dureeLisible(programme.duree_min)}`}</p>
      <ul className={`${styles.bobines} ${TRAITEMENT[monde.traitement.affiches]}`}>
        {programme.bobines.map((b) => (
          <li key={b.tmdb_id} className={styles.bobine}>
            {b.cover_url ? <img src={b.cover_url} alt="" loading="lazy" decoding="async" /> : <span className={styles.sansImage} />}
            <span className={styles.texte}>
              <b>{b.title}</b>
              <small>{`${dureeLisible(b.duree_min)} · ${etiquetteEtat(b.etat, perdu)}`}</small>
            </span>
            {b.etat !== 'vu' ? (
              <Link to={`/voyage/${annee}/films/${film.id}/billet?bobine=${b.tmdb_id}`} className={styles.vu} aria-label={`Je l’ai vu : ${b.title}`}>
                Je l’ai vu
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
