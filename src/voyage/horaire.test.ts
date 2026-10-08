import { afterEach, describe, expect, it, vi } from 'vitest'
import { horaireDePlaque, jourDArrivee, jourDeLEcheance, semaineDeLEcheance } from './horaire'

// Les mots de date de l'horaire (plan des écrans des lots, brief 10 ; le brief 11 les reprend sur la
// carte). Le serveur décide de l'échéance : ici on dit un jour servi, on n'en calcule aucun.
describe('les jours de l’horaire', () => {
  afterEach(() => vi.unstubAllEnvs())

  // La base ne tient pas « l'échéance est un dimanche », exprès. Mutation : le mot « dimanche » écrit
  // en dur devant la date.
  it('le jour de la semaine se lit dans l’échéance : un mercredi se dit mercredi', () => {
    expect(jourDeLEcheance('2026-10-11')).toBe('dimanche 11 octobre 2026')
    expect(jourDeLEcheance('2026-10-14')).toBe('mercredi 14 octobre 2026')
    expect(jourDeLEcheance('2026-11-01')).toBe('dimanche 1er novembre 2026')
  })

  // Une date sans heure ne passe pas par le fuseau de l'appareil : `new Date('2026-10-11')` est minuit
  // à Greenwich, la veille à l'ouest. Mutations : le jour de la semaine lu en heure locale (sans
  // `timeZone: 'UTC'`) ; les chiffres lus de `new Date(echeance)` en heure locale.
  it.each(['America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo', 'Europe/Paris'])('l’échéance ne change pas de jour sur un appareil réglé à %s', (fuseau) => {
    vi.stubEnv('TZ', fuseau)
    expect(jourDeLEcheance('2026-10-11')).toBe('dimanche 11 octobre 2026')
  })

  // L'arrivée est un instant, dit à Paris comme le serveur le compte : émis un samedi à 22 h 30 de
  // Greenwich, le ticket l'est un dimanche. Mutations : le jour de la semaine sans `Europe/Paris` ; la
  // date lue sans `jourDeParis` (les dix premiers caractères de l'instant).
  it.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo'])('l’arrivée se dit à Paris, jour de la semaine compris, sur un appareil réglé à %s', (fuseau) => {
    vi.stubEnv('TZ', fuseau)
    expect(jourDArrivee('2026-10-10T19:00:00.000Z')).toBe('samedi 10 octobre 2026')
    expect(jourDArrivee('2026-10-10T22:30:00.000Z')).toBe('dimanche 11 octobre 2026')
  })
})

// Ce que la plaque d'une gare dit de son horaire, sur la carte (plan des écrans des lots, brief 11) :
// une règle pure, que le dessin de 1900 et la liste des années pour lecteur d'écran lisent toutes deux.
describe('l’horaire sur la plaque d’une gare', () => {
  afterEach(() => vi.unstubAllEnvs())
  const h = (etat: 'accepte' | 'tenu' | 'manque', echeance = '2026-10-14') => ({ etat, echeance })

  // Mutations : le jour lu en heure de l'appareil (sans `timeZone: 'UTC'` : un samedi à l'ouest) ; la
  // date entière rendue à la place du jour seul.
  it.each(['America/Los_Angeles', 'Asia/Tokyo', 'Europe/Paris'])('le jour de la semaine seul, le même sur un appareil réglé à %s', (fuseau) => {
    vi.stubEnv('TZ', fuseau)
    expect(semaineDeLEcheance('2026-10-11')).toBe('dimanche')
    expect(semaineDeLEcheance('2026-10-14')).toBe('mercredi')
  })

  // Mutations : le filet donné à un horaire accepté ; « à l'heure » dit pour un horaire accepté.
  it('tenu : « à l’heure » et le filet doré', () => {
    expect(horaireDePlaque(h('tenu'), false)).toEqual({ mention: 'à l’heure', tenu: true })
  })

  // La base ne tient pas « l'échéance est un dimanche ». Mutation : « avant dimanche » écrit en dur.
  it('accepté : « avant » et le jour de l’échéance servie, un mercredi se dit mercredi, sans filet', () => {
    expect(horaireDePlaque(h('accepte'), false)).toEqual({ mention: 'avant mercredi', tenu: false })
    expect(horaireDePlaque(h('accepte', '2026-10-18'), false)).toEqual({ mention: 'avant dimanche', tenu: false })
  })

  // Décision 7 du propriétaire : rien sur la carte. Mutation : une branche `manque` ajoutée.
  it('manqué, ou sans horaire : rien', () => {
    expect(horaireDePlaque(h('manque'), false)).toBeNull()
    expect(horaireDePlaque(null, false)).toBeNull()
    expect(horaireDePlaque(undefined, false)).toBeNull()
  })

  // Mutation : la garde `fermee` retirée.
  it('une plaque fermée ne dit rien, quel que soit l’horaire servi', () => {
    expect(horaireDePlaque(h('tenu'), true)).toBeNull()
    expect(horaireDePlaque(h('accepte'), true)).toBeNull()
  })
})
