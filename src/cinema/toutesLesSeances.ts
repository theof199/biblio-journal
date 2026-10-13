import { curseurSuivant, lireSeances, type JournalItem } from '../api/journal'

/** La taille de page maximale de l'API (`limit`, 100) : toutes les séances en le moins d'appels possible. */
const PAGE_MAX = 100

/**
 * Toutes mes séances en salle, page après page, dans l'ordre de l'API (jumeau de `journalComplet`,
 * `api/journal.ts`) : de quoi compter l'année et cocher les tuiles d'Au ciné sans dépendre de ce que
 * « Tes séances » a chargé (décision du propriétaire, 13 octobre 2026). L'API n'offre ni total, ni
 * filtre par année de visionnage, ni filtre par film : la coche d'une reprise vue il y a des années
 * demande de tout lire. Une page qui échoue fait échouer l'ensemble : un compte sur des séances
 * tronquées mentirait.
 */
export async function toutesLesSeances(signal?: AbortSignal): Promise<JournalItem[]> {
  const items: JournalItem[] = []
  let cursor: string | undefined
  do {
    const page = await lireSeances({ limit: PAGE_MAX, cursor }, signal)
    items.push(...page.items)
    cursor = curseurSuivant(page)
  } while (cursor)
  return items
}
