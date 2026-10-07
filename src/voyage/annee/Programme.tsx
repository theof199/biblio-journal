import type { Progression, Recompense } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import type { Arrivee, Avancee } from '../annee'
import styles from './Programme.module.css'

/** Des trous de poinçon : `total` en tout, les `perces` premiers percés. */
function Trous({ total, perces }: { total: number; perces: number }) {
  const n = Math.min(perces, total)
  return (
    <span className={styles.trous} role="img" aria-label={`${n} percé${n > 1 ? 's' : ''} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        // Une seule valeur pour le trou peint et pour ce que le test lit.
        const perce = i < perces
        return <i key={i} className={perce ? styles.perce : undefined} data-perce={perce} />
      })}
    </span>
  )
}

/**
 * Ce que la fiche prête passe au programme ; un gabarit de monde reçoit les mêmes
 * (`GabaritsDesPages.programme`). Le programme par défaut ne lit que le monde, les pas et la
 * progression, et ne rend rien sans pas : la page le monte sur toute fiche prête, et ne lui donne de
 * pas que pour l'année en cours.
 */
export interface PropsProgramme {
  monde: Monde
  annee: number
  /** Les pas qui restent (`prochainPas`) ; aucun pour une année qui n'est plus en cours. */
  etapes: readonly string[]
  progression: Progression
  /** Les objectifs de l'année et ce qui est atteint (`arriveesDeLAnnee`). */
  arrivees: readonly Arrivee[]
  /** Ce que le retour d'un billet a gagné. */
  gains: readonly Avancee[]
  /** L'année est bouclée (`estBouclee`). */
  bouclee: boolean
  recompense: Recompense | null
  /** Le compte IA : le seul à qui le jury se promet. */
  ia: boolean
}

/**
 * « Au programme ce soir » (maquette 1890 : `programme`, `.programme`, lignes 147 à 158), l'année en
 * cours seulement : une ligne ☞ par pas qui reste (`prochainPas`). La ligne du Lion porte les trous
 * des essentiels, celle de la Palme ses deux salles.
 */
export default function Programme({ monde, etapes, progression }: Pick<PropsProgramme, 'monde' | 'etapes' | 'progression'>) {
  const m = monde.pages.mots.programme
  if (etapes.length === 0) return null
  return (
    <section className={styles.programme} aria-label={m.titre}>
      <h2>
        <small>{m.sur}</small>
        {m.titre}
      </h2>
      <ol>
        {etapes.map((e) => (
          <li key={e}>
            <span className={styles.main} aria-hidden="true">
              ☞
            </span>
            <span>{e}</span>
            {e.startsWith('Lion') ? (
              <Trous total={progression.essentiels_total} perces={progression.essentiels_vus} />
            ) : e.startsWith('Palme') ? (
              <Trous total={2} perces={progression.salles_completes} />
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
