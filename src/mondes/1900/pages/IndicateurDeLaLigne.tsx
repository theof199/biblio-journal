import { Link } from 'react-router-dom'
import type { PropsRegistre } from '../../../voyage/decennie/Registre'
import { MOTS_DE_LA_LIGNE as M, etatDeLArret, heureDeLArret, lieuDeLArret } from './ligne'
import Rubrique from './Rubrique'
import styles from './Ligne.module.css'

/**
 * L'indicateur de la ligne (maquette, écran 1 : `.indicateur-l`, `.arret`), à la place du registre :
 * un arrêt par année, l'année en heure, le lieu de sa photographie, son état. Un arrêt qui a sa page
 * en est le lien, et lui seul : c'est le chemin du clavier et du lecteur d'écran. Il ne compte rien
 * (`arrets`) ; ni les films vus ni la meilleure note du registre n'y sont dits.
 */
export default function IndicateurDeLaLigne({ monde, lignes, depart, tropLent, rattrape }: PropsRegistre) {
  const m = monde.pages.mots
  return (
    <section aria-label={m.decennie.registre}>
      <Rubrique>
        {m.decennie.registre} <small>{M.sous}</small>
      </Rubrique>
      <ol className={styles.arrets} aria-label={M.liste}>
        {lignes.map((l) => {
          const etat = etatDeLArret(l, depart, m)
          const contenu = (
            <>
              <span className={styles.rail} aria-hidden="true" />
              <span className={styles.heure}>
                <span aria-hidden="true">{heureDeLArret(l.annee)}</span>
                <span className={styles.lu}>{l.annee}</span>
              </span>
              <span className={styles.lieu}>{lieuDeLArret(l, { depart, tropLent, rattrape, enAvance: m.fermee.enAvance })}</span>
              <span className={styles.etat}>{etat}</span>
            </>
          )
          const sorte = l.enCours ? 'ici' : l.bouclee ? 'passee' : 'fermee'
          return (
            <li key={l.annee}>
              {l.ouvrable ? (
                <Link to={`/voyage/${l.annee}`} className={styles.arret} data-arret={sorte} aria-current={l.enCours ? 'step' : undefined}>
                  {contenu}
                </Link>
              ) : (
                <div className={styles.arret} data-arret={sorte}>
                  {contenu}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
