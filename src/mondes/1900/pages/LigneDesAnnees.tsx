import type { PropsOrdreDeDecennie } from '../../../voyage/decennie/Ordre'

/**
 * L'ordre de la ligne des années 1900 (maquette, écran 1) : l'indicateur, les liens, puis le
 * passeport, qui reste dans la page. La palissade n'est pas montrée (plan des pages 1900, décision 5).
 */
export default function LigneDesAnnees({ registre, liens, livret }: PropsOrdreDeDecennie) {
  return (
    <>
      {registre}
      {liens}
      {livret}
    </>
  )
}
