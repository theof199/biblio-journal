import { describe, expect, it } from 'vitest'
import type { Voyage } from '../../api/voyage'
import { fichePrete, filmDeSalle, salle, voyage1890 } from '../../test/voyage'
import { cartonDeSalle, etatDeFete, sceneDuRattrapage, scenesDuRetour, type EtatDeFete } from './scenes'

const RIEN: EtatDeFete = { sallesCompletes: 0, salles: [], recompense: null, ticket: null }
const LUMIERE = { id: 's-lumiere', nom: 'Les frères Lumière' }

describe('les scènes d’une célébration', () => {
  // Mutations : le garde de chaque scène retourné (`>=` pour les salles, le rang ignoré pour la
  // récompense, `avant.ticket === null` retiré) : une fiche relue sans rien de neuf ferait la fête.
  it('rien ne se joue quand rien ne change', () => {
    expect(scenesDuRetour(1896, RIEN, RIEN)).toEqual([])
    const plein: EtatDeFete = { sallesCompletes: 2, salles: [LUMIERE], recompense: 'palme', ticket: 1897 }
    expect(scenesDuRetour(1896, plein, plein)).toEqual([])
  })

  // Mutation : la salle nommée d'après toutes les salles complètes, celles d'avant comprises.
  it('une salle bouclée seule, nommée par celle qui vient de l’être', () => {
    const avant: EtatDeFete = { ...RIEN, sallesCompletes: 1, salles: [{ id: 's-melies', nom: 'Méliès' }] }
    const apres: EtatDeFete = { ...RIEN, sallesCompletes: 2, salles: [{ id: 's-melies', nom: 'Méliès' }, LUMIERE] }
    expect(scenesDuRetour(1896, avant, apres)).toEqual([{ type: 'salle', noms: ['Les frères Lumière'], combien: 1 }])
  })

  // Le compte de l'API déclenche, pas la liste dérivée de la fiche. Mutations : déclencher sur la
  // liste (rien ne se jouerait ici) ; une progression inconnue comptée pour zéro (une fiche jamais
  // ouverte bouclerait toutes ses salles d'un coup).
  it('le compte de l’API boucle la salle, et une progression inconnue n’en boucle aucune', () => {
    expect(scenesDuRetour(1896, RIEN, { ...RIEN, sallesCompletes: 1 })).toEqual([{ type: 'salle', noms: [], combien: 1 }])
    expect(scenesDuRetour(1896, { ...RIEN, sallesCompletes: null }, { ...RIEN, sallesCompletes: 2, salles: [LUMIERE] })).toEqual([])
    expect(scenesDuRetour(1896, { ...RIEN, sallesCompletes: 2 }, { ...RIEN, sallesCompletes: 1 })).toEqual([])
  })

  // Mutations : toute récompense présente fêtée (`lion` relu, `lion` rejoué) ; un recul fêté.
  it('une récompense seule : celle qu’on gagne, jamais celle qu’on avait ni un recul', () => {
    expect(scenesDuRetour(1896, RIEN, { ...RIEN, recompense: 'ours' })).toEqual([{ type: 'recompense', annee: 1896, recompense: 'ours' }])
    expect(scenesDuRetour(1896, { ...RIEN, recompense: 'ours' }, { ...RIEN, recompense: 'lion' })).toEqual([{ type: 'recompense', annee: 1896, recompense: 'lion' }])
    expect(scenesDuRetour(1896, { ...RIEN, recompense: 'lion' }, { ...RIEN, recompense: 'lion' })).toEqual([])
    expect(scenesDuRetour(1896, { ...RIEN, recompense: 'palme' }, { ...RIEN, recompense: 'lion' })).toEqual([])
  })

  // Mutation : l'année bouclée jouée tant que le ticket attend (elle se rejouerait à chaque billet).
  it('l’année bouclée seule : le ticket qui vient d’être gagné', () => {
    const lion: EtatDeFete = { ...RIEN, recompense: 'lion' }
    expect(scenesDuRetour(1896, lion, { ...lion, ticket: 1897 })).toEqual([{ type: 'annee', annee: 1896, recompense: 'lion', ticket: 1897 }])
    expect(scenesDuRetour(1896, { ...lion, ticket: 1897 }, { ...lion, ticket: 1897 })).toEqual([])
  })

  // Mutation : les scènes poussées dans un autre ordre (l'année avant sa récompense).
  it('ensemble : la salle, puis la récompense, puis l’année', () => {
    const apres: EtatDeFete = { sallesCompletes: 2, salles: [LUMIERE], recompense: 'palme', ticket: 1897 }
    expect(scenesDuRetour(1896, { ...RIEN, sallesCompletes: 1, recompense: 'lion' }, apres).map((s) => s.type)).toEqual(['salle', 'recompense', 'annee'])
  })

  // Mutations : les essentiels comptés parmi les salles nommées ; une salle vide dite complète ; un
  // ticket utilisé, ou vers une année déjà ouverte, compté comme à utiliser.
  it('l’état d’une fiche : ses salles complètes hors essentiels, sa récompense, le ticket qu’elle offre', () => {
    const vu = filmDeSalle({ id: 'f1', tmdb_id: 1, etat: 'vu' })
    const perdu = filmDeSalle({ id: 'f2', tmdb_id: 2, etat: 'introuvable' })
    const reste = filmDeSalle({ id: 'f3', tmdb_id: 3, etat: 'a_demander' })
    const fiche = fichePrete({
      annee: 1896,
      recompense: 'lion',
      progression: { essentiels_vus: 1, essentiels_total: 1, salles_completes: 1, salles_autres: 2 },
      ticket: { annee: 1897, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: null },
      salles: [
        salle({ id: 's-ess', nom: 'Les essentiels', cle: 'essentiels', films: [vu] }),
        salle({ ...LUMIERE, films: [vu, perdu] }),
        salle({ id: 's-reste', nom: 'À finir', films: [vu, reste] }),
        salle({ id: 's-vide', nom: 'Vide', films: [] }),
      ],
    })
    expect(etatDeFete(fiche, 1896)).toEqual({ sallesCompletes: 1, salles: [LUMIERE], recompense: 'lion', ticket: 1897 })
    expect(etatDeFete(fiche, 1897).ticket).toBeNull()
    expect(etatDeFete({ ...fiche, ticket: { ...fiche.ticket!, utilise_le: '2026-09-22T10:00:00.000Z' } }, 1896).ticket).toBeNull()
    expect(etatDeFete({ ...fiche, ticket: null, progression: null }, 1896)).toMatchObject({ sallesCompletes: null, ticket: null })
  })

  // Mutations : l'année bouclée prise pour celle que le ticket ouvre ; la récompense d'une autre année.
  it('le rattrapage : l’année d’avant le ticket à montrer, et rien sans lui', () => {
    const v: Voyage = voyage1890(1896, [
      { annee: 1895, recompense: 'palme' },
      { annee: 1896, recompense: 'lion' },
      { annee: 1897, recompense: null },
    ])
    expect(sceneDuRattrapage(v)).toBeNull()
    const ticket = { annee: 1897, motif: 'Tu as fait le tour.', emis_le: '2026-09-21T21:00:00.000Z' }
    expect(sceneDuRattrapage({ ...v, ticket_a_montrer: ticket })).toEqual({ type: 'annee', annee: 1896, recompense: 'lion', ticket: 1897 })
  })

  // Mutation : le nom de la première salle pris quand deux se bouclent d'un coup.
  it('le carton nomme la salle seule, sinon compte', () => {
    expect(cartonDeSalle({ type: 'salle', noms: ['Méliès'], combien: 1 })).toEqual({ sur: 'Salle complète', titre: 'Méliès' })
    expect(cartonDeSalle({ type: 'salle', noms: ['Méliès', 'Lumière'], combien: 2 })).toEqual({ sur: 'Salles complètes', titre: '2 salles' })
    expect(cartonDeSalle({ type: 'salle', noms: [], combien: 1 })).toEqual({ sur: 'Salle complète', titre: 'Une salle' })
  })
})
