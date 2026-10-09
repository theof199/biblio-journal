import { cleDeBobineDuMonde, type BobineRamassee } from '../../api/voyage'
import type { BobinePerdue } from '../../mondes/types'
import { estNouveau } from '../voyageur'

/**
 * Les bobines retrouvées de la sacoche, sans rendu ni lecture : les places que le bloc
 * `Bobines.tsx` passe au dessin du monde. **Ce sont les bobines du voyageur, pas celles d'une
 * décennie** : une place par bobine que cache un monde traversé, de la décennie du départ à celle de
 * mon année en cours, dans l'ordre des décennies puis celui de chaque monde.
 */

/** Ce qu'un monde traversé cache : sa décennie et ses bobines (`Monde.bobines`), dans son ordre. */
export interface BobinesDUnMonde {
  decennie: number
  bobines: readonly BobinePerdue[]
}

/** Une place de la rubrique. */
export interface PlaceDeBobine {
  /** La décennie du monde qui la cache : tout ce qu'une place vide a le droit de dire. */
  decennie: number
  /**
   * Ce que son monde en sait (`BobinePerdue` : son titre, qui l'a tourné), **si le compte la tient** ;
   * nulle sinon. Une place vide ne reçoit ni titre ni clé : le dessin ne peut pas la nommer.
   */
  bobine: BobinePerdue | null
  /** Ramassée depuis ma dernière visite de la rubrique, **figé pour la visite** ; jamais pour une place vide. */
  nouvelle: boolean
}

/**
 * Les places : **une par bobine des mondes traversés, dans leur ordre**, quoi que le serveur serve.
 * Une bobine est retrouvée si le compte la tient ; le serveur écrit ses clés avec des tirets bas, les
 * mondes avec des tirets : la clé servie est traduite (`cleDeBobineDuMonde`) avant d'être cherchée,
 * jamais montrée. Une clé servie qu'aucun monde traversé ne connaît n'a pas de place. « Nouvelle » se
 * lit sur le `vue_le` de l'arrivée (`visite`, de `useVisiteDeRubrique`) ; nulle (l'état pas lu), rien
 * n'est nouveau.
 */
export function placesDesBobines(catalogue: readonly BobinesDUnMonde[], tenues: readonly BobineRamassee[], visite: { vueLe: string | null } | null): PlaceDeBobine[] {
  return catalogue.flatMap(({ decennie, bobines }) =>
    bobines.map((bobine) => {
      const ligne = tenues.find((t) => cleDeBobineDuMonde(t.cle) === bobine.cle)
      return ligne ? { decennie, bobine, nouvelle: visite !== null && estNouveau(ligne.ramasse_le, visite.vueLe) } : { decennie, bobine: null, nouvelle: false }
    }),
  )
}
