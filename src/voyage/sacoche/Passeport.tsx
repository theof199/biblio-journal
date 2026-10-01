import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { cles } from '../../api/cles'
import { lireVoyage, type Voyage } from '../../api/voyage'
import { creerRegistre } from '../../mondes'
import Panne from '../../ui/Panne'
import Anneau, { anneesSur } from '../passeport/Anneau'
import Tampon from '../passeport/Tampon'
import { anneauDuPasseport, tamponDe } from '../passeport'
import { decenniesDuPasseport } from '../sacoche'
import commun from './Sacoche.module.css'
import styles from './Passeport.module.css'

/** Le monde de chaque décennie, par le registre : la sacoche ne connaît aucun monde précis. */
const mondes = creerRegistre()

/**
 * Une page du passeport, habillée par le monde de sa décennie (ses jetons posés sur elle, comme le
 * tampon le fait) : bouclée, son tampon (le titre du voyageur, le jour de Paris où elle l'a été) ;
 * sinon, son anneau (`anneauDuPasseport`). Elle mène à la page de la décennie.
 */
function PageDuPasseport({ v, decennie: d }: { v: Voyage; decennie: number }) {
  const monde = mondes(d)
  const { jetons } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const tampon = tamponDe(v.tampons, d)
  const anneau = anneauDuPasseport(v.annees, d, v.depart)
  return (
    <li>
      <Link to={`/voyage/decennies/${d}`} className={styles.page} style={style}>
        <div className={styles.tete}>
          {tampon ? null : <Anneau {...anneau} />}
          <span className={styles.texte}>
            <span className={styles.decennie}>{`Années ${d}`}</span>
            <span className={styles.monde}>{monde.nom}</span>
            {tampon ? null : <span className={styles.annees}>{anneesSur(anneau)}</span>}
          </span>
          <span className={styles.fleche} aria-hidden="true">
            ›
          </span>
        </div>
        {tampon ? (
          <div className={styles.tampon}>
            <Tampon monde={monde} decennie={d} tampon={tampon} />
          </div>
        ) : null}
      </Link>
    </li>
  )
}

/**
 * Le passeport (reprise de `PasseportCard`, Android) : une page par décennie, du départ à la
 * décennie en cours. « … » tant que la carte n'a pas répondu ; « Aucun tampon encore » après une
 * réponse sans tampon, jamais avant. Lit la carte (`GET /me/voyage`, la clé de la carte), jamais
 * une fiche d'année. Pas de générique au toucher d'un tampon : il viendra avec les célébrations.
 */
export default function Passeport() {
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const v = voyage.data
  return (
    <section className={commun.bloc} aria-label="Passeport">
      <h2 className={commun.titreSec}>
        Passeport <small>une page par décennie</small>
      </h2>
      {voyage.error ? (
        <div className={commun.panne}>
          <Panne erreur={voyage.error} onReessayer={() => void voyage.refetch()} />
        </div>
      ) : v ? (
        <>
          {v.tampons.length === 0 ? <p className={commun.vide}>Aucun tampon encore</p> : null}
          <ul className={styles.liste}>
            {decenniesDuPasseport(v).map((d) => (
              <PageDuPasseport key={d} v={v} decennie={d} />
            ))}
          </ul>
        </>
      ) : (
        <p className={commun.vide}>…</p>
      )}
    </section>
  )
}
