import { describe, expect, it } from 'vitest'
import { dejaDansLeJournal, messageAuCine, miseAJourAffichee, seancesCetteAnnee, sousTitreCinemas } from './etats'
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

  // Le fuseau Europe/Paris est déjà fixé pour toute la suite (`vite.config.ts`, `test.env.TZ`) :
  // ce test le prouverait même sans, `timeZone` étant posé en dur dans `miseAJourAffichee`.
  it('un calcul proche de minuit UTC change le jour à Paris, sans casser l’heure affichée', () => {
    // 22h30 UTC en septembre (CEST, +2) : 00h30 le lendemain à Paris.
    expect(miseAJourAffichee('2026-09-15T22:30:00.000Z')).toBe('mis à jour à 0 h')
    // 23h05 UTC en janvier (CET, +1) : 00h05 le lendemain à Paris — l'hiver ne change rien à la règle.
    expect(miseAJourAffichee('2026-01-15T23:05:00.000Z')).toBe('mis à jour à 0 h')
  })
})
