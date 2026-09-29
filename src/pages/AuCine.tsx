import { useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IconCheck } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { curseurSuivant, lireSeances } from '../api/journal'
import { lireSorties } from '../api/sorties'
import {
  candidatDepuisSortieEnCours,
  candidatDepuisSortieProchaine,
  sortieEnCoursOuvrable,
} from '../formulaire/candidat'
import { dejaDansLeJournal, messageAuCine, miseAJourAffichee, seancesCetteAnnee, sousTitreCinemas } from '../cinema/etats'
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
 * 25 septembre 2026) n'est pas repris ici : il dépend du lot Suivis, pas encore construit dans ce
 * dépôt.
 *
 * Deux appels indépendants, chacun avec son chargement et son erreur (même règle que
 * `AuCineViewModel` : une panne TMDB n'a aucune raison d'effacer « Tes séances », qui vient d'une
 * route différente).
 */
export default function AuCine() {
  const sorties = useQuery({ queryKey: cles.sorties, queryFn: ({ signal }) => lireSorties(signal) })

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
          <div className={styles.grille}>
            {enCours!.films.map((film) => (
              <TuileEnCours key={film.allocine_id} film={film} dejaVu={dejaDansLeJournal(items, film.tmdb_id)} />
            ))}
          </div>
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
              <TuileProchaine key={film.tmdb_id} film={film} dejaVu={dejaDansLeJournal(items, film.tmdb_id)} />
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

/** Une tuile de sortie, commune aux deux grilles — l'affiche, la coche « déjà dans ton journal », le titre, un sous-titre facultatif. */
function Tuile({
  coverUrl,
  title,
  sousTitre: sousTitreTexte,
  dejaVu,
  candidat,
}: {
  coverUrl: string | null
  title: string
  sousTitre?: string | null
  dejaVu: boolean
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

/** « À l'affiche dans mes cinémas » (Allociné) : sous-titre les cinémas, ouvrable seulement si TMDB a été résolu. */
function TuileEnCours({ film, dejaVu }: { film: SortieEnCoursFilm; dejaVu: boolean }) {
  return (
    <Tuile
      coverUrl={film.cover_url}
      title={film.title}
      sousTitre={sousTitreCinemas(film.cinemas)}
      dejaVu={dejaVu}
      candidat={sortieEnCoursOuvrable(film) ? candidatDepuisSortieEnCours(film) : null}
    />
  )
}

/** « La semaine prochaine » (TMDB) : toujours ouvrable, pas de cinéma à afficher. */
function TuileProchaine({ film, dejaVu }: { film: SortieProchaineFilm; dejaVu: boolean }) {
  return (
    <Tuile
      coverUrl={film.cover_url}
      title={film.title}
      dejaVu={dejaVu}
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
