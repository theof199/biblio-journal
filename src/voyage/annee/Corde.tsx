import { useEffect, useRef } from 'react'
import { useMouvementReduit } from '../../ui/mouvement'
import type { Avancee, Billet } from '../annee'
import { STYLE_DU_TEMPO, auTempo } from '../tempo'
import styles from './Corde.module.css'

/** Le nom complet d'un billet, pour qui ne le voit pas : « 3 films vus », « 1 essentiel sur 5 », « Aucun essentiel encore ». */
export const nomDuBillet = (b: Billet): string =>
  [b.valeur === null ? null : String(b.valeur), b.libelle, b.total === null ? null : `sur ${b.total}`].filter(Boolean).join(' ')

/** Web Animations : absent de jsdom et de vieux navigateurs, où rien ne vole. */
const peutAnimer = () => typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function'

/** Le compteur qui roule d'une valeur à la suivante (CSS), au retour d'un billet. */
function Compteur({ de, a }: { de: number; a: number }) {
  return (
    <span className={styles.compteur}>
      <span className={styles.rouleau}>
        <span>{de}</span>
        <span>{a}</span>
      </span>
    </span>
  )
}

/** Le « +1 » corail qui tombe de la corde sur le billet gagné : une fois, au montage. */
function Plus({ n }: { n: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const vol = ref.current?.animate(
      [
        { transform: 'translate(-50%, -38px) scale(0.6)', opacity: 0 },
        { transform: 'translate(-50%, -12px) scale(1.2)', opacity: 1, offset: 0.45 },
        { transform: 'translate(-50%, 20px) scale(0.9)', opacity: 0 },
      ],
      { duration: auTempo(1100), delay: auTempo(250), easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'both' },
    )
    return () => vol?.cancel()
  }, [])
  return (
    <span ref={ref} className={styles.plus} aria-hidden="true">
      {`+${n}`}
    </span>
  )
}

interface Props {
  billets: readonly (Billet & { tete?: string })[]
  nom?: string
  /** Au retour d'un billet, ce qui a été gagné : le compteur roule, un « +1 » vole (jamais au calme). */
  gains?: readonly Avancee[]
}

/**
 * Les billets suspendus à la corde (maquette 1890 : `.corde`, `billetsCorde`) : la valeur en grand,
 * le total en petit, le libellé dessous. Ils se balancent, sauf au calme (la feuille s'en charge).
 */
export default function Corde({ billets, nom = 'La progression de l’année', gains = [] }: Props) {
  const calme = useMouvementReduit()
  return (
    // Le tempo du retour d'un billet : le compteur roule à `var(--tempo)` (`voyage/tempo.ts`).
    <ul className={styles.corde} aria-label={nom} style={STYLE_DU_TEMPO}>
      {billets.map((b) => {
        // Un gain ne vaut que pour la valeur qu'il annonce : relue plus tard, la fiche l'a dépassé.
        const gain = calme ? undefined : gains.find((g) => g.cle === b.cle && g.apres === b.valeur)
        return (
          <li key={b.cle} className={styles.billet} aria-label={nomDuBillet(b)}>
            {/* Le papier porte le masque des encoches : le « +1 », hors de lui, n'est pas rogné en vol. */}
            <span className={styles.papier} aria-hidden="true">
              {b.tete ? <span className={styles.num}>{b.tete}</span> : null}
              {b.valeur !== null ? (
                <b>
                  {gain ? <Compteur de={gain.avant} a={gain.apres} /> : b.valeur}
                  {b.total !== null ? <small>{`/${b.total}`}</small> : null}
                </b>
              ) : null}
              <span className={styles.libelle}>{b.libelle}</span>
            </span>
            {gain && peutAnimer() ? <Plus n={gain.apres - gain.avant} /> : null}
          </li>
        )
      })}
    </ul>
  )
}
