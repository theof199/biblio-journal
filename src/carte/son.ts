import type { MusiqueDuMonde } from '../mondes/types'
import { hash } from './outils'

/**
 * L'ambiance sonore de la carte (plan 2d ; maquette carte v2 : « Le son », lignes 1878-1984) : le
 * ronron du projecteur, le clap, le carillon d'une bobine retrouvée, et la musique de chaque monde
 * à l'écran (l'orgue de barbarie de 1890), au volume de sa présence. Tout est synthétisé, aucun
 * fichier.
 *
 * Coupée par défaut. **Aucun contexte audio n'existe avant `allumer`**, que seul le bouton « Son »
 * appelle (les règles d'autoplay des navigateurs, Safari d'iOS compris) : le contexte naît dans le
 * geste, et s'y reprend s'il est suspendu. Une fois né, il vit autant que la page : la carte
 * quittée puis retrouvée le reprend (`taire`), sans redemander le geste.
 */

/** Ce qui fabrique le contexte : celui du navigateur, ou la doublure d'un test. Nul : pas de son ici. */
export type CreerContexte = () => AudioContext | null

export const contexteDuNavigateur: CreerContexte = () => {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return AC ? new AC() : null
}

/** Le pas de la planification (maquette : `setInterval(planifier, 90)`) et l'avance prise sur l'horloge du contexte. */
const PERIODE_MS = 90
const AVANCE = 0.3

interface Piste {
  musique: MusiqueDuMonde
  gain: GainNode
  /** Le volume demandé en dernier (maquette : `gO`) ; -1 : jamais. */
  volume: number
  pas: number
  prochain: number
}

export class Ambiance {
  private ctx: AudioContext | null = null
  private maitre: GainNode | null = null
  private bruit: AudioBuffer | null = null
  private allume = false
  private cachee = false
  private minuterie: ReturnType<typeof setInterval> | null = null
  private readonly pistes = new Map<MusiqueDuMonde, Piste>()
  private presentes: ReadonlyArray<{ musique: MusiqueDuMonde | null; poids: number }> = []
  private bruits = 0

  constructor(private readonly creer: CreerContexte = contexteDuNavigateur) {}

  /** Vrai depuis le geste « Son », jusqu'au suivant. */
  get enMarche(): boolean {
    return this.allume
  }

  /**
   * Le geste « Son » : crée le contexte la première fois, le reprend s'il est suspendu, monte le
   * volume et lance la musique. Faux quand le navigateur n'a pas de son.
   */
  allumer(): boolean {
    if (!this.ctx && !this.construire()) return false
    const ctx = this.ctx!
    this.allume = true
    this.reprendre()
    this.maitre!.gain.setTargetAtTime(this.cachee ? 0 : 0.8, ctx.currentTime, 0.2)
    for (const p of this.pistes.values()) p.prochain = ctx.currentTime + 0.1
    this.lancer()
    this.presences(this.presentes)
    return true
  }

  couper(): void {
    if (!this.allume) return
    this.allume = false
    this.arreter()
    const ctx = this.ctx
    if (!ctx || !this.maitre) return
    this.maitre.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
    setTimeout(() => {
      if (!this.allume) void ctx.suspend()
    }, 400)
  }

  /**
   * La page passe en arrière-plan, ou la carte est quittée (`vrai`) : le contexte se suspend. Elle
   * revient (`faux`) : il reprend, si le son était allumé. Ne crée jamais de contexte.
   */
  taire(cachee: boolean): void {
    this.cachee = cachee
    const ctx = this.ctx
    if (!ctx || !this.allume) return
    if (cachee) {
      this.arreter()
      void ctx.suspend()
    } else {
      this.reprendre()
      for (const p of this.pistes.values()) p.prochain = ctx.currentTime + 0.1
      this.maitre!.gain.setTargetAtTime(0.8, ctx.currentTime, 0.2)
      this.lancer()
    }
  }

  /** Les mondes à l'écran (maquette : `majSon`) : le volume de chaque musique suit la présence de son monde. */
  presences(liste: ReadonlyArray<{ musique: MusiqueDuMonde | null; poids: number }>): void {
    this.presentes = liste
    const ctx = this.ctx
    if (!ctx || !this.allume) return
    const voulu = new Map<MusiqueDuMonde, number>()
    for (const { musique, poids } of liste) if (musique) voulu.set(musique, (voulu.get(musique) ?? 0) + poids * musique.volume)
    for (const m of voulu.keys()) if (!this.pistes.has(m)) this.pistes.set(m, this.piste(m))
    for (const p of this.pistes.values()) {
      const v = voulu.get(p.musique) ?? 0
      if (Math.abs(v - p.volume) <= 0.02) continue
      p.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.3)
      p.volume = v
    }
  }

  /** Le clap (maquette : `sonClap`) : un claquement de bruit, et un coup grave qui tombe. */
  clap(): void {
    const ctx = this.ctx
    if (!ctx || !this.allume || this.cachee) return
    this.souffle(2400, 1.2, 0.07, 0.5)
    const t0 = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(180, t0)
    o.frequency.exponentialRampToValueAtTime(60, t0 + 0.08)
    g.gain.setValueAtTime(0.25, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1)
    o.connect(g).connect(this.maitre!)
    o.start(t0)
    o.stop(t0 + 0.12)
  }

  /** Le carillon d'une bobine retrouvée (maquette : `sonCarillon`) : trois notes qui montent. */
  carillon(): void {
    const notes = [1318.5, 1568, 2093]
    notes.forEach((f, i) => this.note(f, 0.5, 'triangle', 0.09, i * 0.08))
  }

  // --- l'intérieur -----------------------------------------------------------------------------

  /** Maquette : `sonConstruire`, sans le bourdon de 1920 (la musique d'un monde vient de lui). */
  private construire(): boolean {
    let ctx: AudioContext | null
    try {
      ctx = this.creer()
    } catch {
      ctx = null
    }
    if (!ctx) return false
    this.ctx = ctx
    const maitre = (this.maitre = ctx.createGain())
    maitre.gain.value = 0
    maitre.connect(ctx.destination)
    // Deux secondes de bruit blanc, tirées par `hash` comme tout le décor.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = hash(i * 0.731) * 2 - 1
    this.bruit = buf
    // Le ronron du projecteur : un bruit filtré, haché à dix-huit images par seconde, et un moteur grave.
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 0.9
    const amp = ctx.createGain()
    amp.gain.value = 0.5
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 18
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.5
    lfo.connect(lfoG).connect(amp.gain)
    const ronron = ctx.createGain()
    ronron.gain.value = 0.035
    src.connect(bp).connect(amp).connect(ronron).connect(maitre)
    const moteur = ctx.createOscillator()
    moteur.type = 'sawtooth'
    moteur.frequency.value = 50
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 160
    const moteurG = ctx.createGain()
    moteurG.gain.value = 0.05
    moteur.connect(lp).connect(moteurG).connect(maitre)
    src.start()
    lfo.start()
    moteur.start()
    return true
  }

  /** La sortie d'une musique : son volume, puis son passe-bas (maquette : `son.orgue`, `olp`). */
  private piste(musique: MusiqueDuMonde): Piste {
    const ctx = this.ctx!
    const gain = ctx.createGain()
    gain.gain.value = 0
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = musique.filtre
    gain.connect(f).connect(this.maitre!)
    return { musique, gain, volume: 0, pas: 0, prochain: ctx.currentTime + 0.1 }
  }

  /** iOS rend parfois le contexte `suspended` (ou `interrupted`) jusqu'au geste : on le reprend. */
  private reprendre(): void {
    const ctx = this.ctx
    if (ctx && ctx.state !== 'running') void ctx.resume()
  }

  private lancer(): void {
    this.arreter()
    if (this.cachee) return
    this.minuterie = setInterval(() => this.planifier(), PERIODE_MS)
  }

  private arreter(): void {
    if (this.minuterie !== null) clearInterval(this.minuterie)
    this.minuterie = null
  }

  /** Maquette : `planifier`. Chaque musique audible joue ses temps sur les trois dixièmes de seconde qui viennent. */
  private planifier(): void {
    const ctx = this.ctx
    if (!ctx || !this.allume) return
    for (const p of this.pistes.values()) {
      if (p.prochain < ctx.currentTime) p.prochain = ctx.currentTime + 0.05
      while (p.prochain < ctx.currentTime + AVANCE) {
        if (p.volume > 0.02) p.musique.jouer(ctx, p.gain, p.pas % p.musique.temps, p.prochain)
        p.prochain += p.musique.battue
        p.pas++
      }
    }
  }

  /** Maquette : `sonNote`. */
  private note(f: number, dur: number, type: OscillatorType, v: number, retard = 0): void {
    const ctx = this.ctx
    if (!ctx || !this.allume || this.cachee) return
    const t0 = ctx.currentTime + retard
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(v, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.connect(g).connect(this.maitre!)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }

  /** Maquette : `sonBruit`. Le départ dans le bruit est tiré par `hash`, d'un souffle à l'autre. */
  private souffle(freq: number, q: number, dur: number, v: number): void {
    const ctx = this.ctx
    if (!ctx || !this.bruit) return
    const t0 = ctx.currentTime
    const s = ctx.createBufferSource()
    const f = ctx.createBiquadFilter()
    const g = ctx.createGain()
    s.buffer = this.bruit
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    g.gain.setValueAtTime(v, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    s.connect(f).connect(g).connect(this.maitre!)
    s.start(t0, hash(++this.bruits) * 1.5, dur + 0.02)
  }
}

let deLaPage: Ambiance | null = null

/**
 * L'ambiance de la page : une seule, qui ne crée rien tant que « Son » n'a pas été touché, et qui
 * survit au démontage de la carte (une fiche d'année ouverte puis refermée retrouve le son).
 */
export function ambianceDeLaPage(): Ambiance {
  return (deLaPage ??= new Ambiance())
}

/** Pour les tests : la prochaine page repart d'une ambiance neuve, coupée et sans contexte. */
export function oublierAmbianceDeLaPage(): void {
  deLaPage?.couper()
  deLaPage = null
}
