import type { Monde } from '../types'
import { trace1890 } from '../trace'
import { dessinerCiel } from './ciel'
import { dessinerMoyen } from './moyen'
import { dessinerSol } from './sol'
import { dessinerProche } from './proches'
import { dessinerSurLaBrume } from './brume'
import { ELEMENTS } from './chantier'
import { reagir } from './reactions'
import { dessinerAdieu } from './adieu'
import { DATES } from './dates'
import { c, RAMPE } from './couleur'
import { PAGES_1890 } from './pages'

/** Les origines : la baraque foraine en sépia, avec la roulotte (choix du propriétaire, 29 septembre 2026). */
export function creerMonde1890(): Monde {
  return {
    cle: '1890',
    decennie: 1890,
    aVenir: false,
    nom: 'Les origines',
    sous: 'la manivelle',
    chapitre: 'Chapitre I',
    titreVoyageur: 'Spectateur des origines',
    palette: {
      ciel: RAMPE.rgb('#1b1116'), fond: RAMPE.rgb('#3a2a1e'), bas: RAMPE.rgb('#2e2117'),
      cielJour: RAMPE.rgb('#b9a27e'), fondJour: RAMPE.rgb('#a58a64'), basJour: RAMPE.rgb('#6e5a40'),
      cielCrepuscule: [74, 48, 52], fondCrepuscule: [168, 98, 58],
      brume: RAMPE.rgb('#3a3025'), nuage: c('#D8CCB6'), accent: '#D9B382',
      route: { bord: c('#080604'), fond: c('#3a2a1b'), perforations: c('#F0DEBC', 0.6), coeur: c('#1f160e') },
      caseFaite: { dessus: [c('#F1DDB4'), c('#A9864F')], flanc: [c('#6d5332'), c('#2e2213')], plaque: c('#F2E8D5') },
      caseVerrou: { dessus: [c('#3a3027'), c('#231b14')] },
      colonne: null,
      porte: { poteau: c('#20160d'), or: c('#E6B94A'), fond: c('#120c07'), texte: c('#D9B382'), amp: c('#F6D98A'), ampH: c('#F6D98A', 0.25), cadre: c('#E6B94A', 0.35), tampon: c('#E6B94A', 0.85) },
    },
    // Le virage est dans la rampe : un voile sépia de plus teinterait deux fois.
    traitement: { cadence: 16, tremblement: 0.6, scintillement: 0.03, grain: 0.09, virage: null, affiches: 'sepia' },
    couleur: c,
    dates: DATES,
    // La cinématique de 1900 s'achève à `lisse(5, 6.8, u)` (maquette : `cinematique`).
    adieu: 7,
    trace: trace1890,
    dessinerCiel,
    dessinerLointain: () => undefined,
    dessinerMoyen,
    dessinerSol,
    dessinerProche,
    dessinerSurLaBrume,
    // Idée 8 : la caméra du moteur va chercher le chantier qui commence hors de l'écran.
    siteDuChantier: (annee) => ELEMENTS.find((e) => e.annee === annee)?.site[1] ?? null,
    dessinerAdieu,
    reagir,
    pages: PAGES_1890,
  }
}
