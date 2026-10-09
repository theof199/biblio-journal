import type { CartePostaleEnvoyee, CartePostaleRecue } from '../../../api/voyage'
import type { CarteOuverte } from '../../../voyage/sacoche/Courrier'
import { LIEU } from '../gares'
import { imageDu1900 } from '../images'
import { dateDuTampon } from './frontiere'
import { libelleDeLaPhoto } from './gare'

/**
 * Le courrier dans la sacoche des années 1900 (maquette « Voyage immobile 1900 », écran 15 :
 * `.courrier`, `.pli` ; écran 19 : `.cp` ; plan des écrans des lots, brief 13) : ses mots et ses
 * règles. Sans rendu ni lecture : le dessin est `CourrierDeLaSacoche.tsx`. **Rien ici ne calcule ce
 * que le serveur sert** : l'adresse est `destinataire.pseudo` et `gare_destinataire`, figés à l'envoi.
 */
export const MOTS_DU_COURRIER = {
  titre: 'Le courrier',
  sous: 'les cartes postales',
  vide: 'Aucune carte encore.',
  recues: 'Reçues',
  envoyees: 'Envoyées',
  nouvelle: 'Nouvelle',
  ouverte: {
    titre: 'Carte postale',
    correspondance: 'Correspondance',
    adresse: 'Adresse',
    refermer: 'Refermer la carte',
    timbre: 'Un timbre des Chemins de fer du Voyage',
  },
} as const

type Carte = CartePostaleRecue | CartePostaleEnvoyee

export const gareDe = (annee: number): string => `gare de ${annee}`

/** « De Léa · gare de 1902 » (maquette, l. 2245) : qui l'a écrite, et la gare d'où elle est partie. */
export const enteteDeLaRecue = (carte: Carte): string => `De ${carte.expediteur.pseudo} · ${gareDe(carte.annee)}`

/** « À Léa · gare de 1902 » : l'adresse **servie**, la gare où se trouvait le destinataire à l'envoi. Rien n'y dit si elle a été lue. */
export const enteteDeLEnvoyee = (carte: Carte): string => `À ${carte.destinataire.pseudo} · ${gareDe(carte.gare_destinataire)}`

/**
 * Le recto d'une carte : la photographie de **sa** gare et sa légende, ou rien. 1900 n'a de
 * photographie que pour ses dix gares (`../images.ts`) : une carte partie d'une gare de la foire, ou
 * d'une décennie d'après, n'a que son verso (décision 8), jamais une image cassée. La légende est le
 * lieu de l'image (`LIEU`), pas un titre lu sur une carte d'époque.
 */
export function rectoDe(annee: number): { image: string; legende: string; libelle: string } | null {
  const image = imageDu1900(`g${annee}`)
  const lieu = LIEU[annee]
  if (!image || !lieu) return null
  return { image, legende: `${lieu}. — La gare`, libelle: `${libelleDeLaPhoto('encours', annee)}, au recto de la carte` }
}

/** Le tampon à date (maquette, l. 2328) : la gare d'où la carte est partie (`annee`), et le jour de l'envoi **à Paris**. */
export function tamponADate(carte: Carte): { gare: string; jour: string; annee: string; libelle: string } {
  const date = dateDuTampon(carte.postee_le)
  return { gare: gareDe(carte.annee).toUpperCase(), jour: date.jour, annee: date.annee, libelle: `Tampon à date : ${gareDe(carte.annee)}, ${date.libelle}` }
}

/**
 * Les lignes de l'adresse (maquette, l. 2329 : « Léa », « gare de 1902 », « Couville ») : le pseudo et
 * la gare **tels que servis**, puis le lieu de cette gare si 1900 la connaît. Jamais l'année en cours
 * du destinataire, jamais la gare d'où la carte part.
 */
export function adresseDe(carte: Carte): string[] {
  const lieu = LIEU[carte.gare_destinataire]
  return [carte.destinataire.pseudo, gareDe(carte.gare_destinataire), ...(lieu ? [lieu] : [])]
}

/** Sous la carte ouverte : d'où et quand elle est partie. Une carte envoyée ne dit rien de sa lecture. */
export function ceQueDitLaCarte({ sens, carte }: CarteOuverte): string {
  const { libelle } = dateDuTampon(carte.postee_le)
  return sens === 'recue' ? `${carte.expediteur.pseudo} te l’a postée de la ${gareDe(carte.annee)}, le ${libelle}.` : `Postée de ta ${gareDe(carte.annee)}, le ${libelle}.`
}
