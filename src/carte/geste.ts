/**
 * Le toucher de la carte, sans DOM : ce que la maquette faisait dans ses écouteurs `pointer*`
 * (« Toucher, survol, pincement »), rendu testable. Le moteur relaie les événements et fournit
 * l'horloge, les minuteries et la zone sous le doigt.
 *
 * - un toucher bref (moins de 650 ms, moins de 10 px) est un **toucher** ;
 * - un appui de 460 ms sur une case, sans bouger, est un **appui long** (l'aperçu) ;
 * - à la souris, un survol de 520 ms sur une case vaut appui long ;
 * - bouger de plus de 10 px annule tout : c'est un défilement, ou un **glissement** ;
 * - le premier mouvement qui passe 10 px décide, une fois pour cet appui : plus large que haut,
 *   c'est un glissement (`debut`, `suite` à chaque mouvement, `fin` au lever comme à l'annulation),
 *   sinon un défilement, que le navigateur mène et dont rien n'est dit. Un appui long déjà parti
 *   (l'aperçu est ouvert) ne devient pas un glissement.
 */
export const APPUI_LONG_MS = 460
export const SURVOL_MS = 520
export const TOUCHER_MAX_MS = 650
export const BOUGE_PX = 10

export type Signal =
  | { type: 'toucher'; x: number; y: number }
  | { type: 'appuiLong'; annee: number }
  | { type: 'finSurvol' }
  /** En px de l'écran : `x`, `y` où est le doigt (à la `fin`, où il était au dernier mouvement ou au lever), `x0`, `y0` où il s'est posé. */
  | { type: 'glisse'; phase: PhaseDeGlisse; x: number; y: number; x0: number; y0: number }

export type PhaseDeGlisse = 'debut' | 'suite' | 'fin'

export interface Horloge {
  maintenant: () => number
  programmer: (fn: () => void, ms: number) => unknown
  annuler: (jeton: unknown) => void
}

export class Geste {
  /** `glisse` : nul hors d'un glissement, sinon où le doigt était à son dernier mouvement (une annulation n'a pas de point). */
  private appui: { x: number; y: number; t0: number; long: boolean; bouge: boolean; glisse: { x: number; y: number } | null; jeton: unknown } | null = null
  private survol: { annee: number | null; jeton: unknown } = { annee: null, jeton: null }

  constructor(
    private readonly horloge: Horloge,
    /** L'année de la case sous ce point, nulle hors d'une case. */
    private readonly caseEn: (x: number, y: number) => number | null,
    private readonly emettre: (s: Signal) => void,
  ) {}

  baisser(x: number, y: number, souris: boolean): void {
    this.annulerAppui()
    const appui = { x, y, t0: this.horloge.maintenant(), long: false, bouge: false, glisse: null as { x: number; y: number } | null, jeton: null as unknown }
    this.appui = appui
    const annee = souris ? null : this.caseEn(x, y)
    if (annee !== null) {
      // Une seule garde : la minuterie est annulée au lever, au défilement et au prochain appui.
      appui.jeton = this.horloge.programmer(() => {
        appui.long = true
        this.emettre({ type: 'appuiLong', annee })
      }, APPUI_LONG_MS)
    }
  }

  bouger(x: number, y: number, souris: boolean): void {
    const a = this.appui
    if (a?.glisse) {
      a.glisse = { x, y }
      this.glisser('suite', a.x, a.y, x, y)
    } else if (a && !a.bouge && Math.hypot(x - a.x, y - a.y) > BOUGE_PX) {
      // La décision se prend ici et nulle part ailleurs : `bouge` posé, cette branche ne revient pas.
      a.bouge = true
      this.horloge.annuler(a.jeton)
      if (!a.long && Math.abs(x - a.x) > Math.abs(y - a.y)) {
        a.glisse = { x, y }
        this.glisser('debut', a.x, a.y, x, y)
      }
    }
    if (souris) this.survoler(x, y)
  }

  lever(x: number, y: number): void {
    const a = this.appui
    if (!a) return
    this.appui = null
    this.horloge.annuler(a.jeton)
    if (a.glisse) this.glisser('fin', a.x, a.y, x, y)
    if (a.long || a.bouge || this.horloge.maintenant() - a.t0 > TOUCHER_MAX_MS) return
    this.emettre({ type: 'toucher', x, y })
  }

  /** `pointercancel` : le navigateur a pris le geste (défilement natif). Un glissement en cours y finit : il ne reste jamais ouvert. */
  annulerAppui(): void {
    const a = this.appui
    if (!a) return
    this.appui = null
    this.horloge.annuler(a.jeton)
    if (a.glisse) this.glisser('fin', a.x, a.y, a.glisse.x, a.glisse.y)
  }

  private glisser(phase: PhaseDeGlisse, x0: number, y0: number, x: number, y: number): void {
    this.emettre({ type: 'glisse', phase, x, y, x0, y0 })
  }

  /**
   * `pointerleave` ou défilement : l'aperçu tenu par le survol se referme. Un glissement ouvert y
   * finit aussi : la toile ne capture pas le pointeur, et le bouton de la souris relâché dehors n'y
   * arrive jamais ; sans cela la souris revenue glisserait sans bouton. Un appui qui n'est pas un
   * glissement reste tenu.
   */
  quitter(): void {
    if (this.appui?.glisse) this.annulerAppui()
    this.horloge.annuler(this.survol.jeton)
    if (this.survol.annee !== null) this.emettre({ type: 'finSurvol' })
    this.survol = { annee: null, jeton: null }
  }

  private survoler(x: number, y: number): void {
    const annee = this.caseEn(x, y)
    if (annee === this.survol.annee) return
    this.horloge.annuler(this.survol.jeton)
    if (this.survol.annee !== null && annee === null) this.emettre({ type: 'finSurvol' })
    this.survol = {
      annee,
      jeton: annee === null ? null : this.horloge.programmer(() => this.emettre({ type: 'appuiLong', annee }), SURVOL_MS),
    }
  }
}

/** Le pincement (maquette : `touchmove` à deux doigts) : resserrer ouvre la vue d'ensemble, écarter la referme. */
export function lirePincement(ecartInitial: number, ecart: number, ensembleOuvert: boolean): 'ouvrir' | 'fermer' | null {
  const r = ecart / ecartInitial
  if (r < 0.72 && !ensembleOuvert) return 'ouvrir'
  if (r > 1.35 && ensembleOuvert) return 'fermer'
  return null
}
