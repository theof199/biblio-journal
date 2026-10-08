import type { ObjetRamasse } from '../../../api/voyage'
import { OBJETS, type ObjetTrouve } from '../objets'

/**
 * La consigne des objets trouvés dans la sacoche des années 1900 (maquette, écran 15 : `.trouves`,
 * `rangerObjets`, l. 3922-3933 ; plan des écrans des lots, brief 3) : ses places, ce qu'elles disent
 * et leur compte. Sans rendu ni lecture : le dessin est `ObjetsDeLaSacoche.tsx`, le catalogue
 * `../objets.ts`.
 */
export const MOTS_DE_LA_CONSIGNE = {
  titre: 'Les objets trouvés',
  aTrouver: 'à trouver',
} as const

/** Une place de la consigne : l'objet du catalogue, et s'il y pend. */
export type PlaceDeConsigne = { objet: ObjetTrouve; ramasse: boolean }

/**
 * Les places de la consigne : **une par objet du catalogue, dans son ordre** (celui des années), quoi
 * que le serveur serve. Un objet y pend si sa clé est servie ; une clé servie que le catalogue ne
 * connaît pas n'a pas de place, et ne se compte donc pas.
 */
export const placesDeConsigne = (servis: readonly Pick<ObjetRamasse, 'cle'>[], catalogue: readonly ObjetTrouve[] = OBJETS): PlaceDeConsigne[] =>
  catalogue.map((objet) => ({ objet, ramasse: servis.some((s) => s.cle === objet.cle) }))

/** « 2 sur 10 » : les places où un objet pend, sur toutes celles du catalogue. Jamais la longueur de la réponse, jamais dix en dur. */
export const compteDeLaConsigne = (places: readonly PlaceDeConsigne[]): string => `${places.filter((p) => p.ramasse).length} sur ${places.length}`

/**
 * Le nom lu d'une place (maquette, l. 3929) : « 1900 : une lanterne de chef de gare, dans la sacoche »,
 * ou « 1903 : un objet à trouver en gare ». **Une place vide ne nomme pas son objet** : on le
 * découvre en le ramassant.
 */
export const nomLuDeLaConsigne = ({ objet, ramasse }: PlaceDeConsigne): string => (ramasse ? `${objet.annee} : ${objet.nom}, dans la sacoche` : `${objet.annee} : un objet à trouver en gare`)
