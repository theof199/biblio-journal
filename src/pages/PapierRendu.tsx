import type { CSSProperties, ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import type { JournalItem } from '../api/journal'
import type { Reaction } from '../api/reactions'
import { decoupe } from '../formulaire/decoupe'
import type { LigneEnBref, LigneSuivi } from '../formulaire/enBref'
import { rangEnLettres } from '../formulaire/enBref'
import { legendeDeFilm } from '../formulaire/legende'
import { verdictDe } from '../formulaire/verdict'
import { useSession } from '../session/SessionContext'
import Affiche from '../ui/Affiche'
import Etoiles from '../ui/Etoiles'
import { espaceInsecable, formatDateVisionnage } from '../ui/format'
import styles from './PapierRendu.module.css'

/** Ce que le formulaire donne à la coupure en navigant : de quoi la composer sans rien demander. */
export interface EtatPapier {
  item: JournalItem
  /** Les réactions posées, avec leur emoji et leur phrase : lues dans le catalogue que le formulaire avait déjà. */
  reactions: Reaction[]
  /** Calculé par le formulaire avant les invalidations, qui vident le cache dont il dépend. */
  enBref: LigneEnBref[]
}

/** Au-delà de ce nombre de caractères, la remarque se met en colonne ; en deçà, la note fait la une. */
const REMARQUE_LONGUE = 110

/** Un titre de plus de ce nombre de caractères s'imprime d'un corps plus petit. */
const TITRE_LONG = 28

/** Une coupure : le papier d'un journal d'aujourd'hui, découpée aux ciseaux (`--decoupe`) selon son entrée. */
function Coupure({ graine, bref = false, children }: { graine: string; bref?: boolean; children: ReactNode }) {
  return (
    <article className={bref ? `${styles.cadre} ${styles.bref}` : styles.cadre}>
      <div className={styles.coupure} style={{ '--decoupe': decoupe(graine) } as CSSProperties}>
        {children}
      </div>
    </article>
  )
}

/** La note qui fait la une d'une remarque courte : de grandes étoiles, le verdict en lettres de fronton, « 8 sur 10 ». */
function NoteALaUne({ note }: { note: number }) {
  return (
    <>
      <Etoiles note={note} className={styles.grandesEtoiles} />
      <p className={styles.mot}>{verdictDe(note)}</p>
      <p className={styles.sur}>{note} sur 10</p>
    </>
  )
}

function CorpsDeLaCritique({ item }: { item: JournalItem }) {
  const note = item.entry.rating
  const remarque = item.carnet.comment?.trim() ?? ''
  const affiche = <Affiche src={item.media.cover_url} titre={item.media.title} className={styles.affiche} />

  // Un vrai papier se met en colonne ; quelques mots, ou rien, laissent la une à la note.
  if (remarque.length > REMARQUE_LONGUE) {
    return (
      <>
        {note != null ? (
          <p className={styles.verdictImprime}>
            <Etoiles note={note} className={styles.etoilesImprimees} />
            <b>{verdictDe(note)}</b>
            <span className={styles.surDix}>{note} sur 10</span>
          </p>
        ) : null}
        <div className={styles.colonne}>
          {affiche}
          <p className={styles.texte}>{remarque}</p>
        </div>
      </>
    )
  }
  return (
    <>
      <div className={styles.manchette}>
        {affiche}
        <div className={styles.avis}>
          {note != null ? <NoteALaUne note={note} /> : <p className={styles.sur}>Vu le {formatDateVisionnage(item.entry.finished_at)}, sans note.</p>}
        </div>
      </div>
      {remarque ? <p className={styles.citation}>« {remarque} »</p> : null}
    </>
  )
}

/** Une ligne de « En bref » : son titre en gras, puis ce que la séance fait avancer. */
function LigneBref({ ligne }: { ligne: LigneEnBref }) {
  if (ligne.type === 'suivi') return <LigneDeSuivi ligne={ligne} />
  if (ligne.type === 'seance') {
    return (
      <p className={styles.texte}>
        <b>{espaceInsecable(ligne.titre)}.</b> {rangEnLettres(ligne.rang)} séance au journal.
      </p>
    )
  }
  return (
    <p className={styles.texte}>
      <b>{ligne.mois}.</b> {rangEnLettres(ligne.rang)} film du mois.
    </p>
  )
}

/** « Rétrospective Agnès Varda. 10 séances sur 22. », « Bouclée ! » en rouge si elle l'est, puis un trou par film. */
function LigneDeSuivi({ ligne }: { ligne: LigneSuivi }) {
  return (
    <>
      <p className={styles.texte}>
        <b>
          {ligne.genre} {ligne.nom}.
        </b>{' '}
        {ligne.vus} {ligne.vus > 1 ? 'séances' : 'séance'} sur {ligne.total}.
        {ligne.boucle ? <em className={styles.boucle}> {ligne.genre === 'Cycle' ? 'Bouclé !' : 'Bouclée !'}</em> : null}
      </p>
      <div className={styles.trous} aria-hidden="true">
        {ligne.trous.map((etat, rang) => (
          <i key={rang} data-etat={etat} className={styles.trou} />
        ))}
      </div>
    </>
  )
}

/**
 * Le papier rendu : la critique que le membre vient d'écrire, imprimée comme dans un journal (une
 * coupure de presse, découpée aux ciseaux), puis « En bref », ce que la séance fait avancer. Tout
 * vient de l'état de navigation du formulaire : aucune requête ne part d'ici, et sans cet état
 * (rechargement, accès direct) la page renvoie à l'accueil — la critique est déjà au journal.
 */
export default function PapierRendu() {
  const { user } = useSession()
  const etat = useLocation().state as EtatPapier | null
  if (!etat?.item) return <Navigate to="/" replace />

  const { item, reactions, enBref } = etat
  const legende = legendeDeFilm(item.media.director, item.media.year)

  return (
    <div className={styles.page}>
      <p className={styles.annonce}>Papier rendu</p>

      <Coupure graine={item.entry.id}>
        <p className={styles.rubrique}>
          <b>Critique</b>
          <span>{formatDateVisionnage(item.entry.finished_at)}</span>
        </p>
        <h1 className={item.media.title.length > TITRE_LONG ? `${styles.titre} ${styles.long}` : styles.titre}>{espaceInsecable(item.media.title)}</h1>
        {legende ? <p className={styles.sous}>{legende}</p> : null}
        <CorpsDeLaCritique item={item} />
        {reactions.length > 0 ? (
          <div className={styles.reactions}>
            {reactions.map((reaction) => (
              <span key={reaction.cle} className={styles.reaction}>
                {`${reaction.emoji} ${reaction.phrase}`}
              </span>
            ))}
          </div>
        ) : null}
        <p className={styles.signature}>{user.pseudo}</p>
      </Coupure>

      {enBref.length > 0 ? (
        <Coupure graine={`${item.entry.id}:bref`} bref>
          <p className={styles.rubrique}>
            <b>En bref</b>
            <span>ça avance</span>
          </p>
          {enBref.map((ligne, rang) => (
            <LigneBref key={rang} ligne={ligne} />
          ))}
        </Coupure>
      ) : null}

      <div className={styles.suite}>
        <Link to="/" className={styles.accueil}>
          À l’accueil
        </Link>
        <Link to="/recherche" className={styles.autre}>
          Un autre film
        </Link>
      </div>
    </div>
  )
}
