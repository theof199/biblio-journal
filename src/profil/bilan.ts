import type { JournalItem } from '../api/journal'
import type { Reaction } from '../api/reactions'
import type { FilmSuivi } from '../suivis/prochain'

/**
 * Ce que le profil dessine, calculé dans l'app depuis le journal entier (reprise de `Bilan.kt`,
 * Android). Des fonctions pures, sans réseau : la date « d'aujourd'hui » entre toujours par
 * paramètre, jamais lue ici.
 */

const decennieDe = (annee: number): number => Math.floor(annee / 10) * 10

/** Arrondi à une décimale : 8,25 devient 8,3, jamais 8,2. */
const uneDecimale = (valeur: number): number => Math.round(valeur * 10) / 10

/** La note moyenne, une décimale, films notés seulement : nulle si aucun n'a de note. */
export function noteMoyenne(journal: JournalItem[]): number | null {
  const notes = journal.flatMap((i) => (i.entry.rating == null ? [] : [i.entry.rating]))
  return notes.length === 0 ? null : uneDecimale(notes.reduce((a, b) => a + b, 0) / notes.length)
}

/** Les minutes de films vus en heures entières : « 213 h » se lit sur la carte, pas « 212,6 ». */
export const heuresDeFilms = (minutes: number): number => Math.round(minutes / 60)

/**
 * L'année du plus ancien visionnage : le journal ne garde pas de date d'inscription, la carte
 * « adhère » donc depuis le premier film noté. Nulle pour un journal vide.
 */
export function anneeDAdhesion(journal: JournalItem[]): number | null {
  if (journal.length === 0) return null
  // `AAAA-MM-JJ` se compare comme du texte.
  const plusAncien = journal.reduce((min, i) => (i.entry.finished_at < min ? i.entry.finished_at : min), journal[0]!.entry.finished_at)
  return Number(plusAncien.slice(0, 4))
}

/** Les quatorze décennies du Voyage, 1890 à 2020 : le profil compte les mêmes cases que la carte. */
export const DECENNIES_DU_VOYAGE: readonly number[] = Array.from({ length: 14 }, (_, i) => 1890 + i * 10)

/**
 * Les entrées du journal d'une année, par mois (janvier d'abord, décembre en dernier). Chaque
 * entrée compte, revoyure comprise : un graphique d'activité, pas un compte de films distincts.
 */
export function filmsParMois(journal: JournalItem[], annee: number): number[] {
  const comptes = new Array<number>(12).fill(0)
  for (const i of journal) {
    if (Number(i.entry.finished_at.slice(0, 4)) !== annee) continue
    comptes[Number(i.entry.finished_at.slice(5, 7)) - 1]! += 1
  }
  return comptes
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

/**
 * Une filmographie est terminée quand tous ses films retrouvables sont vus : un introuvable ne
 * compte pas contre elle (comme `prochainAVoir`). Vide, elle l'est aussi : rien n'y reste à voir.
 */
export const filmographieTerminee = (films: readonly FilmSuivi[]): boolean =>
  films.every((f) => f.introuvable || f.vu != null)

/** Un compte par décennie du Voyage, 1890 à 2020 : un film sans année, ou d'avant 1890, n'entre dans aucune. */
export function filmsParDecennie(journal: JournalItem[]): number[] {
  const comptes = new Array<number>(DECENNIES_DU_VOYAGE.length).fill(0)
  for (const i of journal) {
    if (i.media.year == null) continue
    const rang = DECENNIES_DU_VOYAGE.indexOf(decennieDe(i.media.year))
    if (rang >= 0) comptes[rang]! += 1
  }
  return comptes
}

export const REACTIONS_MONTREES = 6

export interface ReactionComptee extends Reaction {
  nombre: number
}

/**
 * Les réactions du carnet les plus posées, la plus fréquente d'abord : une clé que le catalogue
 * ne connaît plus n'a ni emoji ni phrase à montrer, elle est ignorée. À égalité, l'ordre du catalogue.
 */
export function reactionsComptees(journal: JournalItem[], catalogue: readonly Reaction[]): ReactionComptee[] {
  const comptes = new Map<string, number>()
  for (const i of journal) for (const cle of i.carnet.reactions) comptes.set(cle, (comptes.get(cle) ?? 0) + 1)
  return catalogue
    .flatMap((reaction) => {
      const nombre = comptes.get(reaction.cle) ?? 0
      return nombre > 0 ? [{ ...reaction, nombre }] : []
    })
    .sort((a, b) => b.nombre - a.nombre)
    .slice(0, REACTIONS_MONTREES)
}
