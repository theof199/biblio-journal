import type { JournalItem } from '../api/journal'

/**
 * Les billets numérotés et la boîte à billets (idée 5 ; maquette 1890, écrans VI et VII), sans
 * rendu. Un billet par visionnage d'un film sorti dans la décennie, numéroté dans l'ordre où je les
 * ai vus (décision D3) : le numéro se recalcule à chaque lecture, il n'est stocké nulle part.
 */

export interface Billet {
  numero: number
  item: JournalItem
}

const avant = (a: JournalItem, b: JournalItem): number =>
  a.entry.finished_at.localeCompare(b.entry.finished_at) ||
  a.entry.created_at.localeCompare(b.entry.created_at) ||
  (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0)

/**
 * Les billets d'une décennie, du premier au dernier vu : un par visionnage (un film revu a deux
 * billets), jamais une série, jamais un film d'une autre décennie. L'ordre : la date du visionnage,
 * puis sa création, puis son identifiant — deux entrées du même jour gardent toujours le même
 * rang, d'une lecture à l'autre.
 */
export function billetsDeLaDecennie(items: readonly JournalItem[], decennie: number): Billet[] {
  return items
    .filter((i) => i.media.type === 'movie' && i.media.year !== null && i.media.year >= decennie && i.media.year <= decennie + 9)
    .sort(avant)
    .map((item, k) => ({ numero: k + 1, item }))
}

/** « N° 0007 » : quatre chiffres au moins, comme le numéroteur de la maquette. */
export const numeroLisible = (n: number): string => `N° ${String(n).padStart(4, '0')}`

/** Le numéro d'un billet pas encore lu : le numéroteur s'arrête là quand la boîte n'a pas répondu. */
export const NUMERO_EN_ATTENTE = 'N° ····'

/**
 * Un tirage du numéroteur (maquette 1890 : `tamponner`, ligne 2702) : au tirage `k` (de 0 à 9), le
 * chiffre `i` du numéro est déjà le bon quand `k > 6 + i / 2`, tiré au sort sinon ; sans numéro lu
 * (`final` nul), tous les chiffres roulent jusqu'au bout.
 */
export function tirerLeNumero(final: number | null, k: number, alea: () => number = Math.random): string {
  const chiffres = final !== null ? numeroLisible(final).slice(3) : '0000'
  const tires = [...chiffres].map((c, i) => (final !== null && k > 6 + i * 0.5 ? c : String(Math.floor(alea() * 10))))
  return `N° ${tires.join('')}`
}

/** Le numéro du billet d'un visionnage ; nul s'il n'est pas dans la boîte. */
export const numeroDe = (billets: readonly Billet[], entryId: string): number | null =>
  billets.find((b) => b.item.entry.id === entryId)?.numero ?? null

/** Un intercalaire de la boîte : une année de la décennie, et ses billets. */
export interface Intercalaire {
  annee: number
  compte: number
}

/** Les intercalaires : une année du Voyage par intercalaire, du départ (ou du début de la décennie) à sa fin. */
export function intercalaires(billets: readonly Billet[], decennie: number, depart: number): Intercalaire[] {
  const liste: Intercalaire[] = []
  for (let a = Math.max(depart, decennie); a <= decennie + 9; a += 1) {
    liste.push({ annee: a, compte: billets.filter((b) => b.item.media.year === a).length })
  }
  return liste
}

/** Le casier ouvert à un intercalaire (nul : « Tous »), le dernier billet devant, comme dans la boîte. */
export function casier(billets: readonly Billet[], annee: number | null): Billet[] {
  return billets.filter((b) => annee === null || b.item.media.year === annee).reverse()
}
