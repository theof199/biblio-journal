import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ambiance } from './son'
import { DoublureAudio, oublierDoublures } from '../test/audioFactice'
import { creerMonde1890 } from '../mondes/1890'
import { mondeAVenir } from '../mondes/avenir'
import type { MusiqueDuMonde } from '../mondes/types'

const creer = () => new DoublureAudio() as unknown as AudioContext
const derniere = () => DoublureAudio.crees[DoublureAudio.crees.length - 1]!

/** Une musique d'essai qui note chaque temps joué. */
function musiqueDEssai(): MusiqueDuMonde & { joues: number[] } {
  const joues: number[] = []
  return { battue: 0.1, temps: 4, volume: 0.5, filtre: 2000, joues, jouer: (_ctx, _s, pas) => void joues.push(pas) }
}

/** Laisse filer `s` secondes sur l'horloge du contexte et sur celle de la planification. */
function filer(s: number): void {
  for (let i = 0; i < s * 10; i++) {
    for (const c of DoublureAudio.crees) c.currentTime += 0.1
    vi.advanceTimersByTime(100)
  }
}

describe('l’ambiance sonore de la carte', () => {
  beforeEach(() => {
    oublierDoublures()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  // Mutations : `construire()` appelé dans le constructeur, dans `presences`, dans `clap`, dans
  // `carillon` ou dans `taire(false)` : le contexte naîtrait sans geste, et Safari le refuserait.
  it('ne crée aucun contexte avant le geste « Son », quoi qu’on lui demande', () => {
    const fabrique = vi.fn(creer)
    const a = new Ambiance(fabrique)
    a.presences([{ musique: creerMonde1890().musique, poids: 1 }])
    a.clap()
    a.carillon()
    a.taire(false)
    a.taire(true)
    a.taire(false)
    filer(1)
    expect(fabrique).not.toHaveBeenCalled()
    expect(a.enMarche).toBe(false)
    expect(a.allumer()).toBe(true)
    expect(fabrique).toHaveBeenCalledTimes(1)
    a.couper()
    a.allumer()
    expect(fabrique).toHaveBeenCalledTimes(1)
  })

  // Mutation : `reprendre()` retiré d'`allumer` : sur iPhone, le contexte né suspendu le resterait.
  it('reprend dans le geste un contexte né suspendu (Safari d’iOS)', () => {
    DoublureAudio.etatInitial = 'suspended'
    const a = new Ambiance(creer)
    a.allumer()
    expect(derniere().appels.some((x) => x.nom === 'resume')).toBe(true)
    expect(derniere().state).toBe('running')
  })

  // Mutations : jouer une piste sans regarder son volume (`p.volume > 0.02` retiré) ; le volume
  // d'une musique tiré d'un autre monde que le sien.
  it('joue la musique d’un monde à l’écran, et se tait quand il n’y est plus', () => {
    const m = musiqueDEssai()
    const a = new Ambiance(creer)
    a.allumer()
    a.presences([{ musique: m, poids: 1 }])
    filer(1)
    expect(m.joues.length).toBeGreaterThan(5)
    expect(new Set(m.joues)).toEqual(new Set([0, 1, 2, 3]))
    a.presences([{ musique: m, poids: 0 }])
    const avant = m.joues.length
    filer(1)
    expect(m.joues.length).toBe(avant)
  })

  // Mutation : `musique: ORGUE` au monde « à venir » (ou un orgue joué à défaut de musique) : le
  // monde sans chantier jouerait l'orgue de 1890.
  it('ne joue rien pour le monde « à venir », et l’orgue pour 1890', () => {
    expect(mondeAVenir(1900).musique).toBeNull()
    const a = new Ambiance(creer)
    a.allumer()
    const base = derniere().oscillateurs
    a.presences([{ musique: mondeAVenir(1900).musique, poids: 1 }])
    filer(2)
    expect(derniere().oscillateurs).toBe(base)
    a.presences([{ musique: creerMonde1890().musique, poids: 1 }])
    filer(2)
    expect(derniere().oscillateurs).toBeGreaterThan(base)
  })

  // Mutations : `taire` qui ne suspend pas le contexte, ou qui laisse tourner la planification :
  // la carte en arrière-plan jouerait encore l'orgue.
  it('se tait quand la page passe en arrière-plan, et reprend à son retour', () => {
    const m = musiqueDEssai()
    const a = new Ambiance(creer)
    a.allumer()
    a.presences([{ musique: m, poids: 1 }])
    filer(0.5)
    a.taire(true)
    expect(derniere().state).toBe('suspended')
    const avant = m.joues.length
    filer(1)
    expect(m.joues.length).toBe(avant)
    a.taire(false)
    expect(derniere().state).toBe('running')
    filer(1)
    expect(m.joues.length).toBeGreaterThan(avant)
  })

  // Mutation : `if (!this.allume) return` retiré du clap : le clap sonnerait le son coupé.
  it('coupé, ne fait plus aucun bruit : ni clap, ni carillon', () => {
    const a = new Ambiance(creer)
    a.allumer()
    a.couper()
    const avant = derniere().appels.length
    a.clap()
    a.carillon()
    expect(derniere().appels.length).toBe(avant)
    filer(1)
    expect(derniere().state).toBe('suspended')
  })

  // Mutation : le `try` retiré autour de la fabrique, ou `allumer` qui rend vrai sans contexte.
  it('dit « pas de son » sans lever, quand le navigateur n’en a pas', () => {
    expect(new Ambiance(() => null).allumer()).toBe(false)
    const leve = new Ambiance(() => {
      throw new Error('NotAllowedError')
    })
    expect(leve.allumer()).toBe(false)
    expect(leve.enMarche).toBe(false)
    expect(() => leve.clap()).not.toThrow()
  })
})
