import type { Recompense } from '../../api/voyage'
import { MEDAILLES } from '../../carte/dessin/cases'
import type { Monde } from '../../mondes/types'
import styles from './Embleme.module.css'

export const NOM_DE_RECOMPENSE: Record<Recompense, string> = { palme: 'Palme', lion: 'Lion', ours: 'Ours' }

/** Les rayons de la crinière du Lion : vingt pointes, alternées (maquette : `embleme`). */
const CRINIERE = Array.from({ length: 20 }, (_, i) => {
  const an = (i / 20) * Math.PI * 2
  const r = i % 2 ? 6.2 : 8.4
  return `${(Math.cos(an) * r).toFixed(1)},${(Math.sin(an) * r).toFixed(1)}`
}).join(' ')

/**
 * La médaille d'une récompense, en SVG (maquette 1890 : `embleme`, ligne 2277) : le ruban, le disque
 * et son reflet, le glyphe de la Palme, du Lion ou de l'Ours. Les couleurs sont celles de la
 * médaille de la carte (`MEDAILLES`), passées par la rampe du monde.
 */
export default function Embleme({ type, couleur, className }: { type: Recompense; couleur: Monde['couleur']; className?: string }) {
  const [c0, c1, c2] = MEDAILLES[type]!.map((hex) => couleur(hex))
  return (
    <svg className={`${styles.embleme} ${className ?? ''}`} viewBox="-15 -15 30 39" role="img" aria-label={NOM_DE_RECOMPENSE[type]}>
      <path d="M-7 6L-11 22L-6 19L-3 23L0 8ZM7 6L11 22L6 19L3 23L0 8Z" fill={couleur('#6E2A1E')} />
      <circle r="13.5" fill={c1} />
      <circle cx="-3" cy="-4" r="8" fill={c0} opacity="0.6" />
      <circle r="10.8" fill="none" stroke={c2} />
      {type === 'palme' ? (
        <g stroke={c2} fill="none" strokeLinecap="round">
          <path d="M-1 8Q0 0 4-8" strokeWidth="1.5" />
          {[0, 1, 2, 3].map((i) => {
            const yy = 5 - i * 3.6
            const xx = -0.6 + i * 1.1
            return <path key={i} d={`M${xx} ${yy}L${xx - 5 + i * 0.5} ${yy - 2.6}M${xx} ${yy}L${xx + 4.5 - i * 0.4} ${yy - 3.4}`} strokeWidth="1.2" />
          })}
        </g>
      ) : type === 'lion' ? (
        <>
          <polygon points={CRINIERE} fill={c2} opacity="0.55" />
          <circle cy="0.5" r="4.4" fill={c2} />
        </>
      ) : (
        <>
          <circle cx="-4.8" cy="-4.6" r="2.6" fill={c2} />
          <circle cx="4.8" cy="-4.6" r="2.6" fill={c2} />
          <circle cy="0.8" r="6.2" fill={c2} />
        </>
      )}
    </svg>
  )
}
