import { Link } from 'react-router-dom'
import type { FilmDeSalle, Salle as SalleDeLAnnee } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { ampoules, compteDeLaSalle, contexteLisible, etiquetteEtat, porteDeLEtagere, salleComplete } from '../salles'
import { useFournee } from './useFournee'
import styles from './Salle.module.css'

interface Props {
  monde: Monde
  annee: number
  salle: SalleDeLAnnee
  ia: boolean
  /** Ouvre la feuille du chroniqueur sur le contexte de cette salle. */
  onContexte: () => void
}

/** Le traitement des affiches du monde, par `filter` CSS : jamais une lecture de pixels. */
const TRAITEMENT = { sepia: styles.sepia, gris: styles.gris, couleur: '' } as const

/** Une affiche de l'étagère (maquette 1890 : `cabHTML`) : l'état se voit sans lire, et se lit sous le titre. */
function Affiche({ film, annee, monde }: { film: FilmDeSalle; annee: number; monde: Monde }) {
  const perdu = monde.pages.mots.introuvable
  const etiquette = etiquetteEtat(film.etat, perdu)
  const etat = film.etat === 'vu' && film.note !== null ? `${etiquette} · ${film.note}/10` : etiquette
  return (
    <li>
      <Link
        to={`/voyage/${annee}/films/${film.id}`}
        className={`${styles.cab} ${film.etat === 'introuvable' ? styles.perdu : ''}`}
        aria-label={`${film.title}, ${etat}`}
      >
        {film.cover_url ? <img src={film.cover_url} alt="" loading="lazy" decoding="async" /> : <span className={styles.sansImage} />}
        {film.etat === 'vu' && film.note !== null ? (
          <span className={styles.tamponNote} aria-hidden="true">
            {film.note}
          </span>
        ) : film.etat === 'sur_le_plex' ? (
          <span className={styles.emaille} aria-hidden="true">
            PLEX
          </span>
        ) : film.etat === 'demande' ? (
          <span className={styles.etiquette} aria-hidden="true">
            {etiquette}
          </span>
        ) : film.etat === 'introuvable' ? (
          <span className={styles.tamponPerdu} aria-hidden="true">
            {perdu}
          </span>
        ) : null}
        <span className={styles.t}>{film.title}</span>
        <span className={styles.e}>{etat}</span>
      </Link>
    </li>
  )
}

/**
 * Une salle de l'année en baraque (maquette 1890 : `salleHTML`, styles 177 à 198) : l'auvent et son
 * enseigne, une ampoule par film, le tampon « COMPLET » ; la raison d'être, qui ouvre le contexte
 * quand il se lit ; le compte ; l'étagère d'affiches, fermée par sa porte.
 */
export default function Salle({ monde, annee, salle, ia, onContexte }: Props) {
  const complete = salleComplete(salle)
  const porte = porteDeLEtagere(salle, ia)
  const fournee = useFournee(annee, salle)

  return (
    <section className={`${styles.salle} ${complete ? styles.complete : ''}`} aria-label={`Salle ${salle.nom}`}>
      <div className={styles.auvent}>
        <h2 className={styles.enseigne}>{salle.nom}</h2>
        <div className={styles.ampoules} aria-hidden="true">
          {ampoules(salle).map((allumee, i) => (
            <i key={i} className={allumee ? styles.on : undefined} data-allumee={allumee} />
          ))}
        </div>
        {complete ? <span className={styles.complet}>COMPLET</span> : null}
      </div>

      <div className={styles.infos}>
        {contexteLisible(salle, ia) ? (
          <button type="button" className={styles.raison} onClick={onContexte}>
            {salle.raison_d_etre}
            <span>Le contexte de la salle ›</span>
          </button>
        ) : (
          <p className={styles.raison}>{salle.raison_d_etre}</p>
        )}
        <span className={styles.compte}>{compteDeLaSalle(salle)}</span>
      </div>

      <ul className={`${styles.rayon} ${TRAITEMENT[monde.traitement.affiches]}`} aria-label={`L’étagère de la salle ${salle.nom}`}>
        {salle.films.map((f) => (
          <Affiche key={f.id} film={f} annee={annee} monde={monde} />
        ))}
        {porte ? (
          <li>
            {porte.geste ? (
              <button type="button" className={styles.porte} onClick={fournee.demander}>
                {porte.texte}
              </button>
            ) : (
              <span className={`${styles.porte} ${styles.close}`}>{porte.texte}</span>
            )}
          </li>
        ) : null}
      </ul>

      {fournee.erreur ? (
        <p role="alert" className={styles.message}>
          {fournee.erreur}
        </p>
      ) : null}
      {fournee.abandon ? (
        <div role="alert" className={styles.message}>
          <p>Le chroniqueur n’a pas répondu, reviens plus tard.</p>
          <button type="button" className={styles.reessayer} onClick={fournee.reessayer}>
            Réessayer
          </button>
        </div>
      ) : null}
    </section>
  )
}
