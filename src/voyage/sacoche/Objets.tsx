import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireVoyageur, type ObjetRamasse } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { gabaritSeul } from '../gabarit'
import type { PanneDeBloc } from '../sacoche'
import commun from './Sacoche.module.css'
import { useVisiteDeRubrique } from './visite'

/**
 * Ce que reçoit le dessin des objets trouvés (`GabaritsDesPages.objetsDeLaSacoche`, sans défaut) : ce
 * que le serveur dit que j'ai ramassé, **tel quel**. Le catalogue (les places, leurs noms, leurs
 * dessins) est au monde : c'est lui qui range, ignore une clé qu'il ne connaît pas et compte.
 * `Objets.tsx` garde la région, la lecture et la marque « vue » : le dessin ne lit ni n'écrit rien.
 */
export interface PropsObjetsDeLaSacoche {
  /** L'état du voyageur est en panne : le bloc le dit, et lui seul. */
  panne: PanneDeBloc | null
  /** Mes objets ramassés, tels que servis (une clé inconnue comprise) ; nul en panne. */
  objets: readonly ObjetRamasse[] | null
}

function ObjetsDuVoyageur({ Dessin }: { Dessin: GabaritsDesPages['objetsDeLaSacoche'] }) {
  // La même clé que le crochet de la visite et que la malle : une seule lecture part.
  const voyageur = useQuery({ queryKey: cles.voyageur, queryFn: ({ signal }) => lireVoyageur(signal) })
  const lus = voyageur.error ? null : (voyageur.data?.objets ?? null)
  // Une consigne vide n'a rien à dater : la rubrique ne se marque vue que si j'y ai ramassé quelque chose.
  // Et jamais pendant une relecture : l'état d'une visite d'avant, encore en cache, peut revenir en
  // panne, et la marque posée en cache par son `POST` effacerait cette panne.
  useVisiteDeRubrique('objet', lus !== null && lus.length > 0 && !voyageur.isFetching)
  // Rien avant la réponse, comme la malle : la région arrive avec ses places, pas avec une attente.
  if (!voyageur.error && !voyageur.data) return null
  return (
    <section className={commun.bloc} aria-label="Objets trouvés">
      <Dessin panne={voyageur.error ? { erreur: voyageur.error, reessayer: () => void voyageur.refetch() } : null} objets={lus} />
    </section>
  )
}

/**
 * Les objets trouvés de la sacoche, après le portefeuille (et le courrier à venir), avant les
 * coulisses. **Sans défaut** : le bloc ne se monte que si le monde de mon année en cours compose
 * `objetsDeLaSacoche` (`gabaritSeul`), et ne lit rien sinon. Monté, il ne lit que l'état du voyageur,
 * marque la rubrique `objet` vue une fois par visite (`useVisiteDeRubrique`), et tombe seul en panne :
 * la malle, qui lit le même état pour ce qui y est nouveau, garde sa ligne. On ne ramasse rien ici :
 * c'est le geste de la carte.
 */
export default function Objets({ monde }: { monde: Monde | null }) {
  const Dessin = monde ? gabaritSeul(monde, 'objetsDeLaSacoche') : null
  return Dessin ? <ObjetsDuVoyageur Dessin={Dessin} /> : null
}
