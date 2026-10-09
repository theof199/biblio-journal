import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Malle, PlaceDeMalle } from '../../../api/voyage'
import { exemple } from '../../../test/contrat'
import BadgeDeMalle from './BadgeDeMalle'
import { BADGES, DESSINS_DE_BADGE, FORMES, MOTS_DE_LA_MALLE as M, badgeDe, ceQueDitLaTrace, compteDeLaTrace, etatDeLaPlace, nomLuDeLaPlace } from './malle'

/**
 * Le badge d'une place de la malle (plan des écrans des lots, brief 1) : ses règles, et ce qu'il dit.
 * **Rien ici ne regarde le dessin** : ni un tracé, ni une couleur, ni une place. Chaque test dit la
 * mutation de `malle.ts` ou de `BadgeDeMalle.tsx` qui le fait rougir.
 */
const place = (p: Partial<PlaceDeMalle>): PlaceDeMalle => ({
  numero: 8,
  cachee: false,
  cle: 'train-de-nuit',
  nom: 'Le Train de nuit',
  devise: 'Après minuit',
  regle: 'Composter cinq séances après minuit.',
  quoi: 'séances après minuit',
  collee_le: null,
  progression: { fait: 2, seuil: 5 },
  ...p,
})
const COLLEE = { collee_le: '2026-09-29T20:41:07.000Z', progression: null }
/** La cachée telle que le contrat la sert avant d'être gagnée : son numéro, et rien d'elle. */
const CACHEE = place({ numero: 15, cachee: true, cle: null, nom: null, devise: null, regle: null, quoi: null, progression: null })
/** La même une fois gagnée : `cachee` reste vrai. */
const CACHEE_GAGNEE = place({ numero: 15, cachee: true, cle: 'billet-de-faveur', nom: 'Le Billet de faveur', devise: '28 décembre', regle: 'Cachée : composter une séance un 28 décembre.', quoi: 'séance un 28 décembre', ...COLLEE })
/** Les quinze clés que l'API sert pour 1900 (`apps/api/src/voyage/etiquettes.ts`, côté back), dans l'ordre de leurs numéros. */
const CLES_DE_1900 = ['chef-de-gare', 'operateur-lumiere', 'coloriste', 'tete-en-caoutchouc', 'bonimenteur', 'passager-clandestin', 'correspondance', 'train-de-nuit', 'express', 'omnibus', 'tour-du-monde', 'pionniere', 'hold-up', 'voie-parallele', 'billet-de-faveur']

/** Ce qu'un badge monté dit : son état, son nom lu, et les mots qu'il écrit. Jamais son dessin. */
const badge = (p: PlaceDeMalle) => {
  const { unmount } = render(<BadgeDeMalle place={p} />)
  const svg = screen.getByRole('img')
  const lu = { etat: svg.getAttribute('data-etat'), nom: svg.getAttribute('aria-label') ?? '', ecrit: svg.textContent ?? '' }
  unmount()
  return lu
}

afterEach(() => vi.unstubAllEnvs())

describe('l’état d’une place de la malle', () => {
  // Mutation : l'état lu sur `cachee` (`if (place.cachee) return 'cachee'`).
  it('une cachée gagnée se montre comme les autres : l’état se lit sur la clé, pas sur « cachee »', () => {
    expect([etatDeLaPlace(CACHEE), etatDeLaPlace(CACHEE_GAGNEE)]).toEqual(['cachee', 'collee'])
    const lu = badge(CACHEE_GAGNEE)
    expect(lu.etat).toBe('collee')
    expect(lu.ecrit).not.toContain(M.signeDeLaCachee)
    expect(lu.ecrit).toContain('BILLET DE FAVEUR')
    expect(lu.nom).toContain('Le Billet de faveur')
  })

  // Le serveur ne colle qu'après un geste : entre le mérite et lui, la progression est au seuil.
  // Mutation : `|| fait >= seuil` ajouté à « collée ».
  it('au seuil sans date de collage, la place reste une trace, pleine', () => {
    const pleine = place({ progression: { fait: 5, seuil: 5 } })
    expect(etatDeLaPlace(pleine)).toBe('trace')
    expect(ceQueDitLaTrace(pleine)).toBe('5 sur 5 · séances après minuit')
    expect(badge(pleine).etat).toBe('trace')
    expect(etatDeLaPlace(place(COLLEE))).toBe('collee')
  })

  // L'exemple du contrat, tel quel : une collée, deux traces, une cachée. Mutation : `collee_le` lu
  // sous un autre nom (toutes en trace).
  it('lit les places telles que le contrat les sert', () => {
    const malle = exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200)
    expect(malle.etiquettes.map(etatDeLaPlace)).toEqual(['collee', 'trace', 'trace', 'cachee'])
    expect(malle.etiquettes.map(ceQueDitLaTrace)).toEqual([null, '2 sur 5 · séances après minuit', '0 sur 3 · films d’Alice Guy', null])
  })
})

describe('ce que dit une place', () => {
  // Décision du propriétaire, 9 octobre 2026 : un seuil de un dit son compte comme les autres (la
  // règle d'avant disait « à gagner »). Mutations : le cas particulier du seuil de un remis dans
  // `compteDeLaTrace` (« à gagner ») ; la garde `seuil > 1` remise dans `nomLuDeLaPlace` (le nom lu
  // perdrait son compte).
  it('un seuil de un dit « 0 sur 1 », comme les autres disent leur compte', () => {
    const une = place({ cle: 'express', nom: 'L’Express', quoi: 'gare passée en moins de 48 heures', progression: { fait: 0, seuil: 1 } })
    expect([compteDeLaTrace({ fait: 0, seuil: 1 }), compteDeLaTrace({ fait: 3, seuil: 4 })]).toEqual(['0 sur 1', '3 sur 4'])
    expect(ceQueDitLaTrace(une)).toBe('0 sur 1 · gare passée en moins de 48 heures')
    const lu = badge(une)
    expect(lu.ecrit.replace(/\s/g, '')).toBe('0sur1')
    expect(lu.nom).toBe('L’Express, pas encore gagnée, 0 sur 1. Composter cinq séances après minuit.')
    expect(`${lu.ecrit} ${lu.nom} ${ceQueDitLaTrace(une)}`).not.toMatch(/gagner/)
  })

  // Mutations : le compte retiré du nom lu d'une trace ; dans le dessin, le compte remplacé par le nom.
  it('une trace dit son compte, pas son nom ; son nom lu dit le nom, le compte et la règle', () => {
    const lu = badge(place({}))
    expect(lu.ecrit.replace(/\s/g, '')).toBe('2sur5')
    expect(lu.nom).toBe('Le Train de nuit, pas encore gagnée, 2 sur 5. Composter cinq séances après minuit.')
  })

  // Le jour du collage se dit à Paris, quel que soit le fuseau de l'appareil : 22 h 30 UTC le 29 est
  // déjà le 30 à Paris. Mutations : le jour pris en UTC (`collee_le.slice(0, 10)`) ; la devise servie
  // remplacée par une devise fixe.
  it('une collée dit son nom court et la devise servie ; son nom lu dit le jour du collage à Paris, et la règle', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    const collee = place({ collee_le: '2026-09-29T22:30:00.000Z', progression: null, devise: 'Passé minuit' })
    const lu = badge(collee)
    expect(lu.ecrit).toContain('TRAIN DE NUIT')
    expect(lu.ecrit).toContain('PASSÉ MINUIT')
    expect(lu.nom).toBe('Le Train de nuit, étiquette collée le 30 septembre 2026. Composter cinq séances après minuit.')
    expect(ceQueDitLaTrace(collee)).toBeNull()
  })

  // Le bouton d'une place n'a que son nom lu : « nouvelle » s'y dit, pour une collée seulement (une
  // trace ou une cachée n'est jamais nouvelle, quoi qu'on passe). Mutations : `nouvelle` ignoré par
  // `nomLuDeLaPlace` ; le mot dit aussi d'une trace ; dit d'une cachée.
  it('collée depuis ma dernière visite, une place le dit dans son nom lu ; une trace et une cachée, jamais', () => {
    vi.stubEnv('TZ', 'UTC')
    const collee = place({ collee_le: '2026-09-29T20:41:07.000Z', progression: null })
    expect(nomLuDeLaPlace(collee, true)).toBe('Le Train de nuit, nouvelle étiquette collée le 29 septembre 2026. Composter cinq séances après minuit.')
    expect(nomLuDeLaPlace(collee, false)).toBe(nomLuDeLaPlace(collee))
    expect(nomLuDeLaPlace(collee)).not.toMatch(/nouvelle/i)
    for (const p of [place({}), CACHEE]) expect(nomLuDeLaPlace(p, true)).toBe(nomLuDeLaPlace(p))
  })

  // Le contrat sert tout nul ; la règle tient même si un champ en venait. Mutation : le libellé commun
  // (la branche de la cachée retirée de `nomLuDeLaPlace` : « null, pas encore gagnée »).
  it('une cachée non gagnée ne dit rien d’elle : ni nom, ni règle, ni clé', () => {
    const bavarde = { ...CACHEE, nom: 'Le Billet de faveur', devise: '28 décembre', regle: 'Composter une séance un 28 décembre.', quoi: 'séance un 28 décembre', progression: { fait: 0, seuil: 1 } }
    for (const p of [CACHEE, bavarde]) {
      expect(nomLuDeLaPlace(p)).toBe('Une étiquette cachée : elle ne se montre qu’une fois gagnée.')
      expect(ceQueDitLaTrace(p)).toBeNull()
      const lu = badge(p)
      expect(lu).toEqual({ etat: 'cachee', nom: 'Une étiquette cachée : elle ne se montre qu’une fois gagnée.', ecrit: '?' })
      expect(`${lu.nom} ${lu.ecrit}`).not.toMatch(/null|faveur|décembre|billet/i)
    }
  })
})

describe('la table des badges', () => {
  // **Par clé du contrat, jamais par numéro.** Mutations : une clé retirée ou renommée (`chef_de_gare`) ;
  // un dessin donné à deux badges.
  it('chacune des quinze clés de 1900 a son badge, sa forme et son dessin, et aucun dessin ne sert deux fois', () => {
    expect(Object.keys(BADGES).sort()).toEqual([...CLES_DE_1900].sort())
    const badges = CLES_DE_1900.map((cle) => badgeDe(cle, null))
    expect(badges.filter((b) => b.forme === 'neutre' || b.dessin === null)).toEqual([])
    expect(badges.map((b) => b.dessin).sort()).toEqual([...DESSINS_DE_BADGE].sort())
    expect(badges.filter((b) => !(b.forme in FORMES) || b.court.length === 0 || b.court.some((l) => l.trim() === ''))).toEqual([])
    // Les clés de l'exemple du contrat sont de la table : la liste d'ici suit le contrat, elle n'est pas recopiée seule.
    const servies = exemple<Malle>('/me/voyage/decennies/{decennie}/etiquettes', 'get', 200).etiquettes.flatMap((e) => (e.cle === null ? [] : [e.cle]))
    expect(servies.length).toBeGreaterThan(0)
    expect(servies.filter((cle) => !CLES_DE_1900.includes(cle))).toEqual([])
  })

  // Le serveur peut servir une étiquette de plus avant que l'appli soit livrée. Mutations : le repli
  // retiré de `badgeDe` (`return BADGES[cle]!` : le rendu tombe) ; `hasOwnProperty` remplacé par `in`
  // (« constructor » trouverait une fonction, et le rendu tomberait) ; le nom servi oublié du repli.
  it('une clé que l’appli ne connaît pas garde sa place : une forme neutre, le nom servi, dans ses deux états', () => {
    for (const cle of ['wagon-de-queue', 'constructor', 'toString', '']) {
      expect(badgeDe(cle, 'Le Fourgon')).toMatchObject({ forme: 'neutre', dessin: null, court: ['Le Fourgon'] })
      const collee = badge(place({ cle, nom: 'Le Fourgon', devise: 'En queue', ...COLLEE }))
      expect(collee.etat).toBe('collee')
      expect(collee.ecrit).toBe('EN QUEUELE FOURGON')
      expect(collee.nom).toContain('Le Fourgon, étiquette collée le 29 septembre 2026.')
      const trace = badge(place({ cle, nom: 'Le Fourgon' }))
      expect(trace.etat).toBe('trace')
      expect(trace.ecrit.replace(/\s/g, '')).toBe('2sur5')
    }
  })

  // Mutations : la coupe retirée (un nom long sur une seule ligne) ; la coupe au premier espace.
  it('le nom servi d’une clé inconnue se coupe en deux lignes à l’espace du milieu, et un nom court ou sans espace reste entier', () => {
    expect(badgeDe('x', 'Le Wagon de queue').court).toEqual(['Le Wagon', 'de queue'])
    expect(badgeDe('x', 'L’Homme à la tête en caoutchouc').court).toEqual(['L’Homme à la tête', 'en caoutchouc'])
    expect(badgeDe('x', 'Le Chauffeur').court).toEqual(['Le Chauffeur'])
    expect(badgeDe('x', 'Anticonstitutionnellement').court).toEqual(['Anticonstitutionnellement'])
    expect(badgeDe('x', null).court).toEqual([''])
  })
})
