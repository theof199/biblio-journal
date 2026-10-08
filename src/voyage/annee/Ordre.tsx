import type { ReactNode } from 'react'

/**
 * Ce que reçoit l'ordre des sections d'une fiche prête, par défaut ou du monde
 * (`GabaritsDesPages.ordreDAnnee`) : chaque section déjà montée par la page, gabarit ou défaut. Qui
 * les range ne les compose pas, n'en lit rien, et n'en omet aucune : une section nulle (la séance hors
 * du compte IA) se rend telle quelle.
 */
export interface PropsOrdreDAnnee {
  /** La corde, et la région d'état qui dit ce que le retour d'un billet a gagné. */
  corde: ReactNode
  boniment: ReactNode
  programme: ReactNode
  /** L'horaire de la gare (`voyage/annee/Horaire.tsx`) : nul dans un monde qui ne le compose pas, ou sans horaire ni proposition. */
  horaire: ReactNode
  parade: ReactNode
  seance: ReactNode
  salles: ReactNode
  ligneDuBas: ReactNode
}

/** L'ordre par défaut (maquette 1890 : `htmlAnnee`) : la corde, le boniment, le programme (et l'horaire, qu'aucun monde sans dessin ne reçoit), la parade, la séance, les salles, la ligne du bas. */
export default function Ordre({ corde, boniment, programme, horaire, parade, seance, salles, ligneDuBas }: PropsOrdreDAnnee) {
  return (
    <>
      {corde}
      {boniment}
      {programme}
      {horaire}
      {parade}
      {seance}
      {salles}
      {ligneDuBas}
    </>
  )
}
