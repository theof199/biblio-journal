import type { JournalItem } from '../../api/journal'
import { estPrete, type FicheAnnee } from '../../api/voyage'

/**
 * Le film d'une salle qui porte un visionnage de la boîte, dans la fiche de son année : la ligne du
 * film (`voyage_films`) dont le billet de correction a besoin (`/voyage/:annee/films/:filmId/billet/
 * corriger`). Une entrée du journal ne dit que son film TMDB, jamais sa salle : le lien ne se déduit
 * que d'une fiche déjà lue. Une bobine se corrige par son programme, comme sur la fiche du film.
 * Nul sans fiche prête, pour un film qui n'est pas de TMDB, ou absent des salles.
 */
export function filmDuVisionnage(fiche: FicheAnnee | undefined, item: JournalItem): string | null {
  if (!estPrete(fiche) || item.media.source !== 'tmdb' || item.media.type !== 'movie') return null
  const tmdb = Number(item.media.external_id)
  for (const salle of fiche.salles) {
    for (const film of salle.films) {
      if (film.tmdb_id === tmdb || film.programme?.bobines.some((b) => b.tmdb_id === tmdb)) return film.id
    }
  }
  return null
}
