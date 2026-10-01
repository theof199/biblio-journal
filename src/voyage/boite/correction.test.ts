import { describe, expect, it } from 'vitest'
import { visionnage } from '../../test/journal'
import { ficheEnAttente, fichePrete, filmDeSalle, salle } from '../../test/voyage'
import { filmDuVisionnage } from './correction'

/** Un visionnage du film TMDB `tmdb`. */
const vu = (tmdb: number) => {
  const v = visionnage({ id: 'e1', annee: 1896, date: '2026-09-01' })
  v.media.source = 'tmdb'
  v.media.type = 'movie'
  v.media.external_id = String(tmdb)
  return v
}

const programme = filmDeSalle({
  id: 'f-programme',
  tmdb_id: 900,
  programme: {
    duree_min: 2,
    bobines: [
      { tmdb_id: 901, title: 'La Sortie de l’usine', duree_min: 1, cover_url: null, plex_url: null, etat: 'vu' },
      { tmdb_id: 902, title: 'Le Jardinier', duree_min: 1, cover_url: null, plex_url: null, etat: 'vu' },
    ],
  },
})

const FICHE = fichePrete({
  annee: 1896,
  salles: [
    salle({ id: 's1', films: [filmDeSalle({ id: 'f-autre', tmdb_id: 100 })] }),
    salle({ id: 's2', films: [filmDeSalle({ id: 'f-bon', tmdb_id: 200 }), programme] }),
  ],
})

describe('le film d’un visionnage dans la fiche de son année', () => {
  // Mutations : la première ligne rendue quel que soit le film ; la comparaison sur l'identifiant du média.
  it('retrouve la ligne du film par son identifiant TMDB, dans n’importe quelle salle', () => {
    expect(filmDuVisionnage(FICHE, vu(200))).toBe('f-bon')
    expect(filmDuVisionnage(FICHE, vu(100))).toBe('f-autre')
  })

  // Mutation : les bobines oubliées (une bobine vue n'aurait pas de correction).
  it('corrige une bobine par son programme', () => {
    expect(filmDuVisionnage(FICHE, vu(902))).toBe('f-programme')
  })

  // Mutations : la garde `estPrete` retirée ; un film absent qui rend une ligne quand même.
  it('ne rend rien sans fiche prête, ni pour un film absent des salles', () => {
    expect(filmDuVisionnage(undefined, vu(200))).toBeNull()
    expect(filmDuVisionnage(ficheEnAttente(1896), vu(200))).toBeNull()
    expect(filmDuVisionnage(FICHE, vu(300))).toBeNull()
  })

  // Mutations : la garde de la source retirée (un livre dont l'identifiant vaudrait 200 passerait) ;
  // celle du type (une série de TMDB, dont les identifiants ne sont pas ceux des films).
  it('ne prend qu’un film de TMDB', () => {
    const livre = vu(200)
    livre.media.source = 'openlibrary'
    expect(filmDuVisionnage(FICHE, livre)).toBeNull()
    const serie = vu(200)
    serie.media.type = 'tv'
    expect(filmDuVisionnage(FICHE, serie)).toBeNull()
  })
})
