import type { MusiqueDuMonde } from '../types'

/**
 * Le roulement du train, la seule musique du monde et son seul son (décision 4 de la spec : ni
 * sifflet ni cloche). La maquette est muette : le roulement est synthétisé ici, sans fichier. Un
 * joint de rail par mesure de deux temps : le premier essieu du bogie, puis le second, plus sourd,
 * et un temps de silence.
 */
const BATTUE = 0.34
/** Ce que joue chaque temps : le retard du coup dans le temps (en part de la battue), sa hauteur en Hz, son volume. */
export const PAR_TEMPS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[0, 92, 0.5], [0.36, 78, 0.34]],
  [],
  [[0, 88, 0.42], [0.36, 74, 0.3]],
  [],
]

/** Un coup de roue sur un joint : une note grave qui tombe d'un tiers en un dixième de seconde. */
function coup(ctx: BaseAudioContext, sortie: AudioNode, t0: number, hz: number, v: number): void {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(v, t0 + 0.008)
  g.gain.linearRampToValueAtTime(0, t0 + 0.11)
  g.connect(sortie)
  for (const [mul, type, vv] of [[1, 'triangle', 0.8], [2.6, 'square', 0.12]] as const) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(hz * mul, t0)
    o.frequency.linearRampToValueAtTime(hz * mul * 0.66, t0 + 0.1)
    const og = ctx.createGain()
    og.gain.value = vv
    o.connect(og).connect(g)
    o.start(t0)
    o.stop(t0 + 0.14)
  }
}

export const ROULEMENT: MusiqueDuMonde = {
  battue: BATTUE,
  temps: PAR_TEMPS.length,
  volume: 0.4,
  filtre: 900,
  jouer: (ctx, sortie, pas, t0) => {
    for (const [retard, hz, v] of PAR_TEMPS[pas] ?? []) coup(ctx, sortie, t0 + retard * BATTUE, hz, v)
  },
}
