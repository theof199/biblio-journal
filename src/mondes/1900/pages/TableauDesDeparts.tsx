import { memo } from 'react'
import { Link } from 'react-router-dom'
import { useMouvementReduit } from '../../../ui/mouvement'
import type { MotsDesPages } from '../../types'
import type { Vue } from '../../../voyage/catalogue'
import type { PropsCatalogueDuGuichet } from '../../../voyage/recherche/Catalogue'
import { LES_FILMS_DU_CATALOGUE, LE_CATALOGUE_SE_CHARGE, compteDesResultats, etatLisible, phraseDesPannes, souligne } from '../../../voyage/recherche/lisible'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { ENTRE_DEUX_REGLETTES, ENTRE_LE_NOM_ET_L_ETAT, MOTS_DU_GUICHET as M, REGLETTES_ECHELONNEES } from './guichet'
import Rubrique from './Rubrique'
import styles from './Guichet.module.css'

/**
 * Les réglettes du tableau : un départ par vue, l'année, le film, la voie. Mémorisées comme les
 * lignes du catalogue par défaut : la lettre tapée se montre d'abord, le tableau se refait ensuite.
 * Sous le titre, le réalisateur (souligné quand c'est lui que la saisie trouve) et l'état du film ;
 * une bobine n'a pas de réalisateur, son état se dit seul, sans tiret devant.
 */
const Reglettes = memo(function Reglettes({ vues, saisie, mots: m, calme }: { vues: Vue[]; saisie: string; mots: MotsDesPages; calme: boolean }) {
  return (
    <ol className={styles.reglettes} aria-label={LES_FILMS_DU_CATALOGUE}>
      {vues.map((vue, i) => (
        <li key={vue.tmdbId} style={calme ? undefined : { animationDelay: `${Math.min(i, REGLETTES_ECHELONNEES) * ENTRE_DEUX_REGLETTES}ms` }}>
          <Link to={`/voyage/${vue.annee}/films/${vue.filmId}`} className={styles.depart}>
            <b>{vue.annee}</b>
            {/* Les espaces ne se voient pas (chaque case est un bloc) : elles séparent les cases au lecteur d'écran. */}{' '}
            <span className={styles.film}>
              <span className={styles.titre}>{souligne(vue.titre, saisie)}</span>{' '}
              <small>
                {vue.realisateur ? (
                  <>
                    {souligne(vue.realisateur, saisie)}
                    {ENTRE_LE_NOM_ET_L_ETAT}
                  </>
                ) : null}
                {etatLisible(vue, m)}
              </small>
            </span>{' '}
            <i>
              <span className={styles.lecteur}>{`${M.voie} `}</span>
              {vue.voie}
            </i>
          </Link>
        </li>
      ))}
    </ol>
  )
})

/**
 * Le tableau des départs, le catalogue du guichet des années 1900 (maquette, écran 11 : `.departs`) :
 * la réponse du guichetier sur un tableau peint, l'année, le film, la voie de sa salle. La voie est
 * celle que la page lit (`Vue.voie`, le numéro que la fiche d'année donne à la salle) : rien n'est
 * numéroté ici. Les années se cochent sur des plaques, au-dessus ; le titre de la page est le sien.
 *
 * Il ne cherche rien : les vues arrivent cherchées. Ne bougent, sous la racine vivante, que les
 * réglettes qui glissent à leur place.
 */
export default function TableauDesDeparts({ monde, annees, cochees, onBasculer, vues, saisie, aLAffiche, enCours, enPanne, vide }: PropsCatalogueDuGuichet) {
  const m = monde.pages.mots
  const calme = useMouvementReduit()
  return (
    <div className={styles.racine} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      {annees.length > 0 ? (
        <div className={styles.annees} role="group" aria-label={M.annees}>
          {annees.map((a) => (
            <button key={a} type="button" aria-pressed={cochees.has(a)} onClick={() => onBasculer(a)}>
              {a}
            </button>
          ))}
        </div>
      ) : null}
      <Rubrique balise="h1">{m.recherche.catalogue}</Rubrique>
      <div className={styles.departs}>
        <p className={styles.sous} aria-live="polite">
          {aLAffiche ? m.recherche.affiche : compteDesResultats(vues.length)}
        </p>
        {enCours ? (
          <p role="status" className={styles.aucun}>
            {LE_CATALOGUE_SE_CHARGE}
          </p>
        ) : null}
        {enPanne > 0 ? <p className={styles.aucun}>{phraseDesPannes(enPanne)}</p> : null}
        {vues.length > 0 ? (
          <>
            <div className={styles.ent} aria-hidden="true">
              <span>{M.annee}</span>
              <span>{M.film}</span>
              <span>{M.voie}</span>
            </div>
            <Reglettes vues={vues} saisie={saisie} mots={m} calme={calme} />
          </>
        ) : enCours ? null : (
          <p className={styles.aucun}>{vide}</p>
        )}
      </div>
    </div>
  )
}
