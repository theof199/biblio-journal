import { describe, expect, it } from 'vitest'
import { bobineDuFilm, boutonsDuFilm, candidatDuBillet, derniereEntree, filmDeLaFiche } from './film'
import { visionnage } from '../test/journal'
import { fichePrete, filmDeSalle, salle } from '../test/voyage'
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

  // Mutation : rendre la première salle quelle que soit celle du film.
  it('rend la salle où le film se trouve, pas la première', () => {
    const f1 = filmDeSalle({ id: 'f1', tmdb_id: 1 })
    const f2 = filmDeSalle({ id: 'f2', tmdb_id: 2 })
    const s1 = salle({ id: 's1', films: [f1] })
    const s2 = salle({ id: 's2', films: [f2] })
    expect(filmDeLaFiche(fichePrete({ salles: [s1, s2] }), 'f2')).toEqual({ salle: s2, film: f2 })
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

  // Mutation : « Corriger » sur la seule entrée retrouvée, sans regarder l'état rendu par l'API.
  it('ne propose « Corriger » que sur un film vu, même quand une entrée est retrouvée', () => {
    expect(boutonsDuFilm('sur_le_plex', null, true)).toEqual(['vu', 'introuvable'])
    expect(boutonsDuFilm('introuvable', null, true)).toEqual(['vu', 'remettre'])
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

  // Mutations : ne pas regarder le type (une série TMDB au même identifiant passerait) ; prendre la
  // dernière trouvée dans une même page.
  it('ne prend ni une série TMDB au même identifiant, ni la plus ancienne d’une même page', () => {
    const serie = vu('s0', '12')
    serie.media.type = 'tv'
    expect(derniereEntree([page([serie])], 12)).toBeUndefined()
    expect(derniereEntree([page([serie, vu('e2', '12'), vu('e1', '12')])], 12)!.entry.id).toBe('e2')
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

  // Mutation : rendre la première bobine du programme, quelle que soit celle touchée.
  it('retrouve la bobine touchée parmi plusieurs, et aucune hors du programme', () => {
    const seconde = { ...bobine, tmdb_id: 102, title: 'Seconde' }
    const deux = { ...programme, programme: { duree_min: 4, bobines: [bobine, seconde] } }
    expect(bobineDuFilm(deux, 102)).toBe(seconde)
    expect(bobineDuFilm(deux, 999)).toBeUndefined()
    expect(bobineDuFilm(filmDeSalle({ id: 'f', tmdb_id: 5 }), 5)).toBeUndefined()
  })

  // Mutations : le film de la salle noté sans son année ou sans son affiche.
  it('note le film de la salle à son année et avec son affiche', () => {
    const film = filmDeSalle({ id: 'f', tmdb_id: 200, year: 1897, title: 'Film', realisateur: 'Méliès', cover_url: 'https://a/f.jpg' })
    expect(candidatDuBillet(film)).toEqual({ source: 'tmdb', external_id: '200', title: 'Film', year: 1897, cover_url: 'https://a/f.jpg', director: 'Méliès' })
  })
})
