import { describe, expect, it, vi } from 'vitest'
import { contexteFactice } from '../../test/contexteFactice'
import { dessinerBandeau } from './bandeau'
import { dessinerScene } from './scene'
import { dessinerEstrade } from './estrade'
import { bonimenteur } from './moyen'
import { vuePage } from './vuePage'
import { c } from './couleur'
import { avancerManege, departDuManege, dessinerMonument } from './monument'
import { figureTouchee } from '../../voyage/decennie'
import { dessinerGuichet } from './guichetPage'
import { MEDAILLES } from '../../carte/dessin/cases'
import type { VueBandeau, VueEstrade, VueGuichet, VueMonument, VueScene } from '../types'

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

  // Mutation : le rideau qui s'ouvre sur une baraque fermée (la maquette, `rideauOuverture`, le tient
  // tiré en `verrou` comme en `attente`) : le train passerait derrière les planches ou sous l'échelle.
  it.each(['fermee', 'attente'] as const)('%s, le rideau reste tiré et rien ne se projette', (mode) => {
    // L'écran de la baraque (262, 150, 76 × 46) et la moitié gauche du rideau, en repère de la baraque.
    const ecran = (appels: ReturnType<typeof bandeau>) => appels.filter((a) => a.nom === 'rect' && a.args.join() === '262,150,76,46').length
    const rideauTire = (appels: ReturnType<typeof bandeau>) => appels.some((a) => a.nom === 'fillRect' && a.args.join() === '262,150,38,46')
    for (const o of [{}, { vivant: true, t: 4 }, { vivant: true, t: 10, touche: 8 }]) {
      const appels = bandeau({ mode, roulotte: THEO, ...o })
      expect(ecran(appels)).toBe(0)
      expect(rideauTire(appels)).toBe(true)
    }
    expect(ecran(bandeau({ mode: 'encours' }))).toBe(1)
  })

  // Mutations : l'angle du manège sans le terme du toucher ; la vue de la page sans `touche` (le
  // rideau ne se rouvrirait plus).
  it('un toucher emballe le manège et rouvre le rideau', () => {
    const vivant = { vivant: true, t: 10 }
    // Le manège : de sa première ellipse (52, 214) jusqu'à la baraque (`translate(-92, 6)`).
    const manege = (appels: ReturnType<typeof bandeau>) => {
      const debut = appels.findIndex((a) => a.nom === 'ellipse' && a.args.slice(0, 4).join() === '52,214,38,11')
      const fin = appels.findIndex((a) => a.nom === 'translate' && a.args.join() === '-92,6')
      expect(debut).toBeGreaterThan(-1)
      expect(fin).toBeGreaterThan(debut)
      return JSON.stringify(appels.slice(debut, fin).map((a) => [a.nom, a.args]))
    }
    expect(manege(bandeau({ ...vivant, touche: 9 }))).not.toBe(manege(bandeau({ ...vivant, touche: -9 })))
    // La moitié gauche du rideau : entrouverte au fil du cycle, presque tirée juste après un toucher (le cycle repart).
    const moitie = (appels: ReturnType<typeof bandeau>) =>
      appels.find((a) => a.nom === 'fillRect' && a.args[0] === 262 && a.args[1] === 150 && a.fillStyle === c('#8a2a20'))!.args[2] as number
    expect(moitie(bandeau({ ...vivant, touche: -9 }))).toBeLessThan(10)
    expect(moitie(bandeau({ ...vivant, touche: 9.9 }))).toBeGreaterThan(30)
  })

  // Mutations : le prédicat des années quittées qui compte l'année en cours ou les verrouillées ;
  // le tampon de la décennie oublié.
  it('allume une ampoule du fronton par année quittée, toutes avec le tampon', () => {
    // Les cinq ampoules (270 + 15 i, 142), allumées : leur lueur de rayon 7 en composition `lighter`.
    const allumees = (appels: ReturnType<typeof bandeau>) =>
      appels.filter((a) => a.nom === 'arc' && a.composite === 'lighter' && a.args[1] === 142 && a.args[2] === 7 && [270, 285, 300, 315, 330].includes(a.args[0] as number)).length
    expect(allumees(bandeau({}))).toBe(2)
    expect(allumees(bandeau({ bouclee: true }))).toBe(5)
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

  // Mutation : le cache des images rangé dans la vue, qui se refait à chaque image de la toile :
  // chaque image repartirait de zéro, et la planche ne finirait jamais de charger.
  it('ne charge une image qu’une fois, d’une vue à l’autre', () => {
    let crees = 0
    class ImageFactice {
      src = ''
      complete = false
      naturalWidth = 0
      constructor() {
        crees++
      }
    }
    vi.stubGlobal('Image', ImageFactice)
    try {
      const url = '/assets/essai-du-cache.webp'
      expect(vue(-9).image(url)).toBeNull()
      expect(vue(-9).image(url)).toBeNull()
      expect(crees).toBe(1)
    } finally {
      vi.unstubAllGlobals()
    }
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

  // Mutation : le `save`/`restore` de la projection oubliés : le clip de l'écran survivrait, et le
  // cadre, les rideaux, les lampions et le public ne se verraient plus que dans l'écran.
  it.each([['avec', true], ['sans', false]] as const)('lève le clip de l’écran après la projection (%s image)', (_, avecImage) => {
    const appels = scene({ image: avecImage ? image : null })
    let niveau = 0
    let auClip = -1
    let auCadre = -1
    for (const a of appels) {
      if (a.nom === 'save') niveau++
      else if (a.nom === 'restore') niveau--
      else if (a.nom === 'clip' && auClip < 0) auClip = niveau
      else if (a.nom === 'strokeRect' && auCadre < 0) auCadre = niveau
    }
    expect(auClip).toBeGreaterThan(0)
    expect(auCadre).toBeLessThan(auClip)
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

type Cheval = VueMonument['annees'][number]
/** Les dix chevaux : bruts avant le départ, puis une année par état. */
const ANNEES: Cheval[] = [
  ...[1890, 1891, 1892, 1893, 1894].map((annee) => ({ annee, etat: 'avant' as const })),
  { annee: 1895, etat: 'palme' },
  { annee: 1896, etat: 'lion' },
  { annee: 1897, etat: 'ours' },
  { annee: 1898, etat: 'encours' },
  { annee: 1899, etat: 'avance' },
]
const avec = (changes: Record<number, Cheval['etat']>): Cheval[] => ANNEES.map((a) => ({ ...a, etat: changes[a.annee] ?? a.etat }))
const casesDe = (...etats: VueMonument['cases'][number]['etat'][]) => etats.map((etat, i) => ({ annee: 1895 + i, etat, profondeur: 3 }))
const CASES_MONUMENT = casesDe('palme', 'lion', 'ours', 'encours', 'verrou')

function monument(o: Partial<VueMonument> = {}, toile = contexteFactice()) {
  const zones: { annee: number; x: number; y: number; r: number; devant: boolean }[] = []
  const debut = toile.appels.length
  dessinerMonument({
    ctx: toile.ctx, W: 390, H: 330, t: 0, vivant: false, nuit: 0, annees: ANNEES, cases: CASES_MONUMENT, bouclee: false, touche: -9,
    zone: (annee, x, y, r, devant) => void zones.push({ annee, x, y, r, devant }),
    ...o,
  })
  return { appels: toile.appels.slice(debut), zones }
}
/** Le corps d'un cheval (`cheval`, `moyen.ts`) : son ellipse de 8,5 × 3,4, dans le repère du cheval. */
const corps = (appels: ReturnType<typeof bandeau>) => appels.filter((a) => a.nom === 'ellipse' && a.args[2] === 8.5 && a.args[3] === 3.4)
/** La lueur d'un lampion allumé du toit (r = 2,6) : un cercle de 2,6 × 2,8 en composition `lighter`. */
const lampionsAllumes = (appels: ReturnType<typeof bandeau>) =>
  appels.filter((a) => a.nom === 'arc' && a.composite === 'lighter' && Math.abs((a.args[2] as number) - 7.28) < 1e-9).length

describe('le manège des années', () => {
  // Mutations : les chevaux de devant seuls inscrits ; un rayon de 20.
  it('inscrit la figure de chacune des dix années, rayon 30', () => {
    for (const o of [{}, { vivant: true, t: 1.3 }]) {
      const { zones } = monument(o)
      expect(zones).toHaveLength(10)
      expect(new Set(zones.map((z) => z.annee))).toEqual(new Set(ANNEES.map((a) => a.annee)))
      expect(zones.every((z) => z.r === 30)).toBe(true)
    }
  })

  // Le plan d'une figure est celui de sa peinture : devant, les chevaux peints après le pilier
  // (`figureTouchee` les préfère). Mutations : toutes les figures devant ; aucune ; le plan inversé.
  it('dit devant les chevaux peints après le pilier, derrière les autres', () => {
    for (const o of [{}, { vivant: true, t: 1.3 }, { vivant: true, t: 4.1 }]) {
      const { appels, zones } = monument(o)
      const pilier = appels.findIndex((a) => a.nom === 'fillRect' && a.fillStyle === c('#6b4a2a'))
      expect(pilier).toBeGreaterThan(-1)
      for (const z of zones) {
        const pose = appels.findIndex((a) => a.nom === 'translate' && a.args[0] === z.x && a.args[1] === z.y)
        expect(pose > pilier).toBe(z.devant)
      }
      expect(zones.some((z) => z.devant)).toBe(true)
      expect(zones.some((z) => !z.devant)).toBe(true)
    }
  })

  // Mutation : la figure inscrite à la hauteur de la barre, sans le galop (`yb` au lieu de `yb + bob`) :
  // le doigt posé sur un cheval qui monte tomberait à côté.
  it('inscrit la figure là où le cheval se tient, galop compris', () => {
    const { appels, zones } = monument({ vivant: true, t: 1.3 })
    const poses = appels.filter((a) => a.nom === 'translate').map((a) => a.args.join())
    for (const z of zones) expect(poses).toContain(`${z.x},${z.y}`)
  })

  // Mutation : `D.v = 6` retiré.
  it('s’emballe au toucher', () => {
    const depart = departDuManege(0)
    const sans = avancerManege(depart, { t: 0.1, touche: -9, vivant: true })
    const avecToucher = avancerManege(depart, { t: 0.1, touche: 0.05, vivant: true })
    expect(avecToucher.a - depart.a).toBeGreaterThan(sans.a - depart.a)
  })

  // Mutations : la formule close depuis le dernier toucher ; le second toucher ignoré (`touche`
  // comparé au premier).
  it('ne revient pas en arrière au second toucher', () => {
    const course = (touches: number[]) => {
      let e = departDuManege(0)
      const angles = [e.a]
      for (let k = 1; k <= 40; k++) {
        const t = k * 0.05
        const touche = touches.filter((x) => x <= t + 1e-9).pop() ?? -9
        e = avancerManege(e, { t, touche, vivant: true })
        angles.push(e.a)
      }
      return angles
    }
    const deux = course([0.2, 0.4])
    for (let i = 1; i < deux.length; i++) expect(deux[i]!).toBeGreaterThanOrEqual(deux[i - 1]!)
    expect(deux[deux.length - 1]!).toBeGreaterThan(course([0.2])[40]!)
  })

  // Mutations : `dt` non borné ; `dt` négatif laissé passer (une horloge qui recule ferait reculer le manège).
  it('le pas est borné', () => {
    const depart = departDuManege(0)
    expect(avancerManege(depart, { t: 60, touche: -9, vivant: true }).a - depart.a).toBeLessThanOrEqual(0.1 * 0.3 * depart.v + 1e-12)
    expect(avancerManege(departDuManege(5), { t: 4, touche: -9, vivant: true }).a).toBe(departDuManege(5).a)
  })

  // Mutations : la garde `vivant` retirée de l'angle ; du galop (`bob`).
  it('immobile au calme', () => {
    const toile = contexteFactice()
    const trace = (appels: ReturnType<typeof bandeau>) => JSON.stringify(appels.map((a) => [a.nom, a.args, a.fillStyle, a.strokeStyle, a.alpha]))
    const premiere = monument({ t: 0, nuit: 1 }, toile)
    // La même toile, remise aux styles de départ : seul l'état du manège passe d'une image à l'autre.
    toile.ctx.fillStyle = '#000'
    toile.ctx.strokeStyle = '#000'
    const seconde = monument({ t: 3, nuit: 1 }, toile)
    expect(trace(seconde.appels)).toBe(trace(premiere.appels))
    expect(seconde.zones).toEqual(premiere.zones)
    // Au calme, chaque cheval se tient à la même hauteur sur sa barre ; au galop, non.
    const hauteurs = (o: Partial<VueMonument>) => {
      const { appels, zones } = monument(o)
      const barres = appels.filter((a) => a.nom === 'lineTo' && a.strokeStyle === c('#B8862B'))
      return new Set(zones.map((z) => (barres.find((b) => b.args[0] === z.x)!.args[1] as number) - z.y).map((d) => d.toFixed(6))).size
    }
    expect(hauteurs({})).toBe(1)
    expect(hauteurs({ vivant: true, t: 1.3 })).toBeGreaterThan(1)
  })

  // Décision du propriétaire du 1er octobre 2026 (2c-2) : au calme, le manège se fige à un angle où
  // aucun cheval ne se tient derrière le pilier (à l'angle de départ, 1897 y restait pour toujours,
  // sans plaque), et où chacun garde un endroit qui l'ouvre sous le doigt, le cheval de devant
  // l'emportant sur la zone commune (`figureTouchee`). Le corps d'un cheval (`cheval`, `moyen.ts`) va
  // de la queue, à −12,5, au bout de la tête, à 16,2, à l'échelle de son `scale`. Mutation : l'angle
  // de l'état gardé au calme (`const angle = etat.a`, l'angle de départ de la maquette).
  it('au calme, ne cache aucun cheval derrière le pilier, et chacun se touche', () => {
    const { appels, zones } = monument()
    const pilier = appels.find((a) => a.nom === 'fillRect' && a.fillStyle === c('#6b4a2a'))!
    const [px, py, pw, ph] = pilier.args as [number, number, number, number]
    expect(zones).toHaveLength(10)
    expect(zones.find((z) => z.annee === 1897)!.devant).toBe(true)
    for (const z of zones.filter((x) => !x.devant)) {
      const pose = appels.findIndex((a) => a.nom === 'translate' && a.args[0] === z.x && a.args[1] === z.y)
      const sx = appels.slice(pose).find((a) => a.nom === 'scale')!.args[0] as number
      const [gauche, droite] = [z.x - 12.5 * sx, z.x + 16.2 * sx].sort((a, b) => a - b) as [number, number]
      expect(droite <= px || gauche >= px + pw, `${z.annee} derrière le pilier`).toBe(true)
    }
    const sousLePilier = (x: number, y: number) => x >= px && x <= px + pw && y >= py && y <= py + ph
    for (const z of zones) {
      let touche = false
      for (let x = z.x - z.r; x <= z.x + z.r && !touche; x += 1)
        for (let y = z.y - z.r; y <= z.y + z.r && !touche; y += 1)
          touche = (z.devant || !sousLePilier(x, y)) && figureTouchee(zones, { x, y }) === z.annee
      expect(touche, `${z.annee} sous le doigt`).toBe(true)
    }
  })

  // Mutations : le corail passé par `c()`, sur le cheval, sur son anneau, sur sa plaque.
  it('le cheval de l’année en cours est corail, non teinté', () => {
    const { appels } = monument({ nuit: 1 })
    expect(corps(appels).filter((a) => a.fillStyle === '#FF6B57')).toHaveLength(1)
    expect(appels.some((a) => a.nom === 'ellipse' && a.args[2] === 16 && a.args[3] === 4 && a.strokeStyle === '#FF6B57')).toBe(true)
    // La plaque ne se lit que devant : 1898 y est au calme (`ANGLE_AU_CALME`).
    const plaque = appels.findIndex((a) => a.nom === 'fillText' && a.args[0] === '1898')
    expect(plaque).toBeGreaterThan(-1)
    expect(appels.slice(0, plaque).filter((a) => a.nom === 'fill').pop()!.fillStyle).toBe('#FF6B57')
  })

  // La lectrice (option A) : une année que le Voyage suivi n'a pas encore ouverte est fermée pour elle.
  // Son cheval n'est pas celui de l'année en cours : ni corail (le cheval, l'anneau, la plaque), mais le
  // pointillé or de la case de la carte et une plaque terne. Mutations : le cheval peint en corail ;
  // l'anneau corail gardé ; le pointillé oublié ; la plaque en corail.
  it('le cheval d’une année en attente est terne, au pointillé or, sans aucun corail', () => {
    const { appels } = monument({ nuit: 1, annees: avec({ 1898: 'attente' }) })
    expect(appels.some((a) => a.fillStyle === '#FF6B57' || a.strokeStyle === '#FF6B57')).toBe(false)
    expect(corps(appels).filter((a) => a.fillStyle === c('#2b1c14'))).toHaveLength(1)
    expect(appels.filter((a) => a.nom === 'ellipse' && a.args[2] === 16 && a.args[3] === 4 && a.strokeStyle === c('#E6B94A', 0.8))).toHaveLength(1)
    // Sans bâche : celle d'un cheval verrouillé est un trapèze sous `#4a3321`.
    expect(appels.some((a) => a.fillStyle === c('#4a3321'))).toBe(false)
    const plaque = appels.findIndex((a) => a.nom === 'fillText' && a.args[0] === '1898')
    expect(plaque).toBeGreaterThan(-1)
    expect(appels.slice(0, plaque).filter((a) => a.nom === 'fill').pop()!.fillStyle).toBe(c('#150F09', 0.75))
  })

  // Mutation : la médaille réservée à la Palme, comme la maquette (le Lion et l'Ours perdraient la leur).
  it('médaille chaque cheval récompensé', () => {
    expect(medailles(monument().appels)).toBe(3)
    expect(medailles(monument({ annees: avec({ 1895: 'passee', 1896: 'passee', 1897: 'passee' }) }).appels)).toBe(0)
  })

  // Mutations : l'année passée ternie comme celles d'avant le Voyage ; peinte d'une autre couleur que le bois.
  it('ternit les chevaux d’avant le Voyage, pas celui d’une année passée', () => {
    const appels = monument({ annees: avec({ 1899: 'passee' }) }).appels
    expect(corps(appels).filter((a) => a.alpha === 0.75)).toHaveLength(5)
    expect(corps(appels).filter((a) => a.alpha === 1 && a.fillStyle === c('#8a6a44'))).toHaveLength(1)
  })

  // Mutations : la part comptée sur les années quittées (`etat !== 'verrou'`) ; sur toutes ; sans
  // la garde des cases vides (`0 / 0` : la foule disparaîtrait).
  it('allume ses lampions à la part des années récompensées', () => {
    const lampions = (cases: VueMonument['cases']) => lampionsAllumes(monument({ nuit: 1, cases }).appels)
    const toutes = lampions(casesDe('palme', 'lion', 'ours', 'palme', 'lion'))
    const deux = lampions(casesDe('palme', 'lion', 'encours', 'verrou', 'verrou'))
    expect(lampions(casesDe('passee', 'passee', 'encours', 'verrou', 'verrou'))).toBe(0)
    expect(deux).toBeGreaterThan(0)
    expect(toutes).toBeGreaterThan(deux)
    const image = (cases: VueMonument['cases']) => JSON.stringify(monument({ nuit: 1, cases }).appels.map((a) => [a.nom, a.args]))
    expect(image([])).toBe(image(casesDe('verrou', 'verrou')))
  })

  // Relecture. Mutation : chaque figure inscrite sous l'année du cheval voisin (`v.annees[(k.i + 1) % 10]`) :
  // dix années distinctes, dix positions justes, et le doigt posé sur 1895 ouvrirait 1896.
  it('inscrit chaque figure sous l’année que porte la plaque de son cheval', () => {
    for (const o of [{}, { vivant: true, t: 1.3 }]) {
      const { appels, zones } = monument(o)
      let lues = 0
      for (const z of zones) {
        const plaque = appels.find((a) => a.nom === 'fillText' && a.args[0] === String(z.annee))
        if (!plaque) continue
        lues++
        expect(plaque.args.slice(1, 3)).toEqual([z.x, z.y + 33])
      }
      expect(lues).toBeGreaterThanOrEqual(5)
    }
  })

  // Relecture. Mutation : le pilier peint après les chevaux de devant (il les cacherait, et les
  // chevaux de derrière, qu'il doit cacher, resteraient seuls touchables à travers lui).
  it('cache les chevaux de derrière sous le pilier, jamais ceux de devant', () => {
    for (const o of [{}, { vivant: true, t: 1.3 }]) {
      const { appels, zones } = monument(o)
      const pilier = appels.findIndex((a) => a.nom === 'fillRect' && a.args.join() === '177,132,36,140')
      expect(pilier).toBeGreaterThan(-1)
      // La barre d'un cheval, à l'abscisse de sa figure ; son pied : `base − 6 + z × ry`, soit 274 + 20 z.
      const barres = zones.map((z) => {
        const i = appels.findIndex((a) => a.nom === 'lineTo' && a.strokeStyle === c('#B8862B') && a.args[0] === z.x)
        return { a: appels[i]!, i }
      })
      const derriere = barres.filter(({ a }) => (a.args[1] as number) < 274)
      expect(derriere.length).toBeGreaterThan(0)
      expect(derriere.length).toBeLessThan(10)
      for (const { a, i } of barres) expect(i < pilier).toBe((a.args[1] as number) < 274)
    }
  })

  // Relecture. Mutation : la médaille de la Palme sur chaque cheval récompensé (`medaille(g, 'palme', …)`) :
  // le Lion et l'Ours en perdraient la leur, le compte resterait juste.
  it('médaille chaque cheval de sa propre récompense', () => {
    const { appels, zones } = monument()
    const filets = appels.map((a, i) => ({ a, i })).filter(({ a }) => a.nom === 'arc' && a.args.slice(0, 3).join() === '0,0,10.8')
    expect(filets).toHaveLength(3)
    const vues = filets.map(({ a, i }) => {
      // La médaille se pose en `translate(x, y − 26)` au-dessus de son cheval, puis se dessine en son repère.
      const pose = appels.slice(0, i).reverse().find((p) => p.nom === 'translate' && p.args.join() !== '0,0')!
      const z = zones.find((q) => q.x === pose.args[0] && q.y - 26 === pose.args[1])!
      const etat = ANNEES.find((n) => n.annee === z.annee)!.etat
      return { etat, filet: a.strokeStyle }
    })
    expect(new Set(vues.map((m) => m.etat))).toEqual(new Set(['palme', 'lion', 'ours']))
    for (const m of vues) expect(m.filet).toBe(c(MEDAILLES[m.etat]![2]))
  })

  // Relecture. Mutation : au calme, le toucher n'est pas retenu (`{ ...etat, t: o.t }`) : un toucher
  // fait au calme emballerait le manège au retour des animations.
  it('un toucher vu au calme n’emballe pas le manège au retour des animations', () => {
    const calme = avancerManege(departDuManege(0), { t: 0, touche: 0.5, vivant: false })
    const vivant = avancerManege(calme, { t: 0.1, touche: 0.5, vivant: true })
    const temoin = avancerManege(departDuManege(0), { t: 0.1, touche: -9, vivant: true })
    expect(vivant.a).toBeCloseTo(temoin.a, 12)
  })

  // Relecture. Mutation : le toucher comparé par `>` au précédent. L'horloge de la toile repart de
  // zéro quand le calme est coupé puis rendu (`Toile`, la boucle relancée) : un toucher plus tôt
  // sur la nouvelle horloge que le dernier vu sur l'ancienne doit emballer quand même.
  it('s’emballe encore après une horloge repartie de zéro', () => {
    let e = departDuManege(0)
    for (let k = 1; k <= 100; k++) e = avancerManege(e, { t: k * 0.05, touche: 4, vivant: true })
    e = avancerManege(e, { t: 0, touche: 4, vivant: true })
    const sans = avancerManege(e, { t: 0.1, touche: 4, vivant: true })
    const avecToucher = avancerManege(e, { t: 0.1, touche: 0.05, vivant: true })
    expect(avecToucher.a - e.a).toBeGreaterThan(2 * (sans.a - e.a))
  })
})

describe('le guichet de la recherche', () => {
  const guichet = (o: Partial<VueGuichet>) => {
    const { ctx, appels } = contexteFactice()
    dessinerGuichet({ ctx, W: 390, H: 170, t: 5, vivant: true, nuit: 0, frappe: -9, ...o })
    return JSON.stringify(appels.map((a) => [a.nom, a.args, a.fillStyle, a.alpha]))
  }

  // Mutations : `p` toujours 0 ; la garde `vivant` retirée.
  it('le guichetier se penche après une lettre, pas au calme', () => {
    expect(guichet({ frappe: 4.9 })).not.toBe(guichet({ frappe: -9 }))
    expect(guichet({ vivant: false, frappe: 4.9 })).toBe(guichet({ vivant: false, frappe: -9 }))
  })

  // Relecture. Mutations : la lampe laissée à son éclat (`guichet(g, vm, p, 1)`) ; le guichetier
  // qui ne se penche plus (`guichet(g, vm, 0, 1 + p × 0,9)`). Chacune laissait l'autre faire différer
  // les appels, et le test précédent vert.
  it('à une lettre, la lampe se ravive et le guichetier se penche', () => {
    const image = (frappe: number) => {
      const { ctx, appels } = contexteFactice()
      dessinerGuichet({ ctx, W: 390, H: 170, t: 5, vivant: true, nuit: 0, frappe })
      return appels
    }
    // La vitre éclairée (`fillRect(x − 20, y − 46, 40, 24)`, x = 84, y = 608) : son opacité suit la lampe.
    const eclat = (appels: ReturnType<typeof image>) => {
      const s = String(appels.find((a) => a.nom === 'fillRect' && a.args.join() === '64,562,40,24')!.fillStyle)
      return s.startsWith('rgba') ? Number(s.slice(s.lastIndexOf(',') + 1, -1)) : 1
    }
    // Le guichetier tourne autour de son épaule de `penche × 0,35`.
    const penche = (appels: ReturnType<typeof image>) => appels.find((a) => a.nom === 'rotate')?.args[0] ?? 0
    expect(eclat(image(4.9))).toBeGreaterThan(eclat(image(-9)))
    expect(penche(image(4.9))).toBeGreaterThan(0)
    expect(penche(image(-9))).toBe(0)
  })
})
