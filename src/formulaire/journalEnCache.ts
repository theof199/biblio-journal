import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import type { JournalItem, JournalPage } from '../api/journal'
import type { Stats } from '../api/stats'

/**
 * Ce que le formulaire peut dire du journal sans rien demander : tout vient du cache de requêtes,
 * que l'accueil, « Mes films » ou le profil ont déjà rempli, et rien n'en part jamais sur le réseau.
 *
 * Une réponse que l'écriture d'une création ou d'une correction a déjà périmée (`isInvalidated`)
 * n'est pas lue : le cache la garde tant que personne ne l'observe, et elle compterait le journal
 * d'avant — un numéro de billet qui se répète, un « quatrième film du mois » faux. Mieux vaut qu'une
 * ligne manque qu'une ligne fausse.
 */
const fraiche = (client: QueryClient, cle: readonly unknown[]): boolean => {
  const etat = client.getQueryState(cle)
  return etat !== undefined && !etat.isInvalidated
}

interface Options {
  /**
   * Lire aussi un cache périmé, pour ce que l'écriture d'un visionnage ne change presque pas (les
   * réactions que le membre pose le plus) : mieux vaut un classement d'hier que pas de classement.
   */
  perime?: boolean
}

export interface JournalEnCache {
  /** Les visionnages connus, du plus récent au plus ancien (l'ordre de l'API). */
  items: JournalItem[]
  /** Le journal entier est là : rien d'autre n'existe plus loin, que les pages ne montrent pas. */
  complet: boolean
}

/**
 * Le journal du cache : le journal complet du profil s'il est là, sinon les pages que l'accueil a
 * chargées — complètes quand la dernière n'a plus de curseur. Nul sans l'un ni l'autre.
 */
export function journalEnCache(client: QueryClient, { perime = false }: Options = {}): JournalEnCache | null {
  const lisible = (cle: readonly unknown[]) => perime || fraiche(client, cle)
  const entier = lisible(cles.journalComplet) ? client.getQueryData<JournalItem[]>(cles.journalComplet) : undefined
  if (entier) return { items: entier, complet: true }

  const pages = lisible(cles.journal) ? client.getQueryData<InfiniteData<JournalPage>>(cles.journal)?.pages : undefined
  const derniere = pages?.[pages.length - 1]
  if (!pages || !derniere) return null
  return { items: pages.flatMap((page) => page.items), complet: derniere.next_cursor == null }
}

/** Les films du journal entier, d'après les stats du cache (`GET /stats`) ; nul si elles n'y sont pas ou sont périmées. */
export function totalDuJournal(client: QueryClient): number | null {
  if (!fraiche(client, cles.stats)) return null
  return client.getQueryData<Stats>(cles.stats)?.dashboard.periods.all.counts.finished_by_type.movie ?? null
}

/** « N° 0413 » : le rang de ce billet au journal, le total d'avant plus un ; nul quand le total n'est pas connu. */
export function numeroDeBillet(total: number | null): string | null {
  return total == null ? null : `N° ${String(total + 1).padStart(4, '0')}`
}
