import { exemple } from './contrat'
import type { JournalItem, JournalPage } from '../api/journal'

const BASE = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

/** Un visionnage du journal, aux seules valeurs que le test pose : le reste vient de l'exemple du contrat. */
export function visionnage(o: {
  id: string
  media?: string
  titre?: string
  annee?: number | null
  date: string
  note?: number | null
  reactions?: string[]
}): JournalItem {
  return {
    ...BASE,
    entry: { ...BASE.entry, id: o.id, media_id: o.media ?? o.id, finished_at: o.date, rating: o.note ?? null },
    media: { ...BASE.media, id: o.media ?? o.id, title: o.titre ?? `Film ${o.id}`, year: o.annee === undefined ? 2000 : o.annee },
    carnet: { reactions: o.reactions ?? [], comment: null },
  }
}
