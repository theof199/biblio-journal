import { describe, expect, it, vi } from 'vitest'
import { anneeCivile, arrets, chevaux, decennieDeLAdresse, figureTouchee, palissade, registre, voyageurSuivi } from './decennie'
import { voyage1890 } from '../test/voyage'
import { visionnage } from '../test/journal'

const V = voyage1890(1897, [
  { annee: 1895, statut: 'ouverte', recompense: 'palme', profondeur: 9, visitee: true },
  { annee: 1896, statut: 'ouverte', recompense: null, profondeur: 2, visitee: true },
  { annee: 1897, statut: 'en_cours', recompense: 'ours', profondeur: 4, visitee: true },
  { annee: 1898, statut: 'verrouillee', recompense: null, profondeur: 2, visitee: false },
  { annee: 1899, statut: 'verrouillee', recompense: 'ours', profondeur: 3, visitee: false },
  { annee: 1900, statut: 'verrouillee', recompense: null, profondeur: 0, visitee: false },
])

/** Un visionnage d'un film sorti `an`, avec sa couverture. */
const vu = (id: string, media: string, an: number, note: number | null = null) => {
  const v = visionnage({ id, media, annee: an, date: '2026-09-01', note })
  v.media.cover_url = `https://image.tmdb.org/t/p/w500/${media}.jpg`
  return v
}

describe('l’adresse d’une décennie', () => {
  // Mutations : accepter une année qui n'est pas un multiple de dix ; accepter une décennie à venir ; accepter 1880.
  it('n’ouvre qu’une décennie du Voyage, de 1890 à la décennie en cours', () => {
    expect(decennieDeLAdresse('1890', 2026)).toBe(1890)
    expect(decennieDeLAdresse('2020', 2026)).toBe(2020)
    expect(decennieDeLAdresse('1897', 2026)).toBeNull()
    expect(decennieDeLAdresse('2030', 2026)).toBeNull()
    expect(decennieDeLAdresse('1880', 2026)).toBeNull()
    expect(decennieDeLAdresse('années', 2026)).toBeNull()
    expect(decennieDeLAdresse(undefined, 2026)).toBeNull()
  })

  // Mutation : `maintenant.getFullYear()` (l'année de l'appareil) : sous UTC, 23 h 30 le 31 décembre
  // 2029 serait encore 2029, alors qu'à Paris la décennie 2030 est ouverte ; sous Honolulu, de même.
  it.each(['UTC', 'Pacific/Honolulu'])('lit l’année civile à Paris, pas dans le fuseau de l’appareil (%s)', (fuseau) => {
    vi.stubEnv('TZ', fuseau)
    try {
      expect(anneeCivile(new Date('2029-12-31T23:30:00.000Z'))).toBe(2030)
      expect(anneeCivile(new Date('2029-12-31T22:30:00.000Z'))).toBe(2029)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('le manège', () => {
  // Mutations : un cheval « avant » compté pour une année absente d'après 1895 ; l'avance sans films ; la
  // médaille d'une année en cours (l'état de la case prime).
  it('a un cheval par année : brut avant le départ, l’état de sa case ensuite, bâché verrouillé', () => {
    expect(chevaux(V, 1890)).toEqual([
      { annee: 1890, etat: 'avant' },
      { annee: 1891, etat: 'avant' },
      { annee: 1892, etat: 'avant' },
      { annee: 1893, etat: 'avant' },
      { annee: 1894, etat: 'avant' },
      { annee: 1895, etat: 'palme' },
      { annee: 1896, etat: 'passee' },
      { annee: 1897, etat: 'encours' },
      { annee: 1898, etat: 'avance' },
      { annee: 1899, etat: 'avance' },
    ])
    expect(chevaux(V, 1900)[0]).toEqual({ annee: 1900, etat: 'verrou' })
    // Une année après l'année civile n'est pas encore sur la carte : bâchée, jamais « avant ».
    expect(chevaux(V, 1900)[5]).toEqual({ annee: 1905, etat: 'verrou' })
  })

  // Le jumeau de la carte (`etatDeCase`) : pour la lectrice, l'année que le Voyage suivi n'a pas encore
  // ouverte est en attente, pas en cours ; au compte IA, elle s'ouvre à la visite. Mutation : l'attente
  // ignorée (le cheval peint en corail, comme l'année en cours).
  it('met en attente le cheval d’une année que le Voyage suivi n’a pas encore ouverte', () => {
    const lectrice = { ...V, ia: false, annees: V.annees.map((a) => (a.annee === 1897 ? { ...a, visitee: false } : a)) }
    expect(chevaux(lectrice, 1890)[7]).toEqual({ annee: 1897, etat: 'attente' })
    expect(chevaux(lectrice, 1890)[6]).toEqual({ annee: 1896, etat: 'passee' })
    expect(chevaux({ ...lectrice, ia: true }, 1890)[7]).toEqual({ annee: 1897, etat: 'encours' })
  })
})

describe('le toucher du monument', () => {
  const figures = [
    { annee: 1895, x: 100, y: 200, r: 30, devant: true },
    { annee: 1896, x: 140, y: 200, r: 30, devant: true },
  ]

  // Mutations : la première figure qui contient le toucher plutôt que la plus proche ; le rayon ignoré
  // (un toucher dans le ciel ouvrirait une année au lieu d'emballer le manège).
  it('ouvre la figure la plus proche sous le doigt, rien à côté', () => {
    expect(figureTouchee(figures, { x: 128, y: 200 })).toBe(1896)
    expect(figureTouchee(figures, { x: 112, y: 200 })).toBe(1895)
    expect(figureTouchee(figures, { x: 100, y: 20 })).toBeNull()
    expect(figureTouchee([], { x: 100, y: 200 })).toBeNull()
  })

  // Décision du propriétaire du 1er octobre 2026 (2c-3) : sur la zone commune, le cheval de devant
  // l'emporte, même quand le doigt est plus près de celui de derrière, dans un sens comme dans
  // l'autre de la liste ; hors de la zone commune, celui de derrière se touche encore. Mutations : le
  // plan ignoré (le plus proche, 1897) ; le premier inscrit qui l'emporte.
  it('préfère toujours le cheval de devant au cheval de derrière', () => {
    const derriere = { annee: 1897, x: 100, y: 200, r: 30, devant: false }
    const devant = { annee: 1892, x: 100, y: 225, r: 30, devant: true }
    for (const liste of [[derriere, devant], [devant, derriere]]) {
      expect(figureTouchee(liste, { x: 100, y: 202 })).toBe(1892)
      expect(figureTouchee(liste, { x: 100, y: 180 })).toBe(1897)
      expect(figureTouchee(liste, { x: 100, y: 250 })).toBe(1892)
    }
    // Deux chevaux de derrière : le plus proche, comme devant.
    expect(figureTouchee([derriere, { ...derriere, annee: 1898, x: 140 }], { x: 128, y: 200 })).toBe(1898)
  })
})

describe('le registre des recettes', () => {
  const items = [
    vu('e5', 'm3', 1897, 6),
    vu('e4', 'm2', 1897, 9),
    vu('e3', 'm1', 1897, null),
    vu('e2', 'm9', 1898, 8),
    vu('e1', 'm8', 1895, 7),
  ]

  // Mutations : la meilleure note prise sur une autre année ; la note nulle comptée comme zéro (-Infinity) ;
  // `vus` compté sur le journal plutôt que sur la carte.
  it('dit pour chaque année les films vus de la carte, sa récompense et ma meilleure note', () => {
    const lignes = registre(V, items, 1890)
    expect(lignes).toHaveLength(10)
    expect(lignes[7]).toEqual({ annee: 1897, vus: 4, recompense: 'ours', meilleureNote: 9, enCours: true, attente: false, enAvance: false, ouvrable: true })
    expect(lignes[6]).toEqual({ annee: 1896, vus: 2, recompense: null, meilleureNote: null, enCours: false, attente: false, enAvance: false, ouvrable: true })
  })

  // Pour la lectrice (hors IA), une année que le Voyage suivi n'a pas encore ouverte reste fermée :
  // elle se dit en attente, jamais en cours (le jumeau de la carte, `etatDeCase`). Mutations : `attente`
  // jamais vrai ; `enCours` sans la garde de l'attente.
  it('dit en attente, pas en cours, l’année que le Voyage suivi n’a pas encore ouverte', () => {
    const lectrice = { ...V, ia: false, annees: V.annees.map((a) => (a.annee === 1897 ? { ...a, visitee: false } : a)) }
    expect(registre(lectrice, items, 1890)[7]).toMatchObject({ annee: 1897, enCours: false, attente: true, ouvrable: true })
    expect(registre(lectrice, items, 1890)[6]).toMatchObject({ annee: 1896, attente: false })
    // Au compte IA, la même année s'ouvre à la visite : en cours.
    expect(registre({ ...lectrice, ia: true }, items, 1890)[7]).toMatchObject({ annee: 1897, enCours: true, attente: false })
  })

  // Mutations : la récompense tue pour une année verrouillée (le tampon, lui, la compte) ; « en avance »
  // dit d'une année verrouillée sans aucun film vu.
  it('garde la récompense d’une année vue en avance, et ne dit « en avance » qu’avec des films', () => {
    expect(registre(V, items, 1890)[9]).toMatchObject({ annee: 1899, recompense: 'ours', enAvance: true })
    expect(registre(V, items, 1890)[8]).toMatchObject({ annee: 1898, meilleureNote: 8, enAvance: true })
    expect(registre(V, items, 1900)[0]).toMatchObject({ annee: 1900, vus: 0, enAvance: false })
  })

  // Mutation : une série comptée dans la meilleure note.
  it('ne lit que des films', () => {
    const serie = vu('e6', 'm7', 1897, 10)
    serie.media.type = 'tv'
    expect(registre(V, [...items, serie], 1890)[7]!.meilleureNote).toBe(9)
  })

  // Mutation : une année avant le départ, ou absente de la carte, rendue ouvrable.
  it('n’ouvre que les années du Voyage que la carte porte', () => {
    expect(registre(V, items, 1890).map((l) => l.ouvrable)).toEqual([false, false, false, false, false, true, true, true, true, true])
    expect(registre(V, items, 1900).map((l) => l.ouvrable)).toEqual([true, false, false, false, false, false, false, false, false, false])
  })
})

describe('la palissade', () => {
  // Mutations : un film vu deux fois collé deux fois ; plus de quatre affiches ; « +N » compté sur les
  // affiches et non sur la carte ; une année d'une autre décennie.
  it('colle quatre affiches au plus par année, un film une fois, le reste en « +N »', () => {
    const items = [
      vu('e7', 'm1', 1895),
      vu('e6', 'm1', 1895),
      vu('e5', 'm2', 1895),
      vu('e4', 'm3', 1895),
      vu('e3', 'm4', 1895),
      vu('e2', 'm5', 1895),
    ]
    const [p1895] = palissade(V, items, 1890)
    expect(p1895).toEqual({
      annee: 1895,
      affiches: ['m1', 'm2', 'm3', 'm4'].map((m) => `https://image.tmdb.org/t/p/w500/${m}.jpg`),
      plus: 5,
      enAvance: false,
    })
    expect(palissade(V, items, 1890).map((p) => p.annee)).toEqual([1895, 1896, 1897, 1898, 1899])
  })

  // Mutation : une affiche nulle collée (une image cassée).
  it('ne colle pas un film sans affiche, mais le compte', () => {
    const sans = vu('e1', 'm6', 1896)
    sans.media.cover_url = null
    expect(palissade(V, [sans], 1890)[1]).toEqual({ annee: 1896, affiches: [], plus: 2, enAvance: false })
  })

  // Mutation : « en avance » sans regarder les films vus.
  it('dit une année verrouillée vue en avance, jamais une verrouillée sans film', () => {
    expect(palissade(V, [], 1890)[3]).toMatchObject({ annee: 1898, enAvance: true })
    expect(palissade(V, [], 1900)).toEqual([{ annee: 1900, affiches: [], plus: 0, enAvance: false }])
  })
})

describe('les arrêts de la ligne', () => {
  const LEA = { id: '11111111-1111-4111-8111-111111111111', pseudo: 'Léa', annee_en_cours: 1896 }
  const progression = { essentiels_vus: 3, essentiels_total: 5, salles_completes: 1, salles_autres: 3 }
  const enCours = { ...V, annees: V.annees.map((a) => (a.annee === 1897 ? { ...a, progression } : a)) }
  const de = (lignes: ReturnType<typeof arrets>, annee: number) => lignes.find((l) => l.annee === annee)!

  // Mutations : `voyageurSuivi` sans la garde `!v.ia` (le compte IA dirait « Léa y est ») ; `suivi`
  // posé sur mon année en cours au lieu de la sienne ; posé sur tous les arrêts.
  it('ne gare le voyageur suivi que pour un membre hors IA qui suit un Voyage, et dans son année à lui', () => {
    const lectrice = { ...V, ia: false, source: LEA }
    expect(voyageurSuivi(lectrice)).toEqual({ pseudo: 'Léa', annee: 1896 })
    expect(arrets(lectrice, [], [], 1890).filter((l) => l.suivi !== null).map((l) => [l.annee, l.suivi])).toEqual([[1896, 'Léa']])
    expect(voyageurSuivi({ ia: true, source: LEA })).toBeNull()
    expect(arrets({ ...V, ia: true, source: LEA }, [], [], 1890).some((l) => l.suivi !== null)).toBe(false)
    expect(voyageurSuivi({ ia: false, source: null })).toBeNull()
    expect(arrets({ ...V, ia: false, source: null }, [], [], 1890).some((l) => l.suivi !== null)).toBe(false)
  })

  // Une année est bouclée derrière soi, ou en cours dès le ticket de l'année suivante émis, lu sur la
  // carte ou parmi mes tickets. Mutations : le ticket de la même année (`l.annee`) ; `bouclee` vraie
  // pour toute année ouvrable ; les tickets ignorés ; `ticket_a_montrer` ignoré ; la garde de l'attente
  // retirée ; celle de l'année verrouillée retirée (un ticket qui la suit la bouclerait).
  it('dit bouclée une année derrière soi, ou en cours au ticket de la suivante émis, jamais une année en attente', () => {
    const bouclees = (lignes: ReturnType<typeof arrets>) => lignes.filter((l) => l.bouclee).map((l) => l.annee)
    expect(bouclees(arrets(V, [], [], 1890))).toEqual([1895, 1896])
    expect(bouclees(arrets(V, [], [{ annee: 1897 }], 1890))).toEqual([1895, 1896])
    expect(bouclees(arrets(V, [], [{ annee: 1898 }], 1890))).toEqual([1895, 1896, 1897])
    expect(bouclees(arrets(V, [], [{ annee: 1900 }], 1890))).toEqual([1895, 1896])
    expect(bouclees(arrets({ ...V, ticket_a_montrer: { annee: 1898, motif: 'Un ticket.', emis_le: '2026-09-21T21:00:00.000Z' } }, [], [], 1890))).toEqual([1895, 1896, 1897])
    const lectrice = { ...V, ia: false, annees: V.annees.map((a) => (a.annee === 1896 ? { ...a, visitee: false } : a)) }
    expect(bouclees(arrets(lectrice, [], [], 1890))).toEqual([1895])
  })

  // Mutations : le compte dit sur toute année ouverte ; `fermee` d'après `ouvrable` ; le compte gardé
  // sur une année en attente (elle se dirait en cours).
  it('ne compte que l’année en cours, jamais en attente, et dit fermée une année verrouillée', () => {
    const lignes = arrets(enCours, [], [], 1890)
    expect(lignes.filter((l) => l.compte !== null).map((l) => [l.annee, l.compte])).toEqual([[1897, { vus: 3, total: 5 }]])
    expect(lignes.filter((l) => l.fermee).map((l) => l.annee)).toEqual([1898, 1899])
    expect(de(lignes, 1893)).toMatchObject({ ouvrable: false, fermee: false, bouclee: false, compte: null })
    const lectrice = { ...enCours, ia: false, annees: enCours.annees.map((a) => (a.annee === 1897 ? { ...a, visitee: false } : a)) }
    expect(de(arrets(lectrice, [], [], 1890), 1897)).toMatchObject({ attente: true, enCours: false, compte: null, bouclee: false })
  })

  // Le registre par défaut lit les mêmes lignes : rien ne s'y perd. Mutation : `arrets` qui recompterait
  // `vus` ou `meilleureNote` autrement que `registre`.
  it('porte la ligne du registre telle quelle', () => {
    const items = [vu('e4', 'm2', 1897, 9)]
    expect(arrets(V, items, [], 1890).map((l) => ({ annee: l.annee, vus: l.vus, recompense: l.recompense, meilleureNote: l.meilleureNote, enCours: l.enCours, attente: l.attente, enAvance: l.enAvance, ouvrable: l.ouvrable }))).toEqual(registre(V, items, 1890))
  })
})
