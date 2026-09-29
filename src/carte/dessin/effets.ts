import type { Toile } from '../moteur'
import { pointA, type Route } from '../route'
import { alea, clamp, lerp, rgba, TAU, hash, type Rgb } from '../outils'

export interface Feu {
  x: number
  y: number
  r: number
  c: string
  w: number
}

/** La poussière du faisceau du projecteur (maquette : `POUSSIERE`), tirée une fois pour toutes. */
const POUSSIERE: ReadonlyArray<{ u: number; v: number; p: number; s: number; r: number }> = Array.from({ length: 30 }, (_, i) => {
  const rng = alea(i * 31 + 9)
  return { u: 0.15 + rng() * 0.85, v: rng() * 2 - 1, p: rng() * TAU, s: 0.3 + rng() * 0.8, r: 0.6 + rng() * 1.3 }
})
/** Les couleurs des halos de nuit, par clé (maquette : `HALO_COUL`). */
const HALO_COUL: Record<string, Rgb> = {
  or: [246, 208, 130],
  orange: [238, 140, 80],
  creme: [245, 232, 205],
  froid: [214, 224, 240],
  rouge: [255, 96, 90],
  bleu: [100, 160, 255],
  rose: [255, 120, 200],
}

/**
 * Les effets communs à tous les mondes (maquette : « Pré-rendus », « Lumière, brouillard,
 * grain », « L'heure, la nuit, la couleur »). Les pré-rendus (grain) se refont à chaque mesure,
 * par `creerToile` : jamais de lecture de pixels hors d'une toile qu'ils ont eux-mêmes remplie.
 */
export class Effets {
  private W = 390
  private H = 700
  /** Trois motifs de grain de 128 px, refaits à chaque mesure (maquette : `grainsDe`). */
  private grains: Toile[] = []
  constructor(private readonly creerToile: (w: number, h: number) => Toile) {}

  mesurer(W: number, H: number, dpr: number): void {
    this.W = W
    this.H = H
    void dpr
    this.grains = Array.from({ length: 3 }, (_, n) => this.motifGrain(40 + n))
  }

  /** Un motif de grain, écrit pixel par pixel (Park-Miller, identique à la maquette) : il n'en lit aucun. */
  private motifGrain(graine: number): Toile {
    const toile = this.creerToile(128, 128)
    const ctx = toile.getContext('2d')
    if (!ctx) return toile
    const im = ctx.createImageData(128, 128)
    let s = graine
    for (let p = 0; p < im.data.length; p += 4) {
      s = (s * 16807) % 2147483647
      const r1 = s / 2147483647
      s = (s * 16807) % 2147483647
      const r2 = s / 2147483647
      const b = r1 > 0.5 ? 255 : 0
      im.data[p] = b
      im.data[p + 1] = b
      im.data[p + 2] = b
      im.data[p + 3] = r2 < 0.55 ? 17 : 0
    }
    ctx.putImageData(im, 0, 0)
    return toile
  }

  /** Le pointillé doré qui coule sur la route déjà parcourue (maquette : `scene`, bloc `ING.route`). */
  parcouru(g: CanvasRenderingContext2D, route: Route, d: number, camY: number, t: number, vivant: boolean): void {
    if (typeof Path2D !== 'function' || route.pts.length === 0) return
    const chemin = new Path2D()
    const premier = route.pts[0]!
    chemin.moveTo(premier.x, premier.y - camY)
    for (const q of route.pts) {
      if (q.d > d) break
      chemin.lineTo(q.x, q.y - camY)
    }
    const e = pointA(route, d)
    chemin.lineTo(e.x, e.y - camY)
    g.save()
    g.lineJoin = 'round'
    g.globalCompositeOperation = 'lighter'
    g.strokeStyle = 'rgba(230,185,74,.1)'
    g.lineWidth = 16
    g.stroke(chemin)
    g.globalCompositeOperation = 'source-over'
    g.setLineDash([0.1, 13])
    g.lineDashOffset = vivant ? -t * 16 : 0
    g.lineCap = 'round'
    g.strokeStyle = '#F2CB6A'
    g.lineWidth = 4.5
    g.stroke(chemin)
    g.setLineDash([])
    g.lineCap = 'butt'
    g.restore()
  }
  /** Le faisceau du projecteur sur l'avatar, sa poussière (maquette : `lumiere`) — commun à tous les mondes. */
  lumiere(g: CanvasRenderingContext2D, ax: number, ay: number, t: number, vivant: boolean): void {
    const sx = ax + 160
    const sy = ay - 380
    g.save()
    g.globalCompositeOperation = 'lighter'
    const re = vivant ? 1 + 0.06 * Math.sin(t * 1.1) : 1
    const fx = g.createLinearGradient(sx, sy, ax, ay)
    fx.addColorStop(0, `rgba(255,236,200,${0.2 * re})`)
    fx.addColorStop(1, `rgba(255,236,200,${0.07 * re})`)
    g.fillStyle = fx
    g.beginPath()
    ;[
      [sx - 5, sy],
      [sx + 5, sy],
      [ax + 50, ay + 12],
      [ax - 50, ay + 4],
    ].forEach(([px, py], i) => (i ? g.lineTo(px!, py!) : g.moveTo(px!, py!)))
    g.closePath()
    g.fill()
    g.save()
    g.translate(ax, ay + 6)
    g.scale(1, 0.42)
    const fl = g.createRadialGradient(0, 0, 4, 0, 0, 78)
    fl.addColorStop(0, `rgba(255,230,190,${0.3 * re})`)
    fl.addColorStop(1, 'rgba(255,230,190,0)')
    g.fillStyle = fl
    g.beginPath()
    g.arc(0, 0, 78, 0, TAU)
    g.fill()
    g.restore()
    for (const d of POUSSIERE) {
      const u = clamp(d.u + (vivant ? 0.05 * Math.sin(t * d.s + d.p) : 0), 0, 1)
      const v = d.v + (vivant ? 0.12 * Math.sin(t * d.s * 1.3 + d.p * 2) : 0)
      const px = lerp(sx, ax + v * 48, u)
      const py = lerp(sy, ay + 8, u)
      const a = (vivant ? 0.35 + 0.35 * Math.sin(t * 2.2 * d.s + d.p) : 0.5) * (1 - Math.abs(v) * 0.6)
      g.fillStyle = `rgba(255,242,218,${Math.max(0, a)})`
      g.beginPath()
      g.arc(px, py, d.r, 0, TAU)
      g.fill()
    }
    g.restore()
  }
  /** L'avenir dans la brume, qui se lève à l'approche de l'avatar (maquette : `brume`). */
  brouillard(g: CanvasRenderingContext2D, camY: number, fogY: number, brume: Rgb, t: number, vivant: boolean): void {
    const top = fogY - camY
    if (top > this.H + 30) return
    // Le dégradé de la maquette : de 30 px au-dessus du bord jusqu'à 180 px sous lui, à 0,8 au-delà.
    const gr = g.createLinearGradient(0, top - 30, 0, top + 180)
    gr.addColorStop(0, rgba(brume, 0))
    gr.addColorStop(0.35, rgba(brume, 0.55))
    gr.addColorStop(1, rgba(brume, 0.8))
    g.fillStyle = gr
    g.fillRect(-8, top - 30, this.W + 16, this.H - top + 40)
    for (let j = 0; j < 4; j++) {
      const x = (hash(j * 3.3) * 1.2 - 0.1) * this.W + (vivant ? Math.sin(t * 0.15 + j * 2) * 30 : 0)
      const y = top + 24 + j * 34
      g.save()
      g.translate(x, y)
      g.scale(2.2, 1)
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 60)
      r.addColorStop(0, 'rgba(216,204,182,.12)')
      r.addColorStop(1, 'rgba(216,204,182,0)')
      g.fillStyle = r
      g.beginPath()
      g.arc(0, 0, 60, 0, TAU)
      g.fill()
      g.restore()
    }
  }
  /** La nuit : le voile bleu, puis les halos des feux ; le jour, un voile clair (maquette : `nuitPasse`). */
  nuit(g: CanvasRenderingContext2D, feux: readonly Feu[], ambiance: { nuitF: number; jourF: number; crep: number }): void {
    if (ambiance.nuitF > 0.01) {
      g.fillStyle = `rgba(4,5,14,${0.46 * ambiance.nuitF})`
      g.fillRect(0, 0, this.W, this.H)
    }
    const force = ambiance.nuitF * 1.05 + ambiance.crep * 0.35 * (1 - ambiance.nuitF)
    if (force > 0.02) {
      g.save()
      g.globalCompositeOperation = 'lighter'
      for (const f of feux) {
        const a = Math.min(1, f.w * force)
        if (a < 0.02) continue
        const c = HALO_COUL[f.c] ?? HALO_COUL.or!
        const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r)
        gr.addColorStop(0, rgba(c, a * 0.62))
        gr.addColorStop(0.3, rgba(c, a * 0.24))
        gr.addColorStop(1, rgba(c, 0))
        g.fillStyle = gr
        g.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2)
      }
      g.restore()
    }
    if (ambiance.jourF > 0.01) {
      g.save()
      g.globalCompositeOperation = 'screen'
      g.fillStyle = `rgba(255,238,210,${0.09 * ambiance.jourF})`
      g.fillRect(0, 0, this.W, this.H)
      g.restore()
    }
  }
  /** La vignette (maquette : `vignette`), sans son voile qui palpite : au-delà du seuil de WCAG (voir la relecture du 29 septembre). */
  vignette(g: CanvasRenderingContext2D): void {
    const vg = g.createRadialGradient(this.W / 2, this.H * 0.5, Math.min(this.W, this.H) * 0.34, this.W / 2, this.H * 0.5, Math.hypot(this.W, this.H) * 0.6)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(0.7, 'rgba(6,4,3,.3)')
    vg.addColorStop(1, 'rgba(6,4,3,.72)')
    g.fillStyle = vg
    g.fillRect(0, 0, this.W, this.H)
  }
  /** Le grain, à seize images par seconde (maquette : `pellicule`, `grainsDe`) ; figé quand `vivant` est faux. */
  grain(g: CanvasRenderingContext2D, opacite: number, t: number, vivant: boolean): void {
    if (opacite <= 0 || this.grains.length === 0) return
    const image = vivant ? Math.floor(t * 16) : 0
    const motif = this.grains[image % this.grains.length]!
    const ox = vivant ? Math.floor(hash(image * 0.7) * 128) : 0
    const oy = vivant ? Math.floor(hash(image * 1.3) * 128) : 0
    g.save()
    g.translate(-ox, -oy)
    const pattern = g.createPattern(motif as unknown as CanvasImageSource, 'repeat')
    if (pattern) {
      g.globalAlpha = opacite
      g.fillStyle = pattern
      g.fillRect(ox - 8, oy - 8, this.W + 16, this.H + 16)
    }
    g.restore()
    if (!vivant) return
    for (let i = 0; i < 2; i++) {
      const per = 2.1 + i * 1.3
      const cyc = Math.floor(t / per)
      if (hash(cyc * 9.1 + i) < 0.6) {
        const x = hash(cyc * 3.7 + i * 11) * this.W + (hash(image * 0.3 + i) - 0.5) * 2
        g.fillStyle = `rgba(242,232,213,${0.09 + 0.08 * hash(image + i)})`
        g.fillRect(x, -8, 1, this.H + 16)
      }
    }
    const nb = Math.floor(1 + (3.2 * hash(image * 2.9) * this.H) / 760)
    for (let i = 0; i < nb; i++) {
      const x = hash(image * 5.1 + i * 7.7) * this.W
      const y = hash(image * 3.3 + i * 5.9) * this.H
      const r = 0.6 + hash(image + i * 3) * 1.7
      g.fillStyle = hash(image * 1.1 + i) < 0.5 ? 'rgba(0,0,0,.55)' : 'rgba(246,236,214,.5)'
      g.beginPath()
      g.arc(x, y, r, 0, TAU)
      g.fill()
    }
  }
}
