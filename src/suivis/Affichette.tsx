import { Link } from 'react-router-dom'
import Attente, { Barre } from '../ui/Attente'
import type { FilmRealisateur } from '../api/realisateurs'
import { scinderNom, trousDeLaRetrospective } from './affichettes'
import AfficheSuivi from './AfficheSuivi'
import { compteCarte, dernierVisionnage, ligneBouclee, type EtatFilmographie } from './liste'
import { prochainAVoir } from './prochain'
import styles from './Affichette.module.css'

/**
 * L'affichette d'une rétrospective, punaisée au mur de la programmation : le portrait imprimé à
 * l'encre bleue, l'affiche du prochain film collée à son coin, le nom (prénoms en petit, dernier
 * mot en grand), « 9 séances sur 22 » et un trou poinçonné par film, puis « ensuite » et son titre.
 * Bouclée, elle porte le bandeau « Complet » et sa date de clôture, et n'a plus de prochain film.
 * Filmographie en attente ou en panne : le portrait, le nom, puis une ligne en blanc (« … » pour un
 * lecteur d'écran) ou « indisponible ».
 *
 * Toute l'affichette ouvre la page du réalisateur (le lien s'étend sur elle), mais seul le nom nomme
 * ce lien (`aria-label` : ses deux corps ne se liraient pas séparés d'une espace) ; la vignette et les
 * trous sont un décor, le compte et le prochain film se lisent à part.
 */
export default function Affichette({
  nom,
  image,
  lien,
  ajouteLe,
  etat,
  bouclee,
}: {
  nom: string
  image: string | null
  lien: string
  ajouteLe: string
  etat: EtatFilmographie<FilmRealisateur> | undefined
  bouclee: boolean
}) {
  const films = etat?.statut === 'pret' ? etat.films : null
  const { prenoms, dernier, long } = scinderNom(nom)
  // Bouclée, elle n'a plus de film à voir : ni vignette ni « ensuite », sans test à part.
  const prochain = films ? prochainAVoir(films) : undefined
  const ligneDeCloture = films && bouclee ? ligneBouclee('realisateurs', dernierVisionnage(films), ajouteLe) : null

  return (
    <li className={styles.affichette}>
      <span className={styles.punaise} aria-hidden="true" />
      <p className={styles.genre}>Rétrospective</p>
      <span className={styles.cadreCliche}>
        <span className={styles.cliche}>{image ? <img src={image} alt="" /> : null}</span>
        {prochain ? (
          <span className={styles.vignette} aria-hidden="true">
            <AfficheSuivi film={prochain} className={styles.afficheVignette} />
          </span>
        ) : null}
      </span>
      {bouclee ? <p className={styles.bandeau}>Complet</p> : null}
      <Link to={lien} className={styles.lien} aria-label={nom}>
        {prenoms ? <span className={styles.prenom}>{prenoms}</span> : null}
        <span className={long ? `${styles.nom} ${styles.nomLong}` : styles.nom}>{dernier}</span>
      </Link>
      {films ? (
        <Compte films={films} />
      ) : etat?.statut === 'indisponible' ? (
        <p className={styles.attente}>indisponible</p>
      ) : (
        <div className={styles.attente} data-testid="attente-carte">
          <span className="sr-only">…</span>
          <Attente muet>
            <Barre largeur="moyenne" />
          </Attente>
        </div>
      )}
      {prochain ? (
        <p className={styles.suite}>
          ensuite<b>{prochain.title}</b>
        </p>
      ) : null}
      {ligneDeCloture ? <p className={styles.suite}>{ligneDeCloture}</p> : null}
    </li>
  )
}

/** « 9 séances sur 22 », puis un trou par film : le texte porte le sens, les trous sont un décor. */
function Compte({ films }: { films: FilmRealisateur[] }) {
  const { vus, total } = compteCarte('realisateurs', films, false)
  return (
    <>
      <p className={styles.seances}>
        <b>{vus}</b> {vus > 1 ? 'séances' : 'séance'} sur {total}
      </p>
      <div className={styles.trous} aria-hidden="true">
        {trousDeLaRetrospective(films).map((etatFilm, rang) => (
          <i key={films[rang]!.tmdb_id} data-etat={etatFilm} className={styles.trou} />
        ))}
      </div>
    </>
  )
}
