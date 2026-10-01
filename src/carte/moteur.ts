import { clamp, ease, lerp, mixc, rgba, type Rgb } from './outils'
import { construireRoute, pointA, type Route } from './route'
import { placerCarte, type PlanCarte } from './placement'
import { cibleCamera, poidsSections } from './camera'
import { ecranDe, rayonEcran, trouverZone, type Zone } from './zones'
import { geoEnsemble } from './ensemble'
import { ambianceDeLHeure } from './heure'
import { Lru } from './lru'
import { horlogeDuMonde, scintillement, tremblement } from './traitement'
import { Geste, lirePincement } from './geste'
import type { DateVraie, Monde, VueMonde } from '../mondes/types'
import type { EtatCase } from '../voyage/regles'
import { dessinerCase, dessinerCorail } from './dessin/cases'
import { dessinerAvatar } from './dessin/avatar'
import { dessinerSol, TUILE } from './dessin/sol'
import { dessinerEnsemble } from './dessin/ensemble'
import { Particules } from './dessin/particules'
import { Effets, type Feu } from './dessin/effets'
import { afficheTraitee } from './dessin/affiches'
import { dessinerPlaqueRoulotte, dessinerRoulotte } from './dessin/roulotte'
import { imageCommune } from './images'

/** Le corail : ce que le joueur déclenche. Jamais sous un voile, jamais teinté (spec, « Le rendu »). */
export const CORAIL = '#FF6B57'
/** Les tuiles du sol gardées en mémoire (voir `Lru`). */
export const MAX_TUILES = 6

export interface CaseCarte {
  annee: number
  etat: EtatCase
  attente: boolean
  profondeur: number
  jauge: { vus: number; total: number } | null
  affiches: readonly string[]
}
export interface EtatCarte {
  cases: readonly CaseCarte[]
  /**
   * L'année où se tient l'avatar ; la page la fait avancer après la marche, jamais avant. C'est
   * aussi le signal qui ouvre l'année au monde (idée 8, `VueMonde.ouverte`).
   */
  anneeAvatar: number
  tampons: readonly number[]
  /**
   * La roulotte de qui mène le Voyage (idée 1, 29 septembre 2026). `annee` : l'année où ce Voyage
   * est rendu, la roulotte descend s'y garer. Nulle : on mène soi-même, la roulotte traverse le
   * monde (`VueMonde.roulotte`). Absente (`null`) : pas de roulotte.
   */
  roulotte: { pseudo: string; annee: number | null } | null
}
export interface Rappels {
  toucherAnnee: (annee: number) => void
  apercu: (annee: number, ancre: { x: number; y: number }) => void
  finApercu: () => void
  ensemble: (ouvert: boolean) => void
  /** Le moteur veut la caméra ailleurs : la page pose `scrollTop`, le défilement reste natif. */
  defilerVers: (y: number) => void
  /** Une affichette touchée : la page ouvre sa petite affiche. */
  date: (d: DateVraie) => void
  /** La roulotte garée touchée : la page dit où en est le Voyage suivi. */
  roulotte: () => void
  /** L'avatar entre dans l'écran, ou en sort : la page ne propose « Tu es ici » que tant qu'il est hors de vue. */
  avatarVisible: (visible: boolean) => void
}
/** Sous cette hauteur d'écran, l'avatar est sous le bandeau du haut (le HUD de la page) : il n'est pas vu. */
export const HAUT_MASQUE = 110
/** Au-dessus de ce vide, au bas de l'écran, il est déjà collé au bord. */
export const BAS_MASQUE = 30
export interface Toile {
  width: number
  height: number
  getContext: (type: '2d') => CanvasRenderingContext2D | null
}
export interface Dependances {
  creerToile: (w: number, h: number) => Toile
  /** Une affiche prête à dessiner, nulle tant qu'elle charge ; `pret` rappelé au chargement. */
  image: (url: string, pret: () => void) => CanvasImageSource | null
  demanderImage: (f: (t: number) => void) => number
  annulerImage: (id: number) => void
  /** L'heure du visiteur, de 0 à 24. */
  heure: () => number
  mondeDe: (decennie: number) => Monde
}

interface Marche {
  d0: number
  d1: number
  t0: number
  dur: number
  fin: () => void
}

/**
 * Le moteur de la carte (spec du Journal web, « La carte est un moteur à part ») : un état, un
 * `<canvas>`, des touchers rendus en rappels. Aucun import de React ni de l'API, aucun écouteur
 * du DOM : `CarteCanvas.tsx` lui relaie mesures, défilement, pointeurs et réglages. D'où un
 * moteur qu'un test fait dessiner image par image dans un contexte factice.
 */
export class MoteurCarte {
  private W = 390
  private H = 700
  private k = 1
  private dpr = 1
  private camY = 0
  private t = 0
  private dernier = 0
  private raf = 0
  private visible = true
  private calme = false
  private etat: EtatCarte = { cases: [], anneeAvatar: 0, tampons: [], roulotte: null }
  private plan: PlanCarte = { points: [], cases: [], sections: [], hauteur: 0 }
  private route: Route = { pts: [], dWay: [] }
  private chemin: Path2D | null = null
  private readonly tuiles = new Lru<number, Toile>(MAX_TUILES)
  /** Les affiches traitées, par monde et par adresse : quarante-huit toiles de 52 × 76. */
  private readonly affiches = new Lru<string, Toile>(48)
  private zones: Zone[] = []
  private feux: Feu[] = []
  private readonly effets: Effets
  private readonly reactions = new Map<string, number>()
  /** Le moment où chaque année a changé d'état : sa case « pousse », sa nacelle s'allume. */
  private readonly pops = new Map<number, number>()
  private readonly particules = new Particules()
  private readonly avatar: { d: number; marche: Marche | null; claque: number } = { d: 0, marche: null, claque: -9 }
  private suivre = false
  /** Ce que la page sait de l'avatar ; nul tant qu'on ne le lui a pas dit. */
  private avatarVu: boolean | null = null
  private ens = { q: 0, cible: 0 }
  private fogY = 0
  private fogCible = 0
  private pincement: number | null = null
  /** Le moment où la roulotte a commencé de descendre vers son année. */
  private roulotteT0 = -9
  /** La cinématique de sortie d'un monde, tant qu'elle dure. */
  private adieu: { decennie: number; t0: number; fin: () => void } | null = null
  /** L'année ouverte au monde et le moment où l'avatar y est arrivé (idée 8) ; -9 : déjà fini. */
  private ouverte = { annee: 0, t0: -9 }
  /** Où la caméra glisse pour montrer un chantier qui commence hors de l'écran (idée 8) ; nulle sinon. */
  private visee: number | null = null
  private readonly geste: Geste
  private readonly ctx: CanvasRenderingContext2D | null
  private readonly canvas: Toile

  constructor(
    canvas: Toile,
    private readonly rappels: Rappels,
    private readonly deps: Dependances,
  ) {
    // Sans contexte (jsdom, ou un navigateur qui refuse), le moteur reste inerte : la liste des
    // années de la page suffit pour naviguer.
    this.ctx = canvas.getContext('2d')
    this.canvas = canvas
    this.effets = new Effets(deps.creerToile)
    // L'horloge du geste est celle du mur, pas celle du décor : figée quand le visiteur demande
    // moins d'animations, elle ferait d'un appui de dix secondes un toucher.
    this.geste = new Geste(
      { maintenant: () => performance.now(), programmer: (f, ms) => setTimeout(f, ms), annuler: (j) => clearTimeout(j as ReturnType<typeof setTimeout>) },
      (x, y) => {
        const z = trouverZone(this.zones, x, y)
        return z?.id === 'case' ? z.data : null
      },
      (s) => {
        if (s.type === 'toucher') this.toucher(s.x, s.y)
        else if (s.type === 'appuiLong') this.rappels.apercu(s.annee, this.ecranDeLAnnee(s.annee))
        else this.rappels.finApercu()
      },
    )
  }

  // --- ce que la page relaie -------------------------------------------------------------

  mesurer(W: number, H: number, dpr: number): void {
    this.W = W
    this.H = H
    this.dpr = Math.min(2, dpr || 1)
    this.canvas.width = Math.round(W * this.dpr)
    this.canvas.height = Math.round(H * this.dpr)
    this.k = W / 390
    this.effets.mesurer(W, H, this.dpr)
    this.reconstruire()
  }

  /** La hauteur du défilement à donner à l'espaceur (`hauteur - H`). */
  get hauteur(): number {
    return this.plan.hauteur
  }

  get tuilesEnMemoire(): number {
    return this.tuiles.taille
  }

  defiler(scrollTop: number): void {
    this.camY = scrollTop
    this.demander()
  }

  majEtat(etat: EtatCarte): void {
    const avant = this.etat
    const etatsAvant = new Map(avant.cases.map((c) => [c.annee, c.etat]))
    for (const c of etat.cases) {
      const e = etatsAvant.get(c.annee)
      if (e !== undefined && e !== c.etat) this.pops.set(c.annee, this.instant())
    }
    if ((avant.roulotte?.annee ?? null) !== (etat.roulotte?.annee ?? null)) this.roulotteT0 = this.instant()
    // L'année ouverte (idée 8) : datée seulement quand l'avatar avance sur une carte déjà montrée,
    // c'est-à-dire au bout d'une marche. Au premier état (ouverture, retour, rechargement) et au
    // recul, ce qu'elle bâtit est déjà fini.
    const ouvre = etat.anneeAvatar !== this.ouverte.annee
    if (ouvre) {
      const avance = avant.cases.length > 0 && etat.anneeAvatar > avant.anneeAvatar
      this.ouverte = { annee: etat.anneeAvatar, t0: avance ? this.instant() : -9 }
    }
    this.etat = etat
    const memesAnnees = avant.cases.length === etat.cases.length && avant.cases.every((c, i) => c.annee === etat.cases[i]!.annee)
    if (!memesAnnees) this.reconstruire()
    else this.tuiles.clear() // les photogrammes allumés du sol dépendent des profondeurs
    if (!this.avatar.marche) this.poserAvatar(etat.anneeAvatar)
    if (ouvre) this.montrerChantier()
    this.demander()
  }

  /**
   * L'année où se tient l'avatar s'ouvre sous les yeux, sans marche (idée 8) : la toute première
   * visite d'un membre au départ du Voyage, que seule la page reconnaît (la mémoire de l'appareil).
   * Rien pour une autre année ; déjà finie quand le visiteur demande moins d'animations.
   */
  ouvrirSousLesYeux(annee: number): void {
    if (annee !== this.etat.anneeAvatar) return
    this.ouverte = { annee, t0: this.instant() }
    this.montrerChantier()
    this.demander()
  }

  reglerCalme(calme: boolean): void {
    this.calme = calme
    // L'horloge s'arrête : une marche ou un adieu en cours n'arriveraient jamais au bout.
    if (calme) this.achever()
    this.demander()
  }

  reglerVisible(visible: boolean): void {
    this.visible = visible
    this.demander()
  }

  pointeur(type: 'bas' | 'bouge' | 'haut' | 'annule' | 'quitte', x: number, y: number, souris: boolean): void {
    if (this.ens.cible) {
      if (type === 'haut') this.quitterEnsemble(y)
      return
    }
    if (type === 'bas') this.geste.baisser(x, y, souris)
    else if (type === 'bouge') this.geste.bouger(x, y, souris)
    else if (type === 'haut') this.geste.lever(x, y)
    else if (type === 'annule') this.geste.annulerAppui()
    else this.geste.quitter()
  }

  /** Deux doigts : `ecart` nul les relâche. Rend vrai quand le geste est pris (la page appelle alors `preventDefault`). */
  pincer(ecart: number | null, yMilieu: number): boolean {
    if (ecart === null) {
      this.pincement = null
      return false
    }
    if (this.pincement === null) {
      this.pincement = ecart
      return false
    }
    const lu = lirePincement(this.pincement, ecart, this.ens.cible === 1)
    if (lu === 'ouvrir') this.entrerEnsemble()
    if (lu === 'fermer') this.quitterEnsemble(yMilieu)
    if (lu) this.pincement = null
    return true
  }

  // --- ce que la page commande -------------------------------------------------------------

  /** Ramène la caméra sur l'avatar ; `instant` à l'ouverture de la carte, sans glisser depuis le haut. */
  allerIci(instant = false): void {
    this.basculerEnsemble(false)
    const p = pointA(this.route, this.avatar.d)
    if (instant || this.calme) this.rappels.defilerVers(cibleCamera(p.y, this.H, this.plan.hauteur))
    else this.suivre = true
    this.demander()
  }

  basculerEnsemble(ouvert: boolean): void {
    if (ouvert) this.entrerEnsemble()
    else this.quitterEnsemble(null)
  }

  /** L'avatar marche jusqu'à la case de `annee`. Instantané quand le visiteur demande moins d'animations. */
  marcher(annee: number): Promise<void> {
    const c = this.plan.cases.find((x) => x.annee === annee)
    if (!c) return Promise.resolve()
    return this.marcherVers(this.route.dWay[c.w] ?? 0, c.y)
  }

  /** L'avatar marche jusqu'à la porte de sa section. */
  passerLaPorte(): Promise<void> {
    const ici = this.plan.cases.find((x) => x.annee === this.etat.anneeAvatar)
    const s = ici ? this.plan.sections[ici.section] : undefined
    if (!s) return Promise.resolve()
    return this.marcherVers((this.route.dWay[s.porte] ?? 0) + 6, this.plan.points[s.porte]![1])
  }

  /**
   * Le monde de `decennie` dit adieu (idée 7, 29 septembre 2026) : la caméra remonte en haut de sa
   * section et la cinématique dure `monde.adieu` secondes. Rien quand le visiteur demande moins
   * d'animations : le carton de l'année suivante porte seul la nouvelle.
   */
  direAdieu(decennie: number): Promise<void> {
    const s = this.plan.sections.find((x) => x.decennie === decennie)
    const duree = this.deps.mondeDe(decennie).adieu
    if (!s || duree <= 0 || this.calme) return Promise.resolve()
    this.adieu?.fin()
    this.suivre = false
    this.camY = s.y0
    this.rappels.defilerVers(s.y0)
    return new Promise((fin) => {
      this.adieu = { decennie, t0: this.t, fin }
      this.demander()
    })
  }

  /** Où se tient la roulotte garée, à l'écran ; nulle quand elle traverse, ou sans roulotte. */
  ecranDeLaRoulotte(): { x: number; y: number } | null {
    const r = this.roulotteGaree()
    return r ? { x: r.x, y: r.y } : null
  }

  claquer(): void {
    this.avatar.claque = this.instant()
    this.demander()
  }

  detruire(): void {
    if (this.raf) this.deps.annulerImage(this.raf)
    this.raf = 0
    this.tuiles.clear()
  }

  /** Une image, à l'instant `maintenant` (ms) : la boucle l'appelle, un test aussi. */
  image(maintenant: number): void {
    const dt = this.dernier ? Math.min(0.05, (maintenant - this.dernier) / 1000) : 0.016
    this.dernier = maintenant
    if (!this.calme) this.t += dt
    this.maj(dt)
    this.signalerAvatar()
    this.dessiner()
  }

  // --- l'intérieur -----------------------------------------------------------------------------

  private reconstruire(): void {
    const annees = this.etat.cases.map((c) => c.annee)
    this.plan = placerCarte(annees, (d, a) => this.deps.mondeDe(d).trace(a))
    this.route = construireRoute(this.plan.points, this.k)
    this.chemin = typeof Path2D === 'function' ? new Path2D() : null
    this.route.pts.forEach((p, i) => (i ? this.chemin?.lineTo(p.x, p.y) : this.chemin?.moveTo(p.x, p.y)))
    this.tuiles.clear()
    if (!this.avatar.marche) this.poserAvatar(this.etat.anneeAvatar)
  }

  /** Dit à la page si l'avatar est à l'écran, quand cela change seulement. */
  private signalerAvatar(): void {
    const y = pointA(this.route, this.avatar.d).y - this.camY
    const vu = y >= HAUT_MASQUE && y <= this.H - BAS_MASQUE
    if (vu === this.avatarVu) return
    this.avatarVu = vu
    this.rappels.avatarVisible(vu)
  }

  /**
   * La date d'un effet borné dans le temps (la case qui pousse, « +1 nacelle », le clap). Quand
   * le visiteur demande moins d'animations, l'horloge est figée : daté d'elle, l'effet resterait
   * à son premier instant pour toujours. Daté de -9 (« jamais »), il est déjà à son état final.
   */
  private instant(): number {
    return this.calme ? -9 : this.t
  }

  private achever(): void {
    // La caméra qui glissait vers un chantier s'y pose d'un coup. L'année ouverte, elle, n'est pas
    // achevée : son chantier reprend là où il en était quand les animations reviennent.
    if (this.visee !== null) {
      this.camY = this.visee
      this.rappels.defilerVers(this.visee)
      this.visee = null
    }
    const m = this.avatar.marche
    if (m) {
      this.avatar.marche = null
      this.avatar.d = m.d1
      this.fogY = this.fogCible
      m.fin()
    }
    const a = this.adieu
    if (a) {
      this.adieu = null
      a.fin()
    }
  }

  /**
   * La roulotte descend depuis l'entrée de la section de son année et se gare 44 px avant la
   * case (maquette : `roulotteCarte`, `dCase(1) - 44`), en sept secondes. Le point 0 de chaque
   * tracé est l'entrée de sa section (`mondes/trace.ts`).
   */
  private roulotteGaree(): { x: number; y: number; dir: number; roule: boolean; posee: boolean; section: number } | null {
    const r = this.etat.roulotte
    if (!r || r.annee === null) return null
    const c = this.plan.cases.find((x) => x.annee === r.annee)
    const premiere = c ? this.plan.cases.find((x) => x.section === c.section) : undefined
    if (!c || !premiere) return null
    const depart = this.route.dWay[premiere.w - 1] ?? 0
    const garage = Math.max(depart, (this.route.dWay[c.w] ?? 0) - 44)
    const u = this.calme ? 1 : clamp((this.t - this.roulotteT0) / 7, 0, 1)
    const d = lerp(depart, garage, ease(u))
    const p = pointA(this.route, d)
    const a = pointA(this.route, Math.max(0, d - 4))
    const b = pointA(this.route, d + 4)
    return { x: p.x, y: p.y - this.camY, dir: b.x >= a.x ? 1 : -1, roule: u < 1 && !this.calme, posee: u >= 1, section: c.section }
  }

  /**
   * Un chantier qui commence hors de l'écran : la caméra va l'y chercher (idée 8 ; maquette :
   * `montrerChantier`, à 60 px des bords, vers `site − hauteur / 2`). Rien pour une année posée
   * bâtie (`t0` à -9) : ni au premier état, ni quand le visiteur demande moins d'animations.
   */
  private montrerChantier(): void {
    const { annee, t0 } = this.ouverte
    if (t0 < 0) return
    const c = this.plan.cases.find((x) => x.annee === annee)
    const s = c ? this.plan.sections[c.section] : undefined
    const site = s ? this.deps.mondeDe(s.decennie).siteDuChantier(annee) : null
    if (!s || site === null) return
    const y = s.y0 + site
    if (y >= this.camY + 60 && y <= this.camY + this.H - 60) return
    // La caméra cesse de suivre l'avatar (au bout d'une marche, elle le rejoint encore) : deux
    // glissements à la fois la laisseraient à mi-chemin.
    this.suivre = false
    this.visee = clamp(y - this.H / 2, 0, Math.max(0, this.plan.hauteur - this.H))
  }

  private poserAvatar(annee: number): void {
    const c = this.plan.cases.find((x) => x.annee === annee)
    if (!c) return
    this.avatar.d = this.route.dWay[c.w] ?? 0
    this.fogY = this.fogCible = c.y + 95
  }

  private marcherVers(d1: number, yCible: number): Promise<void> {
    this.fogCible = yCible + 95
    return new Promise((fin) => {
      if (this.calme) {
        this.avatar.d = d1
        this.fogY = this.fogCible
        this.rappels.defilerVers(cibleCamera(pointA(this.route, d1).y, this.H, this.plan.hauteur))
        this.demander()
        fin()
        return
      }
      const dur = clamp(650 + Math.abs(d1 - this.avatar.d) * 1.5, 700, 2200)
      this.avatar.marche = { d0: this.avatar.d, d1, t0: this.t, dur: dur / 1000, fin }
      this.suivre = true
      this.demander()
    })
  }

  private toucher(x: number, y: number): void {
    this.rappels.finApercu()
    const z = trouverZone(this.zones, x, y)
    if (!z) return
    if (z.id === 'case' && z.data !== null) {
      this.rappels.toucherAnnee(z.data)
      return
    }
    if (z.id === 'clap') {
      this.claquer()
      return
    }
    if (z.id === 'roulotte') {
      this.rappels.roulotte()
      return
    }
    const section = this.plan.sections.findIndex((s) => this.camY + y >= s.y0 && this.camY + y < s.y0 + s.hauteur)
    const s = this.plan.sections[section]
    // Une date s'ouvre aussi quand le visiteur demande moins d'animations : c'est une lecture, pas un décor.
    if (z.id === 'date' && z.data !== null) {
      const d = s ? this.deps.mondeDe(s.decennie).dates[z.data] : undefined
      if (d) {
        this.reactions.set(`date:${z.data}`, this.t)
        this.rappels.date(d)
      }
      return
    }
    if (this.calme) return
    if (s) this.deps.mondeDe(s.decennie).reagir(z.id, z.data, this.vueMonde(section, 1), { x: z.x, y: z.y })
    this.demander()
  }

  /** Le centre de la case de `annee`, à l'écran (l'ancre de l'aperçu). */
  ecranDeLAnnee(annee: number): { x: number; y: number } {
    const c = this.plan.cases.find((x) => x.annee === annee)
    return c ? { x: c.x * this.k, y: c.y - this.camY } : { x: this.W / 2, y: this.H / 2 }
  }

  private entrerEnsemble(): void {
    if (this.ens.cible === 1) return
    this.ens.cible = 1
    if (this.calme) this.ens.q = 1
    this.rappels.finApercu()
    this.rappels.ensemble(true)
    this.demander()
  }

  private quitterEnsemble(yEcran: number | null): void {
    if (this.ens.cible === 0 && this.ens.q === 0) return
    if (yEcran !== null) {
      const y = this.geoEnsemble().versMonde(yEcran)
      this.rappels.defilerVers(clamp(y - this.H * 0.5, 0, Math.max(0, this.plan.hauteur - this.H)))
    }
    this.ens.cible = 0
    if (this.calme) this.ens.q = 0
    this.rappels.ensemble(false)
    this.demander()
  }

  private geoEnsemble() {
    const ici = this.plan.cases.find((c) => c.annee === this.etat.anneeAvatar)
    const sources = this.plan.sections.map((s, i) => ({
      y0: s.y0,
      hauteur: s.hauteur,
      detaillee: !this.deps.mondeDe(s.decennie).aVenir || i === ici?.section,
    }))
    return geoEnsemble(sources, this.H, 132, 64)
  }

  private demander(): void {
    if (!this.raf) this.raf = this.deps.demanderImage((t) => this.boucle(t))
  }

  private boucle(maintenant: number): void {
    this.raf = 0
    this.image(maintenant)
    const anime = !this.calme && this.visible
    if (anime || this.avatar.marche || this.adieu || this.suivre || this.ens.q !== this.ens.cible) this.demander()
    else this.dernier = 0
  }

  private maj(dt: number): void {
    const m = this.avatar.marche
    if (m) {
      const pr = clamp((this.t - m.t0) / m.dur, 0, 1)
      this.avatar.d = lerp(m.d0, m.d1, ease(pr))
      if (pr >= 1) {
        this.avatar.marche = null
        m.fin()
      }
    }
    const a = this.adieu
    if (a && this.t - a.t0 >= this.deps.mondeDe(a.decennie).adieu) {
      this.adieu = null
      a.fin()
    }
    if (this.suivre) {
      const cible = cibleCamera(pointA(this.route, this.avatar.d).y, this.H, this.plan.hauteur)
      const suivant = this.camY + (cible - this.camY) * Math.min(1, dt * 6)
      this.rappels.defilerVers(suivant)
      this.camY = suivant
      if (!this.avatar.marche && Math.abs(cible - suivant) < 1.5) this.suivre = false
    }
    if (this.visee !== null) {
      const suivant = this.camY + (this.visee - this.camY) * Math.min(1, dt * 6)
      this.rappels.defilerVers(suivant)
      this.camY = suivant
      if (Math.abs(this.visee - suivant) < 1.5) this.visee = null
    }
    this.fogY += (this.fogCible - this.fogY) * Math.min(1, dt * 1.6)
    if (this.ens.q !== this.ens.cible) this.ens.q = this.ens.cible > this.ens.q ? Math.min(1, this.ens.q + dt / 0.85) : Math.max(0, this.ens.q - dt / 0.85)
    if (!this.calme) this.particules.maj(dt)
  }

  /** La vue qu'un monde reçoit pour dessiner sa part : son repère, son horloge, ses zones. */
  private vueMonde(section: number, presence: number): VueMonde {
    const s = this.plan.sections[section]!
    const monde = this.deps.mondeDe(s.decennie)
    const ctx = this.ctx!
    const camC = this.camY + this.H / 2
    const ambiance = ambianceDeLHeure(this.deps.heure())
    const bati = this.plan.cases.filter((c) => c.section === section)
    const etats = new Map(this.etat.cases.map((c) => [c.annee, c]))
    const quittee = (annee: number) => !['verrou', 'encours'].includes(etats.get(annee)?.etat ?? 'verrou')
    const quittees = bati.filter((c) => quittee(c.annee))
    const derniere = quittees.reduce<{ rang: number; t0: number } | null>((acc, c) => {
      const t0 = this.pops.get(c.annee)
      return t0 !== undefined && (!acc || t0 > acc.t0) ? { rang: bati.indexOf(c), t0 } : acc
    }, null)
    return {
      ctx,
      W: this.W,
      H: this.H,
      k: this.k,
      t: horlogeDuMonde(this.t, monde.traitement.cadence),
      vivant: !this.calme,
      presence,
      lum: ambiance.lum,
      nuit: ambiance.nuit,
      ecranY: (yLocal, f) => this.H / 2 + (s.y0 + yLocal - camC) * f,
      zone: (id, lx, ly, lr, data, prio = 0) => {
        const m = ctx.getTransform()
        const p = ecranDe(m, this.dpr, lx, ly)
        this.zones.push({ id, x: p.x, y: p.y, r: rayonEcran(m, this.dpr, lr), data: data ?? null, prio })
      },
      feu: (x, y, r, c, force) => {
        const m = ctx.getTransform()
        const p = ecranDe(m, this.dpr, x, y)
        this.feux.push({ x: p.x, y: p.y, r: (r * Math.hypot(m.a, m.b)) / this.dpr, c, w: force ?? ctx.globalAlpha })
      },
      age: (cle) => {
        const t0 = this.reactions.get(cle)
        return t0 === undefined ? 99 : this.t - t0
      },
      marquer: (cle) => void this.reactions.set(cle, this.t),
      etincelles: (x, y, n, c) => (this.calme ? undefined : this.particules.etincelles(x, y, n, c)),
      confettis: (x, y, cs) => (this.calme ? undefined : this.particules.confettis(x, y, cs)),
      fumee: (x, y, n, l) => (this.calme ? undefined : this.particules.fumee(x, y, n, l)),
      image: (url) => this.deps.image(url, () => this.demander()),
      cases: bati.map((c) => ({
        annee: c.annee,
        etat: etats.get(c.annee)?.etat ?? 'verrou',
        profondeur: etats.get(c.annee)?.profondeur ?? 0,
        x: c.x * this.k,
        y: c.y - this.camY,
        pop: this.pops.get(c.annee) ?? -9,
      })),
      bati: { n: quittees.length, nouvelle: derniere?.rang ?? null, t0: derniere?.t0 ?? -9 },
      bouclee: this.etat.tampons.includes(s.decennie),
      roulotte: this.etat.roulotte && this.etat.roulotte.annee === null ? this.etat.roulotte.pseudo : null,
      adieu: this.adieu && this.adieu.decennie === s.decennie ? this.t - this.adieu.t0 : -1,
      ouverte: this.ouverte,
      brume: this.fogY - s.y0,
      // Plan 2d : le moteur ne cache encore aucune bobine.
      bobine: () => undefined,
      bobineTrouvee: () => true,
    }
  }

  private dessiner(): void {
    const g = this.ctx
    if (!g) return
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.zones = []
    this.feux = []
    const camC = this.camY + this.H / 2
    const poids = poidsSections(camC, this.plan.sections)
    const sectionP = this.plan.sections[poids.indexOf(Math.max(...poids))]
    const mondeP = sectionP ? this.deps.mondeDe(sectionP.decennie) : null
    const e = this.ens.q ? ease(this.ens.q) : 0
    if (e < 0.999) {
      g.save()
      if (mondeP?.traitement.cadence) {
        const { dx, dy } = tremblement(this.t, mondeP.traitement.cadence, mondeP.traitement.tremblement, this.calme)
        g.translate(dx, dy)
      }
      this.scene(poids, mondeP)
      g.restore()
    }
    if (e > 0.001) dessinerEnsemble(g, this.W, this.H, e, this.geoEnsemble(), this.plan, this.etat, (d) => this.deps.mondeDe(d))
    this.particules.dessiner(g, true)
  }

  /** L'ordre des couches. Le corail vient en dernier : rien ne le voile ni ne le teinte. */
  private scene(poids: number[], principal: Monde | null): void {
    const g = this.ctx!
    const actifs = this.plan.sections.map((_, i) => i).filter((i) => poids[i]! > 0.01)
    const monde = (i: number) => this.deps.mondeDe(this.plan.sections[i]!.decennie)
    const vues = new Map(actifs.map((i) => [i, this.vueMonde(i, poids[i]!)]))
    const vue = (i: number) => vues.get(i)!
    const ambiance = ambianceDeLHeure(this.deps.heure())
    const mele = (choix: (m: Monde) => Rgb) => melanger(actifs.map((i) => choix(monde(i))), actifs.map((i) => poids[i]!))
    // 1. Le ciel, mêlé entre les mondes présents, selon l'heure (maquette : `scene`, bloc `ING.heure`).
    const { jourF, crep, nuitF } = ambiance
    const haut = mixc(mixc(mixc(mele((m) => m.palette.ciel), mele((m) => m.palette.cielJour), jourF), mele((m) => m.palette.cielCrepuscule), crep * 0.7), [3, 3, 7], nuitF * 0.5)
    const milieu = mixc(mixc(mixc(mele((m) => m.palette.fond), mele((m) => m.palette.fondJour), jourF), mele((m) => m.palette.fondCrepuscule), crep * 0.55), [10, 9, 12], nuitF * 0.45)
    const bas = mixc(mixc(mele((m) => m.palette.bas), mele((m) => m.palette.basJour), jourF), [12, 10, 10], nuitF * 0.4)
    const gr = g.createLinearGradient(0, 0, 0, this.H)
    gr.addColorStop(0, rgba(haut))
    gr.addColorStop(0.55, rgba(milieu))
    gr.addColorStop(1, rgba(bas))
    g.fillStyle = gr
    g.fillRect(0, 0, this.W, this.H)
    // 2. Les plans lointains et moyens de chaque monde présent (le monument est au plan moyen).
    for (const i of actifs) monde(i).dessinerCiel(vue(i))
    for (const i of actifs) monde(i).dessinerLointain(vue(i))
    for (const i of actifs) monde(i).dessinerMoyen(vue(i))
    // 3. Le sol : les tuiles de la route (pré-rendues, bornées par `MAX_TUILES`).
    const i0 = Math.floor(this.camY / TUILE)
    const i1 = Math.floor((this.camY + this.H) / TUILE)
    for (let i = Math.max(0, i0); i <= i1 && i * TUILE < this.plan.hauteur; i++) {
      g.drawImage(this.tuile(i) as unknown as CanvasImageSource, 0, i * TUILE - this.camY, this.W, TUILE)
    }
    this.effets.parcouru(g, this.route, this.avatar.d, this.camY, this.t, !this.calme)
    // 4. Au sol : repères, portes, figurants ; puis les cases et l'avatar.
    for (const i of actifs) {
      const s = this.plan.sections[i]!
      const [px, py] = this.plan.points[s.porte]!
      monde(i).dessinerSol(vue(i), { x: px * this.k, y: py - this.camY })
    }
    const parAnnee = new Map(this.etat.cases.map((c) => [c.annee, c]))
    for (const c of this.plan.cases) {
      const y = c.y - this.camY
      const etat = parAnnee.get(c.annee)
      if (y < -110 || y > this.H + 70 || !etat) continue
      const m = this.deps.mondeDe(this.plan.sections[c.section]!.decennie)
      dessinerCase(g, c.x * this.k, y, etat, m, this.t, !this.calme, (url) => afficheTraitee(url, m.traitement, this.deps, this.affiches, () => this.demander()))
      this.zones.push({ id: 'case', x: c.x * this.k, y: y - 4, r: 34, data: c.annee, prio: 1 })
    }
    const pa = pointA(this.route, this.avatar.d)
    dessinerAvatar(g, pa.x, pa.y - this.camY, this.t - this.avatar.claque, !!this.avatar.marche, !this.calme)
    this.zones.push({ id: 'clap', x: pa.x, y: pa.y - this.camY - 16, r: 22, data: null, prio: 2 })
    this.effets.lumiere(g, pa.x, pa.y - this.camY - 4, this.t, !this.calme)
    // 5. Les plans proches, les particules du monde, la brume de l'avenir.
    for (const i of actifs) monde(i).dessinerProche(vue(i))
    this.particules.dessiner(g, false)
    const brume = this.plan.sections.find((s) => this.fogY >= s.y0 && this.fogY < s.y0 + s.hauteur)
    this.effets.brouillard(g, this.camY, this.fogY, (brume ? this.deps.mondeDe(brume.decennie) : principal)?.palette.brume ?? [40, 38, 36], this.t, !this.calme)
    // La roulotte garée passe au-dessus de la brume : le Voyage suivi peut être loin devant.
    const rg = this.roulotteGaree()
    const roul = this.etat.roulotte
    if (rg && roul) {
      const m = this.deps.mondeDe(this.plan.sections[rg.section]!.decennie)
      const url = imageCommune('roulotte.webp')
      const planche = url ? this.deps.image(url, () => this.demander()) : null
      dessinerRoulotte(g, rg.x, rg.y + 8, rg.dir, rg.roule, this.t, !this.calme, 0.42, roul.pseudo, m.couleur, ambiance.nuit, planche)
      if (rg.posee) dessinerPlaqueRoulotte(g, rg.x, rg.y - 48, `${roul.pseudo} est rendu en ${roul.annee}`, m.couleur)
      this.zones.push({ id: 'roulotte', x: rg.x, y: rg.y - 8, r: 36, data: null, prio: 2 })
    }
    // Ce qu'une année ouverte montre par-dessus la brume (idée 8 : le guichet de 1897, l'écriteau d'un chantier).
    for (const i of actifs) monde(i).dessinerSurLaBrume(vue(i))
    // L'adieu d'un monde, par-dessus tout son décor.
    for (const i of actifs) monde(i).dessinerAdieu(vue(i))
    // 6. Les voiles : la nuit et ses feux, le virage de chaque monde, la palpitation, la vignette, le grain.
    this.effets.nuit(g, this.feux, ambiance)
    for (const i of actifs) {
      const v = monde(i).traitement.virage
      if (!v) continue
      g.fillStyle = rgba(v.couleur, v.alpha * poids[i]!)
      g.fillRect(0, 0, this.W, this.H)
    }
    if (principal) {
      const a = scintillement(this.t, principal.traitement.cadence ?? 16, principal.traitement.scintillement, this.calme)
      if (a > 0) {
        g.fillStyle = `rgba(0,0,0,${a})`
        g.fillRect(0, 0, this.W, this.H)
      }
    }
    this.effets.vignette(g)
    this.effets.grain(g, principal?.traitement.grain ?? 0, this.t, !this.calme)
    // 7. Le corail, en dernier : la jauge et le millésime de l'année en cours — celle que la carte
    // dit `encours`, pas celle où se tient l'avatar (pendant une marche, ce ne sont pas les mêmes).
    // Jamais une année en attente du Voyage suivi : elle se dessine comme fermée, plaque comprise.
    const enCours = this.etat.cases.find((c) => c.etat === 'encours' && !c.attente)
    const place = enCours ? this.plan.cases.find((c) => c.annee === enCours.annee) : undefined
    if (enCours && place) dessinerCorail(g, place.x * this.k, place.y - this.camY, enCours, this.t, !this.calme)
  }

  private tuile(i: number): Toile {
    const deja = this.tuiles.get(i)
    if (deja) return deja
    const toile = this.deps.creerToile(Math.ceil(this.W * this.dpr), TUILE * this.dpr)
    const x = toile.getContext('2d')
    if (x && this.chemin) {
      x.scale(this.dpr, this.dpr)
      x.translate(0, -i * TUILE)
      dessinerSol(x, this.chemin, this.route, this.plan, this.etat, (d) => this.deps.mondeDe(d))
    }
    this.tuiles.set(i, toile)
    return toile
  }
}

/** La moyenne des couleurs, pondérée (les poids des sections présentes somment à 1). */
function melanger(couleurs: readonly Rgb[], poids: readonly number[]): Rgb {
  const total = poids.reduce((a, b) => a + b, 0) || 1
  const somme = [0, 1, 2].map((k) => couleurs.reduce((acc, c, i) => acc + c[k]! * poids[i]!, 0) / total)
  return [Math.round(somme[0]!), Math.round(somme[1]!), Math.round(somme[2]!)]
}
