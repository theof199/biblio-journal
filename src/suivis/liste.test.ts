import { describe, expect, it } from 'vitest'
import {
  compteBande,
  compteCarte,
  derniereActivite,
  entiteBouclee,
  formatRelatif,
  repartirSuivis,
  sousLigneCarte,
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

describe('formatRelatif', () => {
  const jeudi = '2026-09-24'
  it('aujourd’hui, hier, puis des jours jusqu’à six', () => {
    expect(formatRelatif('2026-09-24', jeudi)).toBe('aujourd’hui')
    expect(formatRelatif('2026-09-23', jeudi)).toBe('hier')
    expect(formatRelatif('2026-09-22', jeudi)).toBe('il y a 2 jours')
    expect(formatRelatif('2026-09-18', jeudi)).toBe('il y a 6 jours')
  })
  it('une date à venir se lit « aujourd’hui »', () => {
    expect(formatRelatif('2026-09-25', jeudi)).toBe('aujourd’hui')
  })
  it('des semaines de sept jours, jusqu’à quatre', () => {
    expect(formatRelatif('2026-09-17', jeudi)).toBe('il y a 1 semaine')
    expect(formatRelatif('2026-09-10', jeudi)).toBe('il y a 2 semaines')
    expect(formatRelatif('2026-08-21', jeudi)).toBe('il y a 4 semaines')
  })
  it('des mois entiers dès trente-cinq jours, jamais moins d’un', () => {
    expect(formatRelatif('2026-08-20', jeudi)).toBe('il y a 1 mois')
    // Février a 28 jours : 35 jours écoulés, mais le mois entier n'est pas révolu (le 27 > le 3).
    expect(formatRelatif('2026-01-27', '2026-03-03')).toBe('il y a 1 mois')
    expect(formatRelatif('2026-04-02', jeudi)).toBe('il y a 5 mois')
  })
  it('lit le jour d’un instant complet, sans conversion de fuseau', () => {
    expect(formatRelatif('2026-09-23T23:59:00.000Z', jeudi)).toBe('hier')
  })
})

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

describe('sousLigneCarte', () => {
  const aujourdHui = '2026-09-24'
  it('vu récemment : le compte et le jour du dernier visionnage', () => {
    expect(sousLigneCarte('realisateurs', 4, 12, '2026-09-21', '2026-09-01T00:00:00.000Z', aujourdHui, false)).toBe(
      '4 sur 12 · vu il y a 3 jours',
    )
  })
  it('rien de vu : la date d’ajout, le premier du mois ordinalisé', () => {
    expect(sousLigneCarte('sagas', 0, 12, null, '2026-09-01T18:22:41.000Z', aujourdHui, false)).toBe(
      '0 sur 12 · ajouté le 1er septembre 2026',
    )
  })
  it('bouclée : accordée à la source, datée du dernier visionnage, sinon de l’ajout', () => {
    expect(sousLigneCarte('realisateurs', 6, 6, '2026-08-02', '2026-07-01T00:00:00.000Z', aujourdHui, true)).toBe(
      '6 sur 6 · bouclée le 2 août 2026',
    )
    expect(sousLigneCarte('sagas', 2, 2, null, '2026-07-15T00:00:00.000Z', aujourdHui, true)).toBe(
      '2 sur 2 · bouclé le 15 juillet 2026',
    )
  })
  it('sans aucune date, le compte seul', () => {
    expect(sousLigneCarte('realisateurs', 3, 5, null, '', aujourdHui, false)).toBe('3 sur 5')
    expect(sousLigneCarte('realisateurs', 3, 5, null, '', aujourdHui, true)).toBe('3 sur 5')
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
