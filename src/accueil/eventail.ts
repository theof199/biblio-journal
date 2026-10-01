import { candidatEnsuite, metaCandidat } from './ensuite'
import type { CarteEnsuite } from './ensuite'
import type { CibleAccueil } from './fronton'
import type { SeancePrise } from '../api/voyage'

/** Une affiche de l'éventail, avec tout ce que le composant affiche et où elle mène. */
export interface CarteEventail {
  cle: string
  /** La pastille : « Ce soir », « Sur Plex », le nom du réalisateur ou « Saga {nom} ». */
  etiquette: string
  titre: string
  /** Sous le titre : « Voyage 1927 » pour la séance, « Réalisateur · année » (ou l'année seule) pour un film à voir. */
  meta: string
  afficheUrl: string | null
  ceSoir: boolean
  cible: CibleAccueil
}

/** Quatre affiches au plus : de face, à droite, à gauche, derrière — l'éventail n'a pas d'autre place. */
export const MAX_EVENTAIL = 4

export type PlaceEventail = 'avant' | 'droite' | 'gauche' | 'derriere'

const PLACES: readonly PlaceEventail[] = ['avant', 'droite', 'gauche', 'derriere']

function carteSeance(seance: SeancePrise): CarteEventail {
  return {
    cle: `seance-${seance.id}`,
    etiquette: 'Ce soir',
    titre: seance.long.title,
    meta: `Voyage ${seance.annee}`,
    afficheUrl: seance.long.cover_url,
    ceSoir: true,
    cible: { to: '/voyage' },
  }
}

function carteDEnsuite(carte: CarteEnsuite): CarteEventail {
  const { candidat, libelle } = candidatEnsuite(carte)
  return {
    cle: `ensuite-${carte.source}-${candidat.external_id}`,
    etiquette: libelle,
    titre: candidat.title,
    meta: metaCandidat(candidat),
    afficheUrl: candidat.cover_url,
    ceSoir: false,
    cible: { to: '/journal/nouveau', state: { candidat } },
  }
}

/** La séance d'abord quand il y en a une, puis les cartes « Ensuite » dans leur ordre, quatre au plus. */
export function cartesEventail(
  seance: SeancePrise | null | undefined,
  cartes: readonly CarteEnsuite[],
): CarteEventail[] {
  const toutes = [...(seance ? [carteSeance(seance)] : []), ...cartes.map(carteDEnsuite)]
  return toutes.slice(0, MAX_EVENTAIL)
}

/**
 * La place de chaque carte quand celle d'indice `avant` est de face : en tournant depuis elle, la
 * suivante passe à droite, la suivante à gauche, la dernière derrière. Toucher une affiche du
 * fond la ramène donc devant sans changer l'ordre des cartes.
 */
export function placesEventail(nombre: number, avant: number): PlaceEventail[] {
  if (nombre > MAX_EVENTAIL) throw new RangeError(`l'éventail tient ${MAX_EVENTAIL} cartes au plus, pas ${nombre}`)
  return Array.from({ length: nombre }, (_, indice) => PLACES[(((indice - avant) % nombre) + nombre) % nombre]!)
}
