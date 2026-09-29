import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { curseurSuivant, itemAuJournal, lireJournal } from '../api/journal'
import { lireRealisateursDuFilm } from '../api/personnes'
import { lireReactions } from '../api/reactions'
import { candidatDepuisFilmSuivi } from '../formulaire/candidat'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import styles from './FicheFilm.module.css'

const LIMITE = 20

/**
 * Un film de filmographie ou de saga, réduit à ce que cette fiche affiche — `FilmRealisateur`
 * (`api/realisateurs.ts`) et `FilmSaga` (`api/sagas.ts`) partagent tous ces champs, sauf
 * `plex_url`, propre au premier (facultatif ici : une saga n'en porte pas).
 */
interface FilmPourFiche {
  tmdb_id: number
  title: string
  original_title: string | null
  year: number | null
  cover_url: string | null
  vu: { entry_id: string; rating: number | null; finished_at: string } | null
  introuvable: boolean
  plex_url?: string | null
}

/** Le réalisateur connu d'avance (page d'où la fiche s'est ouverte), ou nul quand il reste à résoudre (saga). */
interface RealisateurConnu {
  tmdb_id: number
  name: string
}

interface EtatFiche {
  film: FilmPourFiche
  realisateur: RealisateurConnu | null
}

/**
 * La fiche d'un film (reprise de `FicheFilmScreen.kt`) : à ne pas confondre avec la fiche d'un
 * visionnage (`Fiche.tsx`), qui porte le carnet. Celle-ci parle du **média** — nourrie par la ligne
 * de filmographie ou de saga d'où elle s'ouvre (état de navigation, comme `Fiche.tsx`), rien d'autre
 * à charger pour un réalisateur déjà connu. Sur une saga, le réalisateur n'est pas connu d'avance :
 * `GET /reference/films/{tmdbId}/realisateurs` le résout, comme `NomRealisateurTouchable` sur
 * l'appli.
 *
 * `vu` ne porte que la note et la date de mon visionnage le plus récent (`{ entry_id, rating,
 * finished_at }`, `GET /me/realisateurs/…/films` et `GET /me/sagas/…/films`) — jamais la remarque
 * ni les réactions, propres au carnet. Pour les montrer (comme `FicheFilmScreen.kt` : « les
 * réactions de l'entrée quand on la connaît »), cette fiche retrouve l'entrée complète dans le
 * cache du journal **du membre courant seulement** (`itemAuJournal`, `api/journal.ts`) : jamais un
 * appel réseau pour le carnet d'un autre membre, jamais la moindre trace de lui ici — la route qui
 * pourrait un jour servir le film d'un autre membre (`GET /media/:id/log`) n'est pas appelée par
 * cette fiche. Sans l'entrée en cache (journal pas encore chargé), la fiche se prive de « Corriger »
 * et des réactions plutôt que de deviner — même dégradation que sur l'appli.
 */
export default function FicheFilm() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const location = useLocation()
  const naviguer = useNavigate()
  const etat = (location.state as EtatFiche | null) ?? null

  const realisateursDuFilm = useQuery({
    queryKey: ['realisateurs-du-film', tmdbId],
    queryFn: ({ signal }) => lireRealisateursDuFilm(Number(tmdbId), signal),
    enabled: etat != null && etat.realisateur == null,
  })
  // Le journal et les réactions ne servent qu'à un film déjà vu : sans ça, deux appels inutiles
  // partiraient sur chaque film « à voir » de la filmographie.
  const journal = useInfiniteQuery({
    queryKey: cles.journal,
    queryFn: ({ pageParam, signal }) => lireJournal({ limit: LIMITE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => curseurSuivant(page),
    enabled: etat != null && etat.film.vu != null,
  })
  const reactions = useQuery({
    queryKey: cles.reactions,
    queryFn: ({ signal }) => lireReactions(signal),
    enabled: etat != null && etat.film.vu != null,
  })

  if (!etat) {
    return (
      <div className={styles.page}>
        <div className={styles.entete}>
          <BoutonRetour vers="/suivis" />
        </div>
        <p>Ce film n’est plus disponible. Repars des Suivis.</p>
        <Link to="/suivis">Retour aux Suivis</Link>
      </div>
    )
  }

  const { film } = etat
  const realisateurs = etat.realisateur ? [etat.realisateur] : (realisateursDuFilm.data?.realisateurs ?? [])
  const item = film.vu ? itemAuJournal(journal.data?.pages ?? [], String(film.tmdb_id)) : undefined
  const phrase = (cle: string) => reactions.data?.reactions.find((r) => r.cle === cle)?.phrase ?? cle
  const emoji = (cle: string) => reactions.data?.reactions.find((r) => r.cle === cle)?.emoji ?? ''

  const marquerCommeVu = () => {
    const nom = realisateurs[0]?.name ?? null
    naviguer('/journal/nouveau', { state: { candidat: candidatDepuisFilmSuivi(film, nom) } })
  }

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour />
      </div>

      <div className={styles.film}>
        <Affiche src={film.cover_url} titre={film.title} className={styles.affiche} />
        <div className={styles.infos}>
          <h1 className={styles.titre}>{film.title}</h1>
          {film.original_title && film.original_title !== film.title ? (
            <p className={styles.titreOriginal}>{film.original_title}</p>
          ) : null}
          {film.year ? <p className={styles.annee}>{film.year}</p> : null}
          {realisateurs.length > 0 ? (
            <p className={styles.realisateurs}>
              {realisateurs.map((r, i) => (
                <span key={r.tmdb_id}>
                  {i > 0 ? ', ' : ''}
                  <Link to={`/suivis/realisateurs/${r.tmdb_id}`} className={styles.lienRealisateur}>
                    {r.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      {film.vu ? (
        <p className={styles.vu}>
          Vu{film.vu.rating != null ? ` · noté ${film.vu.rating} / 10` : ''}
        </p>
      ) : (
        <button type="button" className={styles.bouton} onClick={marquerCommeVu}>
          Marquer comme vu
        </button>
      )}

      {item && item.carnet.reactions.length > 0 ? (
        <div className={styles.puces}>
          {item.carnet.reactions.map((cle) => (
            <span key={cle} className={styles.puce}>
              {emoji(cle)} {phrase(cle)}
            </span>
          ))}
        </div>
      ) : null}

      {film.vu && item ? (
        <Link to={`/journal/${item.entry.id}/corriger`} state={{ item }} className={styles.bouton}>
          Corriger
        </Link>
      ) : null}

      {film.introuvable ? <p className={styles.introuvable}>Marqué introuvable</p> : null}

      {film.plex_url ? (
        <a href={film.plex_url} target="_blank" rel="noreferrer" className={styles.boutonSecondaire}>
          Voir sur le Plex
        </a>
      ) : null}
    </div>
  )
}
