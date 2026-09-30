import { describe, expect, it } from 'vitest'
import { anneauDuPasseport, anneesDuTampon, ceQuiManque, enumerer, phraseDuPasseport, tamponDe } from './passeport'
import { annee } from '../test/voyage'
import type { Ticket } from '../api/voyage'

const TAMPON = { decennie: 1890, boucle_le: '2026-01-14T10:00:00.000Z' }
const ticket = (a: number, utilise: boolean): Ticket => ({
  annee: a,
  motif: `Motif ${a}`,
  emis_le: '2026-09-21T21:00:00.000Z',
  montre_le: null,
  utilise_le: utilise ? '2026-09-22T08:00:00.000Z' : null,
})

describe('le tampon d’une décennie', () => {
  // Mutation : trouver le tampon d'une autre décennie (le premier du passeport).
  it('se lit au passeport, pour sa seule décennie', () => {
    expect(tamponDe([{ decennie: 1900, boucle_le: TAMPON.boucle_le }, TAMPON], 1890)).toEqual(TAMPON)
    expect(tamponDe([{ decennie: 1900, boucle_le: TAMPON.boucle_le }], 1890)).toBeNull()
  })

  // Mutation : partir de la décennie sans regarder le départ (1890 à 1894 compteraient).
  it('ne compte que les années du Voyage, du départ à la fin de la décennie', () => {
    expect(anneesDuTampon(1890, 1895)).toEqual([1895, 1896, 1897, 1898, 1899])
    expect(anneesDuTampon(1900, 1895)).toEqual([1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909])
  })
})

describe('ce qui manque au tampon', () => {
  const carte = [
    annee({ annee: 1895, recompense: 'palme' }),
    annee({ annee: 1896, recompense: 'lion' }),
    annee({ annee: 1897, recompense: null }),
    annee({ annee: 1898, recompense: 'ours' }),
    annee({ annee: 1899, recompense: null }),
    annee({ annee: 1900, recompense: 'ours' }),
  ]

  // Mutations : une récompense réduite à l'Ours (le Lion et la Palme ne compteraient pas) ; une année
  // d'une autre décennie comptée ; le ticket de la décennie elle-même au lieu de la suivante.
  it('dit les années sans récompense et le ticket de la décennie suivante', () => {
    expect(ceQuiManque(carte, [ticket(1890, true), ticket(1900, false)], 1890, 1895)).toEqual({ annees: [1897, 1899], ticket: 1900 })
  })

  // Mutation : le ticket compté dès qu'il est émis, sans regarder `utilise_le`.
  it('ne tient le ticket pour acquis qu’utilisé', () => {
    expect(ceQuiManque(carte, [ticket(1900, true)], 1890, 1895).ticket).toBeNull()
    expect(ceQuiManque(carte, [ticket(1900, false)], 1890, 1895).ticket).toBe(1900)
    expect(ceQuiManque(carte, [], 1890, 1895).ticket).toBe(1900)
  })

  // Jumeau de `ticketsUtilises.get(fin + 1)` dans `calculerTampons` : ce ticket-là, aucun autre.
  // Mutation : `>=` au lieu de `===` (un ticket de 1910 utilisé tiendrait lieu de celui de 1900).
  it('ne demande que le ticket de la décennie suivante, pas un plus tardif', () => {
    expect(ceQuiManque(carte, [ticket(1910, true)], 1890, 1895).ticket).toBe(1900)
  })

  it('compte une année absente de la carte comme sans récompense', () => {
    expect(ceQuiManque([annee({ annee: 2020, recompense: 'ours' })], [], 2020, 1895).annees).toEqual([2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029])
  })

  // Mutation : l'anneau sur toutes les années de la carte (1900 compterait pour les années 1890).
  it('fait l’anneau des années du tampon qui ont leur récompense', () => {
    expect(anneauDuPasseport(carte, 1890, 1895)).toEqual({ faites: 3, total: 5 })
  })
})

describe('la phrase du livret', () => {
  it('énumère en français', () => {
    expect(enumerer([1897])).toBe('1897')
    expect(enumerer([1897, 1899])).toBe('1897 et 1899')
    expect(enumerer([1896, 1897, 1899])).toBe('1896, 1897 et 1899')
  })

  // Mutations : la phrase dite alors que le tampon est posé ; le ticket tu.
  it('dit ce qui manque, et se tait quand le tampon est posé', () => {
    expect(phraseDuPasseport({ annees: [1897, 1899], ticket: 1900 }, null)).toBe('Il manque une récompense en 1897 et 1899, et le ticket de 1900.')
    expect(phraseDuPasseport({ annees: [], ticket: 1900 }, null)).toBe('Il manque le ticket de 1900.')
    expect(phraseDuPasseport({ annees: [1897], ticket: null }, null)).toBe('Il manque une récompense en 1897.')
    expect(phraseDuPasseport({ annees: [1897], ticket: 1900 }, TAMPON)).toBeNull()
  })
})
