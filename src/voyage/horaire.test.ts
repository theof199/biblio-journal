import { afterEach, describe, expect, it, vi } from 'vitest'
import { jourDArrivee, jourDeLEcheance } from './horaire'

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
