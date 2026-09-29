import { describe, expect, it } from 'vitest'
import { bobineDuFilm, boutonsDuFilm, candidatDuBillet, derniereEntree, filmDeLaFiche } from './film'
import { visionnage } from '../test/journal'
import { fichePrete, filmDeSalle } from '../test/voyage'
import { exemple } from '../test/contrat'
import type { JournalPage } from '../api/journal'

const page = (items: JournalPage['items']): JournalPage => ({ ...exemple<JournalPage>('/me/journal', 'get', 200), items })
const vu = (id: string, tmdb: string, source = 'tmdb') => {
  const v = visionnage({ id, media: `m-${id}`, date: '2026-09-01' })
  v.media.external_id = tmdb
  v.media.source = source as typeof v.media.source
  return v
}

describe('le film d’une fiche', () => {
  it('se retrouve par sa ligne, avec sa salle', () => {
    const fiche = fichePrete()
    const attendu = fiche.salles[0]!.films[1]!
    expect(filmDeLaFiche(fiche, attendu.id)).toEqual({ salle: fiche.salles[0], film: attendu })
    expect(filmDeLaFiche(fiche, 'inconnu')).toBeNull()
  })
})

describe('le guichet', () => {
  // Mutations : « Je l'ai vu » sur un film vu ; « Corriger » sans l'entrée ; les deux marques ensemble.
  it('propose le Plex, « Je l’ai vu » et « Introuvable » sur un film à voir', () => {
    expect(boutonsDuFilm('sur_le_plex', 'https://plex/1', false)).toEqual(['plex', 'vu', 'introuvable'])
    expect(boutonsDuFilm('a_demander', null, false)).toEqual(['vu', 'demander', 'introuvable'])
    expect(boutonsDuFilm('demande', null, false)).toEqual(['vu', 'introuvable'])
  })

  it('remet à voir un introuvable, sans le marquer deux fois', () => {
    expect(boutonsDuFilm('introuvable', null, false)).toEqual(['vu', 'remettre'])
  })

  it('propose « Corriger » et le podium sur un film vu, « Corriger » seulement si l’entrée est retrouvée', () => {
    expect(boutonsDuFilm('vu', 'https://plex/1', true)).toEqual(['corriger', 'plex', 'podium'])
    expect(boutonsDuFilm('vu', null, false)).toEqual(['podium'])
  })
})

describe('mon dernier visionnage d’un film', () => {
  // Mutations : ne comparer que `external_id` (un livre au même identifiant passerait) ; prendre le dernier trouvé.
  it('se trouve par sa source et son identifiant, au plus récent', () => {
    const livre = vu('e0', '12', 'openlibrary')
    const pages = [page([livre, vu('e2', '12')]), page([vu('e1', '12')])]
    expect(derniereEntree(pages, 12)!.entry.id).toBe('e2')
    expect(derniereEntree([page([livre])], 12)).toBeUndefined()
  })
})

describe('le billet', () => {
  const bobine = { tmdb_id: 101, title: 'Bobine', duree_min: 2, cover_url: 'https://a/b.jpg', plex_url: null, etat: 'sur_le_plex' as const }
  const programme = filmDeSalle({ id: 'p1', tmdb_id: 100, year: 1896, title: 'Programme', realisateur: 'Lumière', programme: { duree_min: 2, bobines: [bobine] } })

  // Mutation : noter le programme au lieu de la bobine touchée.
  it('note la bobine touchée, à l’année de son programme, sans réalisateur', () => {
    expect(bobineDuFilm(programme, 101)).toBe(bobine)
    expect(candidatDuBillet(programme, bobine)).toEqual({ source: 'tmdb', external_id: '101', title: 'Bobine', year: 1896, cover_url: 'https://a/b.jpg', director: null })
  })

  it('note le film de la salle, avec son réalisateur', () => {
    expect(candidatDuBillet(programme)).toMatchObject({ external_id: '100', title: 'Programme', director: 'Lumière' })
    expect(candidatDuBillet({ ...programme, realisateur: '' }).director).toBeNull()
  })
})
