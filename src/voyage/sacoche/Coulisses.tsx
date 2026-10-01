import { useId, useState } from 'react'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireDepenses } from '../../api/voyage'
import Panne from '../../ui/Panne'
import { CREDITS, lignesDesDepenses, moisEnUTC } from '../sacoche'
import commun from './Sacoche.module.css'
import styles from './Coulisses.module.css'

/**
 * Les dépenses au chroniqueur : montées au dépli des Coulisses seulement, donc lues à ce moment-là,
 * jamais à l'ouverture de la sacoche. Rien ne s'affiche avant la réponse, ni pour une liste vide (tout
 * membre hors du compte IA) : la ligne ne paraît pas pour disparaître aussitôt. Une panne, elle, se dit.
 */
function Depenses() {
  const depenses = useQuery({ queryKey: cles.depenses, queryFn: ({ signal }) => lireDepenses(signal) })
  if (depenses.error) {
    return (
      <section className={styles.bloc} aria-label="Dépenses">
        <h3 className={styles.titre}>Dépenses</h3>
        <div className={commun.panne}>
          <Panne erreur={depenses.error} onReessayer={() => void depenses.refetch()} />
        </div>
      </section>
    )
  }
  const lignes = depenses.data ? lignesDesDepenses(depenses.data.mois, moisEnUTC()) : null
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

/** Les crédits des images du Voyage, lus dans les `CREDITS.md` (`sacoche.ts`), jamais recopiés. */
function Credits() {
  return (
    <section className={styles.bloc} aria-label="Crédits des images">
      <h3 className={styles.titre}>Crédits des images</h3>
      {CREDITS.map((groupe) => (
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
 * Les Coulisses (reprise de `CoulissesSection`, Android) : repliées au premier rendu, en bas de la
 * sacoche ; dépliées, les dépenses au chroniqueur et les crédits des images. Ce qui coûte ou
 * s'attribue n'a pas à s'imposer au niveau du passeport et du portefeuille.
 */
export default function Coulisses() {
  const [depliees, setDepliees] = useState(false)
  const id = useId()
  return (
    <section className={commun.bloc} aria-labelledby={`${id}-titre`}>
      <h2 className={commun.titreSec} id={`${id}-titre`}>
        <button
          type="button"
          className={styles.bascule}
          aria-expanded={depliees}
          aria-controls={depliees ? `${id}-contenu` : undefined}
          onClick={() => setDepliees((d) => !d)}
        >
          <span>Coulisses</span>
          {depliees ? <IconChevronDown size={18} aria-hidden="true" /> : <IconChevronRight size={18} aria-hidden="true" />}
        </button>
      </h2>
      {depliees ? (
        <div id={`${id}-contenu`} className={styles.contenu}>
          <Depenses />
          <Credits />
        </div>
      ) : null}
    </section>
  )
}
