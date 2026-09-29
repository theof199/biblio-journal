import { describe, expect, it } from 'vitest'
import { candidatsCourt, candidatsLong, corpsRemplacement, seanceRecente, seancesPassees, zoneSeance } from './seance'
import { filmDeSalle, morceau, salle, seance } from '../test/voyage'

const plex = filmDeSalle({ id: 'f-plex', tmdb_id: 1, etat: 'sur_le_plex', title: 'Plex' })
const demande = filmDeSalle({ id: 'f-dem', tmdb_id: 2, etat: 'demande', title: 'Demandé' })
const aDemander = filmDeSalle({ id: 'f-ad', tmdb_id: 3, etat: 'a_demander', title: 'À demander' })
const vu = filmDeSalle({ id: 'f-vu', tmdb_id: 4, etat: 'vu' })
const perdu = filmDeSalle({ id: 'f-perdu', tmdb_id: 5, etat: 'introuvable' })
const bobine = (tmdb: number, etat: 'vu' | 'sur_le_plex' | 'introuvable') => ({
  tmdb_id: tmdb,
  title: `Bobine ${tmdb}`,
  duree_min: 2,
  cover_url: null,
  plex_url: null,
  etat,
})
const programme = filmDeSalle({
  id: 'p1',
  tmdb_id: 100,
  etat: 'sur_le_plex',
  title: 'Programme',
  programme: { duree_min: 6, bobines: [bobine(101, 'vu'), bobine(102, 'sur_le_plex'), bobine(103, 'introuvable')] },
})

describe('« Autre long »', () => {
  // Mutations : le tri retiré (l'ordre de la salle) ; un vu, un introuvable ou un programme gardés.
  it('propose les films libres sans programme, Plex d’abord, puis demandé, puis à demander', () => {
    const groupes = candidatsLong([salle({ id: 's', nom: 'Les essentiels', films: [aDemander, vu, demande, programme, perdu, plex] })])
    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.candidats.map((c) => c.filmId)).toEqual(['f-plex', 'f-dem', 'f-ad'])
  })

  it('tait une salle qui n’a rien à proposer', () => {
    expect(candidatsLong([salle({ id: 's', films: [vu, perdu] })])).toEqual([])
  })
})

describe('« Autre court »', () => {
  // Mutations : une bobine vue ou introuvable gardée ; le long de ce soir proposé en court.
  it('propose les programmes libres suivis de leurs bobines libres, puis les films libres, jamais le long de ce soir', () => {
    const groupes = candidatsCourt([salle({ id: 's', films: [plex, programme, aDemander] })], 'f-plex')
    expect(groupes[0]!.candidats.map((c) => `${c.type}:${c.tmdbId}`)).toEqual(['film:100', 'bobine:102', 'film:3'])
  })

  it('se remplace par `film_id`, et par la bobine quand c’en est une', () => {
    const [ligne, laBobine] = candidatsCourt([salle({ id: 's', films: [programme] })], 'aucun')[0]!.candidats
    expect(corpsRemplacement('court', ligne!)).toEqual({ morceau: 'court', film_id: 'p1' })
    expect(corpsRemplacement('court', laBobine!)).toEqual({ morceau: 'court', film_id: 'p1', bobine_tmdb_id: 102 })
  })
})

describe('la zone séance', () => {
  const s1 = seance({ id: 's1', rang: 1, statut: 'ignoree', long: morceau(plex) })
  const s2 = seance({ id: 's2', rang: 2, statut: 'proposee', long: morceau(demande) })

  // Mutation : `seanceRecente` qui prend la première du tableau et non le rang le plus haut.
  it('suit la séance la plus récente par son rang, pas par sa place dans la liste', () => {
    expect(seanceRecente([s2, s1])!.id).toBe('s2')
    expect(seanceRecente([s1, s2])!.id).toBe('s2')
    expect(seanceRecente([])).toBeNull()
  })

  // Mutations : chaque branche retirée, une à une.
  it('montre la composition en vol, la carte proposée ou prise, ou le bouton', () => {
    expect(zoneSeance(true, [s2])).toBe('en_cours')
    expect(zoneSeance(false, [])).toBe('bouton')
    expect(zoneSeance(false, [s1, s2])).toBe('proposee')
    expect(zoneSeance(false, [seance({ id: 's3', rang: 3, statut: 'prise', long: morceau(demande) })])).toBe('prise')
    expect(zoneSeance(false, [s1])).toBe('bouton')
  })

  // Mutation : oublier qu'une séance prise dont le long est vu est terminée.
  it('rend le bouton, et range la séance dans les passées, quand le long d’une séance prise est vu', () => {
    const terminee = seance({ id: 's3', rang: 3, statut: 'prise', long: morceau(vu) })
    expect(zoneSeance(false, [s1, s2, terminee])).toBe('bouton')
    expect(seancesPassees([s1, s2, terminee]).map((s) => s.id)).toEqual(['s3', 's1'])
  })

  // Mutation : ne plus exclure la récente : prise et pas encore vue, elle tient la carte, pas la liste.
  it('ne range jamais la séance qui tient la carte parmi les passées', () => {
    expect(seancesPassees([s1, s2]).map((s) => s.id)).toEqual(['s1'])
    const prise = seance({ id: 's3', rang: 3, statut: 'prise', long: morceau(demande) })
    expect(seancesPassees([s1, prise]).map((s) => s.id)).toEqual(['s1'])
  })
})
