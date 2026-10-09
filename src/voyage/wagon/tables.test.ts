import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Table } from '../../api/voyage'
import { gestesOfferts, roleA, soirPasse } from './tables'

// Les règles d'une table du wagon-restaurant (plan des écrans des lots, brief 15), sans rendu.
const MOI = '11111111-1111-4111-8111-111111111111'
const LUI = '22222222-2222-4222-8222-222222222222'
const membre = (id: string) => ({ id }) as Table['hote']
const table = (etat: Table['etat'], hote = LUI, soir = '2026-10-09') => ({ hote: membre(hote), soir, etat })
const a = (iso: string) => Date.parse(iso)
/** Le 9 octobre 2026, 20 h à Paris. */
const CE_SOIR = a('2026-10-09T18:00:00Z')
const RIEN = { prendre: false, decliner: false }

describe('les règles d’une table', () => {
  afterEach(() => vi.unstubAllEnvs())

  // Mutation : `roleA` rend toujours « invite » (le rôle non regardé).
  it('je suis l’hôte quand `hote.id` est le mien, l’invité sinon', () => {
    expect(roleA(table('attend', MOI), MOI)).toBe('hote')
    expect(roleA(table('attend', LUI), MOI)).toBe('invite')
  })

  // Mutations : le rôle non regardé (l'hôte reçoit les deux gestes) ; « Prendre ma place » offert tant
  // que le soir tient (une table déclinée se reprendrait) ; « Décliner » retiré une fois la place prise.
  it('les deux gestes à l’invité qui attend, « Décliner » seul une fois la place prise, plus rien une fois déclinée, jamais rien à l’hôte', () => {
    expect(gestesOfferts(table('attend'), MOI, CE_SOIR)).toEqual({ prendre: true, decliner: true })
    expect(gestesOfferts(table('a_pris_sa_place'), MOI, CE_SOIR)).toEqual({ prendre: false, decliner: true })
    expect(gestesOfferts(table('a_decline'), MOI, CE_SOIR)).toEqual(RIEN)
    for (const etat of ['attend', 'a_pris_sa_place', 'a_decline'] as const) expect(gestesOfferts(table(etat, MOI), MOI, CE_SOIR)).toEqual(RIEN)
  })

  // À 23 h 30 de Greenwich, c'est déjà demain à Paris. Mutations : le jour pris à Greenwich
  // (`timeZone: 'UTC'`) ; le fuseau de l'appareil (`timeZone` retiré : rouge sous Los Angeles) ; les
  // deux jours comparés à l'envers ; la garde du soir retirée de `gestesOfferts`.
  it.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo'])('un soir se dit à Paris, appareil réglé sur %s : à 23 h 30 de Greenwich il est passé', (fuseau) => {
    vi.stubEnv('TZ', fuseau)
    // 23 h 59 à Paris : le soir tient encore.
    expect(soirPasse('2026-10-09', a('2026-10-09T21:59:00Z'))).toBe(false)
    expect(gestesOfferts(table('attend'), MOI, a('2026-10-09T21:59:00Z'))).toEqual({ prendre: true, decliner: true })
    // 23 h 30 de Greenwich, 1 h 30 à Paris le lendemain.
    expect(soirPasse('2026-10-09', a('2026-10-09T23:30:00Z'))).toBe(true)
    expect(gestesOfferts(table('attend'), MOI, a('2026-10-09T23:30:00Z'))).toEqual(RIEN)
    expect(gestesOfferts(table('a_pris_sa_place'), MOI, a('2026-10-09T23:30:00Z'))).toEqual(RIEN)
    // 0 h 30 à Paris le 9, encore le 8 à Greenwich : la table du 8 est passée, celle du 9 est de ce soir.
    expect(soirPasse('2026-10-08', a('2026-10-08T22:30:00Z'))).toBe(true)
    expect(soirPasse('2026-10-09', a('2026-10-08T22:30:00Z'))).toBe(false)
  })

  // Deux jours se comparent en instants : d'un mois à l'autre, d'une année à l'autre. Un soir que
  // l'appareil croit à venir (son horloge retarde) n'est pas passé : le serveur tranchera.
  // Mutations : `>=` devenu `>` (le soir même serait passé) ; un soir illisible tenu pour à venir.
  it('le soir même tient, la veille est passée, un soir illisible aussi', () => {
    expect(soirPasse('2026-10-09', CE_SOIR)).toBe(false)
    expect(soirPasse('2026-10-08', CE_SOIR)).toBe(true)
    expect(soirPasse('2026-09-30', CE_SOIR)).toBe(true)
    expect(soirPasse('2025-12-31', CE_SOIR)).toBe(true)
    expect(soirPasse('2026-10-10', CE_SOIR)).toBe(false)
    expect(soirPasse('bientôt', CE_SOIR)).toBe(true)
  })
})
