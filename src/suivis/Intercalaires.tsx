import type { SourceSuivi } from './liste'
import styles from './Intercalaires.module.css'

const LIBELLES: Record<SourceSuivi, string> = { realisateurs: 'Rétrospectives', sagas: 'Cycles' }
const SOURCES: readonly SourceSuivi[] = ['realisateurs', 'sagas']

/** L'identifiant de l'intercalaire d'une source : le panneau s'en nomme (`aria-labelledby`). */
export const idIntercalaire = (base: string, source: SourceSuivi) => `${base}-${source}`

/**
 * Les deux intercalaires de la page : les rétrospectives et les cycles, un seul ouvert à la fois,
 * chacun avec son compte. Le panneau qu'ils ouvrent est celui de la page (`idPanneau`).
 */
export default function Intercalaires({
  base,
  idPanneau,
  ouvert,
  comptes,
  onChoisir,
}: {
  base: string
  idPanneau: string
  ouvert: SourceSuivi
  comptes: Record<SourceSuivi, number | undefined>
  onChoisir: (source: SourceSuivi) => void
}) {
  return (
    <div role="tablist" aria-label="Mes suivis" className={styles.intercalaires}>
      {SOURCES.map((source) => (
        <button
          key={source}
          type="button"
          role="tab"
          id={idIntercalaire(base, source)}
          aria-selected={ouvert === source}
          aria-controls={idPanneau}
          className={styles.intercalaire}
          onClick={() => onChoisir(source)}
        >
          {LIBELLES[source]}{' '}
          {comptes[source] != null ? <small className={styles.compte}>{comptes[source]}</small> : null}
        </button>
      ))}
    </div>
  )
}
