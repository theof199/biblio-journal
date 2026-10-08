import type { FilmDeHalte } from '../../../api/voyage'
import { etiquetteEtat } from '../../../voyage/salles'

/**
 * Les mots et les règles d'une halte ouverte sur la carte de 1900 (maquette « Voyage immobile 1900 »,
 * `#halte`, l. 1617-1618 et 4017-4019), sans rendu. La maquette écrit « trois films » et n'a que deux
 * états, « vu » et « à voir » : ici le compte se dit sur ce qui est servi, et l'état par les mots d'un
 * film de salle (`etiquetteEtat`, les cinq du contrat). Le nom de la halte est celui du serveur.
 */
export const MOTS_DE_LA_HALTE = {
  horsLigne: 'hors ligne · embranchement',
  sansAffiche: 'sans affiche',
  plex: 'Voir sur le Plex',
  revenir: 'Revenir sur la ligne',
} as const

/** L'entête de l'indicateur : « Halte · 3 films », au nombre de films servis. */
export const enteteDeLaHalte = (total: number): string => `Halte · ${total === 0 ? 'aucun film' : `${total} film${total > 1 ? 's' : ''}`}`

/** Le compte, « 2 sur 3 » : les films vus sur ceux que le serveur sert. */
export const compteDit = (compte: { vus: number; total: number }): string => `${compte.vus} sur ${compte.total}`

/** Le nom lu du compte, pour qui ne voit pas l'indicateur. */
export const compteLu = (compte: { vus: number; total: number }): string => `${compte.vus} vu${compte.vus > 1 ? 's' : ''} sur ${compte.total}`

/** L'état d'un film de la halte, par les mots d'un film de salle : un introuvable ne se dit jamais « à voir ». */
export const etatDit = (film: Pick<FilmDeHalte, 'etat'>, motIntrouvable: string): string => etiquetteEtat(film.etat, motIntrouvable)

/** Le nom du lien Plex d'un film, qui dit lequel. */
export const plexDe = (film: Pick<FilmDeHalte, 'title'>): string => `${MOTS_DE_LA_HALTE.plex} : ${film.title}`
