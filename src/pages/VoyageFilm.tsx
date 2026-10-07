import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { curseurSuivant, lireJournal } from '../api/journal'
import { lireRealisateursDuFilm } from '../api/personnes'
import { lireReactions } from '../api/reactions'
import { anneeSansSalles, estPrete, lireCarton, type Carton, type FilmDeSalle, type Podium, type Salle } from '../api/voyage'
import { creerRegistre } from '../mondes'
import type { Monde } from '../mondes/types'
import { useMouvementReduit } from '../ui/mouvement'
import Panne from '../ui/Panne'
import { useRevenir } from '../ui/revenir'
import { useFiche } from '../voyage/annee/useFiche'
import { useCalque } from '../voyage/calque'
import Feuille from '../voyage/Feuille'
import { derniereEntree, filmDeLaFiche, tmdbVise } from '../voyage/film'
import Guichet from '../voyage/film/Guichet'
import Notice from '../voyage/film/Notice'
import Programme from '../voyage/film/Programme'
import Projection from '../voyage/film/Projection'
import { urlProjetee, useImageDuFilm } from '../voyage/film/useImageDuFilm'
import { gabaritDe } from '../voyage/gabarit'
import { decennieDe } from '../voyage/regles'
import { RELECTURES, etatRelecture, intervalle } from '../voyage/relecture'
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

  // Une adresse tapée vers une année sans salles (fermée, en attente, en préparation) : « pas dans les
  // salles » serait juste mais trompeur. La page de l'année dit pourquoi, et ce qui l'ouvrira ;
  // `replace`, pour que « Retour » ne ramène pas ici, d'où l'on repartirait aussitôt.
  if (anneeSansSalles(fiche)) return <Navigate to={`/voyage/${annee}`} replace />

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

/**
 * La fiche proprement dite (maquette 1890 : `initFilm`, écran V). La page lit et passe : la projection
 * et la notice sont celles du monde (`gabaritDe`), `Projection` et `Notice` sinon ; le programme et le
 * guichet se montent ici et arrivent à la notice tout montés.
 */
function FilmDeLAnnee({ monde, annee, salle, film, podium }: PropsFilm) {
  const calme = useMouvementReduit()
  // Ce que visent l'entrée à corriger et le carton : un programme vu en partie, la bobine qui reste à
  // voir (`tmdbVise`) ; le réalisateur et la projection restent ceux du film de la salle.
  const tmdb = tmdbVise(film)
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
    queryKey: ['realisateurs-du-film', String(film.tmdb_id)],
    queryFn: ({ signal }) => lireRealisateursDuFilm(film.tmdb_id, signal),
  })

  // La projection (décision D1) : le fond, sinon l'affiche, que la page charge et passe à l'écran.
  const image = useImageDuFilm(urlProjetee(film))

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

  const Ecran = gabaritDe(monde, 'projection', Projection)
  const Fiche = gabaritDe(monde, 'noticeDuFilm', Notice)

  return (
    <>
      <Ecran monde={monde} film={film} image={image} calme={calme} />
      <Fiche
        monde={monde}
        salle={salle}
        film={film}
        realisateurs={realisateurs.data?.realisateurs ?? []}
        entree={entree}
        phrase={(cle) => reactions.data?.reactions.find((r) => r.cle === cle)?.phrase ?? cle}
        programme={film.programme ? <Programme monde={monde} annee={annee} film={film} programme={film.programme} /> : null}
        guichet={<Guichet monde={monde} annee={annee} film={film} podium={podium} entree={entree} onFilm={() => feuille.ouvrir('film')} />}
      />

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
