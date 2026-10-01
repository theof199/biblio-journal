import { describe, expect, it } from 'vitest'
import { lignesDeTitre, longueurDeLecture } from './titre'

describe('lignesDeTitre', () => {
  it('garde un titre court sur une seule ligne de grandes lettres', () => {
    expect(lignesDeTitre('Casablanca', 11)).toEqual([{ texte: 'Casablanca', compacte: false }])
  })

  it('passe un titre long sur deux lignes compactes, coupées à l’espace qui les équilibre', () => {
    expect(lignesDeTitre('Le Mécano de la « General »', 11)).toEqual([
      { texte: 'Le Mécano de', compacte: true },
      { texte: 'la « General »', compacte: true },
    ])
  })

  it('ne coupe jamais un mot : un titre long sans espace reste sur une ligne compacte', () => {
    expect(lignesDeTitre('Anticonstitutionnellement', 11)).toEqual([{ texte: 'Anticonstitutionnellement', compacte: true }])
  })

  it('suit la longueur maximale qu’on lui donne', () => {
    expect(lignesDeTitre('King Kong', 6)).toHaveLength(2)
    expect(lignesDeTitre('King Kong', 9)).toHaveLength(1)
  })
})

describe('longueurDeLecture', () => {
  it('prend la plus longue des lignes compactes', () => {
    expect(longueurDeLecture([{ texte: 'Le Mécano de', compacte: true }, { texte: 'la', compacte: true }])).toBe(12)
  })

  it('ignore une ligne de grandes lettres', () => {
    expect(longueurDeLecture([{ texte: 'Metropolis', compacte: false }])).toBe(1)
  })
})
