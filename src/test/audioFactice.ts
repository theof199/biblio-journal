/**
 * Un `AudioContext` qui ne joue rien et note tout (plan 2d) : jsdom n'en a pas, et ce qu'on
 * interdit (aucun contexte avant le geste « Son », un contexte suspendu au départ qu'on reprend,
 * le silence en arrière-plan) se lit dans ses constructions et ses appels. `DoublureAudio.crees`
 * garde chaque contexte construit, dans l'ordre.
 */
export interface AppelAudio {
  nom: string
  args: unknown[]
}

const parametre = (appels: AppelAudio[], nom: string) => ({
  value: 0,
  setValueAtTime: (...args: unknown[]) => void appels.push({ nom: `${nom}.setValueAtTime`, args }),
  setTargetAtTime: (...args: unknown[]) => void appels.push({ nom: `${nom}.setTargetAtTime`, args }),
  linearRampToValueAtTime: (...args: unknown[]) => void appels.push({ nom: `${nom}.linearRampToValueAtTime`, args }),
  exponentialRampToValueAtTime: (...args: unknown[]) => void appels.push({ nom: `${nom}.exponentialRampToValueAtTime`, args }),
})

export class DoublureAudio {
  static crees: DoublureAudio[] = []
  /** L'état au départ des contextes à venir : Safari d'iOS les rend parfois `suspended`. */
  static etatInitial: AudioContextState = 'running'

  readonly appels: AppelAudio[] = []
  state: AudioContextState = DoublureAudio.etatInitial
  currentTime = 0
  readonly sampleRate = 8000
  readonly destination = { nom: 'destination' }

  constructor() {
    DoublureAudio.crees.push(this)
  }

  /** Les oscillateurs lancés : une note, un clap, le moteur du projecteur. */
  get oscillateurs(): number {
    return this.appels.filter((a) => a.nom === 'createOscillator').length
  }

  private noeud(nom: string) {
    this.appels.push({ nom, args: [] })
    const appels = this.appels
    const n = {
      type: '',
      buffer: null as unknown,
      loop: false,
      gain: parametre(appels, `${nom}.gain`),
      frequency: parametre(appels, `${nom}.frequency`),
      Q: parametre(appels, `${nom}.Q`),
      connect: (cible: unknown) => cible,
      start: (...args: unknown[]) => void appels.push({ nom: `${nom}.start`, args }),
      stop: (...args: unknown[]) => void appels.push({ nom: `${nom}.stop`, args }),
    }
    return n
  }

  createGain() {
    return this.noeud('createGain')
  }
  createOscillator() {
    return this.noeud('createOscillator')
  }
  createBiquadFilter() {
    return this.noeud('createBiquadFilter')
  }
  createBufferSource() {
    return this.noeud('createBufferSource')
  }
  createBuffer(_canaux: number, longueur: number) {
    const d = new Float32Array(longueur)
    return { getChannelData: () => d }
  }
  resume() {
    this.appels.push({ nom: 'resume', args: [] })
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    this.appels.push({ nom: 'suspend', args: [] })
    this.state = 'suspended'
    return Promise.resolve()
  }
  close() {
    this.state = 'closed'
    return Promise.resolve()
  }
}

/** Repart d'aucun contexte construit. */
export function oublierDoublures(): void {
  DoublureAudio.crees = []
  DoublureAudio.etatInitial = 'running'
}
