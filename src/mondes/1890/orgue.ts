import type { MusiqueDuMonde } from '../types'

/**
 * L'orgue de barbarie de la foire (plan 2d ; maquette carte v2 : `MELO`, `ACC`, `PAR_TEMPS`,
 * `noteOrgue`, lignes 1879-1932) : une valse de huit mesures, la mélodie sur deux carrés
 * légèrement désaccordés et un triangle à l'octave, la basse au premier temps et l'accord aux deux
 * suivants. Synthétisé, aucun fichier.
 */
const BATTUE = 0.36
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)
/** La mélodie : une note MIDI (0 : un silence) et sa durée en temps. */
const MELO: ReadonlyArray<readonly [number, number]> = [[67, 1], [72, 1], [76, 1], [79, 2], [76, 1], [74, 1], [77, 1], [81, 1], [79, 2], [0, 1], [77, 1], [74, 1], [71, 1], [74, 2], [77, 1], [76, 1], [72, 1], [67, 1], [72, 2], [0, 1]]
/** L'accompagnement, mesure par mesure : la basse, puis l'accord. */
const ACC: ReadonlyArray<readonly [number, readonly number[]]> = [[48, [64, 67]], [48, [64, 67]], [50, [65, 69]], [43, [62, 67]], [43, [62, 65]], [43, [62, 67]], [48, [64, 67]], [48, [60, 64]]]

/** Les notes de chaque temps : la note, sa durée en secondes, son volume. */
export const PAR_TEMPS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = (() => {
  const t: Array<Array<readonly [number, number, number]>> = Array.from({ length: 24 }, () => [])
  let b = 0
  for (const [m, d] of MELO) {
    if (m) t[b]!.push([m, d * BATTUE * 0.92, 0.12])
    b += d
  }
  ACC.forEach(([basse, accord], mesure) => {
    t[mesure * 3]!.push([basse, BATTUE * 0.85, 0.11])
    for (const n of accord) {
      t[mesure * 3 + 1]!.push([n, BATTUE * 0.45, 0.04])
      t[mesure * 3 + 2]!.push([n, BATTUE * 0.45, 0.04])
    }
  })
  return t
})()

/** Maquette : `noteOrgue`. Une enveloppe brève, trois oscillateurs. */
function noteOrgue(ctx: BaseAudioContext, sortie: AudioNode, n: number, t0: number, dur: number, v: number): void {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(v, t0 + 0.015)
  g.gain.setValueAtTime(v, t0 + Math.max(0.03, dur - 0.04))
  g.gain.linearRampToValueAtTime(0, t0 + dur)
  g.connect(sortie)
  for (const [mul, type, vv] of [[1, 'square', 0.5], [1.004, 'square', 0.35], [2, 'triangle', 0.3]] as const) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = midi(n) * mul
    const og = ctx.createGain()
    og.gain.value = vv
    o.connect(og).connect(g)
    o.start(t0)
    o.stop(t0 + dur + 0.03)
  }
}

export const ORGUE: MusiqueDuMonde = {
  battue: BATTUE,
  temps: PAR_TEMPS.length,
  volume: 0.5,
  filtre: 2300,
  jouer: (ctx, sortie, pas, t0) => {
    for (const [n, dur, v] of PAR_TEMPS[pas] ?? []) noteOrgue(ctx, sortie, n, t0, dur, v)
  },
}
