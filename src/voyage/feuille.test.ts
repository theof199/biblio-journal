import { describe, expect, it } from 'vitest'
import { paragraphes, partieComposee } from './feuille'

describe('la feuille du chroniqueur', () => {
  // Mutation : `filter(Boolean)` retiré : un texte qui commence ou finit par une ligne vide ferait un paragraphe vide.
  it('découpe le texte aux lignes vides, sans paragraphe vide', () => {
    expect(paragraphes('Un.\n\nDeux.\n  \n\n\nTrois.')).toEqual(['Un.', 'Deux.', 'Trois.'])
    expect(paragraphes('\n\nUn.\n\nDeux.\n\n')).toEqual(['Un.', 'Deux.'])
    expect(paragraphes('Un seul.\nMême ligne suivante.')).toEqual(['Un seul.\nMême ligne suivante.'])
  })

  // Mutation : couper à `limite` sans chercher le blanc couperait un mot en deux.
  it('compose mot à mot jusqu’au premier blanc après la limite', () => {
    const texte = 'abc defghij klm'
    expect(partieComposee(texte, 5)).toBe(11)
    expect(texte.slice(0, partieComposee(texte, 5))).toBe('abc defghij')
  })

  it('compose tout un texte court, ou sans blanc après la limite', () => {
    expect(partieComposee('court', 140)).toBe(5)
    expect(partieComposee('abcdefghij', 3)).toBe(10)
  })
})
