/**
 * Un cache borné, le plus ancien usage sortant le premier. Les tuiles du sol en ont besoin : une
 * tuile de 512 px de haut pèse `W × DPR × 1024 × 4` octets, environ 3 Mo sur un téléphone
 * (390 px, DPR 2) ; les quelque cinquante-trois tuiles d'une carte de 27 000 px en feraient 160.
 */
export class Lru<K, V> {
  private readonly table = new Map<K, V>()
  constructor(private readonly max: number) {}
  get(cle: K): V | undefined {
    const v = this.table.get(cle)
    if (v !== undefined) {
      this.table.delete(cle)
      this.table.set(cle, v)
    }
    return v
  }
  set(cle: K, valeur: V): void {
    this.table.delete(cle)
    this.table.set(cle, valeur)
    while (this.table.size > this.max) {
      const plusAncienne = this.table.keys().next().value as K
      this.table.delete(plusAncienne)
    }
  }
  clear(): void {
    this.table.clear()
  }
  get taille(): number {
    return this.table.size
  }
}
