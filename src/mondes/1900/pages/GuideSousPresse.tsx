import { SANS_REPONSE, type PropsAnneeEnPreparation } from '../../../voyage/annee/EnPreparation'
import { AvisDuGuide, SousPresse } from './PageDuGuide'
import guide from './PageDuGuide.module.css'
import Rubrique from './Rubrique'

/**
 * Le corps d'une année 1900 que le chroniqueur écrit encore (`anneeEnPreparation`) : le Guide est sous
 * presse. Ni estrade ni toile : la rubrique « Guide du voyageur » de la fiche d'année, et dans sa
 * colonne l'attente de la page du Guide (`mots.chroniqueur.ecrit`), ou son avis de gare et « Réessayer »
 * quand la page a cessé de relire. Tout le dessin est celui de `PageDuGuide`, repris sans copie ; rien
 * n'y bouge. La relecture et son abandon restent à la page.
 */
export default function GuideSousPresse({ monde, abandon, onReessayer }: PropsAnneeEnPreparation) {
  const m = monde.pages.mots
  return (
    <>
      <Rubrique>{m.feuille.tete}</Rubrique>
      <div className={guide.colonne}>
        {abandon ? (
          <div role="alert">
            <AvisDuGuide plaque={m.chroniqueur.relache} message={SANS_REPONSE} onReessayer={onReessayer} />
          </div>
        ) : (
          <SousPresse phrase={m.chroniqueur.ecrit} tapee={m.chroniqueur.ecrit} />
        )}
      </div>
    </>
  )
}
