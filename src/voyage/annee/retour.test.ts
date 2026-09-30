import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Progression } from '../../api/voyage'
import { DUREE_DU_RETOUR_MS, annonceDesAvancees, confierLeRetour, franchitUnPalier, oublierLeRetour, retourConfie } from './retour'

const PROGRESSION: Progression = { essentiels_vus: 2, essentiels_total: 2, salles_completes: 1, salles_autres: 3 }
const RETOUR = { avant: { profondeur: 2, progression: null }, guet: null }
const MOI = 'membre-1'
const AUTRE = 'membre-2'

describe('le retour d’un billet', () => {
  afterEach(() => {
    oublierLeRetour(1897)
    oublierLeRetour(1898)
  })

  // Mutations : le pluriel figé au singulier ; « +1 » écrit en dur ; les avancées sans séparateur.
  it('annonce chaque billet gagné, de combien, au pluriel s’il le faut', () => {
    expect(annonceDesAvancees([{ cle: 'films', avant: 2, apres: 3 }])).toBe('+1 film vu')
    expect(
      annonceDesAvancees([
        { cle: 'films', avant: 2, apres: 4 },
        { cle: 'essentiels', avant: 0, apres: 1 },
        { cle: 'salles', avant: 1, apres: 3 },
      ]),
    ).toBe('+2 films vus, +1 essentiel, +2 salles complètes')
    expect(annonceDesAvancees([])).toBe('')
  })

  // Mutations : seule l'arrivée comparée au palier (deux films d'un coup, de 2 à 4, passeraient
  // l'Ours sans vibrer) ; le départ compté (déjà à 3, on ne le franchit plus).
  it('franchit un palier dès qu’une valeur franchie l’atteint, jamais celui d’où l’on part', () => {
    expect(franchitUnPalier([{ cle: 'films', avant: 2, apres: 4 }], null)).toBe(true)
    expect(franchitUnPalier([{ cle: 'films', avant: 3, apres: 4 }], null)).toBe(false)
    expect(franchitUnPalier([{ cle: 'essentiels', avant: 1, apres: 2 }], PROGRESSION)).toBe(true)
    expect(franchitUnPalier([{ cle: 'salles', avant: 1, apres: 2 }], PROGRESSION)).toBe(true)
    expect(franchitUnPalier([{ cle: 'salles', avant: 0, apres: 1 }], PROGRESSION)).toBe(false)
  })

  // Mutations : le retour lu pour n'importe quelle année ; la lecture qui l'efface (le second appel
  // de l'initialiseur, sous `StrictMode`, ne le trouverait plus) ; l'oubli d'une autre année.
  it('se confie pour une année, se relit sans s’effacer, et ne s’oublie que pour elle', () => {
    confierLeRetour(1897, MOI, RETOUR)
    expect(retourConfie(1898, MOI)).toBeNull()
    expect(retourConfie(1897, MOI)).toBe(RETOUR)
    expect(retourConfie(1897, MOI)).toBe(RETOUR)
    oublierLeRetour(1898)
    expect(retourConfie(1897, MOI)).toBe(RETOUR)
    oublierLeRetour(1897)
    expect(retourConfie(1897, MOI)).toBeNull()
  })

  // Un retour que rien n'a pris ne se joue pas chez un autre membre connecté ensuite sur le même onglet.
  // Mutation : le membre ignoré.
  it('ne se rend qu’au membre qui a composté', () => {
    confierLeRetour(1897, MOI, RETOUR)
    expect(retourConfie(1897, AUTRE)).toBeNull()
    expect(retourConfie(1897, MOI)).toBe(RETOUR)
  })

  // Ni plus tard : l'année se monte dans la foulée du billet. Mutations : la durée ignorée ; la durée
  // comptée depuis la lecture.
  it('ne se rend plus passé sa durée', () => {
    vi.useFakeTimers()
    try {
      confierLeRetour(1897, MOI, RETOUR)
      vi.advanceTimersByTime(DUREE_DU_RETOUR_MS)
      expect(retourConfie(1897, MOI)).toBe(RETOUR)
      vi.advanceTimersByTime(1)
      expect(retourConfie(1897, MOI)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
