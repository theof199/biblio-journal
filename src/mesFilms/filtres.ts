import { normaliser } from '../ui/format'
import type { JournalItem } from '../api/journal'
import type { Reaction } from '../api/reactions'

/**
 * « Mes films » (reprise de `FilmsEtats.kt`) : la recherche, le tri et les filtres de la page, en
 * fonctions pures, testées sans réseau ni rendu. L'état lui-même vit dans le composant.
 */

/** L'ordre de la liste : par date (récents ou anciens d'abord), ou par note. */
export type Tri = 'date_desc' | 'date_asc' | 'note_desc'

/** Ce que le membre a choisi sur la page. `notes` vide = aucun filtre de note ; `reactions` vide = aucun filtre de réaction. */
export interface FiltresMesFilms {
  texte: string
  tri: Tri
  notes: number[]
  reactions: string[]
}

export const FILTRES_INITIAUX: FiltresMesFilms = { texte: '', tri: 'date_desc', notes: [], reactions: [] }

/**
 * Vrai dès que la liste affichée peut différer de la pagination brute : la page doit alors charger
 * tout le journal, sinon « Rien trouvé » mentirait sur des pages pas encore chargées. Un texte fait
 * seulement d'espaces ne filtre rien (`appliquerFiltres`) : il ne compte pas non plus ici.
 */
export function filtresActifs(f: FiltresMesFilms): boolean {
  return f.texte.trim() !== '' || f.tri !== 'date_desc' || f.notes.length > 0 || f.reactions.length > 0
}

/**
 * La liste affichée : d'abord les filtres, puis le tri.
 *
 * - **Texte** : cherché dans le titre **et** le réalisateur, insensible à la casse et aux accents.
 *   Vide ou blanc : aucun filtre.
 * - **Notes** : garde les visionnages dont la note est l'une des notes cochées (ou). Un visionnage
 *   sans note est écarté dès qu'une note est cochée.
 * - **Réactions** : garde les visionnages qui portent **toutes** les réactions cochées (et).
 * - **Tri**, toujours stable : par `finished_at` (chaîne ISO, comparable telle quelle), récents ou
 *   anciens d'abord ; ou par note décroissante, les visionnages sans note en dernier, une égalité de
 *   note départagée par la date, récents d'abord.
 */
export function appliquerFiltres(items: JournalItem[], f: FiltresMesFilms): JournalItem[] {
  const texte = normaliser(f.texte)
  const gardes = items.filter((item) => {
    const rating = item.entry.rating
    const texteOk =
      texte === '' ||
      normaliser(item.media.title).includes(texte) ||
      normaliser(item.media.director ?? '').includes(texte)
    const noteOk = f.notes.length === 0 || (rating != null && f.notes.includes(rating))
    const reactionsOk = f.reactions.every((r) => item.carnet.reactions.includes(r))
    return texteOk && noteOk && reactionsOk
  })

  const parDate = (a: JournalItem, b: JournalItem) => a.entry.finished_at.localeCompare(b.entry.finished_at)

  switch (f.tri) {
    case 'date_asc':
      return [...gardes].sort(parDate)
    case 'note_desc':
      return [...gardes].sort((a, b) => {
        const ra = a.entry.rating
        const rb = b.entry.rating
        if (ra == null && rb == null) return parDate(b, a)
        if (ra == null) return 1
        if (rb == null) return -1
        if (ra !== rb) return rb - ra
        return parDate(b, a)
      })
    case 'date_desc':
    default:
      return [...gardes].sort((a, b) => parDate(b, a))
  }
}

/** Le tap sur la puce Date : récents ↔ anciens d'abord. Depuis un tri par note, revient au tri par date par défaut plutôt que de sauter aux anciens. */
export function basculerOrdreDate(tri: Tri): Tri {
  return tri === 'date_desc' ? 'date_asc' : 'date_desc'
}

/** Coche la note si elle ne l'était pas, la décoche sinon ; plusieurs notes à la fois. */
export function basculerNote(notes: number[], n: number): number[] {
  return notes.includes(n) ? notes.filter((v) => v !== n) : [...notes, n]
}

/** Coche la réaction si elle ne l'était pas, la décoche sinon. */
export function basculerReactionFiltre(reactions: string[], cle: string): string[] {
  return reactions.includes(cle) ? reactions.filter((v) => v !== cle) : [...reactions, cle]
}

/** La puce Date : « Date, récents d'abord », ou « Date, anciens d'abord » après un tap. */
export function libellePuceDate(tri: Tri): string {
  return tri === 'date_asc' ? 'Date, anciens d’abord' : 'Date, récents d’abord'
}

/** La puce Note, qui porte à la fois le tri par note et les notes cochées : « Note », « Note, tri », « Note · 2 » ou « Note, tri · 2 ». */
export function libellePuceNote(f: FiltresMesFilms): string {
  const tri = f.tri === 'note_desc' ? 'Note, tri' : 'Note'
  return f.notes.length === 0 ? tri : `${tri} · ${f.notes.length}`
}

/** La puce Réaction : « Réaction », ou « Réaction · 2 » avec deux réactions cochées. */
export function libellePuceReaction(f: FiltresMesFilms): string {
  return f.reactions.length === 0 ? 'Réaction' : `Réaction · ${f.reactions.length}`
}

/**
 * Les réactions d'un visionnage **en mots**, dans l'ordre du catalogue, séparées par « · » :
 * « J'ai adoré · À revoir ». Sans `en_salle` : l'icône posée à côté de la date le dit déjà
 * (`auCinema`), l'écrire aussi en toutes lettres le dirait deux fois. Vide quand il ne reste rien,
 * ou tant que le catalogue n'a pas répondu.
 */
export function motsReactions(reactions: string[], catalogue: Reaction[]): string {
  return catalogue
    .filter((r) => r.cle !== 'en_salle' && reactions.includes(r.cle))
    .map((r) => r.phrase)
    .join(' · ')
}

/** Vu en salle : la réaction `en_salle` est posée. */
export function auCinema(reactions: string[]): boolean {
  return reactions.includes('en_salle')
}

/**
 * Le compte de l'en-tête, lu dans `GET /stats` : « 87 films · 12 cette année », « 87 films » sans
 * le chiffre de l'année, `null` tant que le total n'est pas là — rien ne s'affiche alors, jamais un
 * zéro ni « … ». « 1 film », « 0 film » : le français ne met le pluriel qu'à partir de deux.
 */
export function compteEnTete(total: number | null | undefined, cetteAnnee: number | null | undefined): string | null {
  if (total == null) return null
  const films = total >= 2 ? `${total} films` : `${total} film`
  return cetteAnnee == null ? films : `${films} · ${cetteAnnee} cette année`
}
