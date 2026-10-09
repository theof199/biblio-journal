import { describe, expect, it } from 'vitest'
import type { CartePostaleEnvoyee, Courrier } from '../../api/voyage'
import { exemple } from '../../test/contrat'
import { rangerLaPostee } from './mot'

const ENVOYEE: CartePostaleEnvoyee = exemple<Courrier>('/me/voyage/cartes-postales', 'get', 200).envoyees[0]!
const de = (annee: number): CartePostaleEnvoyee => ({ ...ENVOYEE, id: `carte-${annee}`, annee })

describe('la carte qu’on vient de poster, parmi les envoyées', () => {
  // Le serveur sert les envoyées par gare, de la plus récente à la plus ancienne : la carte postée se
  // range à sa gare, sans attendre une relecture. Mutations : posée en queue (`[...autres, carte]`,
  // la gare de 1902 après celle de 1901) ; posée en tête ; la comparaison retournée (`>`).
  it('se range par gare, de la plus récente à la plus ancienne, pas en queue', () => {
    const gares = (cartes: CartePostaleEnvoyee[]) => cartes.map((c) => c.annee)
    expect(gares(rangerLaPostee([de(1903), de(1901)], de(1902)))).toEqual([1903, 1902, 1901])
    expect(gares(rangerLaPostee([de(1903), de(1901)], de(1905)))).toEqual([1905, 1903, 1901])
    expect(gares(rangerLaPostee([de(1903), de(1901)], de(1900)))).toEqual([1903, 1901, 1900])
    expect(gares(rangerLaPostee([], de(1900)))).toEqual([1900])
  })

  // Mutation : le filtre sur l'identifiant retiré (la carte deux fois aux envoyées si la boîte relue l'avait déjà).
  it('ne se range qu’une fois si la boîte la connaît déjà', () => {
    expect(rangerLaPostee([de(1903), de(1902), de(1901)], { ...de(1902), mot: 'La même, rendue par le serveur.' }).map((c) => [c.annee, c.mot])).toEqual([
      [1903, ENVOYEE.mot],
      [1902, 'La même, rendue par le serveur.'],
      [1901, ENVOYEE.mot],
    ])
  })
})
