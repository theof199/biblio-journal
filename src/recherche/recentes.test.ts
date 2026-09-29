import { describe, expect, it } from 'vitest'
import { ajouterRechercheRecente, ecrireRecherchesRecentes, lireRecherchesRecentes } from './recentes'

describe('ajouterRechercheRecente', () => {
  it('met la nouvelle requête en tête', () => {
    expect(ajouterRechercheRecente(['alien'], 'dune')).toEqual(['dune', 'alien'])
  })

  it('retire le doublon insensible à la casse plutôt que de le répéter', () => {
    expect(ajouterRechercheRecente(['Dune', 'alien'], 'dune')).toEqual(['dune', 'alien'])
  })

  it('plafonne à 10 par défaut', () => {
    const existantes = Array.from({ length: 10 }, (_, i) => `film ${i}`)
    const resultat = ajouterRechercheRecente(existantes, 'nouveau')
    expect(resultat).toHaveLength(10)
    expect(resultat[0]).toBe('nouveau')
    expect(resultat).not.toContain('film 9')

    // Mutation : sans le plafond, la liste grandirait sans fin.
    expect(ajouterRechercheRecente(existantes, 'nouveau', 3)).toHaveLength(3)
  })

  it('ignore une requête vide ou blanche', () => {
    expect(ajouterRechercheRecente(['alien'], '   ')).toEqual(['alien'])
  })

  it('nettoie les espaces en trop', () => {
    expect(ajouterRechercheRecente([], '  dune  ')).toEqual(['dune'])
  })
})

describe('le stockage local', () => {
  it('lit ce qui a été écrit', () => {
    ecrireRecherchesRecentes(['alien', 'dune'])
    expect(lireRecherchesRecentes()).toEqual(['alien', 'dune'])
  })

  it('rend une liste vide sans rien avoir écrit', () => {
    window.localStorage.clear()
    expect(lireRecherchesRecentes()).toEqual([])
  })

  it('ne casse pas sur une valeur corrompue', () => {
    window.localStorage.setItem('journal.recherches-recentes', '{not json')
    expect(lireRecherchesRecentes()).toEqual([])
  })
})
