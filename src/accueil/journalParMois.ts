import { capitaliser } from './fronton'
import { dateLocale } from '../ui/format'
import type { JournalItem } from '../api/journal'

/** Un mois du journal : sa clé stable (`AAAA-MM`), son titre de section, ses entrées dans l'ordre reçu. */
export interface MoisDuJournal {
  cle: string
  libelle: string
  items: JournalItem[]
}

const NOM_DU_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long' })

/** « Septembre 2026 » : l'année y est toujours, l'en-tête d'une pellicule se lit seul. */
function libelleDuMois(cle: string): string {
  const date = dateLocale(`${cle}-01`)
  return `${capitaliser(NOM_DU_MOIS.format(date))} ${date.getFullYear()}`
}

/**
 * Le journal par mois. L'API rend le plus récent d'abord : les entrées se rangent par mois civil de
 * `finished_at` en gardant l'ordre reçu. Le calcul repart de la liste entière, accumulée page après
 * page (défilement infini) : un mois qu'une page suivante complète reste une seule section.
 */
export function journalParMois(items: readonly JournalItem[]): MoisDuJournal[] {
  const groupes = new Map<string, MoisDuJournal>()
  for (const item of items) {
    const cle = item.entry.finished_at.slice(0, 7)
    const groupe = groupes.get(cle)
    if (groupe) groupe.items.push(item)
    else groupes.set(cle, { cle, libelle: libelleDuMois(cle), items: [item] })
  }
  return [...groupes.values()]
}
