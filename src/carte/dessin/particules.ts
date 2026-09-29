/** Maquette : `etincelles`, `confettis`, `fumee`, `majParts`, `dessinerParts` ; deux cent quarante au plus. */
export class Particules {
  private readonly parts: Array<{ x: number; y: number; vx: number; vy: number; vie: number; age: number; coul: string; ui: boolean }> = []
  etincelles(x: number, y: number, n: number, coul: string): void {
    for (let i = 0; i < n && this.parts.length < 240; i++) this.parts.push({ x, y, vx: Math.random() * 80 - 40, vy: -60, vie: 0.8, age: 0, coul, ui: false })
  }
  confettis(x: number, y: number, couleurs: readonly string[]): void {
    couleurs.forEach((coul) => this.etincelles(x, y, 6, coul))
  }
  fumee(x: number, y: number, n: number, large: number): void {
    this.etincelles(x + large / 2, y, n, 'rgba(207,198,182,.3)')
  }
  maj(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]!
      p.age += dt
      if (p.age >= p.vie) this.parts.splice(i, 1)
      else {
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
    }
  }
  dessiner(g: CanvasRenderingContext2D, ui: boolean): void {
    for (const p of this.parts) {
      if (p.ui !== ui) continue
      g.fillStyle = p.coul
      g.fillRect(p.x, p.y, 2, 2)
    }
  }
}
