import { describe, expect, it } from 'vitest'
import { contexteFactice, type Appel } from '../../test/contexteFactice'
import { mondeAVenir } from '../../mondes/avenir'
import { creerRegistre } from '../../mondes'
import type { CadreDeBande, EtatDeBande, LectureDeBande, Monde } from '../../mondes/types'
import type { CaseCarte, EtatCarte } from '../moteur'
import { placerCarte } from '../placement'
import { construireRoute } from '../route'
import { dessinerCase } from './cases'
import { bandesDuSol, dessinerSol } from './sol'
import { dessinerRoulotte } from './roulotte'
import { Particules } from './particules'
import { dessinerEnsemble } from './ensemble'
import { Effets } from './effets'
import { ambianceDeLHeure } from '../heure'
import { genreDeBande, geoEnsemble } from '../ensemble'
import { rgba } from '../outils'

/**
 * Un monde dont la rampe et la palette marquent tout ce qui les traverse : un hexadécimal qui
 * sort brut du dessin commun a contourné la rampe (le sépia des années 1890, décision du
 * propriétaire du 29 septembre 2026). Les ombres noires de la maquette restent en `rgba(0,0,0,…)`,
 * que le sépia ne change pas.
 */
function mondeMarque(): Monde {
  const base = mondeAVenir(1890)
  return {
    ...base,
    couleur: (hex, a = 1) => `rampe(${hex},${a})`,
    palette: {
      ...base.palette,
      route: { bord: 'palette:bord', fond: 'palette:fond', perforations: 'palette:perf', coeur: 'palette:coeur' },
      caseFaite: { dessus: ['palette:d0', 'palette:d1'], flanc: ['palette:f0', 'palette:f1'], plaque: 'palette:plaque' },
      caseVerrou: { dessus: ['palette:v0', 'palette:v1'] },
      colonne: { fonce: 'palette:fonce', clair: 'palette:clair', penche: 0.12 },
    },
  }
}

/** Les couleurs réellement posées : le remplissage d'un `fill…`, le trait d'un `stroke…`, les arrêts de leurs dégradés. */
function couleursPosees(appels: readonly Appel[]): string[] {
  const lire = (s: unknown): string[] =>
    typeof s === 'string' ? [s] : s && typeof s === 'object' && 'arrets' in s ? (s as { arrets: Array<[number, string]> }).arrets.map(([, c]) => c) : []
  return appels.flatMap((a) => (a.nom.startsWith('fill') ? lire(a.fillStyle) : a.nom.startsWith('stroke') ? lire(a.strokeStyle) : []))
}
const brutes = (couleurs: readonly string[]) => couleurs.filter((c) => /#[0-9a-f]{3,8}/i.test(c) && !c.startsWith('rampe('))

const uneCase = (etat: CaseCarte['etat'], attente = false): CaseCarte => ({
  annee: 1896,
  etat,
  attente,
  profondeur: 6,
  jauge: etat === 'encours' ? { vus: 2, total: 5 } : null,
  affiches: [],
})

describe('le dessin commun', () => {
  // Mutation : une médaille, la bobine d'une année passée, une affiche vierge ou le « +N » de la
  // colonne dans leurs hexadécimaux bruts — l'or d'une médaille éclaterait dans le sépia.
  it('passe toute couleur d’une case par la rampe ou la palette de son monde', () => {
    const monde = mondeMarque()
    const etats: CaseCarte[] = (['verrou', 'encours', 'passee', 'palme', 'lion', 'ours'] as const).map((e) => uneCase(e))
    for (const c of [...etats, uneCase('passee', true)]) {
      const { ctx, appels } = contexteFactice()
      dessinerCase(ctx, 100, 200, c, monde, 0, true, () => null)
      expect(couleursPosees(appels).length, c.etat).toBeGreaterThan(5)
      expect(brutes(couleursPosees(appels)), `${c.etat}${c.attente ? ' en attente' : ''}`).toEqual([])
    }
  })

  // Une année en cours que le Voyage suivi n'a pas encore ouverte (la lectrice) n'a pas la couche corail
  // (`moteur.test.ts`) : sa case pose elle-même son millésime, terne comme une année fermée. Celle du
  // compte IA le laisse à la couche corail. Mutation : la plaque tue pour toute année en cours.
  it('écrit le millésime terne d’une année en cours en attente, et lui seul', () => {
    const monde = mondeMarque()
    const plaque = (attente: boolean) => {
      const { ctx, appels } = contexteFactice()
      dessinerCase(ctx, 100, 200, uneCase('encours', attente), monde, 0, true, () => null)
      const i = appels.findIndex((a) => a.nom === 'fillText' && a.args[0] === '1896')
      return i < 0 ? null : appels.slice(0, i).filter((a) => a.nom === 'fill').pop()!.fillStyle
    }
    expect(plaque(true)).toBe('rampe(#150F09,0.72)')
    expect(plaque(false)).toBeNull()
  })

  // Le millésime d'une année faite s'écrivait de la couleur même de sa plaque (encre et fond tous deux
  // `#F2E8D5` en 1890) : une pastille vide sous chaque case, depuis le premier dessin (b1834c8). La maquette
  // (`ecrans-1890.html`, `carte-v2.html` : `plaque`) pose la couleur du monde en fond et `#151009` en
  // encre. Les mondes du registre, pas un monde marqué : c'est leur palette qui doit se lire.
  // Mutation : l'encre de nouveau `p.caseFaite.plaque` ; ou le fond pris pour l'encre.
  it('écrit le millésime de toute case sur sa plaque d’une encre qui s’en détache', () => {
    const composantes = (s: unknown): number[] => {
      const t = String(s)
      if (t.startsWith('#')) return [1, 3, 5].map((k) => parseInt(t.slice(k, k + 2), 16))
      return t.replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).map(Number)
    }
    const luminance = (s: unknown) => {
      const [r, g, b] = composantes(s).map((v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    const contraste = (a: unknown, b: unknown) => {
      const [h, l] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (h! + 0.05) / (l! + 0.05)
    }
    const mondes = creerRegistre()
    const cases: CaseCarte[] = [...(['verrou', 'passee', 'palme', 'lion', 'ours'] as const).map((e) => uneCase(e)), uneCase('passee', true), uneCase('encours', true)]
    for (const decennie of [1890, 1900]) {
      for (const c of cases) {
        const { ctx, appels } = contexteFactice()
        dessinerCase(ctx, 100, 200, c, mondes(decennie), 0, true, () => null)
        const i = appels.findIndex((a) => a.nom === 'fillText' && a.args[0] === '1896')
        const quoi = `${decennie}, ${c.etat}${c.attente ? ' en attente' : ''}`
        expect(i, quoi).toBeGreaterThan(-1)
        const fond = appels.slice(0, i).filter((a) => a.nom === 'fill').pop()!.fillStyle
        // 3 : le seuil d'un grand texte (WCAG) ; la plaque terne d'une année fermée le passe déjà.
        expect(contraste(appels[i]!.fillStyle, fond), quoi).toBeGreaterThanOrEqual(3)
      }
    }
  })

  // Mutation : les photogrammes allumés du sol en `rgba(255,222,160,…)` écrit à la main.
  it('passe les photogrammes allumés du sol par la rampe du monde de leur année', () => {
    const monde = mondeMarque()
    const annees = Array.from({ length: 5 }, (_, i) => 1895 + i)
    const plan = placerCarte(annees, (_, a) => monde.trace(a))
    const route = construireRoute(plan.points, 1)
    const etat: EtatCarte = {
      cases: annees.map((annee) => ({ annee, etat: annee < 1898 ? 'lion' : 'encours', attente: false, profondeur: 30, jauge: null, affiches: [] })),
      anneeAvatar: 1898,
      tampons: [],
      tickets: [],
      roulotte: null,
    }
    const { ctx, appels } = contexteFactice()
    dessinerSol(ctx, {} as Path2D, route, plan, etat, () => monde)
    const photogrammes = appels.filter((a) => a.nom === 'fillRect')
    expect(photogrammes.length).toBeGreaterThan(10)
    expect(brutes(couleursPosees(appels))).toEqual([])
    expect(photogrammes.every((a) => String(a.fillStyle).startsWith('rampe(#FF'))).toBe(true)
  })

  // Plan 3a. Mutations : une section ordinaire prise pour collante, ou l'inverse (la bande d'après
  // une section collante oubliée : le sol ne reprendrait pas) ; des bandes rendues sans section
  // collante (le sol de 1890 serait coupé pour rien, et sa référence tomberait).
  it('ne coupe le sol que dans les sections collantes, et pas du tout sans elles', () => {
    const scene: Monde['scene'] = { ecranDeLaCase: () => null, dessinerSuivi: () => undefined, dessinerBande: () => () => null, entree: [], arrets: [], ralentis: [] }
    const annees = Array.from({ length: 1939 - 1895 + 1 }, (_, i) => 1895 + i)
    const plan = placerCarte(annees, (d, a) => mondeAVenir(d).trace(a))
    const mondeDe = (collantes: readonly number[]) => (d: number): Monde => ({ ...mondeAVenir(d), scene: collantes.includes(d) ? scene : null })
    expect(bandesDuSol(plan.sections, mondeDe([]))).toBeNull()
    for (const collantes of [[1900], [1890], [1930], [1900, 1910], [1900, 1920]]) {
      const bandes = bandesDuSol(plan.sections, mondeDe(collantes))!
      const dessine = (y: number) => bandes.some((b) => y >= b.y0 && y < b.y1)
      // Au-dessus de la carte et sous elle, le sol n'est jamais coupé.
      expect(dessine(-1)).toBe(true)
      expect(dessine(plan.hauteur)).toBe(true)
      for (const s of plan.sections) {
        const attendu = !collantes.includes(s.decennie)
        for (const y of [s.y0, s.y0 + s.hauteur / 2, s.y0 + s.hauteur - 1]) expect(dessine(y), `${collantes.join()} : ${s.decennie} à ${y}`).toBe(attendu)
      }
    }
  })

  // Plan 3a : la bande d'un monde à `scene` est la sienne. Mutations : la garde retirée (le fond
  // et les marquises communes dessinés sous ou sur la bande du monde) ; le cadre décalé ou sans
  // l'ouverture ; l'état d'une année ou son attente oubliés ; la lecture du monde non rendue ; le
  // `save`/`restore` retiré (ce que le monde laisse sur le contexte déteint sur la bande d'après).
  it('laisse un monde à scène dessiner sa bande : ni fond ni marquise communs, son cadre, l’état de ses années, et sa lecture rendue', () => {
    const recus: Array<{ cadre: CadreDeBande; etat: EtatDeBande }> = []
    const lire: LectureDeBande = () => 1903
    const image: CadreDeBande['image'] = () => null
    const mondeDe = (d: number): Monde => {
      const base = mondeAVenir(d)
      // Un fond par décennie : la bande commune de chacune se reconnaît à sa couleur.
      const palette = { ...base.palette, fond: [d % 100, 2, 3] as [number, number, number] }
      if (d !== 1900) return { ...base, aVenir: d > 1900, palette }
      return {
        ...base,
        aVenir: false,
        palette,
        scene: {
          ecranDeLaCase: () => null,
          dessinerSuivi: () => undefined,
          dessinerBande: (g, cadre, etat) => {
            recus.push({ cadre, etat })
            g.globalAlpha = 0.1
            g.fillText('la bande du monde', cadre.x, cadre.y)
            return lire
          },
          entree: [],
          arrets: [],
          ralentis: [],
        },
      }
    }
    const annees = Array.from({ length: 1919 - 1895 + 1 }, (_, i) => 1895 + i)
    const plan = placerCarte(annees, (d, a) => mondeDe(d).trace(a))
    // 1901 manque à la carte relue : le monde la reçoit fermée. 1900 est en attente du Voyage suivi.
    const etat: EtatCarte = {
      cases: annees.filter((a) => a !== 1901).map((annee) => ({ annee, etat: annee < 1900 ? 'lion' : annee === 1900 ? 'encours' : 'verrou', attente: annee === 1900, profondeur: 0, jauge: null, affiches: [] })),
      anneeAvatar: 1900,
      tampons: [],
      tickets: [],
      roulotte: null,
    }
    const geo = geoEnsemble(plan.sections.map((s, i) => ({ y0: s.y0, hauteur: s.hauteur, detaillee: genreDeBande(mondeDe(s.decennie), i === 1) === 'detaillee' })), 700, 132, 64)
    const { ctx, appels } = contexteFactice()
    const lues = dessinerEnsemble(ctx, 390, 700, 0.5, geo, plan, etat, mondeDe, image)
    const bande = geo.bandes[1]!
    expect(recus).toEqual([
      {
        cadre: { x: 10, y: bande.y0, w: 370, h: bande.y1 - bande.y0, e: 0.5, image },
        etat: {
          anneeAvatar: 1900,
          annees: [1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909].map((annee) => ({ annee, etat: annee === 1900 ? 'encours' : 'verrou', attente: annee === 1900 })),
        },
      },
    ])
    expect(lues).toEqual([{ section: 1, lire }])
    expect(lues[0]!.lire).toBe(lire)
    const ecrits = appels.filter((a) => a.nom === 'fillText').map((a) => a.args[0])
    expect(ecrits).toEqual(expect.arrayContaining(['1895', '1899', 'la bande du monde', '1910 – 1919']))
    for (const texte of ['1900', '1901', '1909', '1900 – 1909']) expect(ecrits).not.toContain(texte)
    const fonds = (d: number) => appels.filter((a) => a.nom === 'fill' && a.fillStyle === rgba(mondeDe(d).palette.fond))
    expect(fonds(1890).length).toBe(1)
    expect(fonds(1900)).toEqual([])
    // La bande d'après garde l'opacité de la vue d'ensemble, pas celle que le monde a laissée.
    expect(fonds(1910).map((a) => a.alpha)).toEqual([0.5])
  })

  // Mutation : `tourne = roule` — la roue et les chevaux suivraient `t` quand le visiteur demande
  // moins d'animations, si l'appelant les disait en route (le moteur ne le fait pas aujourd'hui).
  it('ne fait dépendre la roulotte de rien quand `vivant` est faux, même en route', () => {
    const dessin = (t: number) => {
      const { ctx, appels } = contexteFactice()
      dessinerRoulotte(ctx, 100, 200, 1, true, t, false, 0.42, 'theo', (h, a = 1) => `${h}/${a}`, 0.5, null)
      return JSON.stringify(appels)
    }
    expect(dessin(3.3)).toBe(dessin(0))
  })

  // Mutation : l'image de la planche tirée de `t` sans regarder `vivant`, ou `n` lu d'autre chose
  // que le rapport de la largeur à la hauteur.
  it('lit la planche de la roulotte à seize images par seconde, et son image 0 quand `vivant` est faux', () => {
    const planche = { width: 400, height: 100 } as unknown as CanvasImageSource
    const source = (t: number, vivant: boolean) => {
      const { ctx, appels } = contexteFactice()
      dessinerRoulotte(ctx, 100, 200, 1, false, t, vivant, 0.42, 'theo', (h) => h, 0, planche)
      return appels.find((a) => a.nom === 'drawImage')!.args.slice(1, 5)
    }
    expect(source(0.2, true)).toEqual([300, 0, 100, 100])
    expect(source(0.3, true)).toEqual([0, 0, 100, 100])
    expect(source(0.2, false)).toEqual([0, 0, 100, 100])
  })

  // Mutation : la borne retirée ou changée dans `etincelles`, `confettis` ou `fumee` (la maquette
  // ne bornait pas la fumée).
  it('ne garde jamais plus de deux cent quarante particules, de quelque sorte qu’elles soient', () => {
    const lancers: Array<(p: Particules) => void> = [
      (p) => p.etincelles(0, 0, 500, '#abcdef'),
      (p) => {
        for (let i = 0; i < 20; i++) p.confettis(0, 0, ['#abcdef', '#fedcba'])
      },
      (p) => p.fumee(0, 0, 500, 4),
    ]
    for (const lancer of lancers) {
      const p = new Particules()
      lancer(p)
      lancer(p)
      const { ctx, appels } = contexteFactice()
      p.dessiner(ctx, false)
      expect(appels.filter((a) => a.nom === 'fill' || a.nom === 'fillRect').length).toBe(240)
    }
  })
})

describe('le voile de nuit des effets', () => {
  const FEU = { x: 100, y: 100, r: 40, c: 'or', w: 1 }
  /** Les aplats de plein écran que `nuit` pose, et le nombre de halos, pour une part de voile à une heure. */
  const nuit = (heure: number, voile: number) => {
    const { ctx, appels } = contexteFactice()
    const effets = new Effets((w, h) => ({ width: w, height: h, getContext: () => null }))
    effets.nuit(ctx, [FEU], ambianceDeLHeure(heure), voile)
    const pleins = appels.filter((a) => a.nom === 'fillRect' && a.args.join() === '0,0,390,700').map((a) => String(a.fillStyle))
    return { pleins, halos: appels.filter((a) => a.nom === 'fillRect' && a.args.join() !== '0,0,390,700').length }
  }

  // Mutations : `voile` ignoré (le bleu posé quoi que dise le moteur) ; les halos ou le voile du
  // jour coupés avec lui (le moteur ne retire que le voile de nuit).
  it('pose le bleu de la nuit à la part demandée, et rien à zéro ; les halos et le voile du jour n’en dépendent pas', () => {
    expect(nuit(23, 1)).toEqual({ pleins: ['rgba(4,5,14,0.46)'], halos: 1 })
    expect(nuit(23, 0.5)).toEqual({ pleins: ['rgba(4,5,14,0.23)'], halos: 1 })
    expect(nuit(23, 0)).toEqual({ pleins: [], halos: 1 })
    expect(nuit(12, 0)).toEqual(nuit(12, 1))
    expect(nuit(12, 0).pleins).toHaveLength(1)
  })
})
