import type { Progression } from '../../api/voyage'
import { estUnPalier, type Avancee, type CleBillet } from '../annee'

/**
 * Le retour d'un billet sur la fiche de son année (plan 2b, tâche 11) : ce que le billet confie à
 * l'année en y revenant, et ce que l'année en fait — les billets gagnés qui roulent, l'annonce, le
 * palier qui fait vibrer. Sans rendu.
 */

/** La progression lue dans la fiche en cache avant l'écriture : de quoi dire ce qui a bougé. */
export interface Avant {
  profondeur: number
  progression: Progression | null
}

/** Ce que le billet confie à l'année : l'avant, et le verdict à guetter (au compte IA, après une création). */
export interface Retour {
  avant: Avant | null
  guet: { depuis: string | null } | null
}

/**
 * L'état de navigation d'un billet ouvert depuis la fiche de son année (la séance) : l'année est
 * alors l'entrée juste derrière lui, et « revenir à l'année » recule au lieu d'empiler une seconde
 * fois la même page. Ouvert depuis la fiche d'un film, le billet est remplacé par l'année.
 */
export interface EtatBillet {
  depuis?: 'annee'
}

/**
 * Le retour en attente, confié par le billet juste avant de naviguer. Pas dans l'état de navigation :
 * reculer vers l'année (`navigate(-1)`) n'en porte aucun, et le consommer par un `replace` ferait
 * repartir la page du haut (`coque/defilement.ts`). Pris une fois par la fiche de cette année : ni un
 * rechargement ni le retour suivant ne le rejouent.
 *
 * L'année se monte dans la foulée du billet ; un retour que rien n'a pris (une navigation qui n'a pas
 * mené à l'année) ne doit pas se jouer plus tard, ni chez un autre membre connecté entre-temps sur le
 * même onglet : il ne vaut que pour le membre qui a composté, et `DUREE_DU_RETOUR_MS` au plus.
 */
let confie: { annee: number; membre: string; le: number; retour: Retour } | null = null

/** Le temps laissé à l'année pour se monter après le billet : large devant une navigation, court devant une visite. */
export const DUREE_DU_RETOUR_MS = 30_000

export function confierLeRetour(annee: number, membre: string, retour: Retour): void {
  confie = { annee, membre, le: Date.now(), retour }
}

/**
 * Lu sans être pris : l'initialiseur d'un `useState` peut s'appeler deux fois (`StrictMode`), et le
 * second ne doit pas lire un retour déjà effacé. La page l'oublie une fois montée (`oublierLeRetour`).
 */
export const retourConfie = (annee: number, membre: string): Retour | null =>
  confie !== null && confie.annee === annee && confie.membre === membre && Date.now() - confie.le <= DUREE_DU_RETOUR_MS ? confie.retour : null

export function oublierLeRetour(annee: number): void {
  if (confie !== null && confie.annee === annee) confie = null
}

const LIBELLES: Record<CleBillet, [string, string]> = {
  films: ['film vu', 'films vus'],
  essentiels: ['essentiel', 'essentiels'],
  salles: ['salle complète', 'salles complètes'],
}

/** L'annonce du retour, pour la région d'état : « +1 film vu », « +1 film vu, +1 essentiel ». */
export function annonceDesAvancees(liste: readonly Avancee[]): string {
  return liste
    .map((a) => {
      const n = a.apres - a.avant
      return `+${n} ${LIBELLES[a.cle][n > 1 ? 1 : 0]}`
    })
    .join(', ')
}

/**
 * Une avancée franchit-elle un palier (l'Ours, le Lion, la Palme) ? Chaque valeur franchie compte, pas
 * seulement l'arrivée : deux films d'un coup, de 2 à 4, passent l'Ours à 3.
 */
export function franchitUnPalier(liste: readonly Avancee[], progression: Progression | null): boolean {
  return liste.some((a) => {
    for (let v = a.avant + 1; v <= a.apres; v += 1) if (estUnPalier(a.cle, v, progression)) return true
    return false
  })
}
