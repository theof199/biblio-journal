import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MoteurCarte, type CaseCarte, type Dependances, type Rappels } from './moteur'
import { contexteFactice, type Appel } from '../test/contexteFactice'
import { creerRegistre } from '../mondes'
import { mondeAVenir } from '../mondes/avenir'
import type { Monde } from '../mondes/types'

/**
 * La référence de 1890 (`reference1890.test.ts`) fige ce que le moteur dessine à la densité 2, et à
 * elle seule. Ici, aucune empreinte : le vrai 1890 est joué deux fois, à 2 puis à une autre densité,
 * et les deux suites d'appels sont comparées. Un monde dessine en pixels CSS : seul le repère de base
 * de la toile change, et les tuiles du sol (2 au plus) ne changent pas de 2 à 3.
 *
 * Mutations (`moteur.ts`) : le repère de l'image écrit à 2 en dur ; la position ou le rayon d'un feu
 * ramenés à l'écran par 2 en dur ; une tuile peinte à l'échelle de la toile (`this.dpr`) et non à la
 * sienne. Les zones de toucher ne laissent rien dans les appels : `moteur.test.ts` les tient.
 */

const W = 390
const H = 700

interface Cas {
  nom: string
  calme: boolean
  camera: number
  heure: number
}
// 1890 commence à 190 et finit à 1430 : le haut, la case de 1897, la frontière où deux mondes se mêlent.
const CAS: readonly Cas[] = [
  { nom: 'en haut de 1890, au calme', calme: true, camera: 0, heure: 12 },
  { nom: 'sur 1897, en mouvement', calme: false, camera: 260, heure: 12 },
  // Les feux du décor ne font leur halo que la nuit.
  { nom: 'sur 1897, de nuit, en mouvement', calme: false, camera: 260, heure: 23 },
  { nom: 'à cheval sur la frontière de 1900, en mouvement', calme: false, camera: 1080, heure: 23 },
]

const cases: CaseCarte[] = Array.from({ length: 1912 - 1895 + 1 }, (_, i) => {
  const annee = 1895 + i
  return {
    annee,
    etat: annee < 1898 ? 'lion' : annee === 1898 ? 'encours' : 'verrou',
    attente: false,
    profondeur: annee <= 1898 ? [30, 12, 4, 3][i]! : 0,
    jauge: annee === 1898 ? { vus: 3, total: 5 } : null,
    affiches: annee <= 1898 ? [`https://image.tmdb.org/t/p/w500/${annee}.jpg`] : [],
  }
})

/** Une suite fixe à la place de `Math.random`, reprise à chaque montage : les deux jeux tirent les mêmes nombres. */
function suiteFixe(): () => number {
  let s = 20261009
  return () => (s = (s * 48271) % 2147483647) / 2147483647
}

/** Les nombres au millionième ; une toile posée (`drawImage`) par son rang de création, sa taille se lisant dans `toiles`. */
const arrondir = (_cle: string, v: unknown): unknown =>
  typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : typeof v === 'object' && v !== null && 'numero' in v ? `toile ${String(v.numero)}` : v
/** Le premier appel qui diffère, avec son rang : une suite de trente mille lignes ne se lit pas dans un échec. */
const premierEcart = (recu: readonly string[], attendu: readonly string[]): string | null => {
  const i = attendu.findIndex((l, k) => l !== recu[k])
  if (i >= 0) return `appel ${i} : attendu ${attendu[i]!} ; recu ${recu[i] ?? 'rien'}`
  return recu.length > attendu.length ? `appel ${attendu.length} en trop : ${recu[attendu.length]!}` : null
}
/** Un appel en texte, les nombres au millionième (un point d'écran divisé par 3 et non par 2 diffère au dernier bit). */
const ecrire = (suite: readonly Appel[]): string[] => suite.map((a) => JSON.stringify(a, arrondir))

function jouer(cas: Cas, densite: number) {
  vi.spyOn(Math, 'random').mockImplementation(suiteFixe())
  const principal = contexteFactice()
  const toiles: Array<{ taille: string; appels: Appel[] }> = []
  const registre = creerRegistre()
  const aVenir = new Map<number, Monde>()
  const mondeDe = (d: number): Monde => {
    if (d === 1890) return registre(1890)
    const m = aVenir.get(d) ?? mondeAVenir(d)
    aVenir.set(d, m)
    return m
  }
  const deps: Dependances = {
    creerToile: (w, h) => {
      const f = contexteFactice()
      const toile = { width: w, height: h, numero: toiles.length, getContext: () => f.ctx }
      toiles.push({ taille: `${w}x${h}`, appels: f.appels })
      return toile
    },
    image: () => ({}) as CanvasImageSource,
    demanderImage: () => 1,
    annulerImage: () => undefined,
    heure: () => cas.heure,
    mondeDe,
  }
  const rien = () => undefined
  const rappels: Rappels = { toucherAnnee: rien, apercu: rien, finApercu: rien, ensemble: rien, defilerVers: rien, date: rien, roulotte: rien, avatarVisible: rien, bobine: rien, bobineArrivee: rien, cibleBobines: () => ({ x: 350, y: 40 }), clap: rien, presences: rien }
  const moteur = new MoteurCarte({ width: 0, height: 0, getContext: () => principal.ctx }, rappels, deps)
  moteur.mesurer(W, H, densite)
  moteur.reglerCalme(cas.calme)
  moteur.majEtat({ cases, anneeAvatar: 1898, tampons: [], tickets: [], roulotte: null })
  moteur.defiler(cas.camera)
  const images = cas.calme ? 1 : 6
  for (let i = 0; i <= images; i++) moteur.image(1000 + i * 40)
  // Le repère de base, mis de côté : c'est la seule chose qui doit changer.
  const reperes = principal.appels.filter((a) => a.nom === 'setTransform').map((a) => a.args.join())
  const image = ecrire(principal.appels.filter((a) => a.nom !== 'setTransform'))
  return { reperes: [...new Set(reperes)], image, toiles: toiles.map((t) => ({ taille: t.taille, appels: ecrire(t.appels) })) }
}

describe('le vrai 1890 à une autre densité que 2', () => {
  beforeEach(() => {
    // Sans chemin, le moteur ne peint aucune tuile. Celui-ci garde ses points : la route se lit dans l'argument de `stroke`.
    vi.stubGlobal('Path2D', class {
      points: number[][] = []
      moveTo(x: number, y: number) { this.points.push([0, x, y]) }
      lineTo(x: number, y: number) { this.points.push([1, x, y]) }
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(CAS)('à 3, émet les appels de 2, au repère de base près : $nom', (cas) => {
    const a2 = jouer(cas, 2)
    const a3 = jouer(cas, 3)
    expect(a2.reperes).toEqual(['2,0,0,2,0,0'])
    expect(a3.reperes).toEqual(['3,0,0,3,0,0'])
    expect(a2.image.length).toBeGreaterThan(100)
    expect(premierEcart(a3.image, a2.image)).toBeNull()
    // Les tuiles du sol comprises : mêmes tailles, mêmes appels.
    expect(a3.toiles.map((t) => t.taille)).toEqual(a2.toiles.map((t) => t.taille))
    expect(a3.toiles.some((t) => t.taille === `${W * 2}x1024`)).toBe(true)
    a2.toiles.forEach((t, i) => expect(premierEcart(a3.toiles[i]!.appels, t.appels)).toBeNull())
    // Et elles sont peintes : une tuile vide serait égale à une tuile vide.
    for (const t of a3.toiles.filter((x) => x.taille === `${W * 2}x1024`)) expect(t.appels.length).toBeGreaterThan(50)
  })

  // À 1, la toile et les tuiles sont à 1 : l'image reste celle de 2, autant de toiles, les tuiles à leur taille.
  it.each(CAS)('à 1, émet la même image que 2 : $nom', (cas) => {
    const a2 = jouer(cas, 2)
    const a1 = jouer(cas, 1)
    expect(a1.reperes).toEqual(['1,0,0,1,0,0'])
    expect(premierEcart(a1.image, a2.image)).toBeNull()
    expect(a1.toiles.some((t) => t.taille === `${W}x512`)).toBe(true)
    expect(a1.toiles.length).toBe(a2.toiles.length)
  })
})
