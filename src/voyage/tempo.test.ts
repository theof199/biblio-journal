import { describe, expect, it } from 'vitest'
import { FRAPPE, VIBRATION } from './billet'
import { auTempo } from './tempo'

/**
 * L'inventaire du tempo (`tempo.ts`) : chaque durée et chaque délai de ce qui suit le geste « vu »
 * passe par lui, en CSS comme en JS. Une durée écrite en dur dans ces fichiers échappe au réglage, et
 * se désynchronise de celles qui le suivent.
 */

/** Tout le code et toutes les feuilles de l'app, hors tests : les filtres en tirent ce que ce fichier garde. */
const TOUT = import.meta.glob<string>(['/src/**/*.{ts,tsx,css}', '!**/*.test.*'], { query: '?raw', import: 'default', eager: true })

/**
 * Les animations de chaque feuille qui suivent le geste « vu » : le plancher de l'inventaire, sans
 * lequel une feuille vidée de ses animations le passerait sans rien garder.
 */
const ANIMATIONS: Record<string, string[]> = {
  '/src/voyage/billet/Tampon.module.css': ['eclat', 'descend', 'remonte'],
  '/src/pages/VoyageBillet.module.css': ['choc', 'part'],
  '/src/voyage/annee/Corde.module.css': ['rouler'],
  // La carte : la pulsation du compteur de bobines, le message qui monte, l'envol d'un objet ramassé.
  '/src/carte/Carte.module.css': ['pulse', 'monte', 'envol'],
  '/src/voyage/celebrations/Celebrations.module.css': ['leve', 'parait', 'fermeGauche', 'fermeDroite', 'efface', 'lance', 'frappe', 'eclair', 'sort', 'allume', 'tombe', 'tend'],
}

/** Le code qui suit le geste « vu », nommé fichier par fichier. */
const SUIVENT_LE_GESTE = ['/src/pages/VoyageBillet.tsx', '/src/pages/VoyageAnnee.tsx', '/src/voyage/annee/Corde.tsx', '/src/voyage/billet.ts']

/**
 * Une feuille gardée : celles d'`ANIMATIONS`, et **toute** feuille d'un monde. Un gabarit de monde
 * (`Monde.pages.gabarits`) peut porter le « +1 », le compostage ou une fête : aucune de ses feuilles
 * n'échappe, et ce qui y bouge sans suivre le geste se déclare dans `AMBIANCE`.
 */
const feuilleGardee = (chemin: string) => chemin in ANIMATIONS || /^\/src\/mondes\/.+\.css$/.test(chemin)
/**
 * Une source gardée : le code nommé, les célébrations (leur déroulé, leur séquenceur, leurs scènes,
 * sans leurs sous-dossiers), et tout le code des mondes, composants compris (`.tsx`).
 */
const sourceGardee = (chemin: string) =>
  !/\.test\./.test(chemin) &&
  (SUIVENT_LE_GESTE.includes(chemin) || /^\/src\/voyage\/celebrations\/[^/]+\.tsx?$/.test(chemin) || /^\/src\/mondes\/.+\.tsx?$/.test(chemin))

const FEUILLES: Record<string, string> = Object.fromEntries(Object.entries(TOUT).filter(([chemin]) => feuilleGardee(chemin)))
const SOURCES: Record<string, string> = Object.fromEntries(Object.entries(TOUT).filter(([chemin]) => sourceGardee(chemin)))
/** La page de la carte : lue pour sa seule annonce hors de vue. Ses autres attentes (le carton, le tampon) sont hors tempo. */
const PAGE_DE_LA_CARTE = import.meta.glob<string>('/src/pages/Carte.tsx', { query: '?raw', import: 'default', eager: true })['/src/pages/Carte.tsx'] ?? ''
const DEROULE = '/src/voyage/celebrations/deroule.ts'
const DUREES_1900 = '/src/mondes/1900/durees.ts'
const ENTREE_1900 = '/src/mondes/1900/entree.ts'
const source = (chemin: string) => SOURCES[chemin] ?? ''

const sansCommentaires = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Une durée au tempo, telle que les feuilles l'écrivent : `calc(360ms * var(--tempo))`. */
const AU_TEMPO = /calc\(\s*\d+ms\s*\*\s*var\(--tempo\)\s*\)/g
/** Une durée CSS, quelle qu'elle soit : `0.35s`, `700ms`, `-1.1s`. */
const DUREE = /(?<![\w.#-])-?\d*\.?\d+m?s\b/g

/**
 * Ce qui bouge sans suivre le geste : le balancement des billets de la corde, en boucle sur toute
 * année prête. Il n'est pas une étape de la séquence, et ne passe pas par le tempo. Une feuille de
 * monde y déclare de même, par son sélecteur, ce qui tourne en boucle ou répond à un survol.
 */
const AMBIANCE: Record<string, (selecteur: string) => boolean> = {
  '/src/voyage/annee/Corde.module.css': (s) => /^\.billet\b/.test(s),
  // La carte : le point rouge de la sacoche bat en boucle (lot d'écrans, brief 5).
  '/src/carte/Carte.module.css': (s) => s === '.boutons .point',
  // La tête de la gare 1900 : la trotteuse de l'horloge, la lanterne du laboratoire et le feu du sémaphore, en boucle.
  '/src/mondes/1900/pages/Tete.module.css': (s) => /^\.tete\[data-vivante='oui'\] \.(trotteuse|lanterne|feu)$/.test(s),
  // La courroie 1900 : l'anneau qui tourne tant que l'indicateur se relit, en boucle.
  '/src/mondes/1900/pages/Courroie.module.css': (s) => s === ".courroie[data-vivante='oui'] .anneau",
  // La fausse voiture d'un Hale's Tours : l'écran et les banquettes qui tanguent, le faisceau et l'écran qui scintillent, en boucle.
  '/src/mondes/1900/pages/Hale.module.css': (s) => /^\.hale\[data-vivante='oui'\] \.(ecran|ecran::after|faisceau|banquettes)$/.test(s),
  // Le wagon-restaurant 1900 : la campagne qui file derrière la vitre, trois plans, en boucle.
  '/src/mondes/1900/pages/Wagon.module.css': (s) => /^\.scene\[data-vivante='oui'\] \.(l1|l2|l3)$/.test(s),
}

/**
 * Les exemptions héritées : ni boucle ni survol, donc pas de l'ambiance. Deux règles de la carte
 * écrites avant que sa feuille soit gardée (lot d'écrans, brief 5), qui paraissent une fois sans suivre
 * le geste « vu » et gardent leur durée d'avant, hors tempo. La table ne s'allonge pas : une règle
 * neuve s'écrit au tempo, et une exemption que la feuille n'emploie plus se retire.
 */
const EXEMPTIONS_HERITEES: Record<string, readonly string[]> = {
  // L'aperçu d'une année (0,24 s) et le carton d'un monde (1,2 s).
  '/src/carte/Carte.module.css': ['.apercu', '.carton'],
}
const exemptee = (chemin: string, s: string) => (AMBIANCE[chemin]?.(s) ?? false) || (EXEMPTIONS_HERITEES[chemin]?.includes(s) ?? false)

/** Le sélecteur de la règle où tombe la position `i`. */
const selecteur = (css: string, i: number) => css.slice(css.lastIndexOf('}', i) + 1, css.lastIndexOf('{', i)).split('{').pop()!.trim()

describe('le tempo de ce qui suit le geste « vu »', () => {
  it('trouve les fichiers qu’il garde', () => {
    expect(Object.keys(FEUILLES).filter((chemin) => !chemin.startsWith('/src/mondes/')).sort()).toEqual(Object.keys(ANIMATIONS).sort())
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
        DUREES_1900,
        ENTREE_1900,
        '/src/mondes/1900/index.ts',
        '/src/mondes/1900/gares.ts',
      ]),
    )
    expect(Object.keys(SOURCES).filter((chemin) => chemin.includes('.test.'))).toEqual([])
  })

  // Le jumeau du plancher, pour ce qu'un monde n'a pas encore (plan des pages 1900, brief 0 : aucun
  // composant ni aucune feuille sous `src/mondes/` à ce jour) : les filtres se prouvent sur des
  // chemins écrits. Mutations : `tsx?` ramené à `ts` dans le filtre des mondes ; la branche `mondes`
  // retirée du filtre des feuilles ; le glob ramené aux `.ts`.
  it('garde les composants et les feuilles d’un monde, jamais ses tests', () => {
    expect(Object.keys(TOUT)).toEqual(expect.arrayContaining(['/src/ui/theme.css', '/src/pages/Carte.tsx']))
    expect(['/src/mondes/1900/pages/Gare.tsx', '/src/mondes/1910/pages/tete/Plaque.tsx', '/src/mondes/1900/durees.ts'].filter((chemin) => !sourceGardee(chemin))).toEqual([])
    expect(['/src/mondes/1900/pages/Gare.module.css', '/src/mondes/1910/pages/tete/plaque.css'].filter((chemin) => !feuilleGardee(chemin))).toEqual([])
    expect(['/src/mondes/1900/pages/Gare.test.tsx', '/src/pages/Carte.tsx', '/src/voyage/celebrations/sous/Scene.tsx'].filter(sourceGardee)).toEqual([])
    expect(['/src/voyage/annee/Fronton.module.css', '/src/ui/theme.css'].filter(feuilleGardee)).toEqual([])
  })

  // Mutations : `animation: eclat 260ms` (ou `choc 0.35s`, `part 700ms`, `rouler 0.8s 0.35s`) remis
  // dans une feuille.
  // Une feuille de monde est gardée sans y être nommée, sans plancher d'animations : toute durée s'y
  // écrit au tempo ou se déclare dans `AMBIANCE`. Mutation : `transition: opacity 0.3s` dans une
  // feuille posée sous `src/mondes/`.
  it.each(Object.keys(FEUILLES))('%s n’écrit aucune durée hors du tempo', (chemin) => {
    const css = sansCommentaires(FEUILLES[chemin]!)
    for (const nom of ANIMATIONS[chemin] ?? []) expect(css).toMatch(new RegExp(`animation:\\s*${nom}\\s+calc\\(\\s*\\d+ms\\s*\\*\\s*var\\(--tempo\\)`))
    const reste = css.replace(AU_TEMPO, 'TEMPO')
    const enDur = [...reste.matchAll(DUREE)]
      .filter((m) => !exemptee(chemin, selecteur(reste, m.index)))
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
    expect(blocs.map(([nom]) => nom)).toEqual(['SALLE', 'RECOMPENSE', 'BADGE', 'ANNEE', 'VIBRATION_DE_FETE'])
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

  // Les durées du monde 1900 : le fichier ne porte que des `auTempo(…)`. Aucun motif général ne
  // refuserait `export const X = 2600`. Mutation : une durée écrite sans `auTempo`.
  it('chaque durée du monde 1900 est au tempo, et son fichier ne porte rien d’autre', () => {
    const code = sansCommentaires(source(DUREES_1900))
    const valeurs = [...code.matchAll(/^export const \w+ = (.+)$/gm)].map(([, valeur]) => valeur!.trim())
    expect(valeurs.length).toBeGreaterThan(0)
    expect(valeurs.filter((v) => !/^auTempo\(\d+\)$/.test(v))).toEqual([])
    // Hors de l'import du tempo et de ces lignes, rien : ni objet, ni calcul, ni durée tenue ailleurs.
    const reste = code.replace(/^import \{ auTempo \} from '\.\.\/\.\.\/voyage\/tempo'$/m, '').replace(/^export const \w+ = auTempo\(\d+\)$/gm, '')
    expect(reste.trim()).toBe('')
  })

  // L'annonce hors de vue de la carte (revue du lot 2) : sa durée est une constante au tempo, écrite une
  // fois, et c'est elle que l'effacement attend. Mutations : `3100` remis dans le `setTimeout` ;
  // `DUREE_DE_L_ANNONCE = 3100`, sans `auTempo`.
  it('l’annonce hors de vue de la carte s’efface au tempo', () => {
    const code = sansCommentaires(PAGE_DE_LA_CARTE)
    expect(code.match(/^const DUREE_DE_L_ANNONCE = auTempo\(\d+\)$/gm) ?? []).toHaveLength(1)
    // Chaque effacement de l'annonce par une horloge attend cette constante, et rien d'autre.
    const effacements = [...code.matchAll(/setTimeout\(\(\) => setAnnonce\(null\),\s*([^)]+)\)/g)].map(([, duree]) => duree!.trim())
    expect(effacements).toEqual(['DUREE_DE_L_ANNONCE'])
  })

  // Les temps du passage d'entrée du monde 1900 s'écrivent en base : le moteur seul les joue au tempo
  // (`carte/meneur.ts`), et un `auTempo` ici le compterait deux fois. Le fichier ne l'écrit ni ne
  // l'importe. Mutation : un `auTempo(` ajouté, même sur une valeur divisée d'autant.
  it('les temps du passage d’entrée du monde 1900 sont en base : leur fichier n’écrit pas le tempo', () => {
    const code = sansCommentaires(source(ENTREE_1900))
    // Le plancher : le fichier porte bien des durées et des pauses, en nombres nus.
    expect(code.match(/\bduree: \d+, arret: \d+\b/g)?.length).toBeGreaterThan(1)
    expect(code).not.toMatch(/auTempo|TEMPO|tempo/)
    // Chaque durée et chaque pause est un nombre écrit : ni appel, ni calcul, ni constante venue d'ailleurs.
    const valeurs = [...code.matchAll(/\b(?:duree|arret):\s*([^,}]+)/g)].map(([, valeur]) => valeur!.trim())
    expect(valeurs.filter((valeur) => !/^\d+$/.test(valeur))).toEqual([])
  })

  // Une exemption héritée nomme une règle qui existe et qui porte encore une durée en dur : sinon elle
  // ne garde plus rien et laisserait passer la prochaine règle du même nom. Mutations : `.fantome`
  // ajouté à la table ; la durée de `.carton` passée au tempo sans retirer sa ligne.
  it('chaque exemption héritée sert encore : sa règle existe et porte une durée hors tempo', () => {
    for (const [chemin, selecteurs] of Object.entries(EXEMPTIONS_HERITEES)) {
      const reste = sansCommentaires(FEUILLES[chemin] ?? '').replace(AU_TEMPO, 'TEMPO')
      const enDur = new Set([...reste.matchAll(DUREE)].map((m) => selecteur(reste, m.index)))
      expect(selecteurs.filter((s) => !enDur.has(s))).toEqual([])
    }
  })

  // L'envol d'un objet ramassé (lot d'écrans, brief 4) : la page attend la durée que la feuille joue,
  // sinon l'objet est retiré en plein vol ou reste posé sur la pastille. Mutations : `1300ms` changé
  // dans `.vol` sans toucher à la page ; `auTempo(1300)` changé dans la page sans toucher à la
  // feuille ; `DUREE_DE_L_ENVOL = 1300`, sans `auTempo` ; le ramassage qui attend un nombre écrit.
  it('l’envol d’un objet dure dans la page ce qu’il dure dans la feuille de la carte', () => {
    const code = sansCommentaires(PAGE_DE_LA_CARTE)
    const page = [...code.matchAll(/^const DUREE_DE_L_ENVOL = auTempo\((\d+)\)$/gm)].map(([, ms]) => ms)
    expect(page).toHaveLength(1)
    const css = sansCommentaires(FEUILLES['/src/carte/Carte.module.css'] ?? '')
    const feuille = [...css.matchAll(/animation:\s*envol\s+calc\(\s*(\d+)ms\s*\*\s*var\(--tempo\)\s*\)/g)].map(([, ms]) => ms)
    expect(feuille).toEqual(page)
    // Le ramassage attend cette constante, et aucune autre attente de la page n'est un nombre écrit pour elle.
    expect(code.match(/envol = attendre\(([^)]*)\)/)?.[1]).toBe('DUREE_DE_L_ENVOL')
  })

  // Le point rouge de la sacoche (lot d'écrans, brief 5) : une boucle, et au calme un point fixe. Les
  // autres règles de la feuille ne bouclent pas. Mutations : `.boutons .point` retiré du bloc
  // « réduire les animations » ; `infinite` posé sur une autre règle de la feuille.
  it('sur la carte, seul le point rouge bat en boucle, et il se fige au calme', () => {
    const css = sansCommentaires(FEUILLES['/src/carte/Carte.module.css'] ?? '')
    const boucles = [...css.matchAll(/\binfinite\b/g)].map((m) => selecteur(css, m.index))
    expect(boucles).toEqual(['.boutons .point'])
    const calme = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?\})\s*\}/g)].map(([, bloc]) => bloc!).join('\n')
    const figes = [...calme.matchAll(/([^{}]+)\{\s*animation:\s*none;?\s*\}/g)].flatMap(([, s]) => s!.split(',').map((x) => x.trim()))
    expect(figes).toContain('.boutons .point')
  })
})
