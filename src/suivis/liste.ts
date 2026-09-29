import { formatDateVisionnage } from '../ui/format'
import { filmsVus, prochainAVoir, type FilmSuivi } from './prochain'

/**
 * Les règles pures de la liste des Suivis (reprise de `SuivisEtats.kt` et `BandeEtats.kt`, appli
 * Android, « rétrospectives et cycles » du 25 septembre 2026) : le compte sous un nom, l'ordre des
 * cartes, la section « complets » du bas. Testées sans réseau ni rendu.
 *
 * Les dates se comparent en chaînes ISO sur leurs **dix premiers caractères** : `finished_at` est
 * une date (`2026-09-22`), `ajoute_le` un instant (`2026-09-15T18:22:41.000Z`) ; tronqués au jour,
 * l'ordre lexicographique est l'ordre chronologique — le jour tel que le back l'a écrit, sans
 * conversion de fuseau.
 */

/** Ce qu'on sait de la filmographie d'une entité suivie : pas encore là, là, ou en panne. */
export type EtatFilmographie<F> =
  | { statut: 'attente' }
  | { statut: 'pret'; films: F[] }
  | { statut: 'indisponible' }

/** Un réalisateur (« rétrospective ») ou une saga (« cycle ») : ses libellés propres. */
export type SourceSuivi = 'realisateurs' | 'sagas'

export const LIBELLES_SUIVI: Record<SourceSuivi, { titreComplets: string; participeBoucle: string }> = {
  realisateurs: { titreComplets: 'Rétrospectives complètes', participeBoucle: 'bouclée' },
  sagas: { titreComplets: 'Cycles complets', participeBoucle: 'bouclé' },
}

/** Un film tel qu'une carte le montre : sa bande (un cycle) et sa ligne « Ensuite ». */
export interface FilmCarte extends FilmSuivi {
  title: string
  year: number | null
  cover_url: string | null
}

/** Une entité suivie, réduite à ce que ces règles lisent. */
export interface EntiteSuiviListe {
  tmdb_id: number
  ajoute_le: string
}

/** Le jour du visionnage le plus récent de ces films (`2026-09-22`), nul si aucun n'est vu. */
export function dernierVisionnage(films: readonly FilmSuivi[]): string | null {
  let dernier: string | null = null
  for (const film of films) {
    const jour = film.vu?.finished_at.slice(0, 10)
    if (jour && (dernier == null || jour > dernier)) dernier = jour
  }
  return dernier
}

/**
 * Le jour de la dernière activité sur une entité : son film vu le plus récemment, sinon le jour où
 * je l'ai ajoutée. `films` nul (filmographie pas encore là, ou indisponible) : `ajoute_le` seul.
 */
export function derniereActivite(ajouteLe: string, films: readonly FilmSuivi[] | null): string {
  return (films ? dernierVisionnage(films) : null) ?? ajouteLe.slice(0, 10)
}

const filmsPrets = <F>(etat: EtatFilmographie<F> | undefined): F[] | null => (etat?.statut === 'pret' ? etat.films : null)

/**
 * Les entités de la plus récemment active à la plus ancienne. Une entité dont la filmographie
 * n'est pas prête se classe sur son seul `ajoute_le`, et remonte à sa place quand ses films
 * arrivent. Tri stable : à égalité, l'ordre du back (du plus récemment ajouté au plus ancien) tient.
 */
export function trierParActivite<E extends EntiteSuiviListe, F extends FilmSuivi>(
  entites: readonly E[],
  filmographies: ReadonlyMap<number, EtatFilmographie<F>>,
): E[] {
  const jour = (entite: E) => derniereActivite(entite.ajoute_le, filmsPrets(filmographies.get(entite.tmdb_id)))
  return [...entites].sort((a, b) => {
    const ja = jour(a)
    const jb = jour(b)
    return ja < jb ? 1 : ja > jb ? -1 : 0
  })
}

/**
 * Une rétrospective ou un cycle bouclé : au moins un film, et chacun vu ou marqué introuvable. Une
 * liste vide n'est pas bouclée ici : une carte sans aucun film n'a rien à célébrer dans la section
 * du bas.
 */
export function entiteBouclee(films: readonly FilmSuivi[]): boolean {
  return films.length > 0 && films.every((film) => film.introuvable || film.vu != null)
}

/**
 * La liste, en deux : en cours d'abord, bouclées ensuite (la section « complets »), chacune triée
 * par activité. Une filmographie pas encore prête reste en cours.
 */
export function repartirSuivis<E extends EntiteSuiviListe, F extends FilmSuivi>(
  entites: readonly E[],
  filmographies: ReadonlyMap<number, EtatFilmographie<F>>,
): { enCours: E[]; bouclees: E[] } {
  const triees = trierParActivite(entites, filmographies)
  const estBouclee = (entite: E) => {
    const films = filmsPrets(filmographies.get(entite.tmdb_id))
    return films != null && entiteBouclee(films)
  }
  return { enCours: triees.filter((e) => !estBouclee(e)), bouclees: triees.filter(estBouclee) }
}

const JOUR_MS = 86_400_000
function parties(jour: string): [number, number, number] {
  const [annee, mois, quantieme] = jour.slice(0, 10).split('-').map(Number)
  return [annee!, mois!, quantieme!]
}

/**
 * Le temps écoulé depuis `iso` jusqu'à `aujourdHui` (`AAAA-MM-JJ`), en mots : « aujourd’hui »,
 * « hier », « il y a 3 jours » (jusqu'à 6), « il y a 2 semaines » (1 à 4), puis « il y a 5 mois »
 * (au moins 1, mois entiers). Une date à venir se lit « aujourd’hui ». Reprise de `formatRelatif`
 * (Android, `ui/Format.kt`).
 */
export function formatRelatif(iso: string, aujourdHui: string): string {
  const [a, m, j] = parties(iso)
  const [aa, am, aj] = parties(aujourdHui)
  const jours = Math.round((Date.UTC(aa, am - 1, aj) - Date.UTC(a, m - 1, j)) / JOUR_MS)
  if (jours <= 0) return 'aujourd’hui'
  if (jours === 1) return 'hier'
  if (jours < 7) return `il y a ${jours} jours`
  if (jours < 35) {
    const semaines = Math.floor(jours / 7)
    return semaines === 1 ? 'il y a 1 semaine' : `il y a ${semaines} semaines`
  }
  const mois = (aa - a) * 12 + (am - m) - (aj < j ? 1 : 0)
  return `il y a ${Math.max(mois, 1)} mois`
}

/**
 * La ligne sous le nom d'une carte (reprise de `sousLigneCarte`) :
 * - « 4 sur 12 · vu il y a 3 jours » quand un film est vu (`activite`, le jour du dernier) ;
 * - « 0 sur 12 · ajouté le 12 septembre 2026 » sinon ;
 * - « 6 sur 6 · bouclée le 2 août 2026 » (ou « bouclé ») pour une entité bouclée, datée de son
 *   dernier visionnage, sinon de son ajout.
 * Sans aucune date (`ajouteLe` vide), le compte seul.
 */
export function sousLigneCarte(
  source: SourceSuivi,
  vus: number,
  total: number,
  activite: string | null,
  ajouteLe: string,
  aujourdHui: string,
  bouclee: boolean,
): string {
  const compte = `${vus} sur ${total}`
  const ajout = ajouteLe.slice(0, 10) || null
  let suite: string | null
  if (bouclee) {
    const jour = activite ?? ajout
    suite = jour ? `${LIBELLES_SUIVI[source].participeBoucle} le ${formatDateVisionnage(jour)}` : null
  } else if (activite != null) {
    suite = `vu ${formatRelatif(activite, aujourdHui)}`
  } else {
    suite = ajout ? `ajouté le ${formatDateVisionnage(ajout)}` : null
  }
  return suite == null ? compte : `${compte} · ${suite}`
}

/**
 * Ce qu'une case de la bande d'un cycle montre de son film (reprise de `EtatBande`, Android) : vu
 * (coché), le prochain à voir (liseré d'accent), pas encore (atténué), introuvable (atténué, marqué
 * « Perdu ») — ce dernier seulement quand « Masquer les introuvables » est coupé.
 */
export type EtatBande = 'vu' | 'prochain' | 'pas-encore' | 'introuvable'

/**
 * La bande d'un cycle (reprise de `disposerBande`, Android), dans l'ordre du back — de la plus
 * ancienne sortie à la plus récente. Les rangées de six sont l'affaire de la grille
 * (`--grille-bande-colonnes`), pas de ce découpage.
 *
 * - `masquerIntrouvables` : les introuvables quittent la bande ; sinon ils y restent, `introuvable`
 *   — la marque prime sur le visionnage.
 * - `prochain` : le film de `prochainAVoir`, qui saute déjà les introuvables — une case au plus,
 *   aucune quand tout est vu.
 */
export function casesBande<F extends FilmSuivi>(
  films: readonly F[],
  masquerIntrouvables: boolean,
): { film: F; etat: EtatBande }[] {
  const prochain = prochainAVoir(films)
  return films
    .filter((film) => !(masquerIntrouvables && film.introuvable))
    .map((film) => ({
      film,
      etat: film.introuvable ? 'introuvable' : film.vu != null ? 'vu' : film === prochain ? 'prochain' : 'pas-encore',
    }))
}

/**
 * Le compte d'une carte de cycle, (vus, total), **tel que la bande le dessine** (`compteBande`,
 * Android) : les cases visibles et les cases cochées. Avec « Masquer les introuvables », le total
 * les exclut ; sinon il les compte, sans jamais les compter vus (la marque prime sur le visionnage).
 */
export function compteBande(films: readonly FilmSuivi[], masquerIntrouvables: boolean): { vus: number; total: number } {
  const cases = casesBande(films, masquerIntrouvables)
  return { vus: cases.filter((c) => c.etat === 'vu').length, total: cases.length }
}

/** « 5 rétrospectives · 2 cycles », accordé : « 1 rétrospective · 0 cycle » (`compteSuivis`, Android). */
export function compteSuivis(nRetrospectives: number, nCycles: number): string {
  const r = nRetrospectives > 1 ? 'rétrospectives' : 'rétrospective'
  const c = nCycles > 1 ? 'cycles' : 'cycle'
  return `${nRetrospectives} ${r} · ${nCycles} ${c}`
}

/** Le compte d'une carte : les vus sur tous les films pour un réalisateur, `compteBande` pour une saga. */
export function compteCarte(
  source: SourceSuivi,
  films: readonly FilmSuivi[],
  masquerIntrouvables: boolean,
): { vus: number; total: number } {
  return source === 'sagas' ? compteBande(films, masquerIntrouvables) : { vus: filmsVus(films), total: films.length }
}
