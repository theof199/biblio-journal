import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDateCourte, formatDateVisionnage, formatJourBref, jourLocal, espaceInsecable, formatDuree, moisEnLettres, normaliser, sousTitre, virgule } from './format'

describe('sousTitre', () => {
  it('joint le réalisateur et l’année', () => {
    expect(sousTitre('Christopher Nolan', 2010)).toBe('Christopher Nolan, 2010')
  })

  it('omet le réalisateur manquant, sans virgule seule', () => {
    expect(sousTitre(null, 2010)).toBe('2010')
  })

  it('omet l’année manquante', () => {
    expect(sousTitre('Christopher Nolan', null)).toBe('Christopher Nolan')
  })

  it('rend une chaîne vide sans rien connaître', () => {
    expect(sousTitre(null, null)).toBe('')
  })
})

describe('jourLocal', () => {
  it('rend le jour du calendrier local, pas celui de Greenwich', () => {
    // Le fuseau des tests est figé sur Paris (`vite.config.ts`, `test.env`). À 0 h 30 le 30, il est
    // encore 22 h 30 le 29 à Greenwich. Mutation : `toISOString().slice(0, 10)` rend '2026-09-29'.
    expect(new Date(2026, 8, 30, 0, 30).getTimezoneOffset()).not.toBe(0)
    expect(jourLocal(new Date(2026, 8, 30, 0, 30))).toBe('2026-09-30')
  })

  it('complète le mois et le jour sur deux chiffres', () => {
    expect(jourLocal(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('formatDateVisionnage', () => {
  it('écrit le jour, le mois en toutes lettres et l’année', () => {
    expect(formatDateVisionnage('2026-07-12')).toBe('12 juillet 2026')
  })

  it('ordinalise le premier du mois', () => {
    expect(formatDateVisionnage('2026-10-01')).toBe('1er octobre 2026')
  })
})

describe('normaliser', () => {
  it('met en minuscules', () => {
    expect(normaliser('MIYAZAKI')).toBe('miyazaki')
  })

  it('retire les accents', () => {
    expect(normaliser('Amélie')).toBe('amelie')
  })

  it('rogne les espaces aux extrémités', () => {
    expect(normaliser('  Miyazaki  ')).toBe('miyazaki')
  })

  // Mutation : sans `.toLowerCase()` après `.replace`, « CAFÉ » et « café » resteraient distincts.
  it('« miya » retrouve « Hayao Miyazaki »', () => {
    expect(normaliser('Hayao Miyazaki').includes(normaliser('miya'))).toBe(true)
  })
})

describe('formatJourBref', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('écrit le jour et le mois abrégé en capitales, sans point', () => {
    expect(formatJourBref('2026-09-28')).toBe('28 SEPT')
  })

  it('garde l’accent du mois', () => {
    expect(formatJourBref('2026-08-16')).toBe('16 AOÛT')
  })

  it('n’ordinalise pas le premier du mois', () => {
    expect(formatJourBref('2026-07-01')).toBe('1 JUIL')
  })

  it('lit le jour dans la date elle-même, quel que soit le fuseau', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(formatJourBref('2026-08-01')).toBe('1 AOÛT')
  })
})

describe('virgule', () => {
  it('met la virgule décimale du français, sans ajouter de zéro', () => {
    expect(virgule(7.4)).toBe('7,4')
    expect(virgule(8)).toBe('8')
  })
})

describe('formatDateCourte', () => {
  it('écrit jour, mois, année avec leurs zéros', () => {
    expect(formatDateCourte('2026-10-01')).toBe('01/10/2026')
  })
})

describe('moisEnLettres', () => {
  it('écrit le mois en toutes lettres avec sa majuscule, puis l’année', () => {
    expect(moisEnLettres('2026-10-02')).toBe('Octobre 2026')
  })

  it('lit le jour en date locale : le dernier jour d’un mois ne passe pas au suivant', () => {
    expect(moisEnLettres('2026-09-30')).toBe('Septembre 2026')
    expect(moisEnLettres('2026-01-01')).toBe('Janvier 2026')
  })
})

describe('espaceInsecable', () => {
  it.each([':', ';', '?', '!'])('remplace l’espace avant « %s » par une espace insécable', (marque) => {
    expect(espaceInsecable(`Batman ${marque} Le Défi`)).toBe(`Batman\u00a0${marque} Le Défi`)
  })

  it('laisse les autres espaces, et un deux-points collé, comme ils sont', () => {
    expect(espaceInsecable('Le Garçon et le Héron')).toBe('Le Garçon et le Héron')
    expect(espaceInsecable('Mission: Impossible')).toBe('Mission: Impossible')
  })
})

describe('formatDuree', () => {
  it('écrit les heures et les minutes sur deux chiffres : 169 donne « 2 h 49 »', () => {
    expect(formatDuree(169)).toBe('2 h 49')
  })

  it('écrit « 49 min » sous l’heure', () => {
    expect(formatDuree(49)).toBe('49 min')
  })

  it('complète les minutes d’une heure pile : « 2 h 00 »', () => {
    expect(formatDuree(120)).toBe('2 h 00')
  })
})
