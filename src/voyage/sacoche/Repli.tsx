import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import Panne from '../../ui/Panne'
import type { GroupeDeCredits, LignesDesDepenses, PanneDeBloc } from '../sacoche'
import commun from './Sacoche.module.css'
import styles from './Coulisses.module.css'

/**
 * Ce que reçoivent les Coulisses, par défaut ou du monde (`GabaritsDesPages.coulisses`) : le pli et
 * son geste, les dépenses déjà lues et dites, les crédits. `Coulisses.tsx` garde le pli et la
 * lecture des dépenses, qui ne part qu'au dépli : le dessin ne lit rien.
 */
export interface PropsCoulisses {
  /**
   * Les deux identifiants que la page tient : `titre` va sur le titre du bloc, qui nomme la région
   * que `Coulisses.tsx` garde ; `contenu` sur ce qui se déplie, que le bouton du pli désigne.
   */
  ids: { titre: string; contenu: string }
  /** Repliées au premier rendu : rien de leur contenu ne se montre tant qu'elles le sont. */
  depliees: boolean
  basculer: () => void
  /** Les dépenses sont en panne : une panne se dit, là où la ligne se serait montrée. */
  panneDesDepenses: PanneDeBloc | null
  /**
   * Les lignes des dépenses (`lignesDesDepenses`) ; nul avant la réponse comme pour une liste vide
   * (tout membre hors du compte IA) : la rubrique ne se montre alors pas.
   */
  depenses: LignesDesDepenses | null
  /** Les crédits des images, lus dans les `CREDITS.md`. */
  credits: readonly GroupeDeCredits[]
}

function Depenses({ panne, lignes }: { panne: PanneDeBloc | null; lignes: LignesDesDepenses | null }) {
  if (panne) {
    return (
      <section className={styles.bloc} aria-label="Dépenses">
        <h3 className={styles.titre}>Dépenses</h3>
        <div className={commun.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      </section>
    )
  }
  if (!lignes) return null
  return (
    <section className={styles.bloc} aria-label="Dépenses">
      <h3 className={styles.titre}>Dépenses</h3>
      <p className={styles.ligne}>{lignes.courant}</p>
      {lignes.precedents.map((l) => (
        <p key={l} className={styles.precedent}>
          {l}
        </p>
      ))}
      <p className={styles.note}>Une estimation au tarif public d’Anthropic : la facture du compte Anthropic fait foi.</p>
    </section>
  )
}

function Credits({ credits }: { credits: readonly GroupeDeCredits[] }) {
  return (
    <section className={styles.bloc} aria-label="Crédits des images">
      <h3 className={styles.titre}>Crédits des images</h3>
      {credits.map((groupe) => (
        <div key={groupe.titre} className={styles.groupe}>
          <h4 className={styles.sousTitre}>{groupe.titre}</h4>
          <ul className={styles.liste}>
            {groupe.credits.map((c) => (
              <li key={c.fichier} className={styles.credit}>
                <span className={styles.oeuvre}>{c.oeuvre}</span>
                <span className={styles.precedent}>{c.licence}</span>
                {c.source ? (
                  <a className={styles.source} href={c.source} target="_blank" rel="noreferrer">
                    {`Source : ${c.fichier}`}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/**
 * Les Coulisses par défaut (reprise de `CoulissesSection`, Android) : repliées sous leur titre de
 * section, en bas de la sacoche ; dépliées, les dépenses au chroniqueur et les crédits des images.
 */
export default function Repli({ ids, depliees, basculer, panneDesDepenses, depenses, credits }: PropsCoulisses) {
  return (
    <>
      <h2 className={commun.titreSec} id={ids.titre}>
        <button type="button" className={styles.bascule} aria-expanded={depliees} aria-controls={depliees ? ids.contenu : undefined} onClick={basculer}>
          <span>Coulisses</span>
          {depliees ? <IconChevronDown size={18} aria-hidden="true" /> : <IconChevronRight size={18} aria-hidden="true" />}
        </button>
      </h2>
      {depliees ? (
        <div id={ids.contenu} className={styles.contenu}>
          <Depenses panne={panneDesDepenses} lignes={depenses} />
          <Credits credits={credits} />
        </div>
      ) : null}
    </>
  )
}
