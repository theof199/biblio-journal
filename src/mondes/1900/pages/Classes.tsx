import { Link } from 'react-router-dom'
import type { Marche } from '../../../api/voyage'
import { useAppuiLong } from '../../../voyage/parade/appuiLong'
import type { PropsMarches } from '../../../voyage/parade/Marches'
import { classeDe, filmDeLaMarche, MOTS_DES_CLASSES } from './classes'
import Rubrique from './Rubrique'
import styles from './Classes.module.css'

const PLACES = [1, 2, 3] as const

/**
 * Les trois classes, à la place du podium (maquette, écran 3 : `.classes`) : trois portières, la
 * première au centre et plus haute. Toucher une portière occupée ouvre son film, quand il est dans une
 * salle de l'année ; « Changer » ouvre le feuillet de la marche, que la page tient. Une place libre le
 * dit, et sa portière ouvre le feuillet : jamais un film. Tenir une portière occupée la vide, comme le
 * podium par défaut. Rien n'y bouge.
 */
export default function Classes({ monde, annee, podium, salles, onOuvrir, onVider, erreur }: PropsMarches) {
  const m = monde.pages.mots
  const portieres = PLACES.map((place) => {
    const marche = podium[place - 1] ?? null
    const film = filmDeLaMarche(marche, salles)
    return { place, marche, versLeFilm: film ? `/voyage/${annee}/films/${film.id}` : null }
  })
  return (
    <section aria-label={`${m.parade.titre}, ${m.parade.sous}`}>
      <Rubrique balise="p">
        {m.parade.titre}
        <small>{`${m.parade.sous} de ${annee}`}</small>
      </Rubrique>
      <div className={styles.classes}>
        {portieres.map((p) => (
          <Portiere key={p.place} {...p} onOuvrir={() => onOuvrir(p.place)} onVider={() => onVider(p.place)} />
        ))}
      </div>
      <div className={styles.marchepied} aria-hidden="true" />
      {/* L'aide ne promet un film que si une portière en ouvre un. */}
      <p className={styles.aide}>{portieres.some((p) => p.versLeFilm) ? MOTS_DES_CLASSES.aide : MOTS_DES_CLASSES.aideSansFilm}</p>
      {erreur ? (
        <p role="alert" className={styles.message}>
          {erreur}
        </p>
      ) : null}
    </section>
  )
}

interface PropsPortiere {
  place: number
  marche: Marche | null
  /** La page du film de la marche ; nulle quand la place est libre, ou que son film n'a pas de page. */
  versLeFilm: string | null
  onOuvrir: () => void
  onVider: () => void
}

/** Une portière : le chiffre de la classe, l'affiche à la fenêtre ou la place libre, la poignée, puis le titre. */
function Portiere({ place, marche, versLeFilm, onOuvrir, onVider }: PropsPortiere) {
  const classe = classeDe(place)
  const appui = useAppuiLong(!!marche, onVider)
  const porte = (
    <>
      <span className={styles.chiffre} aria-hidden="true">
        {classe.chiffre}
      </span>
      {marche?.cover_url ? (
        <img className={styles.fenetre} src={marche.cover_url} alt="" decoding="async" />
      ) : (
        <span className={`${styles.fenetre} ${styles.vide}`}>{marche ? MOTS_DES_CLASSES.sansAffiche : MOTS_DES_CLASSES.libre}</span>
      )}
      <span className={styles.poignee} aria-hidden="true" />
    </>
  )
  return (
    <div className={`${styles.portiere} ${styles[`p${place}`]}`}>
      {marche && versLeFilm ? (
        <Link
          to={versLeFilm}
          className={styles.porte}
          aria-label={`${classe.nom} : ${marche.title}, ouvrir le film`}
          {...appui.ecouteurs}
          // Le relâcher d'un appui long n'ouvre pas le film qu'on vient de retirer.
          onClick={(e) => {
            if (appui.aEteLong()) e.preventDefault()
          }}
        >
          {porte}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.porte}
          aria-label={marche ? `${classe.nom} : ${marche.title}, changer de voyageur` : `${classe.nom} : ${MOTS_DES_CLASSES.libre}, installer un film`}
          {...appui.ecouteurs}
          onClick={() => {
            if (!appui.aEteLong()) onOuvrir()
          }}
        >
          {porte}
        </button>
      )}
      <span className={styles.titre}>{marche ? marche.title : MOTS_DES_CLASSES.aChoisir}</span>
      {marche && versLeFilm ? (
        <button type="button" className={styles.changer} aria-label={`${classe.nom} : changer de voyageur`} onClick={onOuvrir}>
          {MOTS_DES_CLASSES.changer}
        </button>
      ) : null}
    </div>
  )
}
