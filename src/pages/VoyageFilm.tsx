import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { curseurSuivant, lireJournal, type JournalItem } from '../api/journal'
import { lireRealisateursDuFilm } from '../api/personnes'
import { lireReactions } from '../api/reactions'
import { estPrete, lireCarton, type Carton, type FilmDeSalle, type Podium, type Salle } from '../api/voyage'
import { creerRegistre } from '../mondes'
import type { Monde } from '../mondes/types'
import { formatDateVisionnage } from '../ui/format'
import { useMouvementReduit } from '../ui/mouvement'
import Panne from '../ui/Panne'
import { useRevenir } from '../ui/revenir'
import { useFiche } from '../voyage/annee/useFiche'
import { useCalque } from '../voyage/calque'
import Feuille from '../voyage/Feuille'
import { derniereEntree, dureeLisible, filmDeLaFiche } from '../voyage/film'
import Guichet from '../voyage/film/Guichet'
import Programme from '../voyage/film/Programme'
import { urlProjetee, useImageDuFilm } from '../voyage/film/useImageDuFilm'
import { decennieDe } from '../voyage/regles'
import { RELECTURES, etatRelecture, intervalle } from '../voyage/relecture'
import Toile, { LARGEUR_LOGIQUE } from '../voyage/Toile'
import styles from './VoyageFilm.module.css'

/** Un registre pour la page, comme la carte et la fiche d'une année ont le leur. */
const mondes = creerRegistre()

/** La taille des pages du journal : celle de l'accueil et de la fiche d'un film des Suivis, qui partagent `cles.journal`. */
const LIMITE = 20

const PAS_ECRIT = 'Le chroniqueur n’a pas encore écrit sur ce film.'

const enPreparation = (c: Carton | undefined): boolean => !!c && 'statut' in c && c.statut === 'en_preparation'

/**
 * La fiche d'un film du Voyage (plan 2b, tâche 10 ; décision D5 : `/voyage/:annee/films/:filmId`,
 * pour toutes les entrées, la page d'un réalisateur comprise). Un `:annee` qui n'est pas un entier
 * ramène à la carte.
 */
export default function VoyageFilm() {
  const { annee, filmId } = useParams()
  if (!annee || !/^\d+$/.test(annee) || !filmId) return <Navigate to="/voyage" replace />
  // Un autre film est une autre page : son image, ses comptes, son toucher repartent de zéro.
  return <FicheDuFilm key={`${annee}/${filmId}`} annee={Number(annee)} filmId={filmId} />
}

function FicheDuFilm({ annee, filmId }: { annee: number; filmId: string }) {
  const monde = mondes(decennieDe(annee))
  const { jetons } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  // « Retour » recule dans l'historique (l'année, ou la page d'un réalisateur) ; ouverte d'un lien, l'année.
  const revenir = useRevenir(`/voyage/${annee}`)

  // La fiche de **son** année, jamais une autre : le film s'y retrouve par sa ligne de salle.
  const { requete, reessayer } = useFiche(annee)
  const fiche = requete.data
  const trouve = estPrete(fiche) ? filmDeLaFiche(fiche, filmId) : null

  let corps: ReactNode
  if (!fiche) {
    corps = requete.error && !requete.isFetching ? (
      <div className={styles.etat}>
        <Panne erreur={requete.error} onReessayer={reessayer} />
      </div>
    ) : (
      <p role="status" className={styles.etat}>
        Chargement…
      </p>
    )
  } else if (!trouve || !estPrete(fiche)) {
    corps = (
      <div className={styles.etat}>
        <p>{`Ce film n’est pas dans les salles de ${annee}.`}</p>
        <Link to={`/voyage/${annee}`} className={styles.lien}>
          {`L’année ${annee}`}
        </Link>
      </div>
    )
  } else {
    corps = <FilmDeLAnnee monde={monde} annee={annee} salle={trouve.salle} film={trouve.film} podium={fiche.podium} />
  }

  return (
    <section className={styles.page} aria-label={trouve ? trouve.film.title : `Un film de ${annee}`} style={style}>
      <button type="button" className={styles.retour} aria-label="Retour" onClick={revenir}>
        <span aria-hidden="true">‹</span>
      </button>
      {corps}
    </section>
  )
}

interface PropsFilm {
  monde: Monde
  annee: number
  salle: Salle
  film: FilmDeSalle
  podium: Podium
}

/** La fiche proprement dite (maquette 1890 : `initFilm`, écran V, styles 312 à 337). */
function FilmDeLAnnee({ monde, annee, salle, film, podium }: PropsFilm) {
  const { hauteurs } = monde.pages
  const calme = useMouvementReduit()
  const tmdb = film.tmdb_id
  const vu = film.etat === 'vu'

  // Mon journal, **seulement pour un film vu** : la note, la date et les réactions de mon dernier
  // visionnage, et « Corriger ». La page suivante se lit tant que l'entrée manque, jamais après une
  // erreur ni au-delà du dernier curseur (comme `FicheFilm.tsx`).
  const journal = useInfiniteQuery({
    queryKey: cles.journal,
    queryFn: ({ pageParam, signal }) => lireJournal({ limit: LIMITE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => curseurSuivant(page),
    enabled: vu,
  })
  const entree = vu ? derniereEntree(journal.data?.pages ?? [], tmdb) : undefined
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = journal
  const aChercher = vu && !!journal.data && entree === undefined
  useEffect(() => {
    if (aChercher && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage()
  }, [aChercher, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  const reactions = useQuery({
    queryKey: cles.reactions,
    queryFn: ({ signal }) => lireReactions(signal),
    enabled: !!entree && entree.carnet.reactions.length > 0,
  })

  // Le réalisateur se résout sur TMDB (la même clé que la fiche d'un film des Suivis) ; le nom de la salle sinon.
  const realisateurs = useQuery({
    queryKey: ['realisateurs-du-film', String(tmdb)],
    queryFn: ({ signal }) => lireRealisateursDuFilm(tmdb, signal),
  })
  const resolus = realisateurs.data?.realisateurs ?? []

  // La projection (décision D1) : le fond, sinon l'affiche ; toucher l'écran relance le train.
  const image = useImageDuFilm(urlProjetee(film))
  const dernierT = useRef(0)
  const touche = useRef(-9)

  // Le carton du chroniqueur : **jamais lu à l'ouverture**, seulement sur « Le film » (au compte IA,
  // un carton manquant s'enfile à la lecture) ; relu toutes les trois secondes tant qu'il s'écrit, dix
  // fois au plus. Un texte écrit ne se redemande jamais.
  const feuille = useCalque('feuille')
  const essais = useRef(0)
  const carton = useQuery({
    queryKey: cles.carton(tmdb),
    queryFn: async ({ signal }) => {
      const c = await lireCarton(tmdb, signal)
      essais.current = enPreparation(c) ? essais.current + 1 : 0
      return c
    },
    enabled: feuille.valeur === 'film',
    staleTime: Infinity,
    retry: false,
    refetchInterval: (q) => intervalle(enPreparation(q.state.data), essais.current, RELECTURES.carton),
  })
  // Comme `useFiche` : seule `dataUpdatedAt` dit qu'une réponse identique à la précédente est arrivée.
  const repondu = carton.dataUpdatedAt > 0
  const abandon = repondu && enPreparation(carton.data) && etatRelecture(true, essais.current, RELECTURES.carton) === 'abandon'
  const relireLeCarton = () => {
    essais.current = 0
    void carton.refetch()
  }
  const c = carton.data
  const pret = c && 'statut' in c && c.statut === 'prete' ? c : undefined
  const etatFeuille = pret
    ? ({ type: 'texte', texte: pret.texte } as const)
    : c && !c.configure
      ? ({ type: 'texte', texte: PAS_ECRIT } as const)
      : abandon
        ? ({ type: 'erreur', message: PAS_ECRIT } as const)
        : carton.error && !carton.isFetching
          ? ({ type: 'erreur', message: carton.error instanceof ApiError ? carton.error.message : 'Le carton n’a pas pu se lire. Réessaie.' } as const)
          : ({ type: 'attente' } as const)

  const meta = [film.year !== null ? String(film.year) : null, film.programme ? dureeLisible(film.programme.duree_min) : null].filter(Boolean).join(' · ')

  return (
    <>
      <Toile
        hauteur={hauteurs.scene}
        libelle={`L’écran projette ${film.title}.`}
        onToucher={() => {
          if (!calme) touche.current = dernierT.current
        }}
        dessiner={(ctx, t, vivant) => {
          dernierT.current = t
          monde.pages.dessinerScene({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.scene, t, vivant, image, touche: touche.current })
        }}
      />
      <div className={styles.fiche}>
        <span className={styles.enseigne}>
          <i aria-hidden="true" />
          {`Salle · ${salle.nom}`}
        </span>
        <h1 className={styles.titre}>{film.title}</h1>
        {film.original_title && film.original_title !== film.title ? <p className={styles.original}>{film.original_title}</p> : null}
        <p className={styles.meta}>
          {resolus.length > 0 ? (
            resolus.map((r, i) => (
              <span key={r.tmdb_id}>
                {i > 0 ? ', ' : ''}
                <Link to={`/suivis/realisateurs/${r.tmdb_id}`} className={styles.real}>
                  {`${r.name} ›`}
                </Link>
              </span>
            ))
          ) : film.realisateur ? (
            <span>{film.realisateur}</span>
          ) : null}
          {meta ? <span>{`${resolus.length > 0 || film.realisateur ? '· ' : ''}${meta}`}</span> : null}
        </p>
        {film.raison ? <p className={styles.boniment}>{film.raison}</p> : null}

        {vu ? <TaNote note={film.note} entree={entree} phrase={(cle) => reactions.data?.reactions.find((r) => r.cle === cle)?.phrase ?? cle} /> : null}
        {film.programme ? <Programme monde={monde} annee={annee} film={film} programme={film.programme} /> : null}
        <Guichet monde={monde} annee={annee} film={film} podium={podium} entree={entree} onFilm={() => feuille.ouvrir('film')} />
      </div>

      {feuille.valeur === 'film' ? (
        <Feuille
          monde={monde}
          quoi="film"
          esp="Le film"
          titre={pret ? pret.titre : film.title}
          sous={`${film.year ?? annee} · salle « ${salle.nom} »`}
          etat={etatFeuille}
          onReessayer={relireLeCarton}
          onFermer={feuille.fermer}
        />
      ) : null}
    </>
  )
}

/**
 * Ta note (maquette 1890 : `.ta-note`) : la note que l'API rend pour ce film, en perforations (dix
 * trous, `note` percés), la date et les réactions de mon dernier visionnage quand il est retrouvé.
 * La remarque (`carnet.comment`) est privée : elle ne s'affiche jamais ici.
 */
function TaNote({ note, entree, phrase }: { note: number | null; entree: JournalItem | undefined; phrase: (cle: string) => string }) {
  return (
    <section className={styles.note} aria-label="Ta note">
      <span className={styles.sc}>{entree ? `Ta note · vu le ${formatDateVisionnage(entree.entry.finished_at)}` : 'Ta note'}</span>
      <div className={styles.perfo} role="img" aria-label={note !== null ? `${note} sur 10` : 'sans note'}>
        {Array.from({ length: 10 }, (_, i) => {
          const perce = note !== null && i < note
          return (
            <i key={i} className={perce ? styles.troue : undefined} data-perce={perce} aria-hidden="true">
              {i + 1}
            </i>
          )
        })}
      </div>
      {entree && entree.carnet.reactions.length > 0 ? (
        <ul className={styles.cartons} aria-label="Tes réactions">
          {entree.carnet.reactions.map((cle) => (
            <li key={cle}>{phrase(cle)}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
