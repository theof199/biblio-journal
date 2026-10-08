import { vi } from 'vitest'
import type { FabriqueMoteur, Moteur } from '../carte/CarteCanvas'
import type { EtatCarte, Rappels } from '../carte/moteur'

/** Un moteur qui ne dessine rien : il note ce qu'on lui demande et laisse le test jouer ses rappels. */
export function moteurFactice() {
  const etats: EtatCarte[] = []
  let rappels: Rappels | null = null
  // `glissePris` se lit seulement sur le vrai moteur : ici le test l'écrit.
  const moteur: { -readonly [C in keyof Moteur]: Moteur[C] } = {
    mesurer: vi.fn(),
    hauteur: 0,
    defiler: vi.fn(),
    majEtat: vi.fn((e: EtatCarte) => void etats.push(e)),
    reglerCalme: vi.fn(),
    reglerVisible: vi.fn(),
    pointeur: vi.fn(),
    pincer: vi.fn(() => false),
    glissePris: false,
    doigtsPoses: vi.fn(),
    allerIci: vi.fn(),
    basculerEnsemble: vi.fn(),
    marcher: vi.fn(async () => undefined),
    passerLaPorte: vi.fn(async () => undefined),
    direAdieu: vi.fn(async () => undefined),
    direBonjour: vi.fn(async () => undefined),
    claquer: vi.fn(),
    ouvrirSousLesYeux: vi.fn(),
    ecranDeLAnnee: vi.fn(() => ({ x: 100, y: 100 })),
    reglerBobines: vi.fn(),
    reglerObjets: vi.fn(),
    rendreObjet: vi.fn(),
    detruire: vi.fn(),
  }
  const fabrique: FabriqueMoteur = (_canvas, r) => {
    rappels = r
    return moteur
  }
  return {
    moteur,
    fabrique,
    etats,
    rappels: () => {
      if (!rappels) throw new Error('le moteur n’est pas monté')
      return rappels
    },
  }
}
