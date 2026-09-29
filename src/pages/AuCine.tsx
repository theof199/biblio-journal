import { useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IconCheck, IconMovie, IconUser } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { curseurSuivant, lireSeances } from '../api/journal'
import { lireRealisateurs } from '../api/realisateurs'
import { lireSagas } from '../api/sagas'
import { lireSorties } from '../api/sorties'
import {
  candidatDepuisSortieEnCours,
  candidatDepuisSortieProchaine,
  sortieEnCoursOuvrable,
} from '../formulaire/candidat'
import {
  cinemaUniqueEnCours,
  dejaDansLeJournal,
  marqueEnCours,
  marqueProchaine,
  messageAuCine,
  miseAJourAffichee,
  reperesSuivis,
  seancesCetteAnnee,
  sousTitreCinemas,
  type MarqueSuivi,
} from '../cinema/etats'
import { useFilmographiesSagas } from '../suivis/useFilmographies'
import { useChargementInfini } from '../accueil/useChargementInfini'
import Affiche from '../ui/Affiche'
import Panne from '../ui/Panne'
import { formatDateVisionnage, sousTitre } from '../ui/format'
import styles from './AuCine.module.css'
import type { JournalItem } from '../api/journal'
import type { SortieEnCoursFilm, SortieProchaineFilm } from '../api/sorties'
import type { CandidatFilm } from '../formulaire/candidat'

/** Même page que côté back par défaut, et que `JournalApi.seances()` (Android). */
const LIMITE = 40

/**
 * « Au ciné » (reprise de `AuCineScreen.kt`) : mes séances (`GET /me/journal?reaction=en_salle`),
 * et les sorties en salle de la semaine en cours et de la semaine prochaine (`GET
 * /reference/sorties`) — rien de plus, pas de recommandation. Le sceau des Suivis (« le guichet »,
 * 25 septembre 2026) marque une tuile dont le réalisateur ou la saga est suivi (`cinema/etats.ts`).
 * Il ne coûte **aucun appel de filmographie** : les films des sagas ne sont lus que dans le cache
 * (`useFilmographiesSagas(…, false)`), là où l'accueil, toujours visité avant, les a mis — comme
 * `CinemaRoute.kt`, qui lit les Suivis tels que l'appli les tient déjà. Seules les deux listes
 * (`GET /me/realisateurs`, `GET /me/sagas`, sans TMDB derrière) se demandent ici : une page ouverte
 * ou rechargée directement n'a pas eu l'accueil pour les amorcer.
 *
 * Deux appels indépendants, chacun avec son chargement et son erreur (même règle que
 * `AuCineViewModel` : une panne TMDB n'a aucune raison d'effacer « Tes séances », qui vient d'une
 * route différente).
 */
export default function AuCine() {
  const sorties = useQuery({ queryKey: cles.sorties, queryFn: ({ signal }) => lireSorties(signal) })

  // Le sceau des Suivis : de quoi le poser, jamais de quoi le charger (voir plus haut).
  const realisateursSuivis = useQuery({ queryKey: cles.realisateurs, queryFn: ({ signal }) => lireRealisateurs(signal) })
  const sagasSuivies = useQuery({ queryKey: cles.sagas, queryFn: ({ signal }) => lireSagas(signal) })
  const filmographiesSagas = useFilmographiesSagas(sagasSuivies.data, false)
  const reperes = reperesSuivis(realisateursSuivis.data, filmographiesSagas)

  const seances = useInfiniteQuery({
    queryKey: cles.seances,
    queryFn: ({ pageParam, signal }) => lireSeances({ limit: LIMITE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => curseurSuivant(page),
  })

  // Dépendances primitives plutôt que `seances` entier (jumeau d'`Accueil.tsx`/`MesFilms.tsx`) :
  // `isFetchNextPageError` dans la garde évite la rafale d'appels qu'une page en échec relancerait
  // sinon sans fin (le défaut corrigé dans `MesFilms.tsx`).
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = seances
  const chargerLaSuite = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])
  const sentinelle = useChargementInfini(chargerLaSuite, !!hasNextPage)

  const items = useMemo(() => seances.data?.pages.flatMap((page) => page.items) ?? [], [seances.data])
  const chargementComplet = !hasNextPage
  const compte = seancesCetteAnnee(items, new Date().getFullYear())

  const enCours = sorties.data?.en_cours
  const messageEnCours = enCours ? messageAuCine(enCours) : null
  const majAffichee = enCours ? miseAJourAffichee(enCours.calcule_le) : null
  // Un seul cinéma pour toute la grille : son nom la titre une fois, et quitte chaque tuile.
  const cinemaUnique = enCours ? cinemaUniqueEnCours(enCours.films) : null
  const prochaine = sorties.data?.prochaine

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <h1 className={styles.titre}>Au ciné</h1>
        <p className={styles.compte}>
          {compte} séance{compte > 1 ? 's' : ''} cette année
        </p>
      </div>

      <section className={styles.section}>
        <div className={styles.enteteSection}>
          <p className={styles.titreSection}>Sorti cette semaine dans mes cinémas</p>
          {majAffichee ? <p className={styles.maj}>{majAffichee}</p> : null}
        </div>
        {sorties.isPending ? (
          <p role="status" className={styles.chargementGrille}>
            Chargement…
          </p>
        ) : sorties.error ? (
          <Panne erreur={sorties.error} onReessayer={() => void sorties.refetch()} />
        ) : messageEnCours ? (
          <p className={styles.videGrille}>{messageEnCours}</p>
        ) : (
          <>
            {cinemaUnique ? <p className={styles.cinemaUnique}>{cinemaUnique}</p> : null}
            <div className={styles.grille}>
              {enCours!.films.map((film) => (
                <TuileEnCours
                  key={film.allocine_id}
                  film={film}
                  dejaVu={dejaDansLeJournal(items, film.tmdb_id)}
                  marque={marqueEnCours(reperes, film)}
                  avecCinemas={cinemaUnique == null}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.section}>
        <p className={styles.titreSection}>La semaine prochaine</p>
        {sorties.isPending ? (
          <p role="status" className={styles.chargementGrille}>
            Chargement…
          </p>
        ) : sorties.error ? null : prochaine && prochaine.films.length === 0 ? (
          // L'erreur des sorties n'est montrée qu'une fois, dans la section précédente.
          <p className={styles.videGrille}>Rien cette semaine.</p>
        ) : prochaine ? (
          <div className={styles.grille}>
            {prochaine.films.map((film) => (
              <TuileProchaine
                key={film.tmdb_id}
                film={film}
                dejaVu={dejaDansLeJournal(items, film.tmdb_id)}
                marque={marqueProchaine(reperes, film)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <p className={styles.titreSection}>Tes séances</p>

        {seances.isPending ? (
          <p role="status">Chargement…</p>
        ) : !seances.data ? (
          <Panne erreur={seances.error} onReessayer={() => void seances.refetch()} />
        ) : (
          <>
            {items.length === 0 && chargementComplet ? (
              <p className={styles.videGrille}>Aucune séance pour l’instant.</p>
            ) : (
              <div className={styles.liste}>
                {items.map((item) => (
                  <LigneSeance key={item.entry.id} item={item} />
                ))}
              </div>
            )}

            {seances.error ? (
              <div className={styles.erreur} role="alert">
                <p className={styles.erreurTexte}>{seances.error.message}</p>
                <button
                  type="button"
                  className={styles.bouton}
                  onClick={() => (chargementComplet ? void seances.refetch() : void fetchNextPage())}
                >
                  Réessayer
                </button>
              </div>
            ) : null}

            {isFetchingNextPage ? (
              <p role="status" className={styles.chargement}>
                Chargement…
              </p>
            ) : null}
            {hasNextPage ? <div ref={sentinelle} data-testid="sentinelle-au-cine" /> : null}
          </>
        )}
      </section>
    </div>
  )
}

/**
 * Une tuile de sortie, commune aux deux grilles — l'affiche, la coche « déjà dans ton journal » en
 * bas à droite, le sceau d'un suivi en haut à droite, le titre, un sous-titre facultatif.
 */
function Tuile({
  coverUrl,
  title,
  sousTitre: sousTitreTexte,
  dejaVu,
  marque,
  candidat,
}: {
  coverUrl: string | null
  title: string
  sousTitre?: string | null
  dejaVu: boolean
  marque: MarqueSuivi | null
  /** `null` : la tuile n'est pas ouvrable (aucun `tmdb_id` résolu côté back), rien à préremplir. */
  candidat: CandidatFilm | null
}) {
  const contenu = (
    <>
      <div className={styles.jaquette}>
        <Affiche src={coverUrl} titre={title} taille="ligne" className={styles.afficheTuile} />
        {dejaVu ? (
          <span className={styles.coche} aria-label="Déjà dans ton journal">
            <IconCheck aria-hidden="true" className={styles.iconeCoche} />
          </span>
        ) : null}
        {marque ? (
          <span className={styles.sceau} aria-label={marque === 'realisateur' ? 'Réalisateur suivi' : 'Saga suivie'}>
            {marque === 'realisateur' ? (
              <IconUser aria-hidden="true" className={styles.iconeSceau} />
            ) : (
              <IconMovie aria-hidden="true" className={styles.iconeSceau} />
            )}
          </span>
        ) : null}
      </div>
      <p className={styles.titreTuile}>{title}</p>
      {sousTitreTexte ? <p className={styles.sousTitreTuile}>{sousTitreTexte}</p> : null}
    </>
  )

  if (!candidat) return <div className={styles.tuile}>{contenu}</div>

  return (
    <Link to="/journal/nouveau" state={{ candidat }} className={styles.tuile}>
      {contenu}
    </Link>
  )
}

/**
 * « À l'affiche dans mes cinémas » (Allociné) : sous-titre les cinémas quand la grille en montre
 * plusieurs (`avecCinemas`), ouvrable seulement si TMDB a été résolu.
 */
function TuileEnCours({
  film,
  dejaVu,
  marque,
  avecCinemas,
}: {
  film: SortieEnCoursFilm
  dejaVu: boolean
  marque: MarqueSuivi | null
  avecCinemas: boolean
}) {
  return (
    <Tuile
      coverUrl={film.cover_url}
      title={film.title}
      sousTitre={avecCinemas ? sousTitreCinemas(film.cinemas) : null}
      dejaVu={dejaVu}
      marque={marque}
      candidat={sortieEnCoursOuvrable(film) ? candidatDepuisSortieEnCours(film) : null}
    />
  )
}

/** « La semaine prochaine » (TMDB) : toujours ouvrable, pas de cinéma à afficher. */
function TuileProchaine({ film, dejaVu, marque }: { film: SortieProchaineFilm; dejaVu: boolean; marque: MarqueSuivi | null }) {
  return (
    <Tuile
      coverUrl={film.cover_url}
      title={film.title}
      dejaVu={dejaVu}
      marque={marque}
      candidat={candidatDepuisSortieProchaine(film)}
    />
  )
}

/** Une ligne de « Tes séances » — jumelle de `LigneFilm` (`MesFilms.tsx`), sans filtre ni réaction. */
function LigneSeance({ item }: { item: JournalItem }) {
  return (
    <Link to={`/journal/${item.entry.id}`} state={{ item, depuis: '/au-cine' }} className={styles.ligne}>
      <Affiche src={item.media.cover_url} titre={item.media.title} note={item.entry.rating} taille="ligne" />
      <div className={styles.infosLigne}>
        <p className={styles.titreLigne}>{item.media.title}</p>
        <p className={styles.sousTitreLigne}>{sousTitre(item.media.director, item.media.year)}</p>
        <p className={styles.dateLigne}>{formatDateVisionnage(item.entry.finished_at)}</p>
      </div>
    </Link>
  )
}
