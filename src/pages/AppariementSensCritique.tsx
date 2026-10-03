import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { cles } from '../api/cles'
import { choisirFilmSensCritique, lireAApparier } from '../api/senscritique'
import type { CandidatSensCritique, ChoixSensCritique, FilmAApparier } from '../api/senscritique'
import Affiche from '../ui/Affiche'
import Attente, { Barre } from '../ui/Attente'
import BoutonRetour from '../ui/BoutonRetour'
import { formatDateVisionnage } from '../ui/format'
import styles from './AppariementSensCritique.module.css'

/** Les films, chacun avec ses deux candidats, laissés en blanc tant que la liste n'est pas là. */
const FILMS_EN_ATTENTE = 2
const CANDIDATS_EN_ATTENTE = 2

const titreAnnee = (titre: string, annee: number | null) => (annee != null ? `${titre} (${annee})` : titre)

/** Ce qui distingue deux candidats de même titre : le titre original s'il diffère, puis le réalisateur. */
const precisions = (candidat: CandidatSensCritique) =>
  [candidat.original_title !== candidat.title ? candidat.original_title : null, candidat.director].filter(
    (precision): precision is string => Boolean(precision),
  )

/** `409` sur le choix : SensCritique a refusé la session, et le choix n'a pas été mémorisé. */
const estSessionExpiree = (erreur: unknown) => erreur instanceof ApiError && erreur.code === 'SENSCRITIQUE_SESSION_EXPIREE'

const RESULTATS: Record<ChoixSensCritique['resultat'], string> = {
  envoye: 'La note est partie chez SensCritique.',
  en_attente: 'Choix retenu. L’envoi n’est pas passé : il sera rejoué.',
  memorise: 'Choix retenu.',
  ignore: 'Ce film ne partira pas chez SensCritique.',
}

/**
 * Les films à apparier (étape 25 du guide du back) : ceux dont la recherche chez SensCritique n'a
 * pas rendu un seul candidat net. L'API ne devine pas : rien ne part tant que le membre n'a pas dit
 * lequel c'est, ou « Aucun de ceux-là ». On y entre par la caisse (`profil/SensCritique.tsx`).
 *
 * **Un film tranché reste à l'écran**, avec ce que son choix a donné : la liste n'est pas relue
 * derrière lui, elle se relira à la prochaine visite.
 */
export default function AppariementSensCritique() {
  const films = useQuery({ queryKey: cles.senscritiqueAApparier, queryFn: ({ signal }) => lireAApparier(signal) })

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        <BoutonRetour vers="/profil/reglages" />
        <h1 className={styles.titre}>Films à apparier</h1>
      </div>
      {films.error ? (
        <p role="alert" className={styles.erreur}>
          {films.error.message}
        </p>
      ) : !films.data ? (
        <Attente className={styles.enAttente}>
          {Array.from({ length: FILMS_EN_ATTENTE }, (_, film) => (
            <FilmEnAttente key={film} />
          ))}
        </Attente>
      ) : films.data.items.length === 0 ? (
        <p>Aucun film à apparier.</p>
      ) : (
        <>
          <p className={styles.doux}>
            Pour ces films, SensCritique propose plusieurs fiches, ou aucune : rien ne part tant que tu n’as pas choisi. Un choix
            ne se redemande pas.
          </p>
          {films.data.items.map((film) => (
            <FilmAChoisir key={film.media_id} film={film} />
          ))}
        </>
      )}
    </div>
  )
}

/** Un film à apparier en blanc : son titre, sa date, et deux candidats, sans le bouton « Aucun de ceux-là » qui agirait sur rien. */
function FilmEnAttente() {
  return (
    <div className={styles.ligne} data-testid="film-en-attente">
      <div className={styles.nom}>
        <Barre largeur="longue" />
      </div>
      <div className={styles.doux}>
        <Barre largeur="moyenne" />
      </div>
      {Array.from({ length: CANDIDATS_EN_ATTENTE }, (_, candidat) => (
        <div key={candidat} className={`${styles.candidat} ${styles.inerte}`} data-testid="candidat-en-attente">
          <Affiche src={null} titre="" taille="ligne" />
          <div className={`${styles.candidatTexte} ${styles.colonne}`}>
            <Barre largeur="longue" />
            <Barre largeur="courte" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FilmAChoisir({ film }: { film: FilmAApparier }) {
  const client = useQueryClient()
  const choix = useMutation({
    mutationFn: (productId: number | null) => choisirFilmSensCritique(film.media_id, productId),
    onSuccess: ({ etat }) => {
      // La réponse porte l'état : la caisse l'apprend sans le relire.
      client.setQueryData(cles.senscritique, etat)
      void client.invalidateQueries({ queryKey: cles.senscritiqueAApparier, refetchType: 'none' })
    },
    onError: (erreur) => {
      // SensCritique a fermé la session : l'état que la caisse garde en cache dit encore « relié ».
      if (estSessionExpiree(erreur)) void client.invalidateQueries({ queryKey: cles.senscritique, exact: true })
    },
  })

  return (
    <div className={styles.ligne}>
      <p className={styles.nom}>{titreAnnee(film.title, film.year)}</p>
      <p className={styles.doux}>
        Vu le {formatDateVisionnage(film.watched_on)} · {film.rating}/10
      </p>
      {choix.data ? (
        <p role="status">{RESULTATS[choix.data.resultat]}</p>
      ) : (
        <>
          {film.candidates.length === 0 ? <p className={styles.doux}>SensCritique n’a rendu aucun film pour celui-ci.</p> : null}
          {film.candidates.map((candidat) => (
            <button
              key={candidat.product_id}
              type="button"
              className={styles.candidat}
              aria-label={[titreAnnee(candidat.title, candidat.year), ...precisions(candidat)].join(', ')}
              disabled={choix.isPending}
              onClick={() => choix.mutate(candidat.product_id)}
            >
              <Affiche src={candidat.picture_url} titre={candidat.title} taille="ligne" chargement="lazy" />
              <span className={styles.candidatTexte}>
                <span>{titreAnnee(candidat.title, candidat.year)}</span>
                {precisions(candidat).map((precision) => (
                  <span key={precision} className={styles.doux}>
                    {precision}
                  </span>
                ))}
              </span>
            </button>
          ))}
          <button type="button" className={styles.secondaire} disabled={choix.isPending} onClick={() => choix.mutate(null)}>
            Aucun de ceux-là
          </button>
          {choix.isPending ? (
            <p role="status" className={styles.doux}>
              Envoi du choix…
            </p>
          ) : null}
          {choix.error ? (
            <p role="alert" className={styles.erreur}>
              {choix.error.message}
            </p>
          ) : null}
          {/* Le choix n'a pas été mémorisé : il se refait une fois le compte relié, à la caisse. */}
          {estSessionExpiree(choix.error) ? <Link to="/profil/reglages">Relier mon compte à la caisse</Link> : null}
        </>
      )}
    </div>
  )
}
