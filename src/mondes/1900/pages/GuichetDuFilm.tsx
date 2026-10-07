import type { PropsComptoir } from '../../../voyage/film/Comptoir'
import Action from './Action'
import { MOTS_DE_LA_SEANCE as M } from './hale'
import styles from './Hale.module.css'

/**
 * Le guichet de la fiche d'un film des années 1900 (maquette, écran 5 : `.bout-action`) : le bouton
 * corail pour ce qui mène au billet (« Composter une séance », le mot du monde, ou « Corriger »), la
 * plaque de laiton pour le Plex et le podium, le filet pour la demande et « Le film », le texte
 * discret pour « Introuvable » et son inverse. `Guichet` décide des gestes offerts, tient les
 * écritures et leur verrou : le dessin les rend dans l'ordre reçu, sans en ajouter. Rien n'y bouge.
 */
export default function GuichetDuFilm({ monde, film, boutons, billet, entree, occupe, erreur, onEcrire, onPodium, onFilm }: PropsComptoir) {
  const mots = monde.pages.mots.billet
  return (
    <div className={styles.guichet}>
      {boutons.map((b) => {
        switch (b) {
          case 'corriger':
            return (
              <Action key={b} vers={billet.corriger} etat={{ item: entree }} sous={M.corrigerSous}>
                {M.corriger}
              </Action>
            )
          case 'vu':
            return (
              <Action key={b} vers={billet.vu} sous={mots.ouvrirSous}>
                {mots.ouvrir}
              </Action>
            )
          case 'plex':
            return (
              <a key={b} href={film.plex_url ?? undefined} target="_blank" rel="noreferrer" className={styles.plaque}>
                {M.plex}
              </a>
            )
          case 'podium':
            return (
              <button key={b} type="button" className={styles.plaque} onClick={onPodium}>
                {M.podium}
              </button>
            )
          case 'demander':
            return (
              <button key={b} type="button" className={styles.filet} disabled={occupe} onClick={() => onEcrire('demander')}>
                {M.demander}
              </button>
            )
          case 'introuvable':
            return (
              <button key={b} type="button" className={styles.discret} disabled={occupe} onClick={() => onEcrire('introuvable')}>
                {M.introuvable}
              </button>
            )
          case 'remettre':
            return (
              <button key={b} type="button" className={styles.discret} disabled={occupe} onClick={() => onEcrire('remettre')}>
                {M.remettre}
              </button>
            )
        }
      })}
      {film.etat === 'demande' ? <p className={styles.demande}>{M.demande}</p> : null}
      {erreur ? (
        <p role="alert" className={styles.refus}>
          {erreur}
        </p>
      ) : null}
      <button type="button" className={styles.filet} onClick={onFilm}>
        {M.film}
      </button>
    </div>
  )
}
