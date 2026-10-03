import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { JournalItem } from '../../api/journal'
import type { Voyage } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import Panne from '../../ui/Panne'
import { chemin, phraseDuChemin, vusEnAvance } from '../annee'
import { tropLent } from '../regles'
import Corde from './Corde'
import Fronton from './Fronton'
import styles from './AnneeFermee.module.css'

/** L'espace insécable qui tient les guillemets à leur mot : jamais « » seul en début de ligne. */
export const INSECABLE = String.fromCharCode(0xa0)

interface Props {
  variante: 'fermee' | 'attente'
  monde: Monde
  annee: number
  voyage: Voyage
  /** Les films de l'année vus en avance, comptés par l'API (`profondeur` de la fiche). */
  profondeur: number
  /** Mon journal entier, lu pour cette seule forme ; nul tant qu'il charge. */
  journal: { items: readonly JournalItem[] | undefined; erreur: unknown; onReessayer: () => void }
  /** La parade d'une année en attente (le podium se pose déjà), branchée par la page. */
  parade?: ReactNode
}

/**
 * Une année qu'on ne peut pas encore ouvrir (maquette 1890, écran III : `initVerrou`, lignes 259 à
 * 282) : fermée jusqu'au ticket, ou en attente du Voyage suivi (« Théo est trop lent », `tropLent`). Mes
 * films de l'année déjà vus y comptent déjà ; ils se lisent dans mon journal.
 */
export default function AnneeFermee({ variante, monde, annee, voyage: v, profondeur, journal, parade }: Props) {
  const m = monde.pages.mots
  const attente = variante === 'attente'
  const lent = tropLent(v.source)
  const annees = chemin(annee, v.annee_en_cours)
  const vus = journal.items ? vusEnAvance(journal.items, annee) : []
  const nomDuChemin = `Chemin : ${annees[0]}, tu es ici${annees
    .slice(1)
    .map((a, i) => `, puis ${a}${i === annees.length - 2 ? ', fermée' : ''}`)
    .join('')}`

  return (
    <>
      <Fronton annee={annee} annonce={attente ? m.annonce.attente : m.annonce.fermee} millesime={attente ? 'attente' : 'fermee'} monde={monde}>
        {attente && lent ? <span className={styles.banderole}>{lent}</span> : null}
      </Fronton>

      <Corde
        nom="Tes films vus en avance"
        billets={[{ cle: 'films', valeur: profondeur, total: null, libelle: profondeur > 1 ? 'films vus en avance' : 'film vu en avance', tete: 'En avance' }]}
      />

      {attente ? (
        <section className={styles.papier} aria-label="En attendant">
          <p className={styles.texte}>
            {v.source
              ? `${v.source.pseudo} n’a pas encore ouvert ${annee} : sa roulotte est encore en ${v.source.annee_en_cours}. L’ouverture, les salles et les films s’installeront ici dès son passage, sans rien à faire de ton côté.`
              : `Le Voyage que tu suis n’a pas encore ouvert ${annee}. L’ouverture, les salles et les films s’installeront ici dès son passage, sans rien à faire de ton côté.`}
          </p>
          <div className={styles.echos}>
            <h2>En attendant</h2>
            <ul>
              <li>{`Tes films vus en avance comptent déjà pour ${annee}.`}</li>
              <li>Ton podium se pose dès maintenant.</li>
            </ul>
          </div>
        </section>
      ) : (
        <>
          <div className={styles.pancarte}>
            <b>{m.fermee.pancarte}</b>
            {`Cette année s’ouvre avec le ticket de ${annee - 1}.`}
          </div>
          <ol className={styles.chemin} aria-label={nomDuChemin}>
            {annees.map((a, i) => (
              <li key={a} className={i === 0 ? styles.ici : styles.ferme} aria-hidden="true">
                {a}
                {i === 0 ? <small>ici</small> : i === annees.length - 1 ? <small>fermée</small> : null}
              </li>
            ))}
          </ol>
          <p className={styles.encore}>{phraseDuChemin(annee, v.annee_en_cours, { ia: v.ia, rattrape: v.rattrape_la_source && v.source ? v.source.pseudo : null })}</p>
        </>
      )}

      {journal.erreur ? (
        <div className={styles.panne}>
          <Panne erreur={journal.erreur} onReessayer={journal.onReessayer} />
        </div>
      ) : vus.length > 0 ? (
        <section aria-label={`${m.fermee.dejaVus} ${m.fermee.enAvance}`}>
          <p className={styles.titreSec}>
            {m.fermee.dejaVus} <small>{m.fermee.enAvance}</small>
          </p>
          <ul className={`${styles.planches} ${monde.traitement.affiches === 'sepia' ? styles.sepia : monde.traitement.affiches === 'gris' ? styles.gris : ''}`}>
            {vus.map((item) => (
              <li key={item.entry.id}>
                <Link to={`/journal/${item.entry.id}`} state={{ item, depuis: `/voyage/${annee}` }} className={styles.cab}>
                  {item.media.cover_url ? <img src={item.media.cover_url} alt="" loading="lazy" decoding="async" /> : <span className={styles.sansImage} />}
                  <span className={styles.t}>{item.media.title}</span>
                  <span className={styles.e}>{item.entry.rating !== null ? `vu · ${item.entry.rating}/10` : 'vu'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {parade}

      <div className={styles.intertitre}>
        {monde.chapitre ? <p>{monde.chapitre}</p> : null}
        <strong>{monde.nom}</strong>
        <em>
          {m.intertitre}
          {monde.titreVoyageur ? ` Au bout des années ${monde.decennie}, le tampon «${INSECABLE}${monde.titreVoyageur}${INSECABLE}».` : null}
        </em>
      </div>
    </>
  )
}
