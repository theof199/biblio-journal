import type { RefObject } from 'react'
import type { Halte as HalteServie } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { useDialogue } from '../dialogue'
import { compteDeLaHalte } from './compte'

/**
 * Ce que reçoit le dessin d'une halte ouverte (`GabaritsDesPages.halteDeLaCarte`, sans défaut) : il
 * dessine le dialogue entier et ne lit ni n'écrit rien. La halte est celle que `GET /me/voyage` sert,
 * **telle quelle** : son nom, et pour chaque film son titre, son année, son état (les cinq du contrat),
 * l'adresse de son affiche ou nul, son lien Plex ou nul. Aucun geste n'y marque un film vu.
 */
export interface PropsHalteDeLaCarte {
  monde: Monde
  halte: HalteServie
  /** Les films vus sur ceux que le serveur sert (`compteDeLaHalte`) : jamais un nombre écrit d'avance. */
  compte: { vus: number; total: number }
  /** À poser sur « Revenir sur la ligne » : il prend le focus à l'ouverture. */
  premier: RefObject<HTMLButtonElement>
  /** Revenir sur la ligne : ferme le dialogue, n'écrit rien. */
  fermer: () => void
}

interface Props {
  monde: Monde
  Dessin: GabaritsDesPages['halteDeLaCarte']
  halte: HalteServie
  /** Le dialogue se ferme : par son bouton ou par Échap. Le retour du téléphone le ferme par l'adresse, sans passer ici. */
  onFermer: () => void
}

/**
 * Une halte ouverte sur la carte (plan des écrans des lots, brief 12). `pages/Carte.tsx` décide quand
 * elle s'ouvre, la tient dans l'adresse (`?halte=<clé>`) et ne monte ce bloc que si le monde de la
 * halte compose `halteDeLaCarte`. **Il ne lit aucune route et n'en écrit aucune** : tout vient de la
 * carte que la page tient, et une halte n'a pas d'écriture (un film vu passe par le journal). Il
 * garde Échap, le focus et le compte.
 */
export default function Halte({ monde, Dessin, halte, onFermer }: Props) {
  const premier = useDialogue<HTMLButtonElement>(onFermer)
  return <Dessin monde={monde} halte={halte} compte={compteDeLaHalte(halte.films)} premier={premier} fermer={onFermer} />
}
