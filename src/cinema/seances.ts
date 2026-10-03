import type { CinemaDuFilm, CinemaDuJour, SeanceDuJour, SeancesDuJour } from '../api/seances'
import { distanceKm, type Coordonnees } from './distance'
import { FUSEAU_AU_CINE } from './etats'

/**
 * Les séances d'aujourd'hui (l'onglet Au ciné, la fiche d'un film) en fonctions pures : ce qui reste
 * à venir, l'ordre du tableau, l'heure et « dans N min ». L'horloge est toujours un argument : la page
 * relit la sienne toutes les trente secondes (`useMaintenant`), sans rappeler l'API, et une séance
 * qui a commencé quitte l'écran d'elle-même.
 */

/** Ce que cinéma et séance ont en commun pour être placés : un cinéma sans position n'a pas de distance. */
interface CinemaPositionne {
  nom: string
  latitude: number | null
  longitude: number | null
}

/** Une séance est à venir tant que son début est strictement après l'horloge ; une date illisible n'est jamais à venir. */
export const estAVenir = (debut: string, maintenantMs: number): boolean => Date.parse(debut) > maintenantMs

/** `null` sans position du membre ou sans coordonnées du cinéma : « le plus proche » n'existe alors pas. */
export function distanceDuCinema(cinema: CinemaPositionne | undefined, position: Coordonnees | null): number | null {
  if (!cinema || !position || cinema.latitude == null || cinema.longitude == null) return null
  return distanceKm(position, { latitude: cinema.latitude, longitude: cinema.longitude })
}

/** Un cinéma sans distance passe après tout cinéma qui en a une ; entre deux distances, la plus courte d'abord. */
function comparerDistances(a: number | null, b: number | null): number {
  if (a != null && b != null) return a - b
  if (a != null) return -1
  if (b != null) return 1
  return 0
}

const comparerTextes = (a: string, b: string) => a.localeCompare(b, 'fr')

export interface EntreeDuTableau {
  seance: SeanceDuJour
  cinema: CinemaDuJour | undefined
  /** En kilomètres ; `null` quand on ne sait pas la calculer. */
  distance: number | null
}

/**
 * Les séances à venir dans l'ordre du tableau : par début, puis à début égal le cinéma le plus proche,
 * les cinémas sans position (ou tous, sans la position du membre) après, par nom — le titre tranche
 * enfin, pour que l'ordre ne dépende jamais de celui de l'API.
 */
export function entreesDuTableau(
  donnees: Pick<SeancesDuJour, 'cinemas' | 'seances'> | undefined,
  position: Coordonnees | null,
  maintenantMs: number,
): EntreeDuTableau[] {
  if (!donnees) return []
  const cinemas = new Map(donnees.cinemas.map((cinema) => [cinema.id, cinema]))
  return donnees.seances
    .filter((seance) => estAVenir(seance.debut, maintenantMs))
    .map((seance) => {
      const cinema = cinemas.get(seance.cinema_id)
      return { seance, cinema, distance: distanceDuCinema(cinema, position) }
    })
    .sort(
      (a, b) =>
        Date.parse(a.seance.debut) - Date.parse(b.seance.debut) ||
        comparerDistances(a.distance, b.distance) ||
        comparerTextes(a.cinema?.nom ?? '', b.cinema?.nom ?? '') ||
        comparerTextes(a.seance.film.title, b.seance.film.title),
    )
}

/** Le début de la prochaine séance à venir de chaque film (`tmdb_id`), pour le repère horaire des tuiles. */
export function prochaineSeanceParFilm(
  seances: readonly SeanceDuJour[] | undefined,
  maintenantMs: number,
): Map<number, string> {
  const prochaines = new Map<number, string>()
  for (const { film, debut } of seances ?? []) {
    if (!estAVenir(debut, maintenantMs)) continue
    const deja = prochaines.get(film.tmdb_id)
    if (deja === undefined || Date.parse(debut) < Date.parse(deja)) prochaines.set(film.tmdb_id, debut)
  }
  return prochaines
}

export interface CinemaDuFilmAVenir {
  cinema: CinemaDuFilm
  distance: number | null
}

/**
 * Les cinémas où le film passe encore, chacun réduit à ses séances à venir (un cinéma qui n'en a plus
 * s'en va). Avec la position du membre : le plus proche d'abord, ceux sans coordonnées après ; sans
 * elle, celui de la prochaine séance d'abord. À égalité, par nom.
 */
export function cinemasDuFilmAVenir(
  cinemas: readonly CinemaDuFilm[] | undefined,
  position: Coordonnees | null,
  maintenantMs: number,
): CinemaDuFilmAVenir[] {
  // Le premier de la liste une fois triée : l'API promet l'ordre, la page ne s'y fie pas.
  const debutDe = ({ cinema }: CinemaDuFilmAVenir) => Date.parse(cinema.seances[0]!.debut)
  return (cinemas ?? [])
    .map((cinema) => ({
      ...cinema,
      seances: cinema.seances
        .filter((seance) => estAVenir(seance.debut, maintenantMs))
        .sort((a, b) => Date.parse(a.debut) - Date.parse(b.debut)),
    }))
    .filter((cinema) => cinema.seances.length > 0)
    .map((cinema) => ({ cinema, distance: distanceDuCinema(cinema, position) }))
    .sort(
      (a, b) =>
        (position ? comparerDistances(a.distance, b.distance) : 0) ||
        debutDe(a) - debutDe(b) ||
        comparerTextes(a.cinema.nom, b.cinema.nom),
    )
}

const FORMAT_HEURE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU_AU_CINE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** « 19:05 », à l'heure de Paris : celle du cinéma, quel que soit le fuseau de l'appareil. */
export const heureAffichee = (debut: string): string => FORMAT_HEURE.format(new Date(debut))

/**
 * « dans 5 min » sous l'heure, « dans 1 h 05 » à partir d'une heure — minutes toujours sur deux
 * chiffres après l'heure, « dans 2 h 00 » compris. Arrondi au-dessus : une séance dans quatre minutes
 * dix s'annonce « dans 5 min », et « dans 0 min » n'existe pas puisque la séance commencée a quitté
 * le tableau. Espaces insécables : l'annonce ne se coupe pas en bout de ligne.
 */
export function dansCombien(debut: string, maintenantMs: number): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(debut) - maintenantMs) / 60_000))
  if (minutes < 60) return `dans\u00a0${minutes}\u00a0min`
  const reste = String(minutes % 60).padStart(2, '0')
  return `dans\u00a0${Math.floor(minutes / 60)}\u00a0h\u00a0${reste}`
}
