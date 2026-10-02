import type { CSSProperties } from 'react'
import Attente from '../ui/Attente'
import perforations from './Perforations.module.css'
import tickets from './Tickets.module.css'
import Section from './Section'
import styles from './SectionsEnAttente.module.css'

/** La longueur de trois billets, du plus posé au moins posé : la part de chacun dans le plus long. */
const PARTS_DE_BILLETS = [1, 0.7, 0.45]

/**
 * Les quatre sections du profil avant que le journal entier ne soit arrivé : leurs vrais titres, et
 * à la place de chaque graphique un objet éteint de sa hauteur. Le journal vide ou en échec n'en
 * montre aucun, comme avant. Les sections restent lisibles : le seul `role="status"` est celui des
 * notes, les autres zones sont muettes, et toutes respirent en même temps.
 */
export default function SectionsEnAttente({ annee }: { annee: number }) {
  return (
    <>
      <Section titre="Notes">
        <Attente className={styles.objets}>
          <div className={styles.panneau} data-testid="objet-en-attente">
            <div className={styles.cadran} />
            <div className={styles.lecture} />
          </div>
          <div className={styles.panneau} data-testid="objet-en-attente">
            <div className={styles.diodes} />
          </div>
        </Attente>
      </Section>

      <Section titre="Réactions">
        <Attente muet>
          <ul className={tickets.liste} data-testid="objet-en-attente">
            {PARTS_DE_BILLETS.map((part) => (
              <li key={part} className={tickets.ticket} style={{ '--part': part } as CSSProperties}>
                <span className={tickets.papier} />
              </li>
            ))}
          </ul>
        </Attente>
      </Section>

      <Section titre="Décennies">
        <Attente muet>
          <div className={perforations.bande} data-testid="objet-en-attente">
            <div className={styles.perforations} />
          </div>
        </Attente>
      </Section>

      <Section titre={`Mois · ${annee}`}>
        <Attente muet>
          <div className={styles.panneauVisse} data-testid="objet-en-attente">
            <div className={styles.ampoules} />
          </div>
        </Attente>
      </Section>
    </>
  )
}
