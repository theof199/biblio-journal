import { Link } from 'react-router-dom'
import Panne from '../../../ui/Panne'
import { chemin, phraseDuChemin, vusEnAvance } from '../../../voyage/annee'
import { INSECABLE, type PropsAnneeFermee } from '../../../voyage/annee/AnneeFermee'
import { tropLent } from '../../../voyage/regles'
import Rubrique from './Rubrique'
import styles from './VoieFermee.module.css'

/**
 * Le corps d'une année 1900 qu'on ne peut pas encore ouvrir (maquette, écrans 12 et 16) : une plaque
 * de verre à développer, fermée jusqu'au ticket, ou une voie qui attend le Voyage suivi. La tête
 * porte l'année et son état : rien ne s'en répète ici. Tout ce que le corps par défaut offre y est :
 * la banderole, mes films vus en avance et leurs liens, le chemin, la panne du journal, la parade
 * que la page a montée, l'intertitre.
 */
export default function VoieFermee({ variante, monde, annee, voyage: v, profondeur, journal, parade }: PropsAnneeFermee) {
  const m = monde.pages.mots
  const attente = variante === 'attente'
  const lent = tropLent(v.source)
  const annees = chemin(annee, v.annee_en_cours)
  const vus = journal.items ? vusEnAvance(journal.items, annee) : []
  const enAvance = profondeur > 1 ? 'films vus en avance' : 'film vu en avance'
  const nomDuChemin = `Chemin : ${annees[0]}, tu es ici${annees
    .slice(1)
    .map((a, i) => `, puis ${a}${i === annees.length - 2 ? ', fermée' : ''}`)
    .join('')}`

  return (
    <>
      {attente && lent ? <span className={styles.banderole}>{lent}</span> : null}

      <ul className={styles.avance} aria-label="Tes films vus en avance">
        <li aria-label={`${profondeur} ${enAvance}`}>
          <b>{profondeur}</b> {enAvance}
        </li>
      </ul>

      {attente ? (
        <section className={styles.guide} aria-label="En attendant">
          <p>
            {v.source
              ? `${v.source.pseudo} n’a pas encore ouvert ${annee} : son train est encore en gare de ${v.source.annee_en_cours}. La voie attend son passage : le guide, les correspondances et les films s’installeront ici dès qu’il arrive, sans rien à faire de ton côté.`
              : `Le Voyage que tu suis n’a pas encore ouvert ${annee}. La voie attend son passage : le guide, les correspondances et les films s’installeront ici dès qu’il arrive, sans rien à faire de ton côté.`}
          </p>
          <h2>En attendant</h2>
          <ul>
            <li>{`Tes films vus en avance comptent déjà pour ${annee}.`}</li>
            <li>Ton podium se pose dès maintenant.</li>
          </ul>
        </section>
      ) : (
        <>
          <div className={styles.cuve}>
            <b>{m.fermee.pancarte}</b>
            {`${annee} est encore un négatif : cette année s’ouvre avec le ticket de ${annee - 1}, qui la plonge dans le révélateur.`}
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
          <Rubrique balise="p">
            {m.fermee.dejaVus} <small>{m.fermee.enAvance}</small>
          </Rubrique>
          <ul className={styles.vus}>
            {vus.map((item) => (
              <li key={item.entry.id}>
                <Link to={`/journal/${item.entry.id}`} state={{ item, depuis: `/voyage/${annee}` }} className={styles.compartiment}>
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
