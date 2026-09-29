import type { Toile } from '../moteur'
import type { Route } from '../route'
import type { Rgb } from '../outils'

export interface Feu {
  x: number
  y: number
  r: number
  c: string
  w: number
}

/**
 * Les effets communs à tous les mondes (maquette : « Pré-rendus », « Lumière, brouillard,
 * grain », « L'heure, la nuit, la couleur »). Les pré-rendus (vignette, grain, halos, nuages) se
 * refont à chaque mesure, par `creerToile` : jamais de lecture de pixels hors d'une toile qu'ils
 * ont eux-mêmes remplie.
 */
export class Effets {
  private W = 390
  private H = 700
  constructor(private readonly creerToile: (w: number, h: number) => Toile) {}

  mesurer(W: number, H: number, dpr: number): void {
    this.W = W
    this.H = H
    void dpr
    void this.creerToile
  }
  /** Le pointillé doré qui coule sur la route déjà parcourue (maquette : `scene`, bloc `ING.route`). */
  parcouru(g: CanvasRenderingContext2D, route: Route, d: number, camY: number, t: number, vivant: boolean): void {
    void route
    void d
    void camY
    void t
    void vivant
    void g
  }
  /** Le faisceau du projecteur sur l'avatar, sa poussière (maquette : `lumiere`). */
  lumiere(g: CanvasRenderingContext2D, ax: number, ay: number, t: number, vivant: boolean): void {
    void g
    void ax
    void ay
    void t
    void vivant
  }
  /** L'avenir dans la brume, qui se lève à l'approche de l'avatar (maquette : `brouillard`). */
  brouillard(g: CanvasRenderingContext2D, camY: number, fogY: number, brume: Rgb, t: number, vivant: boolean): void {
    void g
    void camY
    void fogY
    void brume
    void t
    void vivant
  }
  /** La nuit : le voile bleu, puis les halos des feux (maquette : `nuitPasse`). */
  nuit(g: CanvasRenderingContext2D, feux: readonly Feu[], ambiance: { nuitF: number; jourF: number; crep: number }): void {
    void feux
    if (ambiance.nuitF > 0.01) {
      g.fillStyle = `rgba(4,5,14,${0.46 * ambiance.nuitF})`
      g.fillRect(0, 0, this.W, this.H)
    }
  }
  vignette(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(6,4,3,.4)'
    g.fillRect(0, 0, this.W, this.H)
  }
  grain(g: CanvasRenderingContext2D, opacite: number, t: number, vivant: boolean): void {
    void opacite
    void t
    void vivant
    void g
  }
}
