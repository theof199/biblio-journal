import { describe, expect, it } from 'vitest'
import {
  appliquerFiltres,
  auCinema,
  basculerNote,
  basculerOrdreDate,
  basculerReactionFiltre,
  compteEnTete,
  FILTRES_INITIAUX,
  filtresActifs,
  libellePuceDate,
  libellePuceNote,
  libellePuceReaction,
  motsReactions,
  type FiltresMesFilms,
} from './filtres'
import { exemple } from '../test/contrat'
import type { JournalItem, JournalPage } from '../api/journal'
import type { ReactionsCatalogue } from '../api/reactions'

const BASE = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!
const CATALOGUE = exemple<ReactionsCatalogue>('/reference/reactions', 'get', 200).reactions

/** Un visionnage dérivé de `BASE`, avec un identifiant distinct — dates espacées à la main. */
function film(overrides: {
  id: string
  title?: string
  director?: string | null
  finished_at: string
  rating?: number | null
  reactions?: string[]
}): JournalItem {
  return {
    ...BASE,
    entry: { ...BASE.entry, id: overrides.id, finished_at: overrides.finished_at, rating: overrides.rating ?? null },
    media: { ...BASE.media, title: overrides.title ?? BASE.media.title, director: overrides.director ?? BASE.media.director },
    carnet: { ...BASE.carnet, reactions: overrides.reactions ?? [] },
  }
}

const INCEPTION = film({ id: '1', title: 'Inception', director: 'Christopher Nolan', finished_at: '2026-01-10', rating: 9 })
const CHIHIRO = film({
  id: '2',
  title: 'Le Voyage de Chihiro',
  director: 'Hayao Miyazaki',
  finished_at: '2026-03-05',
  rating: 8,
  reactions: ['adore', 'touche'],
})
const SANS_NOTE = film({ id: '3', title: 'Un film oublié', director: null, finished_at: '2026-02-20', rating: null })

describe('filtresActifs', () => {
  it('est faux par défaut', () => {
    expect(filtresActifs(FILTRES_INITIAUX)).toBe(false)
  })

  it('un texte fait seulement d’espaces ne compte pas', () => {
    expect(filtresActifs({ ...FILTRES_INITIAUX, texte: '   ' })).toBe(false)
  })

  it.each<[string, FiltresMesFilms]>([
    ['un texte', { ...FILTRES_INITIAUX, texte: 'incep' }],
    ['un tri par note', { ...FILTRES_INITIAUX, tri: 'note_desc' }],
    ['un tri par date ancien', { ...FILTRES_INITIAUX, tri: 'date_asc' }],
    ['une note cochée', { ...FILTRES_INITIAUX, notes: [8] }],
    ['une réaction cochée', { ...FILTRES_INITIAUX, reactions: ['adore'] }],
  ])('%s active le chargement complet', (_nom, f) => {
    expect(filtresActifs(f)).toBe(true)
  })
})

describe('appliquerFiltres — liste vide', () => {
  it('rend une liste vide sans planter', () => {
    expect(appliquerFiltres([], FILTRES_INITIAUX)).toEqual([])
  })

  it('une liste vide reste vide avec des filtres actifs', () => {
    expect(appliquerFiltres([], { ...FILTRES_INITIAUX, texte: 'inception', notes: [9] })).toEqual([])
  })
})

describe('appliquerFiltres — recherche', () => {
  const items = [INCEPTION, CHIHIRO, SANS_NOTE]

  it('cherche dans le titre, insensible à la casse et aux accents', () => {
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, texte: 'INCEP' }).map((i) => i.entry.id)).toEqual(['1'])
  })

  it('cherche aussi dans le réalisateur : « miya » trouve Miyazaki', () => {
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, texte: 'miya' }).map((i) => i.entry.id)).toEqual(['2'])
  })

  it('un film sans réalisateur ne fait pas planter la recherche', () => {
    expect(() => appliquerFiltres(items, { ...FILTRES_INITIAUX, texte: 'oublié' })).not.toThrow()
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, texte: 'oublié' }).map((i) => i.entry.id)).toEqual(['3'])
  })

  it('un texte vide ou blanc ne filtre rien', () => {
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, texte: '   ' })).toHaveLength(3)
  })

  it('rien trouvé rend une liste vide', () => {
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, texte: 'introuvable' })).toEqual([])
  })
})

describe('appliquerFiltres — notes (ou)', () => {
  const items = [INCEPTION, CHIHIRO, SANS_NOTE]

  it('garde les notes cochées, en ou', () => {
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, notes: [9] }).map((i) => i.entry.id)).toEqual(['1'])
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, notes: [9, 8] }).map((i) => i.entry.id).sort()).toEqual(['1', '2'])
  })

  // Cas limite explicitement attendu par la spec : un film sans note est écarté dès qu'une note est cochée.
  it('écarte un film sans note dès qu’une note est cochée', () => {
    const visibles = appliquerFiltres(items, { ...FILTRES_INITIAUX, notes: [9, 8] })
    expect(visibles.find((i) => i.entry.id === '3')).toBeUndefined()
  })

  it('sans note cochée, un film sans note reste visible', () => {
    expect(appliquerFiltres(items, FILTRES_INITIAUX).map((i) => i.entry.id)).toContain('3')
  })
})

describe('appliquerFiltres — réactions (et)', () => {
  it('garde seulement les visionnages qui portent toutes les réactions cochées', () => {
    const items = [CHIHIRO, film({ id: '4', finished_at: '2026-04-01', reactions: ['adore'] })]
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, reactions: ['adore'] }).map((i) => i.entry.id).sort()).toEqual([
      '2',
      '4',
    ])
    expect(appliquerFiltres(items, { ...FILTRES_INITIAUX, reactions: ['adore', 'touche'] }).map((i) => i.entry.id)).toEqual([
      '2',
    ])
  })
})

describe('appliquerFiltres — combinaison texte, notes et réactions', () => {
  it('applique les trois filtres à la fois (et)', () => {
    const items = [INCEPTION, CHIHIRO, SANS_NOTE]
    const visibles = appliquerFiltres(items, { ...FILTRES_INITIAUX, texte: 'voyage', notes: [8], reactions: ['adore'] })
    expect(visibles.map((i) => i.entry.id)).toEqual(['2'])
  })
})

describe('appliquerFiltres — tri', () => {
  // Dates espacées à la main, jamais une pause : `parDate` compare des chaînes ISO déjà distinctes.
  const ancien = film({ id: 'a', finished_at: '2026-01-01', rating: 5 })
  const milieu = film({ id: 'b', finished_at: '2026-02-01', rating: null })
  const recent = film({ id: 'c', finished_at: '2026-03-01', rating: 5 })

  it('date_desc : récents d’abord (le tri par défaut)', () => {
    expect(appliquerFiltres([ancien, recent, milieu], FILTRES_INITIAUX).map((i) => i.entry.id)).toEqual(['c', 'b', 'a'])
  })

  it('date_asc : anciens d’abord', () => {
    expect(appliquerFiltres([ancien, recent, milieu], { ...FILTRES_INITIAUX, tri: 'date_asc' }).map((i) => i.entry.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('note_desc : les films sans note passent en dernier, une égalité de note départagée par la date', () => {
    // `ancien` et `recent` partagent la même note (5) : l'égalité retombe sur la date, récent d'abord.
    expect(appliquerFiltres([ancien, recent, milieu], { ...FILTRES_INITIAUX, tri: 'note_desc' }).map((i) => i.entry.id)).toEqual(
      ['c', 'a', 'b'],
    )
  })
})

describe('basculerOrdreDate', () => {
  it('inverse récents ↔ anciens', () => {
    expect(basculerOrdreDate('date_desc')).toBe('date_asc')
    expect(basculerOrdreDate('date_asc')).toBe('date_desc')
  })

  // Décision explicite de la référence : depuis un tri par note, on revient au défaut (récents
  // d'abord), on ne saute jamais directement aux anciens.
  it('depuis un tri par note, revient au tri par date par défaut', () => {
    expect(basculerOrdreDate('note_desc')).toBe('date_desc')
  })
})

describe('basculerNote', () => {
  it('coche une note absente', () => {
    expect(basculerNote([], 7)).toEqual([7])
  })

  it('décoche une note déjà cochée, sans toucher aux autres', () => {
    expect(basculerNote([4, 7], 4)).toEqual([7])
  })
})

describe('basculerReactionFiltre', () => {
  it('coche une réaction absente', () => {
    expect(basculerReactionFiltre([], 'adore')).toEqual(['adore'])
  })

  it('décoche une réaction déjà cochée', () => {
    expect(basculerReactionFiltre(['adore', 'touche'], 'adore')).toEqual(['touche'])
  })
})

describe('libellePuceDate', () => {
  it('dit l’ordre courant', () => {
    expect(libellePuceDate('date_desc')).toBe('Date, récents d’abord')
    expect(libellePuceDate('date_asc')).toBe('Date, anciens d’abord')
    // Le tri par note n'est pas un ordre de date : la puce garde son libellé par défaut.
    expect(libellePuceDate('note_desc')).toBe('Date, récents d’abord')
  })
})

describe('libellePuceNote', () => {
  it('sans rien coché ni trier', () => {
    expect(libellePuceNote(FILTRES_INITIAUX)).toBe('Note')
  })

  it('avec le tri par note seul', () => {
    expect(libellePuceNote({ ...FILTRES_INITIAUX, tri: 'note_desc' })).toBe('Note, tri')
  })

  it('avec des notes cochées, sans le tri', () => {
    expect(libellePuceNote({ ...FILTRES_INITIAUX, notes: [4, 7] })).toBe('Note · 2')
  })

  it('avec le tri et des notes cochées', () => {
    expect(libellePuceNote({ ...FILTRES_INITIAUX, tri: 'note_desc', notes: [4] })).toBe('Note, tri · 1')
  })
})

describe('libellePuceReaction', () => {
  it('sans rien coché', () => {
    expect(libellePuceReaction(FILTRES_INITIAUX)).toBe('Réaction')
  })

  it('avec des réactions cochées', () => {
    expect(libellePuceReaction({ ...FILTRES_INITIAUX, reactions: ['adore', 'touche'] })).toBe('Réaction · 2')
  })
})

describe('motsReactions', () => {
  it('rend les réactions dans l’ordre du catalogue, séparées par « · »', () => {
    // `touche` précède `adore` ici, dans l'ordre inverse du catalogue : la sortie doit suivre le
    // catalogue (adore avant touche), pas l'ordre d'écriture du tableau.
    expect(motsReactions(['touche', 'adore'], CATALOGUE)).toBe('J’ai adoré · Ça m’a touché')
  })

  it('omet `en_salle`, dite ailleurs par l’icône', () => {
    expect(motsReactions(['adore', 'en_salle'], CATALOGUE)).toBe('J’ai adoré')
  })

  it('rend une chaîne vide sans réaction', () => {
    expect(motsReactions([], CATALOGUE)).toBe('')
  })
})

describe('auCinema', () => {
  it('vrai quand `en_salle` est posée', () => {
    expect(auCinema(['en_salle'])).toBe(true)
  })

  it('faux sinon, y compris sans aucune réaction', () => {
    expect(auCinema(['adore'])).toBe(false)
    expect(auCinema([])).toBe(false)
  })
})

describe('compteEnTete', () => {
  it('rend nul tant que le total n’est pas là', () => {
    expect(compteEnTete(undefined, undefined)).toBeNull()
    expect(compteEnTete(null, 3)).toBeNull()
  })

  it('accorde au singulier pour un seul film, sans année', () => {
    expect(compteEnTete(1, undefined)).toBe('1 film')
  })

  it('accorde au pluriel au-delà, sans année', () => {
    expect(compteEnTete(87, null)).toBe('87 films')
  })

  it('ajoute l’année quand elle est connue', () => {
    expect(compteEnTete(87, 12)).toBe('87 films · 12 cette année')
  })
})
