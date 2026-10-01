import { describe, expect, it } from 'vitest'
import { FRAPPE, VIBRATION } from './billet'
import { auTempo } from './tempo'

/**
 * L'inventaire du tempo (`tempo.ts`) : chaque durée et chaque délai de ce qui suit le geste « vu »
 * passe par lui, en CSS comme en JS. Une durée écrite en dur dans ces fichiers échappe au réglage, et
 * se désynchronise de celles qui le suivent.
 */

const FEUILLES: Record<string, string> = {
  ...import.meta.glob<string>('/src/voyage/billet/Tampon.module.css', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('/src/pages/VoyageBillet.module.css', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('/src/voyage/annee/Corde.module.css', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('/src/voyage/celebrations/Celebrations.module.css', { query: '?raw', import: 'default', eager: true }),
}
const SOURCES: Record<string, string> = {
  ...import.meta.glob<string>('/src/pages/VoyageBillet.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('/src/pages/VoyageAnnee.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('/src/voyage/annee/Corde.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('/src/voyage/billet.ts', { query: '?raw', import: 'default', eager: true }),
  // Les célébrations, qui suivent le même geste : leur déroulé, leur séquenceur, leurs scènes.
  ...import.meta.glob<string>(['/src/voyage/celebrations/*.{ts,tsx}', '!**/*.test.*'], { query: '?raw', import: 'default', eager: true }),
}
const DEROULE = '/src/voyage/celebrations/deroule.ts'
const source = (chemin: string) => SOURCES[chemin] ?? ''

const sansCommentaires = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Une durée au tempo, telle que les feuilles l'écrivent : `calc(360ms * var(--tempo))`. */
const AU_TEMPO = /calc\(\s*\d+ms\s*\*\s*var\(--tempo\)\s*\)/g
/** Une durée CSS, quelle qu'elle soit : `0.35s`, `700ms`, `-1.1s`. */
const DUREE = /(?<![\w.#-])-?\d*\.?\d+m?s\b/g

/**
 * Les animations de chaque feuille qui suivent le geste « vu » : le plancher de l'inventaire, sans
 * lequel une feuille vidée de ses animations le passerait sans rien garder.
 */
const ANIMATIONS: Record<string, string[]> = {
  '/src/voyage/billet/Tampon.module.css': ['eclat', 'descend', 'remonte'],
  '/src/pages/VoyageBillet.module.css': ['choc', 'part'],
  '/src/voyage/annee/Corde.module.css': ['rouler'],
  '/src/voyage/celebrations/Celebrations.module.css': ['leve', 'parait', 'fermeGauche', 'fermeDroite', 'efface', 'lance', 'frappe', 'eclair', 'sort', 'allume', 'tombe', 'tend'],
}

/**
 * Ce qui bouge sans suivre le geste : le balancement des billets de la corde, en boucle sur toute
 * année prête. Il n'est pas une étape de la séquence, et ne passe pas par le tempo.
 */
const AMBIANCE: Record<string, (selecteur: string) => boolean> = {
  '/src/voyage/annee/Corde.module.css': (s) => /^\.billet\b/.test(s),
}

/** Le sélecteur de la règle où tombe la position `i`. */
const selecteur = (css: string, i: number) => css.slice(css.lastIndexOf('}', i) + 1, css.lastIndexOf('{', i)).split('{').pop()!.trim()

describe('le tempo de ce qui suit le geste « vu »', () => {
  it('trouve les fichiers qu’il garde', () => {
    expect(Object.keys(FEUILLES).sort()).toEqual(Object.keys(ANIMATIONS).sort())
    expect(Object.keys(SOURCES)).toEqual(
      expect.arrayContaining([
        '/src/pages/VoyageBillet.tsx',
        '/src/pages/VoyageAnnee.tsx',
        '/src/voyage/annee/Corde.tsx',
        '/src/voyage/billet.ts',
        DEROULE,
        '/src/voyage/celebrations/Celebrations.tsx',
        '/src/voyage/celebrations/Cadre.tsx',
        '/src/voyage/celebrations/SalleBouclee.tsx',
        '/src/voyage/celebrations/PresseAMedailles.tsx',
        '/src/voyage/celebrations/AnneeBouclee.tsx',
      ]),
    )
    expect(Object.keys(SOURCES).filter((chemin) => chemin.includes('.test.'))).toEqual([])
  })

  // Mutations : `animation: eclat 260ms` (ou `choc 0.35s`, `part 700ms`, `rouler 0.8s 0.35s`) remis
  // dans une feuille.
  it.each(Object.keys(ANIMATIONS))('%s n’écrit aucune durée hors du tempo', (chemin) => {
    const css = sansCommentaires(FEUILLES[chemin]!)
    for (const nom of ANIMATIONS[chemin]!) expect(css).toMatch(new RegExp(`animation:\\s*${nom}\\s+calc\\(\\s*\\d+ms\\s*\\*\\s*var\\(--tempo\\)`))
    const reste = css.replace(AU_TEMPO, 'TEMPO')
    const enDur = [...reste.matchAll(DUREE)]
      .filter((m) => !(AMBIANCE[chemin]?.(selecteur(reste, m.index)) ?? false))
      .map((m) => `${selecteur(reste, m.index)} : ${m[0]}`)
    expect(enDur).toEqual([])
  })

  // Mutations : `attendre(140)` dans le compostage ; `vibrer([18, 40, 70])` remis sur le billet ou au
  // palier ; `duration: 1100` ou `delay: 250` remis au « +1 ».
  it.each(Object.keys(SOURCES))('%s n’attend, ne vibre ni n’anime en dur', (chemin) => {
    const code = sansCommentaires(source(chemin))
    expect(code).not.toMatch(/attendre\(\s*\d/)
    expect(code).not.toMatch(/setTimeout\([^;]*,\s*\d+\s*\)/)
    expect(code).not.toMatch(/vibrer\(\s*[[\d]/)
    expect(code).not.toMatch(/\b(duration|delay)\s*:\s*\d/)
  })

  // Le plancher du jumeau : le compostage attend bien `FRAPPE`, étape par étape, et le « +1 » vole au
  // tempo. Mutation : `auTempo` retiré du « +1 » (le motif précédent le dirait aussi, s'il restait un
  // chiffre ; ici, le nom même).
  it('le compostage attend ses six étapes, et le « +1 » vole au tempo', () => {
    const billet = sansCommentaires(source('/src/pages/VoyageBillet.tsx'))
    for (const etape of ['descend', 'pause', 'remonte', 'tirage', 'avantTalon', 'talon']) expect(billet).toContain(`attendre(FRAPPE.${etape})`)
    const corde = sansCommentaires(source('/src/voyage/annee/Corde.tsx'))
    expect(corde).toMatch(/duration:\s*auTempo\(/)
    expect(corde).toMatch(/delay:\s*auTempo\(/)
  })

  // Le déroulé des célébrations : chaque attente et la vibration sont au tempo. Mutations : un pas
  // écrit `700` au lieu d'`auTempo(700)` ; la vibration à ses valeurs de base (`[18, 40, 70]`).
  it('chaque pas des célébrations et leur vibration sont au tempo', () => {
    const code = sansCommentaires(source(DEROULE))
    const blocs = [...code.matchAll(/export const (\w+) = \[([^\]]*)\]/g)].map(([, nom, corps]) => [nom!, corps!] as const)
    expect(blocs.map(([nom]) => nom)).toEqual(['SALLE', 'RECOMPENSE', 'ANNEE', 'VIBRATION_DE_FETE'])
    for (const [, corps] of blocs) {
      const valeurs = corps.split(',').map((v) => v.trim()).filter(Boolean)
      expect(valeurs.length).toBeGreaterThan(0)
      expect(valeurs.filter((v) => !/^auTempo\(\d+\)$/.test(v))).toEqual([])
    }
    // Hors de ces tableaux, le module n'écrit aucune durée : ses seuls nombres sont des rangs de pas.
    expect(code.replace(/auTempo\(\d+\)/g, '').match(/\d{2,}/g) ?? []).toEqual([])
  })

  // Mutations : une étape de `FRAPPE` écrite sans `auTempo` ; la vibration à ses valeurs de base.
  it('chaque étape du compostage et la vibration sont au tempo', () => {
    const bloc = /export const FRAPPE = \{([\s\S]*?)\}/.exec(sansCommentaires(source('/src/voyage/billet.ts')))?.[1] ?? ''
    const champs = [...bloc.matchAll(/(\w+):\s*([^,\n]+)/g)].map(([, cle, valeur]) => [cle!, valeur!.trim()] as const)
    expect(champs.map(([cle]) => cle)).toEqual(['descend', 'pause', 'remonte', 'tirage', 'tirages', 'avantTalon', 'talon'])
    // `tirages` est un compte, pas une durée.
    expect(champs.filter(([cle, valeur]) => cle !== 'tirages' && !/^auTempo\(\d+\)$/.test(valeur))).toEqual([])
    expect(FRAPPE.tirages).toBe(10)
    expect(VIBRATION).toEqual([18, 40, 70].map(auTempo))
  })
})
