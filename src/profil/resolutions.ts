import type { JournalItem } from '../api/journal'

/**
 * Les lignes du rapport d'import tranchées dans le rapport même (correctif du 30 septembre 2026) :
 * le candidat choisi, et le visionnage qu'il a enregistré — de quoi dire « ajouté » et rouvrir le
 * formulaire pour corriger.
 *
 * **Pourquoi ici, et pas dans la tâche.** Le rapport vit dans la tâche de l'API, que rien n'écrit
 * après sa fin ; l'enregistrement passe par les routes de tout le monde (`POST /media`, puis
 * `POST /me/journal`), qui ne savent rien de l'import. L'état d'une ligne se garde donc dans ce
 * navigateur, **sous la clé de la tâche** : il survit à un retour arrière et à un rechargement, et
 * une autre tâche ne le voit jamais.
 */
export interface Resolution {
  tmdb_id: string
  titre: string
  annee: number | null
  item: JournalItem
}

export type Resolutions = Record<string, Resolution>

const cle = (tacheId: string) => `journal.import-letterboxd.${tacheId}`

/** `localStorage` peut être absent (navigation privée) ou lever : on repart d'un rapport sans ligne tranchée. */
export function lireResolutions(tacheId: string): Resolutions {
  try {
    const brut = window.localStorage.getItem(cle(tacheId))
    if (!brut) return {}
    const valeur = JSON.parse(brut) as unknown
    return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur) ? (valeur as Resolutions) : {}
  } catch {
    return {}
  }
}

export function ecrireResolutions(tacheId: string, valeur: Resolutions): void {
  try {
    window.localStorage.setItem(cle(tacheId), JSON.stringify(valeur))
  } catch {
    // Rien à faire : le visionnage est enregistré, seul l'état de la ligne ne survivra pas.
  }
}
