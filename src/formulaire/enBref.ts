import { moisEnLettres } from '../ui/format'
import type { JournalItem } from '../api/journal'
import { compteCarte, casesBande, entiteBouclee, type SourceSuivi } from '../suivis/liste'
import type { FilmSuivi } from '../suivis/prochain'
import type { JournalEnCache } from './journalEnCache'

/**
 * Les lignes de « En bref », la seconde coupure du papier rendu : ce que la séance qu'on vient
 * d'écrire fait avancer, tel que l'app peut le savoir sans rien demander. Des fonctions pures sur ce
 * que le cache de requêtes contient (`enBrefEnCache.ts`) ; chacune rend `null` quand ce qu'il lui faut
 * manque ou ne se prouve pas, et la ligne s'absente — jamais une ligne qu'on n'a pas pu vérifier.
 * Ce sont des objets simples, sans fonction : ils voyagent dans l'état de navigation.
 */

/** Un trou de la rangée d'une rétrospective : poinçonné, celui de cette séance, ou pas encore. */
export type EtatTrou = 'vu' | 'neuf' | 'pas-encore' | 'introuvable'

export interface LigneSuivi {
  type: 'suivi'
  genre: 'Rétrospective' | 'Cycle'
  nom: string
  /** « 10 séances sur 22 » : les films vus, cette séance comprise, sur ceux que le suivi compte. */
  vus: number
  total: number
  /** Cette séance referme le suivi : tout y est désormais vu ou introuvable. */
  boucle: boolean
  trous: EtatTrou[]
}

export interface LigneSeance {
  type: 'seance'
  titre: string
  /** Le rang de cette séance au journal, au moins 2. */
  rang: number
}

export interface LigneMois {
  type: 'mois'
  /** « Octobre 2026 ». */
  mois: string
  /** Le rang de ce film dans son mois, ce film compris. */
  rang: number
}

export type LigneEnBref = LigneSuivi | LigneSeance | LigneMois

const GENRES: Record<SourceSuivi, LigneSuivi['genre']> = { realisateurs: 'Rétrospective', sagas: 'Cycle' }

const RANGS = ['Premier', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième', 'Septième', 'Huitième', 'Neuvième', 'Dixième']

/** « Quatrième » ; au-delà de dix, « 11ᵉ » — le français n'a pas besoin de plus à l'écrit. */
export const rangEnLettres = (rang: number): string => RANGS[rang - 1] ?? `${rang}ᵉ`

/** Ce que la séance écrite apporte au suivi : son entrée, de quoi marquer le film vu. */
export interface SeanceEcrite {
  entryId: string
  rating: number | null
  finishedAt: string
}

/**
 * La ligne d'un réalisateur ou d'une saga suivis dont la filmographie en cache contient ce film :
 * son compte une fois la séance comptée, et s'il se boucle. Un film déjà vu ne fait pas avancer le
 * compte (c'est une revoyure) ni ne boucle rien. Nulle si le film n'est pas dans la filmographie.
 *
 * Le compte d'un cycle est celui que la planche dessine : « Masquer les introuvables » le règle.
 */
export function ligneSuivi(
  source: SourceSuivi,
  nom: string,
  films: readonly FilmSuivi[],
  tmdbId: number,
  seance: SeanceEcrite,
  masquerIntrouvables: boolean,
): LigneSuivi | null {
  const rang = films.findIndex((film) => film.tmdb_id === tmdbId)
  if (rang < 0) return null

  const dejaVu = films[rang]!.vu != null
  const apres = dejaVu
    ? films
    : films.map((film, i) => (i === rang ? { ...film, vu: { entry_id: seance.entryId, rating: seance.rating, finished_at: seance.finishedAt } } : film))
  const { vus, total } = compteCarte(source, apres, masquerIntrouvables)
  const trous = casesBande(apres, false).map(({ etat }, i): EtatTrou => (i === rang && !dejaVu ? 'neuf' : etat === 'prochain' ? 'pas-encore' : etat))

  return {
    type: 'suivi',
    genre: GENRES[source],
    nom,
    vus,
    total,
    boucle: !entiteBouclee(films) && entiteBouclee(apres),
    trous,
  }
}

/**
 * « Deuxième séance au journal » : ce film est déjà au journal, sous une autre entrée. L'API ne crée
 * pas de seconde entrée pour le même film le même jour mais corrige la première : l'entrée qu'on
 * vient d'écrire, déjà dans le cache, ne se compte donc pas contre elle-même.
 */
export function ligneSeance(items: readonly JournalItem[], ecrite: JournalItem): LigneSeance | null {
  const avant = items.filter((item) => item.media.external_id === ecrite.media.external_id && item.entry.id !== ecrite.entry.id)
  return avant.length === 0 ? null : { type: 'seance', titre: ecrite.media.title, rang: avant.length + 1 }
}

/**
 * « Octobre 2026. Quatrième film du mois. » — seulement quand le cache contient **tout** le mois : le
 * journal entier, ou des pages qui vont au-delà du mois (l'API les rend de la plus récente à la plus
 * ancienne : une entrée d'avant le mois en cache veut dire que le mois entier la précède). Sinon, un
 * compte faux vaudrait moins que pas de compte.
 */
export function ligneMois(journal: JournalEnCache, ecrite: JournalItem): LigneMois | null {
  const jour = ecrite.entry.finished_at
  const debutDuMois = `${jour.slice(0, 7)}-01`
  const toutLeMois = journal.complet || journal.items.some((item) => item.entry.finished_at < debutDuMois)
  if (!toutLeMois) return null

  const autres = journal.items.filter((item) => item.entry.finished_at.startsWith(jour.slice(0, 7)) && item.entry.id !== ecrite.entry.id)
  return { type: 'mois', mois: moisEnLettres(jour), rang: autres.length + 1 }
}
