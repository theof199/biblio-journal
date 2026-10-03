import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { curseurSuivant, itemAuJournal, lireJournal } from '../api/journal'
import { lireFicheReference, lireRealisateursDuFilm } from '../api/personnes'
import type { OuRegarder } from '../api/personnes'
import { lireReactions } from '../api/reactions'
import { demanderFilm, marquerIntrouvable, retirerIntrouvable } from '../api/realisateurs'
import { candidatDepuisFilmSuivi } from '../formulaire/candidat'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import { formatDuree } from '../ui/format'
import styles from './FicheFilm.module.css'

const LIMITE = 20

/** Les modes de « Où regarder », dans l'ordre où on les cherche : ce qu'on a déjà payé d'abord. */
const MODES: { cle: 'subscription' | 'rent' | 'buy' | 'free' | 'ads'; libelle: string }[] = [
  { cle: 'subscription', libelle: 'Abonnement' },
  { cle: 'rent', libelle: 'Location' },
  { cle: 'buy', libelle: 'Achat' },
  { cle: 'free', libelle: 'Gratuit' },
  { cle: 'ads', libelle: 'Avec publicité' },
]

function modesNonVides(ouRegarder: OuRegarder) {
  return MODES.filter((mode) => ouRegarder[mode.cle].length > 0)
}

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
  /** Propres à une filmographie de réalisateur (pas à une saga) : ce qui décide de « Demander sur Sir ». */
  sur_le_plex?: boolean
  demande?: boolean
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
 * de filmographie ou de saga d'où elle s'ouvre (état de navigation, comme `Fiche.tsx`) pour l'en-tête,
 * le « Vu » et les marques. Sur une saga, le réalisateur n'est pas connu d'avance :
 * `GET /reference/films/{tmdbId}/realisateurs` le résout, comme `NomRealisateurTouchable` sur
 * l'appli.
 *
 * Ce que la ligne ne porte pas (durée, genres, synopsis, casting, où regarder) vient de
 * `GET /reference/films/{tmdbId}`. Cette lecture est secondaire : rien d'autre sur la page ne
 * l'attend et son échec ne se montre pas, les sections qu'elle nourrit sont simplement absentes.
 * « Où regarder » ne se montre jamais sans la mention JustWatch, que les conditions de TMDB exigent
 * sur chaque œuvre.
 *
 * `vu` ne porte que la note et la date de mon visionnage le plus récent (`{ entry_id, rating,
 * finished_at }`, `GET /me/realisateurs/…/films` et `GET /me/sagas/…/films`) — jamais la remarque
 * ni les réactions, propres au carnet. Pour les montrer (comme `FicheFilmScreen.kt` : « les
 * réactions de l'entrée quand on la connaît »), cette fiche retrouve l'entrée complète dans le
 * cache du journal **du membre courant seulement** (`itemAuJournal`, `api/journal.ts`) : jamais un
 * appel réseau pour le carnet d'un autre membre, jamais la moindre trace de lui ici — la route qui
 * pourrait un jour servir le film d'un autre membre (`GET /media/:id/log`) n'est pas appelée par
 * cette fiche. L'entrée se retrouve par `vu.entry_id`, page après page du journal tant qu'elle
 * manque ; sans elle (journal en panne), la fiche se prive de « Corriger » et des réactions plutôt
 * que de deviner — même dégradation que sur l'appli.
 *
 * Comme `FicheFilmScreen.kt` : « Introuvable » sur un film pas encore vu, « Le remettre à voir » sur
 * un film marqué, et « Demander sur Sir » sur un film de filmographie absent du Plex.
 */
export default function FicheFilm() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const location = useLocation()
  const naviguer = useNavigate()
  const client = useQueryClient()
  const etat = (location.state as EtatFiche | null) ?? null

  const realisateursDuFilm = useQuery({
    queryKey: ['realisateurs-du-film', tmdbId],
    queryFn: ({ signal }) => lireRealisateursDuFilm(Number(tmdbId), signal),
    enabled: etat != null && etat.realisateur == null,
  })
  const fiche = useQuery({
    queryKey: cles.ficheReference(Number(tmdbId)),
    queryFn: ({ signal }) => lireFicheReference(Number(tmdbId), signal),
    enabled: etat != null,
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

  const entryId = etat?.film.vu?.entry_id
  const item = entryId ? itemAuJournal(journal.data?.pages ?? [], entryId) : undefined

  // L'entrée d'un film vu il y a longtemps n'est pas dans la première page : on lit la suivante
  // tant qu'elle manque (Android relit le journal complet, `chargerEntrees`). Jamais sur erreur —
  // `isFetchNextPageError` arrête la course, la fiche se prive alors de « Corriger » et des
  // réactions — et jamais au-delà du dernier curseur.
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = journal
  const aChercher = entryId != null && item == null
  useEffect(() => {
    if (aChercher && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage()
  }, [aChercher, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  // Les marques posées ici se voient aussitôt, sans attendre que la ligne d'origine soit relue : la
  // fiche vit de l'état de navigation, figé à l'ouverture.
  const [introuvableIci, setIntrouvableIci] = useState<boolean | null>(null)
  const [demandeIci, setDemandeIci] = useState(false)

  // Une marque « introuvable » change le prochain à voir de toutes les filmographies et sagas, et
  // peut compléter une salle du Voyage (contrat de `PUT /me/introuvables/{tmdbId}`).
  const perimerLesSuivis = () => {
    void client.invalidateQueries({ queryKey: cles.realisateurs })
    void client.invalidateQueries({ queryKey: cles.sagas })
    void client.invalidateQueries({ queryKey: cles.voyage })
  }
  const introuvable = useMutation({
    mutationFn: async (marquer: boolean): Promise<boolean> => {
      const tmdb = Number(tmdbId)
      if (marquer) await marquerIntrouvable(tmdb)
      else await retirerIntrouvable(tmdb)
      return marquer
    },
    onSuccess: (marque) => {
      setIntrouvableIci(marque)
      perimerLesSuivis()
    },
  })
  const demande = useMutation({
    mutationFn: () => demanderFilm(Number(tmdbId)),
    onSuccess: () => {
      setDemandeIci(true)
      void client.invalidateQueries({ queryKey: cles.realisateurs })
      void client.invalidateQueries({ queryKey: cles.plex })
    },
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
  const estIntrouvable = introuvableIci ?? film.introuvable
  const estDemande = demandeIci || film.demande === true
  // « Demander sur Sir » : un film de filmographie ni vu, ni introuvable, ni sur le Plex, ni déjà
  // demandé (`etatFilmographie`, Android). Une saga ne porte pas ces champs : jamais proposé.
  const demandable = film.vu == null && !estIntrouvable && film.sur_le_plex === false && !estDemande
  const phrase = (cle: string) => reactions.data?.reactions.find((r) => r.cle === cle)?.phrase ?? cle
  const emoji = (cle: string) => reactions.data?.reactions.find((r) => r.cle === cle)?.emoji ?? ''

  const reference = fiche.data
  const duree = reference?.runtime_min ? formatDuree(reference.runtime_min) : null
  const genres = reference?.genres.join(', ') ?? ''
  const ligneDuree = [duree, genres].filter((morceau) => morceau).join(' · ')
  const ouRegarder = reference?.availability ?? null
  const modes = ouRegarder ? modesNonVides(ouRegarder) : []

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

      {ligneDuree ? <p className={styles.duree}>{ligneDuree}</p> : null}
      {reference?.summary ? <p className={styles.synopsis}>{reference.summary}</p> : null}

      {reference && reference.cast.length > 0 ? (
        <section aria-labelledby="titre-casting">
          <h2 id="titre-casting" className={styles.titreSection}>
            Casting
          </h2>
          <ul className={styles.casting}>
            {reference.cast.map((tete) => (
              <li key={`${tete.name}-${tete.character ?? ''}`} className={styles.tete}>
                {/* Sans portrait, le cadre vide : le nom est dessous, l'annoncer deux fois n'apprend rien. */}
                <Affiche src={tete.photo_url} titre="" taille="ligne" className={styles.portrait} />
                <span className={styles.nomTete}>{tete.name}</span>
                {tete.character ? <span className={styles.role}>{tete.character}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ouRegarder && modes.length > 0 ? (
        <section aria-labelledby="titre-ou-regarder">
          <h2 id="titre-ou-regarder" className={styles.titreSection}>
            Où regarder
          </h2>
          {modes.map((mode) => (
            <div key={mode.cle} className={styles.mode}>
              <h3 className={styles.libelleMode}>{mode.libelle}</h3>
              <ul className={styles.plateformes}>
                {ouRegarder[mode.cle].map((plateforme) => (
                  <li key={plateforme.id} className={styles.plateforme}>
                    {plateforme.logo_url ? (
                      <img src={plateforme.logo_url} alt="" className={styles.logo} />
                    ) : null}
                    {plateforme.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className={styles.attribution}>
            <a href={ouRegarder.attribution.url} target="_blank" rel="noreferrer">
              {ouRegarder.attribution.text}
            </a>
          </p>
        </section>
      ) : null}

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

      {estIntrouvable ? <p className={styles.introuvable}>Marqué introuvable</p> : null}

      {film.plex_url ? (
        <a href={film.plex_url} target="_blank" rel="noreferrer" className={styles.boutonSecondaire}>
          Voir sur le Plex
        </a>
      ) : null}

      {demandable ? (
        <button
          type="button"
          className={styles.boutonSecondaire}
          onClick={() => demande.mutate()}
          disabled={demande.isPending}
        >
          Demander sur Sir
        </button>
      ) : null}
      {estDemande && film.vu == null ? <p className={styles.introuvable}>Demandé</p> : null}
      {demande.error ? <p role="alert">{demande.error.message}</p> : null}

      {/* Un film vu n'a pas de marque à poser (`boutonsFicheFilm`, Android) ; un film marqué se
          remet à voir, qu'on l'ait vu depuis ou non. */}
      {estIntrouvable ? (
        <button
          type="button"
          className={styles.boutonSecondaire}
          onClick={() => introuvable.mutate(false)}
          disabled={introuvable.isPending}
        >
          Le remettre à voir
        </button>
      ) : film.vu == null ? (
        <button
          type="button"
          className={styles.boutonSecondaire}
          onClick={() => introuvable.mutate(true)}
          disabled={introuvable.isPending}
        >
          Introuvable
        </button>
      ) : null}
      {introuvable.error ? <p role="alert">{introuvable.error.message}</p> : null}
    </div>
  )
}
