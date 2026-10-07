import { Link } from 'react-router-dom'
import type { FilmSeance } from '../../../api/voyage'
import { useMouvementReduit } from '../../../ui/mouvement'
import type { EtatBillet } from '../../../voyage/annee/retour'
import { etiquetteEtat } from '../../../voyage/salles'
import { billetDuMorceau, ligneDeSeancePassee } from '../../../voyage/seance'
import type { PropsProspectus } from '../../../voyage/seance/Prospectus'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { MOTS_DU_SOIR } from './classes'
import Rubrique from './Rubrique'
import { MOTS_DES_VOIES } from './voies'
import styles from './Soir.module.css'

/**
 * Le train du soir, à la place de la séance (maquette, écran 17 : `.plaisir`) : une affichette de
 * train de plaisir, le long en voiture et le court en tête, l'anecdote du trajet, les quatre talons
 * et le tampon « Prise » ; « Composer une séance » tant qu'aucune n'est à l'affiche ; les séances
 * passées, repliées. La page décide qui le voit, tient chaque écriture et son verrou : rien ne se
 * redécide ici. Le wagon-restaurant de la maquette (la séance à deux) n'y est pas.
 *
 * Seul le tampon bouge, quand la séance vient d'être prise, et jamais au calme.
 */
export default function TrainDuSoir({ monde, annee, zone, carte, passees, composer, guet, talons }: PropsProspectus) {
  const m = monde.pages.mots
  const calme = useMouvementReduit()
  return (
    <section className={styles.soir} aria-label={`${m.seance.titre} ${m.seance.sous}`} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <Rubrique balise="p">
        {m.seance.titre}
        <small>{`${m.seance.sous} de ${annee}`}</small>
      </Rubrique>

      {zone === 'bouton' ? (
        <>
          <button type="button" className={styles.action} onClick={composer.lancer} disabled={composer.occupe}>
            {MOTS_DU_SOIR.composer}
          </button>
          {composer.erreur ? (
            <p role="alert" className={styles.message}>
              {composer.erreur}
            </p>
          ) : null}
        </>
      ) : zone === 'en_cours' ? (
        <div className={styles.plaisir}>
          <p className={styles.gros}>
            {MOTS_DU_SOIR.affiche}
            <small>{MOTS_DU_SOIR.enComposition}</small>
          </p>
          {guet.abandon ? (
            <div role="alert" className={styles.attente}>
              <p>{guet.message}</p>
              <button type="button" className={styles.talon} onClick={guet.reessayer}>
                Réessayer
              </button>
            </div>
          ) : (
            <p role="status" className={styles.attente}>
              {MOTS_DU_SOIR.compose}
            </p>
          )}
        </div>
      ) : carte ? (
        <article className={styles.plaisir} aria-label={`Séance n° ${carte.rang}`}>
          <p className={styles.gros}>
            {MOTS_DU_SOIR.affiche}
            <small>{MOTS_DU_SOIR.heure}</small>
          </p>
          <div className={styles.num}>
            <span>{`Séance n° ${carte.rang}`}</span>
            <span>{MOTS_DU_SOIR.entree}</span>
          </div>
          <Partie annee={annee} role={MOTS_DU_SOIR.long} film={carte.long} introuvable={m.introuvable} />
          {carte.court ? <Partie annee={annee} role={MOTS_DU_SOIR.court} film={carte.court} introuvable={m.introuvable} /> : null}
          <p className={styles.entracte}>
            <span>{MOTS_DU_SOIR.trajet}</span>
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
          {carte.statut === 'prise' ? (
            <span className={styles.pris} data-frappe={talons.frappe ? 'oui' : 'non'}>
              {MOTS_DU_SOIR.prise}
            </span>
          ) : null}
          {talons.erreur ? (
            <p role="alert" className={styles.message}>
              {talons.erreur}
            </p>
          ) : null}
          <div className={`${styles.num} ${styles.pied}`}>
            <span>{MOTS_DU_SOIR.rendre}</span>
            <span>{`Talon n° ${carte.rang}`}</span>
          </div>
        </article>
      ) : null}

      {passees.length > 0 ? (
        <details className={styles.passees}>
          <summary>{MOTS_DU_SOIR.passees}</summary>
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

/** Un morceau du train : son affiche, sa place dans le train, son titre, sa salle et son état ; « Je l’ai vu » s'il ne l'est pas. */
function Partie({ annee, role, film, introuvable }: { annee: number; role: string; film: FilmSeance; introuvable: string }) {
  return (
    <div className={styles.partie}>
      {film.cover_url ? <img className={styles.affiche} src={film.cover_url} alt="" decoding="async" /> : <span className={`${styles.affiche} ${styles.sansAffiche}`}>{MOTS_DES_VOIES.sansAffiche}</span>}
      <div>
        <small>{role}</small>
        <b>{film.title}</b>
        <em>{`${film.salle} · ${etiquetteEtat(film.etat, introuvable)}`}</em>
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
