import type { Monde } from '../../mondes/types'
import Panne from '../../ui/Panne'
import type { Tampon as TamponDuPasseport } from '../passeport'
import Tampon from '../passeport/Tampon'
import styles from './Livret.module.css'

/** La circonférence de l'anneau (maquette : `2π × 29`, dans un repère de 70). */
const CIRCONFERENCE = 2 * Math.PI * 29

interface Props {
  monde: Monde
  decennie: number
  /** Le tampon de la décennie (`tamponDe`), nul tant qu'elle n'est pas bouclée. */
  tampon: TamponDuPasseport | null
  /** Les années du tampon qui portent leur récompense, sur toutes (`anneauDuPasseport`). */
  anneau: { faites: number; total: number }
  /**
   * Ce qui manque au tampon, une fois les tickets lus : la phrase (`phraseDuPasseport`), nulle quand
   * rien ne manque ; `attente` tant qu'ils ne sont pas lus (rien ne se dit : sans eux, la phrase
   * réclamerait un ticket déjà utilisé) ; `panne` quand leur lecture a échoué.
   */
  manque: { type: 'phrase'; phrase: string | null } | { type: 'attente' } | { type: 'panne'; erreur: unknown; onReessayer: () => void }
}

/**
 * Le livret du passeport (maquette 1890 : `.livret`, écran IV ; décision D6) : l'anneau des années
 * récompensées, ce qui manque encore en clair, et le tampon posé ou sa place. Le tampon ne frappe
 * pas ici : il est posé depuis la décennie bouclée, la page ne fait que le montrer.
 */
export default function Livret({ monde, decennie, tampon, anneau, manque }: Props) {
  const part = anneau.total > 0 ? anneau.faites / anneau.total : 0
  const annees = `${anneau.faites} ${anneau.faites > 1 ? 'années' : 'année'} sur ${anneau.total}`

  return (
    <section className={styles.livret} aria-labelledby="livret-titre">
      <div className={styles.tete}>
        <svg className={styles.anneau} viewBox="0 0 70 70" aria-hidden="true">
          <circle className={styles.piste} cx="35" cy="35" r="29" />
          <circle
            className={styles.plein}
            cx="35"
            cy="35"
            r="29"
            strokeDasharray={CIRCONFERENCE.toFixed(1)}
            strokeDashoffset={(CIRCONFERENCE * (1 - part)).toFixed(1)}
            transform="rotate(-90 35 35)"
          />
        </svg>
        <div>
          <h2 id="livret-titre" className={styles.titre}>{`${monde.pages.mots.decennie.passeport} · années ${decennie}`}</h2>
          <p className={styles.annees}>{annees}</p>
          {/* Tamponnée, la phrase est nulle (`phraseDuPasseport`) : une seule garde, celle de la règle. */}
          {manque.type === 'phrase' ? (
            manque.phrase ? <p className={styles.manque}>{manque.phrase}</p> : null
          ) : manque.type === 'panne' ? (
            <div className={styles.panne}>
              <Panne erreur={manque.erreur} onReessayer={manque.onReessayer} />
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.tampon}>
        <Tampon monde={monde} decennie={decennie} tampon={tampon} place />
      </div>
    </section>
  )
}
