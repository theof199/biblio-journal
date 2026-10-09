import { Link } from 'react-router-dom'
import { dureeLisible } from '../../../voyage/film'
import type { PropsProgrammeDuFilm } from '../../../voyage/film/Programme'
import { etiquetteEtat } from '../../../voyage/salles'
import Compartiment from './Compartiment'
import Rubrique from './Rubrique'
import { MOTS_DES_VOIES, lettreDuCompartiment, plaqueDuCompartiment } from './voies'
import styles from './Voies.module.css'

/**
 * Le programme d'un film des années 1900 (`programmeDuFilm`) : ses bobines en compartiments, comme la
 * voiture d'une salle montre ses films (maquette, écran 4 : `.coupe`, `.compart`, que la maquette ne
 * dessine pas pour un programme ; analogie validée le 9 octobre 2026). Une bobine dit sa durée, sa
 * place et son état ; sa plaque dit si elle est occupée ; une bobine qui reste à voir tend son talon,
 * « Je l’ai vu », vers le billet de cette bobine. Il ne lit rien, et rien n'y bouge.
 */
export default function ProgrammeDuFilm({ monde, annee, film, programme }: PropsProgrammeDuFilm) {
  const perdu = monde.pages.mots.introuvable
  return (
    <section aria-label={MOTS_DES_VOIES.programme}>
      <Rubrique>
        {MOTS_DES_VOIES.programme}
        <small>{dureeLisible(programme.duree_min)}</small>
      </Rubrique>
      <ul className={styles.coupe} aria-label={`Les bobines de ${film.title}`}>
        {programme.bobines.map((b, i) => (
          <li key={b.tmdb_id}>
            <Compartiment
              affiche={b.cover_url}
              titre={b.title}
              mentions={[`${dureeLisible(b.duree_min)} · compartiment ${lettreDuCompartiment(i + 1)}`, etiquetteEtat(b.etat, perdu)]}
              plaque={plaqueDuCompartiment(b.etat, perdu)}
            />
            {b.etat !== 'vu' ? (
              <p className={styles.talon}>
                <Link to={`/voyage/${annee}/films/${film.id}/billet?bobine=${b.tmdb_id}`} aria-label={`Je l’ai vu : ${b.title}`}>
                  Je l’ai vu
                </Link>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
