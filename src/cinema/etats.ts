import type { JournalItem } from '../api/journal'
import type { SortiesEnCours } from '../api/sorties'
import { normaliser } from '../ui/format'
import type { EtatFilmographie } from '../suivis/liste'

/**
 * L'onglet Au ciné (reprise de `AuCineEtats.kt`) : le nombre de séances, le rapprochement
 * « déjà dans ton journal », les messages de la grille « à l'affiche », l'heure de sa dernière
 * mise à jour — en fonctions pures, testées sans réseau ni rendu. L'état lui-même vit dans la page.
 */

/**
 * Le nombre de séances de l'année donnée, parmi les entrées **déjà chargées** de « Tes séances » —
 * reprise de `AuCineUi.seancesCetteAnnee()`. Une séance passée (une année précédente) ne compte
 * jamais, quelle que soit la page où elle vit.
 */
export function seancesCetteAnnee(seances: JournalItem[], annee: number): number {
  const cible = String(annee)
  return seances.filter((item) => item.entry.finished_at.slice(0, 4) === cible).length
}

/**
 * Vrai si ce film (par `tmdb_id`) figure déjà parmi les séances chargées — la coche « déjà dans
 * ton journal » des grilles. Rapprochement par `media.external_id`, jamais par le titre (reprise
 * de `AuCineUi.dejaDansLeJournal`). `tmdbId` nul (une tuile `en_cours` non résolue chez TMDB) ne
 * rapproche jamais rien.
 */
export function dejaDansLeJournal(seances: JournalItem[], tmdbId: number | null): boolean {
  if (tmdbId == null) return false
  const cible = String(tmdbId)
  return seances.some((item) => item.media.external_id === cible)
}

/**
 * Le visionnage le plus récent de ce film parmi les séances chargées, ou `undefined` : de quoi
 * ouvrir sa fiche en sachant qu'il est déjà vu (`FicheFilm`, « Vu · noté… »). Même rapprochement
 * que `dejaDansLeJournal` : par `tmdb_id`, jamais par le titre.
 */
export function dernierVisionnage(seances: JournalItem[], tmdbId: number | null): JournalItem | undefined {
  if (tmdbId == null) return undefined
  const cible = String(tmdbId)
  return seances
    .filter((item) => item.media.external_id === cible)
    .sort((a, b) => b.entry.finished_at.localeCompare(a.entry.finished_at))[0]
}

/**
 * Sous-titre d'une tuile « à l'affiche dans mes cinémas » : le premier cinéma, puis « +N » s'il y
 * en a d'autres — reprise de `SortieCinemaFilm.sousTitreCinemas()`. Vide si la liste est vide (le
 * contrat en garantit au moins un depuis le back, mais un test peut en construire une vide).
 */
export function sousTitreCinemas(cinemas: string[]): string {
  const [premier, ...reste] = cinemas
  if (!premier) return ''
  return reste.length > 0 ? `${premier} +${reste.length}` : premier
}

/**
 * Le cinéma unique de la grille « à l'affiche dans mes cinémas » — reprise de
 * `cinemaUniqueEnCours()` (point 13 de la revue du 24 septembre 2026, Android) : quand toutes les
 * tuiles ne portent, ensemble, qu'un seul nom de cinéma distinct, il devient le titre de la grille,
 * une seule fois, au lieu de se répéter sous chaque affiche. `null` dès que deux noms distincts
 * apparaissent (ou aucun) : `sousTitreCinemas` garde alors son rôle, tuile par tuile.
 */
export function cinemaUniqueEnCours(films: SortiesEnCours['films']): string | null {
  const noms = new Set(films.flatMap((film) => film.cinemas))
  if (noms.size !== 1) return null
  const [nom] = noms
  return nom ?? null
}

/**
 * Le message à afficher à la place de la grille « à l'affiche dans mes cinémas », ou `null`
 * quand elle doit s'afficher — reprise de `SortiesEnCours.messageAuCine()`. Deux causes distinctes
 * rendent « Pas encore de programme. » : aucun cinéma configuré, ou la tâche de fond n'a **jamais**
 * tourné (`films` vide ET `calcule_le` nul) — à ne pas confondre avec une passe qui a bien eu lieu
 * et n'a simplement rien trouvé aujourd'hui.
 */
export function messageAuCine(enCours: SortiesEnCours): string | null {
  if (!enCours.cinemas_configures || (enCours.films.length === 0 && enCours.calcule_le == null)) {
    return 'Pas encore de programme.'
  }
  if (enCours.films.length === 0) return 'Rien à l’affiche aujourd’hui.'
  return null
}

/** Fuseau fixe, comme côté back (`routes/reference.ts`) : une heure affichée qui ne varie pas avec l'appareil. */
export const FUSEAU_AU_CINE = 'Europe/Paris'

/**
 * « mis à jour à 14 h », depuis `calcule_le` (ISO 8601, UTC) — nul tant que la tâche de fond n'a
 * jamais tourné, ou si le back envoie une date illisible plutôt que de faire échouer tout l'écran
 * pour ça (reprise de `SortiesEnCours.miseAJourAffichee()`). L'heure se lit dans le fuseau
 * Europe/Paris : un `calcule_le` proche de minuit UTC peut donc tomber sur le jour suivant à Paris,
 * sans que ça change rien à l'heure affichée — seule l'heure compte, jamais le jour.
 */
export function miseAJourAffichee(calculeLe: string | null): string | null {
  if (!calculeLe) return null
  const date = new Date(calculeLe)
  if (Number.isNaN(date.getTime())) return null
  const heure = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU_AU_CINE, hourCycle: 'h23', hour: 'numeric' }).format(date),
  )
  return `mis à jour à ${heure} h`
}

/**
 * Ce que les tuiles d'Au ciné savent des Suivis (reprise de `ReperesSuivis`, « Au ciné · le
 * guichet », 25 septembre 2026) : de quoi poser le sceau « réalisateur suivi » ou « saga suivie »
 * sur une affiche, **sans aucun appel réseau nouveau** — seulement ce que l'accueil et l'onglet
 * Suivis ont déjà mis en cache.
 *
 * Pas de `lireRealisateursDuFilm` par tuile : jusqu'à quarante tuiles, donc jusqu'à quarante appels
 * à l'ouverture de l'onglet, refusé. Le réalisateur se rapproche donc par son **nom** :
 * `directors` vient d'Allociné, le nom d'un réalisateur suivi de TMDB — les deux s'écrivent parfois
 * différemment (accents, casse), d'où la comparaison par `normaliser`. `realisateurs` porte ces
 * noms déjà normalisés.
 *
 * `filmsDeSagas` : les `tmdb_id` de tous les films des sagas suivies dont la filmographie est
 * arrivée. Une filmographie encore en attente ou en panne ne contribue rien : le sceau apparaît
 * quand elle arrive.
 */
export interface ReperesSuivis {
  realisateurs: ReadonlySet<string>
  filmsDeSagas: ReadonlySet<number>
}

export function reperesSuivis(
  realisateurs: readonly { name: string }[] | undefined,
  filmographiesSagas: ReadonlyMap<number, EtatFilmographie<{ tmdb_id: number }>>,
): ReperesSuivis {
  const filmsDeSagas = new Set<number>()
  filmographiesSagas.forEach((etat) => {
    if (etat.statut === 'pret') etat.films.forEach((film) => filmsDeSagas.add(film.tmdb_id))
  })
  return { realisateurs: new Set((realisateurs ?? []).map((r) => normaliser(r.name))), filmsDeSagas }
}

/** Le sceau d'une tuile : une personne pour un réalisateur suivi, un film pour une saga suivie. */
export type MarqueSuivi = 'realisateur' | 'saga'

/**
 * La marque d'une tuile « à l'affiche dans mes cinémas ». Le réalisateur l'emporte quand les deux
 * sont vrais (décision du 25 septembre 2026) : c'est le suivi le plus personnel des deux. Une tuile
 * sans `tmdb_id` n'en porte aucune — ni coche ni sceau sur une tuile qu'on ne peut pas toucher.
 */
export function marqueEnCours(reperes: ReperesSuivis, film: { tmdb_id: number | null; directors: string[] }): MarqueSuivi | null {
  if (film.tmdb_id == null) return null
  if (film.directors.some((nom) => reperes.realisateurs.has(normaliser(nom)))) return 'realisateur'
  if (reperes.filmsDeSagas.has(film.tmdb_id)) return 'saga'
  return null
}

/**
 * La marque d'une tuile « la semaine prochaine » : la saga seule, TMDB ne portant pas de
 * réalisateur sur ces sorties (correctif Android du 14 septembre 2026).
 */
export function marqueProchaine(reperes: ReperesSuivis, film: { tmdb_id: number }): MarqueSuivi | null {
  return reperes.filmsDeSagas.has(film.tmdb_id) ? 'saga' : null
}
