import { describe, expect, it } from 'vitest'
import {
  casesBande,
  compteBande,
  compteSuivis,
  compteCarte,
  derniereActivite,
  entiteBouclee,
  ligneBouclee,
  repartirSuivis,
  trierParActivite,
  type EtatFilmographie,
} from './liste'
import type { FilmSuivi } from './prochain'

const vu = (jour: string) => ({ entry_id: `e-${jour}`, rating: null, finished_at: jour })
const film = (id: number, options: { vu?: string; introuvable?: boolean } = {}): FilmSuivi => ({
  tmdb_id: id,
  vu: options.vu ? vu(options.vu) : null,
  introuvable: options.introuvable ?? false,
})
const entite = (id: number, ajouteLe: string) => ({ tmdb_id: id, ajoute_le: ajouteLe })
const pret = (...films: FilmSuivi[]): EtatFilmographie<FilmSuivi> => ({ statut: 'pret', films })
const ATTENTE: EtatFilmographie<FilmSuivi> = { statut: 'attente' }

describe('trierParActivite', () => {
  it('du plus récemment actif au plus ancien : le dernier film vu, sinon le jour de l’ajout', () => {
    const entites = [entite(1, '2026-09-20T10:00:00.000Z'), entite(2, '2026-09-01T10:00:00.000Z'), entite(3, '2026-09-10T10:00:00.000Z')]
    const films = new Map([
      [1, pret(film(10))], // rien de vu : classée sur son ajout, le 20
      [2, pret(film(20, { vu: '2026-09-25' }), film(21, { vu: '2026-09-02' }))], // le 25
    ])
    // 3 : filmographie pas encore là, classée sur son ajout, le 10.
    expect(trierParActivite(entites, films).map((e) => e.tmdb_id)).toEqual([2, 1, 3])
  })

  it('à égalité, l’ordre du back tient', () => {
    const entites = [entite(1, '2026-09-10T08:00:00.000Z'), entite(2, '2026-09-10T20:00:00.000Z'), entite(3, '2026-09-10T01:00:00.000Z')]
    // Comparées au jour : trois ajouts du 10, seul l'ordre d'entrée les départage.
    expect(trierParActivite(entites, new Map()).map((e) => e.tmdb_id)).toEqual([1, 2, 3])
  })
})

describe('entiteBouclee', () => {
  it('tout vu ou introuvable, jamais une liste vide', () => {
    expect(entiteBouclee([film(1, { vu: '2026-09-01' }), film(2, { introuvable: true })])).toBe(true)
    expect(entiteBouclee([film(1, { vu: '2026-09-01' }), film(2)])).toBe(false)
    // Mutation : sans le garde sur la longueur, `every` d'une liste vide rendrait vrai.
    expect(entiteBouclee([])).toBe(false)
  })
})

describe('repartirSuivis', () => {
  it('met les bouclées à part, chaque groupe trié par activité ; une filmographie en attente reste en cours', () => {
    const entites = [entite(1, '2026-09-01T00:00:00.000Z'), entite(2, '2026-09-02T00:00:00.000Z'), entite(3, '2026-09-03T00:00:00.000Z'), entite(4, '2026-09-04T00:00:00.000Z')]
    const films = new Map<number, EtatFilmographie<FilmSuivi>>([
      [1, pret(film(10, { vu: '2026-09-20' }))], // bouclée, le 20
      [2, pret(film(20, { vu: '2026-09-10' }), film(21))], // en cours, le 10
      [3, ATTENTE], // en cours, sur son ajout (le 3)
      [4, pret(film(40, { vu: '2026-09-28' }))], // bouclée, le 28
    ])
    const { enCours, bouclees } = repartirSuivis(entites, films)
    expect(enCours.map((e) => e.tmdb_id)).toEqual([2, 3])
    expect(bouclees.map((e) => e.tmdb_id)).toEqual([4, 1])
  })
})

describe('ligneBouclee', () => {
  it('accordée à la source, datée du dernier visionnage, le premier du mois ordinalisé', () => {
    expect(ligneBouclee('realisateurs', '2026-08-02', '2026-07-01T00:00:00.000Z')).toBe('bouclée le 2 août 2026')
    expect(ligneBouclee('sagas', '2026-08-01', '2026-07-01T00:00:00.000Z')).toBe('bouclé le 1er août 2026')
  })
  it('sans visionnage, datée de l’ajout', () => {
    expect(ligneBouclee('sagas', null, '2026-07-15T00:00:00.000Z')).toBe('bouclé le 15 juillet 2026')
  })
  it('sans aucune date, nulle', () => {
    expect(ligneBouclee('realisateurs', null, '')).toBeNull()
  })
})

describe('compteBande et compteCarte', () => {
  const films = [film(1, { vu: '2026-09-01' }), film(2, { introuvable: true }), film(3), film(4, { vu: '2026-09-02', introuvable: true })]
  it('masqués, les introuvables quittent le total ; sinon ils le comptent sans jamais compter vus', () => {
    expect(compteBande(films, true)).toEqual({ vus: 1, total: 2 })
    // 4 est vu ET introuvable : la marque prime, il ne compte pas parmi les vus.
    expect(compteBande(films, false)).toEqual({ vus: 1, total: 4 })
  })
  it('un réalisateur compte tous ses films, l’interrupteur n’y change rien ; une saga suit la bande', () => {
    expect(compteCarte('realisateurs', films, true)).toEqual({ vus: 2, total: 4 })
    expect(compteCarte('sagas', films, true)).toEqual({ vus: 1, total: 2 })
  })
  it('derniereActivite prend le visionnage le plus récent, sinon l’ajout', () => {
    expect(derniereActivite('2026-09-01T00:00:00.000Z', [film(1, { vu: '2026-09-05' }), film(2, { vu: '2026-09-09' })])).toBe('2026-09-09')
    expect(derniereActivite('2026-09-01T00:00:00.000Z', [film(1)])).toBe('2026-09-01')
    expect(derniereActivite('2026-09-01T00:00:00.000Z', null)).toBe('2026-09-01')
  })
})

describe('compteSuivis', () => {
  it('accorde chaque nom à son nombre', () => {
    expect(compteSuivis(5, 2)).toBe('5 rétrospectives · 2 cycles')
    // Mutation : accorder dès 1 (`>= 1`) écrirait « 1 rétrospectives » ; ne jamais accorder, « 2 cycle ».
    expect(compteSuivis(1, 0)).toBe('1 rétrospective · 0 cycle')
    expect(compteSuivis(0, 1)).toBe('0 rétrospective · 1 cycle')
  })
})

describe('casesBande', () => {
  const etats = (films: FilmSuivi[], masquer: boolean) => casesBande(films, masquer).map((c) => [c.film.tmdb_id, c.etat])

  it('vu, un seul prochain (le premier ni vu ni introuvable), puis pas encore, dans l’ordre du back', () => {
    // Mutation : marquer « prochain » tout film non vu en donnerait deux.
    expect(etats([film(1, { vu: '2026-09-01' }), film(2), film(3)], true)).toEqual([
      [1, 'vu'],
      [2, 'prochain'],
      [3, 'pas-encore'],
    ])
  })

  it('masqués, les introuvables quittent la bande, et le prochain saute par-dessus', () => {
    expect(etats([film(1, { vu: '2026-09-01' }), film(2, { introuvable: true }), film(3)], true)).toEqual([
      [1, 'vu'],
      [3, 'prochain'],
    ])
  })

  it('montrés, les introuvables gardent leur place, jamais prochains, la marque primant sur le visionnage', () => {
    const films = [film(1, { introuvable: true }), film(2), film(3, { vu: '2026-09-01' }), film(4, { vu: '2026-09-02', introuvable: true })]
    // Mutation : tester `vu` avant `introuvable` rendrait « vu » au film 4, vu puis marqué perdu.
    expect(etats(films, false)).toEqual([
      [1, 'introuvable'],
      [2, 'prochain'],
      [3, 'vu'],
      [4, 'introuvable'],
    ])
  })

  it('aucun prochain quand tout est vu', () => {
    expect(etats([film(1, { vu: '2026-09-01' }), film(2, { vu: '2026-09-02' })], true)).toEqual([
      [1, 'vu'],
      [2, 'vu'],
    ])
  })
})
