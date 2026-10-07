import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireReactions } from '../../api/reactions'
import type { Monde } from '../../mondes/types'
import type { Billet } from '../billets'
import { gabaritDe } from '../gabarit'
import BilletEnGrand, { type ReactionDuBillet } from './BilletEnGrand'

interface Props {
  monde: Monde
  billet: Billet
  /** Le billet de correction, quand la fiche de l'année du film est déjà lue ; nul sinon. */
  corriger: string | null
  onFermer: () => void
}

/**
 * Un billet de la boîte ouvert en grand. Elle garde la seule lecture du billet, le catalogue des
 * réactions, et en passe le fruit au dessin (`BilletEnGrand`, ou celui du monde : la clé de gabarit
 * `billetEnGrand`), qui ne lit rien.
 */
export default function Visionneuse({ monde, billet, corriger, onFermer }: Props) {
  const { carnet } = billet.item
  // Le catalogue des réactions, seulement pour un billet qui en porte (comme la fiche d'un film) :
  // jamais à l'ouverture de la boîte. Sans lui, la clé se lit telle quelle.
  const catalogue = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal), enabled: carnet.reactions.length > 0 })
  const reactions: ReactionDuBillet[] = carnet.reactions.map((cle) => {
    const r = catalogue.data?.reactions.find((x) => x.cle === cle)
    return { cle, emoji: r?.emoji ?? null, phrase: r?.phrase ?? null }
  })
  const Dessin = gabaritDe(monde, 'billetEnGrand', BilletEnGrand)
  return <Dessin monde={monde} billet={billet} reactions={reactions} corriger={corriger} onFermer={onFermer} />
}
