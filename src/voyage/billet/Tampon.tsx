import { useId } from 'react'
import styles from './Tampon.module.css'

/** Où en est la frappe : le marteau descend, l'encre est posée, le marteau remonte, puis le tampon reste seul. */
export type Frappe = 'descend' | 'pose' | 'remonte' | 'fini'

interface Props {
  /** Le mot frappé au centre (`mots.billet.tampon`, « VU »). */
  mot: string
  /** Ce qui court autour de lui avant la date (`mots.billet.tamponAutour`). */
  autour: string
  /** Le jour de la séance, en toutes lettres (« 1er octobre 2026 »). */
  date: string
  frappe: Frappe
}

/**
 * Le tampon qui frappe le billet (idée 5, décision D4 ; maquette 1890 : `encreVu`, `.marteau`,
 * `.encre-vu`, `tamponner`). Le marteau descend sur le billet, l'encre se pose — le mot du monde au
 * centre, `autour` et la date sur l'anneau —, le marteau remonte ; l'encre reste. Les durées sont
 * celles de `FRAPPE` (`voyage/billet.ts`), que la page attend. Les couleurs et les polices viennent
 * des jetons du monde, posés sur la page ; l'encre n'a de nom qu'une fois posée.
 */
export default function Tampon({ mot, autour, date, frappe }: Props) {
  // Les deux-points de `useId` se liraient mal dans `url(#…)`.
  const id = useId().replace(/:/g, '')
  const anneau = `${autour} ${date} ·`.toUpperCase()
  return (
    <div className={styles.tampon} data-frappe={frappe}>
      {frappe !== 'descend' ? (
        <div className={styles.encre} role="img" aria-label={`${mot} : ${autour} ${date}`}>
          <svg viewBox="0 0 132 132" aria-hidden="true">
            <defs>
              <filter id={`encre-${id}`}>
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} />
                <feDisplacementMap in="SourceGraphic" scale={3} />
              </filter>
              <path id={`arc-${id}`} d="M66 66m-47 0a47 47 0 1 1 94 0a47 47 0 1 1-94 0" />
            </defs>
            <g filter={`url(#encre-${id})`}>
              <circle className={styles.trait} cx="66" cy="66" r="60" strokeWidth="4" />
              <circle className={styles.trait} cx="66" cy="66" r="36" strokeWidth="2" />
              <text className={styles.mot} x="66" y="78" textAnchor="middle">
                {mot}
              </text>
              <text className={styles.autour}>
                <textPath href={`#arc-${id}`}>{anneau}</textPath>
              </text>
            </g>
          </svg>
        </div>
      ) : null}
      {frappe !== 'fini' ? (
        <svg className={styles.marteau} viewBox="0 0 118 150" aria-hidden="true">
          <ellipse className={styles.tete} cx="59" cy="22" rx="22" ry="20" />
          <ellipse className={styles.reflet} cx="52" cy="15" rx="8" ry="6" />
          <rect className={styles.manche} x="51" y="36" width="16" height="50" />
          <rect className={styles.bague} x="36" y="84" width="46" height="14" rx="3" />
          <rect className={styles.socle} x="24" y="96" width="70" height="30" rx="4" />
          <rect className={styles.semelle} x="26" y="124" width="66" height="8" />
        </svg>
      ) : null}
    </div>
  )
}
