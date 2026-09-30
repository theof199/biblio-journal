import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { corrigerVisionnage, creerVisionnage, supprimerVisionnage, type JournalItem } from '../api/journal'
import { lireReactions } from '../api/reactions'
import { estPrete, lireVoyage, type FicheAnnee, type Voyage } from '../api/voyage'
import type { CandidatFilm } from '../formulaire/candidat'
import { brouillonInitial, construirePatch, type FormulaireBrouillon } from '../formulaire/patch'
import { creerRegistre } from '../mondes'
import type { Monde } from '../mondes/types'
import { useSession } from '../session/SessionContext'
import { sousTitre } from '../ui/format'
import Panne from '../ui/Panne'
import { historiqueDerriere, useRevenir } from '../ui/revenir'
import { doitGuetterVerdict } from '../voyage/annee'
import { confierLeRetour, type EtatBillet, type Retour } from '../voyage/annee/retour'
import { useFiche } from '../voyage/annee/useFiche'
import { initiale } from '../voyage/billet'
import Cartons from '../voyage/billet/Cartons'
import Dateur from '../voyage/billet/Dateur'
import Poincon from '../voyage/billet/Poincon'
import { bobineDuFilm, candidatDuBillet, filmDeLaFiche } from '../voyage/film'
import { decennieDe } from '../voyage/regles'
import styles from './VoyageBillet.module.css'

/** Un registre pour la page, comme la carte et les fiches ont le leur. */
const mondes = creerRegistre()

/** Le traitement des affiches du monde, par `filter` CSS : jamais une lecture de pixels. */
const TRAITEMENT = { sepia: styles.sepia, gris: styles.gris, couleur: '' } as const

/**
 * Ce qu'un visionnage écrit ou effacé périme, comme le formulaire du journal (`pages/Formulaire.tsx`),
 * son jumeau : le journal (et « Tes séances », sous son préfixe), les chiffres, la carte et toutes
 * les fiches du Voyage, les filmographies et les sagas suivies.
 */
const PERIMES = [cles.journal, cles.stats, cles.voyage, cles.realisateurs, cles.sagas] as const

const messageDe = (e: unknown, repli: string) => (e instanceof ApiError ? e.message : repli)

/**
 * Le billet de séance (plan 2b, tâche 11 ; maquette 1890 : `initNotation`, écran VI ; décision D2) :
 * `…/billet` enregistre un visionnage (`?bobine=` pour une bobine d'un programme), `…/billet/corriger`
 * corrige celui que porte l'état de navigation (`state.item`). Un `:annee` qui n'est pas un entier
 * ramène à la carte.
 */
export default function VoyageBillet({ correction = false }: { correction?: boolean }) {
  const { annee, filmId } = useParams()
  const [params] = useSearchParams()
  if (!annee || !/^\d+$/.test(annee) || !filmId) return <Navigate to="/voyage" replace />
  const bobine = params.get('bobine')
  // Un autre billet est une autre page : son brouillon et sa garde repartent de zéro.
  return <BilletDuFilm key={`${annee}/${filmId}/${bobine ?? ''}/${correction}`} annee={Number(annee)} filmId={filmId} bobine={bobine} correction={correction} />
}

type Cible = { type: 'creation'; candidat: CandidatFilm } | { type: 'correction'; item: JournalItem }

function BilletDuFilm({ annee, filmId, bobine, correction }: { annee: number; filmId: string; bobine: string | null; correction: boolean }) {
  const monde = mondes(decennieDe(annee))
  const { jetons } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const location = useLocation()
  const etat = location.state as (EtatBillet & { item?: JournalItem }) | null
  // « Retour » recule vers ce qui a ouvert le billet (la fiche du film, ou l'année) ; ouvert d'un lien, le film.
  const vers = `/voyage/${annee}/films/${filmId}`
  const revenir = useRevenir(vers)

  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  // La fiche de **son** année : le film s'y retrouve, et la progression d'avant se lit dans son cache.
  const { requete, reessayer } = useFiche(annee)
  const fiche = requete.data
  const v = voyage.data
  const trouve = estPrete(fiche) ? filmDeLaFiche(fiche, filmId) : null
  const item = correction ? etat?.item : undefined

  const absent = (texte: string, lien: string, nom: string) => (
    <div className={styles.etat}>
      <p>{texte}</p>
      <Link to={lien} className={styles.lien}>
        {nom}
      </Link>
    </div>
  )

  let corps: ReactNode
  if (correction && !item) {
    // Rien à corriger sans l'entrée : il n'existe pas de `GET /me/journal/{id}` (adresse rechargée ou tapée).
    corps = absent('Ce visionnage n’est plus disponible.', vers, 'Retour au film')
  } else if (!fiche || !v) {
    const erreur = requete.error ?? voyage.error
    corps =
      erreur && !(requete.isFetching || voyage.isFetching) ? (
        <div className={styles.etat}>
          <Panne
            erreur={erreur}
            onReessayer={() => {
              if (voyage.error) void voyage.refetch()
              if (requete.error) reessayer()
            }}
          />
        </div>
      ) : (
        <p role="status" className={styles.etat}>
          Chargement…
        </p>
      )
  } else if (!trouve) {
    corps = absent(`Ce film n’est pas dans les salles de ${annee}.`, `/voyage/${annee}`, `L’année ${annee}`)
  } else if (item) {
    corps = <Billet monde={monde} annee={annee} filmId={filmId} voyage={v} cible={{ type: 'correction', item }} depuisLAnnee={false} />
  } else {
    const { film } = trouve
    const laBobine = bobine !== null ? bobineDuFilm(film, Number(bobine)) : undefined
    // Un programme se note bobine par bobine, et porte l'identifiant de sa première : sans bobine
    // reconnue, le billet noterait celle-là, fût-elle déjà vue.
    corps =
      (bobine !== null || film.programme) && !laBobine ? (
        absent(`Cette bobine n’est pas au programme de « ${film.title} ».`, vers, 'Retour au film')
      ) : (
        <Billet
          monde={monde}
          annee={annee}
          filmId={filmId}
          voyage={v}
          cible={{ type: 'creation', candidat: candidatDuBillet(film, laBobine) }}
          depuisLAnnee={etat?.depuis === 'annee'}
        />
      )
  }

  return (
    <section className={styles.page} aria-label="Le billet de séance" style={style}>
      <button type="button" className={styles.retour} aria-label="Retour" onClick={revenir}>
        <span aria-hidden="true">‹</span>
      </button>
      {corps}
    </section>
  )
}

interface PropsBillet {
  monde: Monde
  annee: number
  filmId: string
  voyage: Voyage
  cible: Cible
  /** Ouvert depuis la fiche de l'année (la séance) : l'année est l'entrée juste derrière. */
  depuisLAnnee: boolean
}

/** Le billet proprement dit : la tête, le dateur, le poinçon, les cartons, la remarque, et le compostage. */
function Billet({ monde, annee, filmId, voyage: v, cible, depuisLAnnee }: PropsBillet) {
  const m = monde.pages.mots
  const client = useQueryClient()
  const navigate = useNavigate()
  const { key } = useLocation()
  const { user } = useSession()
  const item = cible.type === 'correction' ? cible.item : undefined
  const candidat = cible.type === 'creation' ? cible.candidat : undefined
  const [brouillon, setBrouillon] = useState(() => brouillonInitial(item, candidat))
  const [confirmer, setConfirmer] = useState(false)
  // Le focus suit la confirmation : « Annuler » (le geste sans risque) à son ouverture, qui la montre
  // au-dessus de la barre d'onglets ; « Supprimer » à sa fermeture. Rien au montage.
  const annuler = useRef<HTMLButtonElement>(null)
  const demander = useRef<HTMLButtonElement>(null)
  const ouverte = useRef(false)
  useEffect(() => {
    if (confirmer) annuler.current?.focus()
    else if (ouverte.current) demander.current?.focus()
    ouverte.current = confirmer
  }, [confirmer])

  const reactions = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal) })

  const perimer = () => {
    for (const cle of PERIMES) void client.invalidateQueries({ queryKey: cle })
  }

  // Ce que le cache doit apprendre reste ici (les péremptions) ; la navigation va dans les rappels de
  // `mutate`, qui se taisent si le billet est quitté pendant l'envoi (le « retour » du téléphone).
  const ecrire = useMutation({
    mutationFn: async (b: FormulaireBrouillon): Promise<Retour> => {
      // L'avant : la fiche en cache avant l'écriture, que l'année compare à sa relecture.
      const f = client.getQueryData<FicheAnnee>(cles.annee(annee))
      const avant = estPrete(f) ? { profondeur: f.profondeur, progression: f.progression } : null
      const depuis = estPrete(f) ? (f.maturite?.jugee_le ?? null) : null
      const entree = item
        ? await corrigerVisionnage(item.entry.id, construirePatch(item, b))
        : await creerVisionnage(
            { source: candidat!.source, external_id: candidat!.external_id, type: 'movie' },
            {
              finished_at: b.date,
              rating: b.note,
              reactions: b.reactions.length > 0 ? b.reactions : undefined,
              comment: b.remarque.trim() || undefined,
            },
          )
      const guetter = doitGuetterVerdict({ ia: v.ia, creation: !item, anneeDuFilm: entree.media.year, anneeEnCours: v.annee_en_cours })
      return { avant, guet: guetter ? { depuis } : null }
    },
    onSuccess: perimer,
  })

  const suppression = useMutation({
    mutationFn: (id: string) => supprimerVisionnage(id),
    onSuccess: perimer,
  })

  // `isPending` ne se voit qu'au rendu suivant : deux touchers rapprochés écriraient deux fois. Une
  // seule garde pour les deux gestes : on ne corrige pas un visionnage qu'on est en train d'effacer.
  const envoi = useRef(false)
  const composter = () => {
    if (envoi.current) return
    envoi.current = true
    suppression.reset()
    ecrire.mutate(brouillon, {
      onSuccess: (retour) => {
        confierLeRetour(annee, retour)
        // Depuis l'année, reculer : la remplacer par elle-même la doublerait dans l'historique.
        if (depuisLAnnee && historiqueDerriere(key)) navigate(-1)
        else navigate(`/voyage/${annee}`, { replace: true })
      },
      onSettled: () => void (envoi.current = false),
    })
  }
  const supprimer = () => {
    if (!item || envoi.current) return
    envoi.current = true
    ecrire.reset()
    suppression.mutate(item.entry.id, {
      // Le billet effacé ne reste pas dans l'historique : reculer vers la fiche du film qui l'a ouvert.
      onSuccess: () => (historiqueDerriere(key) ? navigate(-1) : navigate(`/voyage/${annee}/films/${filmId}`, { replace: true })),
      onSettled: () => void (envoi.current = false),
    })
  }

  const titre = item ? item.media.title : candidat!.title
  const couverture = item ? item.media.cover_url : candidat!.cover_url
  const sous = item ? sousTitre(item.media.director, item.media.year) : sousTitre(candidat!.director, candidat!.year)
  const occupe = ecrire.isPending || suppression.isPending

  return (
    <div className={styles.notation}>
      <div className={styles.tete}>
        <span className={`${styles.cab} ${TRAITEMENT[monde.traitement.affiches]}`}>
          {couverture ? <img src={couverture} alt="" /> : <span className={styles.sansImage} />}
        </span>
        <div>
          <span className={styles.sc}>Enregistrer un visionnage</span>
          <h1 className={styles.titre}>{titre}</h1>
          {sous ? <small>{sous}</small> : null}
        </div>
      </div>

      <div className={styles.billet}>
        {/* Sans numéro (décision D2). */}
        <div className={styles.entete}>
          <small>{m.billet.tete}</small>
          <strong>{m.billet.titre}</strong>
        </div>
        <div className={`${styles.rubrique} ${styles.dateur}`}>
          <Dateur date={brouillon.date} onChange={(date) => setBrouillon((b) => ({ ...b, date }))} />
        </div>
        <div className={styles.rubrique}>
          <div className={styles.rubriqueTete}>
            Ta note <em>poinçonnez</em>
          </div>
          <Poincon note={brouillon.note} onNote={(note) => setBrouillon((b) => ({ ...b, note }))} />
        </div>
        <div className={styles.rubrique}>
          <div className={styles.rubriqueTete}>
            Tes réactions <em>douze cartons au plus</em>
          </div>
          {reactions.data ? (
            <Cartons catalogue={reactions.data.reactions} choisis={brouillon.reactions} onChange={(r) => setBrouillon((b) => ({ ...b, reactions: r }))} />
          ) : reactions.error && !reactions.isFetching ? (
            <div className={styles.erreurCartons}>
              <Panne erreur={reactions.error} onReessayer={() => void reactions.refetch()} />
            </div>
          ) : (
            <p role="status" className={styles.attente}>
              Chargement…
            </p>
          )}
        </div>
        <div className={`${styles.rubrique} ${styles.remarque}`}>
          <div className={styles.rubriqueTete}>
            <span>
              <span className={styles.cire} aria-hidden="true">
                {initiale(user.pseudo)}
              </span>
              Ta remarque
            </span>
            <em>privée : toi seul la lis</em>
          </div>
          <textarea
            aria-label="Remarque privée"
            placeholder="Ce que tu en retiens, pour toi…"
            value={brouillon.remarque}
            onChange={(e) => setBrouillon((b) => ({ ...b, remarque: e.target.value }))}
          />
        </div>
      </div>

      {ecrire.error ? (
        <p role="alert" className={styles.erreur}>
          {messageDe(ecrire.error, 'Le billet n’a pas pu s’enregistrer. Réessaie.')}
        </p>
      ) : null}
      <button type="button" className={styles.valider} disabled={occupe} onClick={composter}>
        <span>
          <b>{item ? 'Corriger le billet' : m.billet.valider}</b>{' '}
          {/* Les mots du monde disent « l’année » ; c'est la page qui la nomme. */}
          <small>{m.billet.validerSous.replace('l’année', String(annee))}</small>
        </span>
        <span className={styles.talon} aria-hidden="true">
          VU
        </span>
      </button>

      {/* « Supprimer » (décision D6) : discret, sous le billet, avec la confirmation du formulaire. */}
      {item ? (
        confirmer ? (
          <div className={styles.confirmation}>
            <p>Supprimer ce visionnage ? Le commentaire et les réactions partent avec.</p>
            {suppression.error ? (
              <p role="alert" className={styles.erreur}>
                {messageDe(suppression.error, 'Le visionnage n’a pas pu être supprimé. Réessaie.')}
              </p>
            ) : null}
            <div className={styles.choix}>
              <button
                ref={annuler}
                type="button"
                className={styles.discret}
                onClick={() => {
                  suppression.reset()
                  setConfirmer(false)
                }}
              >
                Annuler
              </button>
              <button type="button" className={styles.supprimer} disabled={occupe} onClick={supprimer}>
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button ref={demander} type="button" className={styles.discret} onClick={() => setConfirmer(true)}>
            Supprimer
          </button>
        )
      ) : null}
    </div>
  )
}
