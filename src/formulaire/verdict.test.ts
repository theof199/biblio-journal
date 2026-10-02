import { describe, expect, it } from 'vitest'
import { noteEnMots, verdictDe } from './verdict'

describe('verdictDe', () => {
  it.each([
    [1, 'Navet'],
    [2, 'Raté'],
    [3, 'Faible'],
    [4, 'Bof'],
    [5, 'Moyen'],
    [6, 'Pas mal'],
    [7, 'Bien'],
    [8, 'Très bien'],
    [9, 'Excellent'],
    [10, 'Chef-d’œuvre'],
  ])('la note %i s’écrit « %s »', (note, mot) => {
    expect(verdictDe(note)).toBe(mot)
  })

  it('n’a pas de mot pour une note hors de 1 à 10, ni pour un nombre à virgule', () => {
    expect(verdictDe(0)).toBeNull()
    expect(verdictDe(11)).toBeNull()
    expect(verdictDe(7.5)).toBeNull()
  })
})

describe('noteEnMots', () => {
  it('écrit le verdict puis la note sur dix', () => {
    expect(noteEnMots(8)).toBe('Très bien · 8/10')
  })

  it('reste vide sans note, jamais « null/10 »', () => {
    expect(noteEnMots(null)).toBe('')
  })
})
