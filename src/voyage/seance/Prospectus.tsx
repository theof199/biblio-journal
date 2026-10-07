import { Link } from 'react-router-dom'
import type { FilmSeance, Seance as SeanceDeLAnnee } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import type { EtatBillet } from '../annee/retour'
import { etiquetteEtat } from '../salles'
import { billetDuMorceau, ligneDeSeancePassee, type ZoneSeance } from '../seance'
import styles from './Seance.module.css'

/**
 * Ce que reçoit la séance du soir, par défaut ou du monde (`GabaritsDesPages.seance`). `Seance` garde
 * les écritures, leur garde contre le double toucher, le guet d'une composition et le feuillet des
 * remplacements : le dessin n'en reçoit que l'état et les gestes.
 */
export interface PropsProspectus {
  monde: Monde
  annee: number
  /** Ce que la zone montre : le bouton, la composition en cours, la séance proposée, la séance prise. */
  zone: ZoneSeance
  /** La séance à l'affiche, proposée ou prise ; nulle dans les deux autres zones. */
  carte: SeanceDeLAnnee | null
  /** Les séances passées, de la plus récente à la plus ancienne. */
  passees: readonly SeanceDeLAnnee[]
  /** « Composer une séance » : le geste, l'envoi en vol, et ce qui a échoué (un refus, ou une composition sans séance). */
  composer: { lancer: () => void; occupe: boolean; erreur: string | null }
  /** Le guet d'une composition : abandonné au plafond, il dit pourquoi et s'offre de nouveau. */
  guet: { abandon: boolean; message: string | null; reessayer: () => void }
  /**
   * Les quatre talons d'une séance à l'affiche, chacun gardé par la page contre le double toucher ;
   * `frappe` : la séance vient d'être prise sous les yeux du membre.
   */
  talons: { prendre: () => void; ignorer: () => void; autreLong: () => void; autreCourt: () => void; erreur: string | null; frappe: boolean }
}

/**
 * « Ce soir à la baraque » par défaut (maquette 1890 : `seance`, styles 207 à 225 ; portée de
 * `BlocSeance`, `AnneeScreen.kt`) : « Composer une séance », le prospectus d'attente, ou le prospectus
 * de la séance et ses talons ; les séances passées, repliées.
 */
export default function Prospectus({ monde, annee, zone, carte, passees, composer, guet, talons }: PropsProspectus) {
  const m = monde.pages.mots
  return (
    <section aria-label={`${m.seance.titre} ${m.seance.sous}`}>
      <p className={styles.titreSec}>
        {m.seance.titre} <small>{m.seance.sous}</small>
      </p>

      {zone === 'bouton' ? (
        <div className={styles.composer}>
          <button type="button" className={styles.bouton} onClick={composer.lancer} disabled={composer.occupe}>
            Composer une séance
          </button>
          {composer.erreur ? (
            <p role="alert" className={styles.message}>
              {composer.erreur}
            </p>
          ) : null}
        </div>
      ) : zone === 'en_cours' ? (
        <div className={styles.papier}>
          <p className={styles.gros}>
            Grande séance<small>en composition</small>
          </p>
          {guet.abandon ? (
            <div role="alert">
              <p className={styles.texte}>{guet.message}</p>
              <button type="button" className={styles.bouton} onClick={guet.reessayer}>
                Réessayer
              </button>
            </div>
          ) : (
            <p role="status" className={`${styles.texte} ${styles.plume}`}>
              Le chroniqueur compose la séance…
            </p>
          )}
        </div>
      ) : carte ? (
        <article className={`${styles.papier} ${styles.seance}`} aria-label={`Séance n° ${carte.rang}`}>
          <p className={styles.gros}>
            Grande séance<small>ce soir à 8 h ½</small>
          </p>
          <div className={styles.num}>
            <span>{`Séance n° ${carte.rang}`}</span>
            <span>Entrée libre</span>
          </div>
          <Partie monde={monde} annee={annee} role="Le long" film={carte.long} />
          {carte.court ? <Partie monde={monde} annee={annee} role="En ouverture" film={carte.court} /> : null}
          <p className={styles.entracte}>
            <span>Pendant le générique</span>
            {carte.anecdote}
          </p>
          <div className={styles.talons}>
            {carte.statut === 'proposee' ? (
              <button type="button" className={`${styles.talon} ${styles.plein}`} onClick={talons.prendre}>
                Prendre
              </button>
            ) : null}
            <button type="button" className={styles.talon} onClick={talons.ignorer}>
              Ignorer
            </button>
            <button type="button" className={styles.talon} onClick={talons.autreLong}>
              Autre long
            </button>
            <button type="button" className={styles.talon} onClick={talons.autreCourt}>
              Autre court
            </button>
          </div>
          {carte.statut === 'prise' ? <span className={`${styles.tampon} ${talons.frappe ? styles.frappe : ''}`}>PRISE</span> : null}
          {talons.erreur ? (
            <p role="alert" className={styles.erreur}>
              {talons.erreur}
            </p>
          ) : null}
          <div className={`${styles.num} ${styles.pied}`}>
            <span>À rendre avant minuit</span>
            <span>{`Talon n° ${carte.rang}`}</span>
          </div>
        </article>
      ) : null}

      {passees.length > 0 ? (
        // « Séances passées » : le long et la date, repliés.
        <details className={styles.passees}>
          <summary>Séances passées</summary>
          <ul>
            {passees.map((s) => (
              <li key={s.id}>{ligneDeSeancePassee(s)}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

/** Un morceau de la séance : son affiche, son rôle, son titre, sa salle et son état ; « Je l’ai vu » s'il ne l'est pas. */
function Partie({ monde, annee, role, film }: { monde: Monde; annee: number; role: string; film: FilmSeance }) {
  const etat = etiquetteEtat(film.etat, monde.pages.mots.introuvable)
  return (
    <div className={styles.partie}>
      <span className={styles.cab}>{film.cover_url ? <img src={film.cover_url} alt="" decoding="async" /> : <span className={styles.sansImage} />}</span>
      <div>
        <span className={styles.role}>{role}</span>
        <b>{film.title}</b>
        <small>{`${film.salle} · ${etat}`}</small>
        {film.etat !== 'vu' ? (
          // L'année est derrière le billet : il y reculera au lieu de l'empiler une seconde fois.
          <Link to={billetDuMorceau(annee, film)} state={{ depuis: 'annee' } satisfies EtatBillet} className={styles.vu} aria-label={`Je l’ai vu : ${film.title}`}>
            Je l’ai vu
          </Link>
        ) : null}
      </div>
    </div>
  )
}
