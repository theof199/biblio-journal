import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORAIL, MAX_TUILES, MoteurCarte, type CaseCarte, type Dependances, type EtatCarte, type Rappels } from './moteur'
import { contexteFactice, type Appel } from '../test/contexteFactice'
import { mondeAVenir } from '../mondes/avenir'
import type { DateVraie, Monde, VueMonde } from '../mondes/types'

const W = 390
const H = 700

/**
 * Un monde d'essai qui porte tout ce qu'un monde peut demander au moteur — un virage, une
 * palpitation, une cadence — et qui dessine d'après l'horloge qu'il reçoit : si elle bouge,
 * l'image bouge.
 */
const vus: VueMonde[] = []
/** Une date vraie du monde d'essai, et l'endroit de l'écran où il pose son affichette. */
const DATE: DateVraie = { an: 1895, x: 60, y: 90, court: '22 mars', lieu: 'Paris', titre: 'La première projection', jour: 'Vendredi 22 mars 1895', texte: 'Un texte.', image: null }
/** Idée 8 : où se bâtit 1899 dans le monde d'essai, en `y` de la section 1890 (qui commence à 0). */
const SITE_1899 = 200
/** Un manège du monde d'essai, loin des cases et de l'affichette : un toucher le fait réagir. */
const MANEGE = { x: 300, y: 90 }
/** Les réactions demandées au monde d'essai, par zone touchée. */
const reactions: string[] = []
function mondeDEssai(decennie: number): Monde {
  const base = mondeAVenir(decennie)
  return {
    ...base,
    traitement: { cadence: 16, tremblement: 0.8, scintillement: 0.03, grain: 0.09, virage: { couleur: [150, 104, 58], alpha: 0.13 }, affiches: 'sepia' },
    dates: decennie === 1890 ? [DATE] : [],
    adieu: decennie === 1890 ? 2 : 0,
    dessinerCiel: (v) => {
      vus.push(v)
      v.ctx.fillRect(v.t, 0, 1, 1)
    },
    dessinerSol: (v, porte) => {
      base.dessinerSol(v, porte)
      if (decennie === 1890) v.zone('date', DATE.x * v.k, v.ecranY(DATE.y, 1), 20, 0)
      if (decennie === 1890) v.zone('manege', MANEGE.x * v.k, v.ecranY(MANEGE.y, 1), 20)
    },
    reagir: (id) => void reactions.push(id),
    // Idée 8 : un repère dans la suite des appels, pour lire où le moteur place ce plan.
    dessinerSurLaBrume: (v) => v.ctx.fillText('sur la brume', 0, 0),
    // Idée 8 : 1899 se bâtit en haut de la section, loin de sa case (850).
    siteDuChantier: (annee) => (decennie === 1890 && annee === 1899 ? SITE_1899 : null),
  }
}

function monter(
  options: {
    calme?: boolean
    affiches?: boolean
    heure?: number
    roulotte?: EtatCarte['roulotte']
    sansColonne?: boolean
    /** Où se bâtit 1898 (le monde d'essai n'en dit rien sans elle). */
    chantier1898?: number | null
    /** Le monde demande des étincelles, des confettis et de la fumée en dessinant ses plans proches. */
    particules?: boolean
  } = {},
) {
  vus.length = 0
  reactions.length = 0
  const principal = contexteFactice()
  const toiles: Appel[][] = []
  const deps: Dependances = {
    creerToile: (w, h) => {
      const f = contexteFactice()
      toiles.push(f.appels)
      return { width: w, height: h, getContext: () => f.ctx }
    },
    image: () => ({}) as CanvasImageSource,
    demanderImage: () => 1,
    annulerImage: vi.fn(),
    heure: () => options.heure ?? 12,
    mondeDe: (d) => {
      const m = mondeDEssai(d)
      const { chantier1898, particules } = options
      return {
        ...m,
        palette: options.sansColonne ? { ...m.palette, colonne: null } : m.palette,
        siteDuChantier: (annee) => (chantier1898 !== undefined && annee === 1898 ? chantier1898 : m.siteDuChantier(annee)),
        dessinerProche: (v) => {
          if (!particules) return
          v.etincelles(10, 10, 1, '#abcdef')
          v.confettis(10, 10, ['#abcdef'])
          v.fumee(10, 10, 1, 4)
        },
      }
    },
  }
  const rappels: Rappels = { toucherAnnee: vi.fn(), apercu: vi.fn(), finApercu: vi.fn(), ensemble: vi.fn(), defilerVers: vi.fn(), date: vi.fn(), roulotte: vi.fn() }
  const moteur = new MoteurCarte({ width: 0, height: 0, getContext: () => principal.ctx }, rappels, deps)
  moteur.mesurer(W, H, 2)
  moteur.reglerCalme(options.calme ?? false)
  const cases: CaseCarte[] = Array.from({ length: 2026 - 1895 + 1 }, (_, i) => {
    const annee = 1895 + i
    return {
      annee,
      etat: annee < 1898 ? 'lion' : annee === 1898 ? 'encours' : 'verrou',
      attente: false,
      profondeur: annee <= 1898 ? 4 : 0,
      jauge: annee === 1898 ? { vus: 3, total: 5 } : null,
      affiches: options.affiches && annee <= 1898 ? ['https://image.tmdb.org/t/p/w500/a.jpg'] : [],
    }
  })
  const roulotte = options.roulotte ?? null
  moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte })
  return { moteur, appels: principal.appels, toiles, rappels, deps, cases, roulotte }
}

const pleinEcran = (a: Appel) => (a.nom === 'fillRect' || a.nom === 'drawImage') && a.args.slice(-2).join() === `${W},${H}`

describe('le moteur de la carte', () => {
  beforeEach(() => {
    vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  // Mutation : dessiner la couche corail avant les voiles (virage, palpitation).
  it('pose le corail après tous les voiles de l’écran', () => {
    const { moteur, appels } = monter()
    moteur.image(1000)
    const dernierVoile = appels.map(pleinEcran).lastIndexOf(true)
    const premierCorail = appels.findIndex((a) => a.fillStyle === CORAIL || a.strokeStyle === CORAIL)
    expect(dernierVoile).toBeGreaterThan(-1)
    expect(premierCorail).toBeGreaterThan(dernierVoile)
  })

  // Mutation : poser le corail sur la case où se tient l'avatar : pendant une marche, l'année
  // quittée garderait la jauge et la nouvelle année n'aurait pas son millésime.
  it('marque en corail l’année en cours, même quand l’avatar n’y est pas encore', () => {
    const { moteur, appels, cases } = monter()
    moteur.majEtat({ cases, anneeAvatar: 1897, tampons: [], roulotte: null })
    appels.length = 0
    moteur.image(1000)
    const premierCorail = appels.findIndex((a) => a.fillStyle === CORAIL || a.strokeStyle === CORAIL)
    const millesime = appels.slice(premierCorail).find((a) => a.nom === 'fillText')
    expect(millesime?.args[0]).toBe('1898')
  })

  // Mutation : laisser avancer l'horloge quand le visiteur demande moins d'animations.
  it('fige l’image quand le visiteur demande moins d’animations', () => {
    const { moteur, appels } = monter({ calme: true })
    moteur.image(1000)
    const premiere = JSON.stringify(appels)
    appels.length = 0
    moteur.image(2600)
    expect(JSON.stringify(appels)).toBe(premiere)
    expect(vus.every((v) => !v.vivant)).toBe(true)
  })

  // Mutation : `getImageData` pour virer les affiches au sépia (la toile teintée lèverait en ligne).
  it('ne lit jamais les pixels d’une affiche', () => {
    const { moteur, toiles } = monter({ affiches: true })
    moteur.image(1000)
    const lectures = toiles.flat().filter((a) => ['getImageData', 'toDataURL', 'toBlob'].includes(a.nom))
    expect(toiles.flat().some((a) => a.nom === 'drawImage')).toBe(true)
    expect(lectures).toEqual([])
  })

  // Mutation : retirer la garde `y < -110 || y > H + 70` dessine les cent trente années à chaque image.
  it('ne dessine que les années à l’écran', () => {
    const { moteur, appels } = monter()
    moteur.defiler(0)
    moteur.image(1000)
    const ecrits = appels.filter((a) => a.nom === 'fillText').map((a) => a.args[0])
    expect(ecrits).toContain('1896')
    expect(ecrits).not.toContain('2026')
  })

  // Mutation : un `Map` sans borne à la place du `Lru`.
  it('ne garde pas plus de tuiles du sol que sa borne, même après toute la carte', () => {
    const { moteur } = monter()
    for (let y = 0; y < moteur.hauteur; y += 300) {
      moteur.defiler(y)
      moteur.image(1000 + y)
    }
    expect(moteur.tuilesEnMemoire).toBeLessThanOrEqual(MAX_TUILES)
  })

  // Mutation : `rappels.apercu` au toucher, ou la zone de la case oubliée.
  it('un toucher sur une case ouvre son année', () => {
    const { moteur, rappels } = monter()
    moteur.defiler(0)
    moteur.image(1000)
    const { x, y } = moteur.ecranDeLAnnee(1896)
    moteur.pointeur('bas', x, y, false)
    moteur.pointeur('haut', x, y, false)
    expect(rappels.toucherAnnee).toHaveBeenCalledWith(1896)
  })

  // Mutation : ne pas noter le changement d'état (`pops`) : la nacelle neuve ne pousse jamais.
  it('signale au monde l’année qui vient d’être quittée, pour que son monument grandisse', () => {
    const { moteur, cases: initiales } = monter()
    moteur.image(1000)
    const avant = vus[vus.length - 1]!.bati
    const cases = initiales.map((c) =>
      c.annee === 1898 ? { ...c, etat: 'passee' as const } : c.annee === 1899 ? { ...c, etat: 'encours' as const } : c,
    )
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte: null })
    moteur.image(1100)
    const apres = vus[vus.length - 1]!.bati
    expect(apres.n).toBe(avant.n + 1)
    expect(apres.nouvelle).toBe(3)
  })

  // Mutation : dater le changement d'état ou le clap de `this.t` quand l'horloge est figée : la case
  // qui pousse, « +1 nacelle » et le clap resteraient à leur premier instant, jamais à leur fin.
  it('pose d’emblée à leur état final l’année quittée et le clap, quand le visiteur demande moins d’animations', () => {
    const { moteur, appels, cases: initiales } = monter({ calme: true })
    moteur.image(1000)
    const cases = initiales.map((c) =>
      c.annee === 1898 ? { ...c, etat: 'passee' as const } : c.annee === 1899 ? { ...c, etat: 'encours' as const } : c,
    )
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    moteur.image(1100)
    const vue = vus[vus.length - 1]!
    expect(vue.bati.nouvelle).toBe(3)
    expect(vue.t - vue.bati.t0).toBeGreaterThan(2)
    appels.length = 0
    moteur.image(1200)
    const repos = JSON.stringify(appels)
    appels.length = 0
    moteur.claquer()
    moteur.image(1300)
    expect(JSON.stringify(appels)).toBe(repos)
  })

  // Mutation : ignorer `calme` dans `marcherVers` fait attendre une animation qui ne viendra pas.
  it('marche sans animer quand le visiteur demande moins d’animations', async () => {
    const { moteur, rappels } = monter({ calme: true })
    await moteur.marcher(1899)
    expect(rappels.defilerVers).toHaveBeenCalled()
  })

  // Mutation : `nuit: 0` dans `vueMonde`, ou l'heure du visiteur ignorée : la foire resterait de jour à minuit.
  it('donne au monde la nuit de l’heure du visiteur', () => {
    monter({ heure: 23 }).moteur.image(1000)
    expect(vus[vus.length - 1]!.nuit).toBe(1)
    monter({ heure: 12 }).moteur.image(1000)
    expect(vus[vus.length - 1]!.nuit).toBe(0)
  })

  // Mutation : garer la roulotte sur `anneeAvatar` au lieu de l'année du Voyage suivi ; ou traiter
  // son toucher après `if (this.calme) return`.
  it('gare la roulotte suivie juste avant l’année où son Voyage est rendu, et la touche', () => {
    const { moteur, rappels } = monter({ calme: true, roulotte: { pseudo: 'theo', annee: 1896 } })
    moteur.defiler(0)
    moteur.image(1000)
    const r = moteur.ecranDeLaRoulotte()!
    const theo = moteur.ecranDeLAnnee(1896)
    const moi = moteur.ecranDeLAnnee(1898)
    expect(Math.hypot(r.x - theo.x, r.y - theo.y)).toBeLessThan(60)
    expect(Math.hypot(r.x - moi.x, r.y - moi.y)).toBeGreaterThan(100)
    moteur.pointeur('bas', r.x, r.y - 8, false)
    moteur.pointeur('haut', r.x, r.y - 8, false)
    expect(rappels.roulotte).toHaveBeenCalled()
    expect(rappels.toucherAnnee).not.toHaveBeenCalled()
  })

  // Mutation : garer aussi la roulotte de qui mène son propre Voyage, ou la dire au monde quand elle est garée.
  it('laisse la roulotte au monde, sans la garer, pour qui mène son propre Voyage', () => {
    const { moteur } = monter({ roulotte: { pseudo: 'theo', annee: null } })
    moteur.image(1000)
    expect(moteur.ecranDeLaRoulotte()).toBeNull()
    expect(vus[vus.length - 1]!.roulotte).toBe('theo')
    monter({ roulotte: { pseudo: 'theo', annee: 1896 } }).moteur.image(1000)
    expect(vus[vus.length - 1]!.roulotte).toBeNull()
  })

  // Mutation : traiter la date après `if (this.calme) return` : elle ne s'ouvrirait plus pour qui
  // demande moins d'animations.
  it('un toucher sur une affichette ouvre sa date, même quand le visiteur demande moins d’animations', () => {
    const { moteur, rappels } = monter({ calme: true })
    moteur.defiler(0)
    moteur.image(1000)
    moteur.pointeur('bas', DATE.x, DATE.y, false)
    moteur.pointeur('haut', DATE.x, DATE.y, false)
    expect(rappels.date).toHaveBeenCalledWith(DATE)
    expect(rappels.toucherAnnee).not.toHaveBeenCalled()
  })

  // Mutation : un adieu qui ne se résout jamais, ou `adieu: -1` toujours dans `vueMonde`.
  it('dit adieu au monde quitté : il en reçoit le temps écoulé, puis la carte reprend', async () => {
    const { moteur, rappels } = monter()
    let fini = false
    const adieu = moteur.direAdieu(1890).then(() => void (fini = true))
    expect(rappels.defilerVers).toHaveBeenLastCalledWith(0)
    for (let i = 0; i < 30; i++) moteur.image(1000 + i * 50)
    expect(vus[vus.length - 1]!.adieu).toBeGreaterThan(1)
    await Promise.resolve()
    expect(fini).toBe(false)
    for (let i = 30; i < 50; i++) moteur.image(1000 + i * 50)
    await expect(adieu).resolves.toBeUndefined()
    expect(vus[vus.length - 1]!.adieu).toBe(-1)
  })

  // Mutation : ignorer `calme` dans `direAdieu` : l'horloge figée, la promesse n'arriverait jamais.
  it('ne joue pas l’adieu quand le visiteur demande moins d’animations', async () => {
    const { moteur, rappels } = monter({ calme: true })
    await expect(moteur.direAdieu(1890)).resolves.toBeUndefined()
    expect(rappels.defilerVers).not.toHaveBeenCalled()
  })

  // Mutation : `reglerCalme` sans `achever()` : l'horloge figée, la marche en cours ne finirait jamais.
  it('achève la marche en cours quand le visiteur demande moins d’animations en chemin', async () => {
    const { moteur } = monter()
    const marche = moteur.marcher(1899)
    moteur.image(1000)
    moteur.reglerCalme(true)
    await expect(marche).resolves.toBeUndefined()
  })

  // Mutation : dessiner la colonne sans regarder `palette.colonne` : un monde sans colonne chargerait des affiches pour rien.
  it('ne demande aucune affiche à un monde sans colonne', () => {
    const { moteur, toiles } = monter({ affiches: true, sansColonne: true })
    moteur.image(1000)
    expect(toiles.flat().filter((a) => a.nom === 'drawImage')).toEqual([])
  })

  // Idée 8. Mutations : dater aussi le premier `majEtat` (la foire se rebâtirait à
  // chaque ouverture de la carte) ; l'année ouverte prise de la case `encours` (elle se bâtirait
  // pendant la marche qui y mène) ; `!==` au lieu de `>` (un recul rebâtirait).
  it('donne au monde l’année où l’avatar arrive, datée de son arrivée, jamais de l’ouverture de la carte', () => {
    const { moteur, cases: initiales } = monter()
    moteur.image(1000)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
    // La carte relue après l'encaissement : 1899 est en cours, l'avatar n'a pas encore marché.
    const cases = initiales.map((c) =>
      c.annee === 1898 ? { ...c, etat: 'passee' as const } : c.annee === 1899 ? { ...c, etat: 'encours' as const } : c,
    )
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte: null })
    moteur.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
    // La marche finie, la page avance l'avatar.
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    moteur.image(1200)
    const { ouverte, t } = vus[vus.length - 1]!
    expect(ouverte.annee).toBe(1899)
    expect(ouverte.t0).toBeGreaterThan(0)
    expect(t - ouverte.t0).toBeLessThan(0.2)
    moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], roulotte: null })
    moteur.image(1300)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
  })

  // Idée 8. Mutation : `this.t` au lieu de `this.instant()` : tant que l'horloge
  // est figée, `chantier` pose tout bâti (`vivant` faux) ; mais l'année ouverte serait datée, et son
  // chantier se jouerait au retour des animations, pour une arrivée que personne n'a vue.
  it('pose l’année ouverte déjà bâtie quand le visiteur demande moins d’animations', () => {
    const { moteur, cases } = monter({ calme: true })
    moteur.image(1000)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    moteur.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1899, t0: -9 })
  })

  // Idée 8. Mutations : `brume: this.fogY`, sans le `- s.y0` de la section ; `brume: 0`.
  it('donne à chaque monde le haut de la brume, dans son repère', () => {
    const { moteur } = monter()
    moteur.defiler(0)
    moteur.image(1000)
    // Au haut de la carte, la caméra est à 0 : un `y` d'écran est un `y` de la carte.
    const y1898 = moteur.ecranDeLAnnee(1898).y
    const y1900 = moteur.ecranDeLAnnee(1900).y
    expect(vus.find((v) => v.cases.some((c) => c.annee === 1898))!.brume).toBeCloseTo(y1898 + 95, 0)
    vus.length = 0
    moteur.defiler(y1900 - 350)
    moteur.image(1100)
    expect(vus.find((v) => v.cases.some((c) => c.annee === 1900))!.brume).toBeLessThan(0)
  })

  // Idée 8. Mutations : `dessinerSurLaBrume` appelé avec les plans proches, sous la
  // brume et la roulotte ; jamais appelé ; appelé après les voiles.
  it('laisse le monde dessiner par-dessus la brume et la roulotte garée, sous les voiles', () => {
    const { moteur, appels } = monter({ calme: true, roulotte: { pseudo: 'theo', annee: 1896 } })
    moteur.defiler(0)
    moteur.image(1000)
    const ecrit = (s: string) => appels.findIndex((a) => a.nom === 'fillText' && a.args[0] === s)
    const plaque = ecrit('theo est rendu en 1896')
    const surLaBrume = ecrit('sur la brume')
    expect(plaque).toBeGreaterThan(-1)
    expect(surLaBrume).toBeGreaterThan(plaque)
    expect(appels.map(pleinEcran).lastIndexOf(true)).toBeGreaterThan(surLaBrume)
  })

  // Idée 8, relecture du 29 au soir. Mutations : `ouvrirSousLesYeux` sans effet ;
  // sans la garde `annee !== this.etat.anneeAvatar` (la page ouvrirait une année où l'avatar n'est
  // pas) ; `this.t` au lieu de `this.instant()` (la séance se jouerait au retour des animations).
  it('ouvre sous les yeux l’année où se tient l’avatar quand la page le demande, et elle seule', () => {
    const { moteur } = monter()
    moteur.image(1000)
    moteur.ouvrirSousLesYeux(1899)
    moteur.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
    moteur.ouvrirSousLesYeux(1898)
    moteur.image(1200)
    const { ouverte, t } = vus[vus.length - 1]!
    expect(ouverte.annee).toBe(1898)
    expect(ouverte.t0).toBeGreaterThan(0)
    expect(t - ouverte.t0).toBeLessThan(0.2)
    const calme = monter({ calme: true }).moteur
    calme.image(1000)
    calme.ouvrirSousLesYeux(1898)
    calme.image(1100)
    expect(vus[vus.length - 1]!.ouverte).toEqual({ annee: 1898, t0: -9 })
  })

  // Idée 8, relecture du 29 au soir. Mutations : `achever` qui pose aussi l'année
  // ouverte finie (`this.ouverte = { …, t0: -9 }`, le jumeau de la marche et de l'adieu) ;
  // `reglerCalme(false)` qui la redate.
  it('reprend un chantier interrompu là où il en était quand les animations reviennent', () => {
    const { moteur, cases } = monter()
    moteur.image(1000)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    moteur.image(1100)
    // Une copie : la vue porte l'objet du moteur, qu'un redatage en place changerait sous nos yeux.
    const avant = { ...vus[vus.length - 1]!.ouverte }
    expect(avant.t0).toBeGreaterThan(0)
    moteur.reglerCalme(true)
    moteur.image(1200)
    moteur.reglerCalme(false)
    moteur.image(1300)
    expect(vus[vus.length - 1]!.ouverte).toEqual(avant)
  })

  // Idée 8, relecture du 29 au soir. Mutations : `montrerChantier` retiré de
  // `majEtat` (la caméra resterait sur l'avatar) ; `achever` qui laisse la caméra glisser quand le
  // visiteur demande moins d'animations en chemin.
  it('va chercher un chantier qui commence hors de l’écran, et s’y pose d’un coup si le visiteur demande moins d’animations en chemin', () => {
    const { moteur, rappels, cases } = monter()
    moteur.image(1000)
    // La caméra à 0, un `y` d'écran est un `y` de la carte ; puis posée sur 1899.
    const y1899 = moteur.ecranDeLAnnee(1899).y
    moteur.defiler(y1899 - 350)
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    for (let i = 1; i <= 3; i++) moteur.image(1000 + i * 50)
    const vers = () => vi.mocked(rappels.defilerVers).mock.calls.map(([y]) => y)
    expect(vers().length).toBeGreaterThan(0)
    expect(vers()[vers().length - 1]!).toBeLessThan(y1899 - 350)
    // La cible : le site au milieu de l'écran, bornée au haut de la carte.
    const cible = Math.max(0, SITE_1899 - H / 2)
    moteur.reglerCalme(true)
    expect(rappels.defilerVers).toHaveBeenLastCalledWith(cible)
    const n = vers().length
    for (let i = 4; i <= 8; i++) moteur.image(1000 + i * 50)
    expect(vers().length).toBe(n)
  })

  // Idée 8, relecture du 29 au soir. Mutation : `this.suivre = false` retiré de
  // `montrerChantier` : la caméra, tirée vers l'avatar et vers le chantier, s'arrêterait entre les deux.
  it('détourne vers le chantier la caméra qui suivait l’avatar', () => {
    const { moteur, rappels, cases } = monter()
    moteur.image(1000)
    moteur.defiler(moteur.ecranDeLAnnee(1899).y - 350)
    // « Tu es ici » sans `instant` : la caméra suit l'avatar, comme au bout d'une marche.
    moteur.allerIci()
    moteur.majEtat({ cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    for (let i = 1; i <= 60; i++) moteur.image(1000 + i * 50)
    const vers = vi.mocked(rappels.defilerVers).mock.calls.map(([y]) => y)
    expect(vers[vers.length - 1]!).toBeLessThan(2)
  })

  // Idée 8, relecture du 29 au soir. Mutations : la garde des 60 px retirée (la
  // caméra partirait vers un chantier déjà à l'écran) ; la garde `ouverte.t0 < 0` retirée (elle
  // partirait vers une année posée bâtie, en « moins d'animations » comme à l'ouverture de la carte).
  it('ne bouge pas la caméra pour un chantier déjà à l’écran, ni pour une année posée bâtie', () => {
    const vu = monter()
    vu.moteur.defiler(0)
    vu.moteur.image(1000)
    vu.moteur.majEtat({ cases: vu.cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    for (let i = 1; i <= 8; i++) vu.moteur.image(1000 + i * 50)
    expect(vu.rappels.defilerVers).not.toHaveBeenCalled()
    const calme = monter({ calme: true })
    calme.moteur.image(1000)
    calme.moteur.defiler(calme.moteur.ecranDeLAnnee(1899).y - 350)
    calme.moteur.majEtat({ cases: calme.cases, anneeAvatar: 1899, tampons: [], roulotte: null })
    for (let i = 1; i <= 8; i++) calme.moteur.image(1000 + i * 50)
    expect(calme.rappels.defilerVers).not.toHaveBeenCalled()
  })

  // Relecture de la tâche 5 : les jumeaux de l'idée 8. Mutations : `montrerChantier` retiré
  // d'`ouvrirSousLesYeux` (le jumeau de celui de `majEtat`) ; la marge de 60 px ramenée à 0 ou
  // portée à 100 ; la moitié basse de la garde retirée (un chantier sous l'écran) ; `site === null`
  // retiré de la garde (un monde qui ne bâtit rien enverrait la caméra en haut de sa section).
  it('va chercher le chantier ouvert sous les yeux à moins de 60 px d’un bord, en haut comme en bas, jamais pour un monde qui ne bâtit rien', () => {
    const camera = 100
    const bouge = (site: number | null) => {
      const { moteur, rappels } = monter({ chantier1898: site })
      moteur.defiler(camera)
      moteur.image(1000)
      vi.mocked(rappels.defilerVers).mockClear()
      moteur.ouvrirSousLesYeux(1898)
      for (let i = 1; i <= 3; i++) moteur.image(1000 + i * 50)
      return vi.mocked(rappels.defilerVers).mock.calls.length > 0
    }
    expect(bouge(camera + 30)).toBe(true)
    expect(bouge(camera + 90)).toBe(false)
    expect(bouge(camera + H - 90)).toBe(false)
    expect(bouge(camera + H - 30)).toBe(true)
    expect(bouge(null)).toBe(false)
  })

  // Relecture de la tâche 5. Mutation : `duree <= 0` retiré de la garde de `direAdieu` : la caméra
  // remonterait en haut d'une section dont le monde n'a aucune cinématique à montrer.
  it('ne remonte pas la caméra pour un monde qui n’a pas d’adieu', async () => {
    const { moteur, rappels } = monter()
    const adieu = moteur.direAdieu(1900)
    expect(rappels.defilerVers).not.toHaveBeenCalled()
    moteur.image(1000)
    await expect(adieu).resolves.toBeUndefined()
  })

  // Relecture de la tâche 5. Mutation : `if (this.calme) return` retiré de `toucher` : le monde
  // réagirait sous une horloge figée, et sa réaction resterait à son premier instant.
  it('ne fait pas réagir le décor quand le visiteur demande moins d’animations', () => {
    const toucherLeManege = (calme: boolean) => {
      const { moteur } = monter({ calme })
      moteur.defiler(0)
      moteur.image(1000)
      moteur.pointeur('bas', MANEGE.x, MANEGE.y, false)
      moteur.pointeur('haut', MANEGE.x, MANEGE.y, false)
      return [...reactions]
    }
    expect(toucherLeManege(false)).toEqual(['manege'])
    expect(toucherLeManege(true)).toEqual([])
  })

  // Relecture de la tâche 5. Mutations : la garde `this.calme` retirée d'`etincelles`, de
  // `confettis` ou de `fumee` dans `vueMonde` : sous l'horloge figée, les particules demandées à
  // chaque image s'entasseraient, immobiles.
  it('ne lance aucune particule quand le visiteur demande moins d’animations, même si le monde en demande', () => {
    const { moteur, appels } = monter({ calme: true, particules: true })
    moteur.image(1000)
    const premiere = JSON.stringify(appels)
    appels.length = 0
    moteur.image(2600)
    expect(JSON.stringify(appels)).toBe(premiere)
  })

  // Relecture de la tâche 5. Mutations : `if (this.calme) this.ens.q = 1` retiré
  // d'`entrerEnsemble`, ou `= 0` de `quitterEnsemble` : la vue d'ensemble glisserait.
  it('ouvre et ferme la vue d’ensemble d’un coup quand le visiteur demande moins d’animations', () => {
    const { moteur } = monter({ calme: true })
    moteur.image(1000)
    moteur.basculerEnsemble(true)
    vus.length = 0
    moteur.image(1001)
    // La vue d'ensemble ouverte en entier, la scène des mondes n'est plus dessinée.
    expect(vus).toEqual([])
    moteur.basculerEnsemble(false)
    moteur.image(1002)
    expect(vus.length).toBeGreaterThan(0)
  })

  // Relecture de la tâche 5. Mutation : `|| this.calme` retiré d'`allerIci` : la caméra glisserait vers l'avatar.
  it('ramène la caméra sur l’avatar d’un coup quand le visiteur demande moins d’animations', () => {
    const { moteur, rappels } = monter({ calme: true })
    moteur.defiler(5000)
    moteur.allerIci()
    expect(rappels.defilerVers).toHaveBeenCalledTimes(1)
    for (let i = 1; i <= 5; i++) moteur.image(1000 + i * 50)
    expect(rappels.defilerVers).toHaveBeenCalledTimes(1)
  })

  // Relecture de la tâche 5. Mutations : `this.calme ? 1 :` retiré de `roulotteGaree` (une descente
  // en cours resterait en chemin sous l'horloge figée) ; `roulotteT0` daté de `this.t` au lieu
  // d'`instant()` (garée en « moins d'animations », elle redescendrait au retour des animations).
  it('gare d’un coup la roulotte quand le visiteur demande moins d’animations, et l’y laisse quand elles reviennent', () => {
    const roulotte = { pseudo: 'theo', annee: 1896 }
    const garee = (moteur: MoteurCarte) => {
      const r = moteur.ecranDeLaRoulotte()!
      const c = moteur.ecranDeLAnnee(1896)
      return Math.hypot(r.x - c.x, r.y - c.y) < 60
    }
    const enChemin = monter({ roulotte }).moteur
    enChemin.defiler(0)
    enChemin.image(1000)
    expect(garee(enChemin)).toBe(false)
    enChemin.reglerCalme(true)
    enChemin.image(1050)
    expect(garee(enChemin)).toBe(true)
    const deja = monter({ calme: true, roulotte }).moteur
    deja.defiler(0)
    deja.image(1000)
    deja.reglerCalme(false)
    deja.image(1050)
    expect(garee(deja)).toBe(true)
  })

  // Relecture de la tâche 5. Mutation : `this.fogY = this.fogCible` retiré d'`achever` (le jumeau
  // de la marche sans animation) : la brume, arrêtée en chemin, ne se lèverait plus jusqu'à l'année atteinte.
  it('lève la brume jusqu’à l’année atteinte quand la marche s’achève en chemin', async () => {
    const { moteur } = monter()
    const marche = moteur.marcher(1899)
    moteur.image(1000)
    moteur.reglerCalme(true)
    await marche
    moteur.image(1050)
    const lesVues = vus.filter((x) => x.cases.some((c) => c.annee === 1899))
    const v = lesVues[lesVues.length - 1]!
    const case1899 = v.cases.find((c) => c.annee === 1899)!
    // `ecranY(0, 1)` est le haut de la section à l'écran : la case, dans le repère de la section.
    expect(v.brume).toBeCloseTo(case1899.y - v.ecranY(0, 1) + 95, 0)
  })

  // Relecture de la tâche 5. Mutation : `else this.tuiles.clear()` retiré de `majEtat` : une carte
  // relue garderait le sol d'avant, dont les photogrammes allumés dépendent des profondeurs.
  it('redessine le sol quand la carte relue change, même sans nouvelle année', () => {
    const { moteur, toiles, cases } = monter()
    moteur.image(1000)
    const avant = toiles.length
    const relues = cases.map((c) => (c.annee === 1898 ? { ...c, profondeur: 5 } : c))
    moteur.majEtat({ cases: relues, anneeAvatar: 1898, tampons: [], roulotte: null })
    moteur.image(1100)
    expect(toiles.length).toBeGreaterThan(avant)
  })

  // Relecture de la tâche 5. Mutation : `detruire` sans `annulerImage` : la boucle d'une carte
  // démontée continuerait de tourner.
  it('arrête sa boucle quand la carte est démontée', () => {
    const { moteur, deps } = monter()
    moteur.detruire()
    expect(deps.annulerImage).toHaveBeenCalledWith(1)
  })
})
