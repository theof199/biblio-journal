import { useId } from 'react'
import Panne from '../../../ui/Panne'
import type { PropsLivret } from '../../../voyage/decennie/Livret'
import { anneesSur } from '../../../voyage/passeport/Anneau'
import Tampon from '../../../voyage/passeport/Tampon'
import { imageDu1900 } from '../images'
import { MOTS_DU_PASSEPORT as M, dateDuTampon, libelleDeLaSortie, libelleDeLEntree, placeDuTampon, regleDuTampon } from './frontiere'
import styles from './Ligne.module.css'

/**
 * Le passeport des années 1900 (maquette, écran 9 : `.passeport`) : une page à tampons de frontière.
 * La sortie de la décennie d'avant, datée de son tampon et de lui seul ; l'entrée, une fois faite ;
 * le tampon de la décennie, celui de la carte et de la sacoche (`Tampon`), ou sa place ; la photo de
 * la douane ; et ce qui manque, que la page décide (rien tant que les tickets ne sont pas lus).
 */
export default function Frontiere({ monde, decennie, tampon, anneau, manque, sortie, entree }: PropsLivret) {
  const cercle = useId()
  const douane = imageDu1900('douane')
  const date = sortie ? dateDuTampon(sortie.boucle_le) : null
  return (
    <section className={styles.passeport} aria-label={`${monde.pages.mots.decennie.passeport} · années ${decennie}`}>
      <p className={styles.entete}>
        <span>{monde.pages.mots.decennie.passeport}</span>
        <span>{anneesSur(anneau)}</span>
      </p>
      <h2 className={styles.millesime}>{`Années ${decennie}`}</h2>
      <p className={styles.regle}>{`${monde.titreVoyageur ? `${monde.titreVoyageur}. ` : ''}${regleDuTampon(decennie)}`}</p>
      <div className={styles.tampons} role="group" aria-label={M.tampons}>
        {sortie && date ? (
          <svg className={`${styles.encre} ${styles.sortie}`} viewBox="-60 -60 120 120" role="img" aria-label={libelleDeLaSortie(sortie.decennie, sortie.boucle_le)}>
            <defs>
              <path id={cercle} d="M -40 0 A 40 40 0 1 1 40 0 A 40 40 0 1 1 -40 0" />
            </defs>
            <g className={styles.trait}>
              <circle r="54" strokeWidth="3.5" />
              <circle r="47" strokeWidth="1.2" />
              <circle r="30" strokeWidth="1.2" />
            </g>
            <text className={styles.tour}>
              <textPath href={`#${cercle}`}>{`SORTIE · ANNÉES ${sortie.decennie} · ${sortie.nom.toUpperCase()} ·`}</textPath>
            </text>
            <g className={styles.date}>
              <text y="-4" fontSize="11">
                {date.jour}
              </text>
              <text y="12" fontSize="13">
                {date.annee}
              </text>
            </g>
          </svg>
        ) : null}
        {entree ? (
          <svg className={`${styles.encre} ${styles.entree}`} viewBox="0 0 150 80" role="img" aria-label={libelleDeLEntree(decennie)}>
            <g className={styles.trait}>
              <rect x="3" y="3" width="144" height="74" strokeWidth="3" />
              <rect x="8" y="8" width="134" height="64" strokeWidth="1" />
            </g>
            <g className={styles.mots}>
              <text x="75" y="26" fontSize="11" fontWeight="600" letterSpacing="3">
                {M.frontiere.toUpperCase()}
              </text>
              <text x="75" y="47" fontSize="16" fontWeight="700" letterSpacing="1">{`ENTRÉE EN ${decennie}`}</text>
              <text x="75" y="64" fontSize="9" letterSpacing="2.5">{`${M.vise.toUpperCase()} · QUAI DE ${decennie - 1}`}</text>
            </g>
          </svg>
        ) : null}
        {/* Posé, le tampon de la carte et de la sacoche ; sa place, elle, s'écrit à l'encre du papier. */}
        {tampon ? (
          <div className={styles.pose}>
            <Tampon monde={monde} decennie={decennie} tampon={tampon} />
          </div>
        ) : (
          <p className={styles.place}>{placeDuTampon(decennie)}</p>
        )}
      </div>
      <figure className={styles.douane}>
        {douane ? <img src={douane} alt={M.douane} width={465} height={387} loading="lazy" /> : null}
        <figcaption>{M.legende}</figcaption>
      </figure>
      {/* Tamponnée, la phrase est nulle (`phraseDuPasseport`) : une seule garde, celle de la règle. */}
      {manque.type === 'phrase' ? (
        manque.phrase ? <p className={styles.manque}>{manque.phrase}</p> : null
      ) : manque.type === 'panne' ? (
        <div className={styles.manque}>
          <Panne erreur={manque.erreur} onReessayer={manque.onReessayer} />
        </div>
      ) : null}
    </section>
  )
}
