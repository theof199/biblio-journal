import { useId } from 'react'
import styles from './Etoiles.module.css'

/** Le tracé d'une étoile à cinq branches, dans une boîte de 24 sur 24. */
const TRACE = 'M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.2 1.2-6.6L2.5 9.6l6.6-.9z'

/** Ce qu'une étoile montre : vide, à demi pleine, pleine. */
export type PartEtoile = 0 | 0.5 | 1

/**
 * Une note sur 10 en cinq étoiles, deux points par étoile : 7 sur 10 fait trois étoiles et demie.
 * Hors de 0 à 10, la note se borne : une étoile ne se remplit pas plus que pleine.
 */
export function partsDesEtoiles(note: number): PartEtoile[] {
  return Array.from({ length: 5 }, (_, rang) => {
    const reste = note - 2 * rang
    if (reste >= 2) return 1
    return reste >= 1 ? 0.5 : 0
  })
}

interface Props {
  /** La note sur 10. */
  note: number
  /** Le nom que lit un lecteur d'écran : « vu, noté 8 sur 10 » dit mieux que le défaut quand l'étoile est une marque de « vu ». */
  libelle?: string
  /** Pose la taille (`--etoile-taille`) et la couleur de ses étoiles : elles prennent la couleur du texte. */
  className?: string
}

/**
 * Cinq étoiles, pleines, à demi ou vides, de la couleur du texte qui les porte. Un seul nom pour le
 * lecteur d'écran, jamais cinq dessins : les étoiles sont un décor, la note est dite en mots.
 */
export default function Etoiles({ note, libelle, className }: Props) {
  // Les `id` de `useId` portent des deux-points, que `url(#…)` ne lit pas partout.
  const racine = useId().replace(/:/g, '')

  return (
    <span role="img" aria-label={libelle ?? `Noté ${note} sur 10`} className={`${styles.etoiles} ${className ?? ''}`}>
      {partsDesEtoiles(note).map((part, rang) => {
        const moitie = `${racine}-${rang}`
        return (
          <svg key={rang} viewBox="0 0 24 24" aria-hidden="true" className={styles.etoile}>
            {part === 0.5 ? (
              <clipPath id={moitie}>
                <rect width="12" height="24" />
              </clipPath>
            ) : null}
            <path d={TRACE} className={styles.fond} />
            {part > 0 ? <path d={TRACE} className={styles.plein} clipPath={part === 0.5 ? `url(#${moitie})` : undefined} /> : null}
          </svg>
        )
      })}
    </span>
  )
}
