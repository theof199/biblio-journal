import { distanceAffichee } from './distance'
import { dansCombien, heureAffichee, type CinemaDuFilmAVenir } from './seances'
import styles from './SeancesDuFilm.module.css'

interface Props {
  /** Les cinémas où le film passe encore, déjà ordonnés et réduits à leurs séances à venir (`cinemasDuFilmAVenir`). */
  cinemas: readonly CinemaDuFilmAVenir[]
  /** L'horloge de la page : « Prochaine séance dans N min ». */
  maintenantMs: number
}

/**
 * « Séances aujourd'hui » sur la fiche d'un film : un cadre par cinéma, ses heures en pastilles avec
 * leur version. Rien à toucher : aucune réservation n'est offerte, les pastilles ne sont que des
 * repères. Absent quand le film n'a plus de séance aujourd'hui — pas de titre au-dessus d'un vide.
 */
export function SeancesDuFilm({ cinemas, maintenantMs }: Props) {
  if (cinemas.length === 0) return null

  const debuts = cinemas.map(({ cinema }) => Date.parse(cinema.seances[0]!.debut))
  const debutProchaine = new Date(Math.min(...debuts)).toISOString()

  return (
    <section aria-labelledby="titre-seances-du-jour" className={styles.seances}>
      <h2 id="titre-seances-du-jour" className={styles.titre}>
        Séances aujourd’hui
      </h2>
      <p className={styles.reste}>Prochaine séance {dansCombien(debutProchaine, maintenantMs)}</p>
      {cinemas.map(({ cinema, distance }) => (
        <article key={cinema.id} className={styles.cinema}>
          <header className={styles.entete}>
            <h3 className={styles.nom}>{cinema.nom}</h3>
            {distance != null ? <span className={styles.distance}>{distanceAffichee(distance)}</span> : null}
          </header>
          <ul className={styles.creneaux}>
            {cinema.seances.map((seance) => (
              <li key={`${seance.debut}-${seance.version}`} className={styles.creneau}>
                <time dateTime={seance.debut}>{heureAffichee(seance.debut)}</time>
                <small className={styles.version}>{seance.version}</small>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}
