import { useMemo, useRef } from 'react'
import { ambianceDeLHeure } from '../../carte/heure'
import type { Monde, VueBandeau } from '../../mondes/types'
import Toile, { LARGEUR_LOGIQUE } from '../Toile'

/**
 * Ce que la page passe à la tête d'une fiche d'année ; un gabarit de monde reçoit les mêmes
 * (`GabaritsDesPages.teteDAnnee`). Le lien de retour et la plaque du chapitre restent à la page.
 */
export interface PropsTeteDAnnee extends Pick<VueBandeau, 'mode' | 'annee' | 'recompense' | 'cases' | 'bouclee' | 'roulotte'> {
  monde: Monde
  /** « Moins d'animations » : rien ne bouge, et un toucher n'anime rien. */
  calme: boolean
}

/**
 * La tête par défaut : le bandeau que le monde dessine sur une toile (`pages.dessinerBandeau` ;
 * maquette 1890 : `dessinBandeau`). Le dernier toucher, en secondes de la toile, rouvre le rideau et
 * emballe le manège.
 */
export default function Bandeau({ monde, calme, mode, annee, recompense, cases, bouclee, roulotte }: PropsTeteDAnnee) {
  const { hauteurs } = monde.pages
  const dernierT = useRef(0)
  const touche = useRef(-9)
  const nuit = useMemo(() => {
    const d = new Date()
    return ambianceDeLHeure(d.getHours() + d.getMinutes() / 60).nuit
  }, [])
  return (
    <Toile
      hauteur={hauteurs.bandeau}
      libelle={`Le décor de ${annee}.`}
      onToucher={() => {
        if (!calme) touche.current = dernierT.current
      }}
      dessiner={(ctx, t, vivant) => {
        dernierT.current = t
        monde.pages.dessinerBandeau({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.bandeau, t, vivant, nuit, mode, annee, recompense, cases, bouclee, roulotte, touche: touche.current })
      }}
    />
  )
}
