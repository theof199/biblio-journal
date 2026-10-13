import { describe, expect, it } from 'vitest'
import type { CarteDeSerie, Telecommande } from '../../api/feuilleton'
import { exemple } from '../../test/contrat'
import { avancer, direQuand, direQuandLaSerie, jourEnLettres, poserLaCarte, retirerLInvitation, seriesEnCours, seriesEnPause } from './donnees'

const TELECOMMANDE = exemple<Telecommande>('/me/feuilleton/telecommande', 'get', 200)
const DARK = TELECOMMANDE.series[0]!
const carte = (id: string, le: string, autres: Partial<CarteDeSerie> = {}): CarteDeSerie => ({ ...DARK, id, titre: id, dernier_visionnage_le: le, ...autres })

/** Mercredi 14 octobre 2026, 21 h à Paris (heure d'été, UTC+2). */
const MAINTENANT = new Date('2026-10-14T19:00:00Z')

describe('« Regardée … » : le pied de l’écran, en jours de Paris', () => {
  // Mutations, dans `direQuand` : `A_L_INSTANT` à zéro ; `jours <= 0` devenu `jours < 0` ; `jours === 1`
  // devenu `jours <= 2` ; `HEURE_DU_SOIR` à 0 (tout « hier » serait « hier soir ») ou à 24.
  it.each([
    ['2026-10-14T18:59:00Z', 'Regardée à l’instant'],
    ['2026-10-14T18:00:01Z', 'Regardée à l’instant'],
    ['2026-10-14T18:00:00Z', 'Regardée aujourd’hui'],
    ['2026-10-14T06:00:00Z', 'Regardée aujourd’hui'],
    ['2026-10-13T19:41:00Z', 'Regardée hier soir'],
    ['2026-10-13T16:00:00Z', 'Regardée hier soir'], // 18 h à Paris : le soir commence
    ['2026-10-13T15:59:00Z', 'Regardée hier'], // 17 h 59 à Paris
    ['2026-10-12T19:41:00Z', 'Regardée il y a 2 jours'],
    ['2026-10-11T08:00:00Z', 'Regardée il y a 3 jours'],
    ['2026-08-30T20:05:00Z', 'Regardée il y a 45 jours'],
    ['2026-10-14T19:30:00Z', 'Regardée à l’instant'], // une horloge en avance
  ])('%s → %s', (iso, attendu) => {
    expect(direQuand('Regardée', iso, MAINTENANT)).toBe(attendu)
  })

  // Mutation : `jourDeParis` calculé en UTC (`timeZone: 'UTC'`), ou sur le fuseau de l'appareil.
  it('le jour est celui de Paris, pas celui d’UTC : 23 h 30 à Paris la veille, c’est « hier soir » à 0 h 45', () => {
    // 0 h 45 à Paris le 15 = 22 h 45 UTC le 14 ; 23 h 30 à Paris le 14 = 21 h 30 UTC le 14 : le même jour UTC.
    expect(direQuand('Regardée', '2026-10-14T21:30:00Z', new Date('2026-10-14T22:45:00Z'))).toBe('Regardée hier soir')
    // 1 h à Paris le 14 = 23 h UTC le 13 : la veille en UTC, le jour même à Paris.
    expect(direQuand('Regardée', '2026-10-13T23:00:00Z', MAINTENANT)).toBe('Regardée aujourd’hui')
  })

  // Mutation : `repere` ignoré dans `direQuandLaSerie` (une série jamais vue se dirait « Regardée »).
  // Mutations, dans `donnees.ts` : `reprise: 'Regardée'` dans `VERBES` ; `activiteLe(carte)` remplacé par
  // `carte.dernier_visionnage_le` dans `direQuandLaSerie` (« Reprise il y a 45 jours ») ; `&& carte.reprise_le`
  // devenu `|| carte.reprise_le` dans `activiteLe` (un visionnage plus récent se daterait de la vieille reprise).
  it('`repere: reprise` : la série est « Reprise », à la date de `reprise_le` ; une reprise qui ne compte plus ne date rien', () => {
    expect(direQuandLaSerie(carte('a', '2026-08-30T20:05:00Z', { repere: 'reprise', reprise_le: '2026-10-13T19:41:00Z' }), MAINTENANT)).toBe('Reprise hier soir')
    expect(direQuandLaSerie(carte('a', '2026-10-13T19:41:00Z', { repere: 'visionnage', reprise_le: '2026-10-01T08:00:00Z' }), MAINTENANT)).toBe('Regardée hier soir')
    expect(direQuandLaSerie(carte('a', '2026-10-10T07:00:00Z', { repere: 'suivi', reprise_le: null }), MAINTENANT)).toBe('Ajoutée il y a 4 jours')
  })

  it('`repere: suivi` : rien n’a été vu, la série est « Ajoutée »', () => {
    expect(direQuandLaSerie(carte('a', '2026-10-14T07:00:00Z', { repere: 'suivi' }), MAINTENANT)).toBe('Ajoutée aujourd’hui')
    expect(direQuandLaSerie(carte('a', '2026-10-10T07:00:00Z', { repere: 'suivi' }), MAINTENANT)).toBe('Ajoutée il y a 4 jours')
    expect(direQuandLaSerie(carte('a', '2026-10-13T19:41:00Z', { repere: 'visionnage' }), MAINTENANT)).toBe('Regardée hier soir')
  })

  // Mutation : `timeZone: 'UTC'` ôté de `JOUR_EN_LETTRES` (sur un appareil à l'ouest, le jour reculerait).
  it('une date de diffusion se dit en toutes lettres, sans année', () => {
    expect(jourEnLettres('2026-10-21')).toBe('21 octobre')
    expect(jourEnLettres('2026-11-06')).toBe('6 novembre')
    expect(jourEnLettres('2027-03-01')).toBe('1 mars')
  })
})

describe('la réponse de la télécommande, lue et réécrite', () => {
  const A = carte('a', '2026-10-14T10:00:00Z')
  const B = carte('b', '2026-10-12T10:00:00Z', { en_pause: true })
  const C = carte('c', '2026-10-10T10:00:00Z')
  const T: Telecommande = { a_confirmer: TELECOMMANDE.a_confirmer, series: [A, B, C] }
  const ids = (t: Telecommande) => t.series.map((serie) => serie.id)

  // Mutations : le filtre ôté de `seriesEnCours` ; inversé ; un tri ajouté.
  it('« En cours » est `series` sans les séries en pause, dans l’ordre reçu ; « En pause » le reste', () => {
    expect(seriesEnCours(T).map((serie) => serie.id)).toEqual(['a', 'c'])
    expect(seriesEnPause(T).map((serie) => serie.id)).toEqual(['b'])
  })

  // Mutations, dans `avancer` : `prochain` laissé ; `ensuite` laissé (il se reproposerait) ; la carte
  // laissée à sa place ; `checked` non compté ; `en_pause` laissé vrai.
  it('« Vu » avance la carte à `ensuite`, la compte, la date et la met en tête, hors pause', () => {
    const apres = avancer({ ...T, series: [A, { ...C, en_pause: true, repere: 'suivi' }] }, 'c', MAINTENANT)
    expect(ids(apres)).toEqual(['c', 'a'])
    expect(apres.series[0]).toMatchObject({
      prochain: C.ensuite,
      ensuite: null,
      a_jour: false,
      progression: { checked: C.progression.checked + 1, total: C.progression.total },
      dernier_visionnage_le: '2026-10-14T19:00:00.000Z',
      repere: 'visionnage',
      en_pause: false,
    })
    expect(apres.series[1]).toBe(A)
  })

  // Mutation : `a_jour` laissé à faux quand `ensuite` manque (« Vu » resterait allumé sur rien).
  it('sans `ensuite`, la carte avancée est à jour ; une série à jour ou inconnue ne bouge pas', () => {
    const apres = avancer({ ...T, series: [{ ...A, ensuite: null }] }, 'a', MAINTENANT)
    expect(apres.series[0]).toMatchObject({ prochain: null, a_jour: true })
    const aJour = { ...T, series: [{ ...A, prochain: null, ensuite: null, a_jour: true }] }
    expect(avancer(aJour, 'a', MAINTENANT)).toBe(aJour)
    expect(avancer(T, 'inconnue', MAINTENANT)).toBe(T)
  })

  // Mutations, dans `poserLaCarte` : l'ancienne carte gardée (deux cartes de la même série) ; la carte
  // posée en tête sans regarder sa date ; `finie` ignoré.
  it('une carte rendue remplace celle de sa série, à la place de sa date ; une inconnue entre ; une finie sort', () => {
    const remplacee = poserLaCarte(T, { ...C, dernier_visionnage_le: '2026-10-14T18:00:00Z', titre: 'neuve' })
    expect(ids(remplacee)).toEqual(['c', 'a', 'b'])
    expect(remplacee.series[0]!.titre).toBe('neuve')

    expect(ids(poserLaCarte(T, { ...A, dernier_visionnage_le: '2026-10-11T10:00:00Z' }))).toEqual(['b', 'a', 'c'])
    expect(ids(poserLaCarte(T, carte('d', '2026-10-13T10:00:00Z')))).toEqual(['a', 'd', 'b', 'c'])
    expect(ids(poserLaCarte(T, carte('e', '2026-01-01T10:00:00Z')))).toEqual(['a', 'b', 'c', 'e'])
    expect(ids(poserLaCarte(T, { ...A, finie: true }))).toEqual(['b', 'c'])
    expect(poserLaCarte(T, { ...A, finie: true }).a_confirmer).toBe(T.a_confirmer)
  })

  // Mutation, dans `donnees.ts` : `instant` lu sur `dernier_visionnage_le` (la série reprise resterait en queue).
  it('une carte reprise se place à la date de sa reprise, pas de son dernier visionnage', () => {
    const reprise = { ...C, en_pause: false, repere: 'reprise' as const, reprise_le: '2026-10-14T18:00:00Z' }
    expect(ids(poserLaCarte(T, reprise))).toEqual(['c', 'a', 'b'])
    // Parmi des cartes dont l'une est déjà reprise : elle aussi se compare à sa reprise.
    expect(ids(poserLaCarte({ ...T, series: [reprise, A, B] }, carte('d', '2026-10-14T12:00:00Z')))).toEqual(['c', 'd', 'a', 'b'])
  })

  // Mutation : le filtre de `retirerLInvitation` inversé, ou posé sur `serie.id`.
  it('une invitation traitée quitte `a_confirmer`, et elle seule', () => {
    const autre = { ...T.a_confirmer[0]!, id: 'autre' }
    const deux = { ...T, a_confirmer: [T.a_confirmer[0]!, autre] }
    expect(retirerLInvitation(deux, T.a_confirmer[0]!.id).a_confirmer).toEqual([autre])
    expect(retirerLInvitation(deux, 'inconnue').a_confirmer).toHaveLength(2)
    expect(retirerLInvitation(deux, 'autre').series).toBe(T.series)
  })
})
