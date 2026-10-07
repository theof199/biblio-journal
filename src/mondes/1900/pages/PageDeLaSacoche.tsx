import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { anneesSur } from '../../../voyage/passeport/Anneau'
import Tampon from '../../../voyage/passeport/Tampon'
import type { PropsPageDuPasseport } from '../../../voyage/sacoche/Page'
import { compteDeLAnneau, etatDeLaPage, MOTS_DE_LA_SACOCHE as M, partDeLAnneau } from './sacoche'
import styles from './Sacoche.module.css'

/** Le rayon de l'anneau et sa circonférence (maquette : un cercle de 44 dans un repère de 120). */
const RAYON = 44
const CIRCONFERENCE = 2 * Math.PI * RAYON

/**
 * La page des années 1900 dans le passeport de la sacoche (maquette, écran 15 : `.page-p`) : une
 * feuille de papier ; tant que la décennie court, l'anneau de ses récompenses, son compte au cœur
 * (« 4/10 ») et « En cours » ; bouclée, le tampon de la décennie, celui de la carte et du livret, et
 * « Tampon posé ». Elle pose les jetons de **son** monde sur elle : la sacoche d'une autre décennie
 * la montre telle quelle. Les tampons de frontière ne viennent pas ici : ils restent à la page de la
 * décennie. Elle ne compte rien : l'anneau et le tampon sont ceux que la page passe.
 */
export default function PageDeLaSacoche({ monde, decennie: d, tampon, anneau, vers }: PropsPageDuPasseport) {
  const { jetons } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  return (
    <Link to={vers} className={styles.page} style={style}>
      <span className={styles.enTete}>
        {tampon ? null : (
          <svg className={styles.anneau} viewBox="-60 -60 120 120" aria-hidden="true">
            <circle className={styles.piste} r={RAYON} />
            <circle
              className={styles.plein}
              r={RAYON}
              strokeDasharray={CIRCONFERENCE.toFixed(1)}
              strokeDashoffset={(CIRCONFERENCE * (1 - partDeLAnneau(anneau))).toFixed(1)}
              transform="rotate(-90)"
            />
            <text className={styles.compte} y="2">
              {compteDeLAnneau(anneau)}
            </text>
            <text className={styles.recompenses} y="17">
              {M.page.recompenses}
            </text>
          </svg>
        )}
        <span className={styles.texte}>
          <b>{`Années ${d}`}</b>
          <span className={styles.monde}>{monde.nom}</span>
          {tampon ? null : <span className={styles.annees}>{anneesSur(anneau)}</span>}
          <small>{etatDeLaPage(tampon)}</small>
        </span>
        <span className={styles.fleche} aria-hidden="true">
          ›
        </span>
      </span>
      {tampon ? (
        <span className={styles.tampon}>
          <Tampon monde={monde} decennie={d} tampon={tampon} />
        </span>
      ) : null}
    </Link>
  )
}
