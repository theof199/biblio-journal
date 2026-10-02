import { describe, expect, it } from 'vitest'
import theme from './theme.css?raw'
import voyage from './voyage.css?raw'
import coque from '../coque/Coque.module.css?raw'
import affiche from './Affiche.module.css?raw'
import auCine from '../pages/AuCine.module.css?raw'
import suivis from '../pages/Suivis.module.css?raw'
import recherche from '../pages/Recherche.module.css?raw'
import formulaire from '../pages/Formulaire.module.css?raw'
import rangeeDeNote from '../formulaire/RangeeDeNote.module.css?raw'
import tampons from '../formulaire/Tampons.module.css?raw'
import planche from '../suivis/PlancheCycle.module.css?raw'
import papier from '../suivis/Papier.module.css?raw'
import affichette from '../suivis/Affichette.module.css?raw'
import intercalaires from '../suivis/Intercalaires.module.css?raw'
import pellicule from '../accueil/Pellicule.module.css?raw'

/** Tous les `*.module.css` de l'app, par chemin (`/src/…`). */
const MODULES = import.meta.glob<string>('/src/**/*.module.css', { query: '?raw', import: 'default', eager: true })

/** Le Voyage a son habillage à lui (`voyage.css`) : ses styles vivent sous ces dossiers ou ces noms. */
const DU_VOYAGE = /\/(carte|mondes|voyage)\/|\/Voyage[^/]*\.module\.css$/

const HORS_VOYAGE = Object.entries(MODULES).filter(([chemin]) => !DU_VOYAGE.test(chemin))

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Les déclarations `propriété: valeur` d'une feuille, commentaires ôtés. */
function declarations(css: string) {
  return [...sansCommentaires(css).matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map(([, prop, valeur]) => ({
    prop: prop!,
    valeur: valeur!.trim(),
  }))
}

/** Les variables lues par `var(--…)`. */
const lues = (css: string) => [...sansCommentaires(css).matchAll(/var\(\s*(--[\w-]+)/g)].map(([, nom]) => nom!)

/** Les variables définies (`--nom:`). */
const definies = (css: string) => new Set([...sansCommentaires(css).matchAll(/(--[\w-]+)\s*:/g)].map(([, nom]) => nom!))

/** Le corps de la règle d'un sélecteur, tel qu'écrit. */
function regle(css: string, selecteur: string) {
  const debut = sansCommentaires(css).indexOf(`${selecteur} {`)
  if (debut < 0) throw new Error(`règle absente : ${selecteur}`)
  const reste = sansCommentaires(css).slice(debut)
  return reste.slice(reste.indexOf('{') + 1, reste.indexOf('}'))
}

/** Ce qu'une valeur a le droit de porter en dur : la mise en page, pas l'habillage. */
const PERMIS = new Set(['0', '100%', '100dvh'])

describe('le thème', () => {
  it('trouve les feuilles qu’il garde', () => {
    // Sans ce plancher, un glob qui ne trouverait plus rien rendrait les gardes suivantes muettes.
    expect(HORS_VOYAGE.map(([chemin]) => chemin)).toEqual(
      expect.arrayContaining(['/src/coque/Coque.module.css', '/src/pages/Connexion.module.css', '/src/pages/Accueil.module.css']),
    )
  })

  it.each(HORS_VOYAGE)('%s ne porte ni couleur ni taille en dur', (_chemin, css) => {
    const fautes = declarations(css).flatMap(({ prop, valeur }) => {
      // Ce qui passe par une variable ou par la zone sûre du téléphone ne compte pas.
      const nue = valeur.replace(/var\([^()]*\)/g, '').replace(/env\([^()]*\)/g, '')
      const couleurs = nue.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab)\(|\b(white|black|red|blue|green|gr[ae]y)\b/gi) ?? []
      const nombres = (nue.match(/-?\d*\.?\d+[a-z%]*/gi) ?? []).filter((n) => !PERMIS.has(n) && !(prop === 'flex' && n === '1'))
      return [...couleurs, ...nombres].map((faute) => `${prop}: ${valeur} (${faute})`)
    })
    expect(fautes).toEqual([])
  })

  it.each(HORS_VOYAGE)('%s ne lit que des variables de theme.css', (_chemin, css) => {
    // Attrape la faute de frappe, qui retombe en silence sur la valeur héritée, et la palette du
    // Voyage (`--papier`…), qui n'est pas définie dans theme.css.
    const connues = definies(theme)
    expect(lues(css).filter((nom) => !connues.has(nom))).toEqual([])
  })

  it('theme.css ne lit rien du Voyage', () => {
    const duVoyage = definies(voyage)
    expect(duVoyage.size).toBeGreaterThan(0)
    expect(lues(theme).filter((nom) => duVoyage.has(nom))).toEqual([])
  })
})

describe('la zone sûre du téléphone', () => {
  it('la barre d’onglets s’écarte du bas de l’écran', () => {
    expect(regle(coque, '.barre')).toMatch(/padding:[^;]*env\(safe-area-inset-bottom\)/)
  })

  it('le contenu laisse libre la barre et la zone sûre', () => {
    expect(regle(theme, ':root')).toMatch(/--coque-bas:[^;]*env\(safe-area-inset-bottom\)/)
    // Ancrée : `min-height` passerait sinon, et la zone, grandie avec sa page, ne défilerait plus.
    expect(regle(coque, '.contenu')).toMatch(/(^|[\s;])height:\s*calc\(100% - var\(--coque-bas\)\)/)
  })
})

describe('la barre d’onglets : le rouleau du guichet', () => {
  const COURANT = ".element:has(> [aria-current='page'])"
  const BLOC_JOUR = regle(theme, ':root')
  const BLOCS_SOMBRES = [regle(theme, ":root:not([data-theme='clair'])"), regle(theme, ":root[data-theme='sombre']")]
  /** Les lumières du projecteur d'en bas, éteintes de jour : leur valeur « éteint ». */
  const LUMIERES = [
    ['--billet-onglet-faisceau', 'transparent'],
    ['--billet-onglet-faisceau-vif', 'transparent'],
    ['--billet-onglet-penombre', 'none'],
    ['--billet-onglet-eclat', 'none'],
    ['--billet-onglet-papier-eclaire', 'var(--ticket-papier)'],
  ] as const

  /** La valeur d'un jeton dans un bloc, tel qu'écrite. */
  const valeurDe = (bloc: string, jeton: string) => bloc.match(new RegExp(`${jeton}:\\s*([^;]+);`))?.[1]?.trim()

  it('les billets sont découpés dans le papier des billets du profil, aux quatre coins', () => {
    expect(regle(coque, '.onglet')).toMatch(/background:\s*var\(--ticket-papier\)/)
    expect(regle(coque, '.onglet')).toMatch(/(^|[\s;])mask:\s*var\(--billet-onglet-masque\)/)
    expect(valeurDe(BLOC_JOUR, '--billet-onglet-masque')?.match(/radial-gradient/g)).toHaveLength(4)
  })

  it('le billet de la page courante sort du rouleau, levé et penché', () => {
    expect(regle(coque, COURANT)).toMatch(/transform:\s*translateY\(var\(--billet-onglet-levee\)\) rotate\(var\(--billet-onglet-inclinaison\)\)/)
  })

  it('il porte son encre pleine et la bande rouge le long de son bord haut', () => {
    const courant = regle(coque, ".onglet[aria-current='page']")
    expect(courant).toMatch(/color:\s*var\(--ticket-encre\)/)
    expect(courant).toMatch(/box-shadow:\s*inset 0 var\(--billet-onglet-bande-hauteur\) 0 var\(--ticket-bande-vive\)/)
  })

  it.each(LUMIERES)('le projecteur est éteint de jour : %s', (jeton, eteint) => {
    expect(sansCommentaires(theme).match(new RegExp(`${jeton}:`, 'g'))).toHaveLength(3)
    expect(valeurDe(BLOC_JOUR, jeton)).toBe(eteint)
  })

  it.each(LUMIERES)('et allumé la nuit, des mêmes valeurs dans les deux blocs sombres : %s', (jeton, eteint) => {
    const [suivantLeTelephone, force] = BLOCS_SOMBRES.map((bloc) => valeurDe(bloc, jeton))
    expect(suivantLeTelephone).toBeDefined()
    expect(suivantLeTelephone).not.toBe(eteint)
    expect(force).toBe(suivantLeTelephone)
  })

  it('l’ombre du rouleau est plus forte la nuit, le papier, l’encre et la bande ne changent pas', () => {
    const [nuit] = BLOCS_SOMBRES
    expect(valeurDe(nuit!, '--billet-onglet-ombre')).not.toBe(valeurDe(BLOC_JOUR, '--billet-onglet-ombre'))
    for (const jeton of ['--ticket-papier', '--ticket-encre', '--ticket-bande-vive', '--ticket-pointille']) {
      expect(valeurDe(nuit!, jeton)).toBeUndefined()
    }
  })

  it('les autres billets sont dans la pénombre, le billet courant rayonne', () => {
    expect(regle(coque, '.element')).toMatch(/filter:\s*var\(--billet-onglet-penombre\)/)
    expect(regle(coque, COURANT)).toMatch(/filter:\s*var\(--billet-onglet-eclat\)/)
  })

  it('le papier du billet courant est celui que le projecteur éclaire', () => {
    expect(regle(coque, ".onglet[aria-current='page']")).toMatch(/background:\s*var\(--billet-onglet-papier-eclaire\)/)
  })

  it('le cône est pendu au billet de la liste, pas au lien que son masque couperait', () => {
    expect(regle(coque, `${COURANT}::after`)).toMatch(/background:\s*var\(--billet-onglet-cone-fond\)/)
    expect(sansCommentaires(coque)).not.toMatch(/\.onglet[^{]*::(before|after)/)
  })

  it('la hauteur du cône est celle de la zone sûre : sans zone sûre, rien ne dépasse de la barre', () => {
    expect(regle(coque, `${COURANT}::after`)).toMatch(/(^|[\s;])height:\s*env\(safe-area-inset-bottom\);/)
  })

  it('le cône ne prend pas la place d’un billet ni les touchers', () => {
    const cone = regle(coque, `${COURANT}::after`)
    expect(cone).toMatch(/position:\s*absolute/)
    expect(cone).toMatch(/pointer-events:\s*none/)
  })

  it('le focus clavier est tracé dans le billet, où le masque ne le coupe pas', () => {
    expect(regle(coque, '.onglet:focus-visible')).toMatch(/outline-offset:\s*var\(--billet-onglet-focus-retrait\)/)
    expect(valeurDe(BLOC_JOUR, '--billet-onglet-focus-retrait')).toMatch(/^-\d/)
  })

  it('la barre ne grandit pas : sa hauteur et son fond sont ceux d’avant', () => {
    expect(regle(coque, '.liste')).toMatch(/height:\s*var\(--barre-onglets-hauteur\)/)
    expect(valeurDe(BLOC_JOUR, '--barre-onglets-hauteur')).toBe('3.75rem')
  })
})

describe('le ciel du bâtiment', () => {
  it('le corps le peint, sauf quand le Voyage est à l’écran', () => {
    expect(regle(theme, ":root:not([data-lieu='ecran']) body")).toMatch(/background-image:\s*var\(--fond-ciel\)/)
    expect(regle(theme, 'body')).not.toMatch(/background-image/)
  })

  it('l’accueil, le profil et la caisse le laissent passer : leur page ne peint pas son propre fond', () => {
    const peintres = ['Accueil', 'Profil', 'Caisse'].filter((nom) => {
      const css = MODULES[`/src/pages/${nom}.module.css`]!
      return regle(css, '.fond').match(/background/) !== null
    })
    expect(peintres).toEqual([])
  })

  it('la barre d’onglets prend le bas du ciel, de jour comme de nuit', () => {
    expect(regle(coque, '.barre')).toMatch(/background:\s*var\(--barre-onglets-fond\)/)
    expect(sansCommentaires(theme).match(/--barre-onglets-fond:/g)).toHaveLength(3)
  })
})

describe('le défilement', () => {
  it('seule la zone de contenu de la coque défile, bornée au-dessus de la barre', () => {
    expect(regle(coque, '.coque')).toMatch(/position:\s*fixed/)
    expect(regle(coque, '.coque')).toMatch(/(^|[\s;])bottom:\s*0;/)
    expect(regle(coque, '.contenu')).toMatch(/overflow-y:\s*auto/)
    expect(regle(coque, '.contenu')).toMatch(/overflow-x:\s*hidden/)
  })

  it('le rebond reste dans la zone : ni la zone ni le document ne le passent à la page', () => {
    expect(regle(coque, '.contenu')).toMatch(/overscroll-behavior:\s*contain/)
    expect(regle(theme, 'html,\nbody')).toMatch(/overscroll-behavior:\s*none/)
  })

  it('le corps ne dépasse pas l’écran du téléphone (100vh compte sous la barre d’adresse)', () => {
    expect(sansCommentaires(theme)).toMatch(/\nbody \{[^}]*min-height:\s*100dvh/)
  })

  it('installée, la page atteint l’écran entier (iOS 26 raccourcit la fenêtre sous la barre d’état translucide)', () => {
    const css = sansCommentaires(theme)
    const bloc = css.match(
      /@media \(display-mode:\s*standalone\)\s*\{\s*([^{}]*)\{\s*min-height:\s*100lvh;\s*\}\s*\}/,
    )
    expect(bloc).not.toBeNull()
    const selecteurs = (bloc?.[1] ?? '').split(',').map((selecteur) => selecteur.trim())
    expect(selecteurs).toEqual(expect.arrayContaining(['html', 'body']))
    const corps = css.search(/\nbody \{[^}]*min-height:\s*100dvh/)
    expect(css.indexOf('@media (display-mode: standalone)')).toBeGreaterThan(corps)
  })

  it('le texte garde sa taille quand le téléphone tourne (partout, pas seulement installée)', () => {
    const horsInstallee = sansCommentaires(theme).replace(/@media \(display-mode:\s*standalone\)\s*\{[^{}]*\{[^{}]*\}\s*\}/, '')
    const html = horsInstallee.match(/\nhtml \{([^}]*)\}/)?.[1] ?? ''
    expect(html).toMatch(/(^|[\s;])-webkit-text-size-adjust:\s*100%;/)
    expect(html).toMatch(/(^|[\s;])text-size-adjust:\s*100%;/)
  })
})

describe('les grilles', () => {
  // `1fr` vaut `minmax(auto, 1fr)` : le minimum est le contenu, un titre long ou une image gonfle la
  // piste et la page défile de côté. `minmax(0, 1fr)` la borne.
  it.each(['--grille-sorties-colonnes', '--grille-bande-colonnes', '--grille-planche-colonnes', '--grille-mur-colonnes', '--grille-guichet-colonnes'])(
    '%s borne ses pistes à zéro',
    (jeton) => {
      const valeur = regle(theme, ':root').match(new RegExp(`${jeton}:\\s*([^;]+);`))?.[1]
      expect(valeur).toMatch(/^repeat\(\d+, minmax\(0, 1fr\)\)/)
    },
  )

  it('aucune feuille n’écrit de piste `1fr` nue', () => {
    const fautes = HORS_VOYAGE.flatMap(([chemin, css]) =>
      declarations(css)
        .filter(({ prop, valeur }) => /^grid-template-(columns|rows)$/.test(prop) && /(^|[\s,(])1fr\b/.test(valeur.replace(/minmax\(0, 1fr\)/g, '')))
        .map(({ valeur }) => `${chemin} : ${valeur}`),
    )
    expect(fautes).toEqual([])
  })

  /** Chaque grille de l'app et la classe de ses éléments, qui doivent pouvoir rétrécir sous leur contenu. */
  const ELEMENTS_DE_GRILLE = [
    ['/src/pages/AuCine.module.css', auCine, '.tuile'],
    ['/src/pages/Suivis.module.css', suivis, '.mur > *'],
    ['/src/pages/Recherche.module.css', recherche, '.affiches > li'],
    ['/src/suivis/PlancheCycle.module.css', planche, '.case'],
    ['/src/accueil/Pellicule.module.css', pellicule, '.planche .vignette'],
  ] as const

  it('chaque feuille qui pose une grille d’affiches a son élément dans la table', () => {
    const grilles = HORS_VOYAGE.filter(([, css]) => /var\(--grille-[a-z-]+-colonnes\)/.test(sansCommentaires(css))).map(([chemin]) => chemin)
    expect(grilles.sort()).toEqual(ELEMENTS_DE_GRILLE.map(([chemin]) => chemin).sort())
  })

  it.each(ELEMENTS_DE_GRILLE)('l’élément de grille de %s peut rétrécir sous son contenu', (_chemin, css, selecteur) => {
    expect(regle(css, selecteur)).toMatch(/min-width:\s*0/)
  })
})

describe('l’affiche', () => {
  it('le cadre tient son ratio, image ou non', () => {
    expect(regle(affiche, '.cadre')).toMatch(/aspect-ratio:\s*var\(--ratio-affiche\)/)
    expect(regle(affiche, '.cadre')).toMatch(/overflow:\s*hidden/)
    // Le repère de l'image posée en absolu : sans lui, elle prendrait la taille du premier ancêtre positionné.
    expect(regle(affiche, '.cadre')).toMatch(/(^|[\s;])position:\s*relative/)
  })

  it('l’image remplit le cadre sans le dimensionner', () => {
    const image = regle(affiche, '.image')
    expect(image).toMatch(/position:\s*absolute/)
    expect(image).toMatch(/object-fit:\s*cover/)
  })
})

describe('les affichettes des Suivis', () => {
  const BLOC_JOUR = regle(theme, ':root')
  const BLOCS_SOMBRES = [regle(theme, ":root:not([data-theme='clair'])"), regle(theme, ":root[data-theme='sombre']")]
  const valeurDe = (bloc: string, jeton: string) => bloc.match(new RegExp(`${jeton}:\\s*([^;]+);`))?.[1]?.trim()
  /** Ce qui change du jour à la nuit : la lampe qui éclaire le papier, et le fond des intercalaires en retrait. */
  const DE_NUIT = ['--affichette-lampe', '--intercalaire-fond']
  /** Le papier, l'encre et le cliché sont ceux du bâtiment, jour et nuit. */
  const IMMUABLES = ['--ticket-papier', '--papier-encre', '--papier-clair', '--cliche-fond', '--cliche-voile', '--punaise-fond', '--intercalaire-papier']
  const DES_SUIVIS = Object.entries(MODULES).filter(([chemin]) => /\/(suivis\/(Affichette|Papier|PlancheCycle|RangeeEnsuite|Intercalaires|Archives|RechercheSuivi)|pages\/Suivis)\.module\.css$/.test(chemin))

  it('trouve les feuilles qu’il garde', () => {
    expect(DES_SUIVIS).toHaveLength(8)
  })

  it.each(DE_NUIT)('%s est posé le jour et dans les deux blocs sombres, de la même valeur la nuit', (jeton) => {
    expect(sansCommentaires(theme).match(new RegExp(`${jeton}:`, 'g'))).toHaveLength(3)
    const [suivantLeTelephone, force] = BLOCS_SOMBRES.map((bloc) => valeurDe(bloc, jeton))
    expect(suivantLeTelephone).toBeDefined()
    expect(suivantLeTelephone).not.toBe(valeurDe(BLOC_JOUR, jeton))
    expect(force).toBe(suivantLeTelephone)
  })

  it('la lampe est éteinte le jour', () => {
    expect(valeurDe(BLOC_JOUR, '--affichette-lampe')).toBe('none')
  })

  it.each(IMMUABLES)('%s est le même de jour et de nuit', (jeton) => {
    expect(valeurDe(BLOC_JOUR, jeton)).toBeDefined()
    for (const bloc of BLOCS_SOMBRES) expect(valeurDe(bloc, jeton)).toBeUndefined()
  })

  it('le papier des affichettes est celui des billets, sous la lampe, avec leur ombre du jour et de la nuit', () => {
    expect(regle(papier, '.papier')).toMatch(/background:\s*var\(--affichette-lampe\),\s*var\(--ticket-papier\)/)
    expect(regle(papier, '.papier')).toMatch(/filter:\s*var\(--ticket-ombre\)/)
  })

  it('le trou poinçonné a la couleur des perforations des pellicules, lisible sur le papier de jour comme de nuit', () => {
    const trou = regle(affichette, ".trou[data-etat='vu']")
    expect(trou).toMatch(/background:\s*var\(--pellicule-trou\)/)
    expect(trou).not.toMatch(/--barre-onglets-fond/)
  })

  it('un intercalaire ne passe jamais sur deux lignes et prend la largeur de son libellé', () => {
    const intercalaire = regle(intercalaires, '.intercalaire')
    expect(intercalaire).toMatch(/white-space:\s*nowrap/)
    expect(intercalaire).toMatch(/(^|[\s;])flex:\s*1 1 auto/)
    expect(intercalaire).toMatch(/padding:[^;]*var\(--intercalaire-marge\)/)
  })

  it('la vignette est une part du cliché, pas une largeur fixe', () => {
    expect(valeurDe(BLOC_JOUR, '--vignette-largeur')).toMatch(/^\d+%$/)
    expect(regle(affichette, '.vignette')).toMatch(/width:\s*var\(--vignette-largeur\)/)
  })

  it('la coche du crayon a son halo de la couleur du papier', () => {
    expect(regle(planche, '.coche')).toMatch(/filter:\s*var\(--coche-halo\)/)
    expect(valeurDe(BLOC_JOUR, '--coche-halo')).toMatch(/^drop-shadow\(/)
  })

  it('rien n’y bouge : ni transition ni animation', () => {
    for (const [, css] of DES_SUIVIS) expect(sansCommentaires(css)).not.toMatch(/\b(transition|animation|@keyframes)\b/)
  })
})

describe('le billet du critique', () => {
  const BLOC_JOUR = regle(theme, ':root')
  const BLOCS_SOMBRES = [regle(theme, ":root:not([data-theme='clair'])"), regle(theme, ":root[data-theme='sombre']")]
  const valeurDe = (bloc: string, jeton: string) => bloc.match(new RegExp(`${jeton}:\\s*([^;]+);`))?.[1]?.trim()

  // Sur iPhone, un `input type="date"` garde sa largeur propre et déborde de l'écran : ces quatre lignes
  // de la feuille sont ce qui l'en empêche, et rien d'autre dans un test de rendu ne les verrait.
  describe('le champ de date', () => {
    const date = regle(formulaire, '.date')

    it('perd son apparence native et son plancher de largeur', () => {
      expect(date).toMatch(/(^|[\s;])appearance:\s*none/)
      expect(date).toMatch(/-webkit-appearance:\s*none/)
      expect(date).toMatch(/(^|[\s;])min-width:\s*0/)
      expect(date).toMatch(/(^|[\s;])max-width:\s*100%/)
    })

    it('prend toute la largeur du billet, jamais plus', () => {
      expect(date).toMatch(/(^|[\s;])width:\s*100%/)
    })

    it('aligne à gauche le texte que WebKit centre', () => {
      expect(date).toMatch(/text-align:\s*left/)
      expect(regle(formulaire, '.date::-webkit-date-and-time-value')).toMatch(/text-align:\s*left/)
    })

    it('reste clair, de jour comme de nuit : il est posé sur du papier', () => {
      expect(date).toMatch(/color-scheme:\s*light/)
    })
  })

  it('le billet est découpé aux quatre coins dans le papier des billets, sous la bande rouge', () => {
    const corps = regle(formulaire, '.corps')
    expect(corps).toMatch(/background:\s*var\(--ticket-papier\)/)
    expect(corps).toMatch(/(^|[\s;])mask:\s*var\(--billet-onglet-masque\)/)
    expect(corps).toMatch(/box-shadow:\s*inset 0 var\(--billet-onglet-bande-hauteur\) 0 var\(--ticket-bande-vive\)/)
  })

  it('le bouton suit le doigt au bas de la page, au-dessus du papier', () => {
    const actions = regle(formulaire, '.actions')
    expect(actions).toMatch(/position:\s*sticky/)
    expect(actions).toMatch(/(^|[\s;])bottom:\s*0/)
    expect(actions).toMatch(/z-index:\s*var\(--z-complet\)/)
  })

  it('la remarque grandit avec son texte : pas de barre de défilement ni de poignée', () => {
    const remarque = regle(formulaire, '.remarque')
    expect(remarque).toMatch(/overflow:\s*hidden/)
    expect(remarque).toMatch(/resize:\s*none/)
  })

  it('les dix trous rétrécissent sous la largeur d’une cible tactile, et laissent le défilement vertical au navigateur', () => {
    expect(regle(rangeeDeNote, '.trou')).toMatch(/min-width:\s*0/)
    expect(regle(rangeeDeNote, '.rangee')).toMatch(/touch-action:\s*pan-y/)
  })

  it('le papier du carnet, les lignes et l\'encre du tampon sont les mêmes de jour et de nuit', () => {
    for (const jeton of ['--carnet-papier', '--carnet-ligne', '--tampon-encre', '--tampon-fond']) {
      expect(valeurDe(BLOC_JOUR, jeton)).toBeDefined()
      for (const bloc of BLOCS_SOMBRES) expect(valeurDe(bloc, jeton)).toBeUndefined()
    }
  })

  it('rien n\'y bouge : ni transition ni animation', () => {
    for (const css of [formulaire, rangeeDeNote, tampons]) expect(sansCommentaires(css)).not.toMatch(/\b(transition|animation|@keyframes)\b/)
  })
})
