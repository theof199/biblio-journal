import Attente from '../ui/Attente'
import FrontonEnAttente from '../accueil/FrontonEnAttente'
import PelliculeEnAttente from '../accueil/PelliculeEnAttente'
import EnteteDuJournal from './EnteteDuJournal'
import styles from './Accueil.module.css'

/** Les mois laissés en blanc sous l'en-tête du journal. */
const MOIS = 2

/**
 * L'accueil avant son journal : le cadre de la page, un fronton éteint, l'en-tête réel du journal
 * (son titre et son lien ne dépendent d'aucune donnée) et deux pellicules en blanc. Ni éventail ni
 * bande du Voyage, qui n'apparaissent que si leurs données le permettent, ni bouton flottant. Le
 * fronton porte le seul `role="status"` ; les pellicules, muettes, respirent en même temps que lui.
 */
export default function AccueilEnAttente({ compte = null }: { compte?: string | null }) {
  return (
    <div className={styles.fond}>
      <div className={styles.page}>
        <div className={styles.entree}>
          <Attente>
            <FrontonEnAttente />
          </Attente>
        </div>
        <div className={styles.colonneJournal}>
          <section className={styles.journal} aria-labelledby="titre-journal">
            <EnteteDuJournal compte={compte} />
            <Attente muet className={styles.pellicules}>
              {Array.from({ length: MOIS }, (_, mois) => (
                <PelliculeEnAttente key={mois} />
              ))}
            </Attente>
          </section>
        </div>
      </div>
    </div>
  )
}
