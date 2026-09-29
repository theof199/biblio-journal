import { REACTION_EN_SALLE } from '../api/journal'
import type { JournalItem } from '../api/journal'
import type { FilmSuivi } from '../suivis/prochain'

/**
 * Le bilan du profil : la cinéphilie du membre, calculée dans l'app depuis le journal entier
 * (reprise de `Bilan.kt`, Android). Des fonctions pures, sans réseau : la date « d'aujourd'hui »
 * entre toujours par paramètre, jamais lue ici.
 */

/** « 1920 → 2020, 9 décennies sur 11 ». */
export interface DecenniesCouvertes {
  premiere: number
  derniere: number
  couvertes: number
  total: number
}

export interface FilmAncien {
  titre: string
  annee: number
}

export interface BilanJournal {
  seancesEnSalle: number
  seancesEnSalleCetteAnnee: number
  /** Une décimale, films notés seulement — nulle si aucun n'a de note. */
  noteMoyenne: number | null
  /** Nulles si aucun film n'a d'année de sortie connue. */
  decennies: DecenniesCouvertes | null
  plusAncien: FilmAncien | null
}

/** L'année d'une date `AAAA-MM-JJ` (`entry.finished_at`). */
const anneeDe = (dateIso: string): number => Number(dateIso.slice(0, 4))

const decennieDe = (annee: number): number => Math.floor(annee / 10) * 10

/**
 * Les décennies couvertes par une liste d'années de sortie, non vide : `total` est l'étendue
 * inclusive entre la première et la dernière, `couvertes` ne compte que celles où un film a été vu.
 */
export function decenniesCouvertes(annees: number[]): DecenniesCouvertes {
  if (annees.length === 0) throw new Error('decenniesCouvertes attend au moins une année.')
  const vues = new Set(annees.map(decennieDe))
  const premiere = Math.min(...vues)
  const derniere = Math.max(...vues)
  return { premiere, derniere, couvertes: vues.size, total: (derniere - premiere) / 10 + 1 }
}

/** Arrondi à une décimale : 8,25 devient 8,3, jamais 8,2. */
const uneDecimale = (valeur: number): number => Math.round(valeur * 10) / 10

/**
 * Les séances en salle (réaction `en_salle`, revoyures comprises), la note moyenne, les décennies
 * couvertes et le plus ancien film. Le compte des films vus, lui, vient de `GET /stats` : il
 * n'est pas redit ici.
 */
export function bilanJournal(journal: JournalItem[], anneeCourante: number): BilanJournal {
  const seances = journal.filter((i) => i.carnet.reactions.includes(REACTION_EN_SALLE))
  const seancesEnSalleCetteAnnee = seances.filter((i) => anneeDe(i.entry.finished_at) === anneeCourante).length

  const notes = journal.flatMap((i) => (i.entry.rating == null ? [] : [i.entry.rating]))
  const noteMoyenne = notes.length === 0 ? null : uneDecimale(notes.reduce((a, b) => a + b, 0) / notes.length)

  const avecAnnee = journal.flatMap((i) => (i.media.year == null ? [] : [{ titre: i.media.title, annee: i.media.year }]))
  const decennies = avecAnnee.length === 0 ? null : decenniesCouvertes(avecAnnee.map((f) => f.annee))
  // Le premier rencontré l'emporte à année égale : l'ordre du journal, le plus récent d'abord.
  const plusAncien = avecAnnee.reduce<FilmAncien | null>((min, f) => (min === null || f.annee < min.annee ? f : min), null)

  return { seancesEnSalle: seances.length, seancesEnSalleCetteAnnee, noteMoyenne, decennies, plusAncien }
}

/** Les quatorze décennies du Voyage, 1890 à 2020 : la grille du profil compte les mêmes cases que la carte. */
export const DECENNIES_DU_VOYAGE: readonly number[] = Array.from({ length: 14 }, (_, i) => 1890 + i * 10)

/** « AAAA-MM » d'une date, ou du mois reculé de `recul` mois depuis `mois`. */
function moisRecule(mois: string, recul: number): string {
  const total = Number(mois.slice(0, 4)) * 12 + (Number(mois.slice(5, 7)) - 1) - recul
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/**
 * Les entrées du journal par mois, sur les douze derniers mois glissants jusqu'à `moisCourant`
 * (« AAAA-MM ») inclus, le plus ancien d'abord. Chaque entrée compte, revoyure comprise : un
 * graphique d'activité, pas un compte de films distincts.
 */
export function filmsParMois(journal: JournalItem[], moisCourant: string): number[] {
  const comptes = new Map<string, number>()
  for (const i of journal) {
    const mois = i.entry.finished_at.slice(0, 7)
    comptes.set(mois, (comptes.get(mois) ?? 0) + 1)
  }
  return Array.from({ length: 12 }, (_, k) => comptes.get(moisRecule(moisCourant, 11 - k)) ?? 0)
}

/** Une case par décennie du Voyage : vraie si un film vu est sorti dans cette décennie. */
export function decenniesCouvertesGrille(journal: JournalItem[]): boolean[] {
  const vues = new Set(journal.flatMap((i) => (i.media.year == null ? [] : [decennieDe(i.media.year)])))
  return DECENNIES_DU_VOYAGE.map((d) => vues.has(d))
}

/** Un compte par note, de 1 à 10 : un film sans note n'entre dans aucune case. */
export function repartitionNotes(journal: JournalItem[]): number[] {
  const comptes = new Array<number>(10).fill(0)
  for (const i of journal) {
    const note = i.entry.rating
    if (note != null && note >= 1 && note <= 10) comptes[note - 1]! += 1
  }
  return comptes
}

/** Combien d'entités suivies (réalisateurs ou sagas), et combien « terminées ». */
export interface BilanSuivi {
  suivis: number
  termines: number
}

/**
 * Une filmographie est terminée quand tous ses films retrouvables sont vus : un introuvable ne
 * compte pas contre elle (comme `prochainAVoir`). Vide, elle l'est aussi : rien n'y reste à voir.
 */
export const filmographieTerminee = (films: readonly FilmSuivi[]): boolean =>
  films.every((f) => f.introuvable || f.vu != null)

/**
 * La même fonction pour les réalisateurs et les sagas : elle ne connaît que des identifiants et
 * des filmographies. Une entité dont la filmographie n'est pas dans la table n'est pas terminée.
 */
export function bilanSuivi(
  entites: readonly { tmdb_id: number }[],
  filmographies: ReadonlyMap<number, readonly FilmSuivi[]>,
): BilanSuivi {
  const termines = entites.filter((e) => {
    const films = filmographies.get(e.tmdb_id)
    return films !== undefined && filmographieTerminee(films)
  }).length
  return { suivis: entites.length, termines }
}
