import { describe, expect, it } from 'vitest'
import { exemple } from '../test/contrat'
import { DECENNIES, compteAccueil, decennieDeAnnee, etatFronton, formatJour } from './fronton'
import type { EtatFronton } from './fronton'
import type { CarteEnsuite } from './ensuite'
import type { JournalItem, JournalPage } from '../api/journal'
import type { PlexFilm } from '../api/plex'
import type { FilmRealisateur } from '../api/realisateurs'
import type { SeancePrise } from '../api/voyage'

describe('formatJour', () => {
  it('écrit le jour en toutes lettres, capitalisé', () => {
    expect(formatJour(new Date(2026, 8, 24))).toBe('Jeudi 24 septembre')
  })

  it('ordinalise le premier du mois', () => {
    expect(formatJour(new Date(2026, 9, 1))).toBe('Jeudi 1er octobre')
  })
})

describe('compteAccueil', () => {
  it('rend nul tant que /stats n’a pas répondu', () => {
    expect(compteAccueil(undefined)).toBeNull()
    expect(compteAccueil(null)).toBeNull()
  })

  it('dit « Aucun film encore » à zéro, jamais « 0 film »', () => {
    expect(compteAccueil(0)).toBe('Aucun film encore')
  })

  it('accorde au singulier pour un seul film', () => {
    expect(compteAccueil(1)).toBe('1 film cette année')
  })

  it('accorde au pluriel au-delà', () => {
    expect(compteAccueil(12)).toBe('12 films cette année')
  })
})

const MAINTENANT = new Date(2026, 8, 30)

const SEANCE: SeancePrise = {
  id: 'a0000000-0000-4000-8000-000000000001',
  annee: 1927,
  long: { title: 'Metropolis', cover_url: null },
  court: { title: 'La Bataille du siècle' },
}

const CARTE_REALISATEUR: CarteEnsuite = {
  source: 'realisateur',
  encours: {
    entite: { tmdb_id: 1, name: 'Buster Keaton', profile_url: null, ajoute_le: '2026-09-01T00:00:00.000Z' },
    prochain: { tmdb_id: 2, title: 'Le Mécano de la « General »', year: 1926, cover_url: null } as FilmRealisateur,
  },
}

const CARTE_PLEX: CarteEnsuite = { source: 'plex', film: { tmdb_id: 3, title: 'Casablanca', year: 1942, cover_url: null } as PlexFilm }

const derniereLigne = (etat: EtatFronton) => etat.lignes[etat.lignes.length - 1]

const DERNIER = exemple<JournalPage>('/me/journal', 'get', 200).items[0]!

function avecEntree(entree: Partial<JournalItem['entry']>, titre = 'L’Aurore'): JournalItem {
  return { ...DERNIER, entry: { ...DERNIER.entry, ...entree }, media: { ...DERNIER.media, title: titre } }
}

describe('etatFronton', () => {
  it('annonce la séance prise et mène au Voyage, avant toute autre carte', () => {
    const etat = etatFronton(MAINTENANT, SEANCE, [CARTE_PLEX], DERNIER)
    expect(etat.genre).toBe('seance')
    expect(etat.cible).toEqual({ to: '/voyage' })
  })

  it('écrit la séance avec son court et l’année du Voyage', () => {
    expect(etatFronton(MAINTENANT, SEANCE, [], null).lignes).toEqual([
      { role: 'jour', texte: 'Mercredi 30 septembre' },
      { role: 'etiquette', texte: 'Ce soir' },
      { role: 'titre', texte: 'Metropolis' },
      { role: 'detail', texte: '+ La Bataille du siècle · court' },
      { role: 'detail', texte: 'Voyage 1927' },
    ])
  })

  it('omet la ligne du court quand la séance n’en a pas', () => {
    const lignes = etatFronton(MAINTENANT, { ...SEANCE, court: null }, [], null).lignes
    expect(lignes.map((ligne) => ligne.texte)).toEqual(['Mercredi 30 septembre', 'Ce soir', 'Metropolis', 'Voyage 1927'])
  })

  it('annonce le premier « Ensuite » à défaut de séance, et ouvre le formulaire avec son candidat', () => {
    const etat = etatFronton(MAINTENANT, null, [CARTE_REALISATEUR, CARTE_PLEX], DERNIER)
    expect(etat.genre).toBe('prochainement')
    expect(etat.cible).toEqual({
      to: '/journal/nouveau',
      state: {
        candidat: {
          source: 'tmdb',
          external_id: '2',
          title: 'Le Mécano de la « General »',
          year: 1926,
          cover_url: null,
          director: 'Buster Keaton',
        },
      },
    })
  })

  it('écrit le prochain film sur deux lignes compactes, le réalisateur et l’année en accent', () => {
    expect(etatFronton(MAINTENANT, null, [CARTE_REALISATEUR], null).lignes).toEqual([
      { role: 'jour', texte: 'Mercredi 30 septembre' },
      { role: 'etiquette', texte: 'Prochainement' },
      { role: 'titreCompact', texte: 'Le Mécano de' },
      { role: 'titreCompact', texte: 'la « General »' },
      { role: 'accent', texte: 'Buster Keaton · 1926' },
    ])
  })

  it('met l’année seule en accent quand le film n’a pas de réalisateur', () => {
    expect(derniereLigne(etatFronton(MAINTENANT, null, [CARTE_PLEX], null))).toEqual({ role: 'accent', texte: '1942' })
  })

  it('n’ajoute aucune ligne d’accent quand le film n’a ni réalisateur ni année', () => {
    const sansAnnee: CarteEnsuite = { source: 'plex', film: { tmdb_id: 4, title: 'Sans date', year: null, cover_url: null } as PlexFilm }
    expect(etatFronton(MAINTENANT, null, [sansAnnee], null).lignes.map((ligne) => ligne.role)).toEqual(['jour', 'etiquette', 'titre'])
  })

  it('annonce la dernière entrée du journal quand rien n’attend, et mène à sa fiche', () => {
    const etat = etatFronton(MAINTENANT, null, [], DERNIER)
    expect(etat.genre).toBe('derniere')
    expect(etat.cible).toEqual({ to: `/journal/${DERNIER.entry.id}`, state: { item: DERNIER } })
  })

  it('écrit la dernière séance avec le jour de visionnage et la note', () => {
    const dernier = avecEntree({ finished_at: '2026-09-26', rating: 9 })
    expect(etatFronton(MAINTENANT, null, [], dernier).lignes).toEqual([
      { role: 'jour', texte: 'Mercredi 30 septembre' },
      { role: 'etiquette', texte: 'Dernière séance' },
      { role: 'titre', texte: 'L’Aurore' },
      { role: 'detail', texte: 'Samedi 26 septembre · 9 sur 10' },
    ])
  })

  it('n’écrit pas de note quand l’entrée n’en a pas', () => {
    const dernier = avecEntree({ finished_at: '2026-09-26', rating: null })
    expect(derniereLigne(etatFronton(MAINTENANT, null, [], dernier))).toEqual({ role: 'detail', texte: 'Samedi 26 septembre' })
  })

  it('ajoute l’année du visionnage quand ce n’est pas l’année en cours', () => {
    const dernier = avecEntree({ finished_at: '2025-12-31', rating: null })
    expect(derniereLigne(etatFronton(MAINTENANT, null, [], dernier))?.texte).toBe('Mercredi 31 décembre 2025')
  })

  it('invite à ouvrir la vitrine quand le journal est vide, et mène à la recherche', () => {
    const etat = etatFronton(MAINTENANT, null, [], null)
    expect(etat.genre).toBe('premiere')
    expect(etat.cible).toEqual({ to: '/recherche' })
    expect(etat.lignes).toEqual([
      { role: 'jour', texte: 'Mercredi 30 septembre' },
      { role: 'titre', texte: 'Ouverture' },
      { role: 'detail', texte: 'La vitrine attend' },
      { role: 'detail', texte: 'sa première affiche' },
    ])
  })

  it('garde un titre court sur une seule ligne en grandes lettres', () => {
    expect(etatFronton(MAINTENANT, { ...SEANCE, long: { title: 'Casablanca', cover_url: null } }, [], null).lignes[2]).toEqual({
      role: 'titre',
      texte: 'Casablanca',
    })
  })

  it('laisse sur une ligne compacte un titre long sans espace', () => {
    const lignes = etatFronton(MAINTENANT, { ...SEANCE, long: { title: 'Anticonstitutionnellement', cover_url: null } }, [], null).lignes
    expect(lignes[2]).toEqual({ role: 'titreCompact', texte: 'Anticonstitutionnellement' })
  })
})

describe('decennieDeAnnee', () => {
  it.each([
    [1890, 1890],
    [1899, 1890],
    [1900, 1900],
    [1927, 1920],
    [1942, 1940],
    [1999, 1990],
    [2026, 2020],
    [2029, 2020],
  ])('range %i dans la décennie %i', (annee, decennie) => {
    expect(decennieDeAnnee(annee)).toBe(decennie)
  })

  it('donne à chaque décennie dessinée sa propre enseigne', () => {
    expect(DECENNIES.map((decennie) => decennieDeAnnee(decennie + 5))).toEqual([...DECENNIES])
  })

  it('retombe sur l’enseigne de la maison sans année', () => {
    expect(decennieDeAnnee(null)).toBe(1940)
    expect(decennieDeAnnee(undefined)).toBe(1940)
  })

  it('retombe sur l’enseigne de la maison avant 1890', () => {
    expect(decennieDeAnnee(1889)).toBe(1940)
    expect(decennieDeAnnee(1850)).toBe(1940)
  })

  it('garde l’enseigne des années 2020 au-delà de 2029', () => {
    expect(decennieDeAnnee(2030)).toBe(2020)
    expect(decennieDeAnnee(2143)).toBe(2020)
  })
})

describe('l’enseigne de l’état du fronton', () => {
  const avecAnnee = (annee: number | null): JournalItem => {
    const item = avecEntree({})
    return { ...item, media: { ...item.media, year: annee } }
  }

  it('prend l’année de la séance prise', () => {
    expect(etatFronton(MAINTENANT, { ...SEANCE, annee: 1959 }, [CARTE_PLEX], avecAnnee(1985)).decennie).toBe(1950)
  })

  it('prend l’année du premier « Ensuite » à défaut de séance', () => {
    expect(etatFronton(MAINTENANT, null, [CARTE_REALISATEUR, CARTE_PLEX], avecAnnee(1985)).decennie).toBe(1920)
  })

  it('prend l’année de la dernière entrée du journal quand rien n’attend', () => {
    expect(etatFronton(MAINTENANT, null, [], avecAnnee(1985)).decennie).toBe(1980)
  })

  it('prend l’enseigne de la maison quand la dernière entrée n’a pas d’année', () => {
    expect(etatFronton(MAINTENANT, null, [], avecAnnee(null)).decennie).toBe(1940)
  })

  it('prend l’enseigne de la maison quand le journal est vide', () => {
    expect(etatFronton(MAINTENANT, null, [], null).decennie).toBe(1940)
  })
})
