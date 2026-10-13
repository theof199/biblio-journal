import { afterEach, describe, expect, it } from 'vitest'
import { RETOUR_NEUTRE, fournirLeRetourDuVu, lireLeRetourDuVu, type EpisodeCoche } from './retourDuVu'

const COCHE: EpisodeCoche = { serieId: 'm1', serie: 'Dark', saison: 2, numero: 5, titre: 'Perdus et retrouvés' }

describe('le retour du « Vu »', () => {
  const retraits: (() => void)[] = []
  const fournir = (...args: Parameters<typeof fournirLeRetourDuVu>) => {
    const retrait = fournirLeRetourDuVu(...args)
    retraits.push(retrait)
    return retrait
  }
  afterEach(() => retraits.splice(0).forEach((retrait) => retrait()))

  // Mutation : `RETOUR_NEUTRE` vidé.
  it('sans fournisseur, le message neutre', () => {
    expect(lireLeRetourDuVu(COCHE)).toBe('Épisode noté')
    expect(RETOUR_NEUTRE).toBe('Épisode noté')
  })

  // Mutation : `lireLeRetourDuVu` qui rend toujours le neutre ; le fournisseur appelé sans la coche.
  it('le fournisseur de l’espace reçoit ce qu’on vient de cocher, et son texte est le message', () => {
    const recus: EpisodeCoche[] = []
    fournir((coche) => {
      recus.push(coche)
      return `Un cachet pour ${coche.serie} S${coche.saison} E${coche.numero}`
    })

    expect(lireLeRetourDuVu(COCHE)).toBe('Un cachet pour Dark S2 E5')
    expect(recus).toEqual([COCHE])
  })

  // Mutation : `?? RETOUR_NEUTRE` ôté (le message serait `null`), ou `||` devenu `??` (un texte vide passerait).
  it.each([null, ''])('un fournisseur qui n’a rien à dire (%j) laisse le neutre', (rien) => {
    fournir(() => rien)
    expect(lireLeRetourDuVu(COCHE)).toBe('Épisode noté')
  })

  // Mutation : le retrait qui ne fait rien.
  it('le retrait rend le neutre : l’espace démonté ne parle plus', () => {
    const retrait = fournir(() => 'À la Maison')
    expect(lireLeRetourDuVu(COCHE)).toBe('À la Maison')

    retrait()

    expect(lireLeRetourDuVu(COCHE)).toBe('Épisode noté')
  })

  // Mutation : `if (fournisseur === fn)` ôté du retrait. Le passage du Travail à la Maison monte l'une
  // avant que l'autre ne se démonte : le retrait tardif de la première ne doit pas faire taire la seconde.
  it('le retrait d’un fournisseur déjà remplacé ne retire pas son successeur', () => {
    const retraitDuTravail = fournir(() => 'Au Travail')
    fournir(() => 'À la Maison')

    retraitDuTravail()

    expect(lireLeRetourDuVu(COCHE)).toBe('À la Maison')
  })

  // Mutation : le `try` ôté.
  it('un fournisseur qui casse ne casse pas la coche : le neutre', () => {
    fournir(() => {
      throw new Error('cassé')
    })
    expect(lireLeRetourDuVu(COCHE)).toBe('Épisode noté')
  })
})
