import { describe, expect, it } from 'vitest'
import { cleDeBobineDuMonde, cleDeBobineServie } from '../api/voyage'
import { creerRegistre } from '../mondes'

/**
 * Les bobines perdues entre l'appli et le compte. Le catalogue du serveur est recopié ici de
 * `../biblio-back/docs/frontend-integration.md` (étape 36) : six clés, toutes en tirets bas.
 */
const CATALOGUE_DU_SERVEUR = ['les_quatre_diables', 'la_tete_de_janus', 'londres_apres_minuit', 'soldiers', 'hamlet', 'fairylogue']
const mondes = creerRegistre()
const DES_MONDES = [1890, 1900].flatMap((d) => mondes(d).bobines.map((b) => b.cle))

describe('la traduction des clés de bobine', () => {
  // Mutations : `cleDeBobineServie` rendue à l'identité (une clé à tirets partirait, `400`) ; une
  // bobine d'un monde renommée hors du catalogue du serveur (`404` au ramassage).
  it('du monde au serveur : chaque bobine du registre devient une clé du catalogue du serveur, sans tiret', () => {
    expect(DES_MONDES).toHaveLength(6)
    expect(DES_MONDES.map(cleDeBobineServie)).toEqual(CATALOGUE_DU_SERVEUR)
    for (const cle of DES_MONDES.map(cleDeBobineServie)) expect(cle).not.toContain('-')
  })

  // Mutation : `cleDeBobineDuMonde` rendue à l'identité : une bobine que le compte tient ne serait
  // reconnue par aucun monde, et se proposerait de nouveau.
  it('du serveur au monde : chaque clé du catalogue du serveur redevient la clé d’une bobine du registre', () => {
    expect(CATALOGUE_DU_SERVEUR.map(cleDeBobineDuMonde)).toEqual(DES_MONDES)
  })

  // L'aller et retour ne tient que pour une clé de monde sans tiret bas. Mutation : une bobine du
  // registre nommée avec un tiret bas.
  it('l’aller et retour rend chaque clé, dans les deux sens', () => {
    for (const cle of DES_MONDES) expect(cleDeBobineDuMonde(cleDeBobineServie(cle))).toBe(cle)
    for (const cle of CATALOGUE_DU_SERVEUR) expect(cleDeBobineServie(cleDeBobineDuMonde(cle))).toBe(cle)
  })
})
