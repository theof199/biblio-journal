import type { Recompense } from '../../../api/voyage'
import type { ArretDeLaLigne } from '../../../voyage/decennie'
import { RATTRAPE } from '../../../voyage/regles'
import type { MotsDesPages } from '../../types'
import { LIEU } from '../gares'
import { rangDeLaGare } from './gare'

/**
 * Les mots et les règles de la ligne des années 1900 (maquette, écran 1), sans rendu. Rien ne s'y
 * compte : tout vient des arrêts que la page passe (`arrets`, `voyage/decennie.ts`).
 */
export const MOTS_DE_LA_LIGNE = {
  affiche: 'Affiche de l’Exposition de 1900 : le Transsibérien, panorama mouvant, de Moscou à Pékin',
  parcours: 'de l’Exposition au Kinemacolor',
  sous: 'tes dix années',
  liste: 'Les arrêts de la ligne',
  ici: 'tu es ici',
  yEst: 'y est',
  plaque: 'plaque',
  aDevelopper: 'à développer',
  bouclee: 'Bouclée',
  enCours: 'en cours',
  chercher: 'chercher',
  liens: 'Le casier et le guichet',
} as const

const RECOMPENSE: Readonly<Record<Recompense, string>> = { ours: 'Ours', lion: 'Lion', palme: 'Palme' }
const NOMBRES = ['aucune', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'] as const
const enLettres = (n: number): string => NOMBRES[n] ?? String(n)
const vus = (n: number): string => `${n} vu${n > 1 ? 's' : ''}`

/** L'année en heure (maquette : « 19.04 ») : le siècle en heures, l'année en minutes. */
export const heureDeLArret = (annee: number): string => `${Math.floor(annee / 100)}.${String(annee % 100).padStart(2, '0')}`

/**
 * Le lieu d'un arrêt et ce qui s'y tient : le voyageur suivi quand son Voyage y est, « tu es ici »
 * sur mon année en cours (et « tu le rattrapes bientôt » derrière lui), « plaque » sur une année
 * fermée, ses films vus en avance, et ce que dit une année en attente du Voyage suivi (`tropLent`,
 * nul sans voyageur suivi : rien ne se dit alors de personne).
 */
export function lieuDeLArret(l: ArretDeLaLigne, o: { depart: number; tropLent: string | null; rattrape: boolean; enAvance: string }): string {
  const parts = [LIEU[l.annee] ?? `Gare de ${l.annee}`]
  if (l.suivi !== null) parts.push(`${l.suivi} ${MOTS_DE_LA_LIGNE.yEst}`)
  if (!l.ouvrable) {
    if (l.annee >= o.depart) parts.push(MOTS_DE_LA_LIGNE.plaque)
  } else if (l.attente) {
    if (o.tropLent) parts.push(o.tropLent)
  } else if (l.fermee) parts.push(l.enAvance ? `${vus(l.vus)} ${o.enAvance}` : MOTS_DE_LA_LIGNE.plaque)
  else if (l.enCours) {
    parts.push(MOTS_DE_LA_LIGNE.ici)
    if (o.rattrape) parts.push(RATTRAPE.toLowerCase())
  }
  return parts.join(' · ')
}

/**
 * L'état d'un arrêt (maquette : `.arret .e`) : la récompense, « Bouclée », le compte de l'année en
 * cours, « à développer ». Une année en attente dit « Voie fermée », jamais « en cours » ni son
 * compte ; une année d'avant le départ ne dit rien.
 */
export function etatDeLArret(l: ArretDeLaLigne, depart: number, mots: MotsDesPages): string {
  if (!l.ouvrable) return l.annee >= depart ? MOTS_DE_LA_LIGNE.aDevelopper : ''
  if (l.attente) return mots.annonce.attente
  const recompense = l.recompense ? RECOMPENSE[l.recompense] : null
  if (l.fermee) return recompense ?? MOTS_DE_LA_LIGNE.aDevelopper
  if (l.enCours && !l.bouclee) {
    const parts = [recompense, l.compte ? `${l.compte.vus} sur ${l.compte.total}` : null].filter((p) => p !== null)
    return parts.length > 0 ? parts.join(' · ') : MOTS_DE_LA_LIGNE.enCours
  }
  return recompense ?? (l.bouclee ? MOTS_DE_LA_LIGNE.bouclee : '')
}

/**
 * La phrase de tête : combien de gares la ligne compte, combien sont passées (bouclées), et laquelle
 * est ouverte. Aucun nombre n'y est écrit d'avance.
 */
export function phraseDeLaLigne(arrets: readonly ArretDeLaLigne[]): string {
  const total = `${enLettres(arrets.length).replace(/^./, (c) => c.toUpperCase())} gares, ${MOTS_DE_LA_LIGNE.parcours}.`
  const passees = arrets.filter((a) => a.bouclee).length
  const ouverte = arrets.find((a) => a.enCours && !a.bouclee)
  if (passees === arrets.length) return `${total} Tu as passé les ${enLettres(passees)} gares.`
  const fait = passees === 0 ? 'Tu n’as encore passé aucune gare' : `Tu as passé ${enLettres(passees)} gare${passees > 1 ? 's' : ''}`
  return ouverte ? `${total} ${fait} ; la ${rangDeLaGare(ouverte.annee).toLowerCase()} est ouverte.` : `${total} ${fait}.`
}

/** Le compte d'un lien : mes billets au casier ; rien tant qu'il n'est pas lu. */
export const compteDuLien = (n: number | null): string => (n === null ? '' : n === 0 ? 'aucun billet' : `${n} billet${n > 1 ? 's' : ''}`)
