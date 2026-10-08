import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireMalle, lireVoyage, type Malle as MalleLue } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import { gabaritSeul } from '../gabarit'
import { decennieDe } from '../regles'
import type { PanneDeBloc } from '../sacoche'
import { estNouveau } from '../voyageur'
import commun from './Sacoche.module.css'
import { useVisiteDeRubrique } from './visite'

/**
 * Ce que reçoit le dessin de la malle (`GabaritsDesPages.malleDeLaSacoche`, sans défaut) : la malle
 * lue, ce qui y est nouveau, et le calque. `Malle.tsx` garde la région, les lectures, la marque
 * « vue » et l'adresse : le dessin ne lit ni n'écrit rien.
 */
export interface PropsMalleDeLaSacoche {
  /** La malle est en panne : le bloc le dit, et lui seul. */
  panne: PanneDeBloc | null
  /** La malle de la décennie de mon année en cours, jamais vide ; nulle en panne. */
  malle: MalleLue | null
  /**
   * Les numéros des places collées depuis ma dernière visite, **figés pour la visite** : la marque
   * « vue » part pendant qu'on les regarde, et ne les éteint pas. Vide tant que l'état du voyageur
   * n'est pas lu.
   */
  nouvelles: readonly number[]
  /** La malle est ouverte : l'adresse le porte (`?malle`), le retour du téléphone la referme. */
  ouverte: boolean
  ouvrir: () => void
  fermer: () => void
}

/** Le nom du calque dans l'adresse de la sacoche, et la valeur qu'il porte ouvert. */
const CALQUE = 'malle'
const OUVERTE = 'ouverte'

function MalleDeLaDecennie({ decennie, Dessin }: { decennie: number; Dessin: GabaritsDesPages['malleDeLaSacoche'] }) {
  const malle = useQuery({ queryKey: cles.malle(decennie), queryFn: ({ signal }) => lireMalle(decennie, signal) })
  const calque = useCalque(CALQUE)
  // Une décennie sans malle répond une liste vide : rien ne se montre, rien ne se marque.
  const montree = malle.data !== undefined && malle.data.etiquettes.length > 0
  const visite = useVisiteDeRubrique('etiquette', montree && !malle.error)

  // Ouverte, la malle en cache reste à l'écran si sa relecture tombe en panne : le dialogue ne se
  // referme pas seul sous le doigt (l'adresse dirait encore `?malle`, le focus serait perdu). La panne
  // se dit sur la ligne, une fois la malle refermée.
  const erreur = montree && calque.valeur !== null ? null : malle.error
  // Rien avant la réponse : la rubrique ne paraît pas pour disparaître devant une décennie sans malle.
  if (!erreur && !montree) return null
  const lue = erreur ? null : malle.data!
  return (
    <section className={commun.bloc} aria-label="Malle">
      <Dessin
        panne={erreur ? { erreur, reessayer: () => void malle.refetch() } : null}
        malle={lue}
        nouvelles={lue && visite ? lue.etiquettes.filter((p) => estNouveau(p.collee_le, visite.vueLe)).map((p) => p.numero) : []}
        ouverte={lue !== null && calque.valeur !== null}
        ouvrir={() => calque.ouvrir(OUVERTE)}
        fermer={calque.fermer}
      />
    </section>
  )
}

/**
 * La malle aux étiquettes de la sacoche, entre le passeport et le portefeuille. **Sans défaut** : le
 * bloc ne se monte que si le monde de mon année en cours compose `malleDeLaSacoche` (`gabaritSeul`),
 * et ne lit rien sinon — ni la malle, ni l'état du voyageur. Monté, il lit la malle de la décennie de
 * mon année en cours et l'état du voyageur, marque la rubrique `etiquette` vue quand la malle est lue
 * (`useVisiteDeRubrique`), et tombe seul en panne — sauf ouverte : la malle en cache reste alors à
 * l'écran, et la panne attend qu'on la referme. La carte en panne, la page prend le monde du
 * départ : sans année en cours, pas de malle.
 */
export default function Malle({ monde }: { monde: Monde | null }) {
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const Dessin = monde ? gabaritSeul(monde, 'malleDeLaSacoche') : null
  if (!Dessin || !voyage.data) return null
  return <MalleDeLaDecennie decennie={decennieDe(voyage.data.annee_en_cours)} Dessin={Dessin} />
}
