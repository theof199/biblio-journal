import { useState } from 'react'
import { MAX_REACTIONS, basculerReaction, type Reaction } from '../../api/reactions'
import { compteDesCartons } from '../billet'
import styles from './Cartons.module.css'

interface Props {
  catalogue: readonly Reaction[]
  choisis: readonly string[]
  onChange: (choisis: string[]) => void
}

/**
 * Les réactions en cartons d'intertitre (maquette 1890 : `.cartons`, `.carton-r`) : un carton se
 * retourne quand on le choisit (CSS, jamais au calme), douze au plus, dans l'ordre du catalogue.
 */
export default function Cartons({ catalogue, choisis, onChange }: Props) {
  const ordre = catalogue.map((r) => r.cle)
  // Le nombre de fois qu'un carton a été retourné : deux noms d'animation en alternance la rejouent
  // sans remonter le bouton (le focus du clavier y reste).
  const [tours, setTours] = useState<Record<string, number>>({})

  return (
    <>
      <div className={styles.cartons}>
        {catalogue.map((r) => {
          const choisi = choisis.includes(r.cle)
          const tour = tours[r.cle] ?? 0
          return (
            <button
              key={r.cle}
              type="button"
              className={`${styles.carton} ${tour === 0 ? '' : tour % 2 ? styles.tourneA : styles.tourneB}`}
              aria-pressed={choisi}
              onClick={() => {
                const suite = basculerReaction([...choisis], r.cle, ordre, MAX_REACTIONS)
                if (suite.length === choisis.length && !choisi) return
                setTours((t) => ({ ...t, [r.cle]: (t[r.cle] ?? 0) + 1 }))
                onChange(suite)
              }}
            >
              <span className={styles.emo} aria-hidden="true">
                {r.emoji}
              </span>
              {r.phrase}
            </button>
          )
        })}
      </div>
      <p className={styles.compte}>{compteDesCartons(choisis.length)}</p>
    </>
  )
}
