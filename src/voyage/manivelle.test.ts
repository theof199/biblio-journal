import { describe, expect, it } from 'vitest'
import { aLaLachee, angleDuBras, peutTirer, tirage, SEUIL_MANIVELLE, TIRAGE_MAX } from './manivelle'

describe('la manivelle', () => {
  // Mutations : le contenu au doigt près (sans la demi-course) ; sans plafond ; une course négative.
  it('suit le doigt à mi-course, jamais au-delà du plafond ni vers le haut', () => {
    expect(tirage(100)).toBe(50)
    expect(tirage(400)).toBe(TIRAGE_MAX)
    expect(tirage(-30)).toBe(0)
  })

  // Mutation : `>=` au lieu de `>` (la maquette recharge strictement au-delà de 70).
  it('ne recharge qu’au-delà du seuil', () => {
    expect(aLaLachee(SEUIL_MANIVELLE)).toBe('revenir')
    expect(aLaLachee(SEUIL_MANIVELLE + 1)).toBe('recharger')
  })

  it('tourne le bras de quatre degrés par pixel', () => {
    expect(angleDuBras(20)).toBe(80)
  })

  // Mutations : un tirage au milieu de la page (un défilement ordinaire deviendrait un rechargement) ;
  // un second tirage pendant le rechargement.
  it('ne commence qu’en haut de la page, et pas pendant un rechargement', () => {
    expect(peutTirer(0, false)).toBe(true)
    expect(peutTirer(12, false)).toBe(false)
    expect(peutTirer(0, true)).toBe(false)
  })
})
