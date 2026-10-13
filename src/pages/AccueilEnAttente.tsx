import Attente from '../ui/Attente'
import FrontonEnAttente from '../accueil/FrontonEnAttente'
import PelliculeEnAttente from '../accueil/PelliculeEnAttente'
import EnteteDuJournal from './EnteteDuJournal'
import styles from './Accueil.module.css'

/** Les mois laissés en blanc sous l'en-tête du journal. */
const MOIS = 2

/** L'entrée avant le journal : un fronton éteint, qui porte le seul `role="status"` de l'attente du journal. */
export function EntreeEnAttente() {
  return (
    <Attente>
      <FrontonEnAttente />
    </Attente>
  )
}

/**
 * Le journal avant ses entrées : son en-tête réel (son titre et son lien ne dépendent d'aucune
 * donnée) et deux pellicules en blanc, muettes, qui respirent en même temps que le fronton.
 */
export function JournalEnAttente({ compte = null }: { compte?: string | null }) {
  return (
    <section className={styles.journal} aria-labelledby="titre-journal">
      <EnteteDuJournal compte={compte} />
      <Attente muet className={styles.pellicules}>
        {Array.from({ length: MOIS }, (_, mois) => (
          <PelliculeEnAttente key={mois} />
        ))}
      </Attente>
    </section>
  )
}

/**
 * L'accueil avant sa session (`session/RouteProtegee.tsx`) : le cadre de la page, l'entrée et le
 * journal en blanc. Ni éventail ni bande du Voyage, qui n'apparaissent que si leurs données le
 * permettent, ni section « Au ciné », qui ne se monte qu'avec ses requêtes, ni bouton flottant.
 * L'accueil connecté qui attend son journal reprend les deux mêmes pièces autour de la section.
 */
export default function AccueilEnAttente({ compte = null }: { compte?: string | null }) {
  return (
    <div className={styles.fond}>
      <div className={styles.page}>
        <div className={styles.entree}>
          <EntreeEnAttente />
        </div>
        <div className={styles.colonneJournal}>
          <JournalEnAttente compte={compte} />
        </div>
      </div>
    </div>
  )
}
