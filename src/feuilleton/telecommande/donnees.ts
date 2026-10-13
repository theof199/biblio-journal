import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireLaTelecommande, lireLesMembres, type CarteDeSerie, type Telecommande } from '../../api/feuilleton'

/**
 * Ce que la télécommande sait : une lecture, `GET /me/feuilleton/telecommande`, faite **au montage du
 * Feuilleton** (le point du bouton rond en dépend) et qui sert d'avance au panneau, sous la même clé.
 * Ici : cette lecture, et les fonctions pures qui lisent ou réécrivent sa réponse dans le cache. Les
 * écritures (« Vu », « Annuler », les portées, les invitations) sont dans `vivante.ts`, chargé avec le
 * panneau. Les vues suivantes (la liste, le « vu à deux ») lisent ici, pas l'API.
 */

/** La lecture de la télécommande : un seul cache, quel que soit le nombre de ses lecteurs. */
export function useLaTelecommande() {
  return useQuery({ queryKey: cles.telecommande, queryFn: ({ signal }) => lireLaTelecommande(signal) })
}

/**
 * Les membres, pour le « vu à deux » : lus **à l'ouverture de la vue** (c'est elle qui appelle ce crochet),
 * jamais au montage du Feuilleton. Qui s'en sert retire l'appelant.
 */
export function useLesMembres() {
  return useQuery({ queryKey: cles.membresDuFeuilleton, queryFn: ({ signal }) => lireLesMembres(signal) })
}

/** Une invitation « vu à deux » m'attend-elle ? Le point rouge du bouton rond et le voyant du panneau. */
export function useInvitationEnAttente(): boolean {
  return (useLaTelecommande().data?.a_confirmer.length ?? 0) > 0
}

/** « En cours » : `series` sans celles en pause, dans l'ordre de l'API (le dernier visionnage d'abord). */
export const seriesEnCours = (telecommande: Telecommande): CarteDeSerie[] => telecommande.series.filter((serie) => !serie.en_pause)

/** « En pause » : le reste, dans le même ordre. */
export const seriesEnPause = (telecommande: Telecommande): CarteDeSerie[] => telecommande.series.filter((serie) => serie.en_pause)

const instant = (carte: CarteDeSerie) => Date.parse(carte.dernier_visionnage_le)

/**
 * Pose une carte que l'API vient de rendre (une portée, une confirmation) : elle remplace celle de la
 * série, à la place que lui donne sa date parmi des cartes déjà triées (aucun tri n'est refait) ; une
 * série inconnue entre de même. **Une carte `finie` sort** : la série a quitté « En cours ».
 */
export function poserLaCarte(telecommande: Telecommande, carte: CarteDeSerie): Telecommande {
  const autres = telecommande.series.filter((serie) => serie.id !== carte.id)
  if (carte.finie) return { ...telecommande, series: autres }
  const place = autres.findIndex((serie) => instant(serie) < instant(carte))
  const rang = place === -1 ? autres.length : place
  return { ...telecommande, series: [...autres.slice(0, rang), carte, ...autres.slice(rang)] }
}

/**
 * Ce que « Vu » écrit d'avance : la carte de la série affiche `ensuite` à la place de `prochain`, compte
 * un épisode de plus, vient d'être regardée (elle passe en tête, hors pause). Sans `ensuite`, elle est
 * à jour jusqu'à la relecture, qui seule dit l'épisode d'après, ou que la série est finie.
 */
export function avancer(telecommande: Telecommande, serieId: string, maintenant: Date): Telecommande {
  const carte = telecommande.series.find((serie) => serie.id === serieId)
  if (!carte?.prochain) return telecommande
  const avancee: CarteDeSerie = {
    ...carte,
    prochain: carte.ensuite,
    ensuite: null,
    a_jour: carte.ensuite === null,
    progression: { ...carte.progression, checked: carte.progression.checked + 1 },
    dernier_visionnage_le: maintenant.toISOString(),
    repere: 'visionnage',
    en_pause: false,
  }
  return { ...telecommande, series: [avancee, ...telecommande.series.filter((serie) => serie.id !== serieId)] }
}

/** Une invitation traitée (confirmée, refusée, expirée, retirée) quitte `a_confirmer`. */
export function retirerLInvitation(telecommande: Telecommande, id: string): Telecommande {
  return { ...telecommande, a_confirmer: telecommande.a_confirmer.filter((invitation) => invitation.id !== id) }
}

const JOUR_A_PARIS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
const HEURE_A_PARIS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' })
const JOUR_EN_LETTRES = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' })

/** Le rang du jour de Paris d'un instant (un jour civil, pas vingt-quatre heures). */
const jourDeParis = (date: Date) => Date.parse(`${JOUR_A_PARIS.format(date)}T00:00:00Z`) / 86_400_000

/** Le soir commence à 18 h, comme la Maison (`espaces.ts`). */
const HEURE_DU_SOIR = 18
const A_L_INSTANT = 60 * 60 * 1000

/**
 * « Regardée hier soir », « Ajoutée aujourd'hui », « Proposé il y a 3 jours » : quand, en jours civils
 * **de Paris**, quel que soit le fuseau de l'appareil. Moins d'une heure : « à l'instant » ; le même
 * jour : « aujourd'hui » ; la veille : « hier », « hier soir » à partir de 18 h ; au-delà, « il y a n
 * jours ». Une date à venir (une horloge en avance) se dit « à l'instant ».
 */
export function direQuand(verbe: string, iso: string, maintenant: Date): string {
  const date = new Date(iso)
  if (maintenant.getTime() - date.getTime() < A_L_INSTANT) return `${verbe} à l’instant`
  const jours = jourDeParis(maintenant) - jourDeParis(date)
  if (jours <= 0) return `${verbe} aujourd’hui`
  if (jours === 1) return Number(HEURE_A_PARIS.format(date)) >= HEURE_DU_SOIR ? `${verbe} hier soir` : `${verbe} hier`
  return `${verbe} il y a ${jours} jours`
}

/** Le pied de l'écran d'une série. `repere: suivi` : rien n'a été vu, la date est celle de l'ajout au suivi. */
export const direQuandLaSerie = (carte: CarteDeSerie, maintenant: Date): string =>
  direQuand(carte.repere === 'suivi' ? 'Ajoutée' : 'Regardée', carte.dernier_visionnage_le, maintenant)

/** « 21 octobre », d'un jour `AAAA-MM-JJ` (une date de diffusion : un jour, sans heure ni fuseau). */
export const jourEnLettres = (jour: string): string => JOUR_EN_LETTRES.format(new Date(`${jour}T00:00:00Z`))
