import type { CorpsRemplacement, EtatFilm, Salle, Seance } from '../api/voyage'

/**
 * La séance d'une année (plan 2b), sans rendu. Portée de `SeanceEtats.kt` (`biblio-android`,
 * `ui/frise/`).
 */

/** Plex d'abord, puis demandé, puis à demander, puis le reste. */
const ordre = (etat: EtatFilm): number => ({ sur_le_plex: 0, demande: 1, a_demander: 2, vu: 3, introuvable: 3 })[etat]

const libre = (etat: EtatFilm): boolean => etat !== 'vu' && etat !== 'introuvable'

export type CandidatSeance =
  | { type: 'film'; filmId: string; tmdbId: number; titre: string; affiche: string | null; etat: EtatFilm }
  | { type: 'bobine'; filmId: string; tmdbId: number; titre: string; affiche: string | null; etat: EtatFilm }

export interface GroupeDeCandidats {
  salle: string
  candidats: CandidatSeance[]
}

/** « Autre long » : les films sans programme, ni vus ni introuvables, par salle, Plex d'abord. */
export function candidatsLong(salles: readonly Salle[]): GroupeDeCandidats[] {
  return salles.flatMap((s) => {
    const candidats: CandidatSeance[] = s.films
      .filter((f) => f.programme === null && libre(f.etat))
      .sort((a, b) => ordre(a.etat) - ordre(b.etat))
      .map((f) => ({ type: 'film', filmId: f.id, tmdbId: f.tmdb_id, titre: f.title, affiche: f.cover_url, etat: f.etat }))
    return candidats.length > 0 ? [{ salle: s.nom, candidats }] : []
  })
}

/**
 * « Autre court » : d'abord les programmes libres, chacun suivi de ses bobines libres, puis les films
 * sans programme libres, jamais le long de ce soir ; par salle, Plex d'abord dans chaque sous-liste.
 */
export function candidatsCourt(salles: readonly Salle[], longDeCeSoir: string): GroupeDeCandidats[] {
  return salles.flatMap((s) => {
    const programmes: CandidatSeance[] = s.films
      .filter((f) => f.programme !== null)
      .sort((a, b) => ordre(a.etat) - ordre(b.etat))
      .flatMap((f) => {
        const ligne: CandidatSeance[] = libre(f.etat)
          ? [{ type: 'film', filmId: f.id, tmdbId: f.tmdb_id, titre: f.title, affiche: f.cover_url, etat: f.etat }]
          : []
        const bobines: CandidatSeance[] = f
          .programme!.bobines.filter((b) => libre(b.etat))
          .map((b) => ({ type: 'bobine', filmId: f.id, tmdbId: b.tmdb_id, titre: b.title, affiche: b.cover_url, etat: b.etat }))
        return [...ligne, ...bobines]
      })
    const films: CandidatSeance[] = s.films
      .filter((f) => f.programme === null && f.id !== longDeCeSoir && libre(f.etat))
      .sort((a, b) => ordre(a.etat) - ordre(b.etat))
      .map((f) => ({ type: 'film', filmId: f.id, tmdbId: f.tmdb_id, titre: f.title, affiche: f.cover_url, etat: f.etat }))
    const candidats = [...programmes, ...films]
    return candidats.length > 0 ? [{ salle: s.nom, candidats }] : []
  })
}

/** Le corps de `POST …/remplacer` : `film_id` seul, plus `bobine_tmdb_id` pour une bobine. */
export const corpsRemplacement = (morceau: 'long' | 'court', c: CandidatSeance): CorpsRemplacement =>
  c.type === 'bobine' ? { morceau, film_id: c.filmId, bobine_tmdb_id: c.tmdbId } : { morceau, film_id: c.filmId }

/** La plus récente séance composée (rang le plus haut), nulle sans séance. */
export function seanceRecente(seances: readonly Seance[]): Seance | null {
  let r: Seance | null = null
  for (const s of seances) if (!r || s.rang > r.rang) r = s
  return r
}

/** Terminée : prise, et son long vu. Elle rejoint alors les passées, et le bouton revient. */
const terminee = (s: Seance): boolean => s.statut === 'prise' && s.long.etat === 'vu'

/** Les séances passées, prises ou ignorées, jamais la récente tant qu'elle tient la carte ; rang décroissant. */
export function seancesPassees(seances: readonly Seance[]): Seance[] {
  const recente = seanceRecente(seances)
  return seances
    .filter((s) => (s.id !== recente?.id || terminee(s)) && (s.statut === 'prise' || s.statut === 'ignoree'))
    .sort((a, b) => b.rang - a.rang)
}

export type ZoneSeance = 'bouton' | 'en_cours' | 'proposee' | 'prise'

/**
 * La zone séance (portée d'`etatZoneSeance`) : une composition en vol prime ; sinon la plus récente
 * décide — aucune, ignorée ou terminée : le bouton ; proposée : sa carte ; prise : sa carte tamponnée.
 */
export function zoneSeance(enCours: boolean, seances: readonly Seance[]): ZoneSeance {
  if (enCours) return 'en_cours'
  const r = seanceRecente(seances)
  if (!r || r.statut === 'ignoree' || terminee(r)) return 'bouton'
  return r.statut === 'proposee' ? 'proposee' : 'prise'
}
