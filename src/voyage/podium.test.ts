import { describe, expect, it } from 'vitest'
import { candidats, choixDesMarches, corpsPodium, lignesDeLaMarche, type Candidat } from './podium'
import { visionnage } from '../test/journal'
import { fichePrete, filmDeSalle, salle } from '../test/voyage'

const PODIUM = fichePrete().podium
const MARCHE_1 = PODIUM[0]!

/** Un visionnage d'un film TMDB : l'identifiant d'entrée, le film, son année de sortie, la note. */
const vu = (id: string, tmdb: number, annee: number, note: number | null) => {
  const v = visionnage({ id, media: `m${tmdb}`, annee, date: '2026-09-01', note })
  v.media.external_id = String(tmdb)
  return v
}

describe('les candidats au podium', () => {
  // Mutations : le filtre d'année retiré (le `PUT` répondrait 400) ; le doublon gardé ; la source ignorée.
  it('sont mes films de l’année, une fois chacun avec la note de leur dernier visionnage, puis les programmes vus', () => {
    const autreSource = vu('e9', 77, 1897, 5)
    autreSource.media.source = 'openlibrary'
    const items = [vu('e3', 10, 1897, 9), vu('e2', 20, 1898, 8), vu('e1', 10, 1897, 6), autreSource]
    const programme = filmDeSalle({ id: 'p1', tmdb_id: 500, etat: 'vu', title: 'Programme', programme: { duree_min: 12, bobines: [] } })
    const partiel = filmDeSalle({ id: 'p2', tmdb_id: 501, etat: 'sur_le_plex', programme: { duree_min: 12, bobines: [] } })
    const simple = filmDeSalle({ id: 'f1', tmdb_id: 30, etat: 'vu' })
    const liste = candidats(items, 1897, [salle({ id: 's', films: [programme, partiel, simple] })])
    expect(liste).toEqual([
      { type: 'film', tmdbId: 10, titre: 'Film e3', affiche: items[0]!.media.cover_url, note: 9 },
      { type: 'programme', programmeId: 'p1', titre: 'Programme', affiche: programme.cover_url },
    ])
  })

  // Mutation : le filtre de type retiré : une série TMDB de l'année serait proposée, et le `PUT` répondrait 400.
  it('ne comptent jamais une série, même TMDB et de l’année', () => {
    const serie = vu('e5', 40, 1897, 7)
    serie.media.type = 'tv'
    expect(candidats([serie, vu('e4', 10, 1897, 8)], 1897, []).map((c) => c.titre)).toEqual(['Film e4'])
  })

  // Mutation : la garde `Number.isInteger` retirée : un identifiant non numérique partirait en `tmdb_id: NaN`.
  it('ne proposent jamais un film dont l’identifiant TMDB n’est pas un entier', () => {
    const casse = vu('e6', 60, 1897, 7)
    casse.media.external_id = 'tt0000060'
    expect(candidats([casse, vu('e4', 10, 1897, 8)], 1897, []).map((c) => c.titre)).toEqual(['Film e4'])
  })

  it('se posent par `tmdb_id` ou par `programme_id`, jamais les deux', () => {
    expect(corpsPodium({ type: 'film', tmdbId: 10, titre: 't', affiche: null, note: null })).toEqual({ tmdb_id: 10 })
    expect(corpsPodium({ type: 'programme', programmeId: 'p1', titre: 't', affiche: null })).toEqual({ programme_id: 'p1' })
  })
})

describe('la feuille d’une marche', () => {
  const film: Candidat = { type: 'film', tmdbId: MARCHE_1.tmdb_id!, titre: MARCHE_1.title, affiche: null, note: null }
  const autre: Candidat = { type: 'film', tmdbId: 999, titre: 'Autre', affiche: null, note: null }

  // Mutation : « Retirer » toujours en tête proposerait de vider une marche vide.
  it('ne propose « Retirer » que sur une marche occupée', () => {
    expect(lignesDeLaMarche(null, [film])[0]).toEqual({ type: 'candidat', candidat: film, occupant: false })
    expect(lignesDeLaMarche(MARCHE_1, [film, autre])).toEqual([
      { type: 'retirer' },
      { type: 'candidat', candidat: film, occupant: true },
      { type: 'candidat', candidat: autre, occupant: false },
    ])
  })
})

describe('« Mettre sur le podium »', () => {
  // Mutation : cocher sur le seul titre, ou sur l'identifiant de l'autre sorte.
  it('coche la marche qui porte déjà ce film, et nomme les occupants', () => {
    const cible: Candidat = { type: 'film', tmdbId: MARCHE_1.tmdb_id!, titre: MARCHE_1.title, affiche: null, note: null }
    expect(choixDesMarches(PODIUM, cible)).toEqual([
      { place: 1, occupant: MARCHE_1.title, cochee: true },
      { place: 2, occupant: null, cochee: false },
      { place: 3, occupant: null, cochee: false },
    ])
    const programme: Candidat = { type: 'programme', programmeId: 'p1', titre: 'P', affiche: null }
    expect(choixDesMarches(PODIUM, programme)[0]!.cochee).toBe(false)
    // Un autre film au même titre (un remake) n'est pas celui de la marche.
    const homonyme: Candidat = { type: 'film', tmdbId: 999, titre: MARCHE_1.title, affiche: null, note: null }
    expect(choixDesMarches(PODIUM, homonyme)[0]!.cochee).toBe(false)
  })

  // Mutation : ne reconnaître l'occupant que parmi les films : un programme déjà posé ne serait jamais coché.
  it('coche aussi la marche qui porte déjà ce programme, et lui seul', () => {
    const marcheProgramme = { ...MARCHE_1, place: 2, tmdb_id: null, programme_id: 'p1', title: 'Programme' }
    const podium: typeof PODIUM = [MARCHE_1, marcheProgramme, null]
    const programme: Candidat = { type: 'programme', programmeId: 'p1', titre: 'Programme', affiche: null }
    expect(choixDesMarches(podium, programme).map((c) => c.cochee)).toEqual([false, true, false])
    const autre: Candidat = { type: 'programme', programmeId: 'p2', titre: 'Programme', affiche: null }
    expect(choixDesMarches(podium, autre).map((c) => c.cochee)).toEqual([false, false, false])
  })
})
