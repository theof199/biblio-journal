import { useCallback, useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IconCheck, IconMovie, IconUser } from '@tabler/icons-react'
import { cles } from '../api/cles'
import { curseurSuivant, lireSeances } from '../api/journal'
import { lireRealisateurs } from '../api/realisateurs'
import { lireSagas } from '../api/sagas'
import { lireProchainesSeances } from '../api/seances'
import { lireSorties } from '../api/sorties'
import { sortieEnCoursOuvrable } from '../formulaire/candidat'
import {
  cinemaUniqueEnCours,
  dejaDansLeJournal,
  dernierVisionnage,
  marqueEnCours,
  marqueProchaine,
  messageAuCine,
  miseAJourAffichee,
  reperesSuivis,
  seancesCetteAnnee,
  sousTitreCinemas,
  type MarqueSuivi,
} from '../cinema/etats'
import { entreesDuTableau, heureAffichee, prochaineSeanceParFilm } from '../cinema/seances'
import { TableauDuHall, TableauEnAttente } from '../cinema/TableauDuHall'
import { useMaintenant } from '../cinema/useMaintenant'
import { usePosition } from '../cinema/usePosition'
import { useFilmographiesSagas } from '../suivis/useFilmographies'
import { useChargementInfini } from '../accueil/useChargementInfini'
import Affiche from '../ui/Affiche'
import Attente, { Barre } from '../ui/Attente'
import Sceau from '../ui/Sceau'
import Panne from '../ui/Panne'
import { formatDateVisionnage, sousTitre } from '../ui/format'
import styles from './AuCine.module.css'
import type { JournalItem } from '../api/journal'
import type { SortieEnCoursFilm, SortieProchaineFilm } from '../api/sorties'
import type { EtatFiche } from './FicheFilm'

/** Deux rangées de la grille des sorties, trois tuiles chacune. */
const TUILES_EN_ATTENTE = 6
const LIGNES_EN_ATTENTE = 3

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
 * « Prochaines séances » (`GET /me/cinema/seances`, une seule requête de plus) ouvre la page : le
 * tableau du hall (`cinema/TableauDuHall.tsx`), puis, sur chaque tuile de la semaine, l'heure de sa
 * prochaine séance. Les séances commencées s'en vont d'elles-mêmes (`useMaintenant`, une horloge qui
 * refiltre, jamais un nouvel appel). La position du membre, qui ne sert qu'à classer les salles par
 * distance, ne se demande qu'au toucher de « Autoriser » (`cinema/usePosition.ts`). Toucher un film
 * ouvre sa fiche sous `au-cine/films/:tmdbId`, l'onglet restant marqué.
 *
 * Trois appels indépendants, chacun avec son chargement et son erreur (même règle que
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

  const prochainesSeances = useQuery({
    queryKey: cles.prochainesSeances,
    queryFn: ({ signal }) => lireProchainesSeances(signal),
  })
  const position = usePosition()
  const maintenant = useMaintenant()

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

  const entrees = useMemo(
    () => entreesDuTableau(prochainesSeances.data, position.coordonnees, maintenant),
    [prochainesSeances.data, position.coordonnees, maintenant],
  )
  const prochaineParFilm = useMemo(
    () => prochaineSeanceParFilm(prochainesSeances.data?.seances, maintenant),
    [prochainesSeances.data, maintenant],
  )
  // Offrir la position n'a de sens que si un cinéma a des coordonnées à rapprocher d'elle.
  const proposerPosition =
    position.statut === 'a_demander' && (prochainesSeances.data?.cinemas.some((cinema) => cinema.latitude != null && cinema.longitude != null) ?? false)
  const ouvrir = (film: FilmOuvrable) => ({ to: `/au-cine/films/${film.tmdb_id}`, state: etatFiche(film, items) })

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
        {/* Absent tant que les séances ne sont pas là : « 0 séance » à côté d'un squelette se lirait comme un fait. */}
        {seances.isPending ? null : (
          <p className={styles.compte}>
            {compte} séance{compte > 1 ? 's' : ''} cette année
          </p>
        )}
      </div>

      <section className={styles.section}>
        <div className={styles.enteteSection}>
          <p className={styles.titreSection}>Prochaines séances</p>
          <p className={styles.maj}>Aujourd’hui</p>
        </div>
        {prochainesSeances.isPending ? (
          <TableauEnAttente />
        ) : prochainesSeances.error ? (
          <Panne erreur={prochainesSeances.error} onReessayer={() => void prochainesSeances.refetch()} />
        ) : (
          <TableauDuHall
            entrees={entrees}
            maintenantMs={maintenant}
            ouvrir={ouvrir}
            proposerPosition={proposerPosition}
            onAutoriser={position.demander}
          />
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.enteteSection}>
          <p className={styles.titreSection}>Sorti cette semaine dans mes cinémas</p>
          {majAffichee ? <p className={styles.maj}>{majAffichee}</p> : null}
        </div>
        {sorties.isPending ? (
          <GrilleEnAttente avecSousTitre />
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
                  ouvrir={ouvrir}
                  prochaineSeance={film.tmdb_id == null ? null : (prochaineParFilm.get(film.tmdb_id) ?? null)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.section}>
        <p className={styles.titreSection}>La semaine prochaine</p>
        {sorties.isPending ? (
          // Même requête que la section du dessus, qui l'annonce : un seul statut pour les deux grilles.
          <GrilleEnAttente muet />
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
                ouvrir={ouvrir}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <p className={styles.titreSection}>Tes séances</p>

        {seances.isPending ? (
          <Attente>
            <div className={styles.liste}>
              {Array.from({ length: LIGNES_EN_ATTENTE }, (_, ligne) => (
                <LigneEnAttente key={ligne} />
              ))}
            </div>
          </Attente>
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

/** Ce qu'il faut d'un film pour ouvrir sa fiche : les quatre champs que `FicheFilm` lit de son état de navigation. */
interface FilmOuvrable {
  tmdb_id: number
  title: string
  year: number | null
  cover_url: string | null
}

type Ouvrir = (film: FilmOuvrable) => { to: string; state: unknown }

/**
 * L'état de navigation de la fiche d'un film ouvert depuis Au ciné : la fiche vit de lui. Ce que la
 * ligne ne dit pas, la fiche le lit (`GET /reference/films/{id}`) ou le résout (ses réalisateurs).
 * « Vu » vient des séances chargées de cet onglet, comme la coche des tuiles : un film vu hors salle,
 * ou plus loin que les pages chargées, s'ouvre donc comme « à voir ».
 */
function etatFiche(film: FilmOuvrable, journal: JournalItem[]): EtatFiche {
  const visionnage = dernierVisionnage(journal, film.tmdb_id)
  return {
    film: {
      tmdb_id: film.tmdb_id,
      title: film.title,
      original_title: null,
      year: film.year,
      cover_url: film.cover_url,
      vu: visionnage
        ? { entry_id: visionnage.entry.id, rating: visionnage.entry.rating, finished_at: visionnage.entry.finished_at }
        : null,
      introuvable: false,
    },
    realisateur: null,
  }
}

/**
 * Une tuile de sortie, commune aux deux grilles — l'affiche, la coche « déjà dans ton journal » en
 * bas à droite, l'heure de la prochaine séance en bas à gauche, le sceau d'un suivi en haut à droite,
 * le titre, un sous-titre facultatif.
 */
function Tuile({
  coverUrl,
  title,
  sousTitre: sousTitreTexte,
  dejaVu,
  marque,
  film,
  ouvrir,
  prochaineSeance = null,
}: {
  coverUrl: string | null
  title: string
  sousTitre?: string | null
  dejaVu: boolean
  marque: MarqueSuivi | null
  /** `null` : la tuile n'est pas ouvrable (aucun `tmdb_id` résolu côté back), pas de fiche à ouvrir. */
  film: FilmOuvrable | null
  ouvrir: Ouvrir
  /** Le début de la prochaine séance à venir de ce film aujourd'hui, ou rien : alors aucun repère. */
  prochaineSeance?: string | null
}) {
  const contenu = (
    <>
      <div className={styles.jaquette}>
        <Affiche src={coverUrl} titre={title} taille="ligne" className={styles.afficheTuile} chargement="lazy" />
        {dejaVu ? (
          <span className={styles.coche} aria-label="Déjà dans ton journal">
            <IconCheck aria-hidden="true" className={styles.iconeCoche} />
          </span>
        ) : null}
        {marque ? (
          <Sceau
            icone={marque === 'realisateur' ? IconUser : IconMovie}
            libelle={marque === 'realisateur' ? 'Réalisateur suivi' : 'Saga suivie'}
            className={styles.sceau}
          />
        ) : null}
        {prochaineSeance ? (
          <span className={styles.heureTuile}>
            <span className="sr-only">Prochaine séance à </span>
            {heureAffichee(prochaineSeance)}
          </span>
        ) : null}
      </div>
      <p className={styles.titreTuile}>{title}</p>
      {sousTitreTexte ? <p className={styles.sousTitreTuile}>{sousTitreTexte}</p> : null}
    </>
  )

  if (!film) return <div className={styles.tuile}>{contenu}</div>

  const { to, state } = ouvrir(film)
  return (
    <Link to={to} state={state} className={styles.tuile}>
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
  ouvrir,
  prochaineSeance,
}: {
  film: SortieEnCoursFilm
  dejaVu: boolean
  marque: MarqueSuivi | null
  avecCinemas: boolean
  ouvrir: Ouvrir
  prochaineSeance: string | null
}) {
  return (
    <Tuile
      coverUrl={film.cover_url}
      title={film.title}
      sousTitre={avecCinemas ? sousTitreCinemas(film.cinemas) : null}
      dejaVu={dejaVu}
      marque={marque}
      film={sortieEnCoursOuvrable(film) ? film : null}
      ouvrir={ouvrir}
      prochaineSeance={prochaineSeance}
    />
  )
}

/** « La semaine prochaine » (TMDB) : toujours ouvrable, pas de cinéma à afficher, ni d'heure : rien n'y passe encore. */
function TuileProchaine({
  film,
  dejaVu,
  marque,
  ouvrir,
}: {
  film: SortieProchaineFilm
  dejaVu: boolean
  marque: MarqueSuivi | null
  ouvrir: Ouvrir
}) {
  return (
    <Tuile
      coverUrl={film.cover_url}
      title={film.title}
      dejaVu={dejaVu}
      marque={marque}
      film={film}
      ouvrir={ouvrir}
    />
  )
}

/**
 * Une grille de sorties laissée en blanc : deux rangées de trois tuiles. Celle de la semaine en cours
 * porte une ligne de plus sous le titre (les cinémas), celle de la semaine prochaine non.
 */
function GrilleEnAttente({ muet = false, avecSousTitre = false }: { muet?: boolean; avecSousTitre?: boolean }) {
  return (
    <Attente muet={muet}>
      <div className={styles.grille}>
        {Array.from({ length: TUILES_EN_ATTENTE }, (_, tuile) => (
          <div key={tuile} className={styles.tuile} data-testid="tuile-en-attente">
            <div className={styles.jaquette}>
              <Affiche src={null} titre="" taille="ligne" className={styles.afficheTuile} />
            </div>
            <div className={styles.titreTuile}>
              <Barre largeur="longue" />
            </div>
            {avecSousTitre ? (
              <div className={styles.sousTitreTuile}>
                <Barre largeur="courte" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Attente>
  )
}

/** Une ligne de « Tes séances » laissée en blanc : l'affiche et deux lignes de texte. */
function LigneEnAttente() {
  return (
    <div className={styles.ligne} data-testid="ligne-en-attente">
      <Affiche src={null} titre="" taille="ligne" />
      <div className={styles.infosLigne}>
        <div className={styles.titreLigne}>
          <Barre largeur="longue" />
        </div>
        <div className={styles.sousTitreLigne}>
          <Barre largeur="moyenne" />
        </div>
      </div>
    </div>
  )
}

/** Une ligne de « Tes séances » — jumelle de `LigneFilm` (`MesFilms.tsx`), sans filtre ni réaction. */
function LigneSeance({ item }: { item: JournalItem }) {
  return (
    <Link to={`/journal/${item.entry.id}`} state={{ item, depuis: '/au-cine' }} className={styles.ligne}>
      <Affiche src={item.media.cover_url} titre={item.media.title} note={item.entry.rating} taille="ligne" chargement="lazy" />
      <div className={styles.infosLigne}>
        <p className={styles.titreLigne}>{item.media.title}</p>
        <p className={styles.sousTitreLigne}>{sousTitre(item.media.director, item.media.year)}</p>
        <p className={styles.dateLigne}>{formatDateVisionnage(item.entry.finished_at)}</p>
      </div>
    </Link>
  )
}
