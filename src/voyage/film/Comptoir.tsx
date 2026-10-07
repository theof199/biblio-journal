import { Link } from 'react-router-dom'
import type { JournalItem } from '../../api/journal'
import type { FilmDeSalle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import type { BoutonDuFilm, GesteDuGuichet } from '../film'
import styles from './Guichet.module.css'

/**
 * Ce que reçoit le dessin du guichet de la fiche d'un film, par défaut ou du monde
 * (`GabaritsDesPages.guichetDuFilm`). `Guichet` garde ce qui écrit et ce qui s'ouvre : la mutation et
 * son verrou, le feuillet du podium, les adresses du billet. Le dessin rend les gestes de `boutons`,
 * dans leur ordre, sans en ajouter ni en retirer, puis « Le film », toujours.
 */
export interface PropsComptoir {
  monde: Monde
  film: FilmDeSalle
  /** Les gestes offerts (`boutonsDuFilm`) : « Corriger » n'y est qu'avec une entrée, « Je l’ai vu » que pour un film à voir. */
  boutons: readonly BoutonDuFilm[]
  /** Où mènent « Je l’ai vu » (la bobine qui reste à voir comprise) et « Corriger ». */
  billet: { vu: string; corriger: string }
  /** Mon dernier visionnage : il part dans l'état de navigation de la correction. */
  entree: JournalItem | undefined
  /** Une écriture est en vol : les gestes qui écrivent se désactivent. */
  occupe: boolean
  /** Le refus de l'API, tel qu'elle l'a écrit ; nul sinon. */
  erreur: string | null
  onEcrire: (geste: GesteDuGuichet) => void
  onPodium: () => void
  /** « Le film » : la feuille du chroniqueur. */
  onFilm: () => void
}

/** Le guichet par défaut (maquette 1890 : `initFilm`, `.guichet-zone`) : le billet corail, la plaque de laiton, le filet or, le texte discret. */
export default function Comptoir({ monde, film, boutons, billet, entree, occupe, erreur, onEcrire, onPodium, onFilm }: PropsComptoir) {
  // Le geste qui mène au billet porte le nom que le monde lui donne.
  const mots = monde.pages.mots.billet
  return (
    <div className={styles.guichet}>
      {boutons.map((b) => {
        switch (b) {
          case 'corriger':
            return (
              <Link key={b} to={billet.corriger} state={{ item: entree }} className={styles.ticket}>
                <span>
                  <b>Corriger</b>
                  <small>ta note, tes réactions</small>
                </span>
                <span className={styles.talon} aria-hidden="true">
                  {film.note !== null ? `${film.note}/10` : 'VU'}
                </span>
              </Link>
            )
          case 'plex':
            return (
              <a key={b} href={film.plex_url ?? undefined} target="_blank" rel="noreferrer" className={styles.laiton}>
                <i aria-hidden="true" />
                Voir sur le Plex
              </a>
            )
          case 'vu':
            return (
              <Link key={b} to={billet.vu} className={styles.ticket}>
                <span>
                  <b>{mots.ouvrir}</b>
                  <small>{mots.ouvrirSous}</small>
                </span>
                <span className={styles.talon} aria-hidden="true">
                  VU ?
                </span>
              </Link>
            )
          case 'demander':
            return (
              <button key={b} type="button" className={styles.filet} disabled={occupe} onClick={() => onEcrire('demander')}>
                Demander sur Sir
              </button>
            )
          case 'introuvable':
            return (
              <button key={b} type="button" className={styles.gris} disabled={occupe} onClick={() => onEcrire('introuvable')}>
                Introuvable
              </button>
            )
          case 'remettre':
            return (
              <button key={b} type="button" className={styles.gris} disabled={occupe} onClick={() => onEcrire('remettre')}>
                Le remettre à voir
              </button>
            )
          case 'podium':
            return (
              <button key={b} type="button" className={styles.laiton} onClick={onPodium}>
                <i aria-hidden="true" />
                Mettre sur le podium
              </button>
            )
        }
      })}
      {film.etat === 'demande' ? <p className={styles.note}>demandé</p> : null}
      {erreur ? (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      ) : null}
      <button type="button" className={styles.filet} onClick={onFilm}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="6.5" r="2" />
          <circle cx="12" cy="17.5" r="2" />
          <circle cx="6.5" cy="12" r="2" />
          <circle cx="17.5" cy="12" r="2" />
        </svg>
        Le film
      </button>
    </div>
  )
}
