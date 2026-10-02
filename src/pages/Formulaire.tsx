import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { corrigerVisionnage, creerVisionnage, filmDejaVu, supprimerVisionnage } from '../api/journal'
import { basculerReaction, lireReactions } from '../api/reactions'
import { compterReactions } from '../profil/bilan'
import { enBrefEnCache } from '../formulaire/enBrefEnCache'
import { journalEnCache, numeroDeBillet, totalDuJournal } from '../formulaire/journalEnCache'
import { brouillonInitial, construirePatch } from '../formulaire/patch'
import { reactionsFavorites, reactionsVisibles } from '../formulaire/reactionsVisibles'
import RangeeDeNote from '../formulaire/RangeeDeNote'
import Tampons from '../formulaire/Tampons'
import { useHauteurAuto } from '../formulaire/useHauteurAuto'
import { noteEnMots } from '../formulaire/verdict'
import { useMasquerIntrouvables } from '../suivis/masquer'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import { formatDateVisionnage, jourLocal, sousTitre } from '../ui/format'
import styles from './Formulaire.module.css'
import type { CandidatFilm } from '../formulaire/candidat'
import type { JournalItem } from '../api/journal'
import type { EtatPapier } from './PapierRendu'

interface EtatCreation {
  candidat: CandidatFilm
}
interface EtatCorrection {
  item: JournalItem
  /** La page qui avait ouvert la fiche, rendue à la fiche au retour (`Fiche.tsx`). */
  depuis?: string
  /**
   * Où revenir une fois la correction faite, à la place de l'accueil : le rapport d'import qui a
   * ouvert le formulaire (`ImportLetterboxd.tsx`) se retrouve ainsi, ses lignes tranchées comprises.
   */
  retour?: string
}

/** « Déjà vu le 14 mars 2024, noté 9. Ce sera une 2ᵉ séance. » : la ligne au crayon d'un film que le journal connaît déjà. */
function rappelDejaVu(vu: { finished_at: string; rating: number | null; seances: number }): string {
  const note = vu.rating != null ? `, noté ${vu.rating}` : ''
  return `Déjà vu le ${formatDateVisionnage(vu.finished_at)}${note}. Ce sera une ${vu.seances + 1}ᵉ séance.`
}

/**
 * Le billet du critique : le film et sa remarque, en création (`/journal/nouveau`, depuis la
 * recherche ou « Ensuite ») et en correction (`/journal/:id/corriger`, depuis la fiche) — reprise de
 * `FormScreen.kt`. Un billet de presse, puis la page de notes du carnet dessous. Ses lignes « en
 * plus » (le numéro du billet, le rappel d'une séance passée, les trois réactions les plus posées)
 * ne viennent que du cache de requêtes (`formulaire/journalEnCache.ts`), jamais d'un appel de plus.
 * L'état de navigation porte le film ou l'entrée : sans lui (accès direct, rechargement de page), la page
 * renvoie vers la recherche ou l'accueil plutôt que de tenter un appel que l'API ne sait pas servir
 * (il n'existe pas de `GET /me/journal/{id}`).
 */
export default function Formulaire() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const naviguer = useNavigate()
  const client = useQueryClient()

  const correction = Boolean(id)
  const etatCorrection = correction ? (location.state as EtatCorrection | null) : null
  const item = etatCorrection?.item
  const candidat = !correction ? (location.state as EtatCreation | null)?.candidat : undefined

  const [brouillon, setBrouillon] = useState(() => brouillonInitial(item, candidat))
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)
  const [reactionsDepliees, setReactionsDepliees] = useState(false)
  const zoneRemarque = useRef<HTMLTextAreaElement>(null)
  useHauteurAuto(zoneRemarque, brouillon.remarque)

  // Lus une fois, à l'ouverture : le cache ne bouge pas pendant qu'on remplit le billet, et ni le
  // numéro ni le rappel ne doivent changer sous les doigts. Rien de tout cela en correction : le
  // billet existe déjà, il n'a pas de numéro à venir ni de séance à rappeler.
  const [numero] = useState(() => (correction ? null : numeroDeBillet(totalDuJournal(client))))
  const [dejaVu] = useState(() => {
    const journal = candidat ? journalEnCache(client) : null
    return candidat && journal ? filmDejaVu(journal.items, candidat.external_id) : null
  })

  const reactions = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal) })
  const catalogue = useMemo(() => reactions.data?.reactions ?? [], [reactions.data])
  const ordre = catalogue.map((r) => r.cle)
  // Les trois les plus posées du journal déjà en cache, périmé ou non : à défaut, les trois premières du catalogue.
  const favorites = useMemo(
    () => reactionsFavorites(compterReactions(journalEnCache(client, { perime: true })?.items ?? [], catalogue), catalogue),
    [client, catalogue],
  )
  const reactionsMontrees = reactionsVisibles(catalogue, favorites, brouillon.reactions, reactionsDepliees)
  const reactionsCachees = catalogue.length - reactionsVisibles(catalogue, favorites, brouillon.reactions, false).length

  const masquerIntrouvables = useMasquerIntrouvables()

  const perimerLesLectures = () => {
    // Par préfixe : `cles.journal` périme aussi `cles.seances` (« Tes séances », Au ciné), qui
    // commence par lui — le test « périme « Tes séances » » garde ce lien.
    void client.invalidateQueries({ queryKey: cles.journal })
    void client.invalidateQueries({ queryKey: cles.stats })
    void client.invalidateQueries({ queryKey: cles.voyage })
    // Un visionnage change le « vu » des filmographies et sagas suivies : sans ça, le carrousel
    // « Ensuite » reproposerait le film qu'on vient de journaliser.
    void client.invalidateQueries({ queryKey: cles.realisateurs })
    void client.invalidateQueries({ queryKey: cles.sagas })
  }

  const apresEcriture = () => {
    perimerLesLectures()
    naviguer(etatCorrection?.retour ?? '/', { replace: true })
  }

  // Une création rend le papier : la critique imprimée, puis « En bref ». Ce que « En bref » dit se lit
  // dans le cache **avant** les invalidations, qui le périment ; les réactions posées se résolvent dans
  // le catalogue déjà là, pour que la page du papier n'ait rien à demander.
  const apresCreation = (visionnage: JournalItem) => {
    const etat: EtatPapier = {
      item: visionnage,
      reactions: catalogue.filter((reaction) => visionnage.carnet.reactions.includes(reaction.cle)),
      enBref: enBrefEnCache(client, visionnage, masquerIntrouvables),
    }
    perimerLesLectures()
    naviguer(`/journal/${visionnage.entry.id}/papier`, { replace: true, state: etat })
  }

  const creation = useMutation({
    mutationFn: (c: CandidatFilm) =>
      creerVisionnage(
        { source: c.source, external_id: c.external_id, type: 'movie' },
        {
          finished_at: brouillon.date,
          rating: brouillon.note,
          reactions: brouillon.reactions.length > 0 ? brouillon.reactions : undefined,
          comment: brouillon.remarque.trim() || undefined,
        },
      ),
    onSuccess: apresCreation,
  })

  const correctionMutation = useMutation({
    mutationFn: (courant: JournalItem) => corrigerVisionnage(courant.entry.id, construirePatch(courant, brouillon)),
    onSuccess: apresEcriture,
  })

  const suppression = useMutation({
    mutationFn: (courant: JournalItem) => supprimerVisionnage(courant.entry.id),
    onSuccess: apresEcriture,
  })

  if (correction && !item) {
    return (
      <div className={styles.page}>
        <div className={styles.entete}>
          <BoutonRetour vers="/" />
        </div>
        <p>Ce visionnage n’est plus disponible. Repars de l’accueil.</p>
        <Link to="/">Retour à l’accueil</Link>
      </div>
    )
  }
  if (!correction && !candidat) {
    return (
      <div className={styles.page}>
        <div className={styles.entete}>
          <BoutonRetour vers="/recherche" />
        </div>
        <p>Aucun film choisi. Repars de la recherche.</p>
        <Link to="/recherche">Retour à la recherche</Link>
      </div>
    )
  }

  const titre = correction ? item!.media.title : candidat!.title
  const couverture = correction ? item!.media.cover_url : candidat!.cover_url
  const sous = correction ? sousTitre(item!.media.director, item!.media.year) : sousTitre(candidat!.director, candidat!.year)

  const mutation = correction ? correctionMutation : creation
  const erreur = mutation.error

  const enregistrer = () => {
    if (mutation.isPending) return
    suppression.reset()
    if (correction) correctionMutation.mutate(item!)
    else creation.mutate(candidat!)
  }

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        {/* La fiche vit de son état de navigation : sans l'entrée, elle répondrait « plus disponible ». */}
        <BoutonRetour
          vers={correction ? `/journal/${id}` : '/recherche'}
          etat={correction ? { item, depuis: etatCorrection?.depuis } : undefined}
        />
        <span className={styles.lieu}>{correction ? 'Corriger un visionnage' : 'Le guichet'}</span>
      </div>

      <article className={styles.billet}>
        <div className={styles.corps}>
          <header className={styles.tete}>
            <span>
              <span className={styles.presse}>Presse</span>Projection
            </span>
            {numero ? <b className={styles.numero}>{numero}</b> : null}
          </header>

          <div className={styles.film}>
            <Affiche src={couverture} titre={titre} className={styles.affiche} />
            <div className={styles.infosFilm}>
              <h1 className={styles.titreFilm}>{titre}</h1>
              {sous ? <p className={styles.sousTitreFilm}>{sous}</p> : null}
            </div>
          </div>

          {dejaVu ? <p className={styles.deja}>{rappelDejaVu(dejaVu)}</p> : null}

          <label className={styles.champ}>
            <span className={styles.rubrique}>Séance du</span>
            <input
              type="date"
              value={brouillon.date}
              max={jourLocal()}
              onChange={(event) => setBrouillon((b) => ({ ...b, date: event.target.value }))}
              className={styles.date}
            />
          </label>

          <section className={styles.champ}>
            <h2 className={styles.rubrique}>
              Mon avis{' '}
              {brouillon.note != null ? <span className={styles.verdict}>{noteEnMots(brouillon.note)}</span> : null}
            </h2>
            <RangeeDeNote note={brouillon.note} onChoisir={(note) => setBrouillon((b) => ({ ...b, note }))} />
          </section>

          <section className={styles.champ}>
            <h2 className={styles.rubrique}>
              Réactions{' '}
              {brouillon.reactions.length > 0 ? (
                <small className={styles.compte}>
                  {brouillon.reactions.length} {brouillon.reactions.length > 1 ? 'choisies' : 'choisie'}
                </small>
              ) : null}
            </h2>
            <Tampons
              reactions={reactionsMontrees}
              cochees={brouillon.reactions}
              onBasculer={(cle) => setBrouillon((b) => ({ ...b, reactions: basculerReaction(b.reactions, cle, ordre) }))}
              cachees={reactionsCachees}
              depliees={reactionsDepliees}
              onDeplier={() => setReactionsDepliees((depliees) => !depliees)}
            />
          </section>
        </div>

        {/* La page de notes sous le billet, sur sa spirale : on y écrit pour soi. */}
        <div className={styles.carnet}>
          <label className={styles.champ}>
            <span className={`${styles.rubrique} ${styles.rubriqueCarnet}`}>
              Mes notes <small className={styles.compte}>rien qu’à toi</small>
            </span>
            <textarea
              ref={zoneRemarque}
              value={brouillon.remarque}
              onChange={(event) => setBrouillon((b) => ({ ...b, remarque: event.target.value }))}
              className={styles.remarque}
            />
          </label>
        </div>
      </article>

      <div className={styles.actions}>
        {erreur ? (
          <p role="alert" className={styles.erreur}>
            {erreur.message}
          </p>
        ) : null}
        <div className={styles.talon}>
          <button type="button" onClick={enregistrer} disabled={mutation.isPending} className={styles.valider}>
            {correction ? 'Corriger mon papier' : 'Rendre mon papier'}
          </button>
        </div>
      </div>

      {correction ? (
        confirmerSuppression ? (
          <div className={styles.confirmation}>
            <p>Supprimer ce visionnage ? Le commentaire et les réactions partent avec.</p>
            {suppression.error ? (
              <p role="alert" className={styles.erreur}>
                {suppression.error.message}
              </p>
            ) : null}
            <div className={styles.confirmationActions}>
              <button
                type="button"
                className={styles.boutonSecondaire}
                onClick={() => {
                  suppression.reset()
                  setConfirmerSuppression(false)
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.boutonDanger}
                onClick={() => {
                  correctionMutation.reset()
                  suppression.mutate(item!)
                }}
                disabled={suppression.isPending}
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.boutonSupprimer} onClick={() => setConfirmerSuppression(true)}>
            Déchirer ce billet
          </button>
        )
      ) : null}
    </div>
  )
}
