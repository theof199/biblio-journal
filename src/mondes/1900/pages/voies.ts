import type { EtatFilm, Salle } from '../../../api/voyage'
import { acquis, salleComplete } from '../../../voyage/salles'

/**
 * Les mots et les règles des voies d'une gare et de la voiture d'une salle (maquette « Voyage immobile
 * 1900 », écrans 2 et 4), sans rendu. Une salle est une voie de correspondance, numérotée par son
 * rang (`numeroDeLaSalle`, `voyage/salles.ts`, que la page passe : jamais recalculé ici) ; ouverte,
 * une voiture dont chaque film est un compartiment. La maquette nomme des voitures (« voiture-salon »,
 * « fourgon ») que rien ne calcule : elles ne sont pas reprises.
 */
export const MOTS_DES_VOIES = {
  titre: 'Les correspondances',
  sous: 'tes salles',
  composition: 'La composition',
  photo: 'Photographie prise d’un train en marche, le 10 août 1906, près de Foix',
  fermer: 'Retour à la gare',
  sansAffiche: 'sans affiche',
  complete: 'voiture complète',
  seRemplit: 'la voiture se remplit…',
  programme: 'Programme',
} as const

/**
 * Ce qu'une voie dit sous le nom de sa salle : elle est complète, ou elle se remplit ; rien sinon. Une
 * fournée dont le guet a abandonné ne se promet plus : la voiture dit que le chroniqueur n'a pas répondu.
 */
export function mentionDeLaVoie(s: Pick<Salle, 'films' | 'fournee_en_cours'>, abandon: boolean): string | null {
  if (s.fournee_en_cours && !abandon) return MOTS_DES_VOIES.seRemplit
  return salleComplete(s) ? MOTS_DES_VOIES.complete : null
}

/** La lettre d'un compartiment : le rang du film dans sa salle, de A à Z ; au-delà, le rang lui-même. */
export const lettreDuCompartiment = (rang: number): string => (rang >= 1 && rang <= 26 ? String.fromCharCode(64 + rang) : String(rang))

/**
 * La plaque d'un compartiment : occupé par un film vu, libre sinon. Un film introuvable n'occupe rien
 * et n'attend personne : sa plaque porte le mot du monde.
 */
export function plaqueDuCompartiment(etat: EtatFilm, motIntrouvable: string): { mot: string; occupe: boolean } {
  if (etat === 'vu') return { mot: 'occupé', occupe: true }
  return { mot: etat === 'introuvable' ? motIntrouvable : 'libre', occupe: false }
}

/**
 * Ce que la voiture dit sous sa composition : elle part quand plus aucun compartiment n'attend (un
 * introuvable n'attend plus, comme pour la salle complète). Une voiture sans film ne dit rien.
 */
export function phraseDeLaVoiture(s: Pick<Salle, 'films'>): string | null {
  if (s.films.length === 0) return null
  const libres = s.films.filter((f) => !acquis(f)).length
  if (libres === 0) return 'Plus un compartiment libre : la voiture peut partir.'
  return libres === 1 ? 'Encore un compartiment libre : la voiture partira quand il sera occupé.' : `Encore ${libres} compartiments libres : la voiture partira quand ils seront occupés.`
}
