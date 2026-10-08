import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import type { PropsTeteDAnnee } from '../../../voyage/annee/Bandeau'
import { imageDu1900 } from '../images'
import { heureDeLaGare, libelleDeLaPhoto, mentionDeLaPlaque } from './gare'
import { MOTS_DE_L_HORAIRE } from './horaire'
import styles from './Tete.module.css'

const CHIFFRES = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/**
 * La tête de la gare (maquette « Voyage immobile 1900 », écrans 2, 12 et 16) : la photographie de la
 * gare de l'année, sa plaque émaillée, qui porte le titre de la page, et selon le mode l'horloge
 * (l'année est l'heure de la gare), le tampon d'une ligne bouclée (`anneeBouclee` : la règle de la
 * fiche, dès le ticket émis), la lanterne rouge sur le négatif d'une année fermée, ou le sémaphore à
 * l'arrêt d'une voie qui attend. Un horaire tenu (`aLHeure`) cercle la plaque d'un filet doré et y
 * écrit « à l'heure ».
 *
 * Au calme, rien ne bouge : `data-vivante` porte seul les animations de la feuille.
 */
export default function Tete({ monde, annee, mode, calme, anneeBouclee, aLHeure }: PropsTeteDAnnee) {
  const m = monde.pages.mots
  const photo = imageDu1900(`g${annee}`)
  const heure = heureDeLaGare(annee)
  const ouverte = mode === 'encours' || mode === 'bouclee'
  return (
    <div className={`${styles.tete} ${styles[mode]}`} style={STYLE_DU_TEMPO} data-mode={mode} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.cadre}>
        <div className={styles.photo} role="img" aria-label={libelleDeLaPhoto(mode, annee)} style={photo ? { backgroundImage: `url(${photo})` } : undefined} />
        {mode === 'fermee' ? <div className={styles.lanterne} role="img" aria-label="La lanterne rouge du laboratoire" /> : null}
      </div>
      {/* L'horaire tenu : un filet doré autour de la plaque, et sa mention sous l'année. */}
      <div className={`${styles.plaque} ${aLHeure ? styles.aLHeure : ''}`}>
        <small>{mentionDeLaPlaque(mode, annee, m)}</small>
        <h1>{annee}</h1>
        {aLHeure ? <em>{MOTS_DE_L_HORAIRE.aLHeure}</em> : null}
      </div>
      {anneeBouclee ? <p className={styles.tampon}>{m.annonce.bouclee}</p> : null}
      {ouverte ? (
        <svg className={styles.horloge} viewBox="-50 -50 100 100" role="img" aria-label={`L’horloge de la gare marque ${heure.libelle}`}>
          <circle r="48" className={styles.boitier} />
          <circle r="45" className={styles.cadran} />
          <g className={styles.chiffres} textAnchor="middle" dominantBaseline="central">
            {CHIFFRES.map((n, i) => (
              <text key={n} x={(35 * Math.sin((i * Math.PI) / 6)).toFixed(1)} y={(-35 * Math.cos((i * Math.PI) / 6)).toFixed(1)}>
                {n}
              </text>
            ))}
          </g>
          <line className={styles.aiguilleDesHeures} x1="0" y1="0" x2="0" y2="-22" style={{ transform: `rotate(${heure.angleDesHeures}deg)` }} />
          <line className={styles.aiguilleDesMinutes} x1="0" y1="0" x2="0" y2="-36" style={{ transform: `rotate(${heure.angleDesMinutes}deg)` }} />
          <line className={styles.trotteuse} x1="0" y1="7" x2="0" y2="-38" />
          <circle r="3" className={styles.axe} />
        </svg>
      ) : null}
      {mode === 'attente' ? (
        <div className={styles.semaphore} role="img" aria-label="Le sémaphore est à l’arrêt">
          <i className={styles.bras} />
          <i className={styles.feu} />
        </div>
      ) : null}
    </div>
  )
}
