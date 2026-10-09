import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireTables } from '../../api/voyage'
import type { GabaritsDesPages, Monde } from '../../mondes/types'
import { useSession } from '../../session/SessionContext'
import { VERS_LE_WAGON, roleA, tablesDeLaPorte } from './tables'

interface Props {
  monde: Monde
  /** Le dessin du monde (`gabaritSeul(monde, 'porteDuWagon')`) : la page ne monte ce bloc que s'il existe. */
  Dessin: GabaritsDesPages['porteDuWagon']
}

/**
 * La porte du wagon-restaurant sur la fiche de mon année en cours (plan des écrans des lots, brief 16,
 * décision 10 du propriétaire : rien ne signale une table ailleurs). **Sans défaut** : la page ne le
 * monte que si le monde de l'année compose `porteDuWagon`, et pour mon année en cours seulement ; il
 * est à tout membre, hors de la séance du soir. Monté, il lit mes tables (`cles.tables`, la clé de la
 * page du wagon et du casier : un billet composté les périme) et n'écrit rien.
 *
 * **La porte n'existe que s'il y a une table ce soir** où je suis l'hôte ou l'invité, que je n'ai pas
 * déclinée (`tablesDeLaPorte`) : sinon rien, pas même une région. Tant que les tables ne sont pas
 * lues, rien non plus ; **leur panne se tait** (elle n'éteint que ce bloc, qui n'a alors rien à dire :
 * la page du wagon, elle, la dirait). L'horloge de l'appareil ne fait que cacher une porte : lue à
 * chaque rendu, jamais retenue.
 */
export default function Porte({ monde, Dessin }: Props) {
  const { user } = useSession()
  const lues = useQuery({ queryKey: cles.tables, queryFn: ({ signal }) => lireTables(signal) })
  if (lues.error || !lues.data) return null
  const ceSoir = tablesDeLaPorte(lues.data.tables, user.id, Date.now())
  if (ceSoir.length === 0) return null
  return <Dessin monde={monde} vers={VERS_LE_WAGON} tables={ceSoir.map((table) => ({ table, role: roleA(table, user.id) }))} />
}
