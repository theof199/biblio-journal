import { IconCheck } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import Attente, { Barre } from '../ui/Attente'
import type { FilmSaga } from '../api/sagas'
import { sagaALongNom } from './affichettes'
import AfficheSuivi from './AfficheSuivi'
import { casesBande, compteCarte, dernierVisionnage, ligneBouclee, type EtatBande, type EtatFilmographie } from './liste'
import { prochainAVoir } from './prochain'
import styles from './PlancheCycle.module.css'

const DESCRIPTION_CASE: Record<EtatBande, string> = {
  vu: 'vu',
  prochain: 'prochain à voir',
  'pas-encore': 'pas encore',
  introuvable: 'introuvable',
}

/**
 * La planche d'un cycle, punaisée au mur de la programmation sur toute la largeur : le nom de la
 * saga, « 2 séances sur 4 » à droite, puis ses films en affiches, six par rangée (`casesBande`, que
 * l'interrupteur « Masquer les introuvables » règle) : coché au crayon rouge, le prochain cerclé de
 * rouge, les autres grisés, un introuvable grisé et marqué « perdu » ; enfin « ensuite » et son film.
 * Bouclée, elle porte le bandeau « Complet » et sa date de clôture, et n'a plus de prochain film.
 * Filmographie en attente ou en panne : le nom, puis une ligne en blanc (« … » pour un lecteur d'écran)
 * ou « indisponible », rien d'autre.
 *
 * Toute la planche ouvre la page de la saga (le lien s'étend sur elle), mais seul son nom nomme ce
 * lien : la rangée de films se lit case par case, pas en un seul nom de lien interminable.
 */
export default function PlancheCycle({
  nom,
  lien,
  ajouteLe,
  etat,
  masquerIntrouvables,
  bouclee,
}: {
  nom: string
  lien: string
  ajouteLe: string
  etat: EtatFilmographie<FilmSaga> | undefined
  masquerIntrouvables: boolean
  bouclee: boolean
}) {
  const films = etat?.statut === 'pret' ? etat.films : null
  // Bouclée, elle n'a plus de film à voir : pas de « ensuite », sans test à part.
  const prochain = films ? prochainAVoir(films) : undefined
  const ligneDeCloture = films && bouclee ? ligneBouclee('sagas', dernierVisionnage(films), ajouteLe) : null

  return (
    <li className={styles.planche}>
      <span className={styles.punaise} aria-hidden="true" />
      <div className={styles.tete}>
        <div className={styles.titre}>
          <p className={styles.genre}>Cycle</p>
          <Link to={lien} className={styles.lien}>
            <span className={sagaALongNom(nom) ? `${styles.nom} ${styles.nomLong}` : styles.nom}>{nom}</span>
          </Link>
        </div>
        {films ? (
          <Compte films={films} masquerIntrouvables={masquerIntrouvables} />
        ) : etat?.statut === 'indisponible' ? (
          <p className={styles.attente}>indisponible</p>
        ) : (
          <div className={`${styles.attente} ${styles.attenteVide}`} data-testid="attente-carte">
            <span className="sr-only">…</span>
            <Attente muet>
              <Barre largeur="longue" />
            </Attente>
          </div>
        )}
      </div>

      {films ? (
        <ul className={styles.bande} aria-label={`Les films de ${nom}`}>
          {casesBande(films, masquerIntrouvables).map(({ film, etat: etatCase }) => (
            <li key={film.tmdb_id} aria-label={`${film.title}, ${DESCRIPTION_CASE[etatCase]}`} data-etat={etatCase} className={styles.case}>
              <span className={styles.afficheCase}>
                <AfficheSuivi film={film} />
                {etatCase === 'vu' ? <IconCheck className={styles.coche} aria-hidden="true" /> : null}
                {etatCase === 'introuvable' ? (
                  <span className={styles.perdu} aria-hidden="true">
                    perdu
                  </span>
                ) : null}
              </span>
              <span className={styles.anneeCase} aria-hidden="true">
                {film.year ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {bouclee ? <p className={styles.bandeau}>Complet</p> : null}
      {prochain ? (
        <p className={styles.suite}>
          ensuite <b>{prochain.year != null ? `${prochain.title} (${prochain.year})` : prochain.title}</b>
        </p>
      ) : null}
      {ligneDeCloture ? <p className={styles.suite}>{ligneDeCloture}</p> : null}
    </li>
  )
}

/** « 2 séances sur 4 » : les cases visibles de la planche, celles de `casesBande`. */
function Compte({ films, masquerIntrouvables }: { films: FilmSaga[]; masquerIntrouvables: boolean }) {
  const { vus, total } = compteCarte('sagas', films, masquerIntrouvables)
  return (
    <p className={styles.seances}>
      <b>{vus}</b> {vus > 1 ? 'séances' : 'séance'} sur {total}
    </p>
  )
}
