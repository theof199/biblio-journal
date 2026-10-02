import { useRef, type PointerEvent } from 'react'
import styles from './RangeeDeNote.module.css'

const NOTES = Array.from({ length: 10 }, (_, rang) => rang + 1)

/**
 * La note qu'un doigt désigne sur la rangée : dix tranches égales, bornées à 1 et 10 — un doigt qui
 * dépasse la rangée à gauche ou à droite tient la première ou la dernière.
 */
export function noteSousLeDoigt(x: number, gauche: number, largeur: number): number {
  if (largeur <= 0) return 1
  return Math.min(10, Math.max(1, Math.floor(((x - gauche) / largeur) * 10) + 1))
}

interface Props {
  note: number | null
  /** La nouvelle note ; nulle quand on touche celle qui est choisie, qui s'efface. */
  onChoisir: (note: number | null) => void
}

/**
 * Dix trous poinçonnés sur une rangée, numérotés : on touche un chiffre, ou on glisse le doigt le long
 * de la rangée (les cibles font 25 px sur un petit téléphone). Un radiogroupe de dix boutons, que le
 * clavier et les lecteurs d'écran lisent comme avant. `touch-action: pan-y` laisse le défilement
 * vertical au navigateur et garde le glissé de côté.
 */
export default function RangeeDeNote({ note, onChoisir }: Props) {
  // Un glissé qui a changé la note ne doit pas être suivi du `click` qui arrive au relâchement :
  // il décocherait ce que le doigt vient de poser. `null` hors d'un geste, ce qui garde la souris
  // qui survole sans appuyer de changer la note.
  const geste = useRef<{ aGlisse: boolean } | null>(null)

  const glisser = (event: PointerEvent<HTMLDivElement>) => {
    if (!geste.current) return
    const { left, width } = event.currentTarget.getBoundingClientRect()
    const sousLeDoigt = noteSousLeDoigt(event.clientX, left, width)
    if (sousLeDoigt === note) return
    geste.current.aGlisse = true
    onChoisir(sousLeDoigt)
  }

  const toucher = (n: number) => {
    if (geste.current?.aGlisse) return
    onChoisir(note === n ? null : n)
  }

  return (
    <div
      className={styles.rangee}
      role="radiogroup"
      aria-label="Note sur 10"
      onPointerDown={() => {
        geste.current = { aGlisse: false }
      }}
      onPointerMove={glisser}
      onPointerUp={() => {
        // Le `click` suit le relâchement dans la même tâche : le geste ne se ferme qu'après lui.
        window.setTimeout(() => {
          geste.current = null
        }, 0)
      }}
      onPointerCancel={() => {
        geste.current = null
      }}
    >
      {NOTES.map((n) => (
        <button
          key={n}
          type="button"
          className={styles.trou}
          role="radio"
          aria-checked={note === n}
          aria-label={`Note ${n} sur 10`}
          onClick={() => toucher(n)}
        >
          <span className={styles.poincon} aria-hidden="true" />
          <span className={styles.chiffre} aria-hidden="true">
            {n}
          </span>
        </button>
      ))}
    </div>
  )
}
