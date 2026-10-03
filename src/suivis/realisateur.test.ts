import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ecrireModeDeCompte,
  etatDuFilm,
  ligneDeCompte,
  lireModeDeCompte,
  retrospectiveComplete,
  separerCourts,
  type FilmDeRealisateur,
} from './realisateur'

let prochain = 1
const film = (extra: Partial<FilmDeRealisateur> = {}): FilmDeRealisateur => ({
  tmdb_id: prochain++,
  vu: null,
  introuvable: false,
  court: false,
  sur_le_plex: false,
  ...extra,
})
const vu = (extra: Partial<FilmDeRealisateur> = {}) =>
  film({ vu: { entry_id: 'e', rating: null, finished_at: '2026-01-01' }, ...extra })

describe('separerCourts', () => {
  it('range longs et courts à part, chacun dans l’ordre reçu', () => {
    const [a, b, c, d] = [film(), film({ court: true }), film(), film({ court: true })]
    // Mutation : un `court` ignoré garderait les courts dans les longs.
    expect(separerCourts([a, b, c, d])).toEqual({ longs: [a, c], courts: [b, d] })
  })
})

describe('ligneDeCompte', () => {
  const longs = [...Array.from({ length: 8 }, () => vu()), ...Array.from({ length: 4 }, () => film())]
  const courts = [vu({ court: true }), film({ court: true }), film({ court: true }), film({ court: true })]

  it('séparément : les longs, puis les courts', () => {
    // Mutation : un compte des courts mêlé aux longs.
    expect(ligneDeCompte(longs, courts, 'separement')).toBe('8 vus sur 12 · courts 1 sur 4')
  })

  it('séparément sans court : les longs seuls', () => {
    expect(ligneDeCompte(longs, [], 'separement')).toBe('8 vus sur 12')
  })

  it('séparément sans long : les courts seuls', () => {
    expect(ligneDeCompte([], courts, 'separement')).toBe('courts 1 sur 4')
  })

  it('ensemble : longs et courts additionnés', () => {
    expect(ligneDeCompte(longs, courts, 'ensemble')).toBe('9 vus sur 16')
  })

  it('longs seulement : les courts ne comptent pas', () => {
    expect(ligneDeCompte(longs, courts, 'longs')).toBe('8 vus sur 12')
  })

  it('longs seulement sans long : se replie sur ensemble plutôt que « 0 vus sur 0 »', () => {
    expect(ligneDeCompte([], courts, 'longs')).toBe('1 vus sur 4')
  })

  it('compte les introuvables dans le total', () => {
    expect(ligneDeCompte([film({ introuvable: true }), vu()], [], 'separement')).toBe('1 vus sur 2')
  })
})

describe('retrospectiveComplete', () => {
  const longsVus = [vu(), film({ introuvable: true })]
  const courtsOuverts = [film({ court: true })]

  it('longs seulement : un court à voir n’empêche pas le sceau', () => {
    // Mutation : le mode « longs » qui regarderait aussi les courts.
    expect(retrospectiveComplete(longsVus, courtsOuverts, 'longs')).toBe(true)
  })

  it('séparément et ensemble : un court à voir l’empêche', () => {
    // Mutation : un sceau qui ignorerait les courts hors du mode « longs ».
    expect(retrospectiveComplete(longsVus, courtsOuverts, 'separement')).toBe(false)
    expect(retrospectiveComplete(longsVus, courtsOuverts, 'ensemble')).toBe(false)
  })

  it('sans long, « longs seulement » regarde les courts plutôt que de sceller le vide', () => {
    expect(retrospectiveComplete([], courtsOuverts, 'longs')).toBe(false)
  })
})

describe('etatDuFilm', () => {
  it('dit vu avec sa note, vu sans note, introuvable ou à voir', () => {
    expect(etatDuFilm(vu({ vu: { entry_id: 'e', rating: 9, finished_at: '2026-01-01' } }))).toBe('Vu · 9/10')
    expect(etatDuFilm(vu())).toBe('Vu')
    expect(etatDuFilm(film({ introuvable: true }))).toBe('Introuvable')
    expect(etatDuFilm(film())).toBe('À voir')
  })

  it('ajoute « Sur le Plex » après l’état, vu ou non', () => {
    // Mutation : le signe réservé aux films pas encore vus, ou posé avant l'état.
    expect(etatDuFilm(vu({ sur_le_plex: true }))).toBe('Vu · Sur le Plex')
    expect(etatDuFilm(film({ sur_le_plex: true }))).toBe('À voir · Sur le Plex')
  })
})

describe('le mode de compte gardé', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('vaut « séparément » sans rien de gardé', () => {
    expect(lireModeDeCompte()).toBe('separement')
  })

  it('rend le mode écrit', () => {
    ecrireModeDeCompte('longs')
    // Mutation : une écriture sous une autre clé que la lecture.
    expect(lireModeDeCompte()).toBe('longs')
  })

  it('revient au défaut sur une valeur inconnue', () => {
    localStorage.setItem('journal.realisateur-compte', 'tout')
    // Mutation : rendre la valeur lue sans la vérifier.
    expect(lireModeDeCompte()).toBe('separement')
  })

  it('revient au défaut quand le stockage lève à la lecture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage refusé')
    })
    expect(lireModeDeCompte()).toBe('separement')
  })

  it('n’échoue pas quand le stockage lève à l’écriture', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => ecrireModeDeCompte('ensemble')).not.toThrow()
  })
})
