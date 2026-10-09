import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Table, Tables } from '../../api/voyage'
import { exemple } from '../../test/contrat'
import { ceSoirMeme, entreesVuesEnsemble, gestesOfferts, roleA, soirPasse, tablesDeLaPorte } from './tables'

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

  // « Ce soir » strict, pour la porte : `soirPasse` rend faux pour un soir à venir, qui n'est pourtant
  // pas ce soir. À 23 h 30 de Greenwich, c'est déjà demain à Paris. Mutations : `!soirPasse(soir)` à la
  // place de l'égalité (demain serait ce soir) ; le jour de Greenwich ; un soir illisible tenu pour ce soir.
  it('ce soir est le jour de Paris, ni la veille ni le lendemain', () => {
    expect(ceSoirMeme('2026-10-09', CE_SOIR)).toBe(true)
    expect(ceSoirMeme('2026-10-08', CE_SOIR)).toBe(false)
    expect(ceSoirMeme('2026-10-10', CE_SOIR)).toBe(false)
    expect(ceSoirMeme('2026-10-10', a('2026-10-09T22:30:00Z'))).toBe(true)
    expect(ceSoirMeme('2026-10-09', a('2026-10-09T22:30:00Z'))).toBe(false)
    expect(ceSoirMeme('bientôt', CE_SOIR)).toBe(false)
  })

  // La porte du wagon-restaurant (brief 16, décision 10) : une table de ce soir, où je suis l'hôte ou
  // l'invité, que je n'ai pas déclinée. **Une table que mon invité a déclinée ne compte pas quand une
  // autre existe** (l'hôte a retrouvé sa soirée : la porte ne dit pas « 2 tables ») ; seule, elle ouvre
  // encore la porte ; plusieurs rendues et rien d'autre, la première servie. Mutations : toute table
  // (le filtre retiré) ; une table d'hier gardée (`!soirPasse` retiré) ; ma place rendue gardée ; la
  // table que mon invité a déclinée toujours comptée (`tenues` ignoré), ou jamais (le repli retiré) ;
  // toutes les rendues gardées (`slice` retiré) ; l'ordre servi retourné.
  it('la porte ne s’ouvre que pour une table de ce soir que je n’ai pas déclinée, dans l’ordre servi', () => {
    const t = (id: string, etat: Table['etat'], hote: string, soir: string) => ({ ...table(etat, hote, soir), id }) as Table
    const tables = [
      t('invitee', 'attend', LUI, '2026-10-09'),
      t('declinee-par-moi', 'a_decline', LUI, '2026-10-09'),
      t('la-mienne-declinee', 'a_decline', MOI, '2026-10-09'),
      t('prise', 'a_pris_sa_place', LUI, '2026-10-09'),
      t('hier', 'a_pris_sa_place', LUI, '2026-10-08'),
      t('hier-la-mienne', 'attend', MOI, '2026-10-08'),
      t('demain', 'attend', LUI, '2026-10-10'),
    ]
    const porte = (ts: Table[]) => tablesDeLaPorte(ts, MOI, CE_SOIR).map((x) => x.id)
    expect(porte(tables)).toEqual(['invitee', 'prise'])
    const rendue = tables[2]!
    expect(porte([rendue, tables[0]!])).toEqual(['invitee'])
    // Seule ce soir : elle reste la mienne, et la porte dit que mon invité a rendu sa place.
    expect(porte([tables[1]!, rendue, tables[4]!])).toEqual(['la-mienne-declinee'])
    expect(porte([rendue, { ...rendue, id: 'une-autre-rendue' }])).toEqual(['la-mienne-declinee'])
    expect(porte([])).toEqual([])
  })

  // Le tampon « Vu ensemble » se pose par **entrée de journal** (`mon_billet.id`), jamais par film, et
  // `vu_ensemble` se lit tel que servi. Mutations : `mon_billet.media_id` rendu (une autre séance du
  // même film le porterait) ; `vu_ensemble` remplacé par `etat === 'a_pris_sa_place'` ; tout
  // `mon_billet` rendu ; des tables non lues tenues pour une erreur.
  it('les billets vus ensemble sont les entrées `mon_billet` des tables que le serveur dit vues à deux', () => {
    const VUE = exemple<Tables>('/me/voyage/tables', 'get', 200).tables[1]!
    const billet = VUE.mon_billet!
    expect(VUE.vu_ensemble).toBe(true)
    const prise: Table = { ...VUE, id: 'autre', vu_ensemble: false, mon_billet: { ...billet, id: 'e-seule' } }
    const sansBillet: Table = { ...VUE, id: 'sans', mon_billet: null }
    const vues = entreesVuesEnsemble({ tables: [prise, VUE, sansBillet] })
    expect([...vues]).toEqual([billet.id])
    expect(vues.has(billet.media_id)).toBe(false)
    expect(entreesVuesEnsemble(undefined).size).toBe(0)
  })
})
