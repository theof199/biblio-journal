import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DUREE_DU_COMPOSTAGE, FRAPPE, compteDesCartons, decalerJour, initiale, molettes, peutAvancer, raccourci } from './billet'
import FEUILLE_DU_TAMPON from './billet/Tampon.module.css?raw'
import FEUILLE_DU_BILLET from '../pages/VoyageBillet.module.css?raw'

describe('le dateur', () => {
  // Le changement d'heure n'existe pas en UTC, le fuseau de la CI : le test pose celui du téléphone.
  beforeAll(() => vi.stubEnv('TZ', 'Europe/Paris'))
  afterAll(() => vi.unstubAllEnvs())

  // Mutation : un décalage de 24 h en millisecondes tombe sur le mauvais jour autour du changement d'heure.
  it('franchit les mois, les années et le changement d’heure en jours du calendrier', () => {
    expect(decalerJour('2026-03-01', -1)).toBe('2026-02-28')
    expect(decalerJour('2025-12-31', 1)).toBe('2026-01-01')
    expect(decalerJour('2026-10-25', 1)).toBe('2026-10-26')
    expect(decalerJour('2026-03-30', -1)).toBe('2026-03-29')
  })

  it('montre le jour, le mois d’affiche et l’année', () => {
    expect(molettes('2026-08-05')).toEqual({ jour: '05', mois: 'AOÛT', an: '2026' })
  })

  // Mutation : `<=` laisserait dater un visionnage de demain.
  it('n’avance pas au-delà d’aujourd’hui', () => {
    expect(peutAvancer('2026-09-29', '2026-09-30')).toBe(true)
    expect(peutAvancer('2026-09-30', '2026-09-30')).toBe(false)
  })

  // Mutation : `iso !== aujourdhui` laisserait avancer un jour déjà passé au-delà d'aujourd'hui.
  it('n’avance pas davantage un jour déjà au-delà d’aujourd’hui', () => {
    expect(peutAvancer('2026-10-01', '2026-09-30')).toBe(false)
  })

  it('allume « Aujourd’hui » ou « Hier », sinon rien', () => {
    expect(raccourci('2026-09-30', '2026-09-30')).toBe('aujourdhui')
    expect(raccourci('2026-09-29', '2026-09-30')).toBe('hier')
    expect(raccourci('2026-09-28', '2026-09-30')).toBeNull()
    expect(raccourci('2026-02-28', '2026-03-01')).toBe('hier')
  })
})

describe('les cartons et la cire', () => {
  it('comptent les cartons choisis', () => {
    expect(compteDesCartons(0)).toBe('aucun carton')
    expect(compteDesCartons(1)).toBe('1 carton choisi')
    expect(compteDesCartons(3)).toBe('3 cartons choisis')
  })

  it('scellent de l’initiale du membre', () => {
    expect(initiale(' théo')).toBe('T')
  })
})

describe('le compostage (décision D4)', () => {
  const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
  const TAMPON = sansCommentaires(FEUILLE_DU_TAMPON)
  const BILLET = sansCommentaires(FEUILLE_DU_BILLET)
  /** La durée d'une animation nommée, en millisecondes, telle qu'une feuille la joue. */
  const duree = (css: string, nom: string) => {
    const m = new RegExp(`animation:\\s*${nom}\\s+([\\d.]+)(ms|s)\\b`).exec(css)
    return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : Number.NaN
  }
  /** Le sélecteur de la règle qui lance une animation. */
  const selecteur = (css: string, nom: string) => {
    const i = css.search(new RegExp(`animation:\\s*${nom}\\s`))
    return i < 0 ? '' : css.slice(css.lastIndexOf('}', i) + 1, css.lastIndexOf('{', i))
  }
  const regle = (css: string, sel: string) => {
    const debut = css.indexOf(`${sel} {`)
    return debut < 0 ? '' : css.slice(debut, css.indexOf('}', debut))
  }

  // Le plan dit « environ deux secondes » ; les durées de la maquette en faisaient 3 050, à chaque
  // film compostée, bouton éteint. Mutation : les durées de la maquette (3 050 ms).
  it('dure environ deux secondes, du toucher au retour à l’année', () => {
    expect(DUREE_DU_COMPOSTAGE).toBeGreaterThanOrEqual(1800)
    expect(DUREE_DU_COMPOSTAGE).toBeLessThanOrEqual(2200)
  })

  // Le jumeau : la page attend `FRAPPE`, les feuilles jouent leurs propres durées. Mutations : la
  // descente, la remontée ou le départ du talon changés dans une feuille seulement.
  it('les feuilles jouent les durées que la page attend', () => {
    expect(duree(TAMPON, 'descend')).toBe(FRAPPE.descend)
    expect(duree(TAMPON, 'remonte')).toBe(FRAPPE.remonte)
    expect(duree(BILLET, 'part')).toBe(FRAPPE.talon)
  })

  // L'éclat de l'encre (260 ms) et le choc du billet (350 ms) duraient plus que la pause : la règle
  // qui les lançait cessait de s'appliquer quand le marteau remontait, et l'animation s'arrêtait net.
  // Mutation : la règle de l'éclat, ou du choc, réduite à l'étape `pose`.
  it.each([
    ['l’éclat de l’encre', 'eclat', () => TAMPON],
    ['le choc du billet', 'choc', () => BILLET],
  ] as const)('%s n’est pas coupé quand le marteau remonte', (_nom, animation, css) => {
    const sel = selecteur(css(), animation)
    expect(sel).toMatch(/'pose'/)
    expect(sel).toMatch(/'remonte'/)
    expect(duree(css(), animation)).toBeLessThanOrEqual(FRAPPE.pause + FRAPPE.remonte)
  })

  // La frappe amène le haut du billet à l'écran : le talon qui partait de son bas (sous la remarque,
  // à 1 000 px du haut d'un écran de 844) tombait hors de la vue, et ses 1 500 ms ne montraient rien.
  // Mutation : `bottom: 0` d'avant.
  it('le talon part du haut du billet, sous le numéro, là où l’écran l’a amené', () => {
    const talon = regle(BILLET, '.talonQuiPart')
    expect(talon).toMatch(/top:\s*\d+px/)
    expect(talon).not.toMatch(/bottom:/)
  })
})
