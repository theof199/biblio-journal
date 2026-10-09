import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireVoyage, lireVoyageur, type Voyageur } from '../../api/voyage'
import { creerRegistre } from '../../mondes'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { gabaritSeul } from '../gabarit'
import { decenniesDuPasseport, type PanneDeBloc } from '../sacoche'
import commun from './Sacoche.module.css'
import { placesDesBobines, type BobinesDUnMonde, type PlaceDeBobine } from './retrouvees'
import { useVisiteDeRubrique } from './visite'

/** Un registre pour le bloc, comme le passeport a le sien : ce que chaque monde traversé sait de ses bobines. */
const mondes = creerRegistre()

/**
 * Ce que reçoit le dessin des bobines retrouvées (`GabaritsDesPages.bobinesDeLaSacoche`, sans
 * défaut) : les places, rangées et datées par le bloc (`placesDesBobines`). Elles sont de **tous les
 * mondes traversés**, pas du seul monde qui dessine : c'est le bloc qui interroge le registre, le
 * dessin ne connaît que ce qu'on lui passe. `Bobines.tsx` garde la région, la lecture et la marque
 * « vue » : le dessin ne lit ni n'écrit rien.
 */
export interface PropsBobinesDeLaSacoche {
  /** L'état du voyageur est en panne : le bloc le dit, et lui seul. */
  panne: PanneDeBloc | null
  /** Une place par bobine des mondes traversés ; nulles en panne. */
  places: readonly PlaceDeBobine[] | null
}

function BobinesDuVoyageur({ catalogue, Dessin }: { catalogue: readonly BobinesDUnMonde[]; Dessin: GabaritsDesPages['bobinesDeLaSacoche'] }) {
  // La même clé que le crochet de la visite, la malle et les objets trouvés : une seule lecture part.
  const voyageur = useQuery({ queryKey: cles.voyageur, queryFn: ({ signal }) => lireVoyageur(signal) })
  // Un état servi sans le champ (une API d'avant les bobines au compte) vaut « pas lu », comme sur la carte.
  const tenues = voyageur.error ? null : ((voyageur.data as Partial<Voyageur> | undefined)?.bobines ?? null)
  // Rien de ramassé, rien à dater : la rubrique ne se marque vue que si le compte tient une bobine,
  // **quelle qu'elle soit** (c'est sur toutes que le point de la carte s'allume). La relecture de
  // l'état et sa panne sont gardées par le crochet, pour toutes les rubriques.
  const visite = useVisiteDeRubrique('bobine', tenues !== null && tenues.length > 0)
  // Rien avant la réponse, comme les objets trouvés : la région arrive avec ses places.
  if (!voyageur.error && !tenues) return null
  return (
    <section className={commun.bloc} aria-label="Bobines retrouvées">
      <Dessin panne={voyageur.error ? { erreur: voyageur.error, reessayer: () => void voyageur.refetch() } : null} places={tenues ? placesDesBobines(catalogue, tenues, visite) : null} />
    </section>
  )
}

/**
 * Les bobines retrouvées de la sacoche, après les objets trouvés, avant les coulisses. **Sans
 * défaut** : le bloc ne se monte que si le monde de mon année en cours compose `bobinesDeLaSacoche`
 * (`gabaritSeul`), et ne lit rien sinon. Monté, il ne lit que l'état du voyageur (la carte, déjà lue
 * par la page, lui dit les décennies traversées), marque la rubrique `bobine` vue une fois par visite
 * (`useVisiteDeRubrique`), et tombe seul en panne. On ne ramasse rien ici : c'est le geste de la
 * carte. La carte en panne, la page prend le monde du départ : sans décennies, pas de rubrique.
 */
export default function Bobines({ monde }: { monde: Monde | null }) {
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const Dessin = monde ? gabaritSeul(monde, 'bobinesDeLaSacoche') : null
  const depart = voyage.data?.depart
  const enCours = voyage.data?.annee_en_cours
  const catalogue = useMemo(
    () => (depart === undefined || enCours === undefined ? null : decenniesDuPasseport({ depart, annee_en_cours: enCours }).map((decennie) => ({ decennie, bobines: mondes(decennie).bobines }))),
    [depart, enCours],
  )
  if (!Dessin || !catalogue) return null
  return <BobinesDuVoyageur catalogue={catalogue} Dessin={Dessin} />
}
