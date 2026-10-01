import { Link } from 'react-router-dom'
import type { Monde } from '../../mondes/types'
import Embleme from '../annee/Embleme'
import type { LigneDuRegistre } from '../decennie'
import { RATTRAPE } from '../regles'
import styles from './Registre.module.css'

interface Props {
  monde: Monde
  lignes: readonly LigneDuRegistre[]
  /** Le départ du Voyage : une année sans page d'après lui est à venir (« Prochainement »). */
  depart: number
  /** Les notes se lisent dans mon journal : absentes tant qu'il n'est pas lu, ou en panne. */
  notes: boolean
  /** Ce que dit une année en attente du Voyage suivi (`tropLent`) ; nul sans voyageur suivi. */
  tropLent: string | null
  /** L'année en cours de la lectrice, derrière le voyageur suivi (`rattrapeBientot`) : sa ligne le dit. */
  rattrape: boolean
}

/**
 * Le registre des recettes (maquette 1890 : `.registre`, `.ligne-an`, écran IV) : une ligne par
 * année de la décennie, ses films vus, sa récompense, ma meilleure note. Une année qui a sa page est
 * un lien vers elle : le chemin du clavier et du lecteur d'écran, que le manège n'offre pas.
 */
export default function Registre({ monde, lignes, depart, notes, tropLent, rattrape }: Props) {
  const m = monde.pages.mots
  const texte = (l: LigneDuRegistre) => {
    if (!l.ouvrable && l.annee >= depart) return m.decennie.prochainement
    // Une année que le Voyage suivi n'a pas encore ouverte : les mots de la carte, jamais « en cours ».
    if (l.attente && tropLent) return l.vus === 0 ? tropLent : `${l.vus} vu${l.vus > 1 ? 's' : ''} · ${tropLent}`
    // Derrière le voyageur suivi, l'année en cours l'ajoute à son état, sans le remplacer.
    const derriere = l.enCours && rattrape ? ' · tu le rattrapes bientôt' : ''
    if (l.vus === 0) return derriere ? RATTRAPE : '—'
    const vus = `${l.vus} vu${l.vus > 1 ? 's' : ''}`
    return l.enAvance ? `${vus} ${m.fermee.enAvance}` : l.enCours ? `${vus} · en cours${derriere}` : vus
  }

  return (
    <section className={styles.registre} aria-labelledby="registre-titre">
      <h2 id="registre-titre" className={styles.titre}>
        {m.decennie.registre}
      </h2>
      <ul className={styles.lignes}>
        {lignes.map((l) => {
          const classe = [styles.ligne, l.vus === 0 ? styles.terne : '', l.enCours ? styles.ici : ''].filter(Boolean).join(' ')
          const contenu = (
            <>
              <span className={styles.a}>{l.annee}</span>
              <span>{texte(l)}</span>
              {l.recompense ? <Embleme type={l.recompense} couleur={monde.couleur} className={styles.embleme} /> : <span />}
              <span className={styles.n}>{notes && l.meilleureNote !== null ? `${l.meilleureNote}/10` : ''}</span>
            </>
          )
          return (
            <li key={l.annee}>
              {l.ouvrable ? (
                <Link to={`/voyage/${l.annee}`} className={classe}>
                  {contenu}
                </Link>
              ) : (
                <div className={classe}>{contenu}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
