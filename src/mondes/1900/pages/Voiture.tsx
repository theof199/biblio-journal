import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { FilmDeSalle } from '../../../api/voyage'
import { useDialogue } from '../../../voyage/dialogue'
import { dureeLisible } from '../../../voyage/film'
import type { PropsSalle } from '../../../voyage/salles/Salle'
import { compteDeLaSalle, contexteLisible, etiquetteEtat, porteDeLEtagere } from '../../../voyage/salles'
import { imageDu1900 } from '../images'
import Rubrique from './Rubrique'
import { MOTS_DES_VOIES, lettreDuCompartiment, mentionDeLaVoie, phraseDeLaVoiture, plaqueDuCompartiment } from './voies'
import styles from './Voies.module.css'

/** Un compartiment : l'affiche à sa fenêtre, le film, sa lettre, son état, et sa plaque. Il ouvre la fiche du film. */
function Compartiment({ film, annee, perdu }: { film: FilmDeSalle; annee: number; perdu: string }) {
  const etiquette = etiquetteEtat(film.etat, perdu)
  const etat = film.etat === 'vu' && film.note !== null ? `${etiquette} · ${film.note}/10` : etiquette
  const plaque = plaqueDuCompartiment(film.etat, perdu)
  const place = `compartiment ${lettreDuCompartiment(film.rang)}`
  return (
    <li>
      <Link to={`/voyage/${annee}/films/${film.id}`} className={styles.compartiment} aria-label={`${film.title}, ${etat}`}>
        {film.cover_url ? <img className={styles.fenetre} src={film.cover_url} alt="" loading="lazy" decoding="async" /> : <span className={`${styles.fenetre} ${styles.vide}`}>{MOTS_DES_VOIES.sansAffiche}</span>}
        <span className={styles.film}>
          {film.title}
          <small>{film.year !== null ? `${film.year} · ${place}` : place}</small>
          <small>{etat}</small>
        </span>
        <span className={`${styles.plaque} ${plaque.occupe ? styles.occupe : ''}`} aria-hidden="true">
          {plaque.mot}
        </span>
      </Link>
      {film.programme ? (
        <div className={styles.bobines}>
          <p>{`${MOTS_DES_VOIES.programme} · ${dureeLisible(film.programme.duree_min)}`}</p>
          <ul aria-label={`Les bobines de ${film.title}`}>
            {film.programme.bobines.map((b) => (
              <li key={b.tmdb_id}>
                {b.title}
                <small>{`${dureeLisible(b.duree_min)} · ${etiquetteEtat(b.etat, perdu)}`}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}

/**
 * La voiture d'une salle, ouverte par-dessus la gare (maquette, écran 4) : la vue prise d'un train
 * en marche, le panneau de la voiture, sa raison d'être (qui ouvre le contexte quand il se lit), puis
 * sa composition, un compartiment par film, les bobines d'un programme, et la porte au bout (« En
 * voir plus » au compte IA, la voiture qui se remplit, la salle épuisée). Un dialogue comme la feuille
 * du chroniqueur : il prend le focus, se ferme à Échap et au geste « retour ». Rien n'y bouge.
 */
export default function Voiture({ monde, annee, salle, ia, numero, onContexte, onFermer, fournee }: PropsSalle) {
  const fermer = useDialogue<HTMLButtonElement>(onFermer)
  const id = useId()
  const photo = imageDu1900('fenetre-train')
  const perdu = monde.pages.mots.introuvable
  const porte = porteDeLEtagere(salle, ia)
  const mention = mentionDeLaVoie(salle, fournee.abandon)
  const phrase = phraseDeLaVoiture(salle)
  return (
    <div className={styles.voiture} role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className={styles.colonne}>
        <div className={styles.tete}>
          <div className={styles.photo} role="img" aria-label={MOTS_DES_VOIES.photo} style={photo ? { backgroundImage: `url(${photo})` } : undefined} />
          <button ref={fermer} type="button" className={styles.retour} aria-label={MOTS_DES_VOIES.fermer} onClick={onFermer}>
            <span aria-hidden="true">‹</span>
          </button>
        </div>
        <div className={styles.panneau}>
          <small>{mention ? `Voie ${numero} · ${mention}` : `Voie ${numero}`}</small>
          <h2 id={id}>{salle.nom}</h2>
        </div>
        {contexteLisible(salle, ia) ? (
          <button type="button" className={styles.raison} onClick={onContexte}>
            {salle.raison_d_etre}
            <span>Le contexte de la salle ›</span>
          </button>
        ) : (
          <p className={styles.raison}>{salle.raison_d_etre}</p>
        )}

        <Rubrique balise="p">
          {MOTS_DES_VOIES.composition}
          <small>{compteDeLaSalle(salle)}</small>
        </Rubrique>
        <ul className={styles.coupe} aria-label={`Les compartiments de la voiture ${salle.nom}`}>
          {salle.films.map((f) => (
            <Compartiment key={f.id} film={f} annee={annee} perdu={perdu} />
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
        {phrase ? <p className={styles.phrase}>{phrase}</p> : null}

        {fournee.erreur ? (
          <p role="alert" className={styles.message}>
            {fournee.erreur}
          </p>
        ) : null}
        {fournee.abandon ? (
          <div role="alert" className={styles.message}>
            <p>Le chroniqueur n’a pas répondu, reviens plus tard.</p>
            <button type="button" className={styles.porte} onClick={fournee.reessayer}>
              Réessayer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
