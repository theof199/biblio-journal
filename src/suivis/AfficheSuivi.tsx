import Affiche from '../ui/Affiche'
import SigneDeFilm from '../accueil/SigneDeFilm'

/**
 * L'affiche d'un film de suivi : sa jaquette, ou, sans jaquette, la petite enseigne de sa décennie
 * (`SigneDeFilm`, celle du journal de l'accueil). L'enseigne se réduit avec le cadre : elle tient
 * aussi bien dans l'affiche de « Ensuite » que dans une case de planche ou la vignette d'un coin.
 */
export default function AfficheSuivi({
  film,
  className,
}: {
  film: { title: string; year: number | null; cover_url: string | null }
  className?: string
}) {
  return (
    <Affiche
      src={film.cover_url}
      titre={film.title}
      className={className}
      substitut={film.cover_url ? undefined : <SigneDeFilm titre={film.title} annee={film.year} />}
    />
  )
}
