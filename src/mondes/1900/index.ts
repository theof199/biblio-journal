import type { Monde } from '../types'
import { PAGES_A_VENIR } from '../avenir/pages'
import { dessinerCiel } from './ciel'
import { dessinerLointain } from './lointain'
import { dessinerMoyen, ecranDeLaCase } from './gares'
import { dessinerProche, dessinerSol } from './sol'
import { dessinerSuivi } from './suivi'
import { dessinerBande } from './bande'
import { DATES } from './depeches'
import { BOBINES } from './bobines'
import { ROULEMENT } from './roulement'
import { c, RAMPE } from './couleur'
import { ARRETS, trace1900 } from './trace'

/**
 * Le voyage immobile : le Panorama transsibérien de l'Exposition de 1900, quatre toiles qui défilent
 * derrière la vitre d'un train qui ne bouge pas (maquette « Voyage immobile 1900 », idées 50 à 54 et
 * 62). La section est collante : rien n'y glisse, tout se tire de `VueMonde.avance`.
 *
 * Le monde ne lit ni `VueMonde.nuit` ni `VueMonde.lum` et n'appelle pas `v.feu` : son heure sera
 * celle de la gare (tâche 11b), jamais celle du visiteur.
 */
export function creerMonde1900(): Monde {
  return {
    cle: '1900',
    decennie: 1900,
    aVenir: false,
    nom: 'Le voyage immobile',
    sous: 'le train',
    chapitre: 'Chapitre II',
    titreVoyageur: 'Spectateur du voyage immobile',
    // Le ciel de la vitre (maquette : `.ciel`), le même à toute heure : celui du visiteur ne teinte
    // pas ce que le moteur mêle sous les toiles.
    palette: {
      ciel: RAMPE.rgb('#b9b7a6'), fond: RAMPE.rgb('#ddd3bb'), bas: RAMPE.rgb('#8f7d61'),
      cielJour: RAMPE.rgb('#b9b7a6'), fondJour: RAMPE.rgb('#ddd3bb'), basJour: RAMPE.rgb('#8f7d61'),
      cielCrepuscule: RAMPE.rgb('#b9b7a6'), fondCrepuscule: RAMPE.rgb('#ddd3bb'),
      brume: RAMPE.rgb('#3e3a35'), nuage: c('#d3cab7'), accent: '#c9a257',
      route: { bord: c('#18100a'), fond: c('#3c2f22'), perforations: c('#b9b2a2', 0.6), coeur: c('#221910') },
      caseFaite: { dessus: [c('#eee4cf'), c('#c9a257')], flanc: [c('#5f5040'), c('#221910')], plaque: c('#f4efe2') },
      caseVerrou: { dessus: [c('#3e3a35'), c('#221910')] },
      colonne: null,
      porte: { poteau: c('#2b1d13'), or: c('#c9a257'), fond: c('#15110d'), texte: c('#eee4cf'), amp: c('#e2b23c'), ampH: c('#e2b23c', 0.25), cadre: c('#c9a257', 0.35), tampon: c('#c9a257', 0.85) },
    },
    // Le virage des photographies est dans les fichiers ; le décor n'a pas de cadence : l'horloge
    // du développement d'une plaque (`VueMonde.ouverte`) est celle du moteur.
    traitement: { cadence: null, tremblement: 0, scintillement: 0, grain: 0.06, virage: null, affiches: 'couleur' },
    couleur: c,
    dates: DATES,
    // Le monde s'en va sans rien dire : son adieu viendra avec les années 1910.
    adieu: 0,
    trace: trace1900,
    dessinerCiel,
    dessinerLointain,
    dessinerMoyen,
    dessinerSol,
    dessinerProche,
    dessinerSurLaBrume: () => undefined,
    // Rien ne se bâtit en 1900 : une visée arrêterait le roulement vers la gare.
    siteDuChantier: () => null,
    dessinerAdieu: () => undefined,
    // Aucun toucher du décor ne sonne ni ne s'anime (décision 4 de la spec).
    reagir: () => undefined,
    // Les pages de 1900 restent celles du monde « à venir » : leur habillage est un autre lot.
    pages: PAGES_A_VENIR,
    musique: ROULEMENT,
    bobines: BOBINES,
    scene: {
      ecranDeLaCase,
      dessinerSuivi,
      dessinerBande,
      // Le passage de la foire au train : tâche 12.
      entree: [],
      arrets: ARRETS,
    },
  }
}
