import { Link } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'
import type { Voyage } from '../api/voyage'
import styles from './BandeVoyage.module.css'

const pluriel = (nombre: number) => (nombre > 1 ? 'essentiels' : 'essentiel')

/**
 * La bande du Voyage : l'année où il en est et, tant que cette année est ouverte, les essentiels
 * vus — une case chacun. Sans progression (année pas encore ouverte), rien à compter : ni cases ni
 * total, jamais « 0 sur 0 ».
 */
export default function BandeVoyage({ voyage }: { voyage: Voyage }) {
  const progression = voyage.annees.find((annee) => annee.annee === voyage.annee_en_cours)?.progression ?? null

  return (
    <Link to="/voyage" className={styles.bande}>
      <div className={styles.annee}>
        <span className={styles.etiquette}>Le Voyage</span>
        <span className={styles.chiffre}>{voyage.annee_en_cours}</span>
      </div>
      <div className={styles.suivi}>
        {progression ? (
          <>
            <div className={styles.cases} aria-hidden="true">
              {Array.from({ length: progression.essentiels_total }, (_, rang) => (
                <span key={rang} className={rang < progression.essentiels_vus ? styles.pleine : styles.vide} />
              ))}
            </div>
            <span className={styles.compte}>
              {progression.essentiels_vus} {pluriel(progression.essentiels_vus)} sur {progression.essentiels_total}
            </span>
          </>
        ) : null}
        {voyage.source ? (
          <span className={styles.source}>
            {voyage.source.pseudo} est en {voyage.source.annee_en_cours}
          </span>
        ) : null}
      </div>
      <IconChevronRight aria-hidden="true" className={styles.chevron} />
    </Link>
  )
}
