import type { Monde, Palette } from '../types'
import { traceAVenir } from '../trace'
import { dessinerPorte } from '../../carte/dessin/porte'
import { creerRampe } from '../../carte/rampe'
import { PAGES_A_VENIR } from './pages'

const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV']

/** Une rampe grise : le dessin commun (cases, route, avatar) garde ses valeurs, sans teinte. */
const RAMPE = creerRampe([[14, 13, 12], [80, 77, 72], [160, 155, 148], [240, 236, 228]], 0.64)

const PALETTE: Palette = {
  ciel: [14, 13, 12], fond: [24, 22, 20], bas: [30, 27, 24],
  cielJour: [60, 58, 55], fondJour: [80, 76, 70], basJour: [70, 66, 60],
  cielCrepuscule: [44, 38, 40], fondCrepuscule: [70, 60, 58],
  brume: [40, 38, 36], nuage: '#bdb6aa',
  accent: '#9C968C',
  route: { bord: '#080706', fond: '#1c1a17', perforations: 'rgba(220,212,200,.35)', coeur: '#141210' },
  caseFaite: { dessus: ['#e6e0d4', '#9a9386'], flanc: ['#56514a', '#23201c'], plaque: '#e6e0d4' },
  caseVerrou: { dessus: ['#2d2a26', '#171513'] },
  colonne: { fonce: '#1a1917', clair: '#3c3a36', penche: 0 },
  porte: { poteau: '#141311', or: '#9C968C', fond: '#0c0b0a', texte: '#b9b2a6', amp: '#d8d2c6', ampH: 'rgba(216,210,198,.2)', cadre: 'rgba(156,150,140,.35)', tampon: 'rgba(156,150,140,.85)' },
}

/**
 * Le monde « à venir » (décision du 28 septembre 2026) : toute décennie qui n'a pas encore son
 * chantier. Neutre et sans décor : une route grise sous la brume, une porte qui dit la décennie.
 * Les années y gardent leur vrai état si le Voyage y arrive avant le chantier de leur monde.
 */
export function mondeAVenir(decennie: number): Monde {
  const rang = (decennie - 1890) / 10
  return {
    cle: `avenir-${decennie}`,
    decennie,
    aVenir: true,
    nom: `Années ${decennie}`,
    sous: 'à venir',
    chapitre: ROMAINS[rang] ? `Chapitre ${ROMAINS[rang]}` : null,
    titreVoyageur: null,
    palette: PALETTE,
    traitement: { cadence: null, tremblement: 0, scintillement: 0, grain: 0.05, virage: null, affiches: 'gris' },
    couleur: RAMPE.couleur,
    dates: [],
    adieu: 0,
    trace: traceAVenir,
    dessinerCiel: () => undefined,
    dessinerLointain: () => undefined,
    dessinerMoyen: () => undefined,
    dessinerSol: (v, porte) => dessinerPorte(v, porte, `ANNÉES ${decennie}`, 'À VENIR', PALETTE.porte),
    dessinerProche: () => undefined,
    dessinerSurLaBrume: () => undefined,
    siteDuChantier: () => null,
    dessinerAdieu: () => undefined,
    reagir: () => undefined,
    pages: PAGES_A_VENIR,
  }
}
