import { virgule } from '../ui/format'
import styles from './Jauge.module.css'

/** Le cadran se dessine dans un repère de 300 sur 168, centré sur le pivot de l'aiguille : la feuille n'a qu'à le mettre à l'échelle. */
const PIVOT = { x: 150, y: 150 }
const RAYON = 118
const NOTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** La note 1 est à gauche (180°), la 10 à droite (0°) : vingt degrés par note. */
const angle = (note: number): number => ((180 - (note - 1) * 20) * Math.PI) / 180

const point = (rayon: number, note: number) => ({
  x: PIVOT.x + rayon * Math.cos(angle(note)),
  y: PIVOT.y - rayon * Math.sin(angle(note)),
})

const decimale = (valeur: number): string => valeur.toFixed(1)

function Graduation({ note }: { note: number }) {
  const dedans = point(124, note)
  const dehors = point(134, note)
  const texte = point(147, note)
  return (
    <>
      <line className={styles.graduation} x1={decimale(dedans.x)} y1={decimale(dedans.y)} x2={decimale(dehors.x)} y2={decimale(dehors.y)} strokeWidth={1.2} />
      <text className={styles.chiffre} x={decimale(texte.x)} y={decimale(texte.y + 4)} textAnchor="middle" fontSize={14}>
        {note}
      </text>
    </>
  )
}

function DemiGraduation({ note }: { note: number }) {
  const dedans = point(126, note + 0.5)
  const dehors = point(131, note + 0.5)
  return <line className={styles.demiGraduation} x1={decimale(dedans.x)} y1={decimale(dedans.y)} x2={decimale(dehors.x)} y2={decimale(dehors.y)} strokeWidth={0.7} />
}

/**
 * La note moyenne sur un cadran de laiton : l'aiguille à la moyenne, l'arc rouge de 1 jusqu'à elle,
 * la valeur en gros dessous. Sans aucun film noté, le cadran reste sans aiguille et le dit.
 */
export default function Jauge({ moyenne }: { moyenne: number | null }) {
  const description = moyenne === null ? 'Aucun film noté' : `Note moyenne ${virgule(moyenne)} sur 10`
  const fin = moyenne === null ? null : point(RAYON, moyenne)
  const pointe = moyenne === null ? null : point(104, moyenne)
  const arc = fin === null ? null : `M ${PIVOT.x - RAYON} ${PIVOT.y} A ${RAYON} ${RAYON} 0 0 1 ${decimale(fin.x)} ${decimale(fin.y)}`

  return (
    <div className={styles.panneau} role="img" aria-label={description}>
      <svg className={styles.cadran} viewBox="0 0 300 168" aria-hidden="true">
        <defs>
          <filter id="jauge-halo">
            <feGaussianBlur stdDeviation={5} />
          </filter>
        </defs>
        <path className={styles.piste} d={`M ${PIVOT.x - RAYON} ${PIVOT.y} A ${RAYON} ${RAYON} 0 0 1 ${PIVOT.x + RAYON} ${PIVOT.y}`} fill="none" strokeWidth={8} />
        {arc ? (
          <>
            <path className={styles.halo} d={arc} fill="none" strokeWidth={16} filter="url(#jauge-halo)" />
            <path className={styles.arc} d={arc} fill="none" strokeWidth={8} />
          </>
        ) : null}
        {NOTES.map((note) => (
          <Graduation key={note} note={note} />
        ))}
        {NOTES.slice(0, -1).map((note) => (
          <DemiGraduation key={note} note={note} />
        ))}
        {pointe ? (
          <>
            <line className={styles.aiguille} x1={PIVOT.x} y1={PIVOT.y} x2={decimale(pointe.x)} y2={decimale(pointe.y)} strokeWidth={3.2} strokeLinecap="round" />
            <circle className={styles.pivot} cx={PIVOT.x} cy={PIVOT.y} r={8} />
            <circle className={styles.axe} cx={PIVOT.x} cy={PIVOT.y} r={3} />
          </>
        ) : null}
      </svg>
      <div className={styles.lecture} aria-hidden="true">
        {moyenne === null ? (
          <p className={styles.vide}>Aucun film noté</p>
        ) : (
          <>
            <p className={styles.valeur}>{virgule(moyenne)}</p>
            <p className={styles.legende}>note moyenne</p>
          </>
        )}
      </div>
    </div>
  )
}
