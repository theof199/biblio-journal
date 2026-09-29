import { describe, expect, it } from 'vitest'
import { brouillonInitial, construirePatch } from './patch'
import { exemple } from '../test/contrat'
import type { JournalItem, JournalPage } from '../api/journal'

const original: JournalItem = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

describe('construirePatch', () => {
  it('ne porte que les champs qui ont changé', () => {
    const brouillon = brouillonInitial(original)
    expect(construirePatch(original, brouillon)).toEqual({})

    // Mutation : sans le test ci-dessus, un corps qui recopierait tout resterait indétecté.
    expect(construirePatch(original, { ...brouillon, date: '2020-01-01' })).toEqual({ finished_at: '2020-01-01' })
  })

  it('envoie `rating: null` pour effacer la note, jamais `undefined`', () => {
    const brouillon = brouillonInitial(original)
    const corps = construirePatch(original, { ...brouillon, note: null })
    expect(corps).toEqual({ rating: null })
    expect('rating' in corps).toBe(true)
  })

  it('compare les réactions comme un ensemble, pas comme une liste ordonnée', () => {
    const brouillon = brouillonInitial(original)
    const reordonnees = [...original.carnet.reactions].reverse()
    expect(construirePatch(original, { ...brouillon, reactions: reordonnees })).toEqual({})

    // Mutation : une vraie différence doit ressortir.
    expect(construirePatch(original, { ...brouillon, reactions: ['inconnue'] })).toEqual({ reactions: ['inconnue'] })
  })

  it('efface la remarque sur un texte vide, sans la réenvoyer si elle est inchangée', () => {
    const brouillon = brouillonInitial(original)
    expect(construirePatch(original, { ...brouillon, remarque: '   ' })).toEqual({ comment: null })
    expect(construirePatch(original, brouillon)).toEqual({})
  })
})

describe('brouillonInitial', () => {
  it('part d’aujourd’hui, sans note, sans le visionnage d’une entrée', () => {
    const brouillon = brouillonInitial()
    expect(brouillon.note).toBeNull()
    expect(brouillon.reactions).toEqual([])
    expect(brouillon.date).toBe(new Date().toISOString().slice(0, 10))
  })

  it('reprend la date, la note, les réactions et la remarque de l’entrée corrigée', () => {
    const brouillon = brouillonInitial(original)
    expect(brouillon.date).toBe(original.entry.finished_at)
    expect(brouillon.note).toBe(original.entry.rating)
    expect(brouillon.reactions).toEqual(original.carnet.reactions)
    expect(brouillon.remarque).toBe(original.carnet.comment ?? '')
  })
})
