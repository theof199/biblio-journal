import type { ReactNode } from 'react'

/**
 * Ce que reçoit l'ordre des sections d'une décennie, par défaut ou du monde
 * (`GabaritsDesPages.ordreDeDecennie`) : chaque section déjà montée par la page, gabarit ou défaut,
 * sous le monument et le fronton. Qui les range ne les compose pas et n'en lit rien. La palissade
 * arrive avec son titre, son attente et sa panne : c'est la seule section qu'un monde peut ne pas
 * montrer (plan des pages 1900, décision 5), sa panne se dit alors nulle part ailleurs.
 */
export interface PropsOrdreDeDecennie {
  livret: ReactNode
  palissade: ReactNode
  registre: ReactNode
  liens: ReactNode
}

/** L'ordre par défaut (maquette 1890, écran IV) : le passeport, la palissade, le registre, les liens. */
export default function Ordre({ livret, palissade, registre, liens }: PropsOrdreDeDecennie) {
  return (
    <>
      {livret}
      {palissade}
      {registre}
      {liens}
    </>
  )
}
