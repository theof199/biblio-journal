import { useRef } from 'react'
import { useMouvementReduit } from '../../ui/mouvement'
import styles from './Poincon.module.css'

const TROUS = Array.from({ length: 10 }, (_, i) => i + 1)

interface Props {
  note: number | null
  onNote: (note: number | null) => void
}

/**
 * Le poinçon du billet (maquette 1890 : `.poincon`, `poinconner`) : dix trous, qui se percent de 1 à
 * la note ; chaque trou nouvellement percé lâche son confetti de carton, jamais au calme ni sans
 * Web Animations. « sans note » rebouche tout ; la note se lit en grand.
 */
export default function Poincon({ note, onNote }: Props) {
  const calme = useMouvementReduit()
  const zone = useRef<HTMLDivElement>(null)
  const trous = useRef<(HTMLButtonElement | null)[]>([])

  const poinconner = (n: number) => {
    const avant = note ?? 0
    onNote(n)
    const boite = zone.current
    if (calme || !boite) return
    const cadre = boite.getBoundingClientRect()
    for (let k = avant + 1; k <= n; k += 1) {
      const trou = trous.current[k - 1]
      if (!trou || typeof trou.animate !== 'function') continue
      const r = trou.getBoundingClientRect()
      const confetti = document.createElement('span')
      confetti.className = styles.confetti ?? ''
      confetti.setAttribute('aria-hidden', 'true')
      confetti.style.left = `${r.left - cadre.left + r.width / 2 - 5.5}px`
      confetti.style.top = `${r.top - cadre.top + r.height / 2 - 5.5}px`
      boite.appendChild(confetti)
      const dx = (Math.random() - 0.5) * 60
      const rot = (Math.random() - 0.5) * 720
      const vol = confetti.animate(
        [
          { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * 0.3}px, -14px) rotate(${rot * 0.2}deg) scale(1)`, opacity: 1, offset: 0.18 },
          { transform: `translate(${dx}px, 220px) rotate(${rot}deg) scaleY(0.4)`, opacity: 0 },
        ],
        { duration: 1000 + Math.random() * 300, delay: (k - avant - 1) * 45, easing: 'cubic-bezier(.3, 0, .8, .6)', fill: 'backwards' },
      )
      vol.onfinish = () => confetti.remove()
    }
  }

  return (
    <div className={styles.zone} ref={zone}>
      <div className={styles.poincon} role="group" aria-label="Note sur 10">
        {TROUS.map((n) => {
          const perce = note !== null && n <= note
          return (
            <button
              key={n}
              ref={(b) => void (trous.current[n - 1] = b)}
              type="button"
              className={perce ? styles.troue : undefined}
              data-perce={perce}
              aria-label={`${n} sur 10`}
              aria-pressed={note === n}
              onClick={() => poinconner(n)}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className={styles.lue}>
        <b>{note ?? '—'}</b>
        <span>sur 10</span>
        <button type="button" aria-pressed={note === null} onClick={() => onNote(null)}>
          sans note
        </button>
      </div>
    </div>
  )
}
