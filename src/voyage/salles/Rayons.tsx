import type { ReactNode } from 'react'
import type { Salle } from '../../api/voyage'
import type { Monde } from '../../mondes/types'

/** Ce que reçoit le cadre des salles d'une fiche prête, par défaut ou du monde (`gabarits.salles`). */
export interface PropsRayons {
  monde: Monde
  annee: number
  /** Les salles de l'année, dans l'ordre de l'API : pour un titre, un compte. */
  salles: readonly Salle[]
  /** Les salles montées par la page, une par salle, dans le même ordre. */
  children: ReactNode
}

/** Le cadre des salles par défaut : aucun. Chaque salle est une baraque qui se suffit, l'une sous l'autre. */
export default function Rayons({ children }: Pick<PropsRayons, 'children'>) {
  return <>{children}</>
}
