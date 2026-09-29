import { describe, expect, it } from 'vitest'
import { contexteFactice } from '../../test/contexteFactice'
import { dessinerBandeau } from './bandeau'
import { dessinerScene } from './scene'
import { dessinerEstrade } from './estrade'
import { bonimenteur } from './moyen'
import { vuePage } from './vuePage'
import type { VueBandeau, VueEstrade, VueScene } from '../types'

const CASES = [1895, 1896, 1897, 1898, 1899].map((annee, i) => ({
  annee,
  etat: i < 2 ? ('lion' as const) : i === 2 ? ('encours' as const) : ('verrou' as const),
  profondeur: 3,
}))
const THEO = { pseudo: 'theo', annee: 1896 }

function bandeau(o: Partial<VueBandeau>) {
  const { ctx, appels } = contexteFactice()
  dessinerBandeau({ ctx, W: 390, H: 250, t: 0, vivant: false, nuit: 0, mode: 'encours', annee: 1897, recompense: null, cases: CASES, bouclee: false, roulotte: null, touche: -9, ...o })
  return appels
}
const textes = (appels: ReturnType<typeof bandeau>) => appels.filter((a) => a.nom === 'fillText').map((a) => a.args[0])
const trace = (appels: ReturnType<typeof bandeau>) => JSON.stringify(appels.map((a) => [a.nom, a.args, a.fillStyle, a.alpha]))
/** Les lueurs des lampions de r = 2 (la baraque, le manège) : un cercle de 2 × 2,8 en composition `lighter`. */
const lueursDeLampions = (appels: ReturnType<typeof bandeau>) =>
  appels.filter((a) => a.nom === 'arc' && a.composite === 'lighter' && Math.abs((a.args[2] as number) - 5.6) < 1e-9).length
const lueurs = (appels: ReturnType<typeof bandeau>) => appels.filter((a) => a.nom === 'arc' && a.composite === 'lighter').length
/** Le filet d'une médaille (`medaille`, `carte/dessin/cases.ts`), tracé en son repère ; le soleil a le même rayon, ailleurs. */
const medailles = (appels: ReturnType<typeof bandeau>) => appels.filter((a) => a.nom === 'arc' && a.args.slice(0, 3).join() === '0,0,10.8').length

describe('le bandeau d’une année', () => {
  // Mutation : la roulotte qui traverse sur `(v.t / 22) % 1` sans regarder `vivant` ; ou l'angle du
  // manège sur un `t` qui ne vient pas de la vue.
  // Et, sur les jumeaux : les ampoules qui vacillent (fermée), le monteur et la barre (attente),
  // le feu d'artifice et la médaille (bouclée), chacun sans la garde `vivant`.
  it.each(['encours', 'bouclee', 'fermee', 'attente'] as const)('au calme, est la même image à deux instants (%s)', (mode) => {
    const o = { mode, roulotte: THEO, recompense: 'palme' as const, nuit: 1 }
    expect(trace(bandeau({ ...o, t: 3 }))).toBe(trace(bandeau({ ...o, t: 11 })))
  })

  it('la roulotte du Voyage suivi traverse une année en cours', () => {
    expect(textes(bandeau({ roulotte: THEO }))).toContain('THEO ET CIE')
  })

  // Mutation : un pseudo écrit en dur (« Théo »), ou l'année de la page à la place de celle du Voyage suivi.
  it('en attente, la roulotte du Voyage suivi arrive et dit où il en est', () => {
    expect(textes(bandeau({ mode: 'attente', annee: 1897, roulotte: THEO }))).toContain('theo, encore en 1896')
  })

  // Mutation : la plaque posée sans attendre que la roulotte soit arrivée (`u >= 1`).
  it('en attente, la plaque attend que la roulotte soit arrivée', () => {
    expect(textes(bandeau({ mode: 'attente', vivant: true, t: 3, roulotte: THEO }))).not.toContain('theo, encore en 1896')
    expect(textes(bandeau({ mode: 'attente', vivant: true, t: 8, roulotte: THEO }))).toContain('theo, encore en 1896')
  })

  // Mutation : la roulotte qui traverse aussi une année fermée.
  it('fermée, aucune roulotte ne traverse', () => {
    expect(textes(bandeau({ mode: 'fermee', roulotte: THEO }))).not.toContain('THEO ET CIE')
  })

  // Mutation : le voile du mode fermé retiré. Le ciel peint lui aussi un rectangle depuis (-8, -8) :
  // le voile est celui qui vient après la baraque.
  it('fermée, un voile couvre toute la baraque', () => {
    const couvreTout = (appels: ReturnType<typeof bandeau>) => {
      const baraque = appels.findIndex((a) => a.nom === 'fillText' && a.args[0] === 'CINÉMATOGRAPHE')
      return appels.some((a, i) => i > baraque && a.nom === 'fillRect' && a.args[0] === -8 && a.args[1] === -8 && a.args[2] === 406 && a.args[3] === 266)
    }
    expect(couvreTout(bandeau({ mode: 'fermee' }))).toBe(true)
    expect(couvreTout(bandeau({ mode: 'encours' }))).toBe(false)
  })

  // Mutations : les lampions de la baraque allumés quand elle est fermée (`opts.ferme ? 0 : …`) ;
  // `ferme` non passé en attente ; le manège allumé en mode fermé.
  it('fermée ou en attente, la baraque et le manège éteignent leurs lampions', () => {
    expect(lueursDeLampions(bandeau({ mode: 'encours', nuit: 1 }))).toBeGreaterThan(0)
    expect(lueursDeLampions(bandeau({ mode: 'fermee', nuit: 1 }))).toBe(0)
    // En attente, le manège reste allumé (la maquette ne l'éteint qu'en mode fermé) : les dix lampions de la baraque, eux, s'éteignent.
    expect(lueursDeLampions(bandeau({ mode: 'encours', nuit: 1 })) - lueursDeLampions(bandeau({ mode: 'attente', nuit: 1, roulotte: THEO }))).toBe(10)
  })

  // Mutation : les planches clouées sur l'écran retirées, ou posées sur toute baraque.
  it('fermée, des planches sont clouées sur l’écran', () => {
    const planches = (appels: ReturnType<typeof bandeau>) => appels.filter((a) => a.nom === 'fillRect' && a.args.join() === '-48,-5,96,10').length
    expect(planches(bandeau({ mode: 'fermee' }))).toBe(3)
    expect(planches(bandeau({ mode: 'encours' }))).toBe(0)
  })

  // Mutations : une palme par défaut quand l'année n'a pas de récompense ; la médaille hors d'une année bouclée.
  it('bouclée, porte sa médaille, et seulement si elle en a une', () => {
    expect(medailles(bandeau({ mode: 'bouclee', recompense: 'lion' }))).toBe(1)
    expect(medailles(bandeau({ mode: 'bouclee', recompense: null }))).toBe(0)
    expect(medailles(bandeau({ mode: 'encours', recompense: 'lion' }))).toBe(0)
  })

  // Mutation : le feu d'artifice retiré, ou tiré sur toute année.
  it('bouclée, tire un feu d’artifice', () => {
    expect(lueurs(bandeau({ mode: 'bouclee' }))).toBeGreaterThan(lueurs(bandeau({ mode: 'encours' })))
  })
})

describe('la vue d’une page', () => {
  const vue = (touche: number) => vuePage({ ctx: contexteFactice().ctx, W: 390, H: 250, t: 5, vivant: true, nuit: 0, touche, annee: 1897 })

  // Mutation : `age` qui répond toujours 99 : le toucher ne rouvrirait plus le rideau.
  it('date le toucher pour le rideau et le manège, et pour rien d’autre', () => {
    expect(vue(3).age('rideau')).toBe(2)
    expect(vue(3).age('carrousel')).toBe(2)
    expect(vue(3).age('chantier:1896:toit')).toBe(99)
    expect(vue(-9).age('rideau')).toBe(99)
  })
})

describe('le bonimenteur de la carte', () => {
  const bras = (t: number, repos?: number) => {
    const { ctx, appels } = contexteFactice()
    bonimenteur(ctx, vuePage({ ctx, W: 390, H: 250, t, vivant: true, nuit: 0, touche: -9, annee: 1897 }), 0, 0, 1.3, false, repos)
    return JSON.stringify(appels.map((a) => [a.nom, a.args]))
  }

  // Mutation : `repos = 0.5` par défaut : sur la carte, qui appelle sans lui, le bras ne se balancerait plus.
  it('balance son bras quand on ne lui donne pas de repos, et le pose sinon', () => {
    expect(bras(1)).not.toBe(bras(2))
    expect(bras(1, 0.5)).toBe(bras(2, 0.5))
  })
})

describe('la scène d’un film', () => {
  const scene = (o: Partial<VueScene>) => {
    const { ctx, appels } = contexteFactice()
    dessinerScene({ ctx, W: 390, H: 300, t: 0, vivant: false, image: null, touche: -9, ...o })
    return appels
  }
  const image = {} as CanvasImageSource
  const photo = { width: 1280, height: 720 } as unknown as CanvasImageSource
  const largeurProjetee = (appels: ReturnType<typeof scene>) => appels.find((a) => a.nom === 'drawImage')!.args[3] as number

  // Mutation : virer l'image en lisant ses pixels (`getImageData`) : la toile est teintée par l'image
  // TMDB, et la lecture lèverait une `SecurityError`.
  it('ne lit jamais un pixel de la toile', () => {
    const noms = scene({ image, vivant: true, t: 4 }).map((a) => a.nom)
    expect(noms).not.toContain('getImageData')
    expect(noms).not.toContain('toDataURL')
    expect(noms).not.toContain('toBlob')
  })

  // Mutations : l'image posée avant le `clip` de l'écran, ou après un `restore` qui le défait : elle
  // déborderait sur le velours.
  it('pose l’image dans l’écran, sous son clip', () => {
    const appels = scene({ image })
    const noms = appels.map((a) => a.nom)
    const clip = noms.indexOf('clip')
    const pose = noms.indexOf('drawImage')
    expect(clip).toBeGreaterThan(-1)
    expect(pose).toBeGreaterThan(clip)
    expect(noms.slice(clip, pose)).not.toContain('restore')
    expect(appels.slice(0, clip).filter((a) => a.nom === 'rect').pop()?.args).toEqual([74, 60, 242, 146])
  })

  // Mutation : la composition `color` retirée : l'image TMDB passerait en couleur dans un monde sépia.
  it('vire l’image au sépia par composition, puis revient à la normale', () => {
    const appels = scene({ image })
    const pose = appels.findIndex((a) => a.nom === 'drawImage')
    const apres = appels.slice(pose + 1)
    expect(apres.find((a) => a.nom === 'fillRect')?.composite).toBe('color')
    expect(apres.filter((a) => a.composite === 'color').every((a) => a.nom === 'fillRect')).toBe(true)
    expect(apres[apres.length - 1]!.composite).toBe('source-over')
  })

  // Mutations : l'image posée sans « cover » (« contain », ou étirée à l'écran) ; décentrée ; l'image qui ne s'approche pas.
  it('pose l’image en « cover », centrée, qui s’approche de la salle', () => {
    const debut = scene({ image: photo, vivant: true, t: 0.5 })
    // 1280 × 720 dans 242 × 146 : la hauteur commande, la largeur déborde.
    expect(largeurProjetee(debut)).toBeCloseTo((1280 * 146) / 720, 6)
    const arrivee = scene({ image: photo, vivant: true, t: 8 })
    expect(largeurProjetee(arrivee)).toBeGreaterThan(largeurProjetee(debut) * 1.2)
    // Le centre de l'image reste celui de l'écran (195, 133) : elle s'approche, elle ne glisse pas.
    for (const appels of [debut, arrivee]) {
      const [, x, y, w, h] = appels.find((a) => a.nom === 'drawImage')!.args as number[]
      expect(x! + w! / 2).toBeCloseTo(195, 6)
      expect(y! + h! / 2).toBeCloseTo(133, 6)
    }
  })

  // Mutation : le cycle qui ignore `touche` : toucher l'écran ne relancerait rien.
  it('relance la projection au toucher', () => {
    const touchee = largeurProjetee(scene({ image: photo, vivant: true, t: 16, touche: 16 }))
    expect(touchee).toBeCloseTo((1280 * 146) / 720, 6)
    expect(largeurProjetee(scene({ image: photo, vivant: true, t: 16 }))).toBeGreaterThan(touchee)
  })

  // Mutations : le cycle de la projection, la poussière du faisceau ou le public sans la garde `vivant`.
  it('au calme, est la même image à deux instants', () => {
    const image = (t: number) => JSON.stringify(scene({ image: photo, t }).map((a) => [a.nom, a.args, a.alpha, a.fillStyle]))
    expect(image(2)).toBe(image(9))
  })

  it('sans image, n’en dessine aucune', () => {
    expect(scene({}).map((a) => a.nom)).not.toContain('drawImage')
  })
})

describe('l’estrade du chroniqueur', () => {
  const estrade = (o: Partial<VueEstrade>) => {
    const { ctx, appels } = contexteFactice()
    dessinerEstrade({ ctx, W: 390, H: 190, t: 0, vivant: false, parle: 'non', ...o })
    return appels
  }
  const image = (appels: ReturnType<typeof estrade>) => JSON.stringify(appels.map((a) => [a.nom, a.args, a.alpha]))
  const ondes = (appels: ReturnType<typeof estrade>) => appels.filter((a) => a.nom === 'arc' && a.args[0] === 128 && a.args[1] === 84).length

  // Mutations : les ondes de voix sans la garde `vivant` ; le pied qui bat la mesure sans elle.
  it.each(['non', 'tape', 'parle'] as const)('au calme, est la même image à deux instants (%s)', (parle) => {
    expect(image(estrade({ t: 2, parle }))).toBe(image(estrade({ t: 9, parle })))
  })

  // Mutation : les ondes retirées, ou tracées quand il se tait.
  it('quand il parle, sa voix porte en ondes', () => {
    expect(ondes(estrade({ vivant: true, t: 2, parle: 'parle' }))).toBe(3)
    expect(ondes(estrade({ vivant: true, t: 2, parle: 'tape' }))).toBe(0)
  })

  // Mutations : `parle` ou `tape` ignorés : le bras resterait au repos.
  it('se tait, tape ou parle : trois bras différents', () => {
    const images = new Set((['non', 'tape', 'parle'] as const).map((parle) => image(estrade({ parle }))))
    expect(images.size).toBe(3)
  })
})
