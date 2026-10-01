import styles from './Ampoules.module.css'

const MOIS = [
  { court: 'JAN', long: 'janvier' },
  { court: 'FÉV', long: 'février' },
  { court: 'MAR', long: 'mars' },
  { court: 'AVR', long: 'avril' },
  { court: 'MAI', long: 'mai' },
  { court: 'JUIN', long: 'juin' },
  { court: 'JUIL', long: 'juillet' },
  { court: 'AOÛT', long: 'août' },
  { court: 'SEP', long: 'septembre' },
  { court: 'OCT', long: 'octobre' },
  { court: 'NOV', long: 'novembre' },
  { court: 'DÉC', long: 'décembre' },
]

/** Au-delà, la colonne n'a plus de place : le vrai compte reste imprimé au-dessus. */
export const AMPOULES_VISIBLES = 11

const logements = Array.from({ length: AMPOULES_VISIBLES }, (_, rang) => rang)

/**
 * Les douze mois de l'année en colonnes d'ampoules : une ampoule allumée par film, de bas en haut,
 * les logements vides restant visibles au-dessus. Le mois courant est souligné dans la couleur du membre.
 */
export default function Ampoules({ annee, comptes, moisCourant }: { annee: number; comptes: readonly number[]; moisCourant: number }) {
  const description = MOIS.map((mois, indice) => `${mois.long} ${comptes[indice]}`).join(', ')
  return (
    <div className={styles.panneau} role="img" aria-label={`Films par mois en ${annee} : ${description}`}>
      <ul className={styles.colonnes} aria-hidden="true">
        {MOIS.map((mois, indice) => {
          const compte = comptes[indice] ?? 0
          return (
            <li key={mois.court} className={styles.colonne} data-courant={indice === moisCourant ? '' : undefined}>
              <span className={styles.compte} data-vide={compte === 0 ? '' : undefined}>
                {compte}
              </span>
              <span className={styles.ampoules}>
                {/* Du haut vers le bas : l'ampoule de rang `r` en partant du bas brille si le mois compte plus de `r` films. */}
                {logements.map((rang) => (
                  <span key={rang} className={styles.ampoule} data-allumee={AMPOULES_VISIBLES - 1 - rang < compte ? '' : undefined} />
                ))}
              </span>
              <span className={styles.mois}>{mois.court}</span>
              <span className={styles.trait} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
