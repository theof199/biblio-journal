import { describe, expect, it } from 'vitest'
import { legendeDeFilm } from './legende'

describe('legendeDeFilm', () => {
  it('écrit « de » devant une consonne, puis l’année', () => {
    expect(legendeDeFilm('Chantal Akerman', 1975)).toBe('de Chantal Akerman, 1975')
  })

  it.each([
    ['Agnès Varda', 'd’Agnès Varda'],
    ['Éric Rohmer', 'd’Éric Rohmer'],
    ['Yves Robert', 'd’Yves Robert'],
    ['Orson Welles', 'd’Orson Welles'],
    ['Hayao Miyazaki', 'de Hayao Miyazaki'],
  ])('élide devant une voyelle, accentuée ou non : %s', (nom, attendu) => {
    expect(legendeDeFilm(nom, null)).toBe(attendu)
  })

  it('n’a que l’année sans réalisateur, sans virgule seule', () => {
    expect(legendeDeFilm(null, 1999)).toBe('1999')
    expect(legendeDeFilm('   ', 1999)).toBe('1999')
  })

  it('n’a que le réalisateur sans année', () => {
    expect(legendeDeFilm('Claire Denis', null)).toBe('de Claire Denis')
  })

  it('reste vide sans rien connaître', () => {
    expect(legendeDeFilm(undefined, undefined)).toBe('')
  })
})
