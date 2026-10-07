import { useRef } from 'react'
import type { FilmDeSalle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import Toile, { LARGEUR_LOGIQUE } from '../Toile'

/**
 * Ce que reçoit la projection de la fiche d'un film, par défaut ou du monde
 * (`GabaritsDesPages.projection`). L'image est celle que la page a choisie et chargée
 * (`useImageDuFilm` : le fond, sinon l'affiche) : nulle tant qu'elle charge, en erreur ou sans adresse.
 */
export interface PropsProjection {
  monde: Monde
  film: FilmDeSalle
  image: HTMLImageElement | null
  /** « Moins d'animations » : rien ne bouge, et toucher l'écran ne relance rien. */
  calme: boolean
}

/**
 * La projection par défaut (décision D1) : la scène du monde, peinte sur une toile ; toucher l'écran
 * relance le train. Toucher n'ouvre rien : ce n'est qu'une animation (`Toile.onToucher`).
 */
export default function Projection({ monde, film, image, calme }: PropsProjection) {
  const { hauteurs } = monde.pages
  const dernierT = useRef(0)
  const touche = useRef(-9)
  return (
    <Toile
      hauteur={hauteurs.scene}
      libelle={`L’écran projette ${film.title}.`}
      onToucher={() => {
        if (!calme) touche.current = dernierT.current
      }}
      dessiner={(ctx, t, vivant) => {
        dernierT.current = t
        monde.pages.dessinerScene({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.scene, t, vivant, image, touche: touche.current })
      }}
    />
  )
}
