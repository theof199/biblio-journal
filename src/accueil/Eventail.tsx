import { useState } from 'react'
import { Link } from 'react-router-dom'
import Affiche from '../ui/Affiche'
import { placesEventail } from './eventail'
import type { CarteEventail } from './eventail'
import styles from './Eventail.module.css'

/**
 * L'éventail d'affiches : la carte de face mène à son film, les autres se touchent pour passer
 * devant. La carte choisie se retient par sa clé plutôt que par son rang : une carte qui arrive en
 * tête (la séance, une fois `/me/voyage` répondu) ne fait pas changer d'affiche sous le doigt, et
 * une carte disparue laisse simplement la première devant.
 */
export default function Eventail({ cartes }: { cartes: CarteEventail[] }) {
  const [cleChoisie, setCleChoisie] = useState<string | null>(null)
  if (cartes.length === 0) return null

  const rangChoisi = cartes.findIndex((carte) => carte.cle === cleChoisie)
  const rangAvant = Math.max(rangChoisi, 0)
  const places = placesEventail(cartes.length, rangAvant)
  const carteAvant = cartes[rangAvant]!

  return (
    <div className={styles.eventail}>
      <div className={`${styles.scene} ${cartes.length === 2 ? styles.duo : ''}`}>
        {cartes.map((carte, rang) => {
          const place = places[rang]!
          const classe = `${styles.carte} ${styles[place]} ${carte.ceSoir ? styles.ceSoir : ''}`
          const affiche = <Affiche src={carte.afficheUrl} titre={carte.titre} className={styles.affiche} />
          return (
            <div key={carte.cle} className={classe}>
              {place === 'avant' ? (
                <Link to={carte.cible.to} state={carte.cible.state} className={styles.lien}>
                  {affiche}
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.lien}
                  aria-label={`Mettre en avant : ${carte.titre}`}
                  onClick={() => setCleChoisie(carte.cle)}
                >
                  {affiche}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {cartes.length > 1 ? (
        <div className={styles.points} aria-hidden="true">
          {cartes.map((carte, rang) => (
            <span key={carte.cle} className={`${styles.point} ${rang === rangAvant ? styles.actif : ''}`} />
          ))}
        </div>
      ) : null}

      <div className={styles.legende} aria-live="polite">
        <span className={`${styles.puce} ${carteAvant.ceSoir ? styles.puceCeSoir : styles.puceEnsuite}`}>{carteAvant.etiquette}</span>
        <p className={styles.titre}>{carteAvant.titre}</p>
        {carteAvant.meta ? <p className={styles.meta}>{carteAvant.meta}</p> : null}
      </div>
    </div>
  )
}
