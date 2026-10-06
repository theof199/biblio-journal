import { clamp, ease, lerp } from './outils'
import { cibleCamera } from './camera'
import type { SectionPlacee } from './placement'
import { auTempo } from '../voyage/tempo'

/**
 * Le roulement de la caméra vers un arrêt d'une section collante (plan 3a), en millisecondes **de
 * base** : `rouler` le joue au tempo (`voyage/tempo.ts`), là et nulle part ailleurs. La même durée
 * quelle que soit la distance.
 */
export const DUREE_DU_ROULEMENT = 600
/**
 * Le défilement est arrêté quand `defiler` s'est tu depuis ce temps, en millisecondes de l'horloge
 * des images. Un seuil de détection, comme ceux du geste (`geste.ts`), pas une animation : il ne
 * suit pas le tempo.
 */
export const REPOS_DU_DEFILEMENT = 150
/** À moins de cet écart d'un arrêt, en px, la caméra y est posée : la page rend un défilement arrondi. */
export const A_L_ARRET = 1.5
/** Le sens d'un passage d'entrée (`direBonjour`) : dans l'ordre de `SceneCollante.entree`, ou retourné. */
export type SensDuPassage = 'endroit' | 'envers'

/** Un temps du passage d'entrée d'une section, en `y` de carte. */
export interface TempsDeCarte {
  y: number
  duree: number
  arret: number
}

/**
 * Ce que le moteur donne au meneur : à lire, jamais à écrire. Tout se relit à chaque appel, rien
 * ne se garde : le plan change à chaque `majEtat` qui change les années, `H` à chaque mesure.
 */
export interface Terrain {
  /** L'horloge du décor, en secondes ; figée quand le visiteur demande moins d'animations. */
  t: () => number
  calme: () => boolean
  /** La hauteur de l'écran. */
  H: () => number
  /** La hauteur de la carte (`PlanCarte.hauteur`). */
  hauteur: () => number
  sections: () => readonly SectionPlacee[]
  /** Vrai quand la carte a au moins une section collante : sans elle, le défilement ne se constate pas. */
  collante: () => boolean
  /** Les arrêts de la section de rang `section`, en `y` de carte ; aucun pour une section ordinaire ou inconnue. */
  arretsDe: (section: number) => number[]
  /** Les temps du passage d'entrée de la section de rang `section`, en `y` de carte. */
  tempsDe: (section: number) => TempsDeCarte[]
  /** La zone des temps de chaque section qui a un passage : du premier temps au dernier, en `y` de carte. */
  zonesDesTemps: () => Array<{ decennie: number; haut: number; bas: number }>
  /** Où en est l'avatar sur la route, en `y` de carte, et s'il marche encore : de quoi le suivre. */
  avatar: () => { y: number; marche: boolean }
  /** Vrai tant que la vue d'ensemble est ouverte, ou s'ouvre : la carte est sous elle, un défilement n'y est le geste de personne. */
  ensemble: () => boolean
  /** Une image de plus est à dessiner. */
  demander: () => void
}

/** Ce que le meneur dit à la page (`Rappels`, `moteur.ts`). */
export interface RappelsDuMeneur {
  /** Le moteur veut la caméra ailleurs : la page pose `scrollTop`, le défilement reste natif. */
  defilerVers: (y: number) => void
  entreeProche?: (decennie: number | null) => void
}

/** La caméra qui roule vers un arrêt. `fin` : la promesse de `marcher` ; nul quand personne n'attend (le rappel, « Tu es ici »). */
interface Roulement {
  y0: number
  y1: number
  /** Où il en est : ce qu'il a posé en dernier. */
  y: number
  t0: number
  dur: number
  fin: (() => void) | null
}

/**
 * Le passage d'entrée qui se joue (`direBonjour`). `cles` : où la caméra doit être, en `y` de carte,
 * à chaque moment charnière, en secondes depuis `t0` : elle tient la pause d'un temps entre deux
 * clés de même `y`, et glisse entre deux clés de `y` différents. `fins` : qui attend sa fin.
 */
interface Passage {
  decennie: number
  t0: number
  cles: Array<{ t: number; y: number }>
  fins: Array<() => void>
}

/**
 * Qui mène la caméra de la carte : `camY` ne s'écrit qu'ici, et la page n'apprend qu'ici où le
 * moteur la veut (`defilerVers`). Cinq meneurs : le défilement natif (`defiler`), l'avatar
 * (`suivre`), un chantier (`visee`), le roulement vers un arrêt, le passage d'entrée. Le moteur
 * commande, le meneur arbitre : un seul glissement à la fois (`prendreLaCamera`).
 */
export class Meneur {
  private y = 0
  private suivre = false
  /** Où la caméra glisse pour montrer un chantier qui commence hors de l'écran (idée 8) ; nulle sinon. */
  private visee: number | null = null
  /** La caméra qui roule vers un arrêt d'une section collante (plan 3a) ; nul sinon. */
  private roulement: Roulement | null = null
  /**
   * Le défilement à constater : `aDater` dit qu'il vient de bouger (la prochaine image le date),
   * `depuis` le moment de l'image qui l'a daté ; nul une fois son arrêt constaté.
   */
  private defilement: { aDater: boolean; depuis: number | null } = { aDater: false, depuis: null }
  /** Au calme, l'arrêt que le geste en cours a posé ; nul hors d'un geste. */
  private pose: number | null = null
  /** Vrai tant que le pointeur est bas ; le navigateur le relève (`pointercancel`) dès qu'il prend le geste pour défiler. */
  private pointeurBas = false
  /** Le nombre de doigts posés sur l'écran, que la page relaie (`doigtsPoses`) : lui survit au défilement natif. */
  private touchers = 0
  /** Le passage d'entrée qui se joue (plan 3a) ; nul sinon. */
  private passage: Passage | null = null
  /** D'où est parti le défilement à constater, en `y` de carte : de quoi dire par quel bord il est entré dans une zone des temps. Nul au repos. */
  private depart: number | null = null
  /** Ce que la page sait de l'entrée à portée de geste (`Rappels.entreeProche`). */
  private entreeDite: number | null = null
  /**
   * Où la sortie de la vue d'ensemble vient de poser la caméra : ce que la page en rend est son
   * écho, pas un geste du membre. Nul dès qu'un défilement mène ailleurs.
   */
  private sortie: number | null = null
  /**
   * Ce que la page doit encore rendre de ce que le meneur lui a demandé, hors du roulement, du
   * passage et de la sortie de la vue d'ensemble, qui ont leur garde : tout `defiler` tombé entre
   * `de` et `a` est un écho, pas un geste. Un intervalle tant que la caméra glisse (elle suit
   * l'avatar, va chercher un chantier), ramené à son dernier point dès qu'elle ne glisse plus ; nul
   * dès qu'un défilement mène ailleurs.
   */
  private attendu: { de: number; a: number } | null = null

  constructor(
    private readonly terrain: Terrain,
    private readonly rappels: RappelsDuMeneur,
  ) {}

  // --- ce que le moteur lit ---------------------------------------------------------------------

  /** Où est la caméra, en `y` de carte. */
  get camY(): number {
    return this.y
  }

  /** Vrai tant que la boucle doit tourner pour la caméra : elle suit l'avatar, roule, joue un passage, ou un défilement attend son repos. */
  get occupe(): boolean {
    return this.suivre || !!this.roulement || !!this.passage || this.defilement.aDater || this.defilement.depuis !== null
  }

  /** Depuis combien de secondes le passage d'entrée de `decennie` se joue ; -1 s'il ne se joue pas (`VueMonde.entree`). */
  ageDuPassage(decennie: number): number {
    return this.passage && this.passage.decennie === decennie ? this.terrain.t() - this.passage.t0 : -1
  }

  // --- ce que le moteur relaie de la page -------------------------------------------------------

  /** La page a défilé : la caméra est à `scrollTop`. */
  defiler(scrollTop: number): void {
    const avant = this.y
    this.y = scrollTop
    this.constaterLeDefilement(avant)
  }

  /**
   * Le pointeur, tel que la page le relaie. Rend vrai quand le passage l'a pris : un toucher pendant
   * le passage le pose à sa fin, et rien d'autre ; le doigt qui se pose, comme celui qui se lève d'un
   * appui d'avant le passage, n'est pas relayé au geste, et n'ouvre pas l'année qui se trouve sous lui.
   */
  pointeur(type: 'bas' | 'bouge' | 'haut' | 'annule' | 'quitte'): boolean {
    if (type === 'bas') {
      this.pointeurBas = true
      this.reprendreLaCamera()
    } else if (type !== 'bouge') this.pointeurBas = false
    if (this.passage && (type === 'bas' || type === 'haut')) {
      this.finirLePassage()
      return true
    }
    return false
  }

  /**
   * Le nombre de doigts posés sur la carte. Tant qu'il en reste un, le meneur ne rappelle ni ne pose
   * la caméra : il combattrait le défilement que le doigt mène. Il reprend au lever du dernier.
   */
  doigtsPoses(nombre: number): void {
    this.touchers = nombre
    if (nombre > 0) this.reprendreLaCamera()
  }

  // --- ce que le moteur commande ----------------------------------------------------------------

  /** La caméra à `y`, d'un coup. */
  poser(y: number): void {
    this.y = y
    this.rappels.defilerVers(y)
  }

  /**
   * La page est priée de défiler à `y`, sans que la caméra y soit écrite : elle n'y sera qu'au
   * `defiler` que la page rendra (« Tu es ici » d'un coup et la marche au calme, hors section collante).
   */
  demanderALaPage(y: number): void {
    this.attendu = { de: y, a: y }
    this.rappels.defilerVers(y)
  }

  /** La caméra suit l'avatar jusqu'à le rejoindre, sa marche finie. */
  suivreLAvatar(): void {
    this.suivre = true
  }

  /** La caméra glisse jusqu'à `y` (un chantier hors de l'écran) : elle cesse de suivre l'avatar, deux glissements à la fois la laisseraient à mi-chemin. */
  viser(y: number): void {
    this.suivre = false
    this.visee = y
  }

  /**
   * Un seul glissement à la fois : qui prend la caméra arrête le roulement et le passage en cours
   * (qui les attendait est libéré), et la caméra cesse de suivre l'avatar comme de viser un chantier.
   */
  prendreLaCamera(): void {
    this.arreterLeRoulement()
    this.arreterLePassage()
    this.suivre = false
    this.visee = null
    // Elle ne glisse plus : de ce qu'elle a dit à la page, seul le dernier point reste à rendre.
    if (this.attendu) this.attendu = { de: this.attendu.a, a: this.attendu.a }
  }

  /**
   * La vue d'ensemble s'ouvre : le défilement qui attendait son repos est oublié. Il ne lancera ni
   * rappel ni passage sous elle, ni à sa fermeture ; et la boucle ne tient plus pour lui.
   */
  ouvrirLEnsemble(): void {
    this.oublierLeDefilement()
  }

  /** Le passage s'arrête où il en est : un autre glissement prend la caméra. Qui l'attendait est libéré. */
  arreterLePassage(): void {
    const p = this.passage
    if (!p) return
    this.passage = null
    for (const fin of p.fins) fin()
  }

  /**
   * La caméra roule jusqu'à l'arrêt `y`, en `DUREE_DU_ROULEMENT` au tempo, et `fin` est rappelé à
   * l'arrivée. D'un coup quand le visiteur demande moins d'animations (l'horloge figée, le
   * roulement n'arriverait jamais), et quand elle y est déjà. Un seul glissement à la fois : celui
   * qui commence arrête les autres.
   */
  rouler(y: number, fin: (() => void) | null): void {
    this.prendreLaCamera()
    if (this.terrain.calme() || Math.abs(y - this.y) <= A_L_ARRET) {
      this.poser(y)
      fin?.()
    } else {
      this.roulement = { y0: this.y, y1: y, y: this.y, t0: this.terrain.t(), dur: auTempo(DUREE_DU_ROULEMENT) / 1000, fin }
    }
    this.terrain.demander()
  }

  /**
   * La sortie de la vue d'ensemble pose la caméra à `y`. Elle prend la caméra, sur toute carte : un
   * seul glissement à la fois, et celle qui suivait l'avatar ou visait un chantier reste où l'on a
   * touché (la marche finit hors champ s'il le faut).
   */
  poserALaSortie(y: number): void {
    this.prendreLaCamera()
    // Sur une carte à section collante, le défilement d'avant n'a plus rien à constater (son
    // départ dirait un geste entré dans une zone des temps, son repos un rappel), et l'écho de la
    // sortie est attendu. Sans section collante, le défilement ne se constate pas : rien à
    // oublier, et un écho attendu que personne ne lèverait.
    if (this.terrain.collante()) {
      this.oublierLeDefilement()
      this.sortie = y
    }
    this.poser(y)
  }

  /**
   * Le passage d'entrée de `decennie` se joue (`MoteurCarte.direBonjour`, qui dit ce qu'il doit à la
   * page) : la caméra posée au premier temps du sens joué, puis menée d'un temps au suivant, chaque
   * durée et chaque pause au tempo (`voyage/tempo.ts`), ici et nulle part ailleurs.
   */
  direBonjour(decennie: number, sens: SensDuPassage): Promise<void> {
    const enCours = this.passage
    if (enCours) return new Promise((fin) => enCours.fins.push(fin))
    const temps = this.terrain.tempsDe(this.terrain.sections().findIndex((s) => s.decennie === decennie))
    if (temps.length === 0) return Promise.resolve()
    // Les temps dans l'ordre joué, chacun avec la durée du segment qui y mène : à l'envers, celle
    // que la liste donne au temps d'où l'on vient (la durée appartient au segment, pas au sens).
    const joues = sens === 'envers' ? temps.map((x, i) => ({ ...x, duree: temps[i + 1]?.duree ?? 0 })).reverse() : temps
    // Aucun passage ne joue ici (plus haut) : il n'y en a pas à arrêter.
    this.prendreLaCamera()
    // Le défilement qui a mené ici n'a plus rien à constater : le passage commande la caméra.
    this.oublierLeDefilement()
    if (this.terrain.calme()) {
      const fin = joues[joues.length - 1]!.y
      this.poser(fin)
      // Aucun passage ne joue, aucune garde ne tient : l'écho de cette pose reste à rendre, comme à `finirLePassage`.
      this.attendu = { de: fin, a: fin }
      this.terrain.demander()
      return Promise.resolve()
    }
    this.poser(joues[0]!.y)
    const cles: Passage['cles'] = []
    let t = 0
    joues.forEach((x, i) => {
      if (i > 0) t += auTempo(x.duree) / 1000
      cles.push({ t, y: x.y })
      t += auTempo(x.arret) / 1000
      cles.push({ t, y: x.y })
    })
    return new Promise((fin) => {
      this.passage = { decennie, t0: this.terrain.t(), cles, fins: [fin] }
      this.terrain.demander()
    })
  }

  /**
   * L'horloge s'arrête (le visiteur demande moins d'animations) : tout ce qui glissait arrive d'un
   * coup, et chaque promesse se résout. Le suivi de l'avatar, lui, n'est pas achevé ici.
   */
  achever(): void {
    // La caméra qui glissait vers un chantier s'y pose d'un coup. L'année ouverte, elle, n'est pas
    // achevée : son chantier reprend là où il en était quand les animations reviennent.
    if (this.visee !== null) {
      this.y = this.visee
      this.rappels.defilerVers(this.visee)
      this.visee = null
    }
    // La caméra qui roulait vers un arrêt s'y pose d'un coup, et qui l'attendait est libéré.
    const r = this.roulement
    if (r) {
      this.roulement = null
      this.poser(r.y1)
      r.fin?.()
    }
    // Le passage d'entrée est posé à sa fin, et qui l'attendait est libéré.
    this.finirLePassage()
  }

  // --- à chaque image ---------------------------------------------------------------------------

  /**
   * Le défilement s'est arrêté : `defiler` s'est tu depuis `REPOS_DU_DEFILEMENT`, et aucun doigt
   * n'est posé (le rappel le combattrait). La caméra laissée dans une section collante, hors d'un
   * arrêt, revient au plus proche en roulant ; au calme, elle se pose d'un coup à celui
   * que le geste a choisi. Laissée dans une zone des temps où le geste est entré par un bord, elle
   * joue le passage d'entrée, sous la même garde : jamais sous un doigt posé. Les deux ne se
   * disputent pas la même fin de défilement : le passage passe d'abord, et le rappel ne vaut pas
   * avant le premier arrêt.
   */
  constaterLeRepos(maintenant: number): void {
    const d = this.defilement
    if (d.aDater) {
      d.aDater = false
      d.depuis = maintenant
    }
    if (d.depuis === null || maintenant - d.depuis < REPOS_DU_DEFILEMENT || this.doigt) return
    d.depuis = null
    const pose = this.pose
    this.pose = null
    const depart = this.depart
    this.depart = null
    const entree = depart === null ? null : this.entreeAuGeste(depart)
    if (entree) {
      void this.direBonjour(entree.decennie, entree.sens)
      return
    }
    const arrets = this.arretsAutour()
    if (!arrets || this.roulement) return
    const proche = arrets.reduce((a, b) => (Math.abs(b - this.y) < Math.abs(a - this.y) ? b : a))
    this.rouler(pose ?? proche, null)
  }

  /** Tout ce qui mène la caméra avance avec l'horloge : le passage, le roulement, le suivi de l'avatar, la visée d'un chantier. */
  avancer(dt: number): void {
    // Un seul glissement à la fois : celui qui a commencé après le roulement ou le passage l'emporte.
    if (this.suivre || this.visee !== null) {
      this.arreterLeRoulement()
      this.arreterLePassage()
    }
    const t = this.terrain.t()
    const p = this.passage
    if (p) {
      const ecoule = t - p.t0
      const i = p.cles.findIndex((c) => c.t > ecoule)
      if (i < 0) this.finirLePassage()
      else {
        const avant = p.cles[i - 1]!
        const apres = p.cles[i]!
        const y = avant.y === apres.y ? avant.y : lerp(avant.y, apres.y, ease((ecoule - avant.t) / (apres.t - avant.t)))
        // Pendant une pause, la caméra y est déjà : rien à redire à la page.
        if (y !== this.y) this.poser(y)
      }
    }
    const r = this.roulement
    if (r) {
      const pr = clamp((t - r.t0) / r.dur, 0, 1)
      r.y = pr >= 1 ? r.y1 : lerp(r.y0, r.y1, ease(pr))
      this.poser(r.y)
      if (pr >= 1) {
        this.roulement = null
        r.fin?.()
      }
    }
    if (this.suivre) {
      const avatar = this.terrain.avatar()
      const cible = cibleCamera(avatar.y, this.terrain.H(), this.terrain.hauteur())
      const suivant = this.y + (cible - this.y) * Math.min(1, dt * 6)
      this.attendu = { de: this.attendu?.de ?? this.y, a: suivant }
      this.rappels.defilerVers(suivant)
      this.y = suivant
      if (!avatar.marche && Math.abs(cible - suivant) < 1.5) {
        this.suivre = false
        this.attendu = { de: suivant, a: suivant }
      }
    }
    if (this.visee !== null) {
      const suivant = this.y + (this.visee - this.y) * Math.min(1, dt * 6)
      this.attendu = { de: this.attendu?.de ?? this.y, a: suivant }
      this.rappels.defilerVers(suivant)
      this.y = suivant
      if (Math.abs(this.visee - suivant) < 1.5) {
        this.visee = null
        this.attendu = { de: suivant, a: suivant }
      }
    }
  }

  /**
   * Dit à la page la décennie dont l'entrée est à portée de geste, quand cela change seulement : la
   * caméra au-dessus du premier temps d'une section collante, à un écran au plus (elle est donc au
   * bas de la section qui précède), ou posée à ce temps. Nulle tant qu'un passage se joue.
   */
  signalerEntree(): void {
    if (!this.terrain.collante()) return
    const H = this.terrain.H()
    const proche = this.passage ? undefined : this.terrain.zonesDesTemps().find((z) => this.y >= z.haut - H && this.y <= z.haut + A_L_ARRET)
    const decennie = proche?.decennie ?? null
    if (decennie === this.entreeDite) return
    this.entreeDite = decennie
    this.rappels.entreeProche?.(decennie)
  }

  // --- l'intérieur ------------------------------------------------------------------------------

  /**
   * Le passage que le geste lance : la caméra est laissée dans une zone des temps, entre ses deux
   * bords, par un défilement parti de `depart`, au-dessus (il est entré par le haut : à l'endroit)
   * ou au-dessous (par le bas : à l'envers). Nul pour un défilement parti dans la zone.
   */
  private entreeAuGeste(depart: number): { decennie: number; sens: SensDuPassage } | null {
    for (const z of this.terrain.zonesDesTemps()) {
      if (this.y <= z.haut + A_L_ARRET || this.y >= z.bas - A_L_ARRET) continue
      if (depart <= z.haut + A_L_ARRET) return { decennie: z.decennie, sens: 'endroit' }
      if (depart >= z.bas - A_L_ARRET) return { decennie: z.decennie, sens: 'envers' }
    }
    return null
  }

  /** Le passage est posé à sa fin, d'un coup : son dernier temps joué. Qui l'attendait est libéré. */
  private finirLePassage(): void {
    const p = this.passage
    if (!p) return
    const fin = p.cles[p.cles.length - 1]!.y
    this.poser(fin)
    // Le passage fini, sa garde tombe : l'écho de sa dernière pose reste à rendre.
    this.attendu = { de: fin, a: fin }
    this.arreterLePassage()
    this.terrain.demander()
  }

  /** Vrai tant qu'un doigt est posé, d'où que vienne l'information : le pointeur, ou les touchers que la page relaie. */
  private get doigt(): boolean {
    return this.pointeurBas || this.touchers > 0
  }

  /** Le doigt qui se pose reprend la caméra au rappel et à « Tu es ici » ; l'arrêt du défilement se constatera au lever. */
  private reprendreLaCamera(): void {
    if (!this.roulement || this.roulement.fin) return
    this.arreterLeRoulement()
    this.defilement.aDater = true
  }

  /**
   * Les arrêts de la section collante où la caméra est laissée sans être posée à l'un d'eux : du
   * premier arrêt au bas de la section, sous le dernier arrêt compris. Nul avant le premier arrêt
   * (la zone du passage d'entrée), dans une section ordinaire, et à un arrêt.
   */
  private arretsAutour(): number[] | null {
    const section = this.terrain.sections().findIndex((s) => this.y >= s.y0 && this.y < s.y0 + s.hauteur)
    const arrets = this.terrain.arretsDe(section)
    if (arrets.length === 0 || this.y <= arrets[0]!) return null
    return arrets.some((a) => Math.abs(a - this.y) <= A_L_ARRET) ? null : arrets
  }

  /** Le défilement en cours n'a plus rien à constater : ni son départ, ni son repos, ni l'arrêt qu'il a choisi au calme. */
  private oublierLeDefilement(): void {
    this.defilement = { aDater: false, depuis: null }
    this.pose = null
    this.depart = null
  }

  /** Le roulement en cours s'arrête où il est ; qui l'attendait est libéré. */
  private arreterLeRoulement(): void {
    const r = this.roulement
    if (!r) return
    this.roulement = null
    r.fin?.()
  }

  /**
   * `defiler` vient de bouger la caméra depuis `avant`. Le meneur n'a pas d'autre signal : l'arrêt
   * du défilement se constate aux images (`constaterLeRepos`). Au calme, c'est ici que le geste
   * pose son arrêt, une fois : les défilements qui le suivent n'en posent pas d'autre.
   */
  private constaterLeDefilement(avant: number): void {
    // Sans section collante sur la carte, il n'y a rien à constater : la boucle ne tient pas pour lui.
    if (!this.terrain.collante()) return
    // La vue d'ensemble ouverte, la carte est sous elle : ce défilement n'est le geste de personne.
    if (this.terrain.ensemble()) return
    // Le passage commande la caméra : ce que la page rend n'est que l'écho de ce qu'il pose, et un
    // défilement du membre ne le détourne pas (un toucher, lui, le pose à sa fin).
    if (this.passage) return
    // La sortie de la vue d'ensemble a posé la caméra : la page le rend, à l'arrondi près. Cet écho
    // n'est le départ d'aucun geste : il ne lance ni passage d'entrée, ni rappel.
    if (this.sortie !== null) {
      if (Math.abs(this.y - this.sortie) <= A_L_ARRET) return
      this.sortie = null
    }
    // Ce que le meneur a demandé à la page sans roulement ni passage (« Tu es ici » d'un coup, la
    // marche au calme, l'avatar suivi, un chantier visé, la fin d'un passage) : son écho n'est le
    // départ d'aucun geste non plus.
    const e = this.attendu
    if (e) {
      if (this.y >= Math.min(e.de, e.a) - A_L_ARRET && this.y <= Math.max(e.de, e.a) + A_L_ARRET) return
      this.attendu = null
    }
    const r = this.roulement
    if (r) {
      // La page rend ce que le roulement a posé, tôt ou tard : tout ce qui tombe entre son départ
      // et là où il en est est un écho, pas un geste. Un vrai geste reprend la caméra au rappel et
      // à « Tu es ici » ; il ne détourne pas la marche qu'on attend.
      const echo = this.y >= Math.min(r.y0, r.y) - A_L_ARRET && this.y <= Math.max(r.y0, r.y) + A_L_ARRET
      if (r.fin || echo) return
      this.arreterLeRoulement()
    }
    this.defilement.aDater = true
    if (this.depart === null) this.depart = avant
    if (!this.terrain.calme() || this.pose !== null) return
    const arrets = this.arretsAutour()
    if (!arrets) return
    // L'arrêt suivant dans le sens du geste : le dernier que ce défilement a franchi, sinon le premier devant lui.
    const descend = this.y > avant
    const devant = descend ? arrets.filter((a) => a > avant + A_L_ARRET) : arrets.filter((a) => a < avant - A_L_ARRET).reverse()
    const franchis = devant.filter((a) => (descend ? a < this.y : a > this.y))
    this.pose = franchis[franchis.length - 1] ?? devant[0] ?? null
    // Sous un doigt posé, l'arrêt est choisi mais pas encore posé : il le sera au repos, le doigt levé.
    if (this.pose !== null && !this.doigt) this.poser(this.pose)
  }
}
