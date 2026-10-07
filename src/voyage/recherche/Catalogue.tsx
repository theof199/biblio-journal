import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { Monde, MotsDesPages } from '../../mondes/types'
import type { Vue } from '../catalogue'
import { LE_CATALOGUE_SE_CHARGE, compteDesResultats, etatLisible, phraseDesPannes, souligne } from './lisible'
import styles from '../../pages/VoyageRecherche.module.css'

/**
 * Ce que reçoit le catalogue du guichet, par défaut ou du monde
 * (`GabaritsDesPages.catalogueDuGuichet`) : ce que la page a lu et cherché, jamais de quoi chercher.
 */
export interface PropsCatalogueDuGuichet {
  monde: Monde
  decennie: number
  /** Les années qui se cochent : celles dont la fiche est prête, et elles seules. */
  annees: readonly number[]
  /** Celles qui le sont. */
  cochees: ReadonlySet<number>
  onBasculer: (annee: number) => void
  /** Les vues à montrer, déjà cherchées et rangées : les plus demandées, ou ce que la saisie trouve. */
  vues: Vue[]
  /** La saisie dont ces vues sont la réponse (différée par la page) : le passage à souligner. */
  saisie: string
  /** Ni saisie ni année cochée : ces vues sont « les plus demandées », pas un résultat. */
  aLAffiche: boolean
  /** Une fiche du catalogue se lit encore. */
  enCours: boolean
  /** Le nombre de fiches qui n'ont pas pu être lues. */
  enPanne: number
  /** La phrase à dire quand aucune vue n'est à montrer, que la page choisit. */
  vide: string
}

/**
 * Les lignes du catalogue. Mémorisées : la lettre tapée se montre au champ aussitôt, et la liste,
 * qui peut compter des centaines de lignes sur une décennie explorée, se refait ensuite, sur la
 * saisie différée (`useDeferredValue`), sans retenir la frappe.
 */
const ListeDuCatalogue = memo(function ListeDuCatalogue({ vues, saisie, mots: m }: { vues: Vue[]; saisie: string; mots: MotsDesPages }) {
  return (
    <ol className={styles.liste} aria-label="Les films du catalogue">
      {vues.map((vue, i) => (
        <li key={vue.tmdbId}>
          <Link to={`/voyage/${vue.annee}/films/${vue.filmId}`} className={styles.entree}>
            <span className={styles.l1}>
              <span className={styles.no} aria-hidden="true">{`N° ${i + 1}`}</span>
              <span className={styles.ti}>{souligne(vue.titre, saisie)}</span>
              <span className={styles.points} aria-hidden="true" />
              <span className={styles.an}>{vue.annee}</span>
            </span>
            <span className={styles.l2}>
              <span>{souligne(vue.realisateur, saisie)}</span>
              <span>{etatLisible(vue, m)}</span>
            </span>
            <span className={styles.ouvrir}>{`${m.recherche.ouvrir} ›`}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
})

/** Le catalogue par défaut : les années en tampons, puis le catalogue des vues sur sa feuille. */
export default function Catalogue({ monde, annees, cochees, onBasculer, vues, saisie, aLAffiche, enCours, enPanne, vide }: PropsCatalogueDuGuichet) {
  const m = monde.pages.mots
  return (
    <>
      {annees.length > 0 ? (
        <div className={styles.annees} role="group" aria-label="Années">
          {annees.map((a) => (
            <button key={a} type="button" aria-pressed={cochees.has(a)} onClick={() => onBasculer(a)}>
              {a}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.catalogue}>
        <h1 className={styles.titre}>{m.recherche.catalogue}</h1>
        <p className={styles.sous} aria-live="polite">
          {aLAffiche ? m.recherche.affiche : compteDesResultats(vues.length)}
        </p>
        {enCours ? (
          <p role="status" className={styles.rien}>
            {LE_CATALOGUE_SE_CHARGE}
          </p>
        ) : null}
        {enPanne > 0 ? <p className={styles.rien}>{phraseDesPannes(enPanne)}</p> : null}
        {vues.length > 0 ? <ListeDuCatalogue vues={vues} saisie={saisie} mots={m} /> : enCours ? null : <p className={styles.rien}>{vide}</p>}
      </div>
    </>
  )
}
