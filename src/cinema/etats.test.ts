import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cinemaUniqueEnCours,
  dejaDansLeJournal,
  dernierVisionnage,
  marqueEnCours,
  marqueProchaine,
  messageAuCine,
  miseAJourAffichee,
  reperesSuivis,
  seancesCetteAnnee,
  sousTitreCinemas,
} from './etats'
import type { EtatFilmographie } from '../suivis/liste'
import { exemple } from '../test/contrat'
import type { JournalItem, JournalPage } from '../api/journal'
import type { SortiesEnCours } from '../api/sorties'

const BASE = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

function seance(overrides: { id: string; finished_at: string; externalId?: string }): JournalItem {
  return {
    ...BASE,
    entry: { ...BASE.entry, id: overrides.id, finished_at: overrides.finished_at },
    media: { ...BASE.media, external_id: overrides.externalId ?? BASE.media.external_id },
  }
}

describe('seancesCetteAnnee', () => {
  it('ne compte que les entrées de l’année donnée, une séance passée d’une autre année jamais', () => {
    // Dates espacées à la main, à cheval sur deux années : une séance de 2025 (passée) ne doit
    // jamais compter pour 2026, même juste à la limite du changement d'année.
    const seances = [
      seance({ id: 'a', finished_at: '2026-01-01' }),
      seance({ id: 'b', finished_at: '2026-09-03' }),
      seance({ id: 'c', finished_at: '2025-12-31' }),
    ]

    expect(seancesCetteAnnee(seances, 2026)).toBe(2)
    expect(seancesCetteAnnee(seances, 2025)).toBe(1)
    // Mutation : une comparaison sur l'année seule sans borner à l'année demandée compterait tout.
    expect(seancesCetteAnnee(seances, 2024)).toBe(0)
  })

  it('une liste vide ne compte rien', () => {
    expect(seancesCetteAnnee([], 2026)).toBe(0)
  })
})

describe('dernierVisionnage', () => {
  const seances = [
    seance({ id: 'ancien', finished_at: '2026-03-01', externalId: '27205' }),
    seance({ id: 'recent', finished_at: '2026-09-10', externalId: '27205' }),
    seance({ id: 'autre', finished_at: '2026-09-20', externalId: '11216' }),
  ]

  it('rend le visionnage le plus récent de ce tmdb_id, quel que soit l’ordre de la liste', () => {
    expect(dernierVisionnage(seances, 27205)?.entry.id).toBe('recent')
    expect(dernierVisionnage([...seances].reverse(), 27205)?.entry.id).toBe('recent')
  })

  it('rien quand le film n’est pas dans les séances chargées, ou quand son tmdb_id est nul', () => {
    expect(dernierVisionnage(seances, 1)).toBeUndefined()
    expect(dernierVisionnage(seances, null)).toBeUndefined()
  })
})

describe('dejaDansLeJournal', () => {
  it('rapproche par tmdb_id (external_id), jamais par le titre', () => {
    const seances = [seance({ id: 'a', finished_at: '2026-09-01', externalId: '912649' })]

    expect(dejaDansLeJournal(seances, 912649)).toBe(true)
    expect(dejaDansLeJournal(seances, 1022789)).toBe(false)
  })

  it('un tmdb_id nul (tuile non résolue) ne rapproche jamais rien', () => {
    const seances = [seance({ id: 'a', finished_at: '2026-09-01', externalId: '912649' })]

    expect(dejaDansLeJournal(seances, null)).toBe(false)
  })

  it('une liste vide ne rapproche rien', () => {
    expect(dejaDansLeJournal([], 912649)).toBe(false)
  })
})

describe('sousTitreCinemas', () => {
  it('montre le premier cinéma seul, sans « +0 »', () => {
    expect(sousTitreCinemas(['UGC Les Halles'])).toBe('UGC Les Halles')
  })

  it('ajoute « +N » au-delà d’un seul cinéma', () => {
    expect(sousTitreCinemas(['UGC Les Halles', 'mk2 Bastille', 'mk2 Nation'])).toBe('UGC Les Halles +2')
  })

  it('une liste vide rend une chaîne vide', () => {
    expect(sousTitreCinemas([])).toBe('')
  })
})

type FilmEnCours = SortiesEnCours['films'][number]

function filmEnCours(allocineId: number, cinemas: string[]): FilmEnCours {
  return {
    tmdb_id: allocineId,
    allocine_id: allocineId,
    title: `Film ${allocineId}`,
    original_title: null,
    year: null,
    release_date: null,
    cover_url: null,
    directors: [],
    cinemas,
  }
}

// Reprise des trois tests JVM de `cinemaUniqueEnCours` (point 13 de la revue du 24 septembre 2026).
describe('cinemaUniqueEnCours', () => {
  it('rend le nom quand toutes les tuiles partagent le même cinéma', () => {
    expect(cinemaUniqueEnCours([filmEnCours(1, ['Le Rex']), filmEnCours(2, ['Le Rex'])])).toBe('Le Rex')
  })

  // Mutation : rendre le premier cinéma trouvé plutôt qu'exiger un nom unique casse cette assertion.
  it('est nul dès que deux cinémas différents apparaissent', () => {
    expect(cinemaUniqueEnCours([filmEnCours(1, ['Le Rex']), filmEnCours(2, ['Le Majestic'])])).toBeNull()
    // Deux cinémas sur une même tuile, sans autre tuile : pas de cinéma unique non plus.
    expect(cinemaUniqueEnCours([filmEnCours(1, ['Le Rex', 'Le Majestic'])])).toBeNull()
  })

  // Mutation : comparer les listes de cinémas plutôt que l'ensemble des noms casse cette assertion.
  it('compare des noms, pas des listes : une tuile sans cinéma ne rompt pas l’unicité', () => {
    expect(
      cinemaUniqueEnCours([filmEnCours(1, ['Le Rex']), filmEnCours(2, ['Le Rex']), filmEnCours(3, [])]),
    ).toBe('Le Rex')
  })

  it('une grille vide n’a pas de cinéma unique', () => {
    expect(cinemaUniqueEnCours([])).toBeNull()
  })
})

describe('messageAuCine', () => {
  const base: SortiesEnCours = { du: '2026-09-15', au: '2026-09-15', calcule_le: null, cinemas_configures: false, films: [] }

  it('« Pas encore de programme. » si aucun cinéma n’est configuré', () => {
    expect(messageAuCine(base)).toBe('Pas encore de programme.')
  })

  it('« Pas encore de programme. » si configuré mais la tâche de fond n’a jamais tourné', () => {
    expect(messageAuCine({ ...base, cinemas_configures: true, calcule_le: null })).toBe('Pas encore de programme.')
  })

  it('« Rien à l’affiche aujourd’hui. » quand la tâche a tourné mais n’a rien trouvé', () => {
    expect(messageAuCine({ ...base, cinemas_configures: true, calcule_le: '2026-09-15T08:00:00Z' })).toBe(
      'Rien à l’affiche aujourd’hui.',
    )
  })

  it('aucun message une fois qu’il y a un programme', () => {
    const avecProgramme: SortiesEnCours = {
      ...base,
      cinemas_configures: true,
      calcule_le: '2026-09-15T08:00:00Z',
      films: [
        {
          tmdb_id: 1,
          allocine_id: 1,
          title: 'Film',
          original_title: null,
          year: null,
          release_date: null,
          cover_url: null,
          directors: [],
          cinemas: ['Le Rex'],
        },
      ],
    }
    expect(messageAuCine(avecProgramme)).toBeNull()
  })

  // « Jamais tourné » exige les deux : pas de films ET pas de `calcule_le`. Mutation : ne tester
  // que `calcule_le` cacherait une grille qui a bien des films derrière « Pas encore de programme. ».
  it('des films sans `calcule_le` s’affichent quand même : aucun message', () => {
    expect(messageAuCine({ ...base, cinemas_configures: true, calcule_le: null, films: [filmEnCours(1, ['Le Rex'])] })).toBeNull()
  })
})

describe('miseAJourAffichee', () => {
  it('nulle tant que la tâche de fond n’a jamais tourné', () => {
    expect(miseAJourAffichee(null)).toBeNull()
  })

  it('nulle sur une date illisible, plutôt que de lever', () => {
    expect(miseAJourAffichee('pas une date')).toBeNull()
  })

  it('formate en heure Europe/Paris, pas en heure UTC', () => {
    // 12h00 UTC un 15 septembre (CEST, +2) : 14h à Paris.
    expect(miseAJourAffichee('2026-09-15T12:00:03.000Z')).toBe('mis à jour à 14 h')
  })

  describe('sur un appareil qui n’est pas à l’heure de Paris', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    // La suite tourne en Europe/Paris (`vite.config.ts`) : sans changer de fuseau, un
    // `miseAJourAffichee` qui lirait l'heure de l'appareil passerait. Mutation : retirer `timeZone`
    // du formateur casse cette assertion (8 h à New York, pas 14 h).
    it('l’heure reste celle de Paris', () => {
      vi.stubEnv('TZ', 'America/New_York')
      expect(new Date('2026-09-15T12:00:03.000Z').getHours()).toBe(8)
      expect(miseAJourAffichee('2026-09-15T12:00:03.000Z')).toBe('mis à jour à 14 h')
    })
  })

  // Le fuseau Europe/Paris est déjà fixé pour toute la suite (`vite.config.ts`, `test.env.TZ`) :
  // ce test le prouverait même sans, `timeZone` étant posé en dur dans `miseAJourAffichee`.
  it('un calcul proche de minuit UTC change le jour à Paris, sans casser l’heure affichée', () => {
    // 22h30 UTC en septembre (CEST, +2) : 00h30 le lendemain à Paris.
    expect(miseAJourAffichee('2026-09-15T22:30:00.000Z')).toBe('mis à jour à 0 h')
    // 23h05 UTC en janvier (CET, +1) : 00h05 le lendemain à Paris — l'hiver ne change rien à la règle.
    expect(miseAJourAffichee('2026-01-15T23:05:00.000Z')).toBe('mis à jour à 0 h')
  })
})

describe('le sceau des Suivis (« le guichet »)', () => {
  const sagas = (etats: Record<number, EtatFilmographie<{ tmdb_id: number }>>) => new Map(Object.entries(etats).map(([id, e]) => [Number(id), e]))
  const pret = (...ids: number[]): EtatFilmographie<{ tmdb_id: number }> => ({ statut: 'pret', films: ids.map((tmdb_id) => ({ tmdb_id })) })

  it('rapproche le réalisateur par son nom, sans accents ni casse', () => {
    const reperes = reperesSuivis([{ name: 'Céline Sciamma' }], new Map())

    // Allociné et TMDB écrivent parfois différemment : « CELINE SCIAMMA » retrouve « Céline Sciamma ».
    expect(marqueEnCours(reperes, { tmdb_id: 42, directors: ['CELINE SCIAMMA'] })).toBe('realisateur')
    // Mutation : une comparaison brute (sans `normaliser`) manquerait celui-ci.
    expect(marqueEnCours(reperes, { tmdb_id: 42, directors: ['Céline Sciamma'] })).toBe('realisateur')
    expect(marqueEnCours(reperes, { tmdb_id: 42, directors: ['Alix Delaporte'] })).toBeNull()
  })

  it('rapproche la saga par le tmdb_id d’un de ses films', () => {
    const reperes = reperesSuivis([], sagas({ 8091: pret(348, 679) }))

    expect(marqueEnCours(reperes, { tmdb_id: 679, directors: ['Quelqu’un'] })).toBe('saga')
    expect(marqueEnCours(reperes, { tmdb_id: 12, directors: [] })).toBeNull()
    expect(marqueProchaine(reperes, { tmdb_id: 348 })).toBe('saga')
    expect(marqueProchaine(reperes, { tmdb_id: 12 })).toBeNull()
  })

  it('une filmographie en attente ou en panne ne contribue rien', () => {
    const reperes = reperesSuivis([], sagas({ 1: { statut: 'attente' }, 2: { statut: 'indisponible' } }))

    expect(reperes.filmsDeSagas.size).toBe(0)
  })

  it('le réalisateur l’emporte quand les deux sont vrais', () => {
    const reperes = reperesSuivis([{ name: 'Peter Jackson' }], sagas({ 1: pret(120) }))

    // Mutation : inverser l'ordre des deux tests rendrait « saga ».
    expect(marqueEnCours(reperes, { tmdb_id: 120, directors: ['Peter Jackson'] })).toBe('realisateur')
  })

  it('une tuile sans tmdb_id ne porte aucune marque', () => {
    const reperes = reperesSuivis([{ name: 'Peter Jackson' }], new Map())

    expect(marqueEnCours(reperes, { tmdb_id: null, directors: ['Peter Jackson'] })).toBeNull()
  })

  it('la semaine prochaine ne porte que la saga : TMDB n’y donne pas de réalisateur', () => {
    const reperes = reperesSuivis([{ name: 'Peter Jackson' }], sagas({ 1: pret(120) }))

    expect(marqueProchaine(reperes, { tmdb_id: 120 })).toBe('saga')
    expect(marqueProchaine(reperesSuivis([{ name: 'Peter Jackson' }], new Map()), { tmdb_id: 120 })).toBeNull()
  })
})
