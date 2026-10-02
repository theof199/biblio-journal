import type { QueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import type { JournalItem } from '../api/journal'
import type { Realisateur, RealisateurPage } from '../api/realisateurs'
import type { FilmsSaga, Saga } from '../api/sagas'
import { filmsSansSeries } from '../suivis/prochain'
import { ligneMois, ligneSeance, ligneSuivi, type LigneEnBref } from './enBref'
import { fraiche, journalEnCache } from './journalEnCache'

/**
 * Les lignes de « En bref » d'une séance qu'on vient d'écrire, lues dans le cache de requêtes et
 * nulle part ailleurs : aucune requête ne part. À appeler **avant** les invalidations qui suivent
 * l'écriture — elles périment les filmographies et le journal, qu'on ne lit plus alors
 * (`journalEnCache.ts`) : « En bref » serait vide.
 *
 * Dans l'ordre : les suivis qui contiennent le film (réalisateurs, puis sagas, dans l'ordre du back),
 * la séance qui s'ajoute à un film déjà vu, le mois. Les listes de suivis se lisent périmées ou non :
 * seules leurs filmographies portent le « vu » qui compte.
 */
export function enBrefEnCache(client: QueryClient, ecrite: JournalItem, masquerIntrouvables: boolean): LigneEnBref[] {
  const lignes: LigneEnBref[] = []
  const tmdbId = Number(ecrite.media.external_id)
  const seance = { entryId: ecrite.entry.id, rating: ecrite.entry.rating, finishedAt: ecrite.entry.finished_at }

  if (Number.isInteger(tmdbId)) {
    for (const realisateur of client.getQueryData<Realisateur[]>(cles.realisateurs) ?? []) {
      const cle = cles.pageRealisateur(realisateur.tmdb_id)
      const page = fraiche(client, cle) ? client.getQueryData<RealisateurPage>(cle) : undefined
      const ligne = page && ligneSuivi('realisateurs', realisateur.name, filmsSansSeries(page.films), tmdbId, seance, masquerIntrouvables)
      if (ligne) lignes.push(ligne)
    }
    for (const saga of client.getQueryData<Saga[]>(cles.sagas) ?? []) {
      const cle = cles.filmsSaga(saga.tmdb_id)
      const films = fraiche(client, cle) ? client.getQueryData<FilmsSaga>(cle)?.films : undefined
      const ligne = films && ligneSuivi('sagas', saga.name, films, tmdbId, seance, masquerIntrouvables)
      if (ligne) lignes.push(ligne)
    }
  }

  const journal = journalEnCache(client)
  if (journal) {
    const deuxieme = ligneSeance(journal.items, ecrite)
    if (deuxieme) lignes.push(deuxieme)
    const mois = ligneMois(journal, ecrite)
    if (mois) lignes.push(mois)
  }
  return lignes
}
