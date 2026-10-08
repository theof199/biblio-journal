import { describe, expect, it } from 'vitest'
import { creerRegistre } from '../mondes'
import { JETONS_DE_PAGE } from '../mondes/types'

/** Toutes les feuilles de l'app : le filtre en tire celles que ce fichier garde. */
const TOUTES = import.meta.glob<string>('/src/**/*.css', { query: '?raw', import: 'default', eager: true })

/**
 * Les feuilles des pages du Voyage : sous `src/voyage/`, nommées `Voyage*.module.css` sous
 * `src/pages/`, et **toute** feuille d'un monde (`src/mondes/`, module ou non) : un gabarit de monde
 * (`Monde.pages.gabarits`) apporte sa feuille, qui ne doit pas échapper aux jetons.
 */
const estGardee = (chemin: string) =>
  /^\/src\/voyage\/.+\.module\.css$/.test(chemin) || /^\/src\/pages\/Voyage[^/]*\.module\.css$/.test(chemin) || /^\/src\/mondes\/.+\.css$/.test(chemin)
const FEUILLES: Record<string, string> = Object.fromEntries(Object.entries(TOUTES).filter(([chemin]) => estGardee(chemin)))

/** Les polices embarquées, telles que `ui/polices.ts` les importe. */
const POLICES = Object.values(import.meta.glob<string>('/src/ui/polices.ts', { query: '?raw', import: 'default', eager: true }))[0] ?? ''

/** Le thème de l'app, où vivent la zone sûre au-dessus de la barre et les étages. */
const THEME = Object.values(import.meta.glob<string>('/src/ui/theme.css', { query: '?raw', import: 'default', eager: true }))[0] ?? ''

const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const lues = (css: string) => [...sansCommentaires(css).matchAll(/var\(\s*(--[\w-]+)/g)].map(([, nom]) => nom!)

/**
 * Ce qu'une feuille du Voyage lit hors des jetons de son monde : le corail, commun à tous les mondes
 * et jamais teinté (`ui/voyage.css`), la zone sûre au-dessus de la barre d'onglets et les étages
 * (`ui/theme.css`). Jamais le reste de `voyage.css` : c'est la palette de la carte, pas celle du monde.
 * Et le tempo de ce qui suit le geste « vu », que la page pose elle-même depuis `voyage/tempo.ts`
 * (`STYLE_DU_TEMPO`) : ni couleur ni police, et défini hors de `theme.css`.
 */
const PERMISES = (nom: string) => nom === '--corail' || nom === '--tempo' || nom === '--coque-bas' || nom.startsWith('--z-')

/** Les mots du raccourci `font` qui ne nomment pas une famille : style, variante, graisse, chasse, taille. */
const MOTS_DU_RACCOURCI = new Set([
  'inherit', 'initial', 'unset', 'revert', 'normal', 'italic', 'oblique', 'small-caps', 'bold', 'bolder', 'lighter',
  'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed', 'semi-expanded', 'expanded', 'extra-expanded',
  'ultra-expanded', 'xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large', 'larger', 'smaller',
])

describe('l’habillage des pages du Voyage', () => {
  it('trouve les feuilles qu’il garde', () => {
    // Sans ce plancher, un glob qui ne trouverait plus rien rendrait les gardes suivantes muettes.
    // Chaque tâche qui ajoute une feuille l'ajoute ici.
    expect(Object.keys(FEUILLES)).toEqual(
      expect.arrayContaining([
        '/src/voyage/Toile.module.css',
        '/src/voyage/Feuille.module.css',
        '/src/voyage/Feuillet.module.css',
        '/src/pages/VoyageAnnee.module.css',
        '/src/voyage/annee/AnneeFermee.module.css',
        '/src/voyage/annee/Boniment.module.css',
        '/src/voyage/annee/Corde.module.css',
        '/src/voyage/annee/Embleme.module.css',
        '/src/voyage/annee/Fronton.module.css',
        '/src/voyage/annee/LigneDuBas.module.css',
        '/src/voyage/annee/Manivelle.module.css',
        '/src/voyage/annee/Programme.module.css',
        '/src/voyage/salles/Salle.module.css',
        '/src/voyage/salles/NouvelleSalle.module.css',
        '/src/voyage/parade/Parade.module.css',
        '/src/voyage/seance/Seance.module.css',
        '/src/pages/VoyageFilm.module.css',
        '/src/voyage/film/Guichet.module.css',
        '/src/voyage/film/Notice.module.css',
        '/src/voyage/film/Programme.module.css',
        '/src/pages/VoyageBillet.module.css',
        '/src/voyage/billet/Dateur.module.css',
        '/src/voyage/billet/Poincon.module.css',
        '/src/voyage/billet/Cartons.module.css',
        '/src/voyage/billet/Tampon.module.css',
        '/src/voyage/billet/Numeroteur.module.css',
        '/src/voyage/passeport/Tampon.module.css',
        '/src/pages/VoyageDecennie.module.css',
        '/src/voyage/decennie/Livret.module.css',
        '/src/voyage/decennie/Palissade.module.css',
        '/src/voyage/decennie/Registre.module.css',
        '/src/pages/VoyageBoite.module.css',
        '/src/voyage/boite/Casier.module.css',
        '/src/voyage/boite/Visionneuse.module.css',
        '/src/pages/VoyageRecherche.module.css',
        '/src/voyage/passeport/Anneau.module.css',
        '/src/pages/VoyageSacoche.module.css',
        '/src/voyage/sacoche/Sacoche.module.css',
        '/src/voyage/sacoche/Passeport.module.css',
        '/src/voyage/sacoche/Portefeuille.module.css',
        '/src/voyage/sacoche/Coulisses.module.css',
        '/src/voyage/celebrations/Celebrations.module.css',
        '/src/mondes/1900/pages/Tete.module.css',
        '/src/mondes/1900/pages/VoieFermee.module.css',
        '/src/mondes/1900/pages/Indicateur.module.css',
        '/src/mondes/1900/pages/Guide.module.css',
        '/src/mondes/1900/pages/Courroie.module.css',
        '/src/mondes/1900/pages/Rubrique.module.css',
        '/src/mondes/1900/pages/Voies.module.css',
        '/src/mondes/1900/pages/Classes.module.css',
        '/src/mondes/1900/pages/Soir.module.css',
        '/src/mondes/1900/pages/Action.module.css',
        '/src/mondes/1900/pages/Hale.module.css',
        '/src/mondes/1900/pages/Carton.module.css',
        '/src/mondes/1900/pages/Composteur.module.css',
        '/src/mondes/1900/pages/Casier.module.css',
        '/src/mondes/1900/pages/Ligne.module.css',
        '/src/mondes/1900/pages/Guichet.module.css',
        '/src/mondes/1900/pages/Sacoche.module.css',
        '/src/mondes/1900/pages/Malle.module.css',
        '/src/mondes/1900/pages/Consigne.module.css',
        '/src/mondes/1900/pages/Fetes.module.css',
        '/src/mondes/1900/pages/Controleur.module.css',
      ]),
    )
  })

  // Le jumeau du plancher, pour les mondes, dont aucune feuille n'existait quand la garde s'est
  // étendue (plan des pages 1900, brief 0) : le filtre se prouve sur des chemins écrits. Mutations :
  // la branche `mondes` retirée du filtre, ou réduite aux `.module.css` ; le glob ramené à
  // `/src/voyage/**` (il ne verrait plus un monde).
  it('garde toute feuille d’un monde, et rien hors du Voyage', () => {
    expect(Object.keys(TOUTES)).toEqual(expect.arrayContaining(['/src/ui/theme.css', '/src/pages/VoyageAnnee.module.css']))
    const gardees = ['/src/mondes/1900/pages/Gare.module.css', '/src/mondes/1910/pages/tete/plaque.css', '/src/voyage/annee/Corde.module.css', '/src/pages/VoyageAnnee.module.css']
    expect(gardees.filter((chemin) => !estGardee(chemin))).toEqual([])
    const libres = ['/src/ui/theme.css', '/src/ui/voyage.css', '/src/pages/Accueil.module.css', '/src/pages/voyage/Voyage.module.css', '/src/voyage/Toile.css']
    expect(libres.filter(estGardee)).toEqual([])
  })

  // Rien ne change à l'écran tant qu'un monde ne compose rien : 1890 et le monde « à venir » n'ont
  // aucun gabarit, leurs pages sont les composants par défaut. Mutation : un gabarit posé dans
  // `PAGES_1890` ou `PAGES_A_VENIR`.
  it.each([1890, 1950])('le monde de %i ne compose aucune section : ses pages sont les défauts', (decennie) => {
    expect(creerRegistre()(decennie).pages.gabarits).toEqual({})
  })

  // Le jumeau des jetons du monde : ce qu'une feuille lit de `ui/theme.css` (la zone sûre, les étages)
  // doit y être défini, sinon la valeur retombe en silence. Mutation : `var(--z-calqeu)` dans une feuille.
  it.each(Object.entries(FEUILLES))('%s ne lit de theme.css que ce qu’il définit', (_chemin, css) => {
    const definies = new Set([...sansCommentaires(THEME).matchAll(/(--[\w-]+)\s*:/g)].map(([, nom]) => nom!))
    expect(lues(css).filter((nom) => PERMISES(nom) && nom !== '--corail' && nom !== '--tempo' && !definies.has(nom))).toEqual([])
  })

  // Un calque laisse visibles le bandeau « Nouvelle version » et la barre d'onglets. Mutation :
  // `--z-calque: 30`, au-dessus d'eux.
  it('pose les calques sous le bandeau et la barre d’onglets', () => {
    const etage = (nom: string) => Number(new RegExp(`${nom}\\s*:\\s*(\\d+)`).exec(sansCommentaires(THEME))?.[1])
    expect(etage('--z-calque')).toBeGreaterThan(0)
    expect(etage('--z-calque')).toBeLessThan(etage('--z-bandeau'))
    expect(etage('--z-calque')).toBeLessThan(etage('--z-barre-onglets'))
  })

  // Le jumeau : l'étage ne vaut que si les calques le lisent, et s'arrêtent au-dessus de la barre.
  // Mutations : `z-index: 30` en dur, ou `bottom: 0`, sur le `.calque` de la feuille ou du feuillet
  // (le calque couvrirait la barre d'onglets, ou son bas passerait dessous).
  it.each(['/src/voyage/Feuille.module.css', '/src/voyage/Feuillet.module.css', '/src/voyage/boite/Visionneuse.module.css', '/src/voyage/celebrations/Celebrations.module.css'])('%s pose son calque à l’étage des calques, au-dessus de la barre', (chemin) => {
    const css = sansCommentaires(FEUILLES[chemin] ?? '')
    const debut = css.indexOf('.calque {')
    expect(debut).toBeGreaterThanOrEqual(0)
    const regle = css.slice(debut, css.indexOf('}', debut))
    expect(regle).toMatch(/position:\s*fixed/)
    expect(regle).toMatch(/z-index:\s*var\(--z-calque\)/)
    expect(regle).toMatch(/bottom:\s*var\(--coque-bas\)/)
  })

  // Mutation : retirer un jeton d'un monde (le monde « à venir » d'abord : on l'oublie).
  it.each([1890, 1900, 1950])('le monde de %i pose tous les jetons des pages, et rien d’autre', (decennie) => {
    const { jetons } = creerRegistre()(decennie).pages
    expect(Object.keys(jetons).sort()).toEqual([...JETONS_DE_PAGE].sort())
    expect(Object.values(jetons).every((v) => v.trim().length > 0)).toBe(true)
  })

  // Le jumeau des dates du monde 1890 (`monde1890.test.ts`) : les mots s'affichent tels quels.
  // Mutations : une apostrophe droite (`Boniment d'ouverture`), un mot vide.
  // Un mot nul n'est pas un mot vide : le monde dit par là qu'il n'a rien à écrire à cet endroit
  // (`decennie.toucher` du monde « à venir »), et la page ne l'affiche pas.
  it.each([1890, 1900])('le monde de %i donne des mots complets, en français typographique', (decennie) => {
    const textes = (valeur: unknown): string[] =>
      valeur === null ? [] : typeof valeur === 'string' ? [valeur] : Object.values(valeur as Record<string, unknown>).flatMap(textes)
    const mots = textes(creerRegistre()(decennie).pages.mots)
    expect(mots.length).toBeGreaterThan(20)
    for (const mot of mots) {
      expect(mot.trim()).not.toBe('')
      expect(mot).not.toContain("'")
    }
  })

  // Le jumeau des jetons posés : une police nommée par un monde doit être embarquée (`ui/polices.ts`,
  // décision D4), sinon elle retombe sans bruit sur la suivante de la liste, ou se cherche en ligne.
  // Seule la première de chaque liste est la police voulue ; les suivantes sont celles du système.
  // Mutations : retirer `@fontsource/im-fell-english-sc/latin-400.css` de `ui/polices.ts` ; nommer en
  // tête, sans guillemets, une police qu'aucun paquet ne livre (`IM Fell DW Pica SC, Georgia, serif`).
  it.each([1890, 1900])('le monde de %i n’annonce que des polices embarquées', (decennie) => {
    const embarquees = new Set([...POLICES.matchAll(/^import '@fontsource\/([\w-]+)\//gm)].map(([, paquet]) => paquet!))
    const voulues = JETONS_DE_PAGE.filter((j) => j.startsWith('--m-f-')).map((j) => creerRegistre()(decennie).pages.jetons[j])
    const manquantes = voulues
      .map((liste) => liste.split(',')[0]!.trim().replace(/^(['"])(.*)\1$/, '$2'))
      .filter((famille) => !/^(serif|sans-serif|system-ui|monospace|cursive|fantasy)$/i.test(famille))
      .filter((famille) => !embarquees.has(famille.toLowerCase().replace(/\s+/g, '-')))
    expect(embarquees.size).toBeGreaterThan(0)
    expect(manquantes).toEqual([])
  })

  // Mutation : une feuille qui lit `var(--papier)` (la palette de la carte) ou un jeton mal orthographié.
  it.each(Object.entries(FEUILLES))('%s ne lit que les jetons du monde', (_chemin, css) => {
    const jetons = new Set<string>(JETONS_DE_PAGE)
    expect(lues(css).filter((nom) => !jetons.has(nom) && !PERMISES(nom))).toEqual([])
  })

  // Mutation : une couleur de la maquette recopiée en dur (`#decaac`) dans une feuille.
  it.each(Object.entries(FEUILLES))('%s ne porte aucune couleur en dur', (_chemin, css) => {
    const nue = sansCommentaires(css).replace(/var\([^()]*\)/g, '')
    expect(nue.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|lab)\(|:\s*(white|black|red|blue|green|gr[ae]y)\b/gi) ?? []).toEqual([])
  })

  // Le jumeau des couleurs : les polices sont aussi des jetons du monde (`--m-f-*`). Mutations : une
  // police de la maquette recopiée en dur (`font-family: 'IM Fell English', Georgia, serif`), puis
  // dans le raccourci (`font: 14px Georgia, serif`), puis sans guillemets ni famille générique
  // (`font: italic 14px Georgia`) : les années 1900 la garderaient.
  it.each(Object.entries(FEUILLES))('%s ne porte aucune police en dur', (_chemin, css) => {
    const nue = sansCommentaires(css).replace(/var\([^()]*\)/g, '')
    const valeurs = (propriete: string) =>
      [...nue.matchAll(new RegExp(`(?:^|[;{\\s])${propriete}\\s*:\\s*([^;}]*)`, 'gi'))].map(([, v]) => v!.trim())
    const familles = valeurs('font-family').filter((v) => v !== '' && v !== 'inherit')
    // Dans le raccourci, ce qui n'est ni une taille (ou `calc(…)`) ni un mot de style, de graisse ou de
    // taille est une famille.
    const raccourcis = valeurs('font').filter((v) =>
      v
        .replace(/[\w-]+\([^()]*\)/g, '')
        .split(/[\s/,]+/)
        .some((mot) => mot !== '' && !/^-?[\d.]+[a-z%]*$/i.test(mot) && !MOTS_DU_RACCOURCI.has(mot.toLowerCase())),
    )
    expect([...familles, ...raccourcis]).toEqual([])
  })
})
