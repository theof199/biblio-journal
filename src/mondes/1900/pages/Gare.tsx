import type { PropsOrdreDAnnee } from '../../../voyage/annee/Ordre'

/**
 * L'ordre d'une gare ouverte (maquette, écrans 2 et 14) : le compteur, puis l'indicateur **avant** le
 * guide du voyageur. Au retour d'un billet, la ligne qui se pointe est ainsi sous le compteur, à
 * l'écran sans défiler, et le « +1 » monte à côté d'elle. Le reste suit l'ordre par défaut ; chaque
 * section arrive montée par la page.
 */
export default function Gare({ corde, boniment, programme, parade, seance, salles, ligneDuBas }: PropsOrdreDAnnee) {
  return (
    <>
      {corde}
      {programme}
      {boniment}
      {parade}
      {seance}
      {salles}
      {ligneDuBas}
    </>
  )
}
