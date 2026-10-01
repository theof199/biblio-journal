import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { chercherFilms } from '../api/recherche'
import { ajouterFilmSaga, lireFilmsSaga, lireSagas, neplusSuivreSaga, retirerFilmSaga } from '../api/sagas'
import { destinationFilmSaga } from '../suivis/destination'
import { basculerMasquerIntrouvables, useMasquerIntrouvables } from '../suivis/masquer'
import { filmsVus } from '../suivis/prochain'
import { useValeurDebouncee } from '../recherche/useValeurDebouncee'
import { sousTitre } from '../ui/format'
import type { MovieSearchResult } from '../api/recherche'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import Panne from '../ui/Panne'
import styles from './PageSaga.module.css'

/** Ce que dit la page quand l'ajout ou le retrait d'un film échoue : sans détail, comme sur Android. */
const ECHEC = 'Impossible pour l’instant'

/**
 * « Ajouter un film » (reprise de `Screen.ChoisirFilmDeSaga`, Android) : la recherche de films
 * existante, en mode « choisir » — un film trouvé s'ajoute à la main à la saga (`PUT
 * /me/sagas/{tmdbId}/films/{filmId}`), pour ceux que sa collection TMDB ne porte pas.
 */
function AjouterFilm({ onChoisir, desactive }: { onChoisir: (filmId: number) => void; desactive: boolean }) {
  const [saisie, setSaisie] = useState('')
  const requete = useValeurDebouncee(saisie, 300).trim()
  const recherche = useQuery({
    queryKey: ['recherche', 'movie', requete],
    queryFn: ({ signal }) => chercherFilms(requete, signal),
    enabled: requete.length > 0,
  })
  // Seul un identifiant TMDB entier s'ajoute (`toIntOrNull`, Android) : jamais un `PUT …/films/NaN`.
  const resultats = (recherche.data?.items ?? []).filter(
    (r): r is MovieSearchResult => r.type === 'movie' && /^\d+$/.test(r.external_id),
  )

  return (
    <div className={styles.ajout}>
      <input
        type="search"
        value={saisie}
        onChange={(event) => setSaisie(event.target.value)}
        placeholder="Un titre de film"
        aria-label="Chercher un film à ajouter"
        className={styles.champ}
        autoFocus
      />
      {requete ? (
        recherche.error ? (
          <p role="alert">{recherche.error.message}</p>
        ) : recherche.isPending ? (
          <p role="status">Recherche…</p>
        ) : resultats.length === 0 ? (
          <p className={styles.vide}>Rien trouvé pour « {requete} ».</p>
        ) : (
          <ul className={styles.liste}>
            {resultats.map((resultat) => (
              <li key={resultat.external_id} className={styles.ligneFilm}>
                <Affiche src={resultat.cover_url} titre={resultat.title} taille="ligne" />
                <div className={styles.infosFilm}>
                  <p className={styles.titreFilm}>{resultat.title}</p>
                  <p className={styles.etatFilm}>{sousTitre(resultat.metadata.director, resultat.year)}</p>
                </div>
                <button
                  type="button"
                  className={styles.bouton}
                  disabled={desactive}
                  aria-label={`Ajouter ${resultat.title} à la saga`}
                  onClick={() => onChoisir(Number(resultat.external_id))}
                >
                  Ajouter
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}

/**
 * La page d'une saga (reprise de `FicheSuiviScreen.kt`, réduite aux sagas depuis que le réalisateur
 * a la sienne) : ses films, vus et à voir, et « Ne plus suivre ». Le nom et l'affiche viennent de
 * `GET /me/sagas` (`cles.sagas`, déjà en cache depuis l'onglet Suivis qui y mène toujours) plutôt
 * que de l'état de navigation : la page reste correcte sur un accès direct ou un rechargement, et
 * `GET /me/sagas/{tmdbId}/films` n'a rien à en dire — il ne rend que `films`.
 */
export default function PageSaga() {
  const { tmdbId } = useParams<{ tmdbId: string }>()
  const id = Number(tmdbId)
  const client = useQueryClient()
  const naviguer = useNavigate()

  const sagas = useQuery({ queryKey: cles.sagas, queryFn: ({ signal }) => lireSagas(signal) })
  const films = useQuery({
    queryKey: cles.filmsSaga(id),
    queryFn: ({ signal }) => lireFilmsSaga(id, signal),
  })

  const [confirmation, setConfirmation] = useState(false)
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const masquerIntrouvables = useMasquerIntrouvables()

  // Jumeaux : ils rechargent les films de cette saga, et disent « Ajouté à la saga » / « Retiré de la
  // saga » — ou l'échec, sans détail (`SuivisViewModel.ajouterFilm`/`retirerFilm`, Android).
  const ajouterFilm = useMutation({
    mutationFn: (filmId: number) => ajouterFilmSaga(id, filmId),
    onSuccess: () => {
      setMessage('Ajouté à la saga')
      setAjoutOuvert(false)
      void client.invalidateQueries({ queryKey: cles.filmsSaga(id) })
    },
    onError: () => setMessage(ECHEC),
  })
  const retirerFilm = useMutation({
    mutationFn: (filmId: number) => retirerFilmSaga(id, filmId),
    onSuccess: () => {
      setMessage('Retiré de la saga')
      void client.invalidateQueries({ queryKey: cles.filmsSaga(id) })
    },
    onError: () => setMessage(ECHEC),
  })

  const neplusSuivre = useMutation({
    mutationFn: () => neplusSuivreSaga(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cles.sagas })
      naviguer('/suivis', { replace: true })
    },
  })

  if (sagas.isPending || films.isPending) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <p role="status">Chargement…</p>
      </div>
    )
  }
  if (sagas.error) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <Panne erreur={sagas.error} onReessayer={() => void sagas.refetch()} />
      </div>
    )
  }

  const saga = sagas.data.find((s) => s.tmdb_id === id)

  if (!saga) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <p>Tu ne suis plus cette saga.</p>
        <Link to="/suivis">Retour aux Suivis</Link>
      </div>
    )
  }
  if (films.error) {
    return (
      <div className={styles.page}>
        <BoutonRetour vers="/suivis" />
        <Panne erreur={films.error} onReessayer={() => void films.refetch()} />
      </div>
    )
  }

  const lesFilms = films.data.films
  // Masqués, les introuvables quittent la liste (reprise de `FicheSuiviScreen`) ; le compte de
  // l'en-tête, lui, garde tous les films.
  const filmsAffiches = masquerIntrouvables ? lesFilms.filter((film) => !film.introuvable) : lesFilms

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers="/suivis" />
      </div>

      <div className={styles.fiche}>
        <Affiche src={saga.cover_url} titre={saga.name} taille="ligne" className={styles.photo} />
        <div className={styles.infos}>
          <h1 className={styles.nom}>{saga.name}</h1>
          <p className={styles.compte}>
            {filmsVus(lesFilms)} vus sur {lesFilms.length}
          </p>
        </div>
      </div>

      {confirmation ? (
        <div role="alertdialog" aria-labelledby="titre-confirmation" className={styles.confirmation}>
          <h2 id="titre-confirmation" className={styles.titreConfirmation}>
            Ne plus suivre {saga.name} ?
          </h2>
          <p className={styles.texteConfirmation}>
            Ses films disparaîtront de la liste. Tes films vus, eux, restent au journal.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.boutonSuivre}
              onClick={() => neplusSuivre.mutate()}
              disabled={neplusSuivre.isPending}
            >
              Ne plus suivre
            </button>
            <button type="button" className={styles.bouton} onClick={() => setConfirmation(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.boutonSuivre} onClick={() => setConfirmation(true)}>
            Ne plus suivre
          </button>
          <button type="button" className={styles.bouton} onClick={() => setAjoutOuvert((ouvert) => !ouvert)}>
            Ajouter un film
          </button>
        </div>
      )}
      {neplusSuivre.error ? (
        <p role="alert">
          {neplusSuivre.error instanceof Error ? neplusSuivre.error.message : String(neplusSuivre.error)}
        </p>
      ) : null}
      {ajoutOuvert ? (
        <AjouterFilm onChoisir={(filmId) => ajouterFilm.mutate(filmId)} desactive={ajouterFilm.isPending} />
      ) : null}
      {message ? <p role="status">{message}</p> : null}

      <label className={styles.interrupteur}>
        <input type="checkbox" role="switch" checked={masquerIntrouvables} onChange={basculerMasquerIntrouvables} />
        Masquer les introuvables
      </label>

      {lesFilms.length === 0 ? (
        <p className={styles.vide}>Aucun film connu pour cette saga.</p>
      ) : (
        <ul className={styles.liste}>
          {filmsAffiches.map((film) => (
            <li key={film.tmdb_id} className={styles.ligneFilm}>
              <Link {...destinationFilmSaga(film)} className={styles.film}>
                <Affiche src={film.cover_url} titre={film.title} taille="ligne" />
                <div className={styles.infosFilm}>
                  <p className={styles.titreFilm}>
                    {film.title}
                    {film.year ? ` (${film.year})` : ''}
                    {film.ajoute ? <span className={styles.ajoute}> ajouté</span> : null}
                  </p>
                  <p className={styles.etatFilm}>
                    {film.vu
                      ? `Vu${film.vu.rating != null ? ` · ${film.vu.rating}/10` : ''}`
                      : film.introuvable
                        ? 'Introuvable'
                        : 'À voir'}
                  </p>
                </div>
              </Link>
              {/* Seul un film ajouté à la main se retire, même déjà vu (`peutRetirerDeSaga`, Android). */}
              {film.ajoute ? (
                <button
                  type="button"
                  className={styles.bouton}
                  disabled={retirerFilm.isPending}
                  aria-label={`Retirer ${film.title} de la saga`}
                  onClick={() => retirerFilm.mutate(film.tmdb_id)}
                >
                  Retirer de la saga
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
