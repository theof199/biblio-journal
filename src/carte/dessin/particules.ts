const TAU = Math.PI * 2

type Particule =
  | { k: 'e'; x: number; y: number; vx: number; vy: number; vie: number; age: number; coul: string; r: number; ui: boolean }
  | { k: 'f'; x: number; y: number; vx: number; vy: number; vie: number; age: number; coul: string; r: number; rot: number; vr: number; ui: boolean }
  | { k: 'm'; x: number; y: number; vx: number; vy: number; vie: number; age: number; r: number; ui: boolean }

const CONFETTIS = ['#A8452F', '#E6B94A', '#F2E8D5', '#3E5360', '#DE7A45']

/** Maquette : `etincelles`, `confettis`, `fumee`, `majParts`, `dessinerParts` ; deux cent quarante au plus. */
export class Particules {
  private readonly parts: Particule[] = []

  /** Une gerbe d'étincelles, à la couleur reçue (déjà passée par la rampe de qui les lance). */
  etincelles(x: number, y: number, n: number, coul: string): void {
    for (let i = 0; i < n && this.parts.length < 240; i++) {
      const a = Math.random() * TAU
      const v = 40 + Math.random() * 110
      this.parts.push({ k: 'e', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, vie: 0.5 + Math.random() * 0.5, age: 0, coul, r: 1.2 + Math.random() * 1.3, ui: false })
    }
  }
  /** Une volée de confettis, une couleur du décor à la fois (maquette : cinq couleurs fixes, ici celles reçues). */
  confettis(x: number, y: number, couleurs: readonly string[]): void {
    const palette = couleurs.length ? couleurs : CONFETTIS
    const n = Math.max(1, Math.round(30 / palette.length))
    for (let i = 0; i < n * palette.length && this.parts.length < 240; i++) {
      const coul = palette[i % palette.length]!
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
      const v = 90 + Math.random() * 120
      this.parts.push({ k: 'f', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 1.1 + Math.random() * 0.6, age: 0, coul, r: 2 + Math.random() * 2, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14, ui: false })
    }
  }
  /** Un peu de fumée, autour d'un point large de `large` px. */
  fumee(x: number, y: number, n: number, large: number): void {
    for (let i = 0; i < n && this.parts.length < 240; i++) {
      this.parts.push({ k: 'm', x: x + (Math.random() - 0.5) * large, y, vx: (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 20, vie: 1.6 + Math.random() * 0.8, age: 0, r: 5 + Math.random() * 6, ui: false })
    }
  }
  maj(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]!
      p.age += dt
      if (p.age >= p.vie) {
        this.parts.splice(i, 1)
        continue
      }
      const fr = p.k === 'm' ? 0.6 : p.k === 'f' ? 2.6 : 2.2
      const gr = p.k === 'm' ? 0 : p.k === 'f' ? 170 : 180
      const f = Math.exp(-fr * dt)
      p.vx *= f
      p.vy = p.vy * f + gr * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.k === 'f') p.rot += p.vr * dt
    }
  }
  dessiner(g: CanvasRenderingContext2D, ui: boolean): void {
    for (const p of this.parts) {
      if (p.ui !== ui) continue
      const a = 1 - p.age / p.vie
      if (p.k === 'e') {
        g.globalCompositeOperation = 'lighter'
        g.fillStyle = p.coul
        g.globalAlpha = a
        g.beginPath()
        g.arc(p.x, p.y, p.r, 0, TAU)
        g.fill()
        g.globalCompositeOperation = 'source-over'
        g.globalAlpha = 1
      } else if (p.k === 'f') {
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.rot)
        g.scale(1, Math.cos(p.rot * 1.7))
        g.fillStyle = p.coul
        g.globalAlpha = Math.min(1, a * 1.6)
        g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2)
        g.restore()
        g.globalAlpha = 1
      } else {
        g.fillStyle = 'rgba(207,198,182,.3)'
        g.globalAlpha = a
        g.beginPath()
        g.arc(p.x, p.y, p.r * (1 + p.age * 1.4), 0, TAU)
        g.fill()
        g.globalAlpha = 1
      }
    }
  }
}
