import { Link } from 'react-router-dom'
import styles from './CarteAdherent.module.css'

interface Props {
  pseudo: string
  /** Nuls tant que `GET /stats` n'a pas répondu : la ligne des chiffres manque alors, jamais un zéro provisoire. */
  films: number | null
  heures: number | null
  cetteAnnee: number | null
  /** Les films vus dont la durée manque : le contrat veut qu'on les dise, c'est ce qui rend les heures honnêtes. */
  sansDuree: number
  /** Nulle tant que le journal n'est pas là, ou s'il est vide. */
  depuis: number | null
}

const pluriel = (nombre: number, singulier: string, pluriel: string) => `${nombre} ${nombre > 1 ? pluriel : singulier}`

/**
 * La carte d'adhérent du membre : sa couleur en bande, son monogramme en sceau, son pseudo, ses
 * chiffres gaufrés. Un seul lien, vers « Mes films ». La couleur vient de `--identite`, posée par la page.
 */
export default function CarteAdherent({ pseudo, films, heures, cetteAnnee, sansDuree, depuis }: Props) {
  const monogramme = Array.from(pseudo)[0]?.toUpperCase() ?? ''
  const chiffres = films === null ? null : heures === null ? pluriel(films, 'film', 'films') : `${pluriel(films, 'film', 'films')} · ${heures} h`
  const nom = chiffres === null ? `Mes films, carte de ${pseudo}` : `Mes films, carte de ${pseudo} : ${chiffres}`

  return (
    <Link to="/profil/mes-films" className={styles.scene} aria-label={nom} data-adherent="">
      <span className={styles.dos} aria-hidden="true" />
      <span className={styles.face}>
        <span className={styles.bande} aria-hidden="true" />
        <span className={styles.sceau} aria-hidden="true">
          {monogramme}
        </span>
        <span className={styles.etiquette}>Carte d’adhérent</span>
        <span className={styles.pseudo}>{pseudo}</span>
        {depuis === null ? null : <span className={styles.depuis}>Membre depuis {depuis}</span>}
        {chiffres === null ? null : <span className={styles.chiffres}>{chiffres}</span>}
        <span className={styles.pied}>
          <span className={styles.notes}>
            {cetteAnnee === null ? null : <span>{pluriel(cetteAnnee, 'film', 'films')} cette année</span>}
            {sansDuree > 0 ? <span>{pluriel(sansDuree, 'film sans durée', 'films sans durée')}</span> : null}
          </span>
          <span className={styles.lien}>Mes films →</span>
        </span>
      </span>
    </Link>
  )
}
