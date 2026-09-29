import { jourLocal } from '../ui/format'
import type { JournalItem, JournalPatchBody } from '../api/journal'

/** Le brouillon du formulaire, indépendant de la forme d'écriture de l'API (`FormScreen.kt`, `FormUi`). */
export interface FormulaireBrouillon {
  date: string
  note: number | null
  reactions: string[]
  remarque: string
}

export function brouillonInitial(item?: JournalItem): FormulaireBrouillon {
  if (!item) return { date: jourLocal(), note: null, reactions: [], remarque: '' }
  return {
    date: item.entry.finished_at,
    note: item.entry.rating,
    reactions: item.carnet.reactions,
    remarque: item.carnet.comment ?? '',
  }
}

/**
 * Le corps d'un `PATCH /me/journal/:id`, réduit à ce qui a changé depuis `original` — reprise de
 * `PatchBody.kt`. Le back ne remonte la note au suivi que si le corps porte la clé `rating`, et
 * n'efface la remarque que sur un `null` explicite : un champ inchangé doit donc rester **absent**,
 * jamais réémis avec sa valeur d'avant.
 */
export function construirePatch(original: JournalItem, brouillon: FormulaireBrouillon): JournalPatchBody {
  const corps: JournalPatchBody = {}

  if (brouillon.date !== original.entry.finished_at) corps.finished_at = brouillon.date

  if (brouillon.note !== original.entry.rating) corps.rating = brouillon.note

  const reactionsOriginales = new Set(original.carnet.reactions)
  const memesReactions =
    brouillon.reactions.length === reactionsOriginales.size &&
    brouillon.reactions.every((r) => reactionsOriginales.has(r))
  if (!memesReactions) corps.reactions = brouillon.reactions

  const remarque = brouillon.remarque.trim() || null
  if (remarque !== original.carnet.comment) corps.comment = remarque

  return corps
}
