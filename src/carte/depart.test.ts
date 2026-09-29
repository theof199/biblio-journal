import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BAS_MASQUE, HAUT_MASQUE, MoteurCarte, type CaseCarte, type Rappels } from './moteur'
import { contexteFactice } from '../test/contexteFactice'
import { creerRegistre } from '../mondes'

/**
 * Le moteur réel, sur les vrais mondes : où tombe l'avatar à l'écran quand la carte s'ouvre. Un
 * téléphone de 720 px moins la barre d'onglets (60) : 660, ramené ici à 650 comme la mesure.
 */
function ouvrir(annee: number, H: number) {
  const defile: number[] = []
  const visible = vi.fn()
  const rappels: Rappels = { toucherAnnee() {}, apercu() {}, finApercu() {}, ensemble() {}, defilerVers: (y) => void defile.push(y), date() {}, roulotte() {}, avatarVisible: visible }
  const moteur = new MoteurCarte({ width: 0, height: 0, getContext: () => contexteFactice().ctx }, rappels, {
    creerToile: (w, h) => ({ width: w, height: h, getContext: () => contexteFactice().ctx }),
    image: () => null,
    demanderImage: () => 1,
    annulerImage: () => undefined,
    heure: () => 12,
    mondeDe: creerRegistre(),
  })
  moteur.mesurer(390, H, 2)
  const cases: CaseCarte[] = Array.from({ length: 2026 - 1895 + 1 }, (_, i) => ({ annee: 1895 + i, etat: 'lion', attente: false, profondeur: 4, jauge: null, affiches: [] }))
  moteur.majEtat({ cases, anneeAvatar: annee, tampons: [], roulotte: null })
  // Comme `CarteCanvas` à l'ouverture : la caméra est posée sur l'avatar, sans glisser.
  moteur.allerIci(true)
  moteur.defiler(defile[defile.length - 1] ?? 0)
  return { moteur, visible }
}

describe('l’ouverture de la carte', () => {
  beforeEach(() => vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} }))
  afterEach(() => vi.unstubAllGlobals())

  // Mutations : `MARGE_HAUT` ramenée à 0 (`placement.ts`) : en 1895 la caméra, bornée à 0, laisse
  // l'avatar à 150 px du haut, sous le bandeau ; le `0.52` de `cibleCamera` ramené à 0.1 : les
  // années du milieu remontent l'avatar au ras du bandeau.
  it.each([
    ['la première année', 1895],
    ['la deuxième', 1896],
    ['le milieu de la carte', 1960],
    ['la dernière', 2026],
  ])('montre l’avatar entre le tiers haut et les trois quarts de l’écran : %s', (_, annee) => {
    for (const H of [560, 650, 800]) {
      const y = ouvrir(annee, H).moteur.ecranDeLAnnee(annee).y
      expect(y).toBeGreaterThan(H * 0.38)
      expect(y).toBeLessThan(H * 0.75)
    }
  })

  // Mutation : le seuil `HAUT_MASQUE` retiré de `signalerAvatar` : l'avatar sous le bandeau
  // compterait comme vu.
  it('dit à la page que l’avatar est vu à l’ouverture, puis qu’il ne l’est plus quand on s’en éloigne', () => {
    const { moteur, visible } = ouvrir(1895, 650)
    moteur.image(1000)
    expect(visible).toHaveBeenCalledTimes(1)
    expect(visible).toHaveBeenLastCalledWith(true)
    moteur.image(1050)
    expect(visible).toHaveBeenCalledTimes(1)
    const y = moteur.ecranDeLAnnee(1895).y
    moteur.defiler(y - HAUT_MASQUE + 10)
    moteur.image(1100)
    expect(visible).toHaveBeenLastCalledWith(false)
    moteur.defiler(y - 300)
    moteur.image(1150)
    expect(visible).toHaveBeenLastCalledWith(true)
    moteur.defiler(y - 650 + BAS_MASQUE - 10)
    moteur.image(1200)
    expect(visible).toHaveBeenLastCalledWith(false)
    moteur.defiler(y - 300)
    moteur.image(1250)
    expect(visible).toHaveBeenLastCalledWith(true)
    expect(visible).toHaveBeenCalledTimes(5)
  })
})
