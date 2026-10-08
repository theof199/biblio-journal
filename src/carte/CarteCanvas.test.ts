import { createElement } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CarteCanvas, { AFFICHES_DES_COLONNES, AFFICHES_D_UN_MONDE, BORNE_DES_AFFICHES, FabriqueMoteurContexte, affichesDecodees, fabriqueReelle, imagesDesMondes } from './CarteCanvas'
import type { Dependances, EtatCarte } from './moteur'
import { moteurFactice } from '../test/moteurFactice'

const vu = vi.hoisted(() => ({ deps: null as unknown }))

vi.mock('./moteur', () => ({
  MoteurCarte: class {
    constructor(_canvas: unknown, _rappels: unknown, deps: unknown) {
      vu.deps = deps
    }
  },
}))

describe('le vrai moteur', () => {
  afterEach(() => vi.useRealTimers())

  // Relecture de la tâche 9 (idée 3, le jour et la nuit de l'heure réelle). Mutations : une heure
  // fixe (`heure: () => 12`) ; les minutes oubliées ; l'heure lue une fois pour toutes à la
  // fabrication du moteur au lieu de l'être à chaque image.
  it('lit l’heure de l’appareil, minutes comprises, à chaque demande', () => {
    fabriqueReelle(document.createElement('canvas'), {} as never)
    const deps = vu.deps as Dependances
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 29, 21, 30))
    expect(deps.heure()).toBe(21.5)
    vi.setSystemTime(new Date(2026, 8, 30, 6, 45))
    expect(deps.heure()).toBe(6.75)
  })
})

/**
 * Tout ce qu'un monde ou le moteur peut demander de ses propres dossiers : le motif est celui de
 * `mondes/<décennie>/images.ts` et de `carte/images.ts`, compté sur les fichiers réels.
 */
const DES_MONDES = import.meta.glob<string>(['/src/mondes/*/assets/*.{webp,png,webm}', '/src/carte/assets/*.{webp,png,webm}'], { query: '?url', import: 'default', eager: true })
const adressesDes = (dossier: string): string[] =>
  Object.entries(DES_MONDES)
    .filter(([chemin]) => chemin.startsWith(dossier))
    .map(([, url]) => url)

describe('la mémoire des images (plan 3b, tâche 14)', () => {
  /** Une image déjà chargée : `fabriqueReelle` la rend telle quelle, et l'on compare les objets. */
  const creees: string[] = []
  class ImageChargee {
    decoding = ''
    onload: (() => void) | null = null
    complete = true
    naturalWidth = 1
    private adresse = ''
    get src(): string {
      return this.adresse
    }
    set src(url: string) {
      this.adresse = url
      creees.push(url)
    }
  }
  const demander = (): ((url: string) => unknown) => {
    fabriqueReelle(document.createElement('canvas'), {} as never)
    const deps = vu.deps as Dependances
    return (url) => deps.image(url, () => undefined)
  }
  // Une jaquette de l'API, de la même origine que l'appli : aucun préfixe ne la distingue d'une image de monde.
  const affiche = (n: number): string => `/covers/thumb/affiche-${n}.webp`

  beforeEach(() => {
    imagesDesMondes.clear()
    affichesDecodees.clear()
    creees.length = 0
    vi.stubGlobal('Image', ImageChargee)
  })
  afterEach(() => vi.unstubAllGlobals())

  // Sans fichiers sous le motif, les tests d'en dessous ne garderaient rien.
  it('se compte sur de vrais dossiers : le monde 1900 et le monde 1890 y ont leurs fichiers', () => {
    expect(adressesDes('/src/mondes/1900/assets/').length).toBeGreaterThanOrEqual(10)
    expect(adressesDes('/src/mondes/1890/assets/').length).toBeGreaterThan(0)
  })

  // Tour de correction 1 : la garantie est inconditionnelle. Aucun monde du registre n'y perd une
  // image (ni 1900, ni 1890, ni les images communes), sous dix fois la borne d'affiches et sans
  // qu'on les redemande entre-temps ; et elles ne prennent la place d'aucune affiche. Mutation : le
  // traitement à part retiré (tout dans le `Lru`).
  it('n’évince jamais une image d’un monde, quel que soit le nombre d’affiches passées sans la redemander', () => {
    const image = demander()
    const mondes = Object.values(DES_MONDES)
    const avant = mondes.map((url) => image(url))
    expect(avant.every((img) => img instanceof ImageChargee)).toBe(true)
    for (let j = 0; j < 10 * BORNE_DES_AFFICHES; j++) image(affiche(j))
    const apres = mondes.map((url) => image(url))
    apres.forEach((img, i) => expect(img).toBe(avant[i]))
    expect(creees).toHaveLength(mondes.length + 10 * BORNE_DES_AFFICHES)
    expect(imagesDesMondes.size).toBe(mondes.length)
    expect(affichesDecodees.taille).toBe(BORNE_DES_AFFICHES)
  })

  // Mutations : la borne retirée (`new Lru(Infinity)`) ; les affiches rangées dans la table sans
  // éviction des mondes (`ADRESSES_DES_MONDES.has(url)` remplacé par `true`).
  it('ne garde jamais plus d’affiches que la borne, de 1900 à 1909 et sous des affiches en nombre', () => {
    const image = demander()
    const monde = adressesDes('/src/mondes/1900/assets/')
    let n = 0
    for (let annee = 1900; annee <= 1909; annee++) {
      for (const url of monde) image(url)
      for (let j = 0; j < BORNE_DES_AFFICHES; j++) image(affiche(n++))
      expect(affichesDecodees.taille).toBeLessThanOrEqual(BORNE_DES_AFFICHES)
      // Ce que les deux tables gardent ensemble : les images du monde, et la borne, rien de plus.
      expect(imagesDesMondes.size + affichesDecodees.taille).toBeLessThanOrEqual(monde.length + BORNE_DES_AFFICHES)
    }
    expect(n).toBeGreaterThan(BORNE_DES_AFFICHES)
    expect(affichesDecodees.taille).toBe(BORNE_DES_AFFICHES)
    expect(imagesDesMondes.size).toBe(monde.length)
  })

  // Les affiches des colonnes à l'écran, redemandées à chaque image, ne sortent pas sous celles
  // qui défilent. Mutation : la lecture faite sans passer par `Lru.get` (une table de lecture à
  // côté, le `Lru` n'étant plus qu'écrit) : l'ancienneté n'est plus rafraîchie.
  it('n’évince pas une affiche redemandée à chaque passe, sous des adresses plus récentes qu’on ne redemande pas', () => {
    const image = demander()
    const aLEcran = ['/covers/thumb/a-l-ecran-1.webp', '/covers/thumb/a-l-ecran-2.webp', '/covers/thumb/a-l-ecran-3.webp', '/covers/thumb/a-l-ecran-4.webp']
    const premieres = aLEcran.map((url) => image(url))
    let n = 0
    for (let passe = 0; passe < 8; passe++) {
      for (let j = 0; j < BORNE_DES_AFFICHES - aLEcran.length; j++) image(`/covers/thumb/qui-defile-${n++}.webp`)
      aLEcran.forEach((url, i) => expect(image(url)).toBe(premieres[i]))
    }
    expect(n).toBeGreaterThan(2 * BORNE_DES_AFFICHES)
    aLEcran.forEach((url, i) => expect(affichesDecodees.get(url)).toBe(premieres[i]))
    for (const url of aLEcran) expect(creees.filter((c) => c === url)).toHaveLength(1)
    // Les affiches qu'on n'a pas redemandées, elles, sont sorties.
    expect(affichesDecodees.get('/covers/thumb/qui-defile-0.webp')).toBeUndefined()
  })

  // Idée 72 : une seule image du moteur demande ses colonnes et, par `VueMonde.image`, les affiches
  // d'un monde. Toutes doivent tenir ensemble, sinon aucune n'est jamais rendue : à la passe
  // suivante, chacune a été évincée par une autre de la même image, et se recharge. Mutations : la
  // borne laissée aux seules colonnes (`BORNE_DES_AFFICHES = AFFICHES_DES_COLONNES`) ; la part du
  // monde ramenée à zéro ; la borne d'une de moins que la somme ; la borne de quarante de plus.
  it('garde d’une passe à l’autre tout ce qu’une seule image demande, les colonnes pleines et les affiches d’un monde', () => {
    const image = demander()
    const uneImage = [
      ...Array.from({ length: AFFICHES_DES_COLONNES }, (_, j) => `/covers/thumb/colonne-${j}.webp`),
      ...Array.from({ length: AFFICHES_D_UN_MONDE }, (_, j) => `/covers/thumb/ficelle-${j}.webp`),
    ]
    expect(AFFICHES_D_UN_MONDE).toBeGreaterThan(0)
    const premieres = uneImage.map((url) => image(url))
    for (let passe = 0; passe < 3; passe++) uneImage.forEach((url, i) => expect(image(url)).toBe(premieres[i]))
    expect(creees).toHaveLength(uneImage.length)
    expect(affichesDecodees.taille).toBe(uneImage.length)
    // Et pas une de plus : la borne est la somme des deux parts, sans marge par-dessus. La part d'un
    // monde, elle, est plus large que ce que 1900 demande (dix, pour une ficelle de cinq).
    image('/covers/thumb/de-trop.webp')
    expect(affichesDecodees.taille).toBe(uneImage.length)
  })
})

describe('le pont entre le DOM et le moteur', () => {
  afterEach(() => vi.restoreAllMocks())

  const ETAT: EtatCarte = { cases: [], anneeAvatar: 0, tampons: [], tickets: [], roulotte: null }
  const OBJETS: readonly string[] = ['melon']
  const monter = () => {
    const banc = moteurFactice()
    const ecoutes = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const rappels = { toucherAnnee() {}, apercu() {}, finApercu() {}, ensemble() {}, date() {}, roulotte() {}, avatarVisible() {}, bobine() {}, bobineArrivee() {}, cibleBobines: () => ({ x: 0, y: 0 }), clap() {}, presences() {}, entreeProche: vi.fn(), objet: vi.fn(), aiguillage: vi.fn(), passage: vi.fn() }
    const arbre = (objets: readonly string[]) =>
      createElement(FabriqueMoteurContexte.Provider, { value: banc.fabrique }, createElement(CarteCanvas, { etat: ETAT, calme: false, bobines: [], objets, rappels, surMoteur: () => undefined }))
    const { container, rerender } = render(arbre(OBJETS))
    return { ...banc, vue: container.firstElementChild as HTMLElement, ecoutes, page: rappels, rendre: (objets: readonly string[]) => rerender(arbre(objets)) }
  }

  // Plan 3a : le navigateur relève le pointeur (`pointercancel`) dès qu'il prend le geste pour
  // défiler ; les événements tactiles, eux, durent jusqu'au lever. Le compte est celui des doigts
  // posés sur la carte (`targetTouches`) : un doigt posé ailleurs (`touches` le compte aussi) ne se
  // lèvera jamais ici. Mutations : le relais retiré de `touchstart`, de `touchend` ou de
  // `touchcancel` ; un nombre fixe ; `touches.length` à la place de `targetTouches.length`.
  it('relaie au moteur le nombre de doigts posés sur la carte, au poser, au lever et à l’annulation', () => {
    const { moteur, vue } = monter()
    const ici = { clientX: 10, clientY: 10 }
    const ailleurs = { clientX: 300, clientY: 900 }
    fireEvent.touchStart(vue, { touches: [ailleurs, ici], targetTouches: [ici] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(1)
    fireEvent.touchStart(vue, { touches: [ailleurs, ici, { clientX: 90, clientY: 90 }], targetTouches: [ici, { clientX: 90, clientY: 90 }] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(2)
    fireEvent.touchEnd(vue, { touches: [ailleurs, ici], targetTouches: [ici] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(1)
    // Le doigt posé ailleurs reste : le compte de la carte tombe quand même à zéro.
    fireEvent.touchCancel(vue, { touches: [ailleurs], targetTouches: [] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(0)
    expect(moteur.doigtsPoses).toHaveBeenCalledTimes(4)
    fireEvent.touchStart(vue, { touches: [ailleurs, ici], targetTouches: [ici] })
    fireEvent.touchEnd(vue, { touches: [ailleurs], targetTouches: [] })
    expect(moteur.doigtsPoses).toHaveBeenLastCalledWith(0)
    expect(moteur.doigtsPoses).toHaveBeenCalledTimes(6)
  })

  // Un écouteur tactile non passif retient le défilement natif tant qu'il n'a pas rendu la main.
  // Mutation : `passive: false` (ou aucune option) sur un écouteur du relais.
  it('n’écoute les doigts posés que par des écouteurs passifs', () => {
    const { moteur, vue, ecoutes } = monter()
    const duRelais = ecoutes.mock.calls.filter(([type, ecouteur]) => {
      if (!['touchstart', 'touchend', 'touchcancel'].includes(type) || typeof ecouteur !== 'function') return false
      vi.mocked(moteur.doigtsPoses).mockClear()
      ecouteur.call(vue, { touches: [], targetTouches: [] } as unknown as Event)
      return vi.mocked(moteur.doigtsPoses).mock.calls.length > 0
    })
    expect(duRelais.map(([type]) => type).sort()).toEqual(['touchcancel', 'touchend', 'touchstart'])
    for (const [, , options] of duRelais) expect(options).toEqual({ passive: true })
  })

  // Plan 3a : quitter la vue d'ensemble d'un pincement désigne une année sous le milieu des deux
  // doigts, dans le repère de la carte. Mutations : le `x` du milieu non relayé (0, ou le `y` à sa
  // place) ; le bord gauche de la carte non retranché ; le `y` perdu en chemin.
  it('relaie au moteur l’écart des deux doigts et leur milieu, en x comme en y, dans le repère de la carte', () => {
    const { moteur, vue } = monter()
    vi.spyOn(vue, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 50 } as DOMRect)
    fireEvent.touchMove(vue, { touches: [{ clientX: 100, clientY: 300 }, { clientX: 160, clientY: 380 }] })
    expect(moteur.pincer).toHaveBeenLastCalledWith(100, 110, 290)
    // Un seul doigt : le pincement est relâché.
    fireEvent.touchEnd(vue, { touches: [{ clientX: 100, clientY: 300 }] })
    expect(moteur.pincer).toHaveBeenLastCalledWith(null, 0, 0)
  })

  // Lot « moteur » : un glissement qu'un monde a pris retient le défilement natif, et lui seul. Un
  // doigt qui défile ne rencontre aucun `preventDefault`. Mutations : `preventDefault` toujours ;
  // jamais (`glissePris` non lu).
  it('retient le défilement natif pendant un glissement pris, et jamais en dehors', () => {
    const { moteur, vue } = monter()
    const unDoigt = { touches: [{ clientX: 100, clientY: 300 }], cancelable: true }
    // `fireEvent` rend faux quand l'événement a été retenu.
    expect(fireEvent.touchMove(vue, unDoigt)).toBe(true)
    moteur.glissePris = true
    expect(fireEvent.touchMove(vue, unDoigt)).toBe(false)
    moteur.glissePris = false
    expect(fireEvent.touchMove(vue, unDoigt)).toBe(true)
  })

  // Le pincement garde sa retenue, glissement ou non, et reste relayé pendant un glissement.
  // Mutation : `pincer` court-circuité par `glissePris` (`glissePris || pincer(…)`).
  it('relaie encore le pincement pendant un glissement pris, et le retient comme avant', () => {
    const { moteur, vue } = monter()
    const deuxDoigts = { touches: [{ clientX: 100, clientY: 300 }, { clientX: 160, clientY: 380 }], cancelable: true }
    vi.mocked(moteur.pincer).mockReturnValue(true)
    expect(fireEvent.touchMove(vue, deuxDoigts)).toBe(false)
    moteur.glissePris = true
    vi.mocked(moteur.pincer).mockClear()
    fireEvent.touchMove(vue, deuxDoigts)
    expect(moteur.pincer).toHaveBeenCalledTimes(1)
  })

  // Les écoutes de `touchstart` et de `touchend` sont passives : y retenir ne retient rien et fait
  // protester le navigateur. jsdom ne le dirait pas : l'écouteur est appelé à la main.
  // Mutation : la garde `e.type === 'touchmove'` retirée.
  it('ne retient un glissement pris qu’au mouvement, pas au poser ni au lever', () => {
    const { moteur, vue, ecoutes } = monter()
    moteur.glissePris = true
    const retenus = ['touchstart', 'touchmove', 'touchend'].filter((type) => {
      const retenir = vi.fn()
      for (const [t, ecouteur] of ecoutes.mock.calls) {
        if (t === type && typeof ecouteur === 'function') ecouteur.call(vue, { type, touches: [{ clientX: 1, clientY: 1 }], targetTouches: [], cancelable: true, preventDefault: retenir } as unknown as Event)
      }
      return retenir.mock.calls.length > 0
    })
    expect(retenus).toEqual(['touchmove'])
  })

  // Plan 3a : le rappel neuf du moteur arrive à la page. Mutation : la ligne `entreeProche` retirée
  // du relais (la page n'offrirait jamais « Prendre le train »).
  it('relaie à la page l’entrée à portée de geste que dit le moteur', () => {
    const banc = monter()
    banc.rappels().entreeProche?.(1900)
    banc.rappels().entreeProche?.(null)
    expect(banc.page.entreeProche.mock.calls).toEqual([[1900], [null]])
  })

  // Lot d'écrans, brief 4 : les objets ramassés vont au moteur comme les bobines, au montage puis à
  // chaque liste neuve, et à elle seulement. Mutations : l'effet `reglerObjets` retiré ; sans sa
  // dépendance (une seule fois) ; à chaque rendu (une image demandée par rendu de la page).
  it('donne au moteur les objets ramassés, au montage et à chaque liste neuve seulement', () => {
    const banc = monter()
    expect(vi.mocked(banc.moteur.reglerObjets).mock.calls).toEqual([[['melon']]])
    banc.rendre(OBJETS)
    expect(banc.moteur.reglerObjets).toHaveBeenCalledTimes(1)
    banc.rendre(['melon', 'montre'])
    expect(vi.mocked(banc.moteur.reglerObjets).mock.calls).toEqual([[['melon']], [['melon', 'montre']]])
  })

  // Mutation : la ligne `objet` retirée du relais (la page n'apprendrait jamais qu'on a touché un objet).
  it('relaie à la page l’objet que le moteur dit ramassé, sa clé et l’endroit', () => {
    const banc = monter()
    banc.rappels().objet?.('melon', { x: 12, y: 34 })
    expect(banc.page.objet.mock.calls).toEqual([['melon', { x: 12, y: 34 }]])
  })

  // Brief 9 des écrans des lots. Mutation : la ligne `aiguillage` retirée du relais (la page
  // n'apprendrait jamais qu'un aiguillage est touché).
  it('relaie à la page l’aiguillage que le moteur dit touché, par la clé de sa halte', () => {
    const banc = monter()
    banc.rappels().aiguillage?.('melies')
    expect(banc.page.aiguillage.mock.calls).toEqual([['melies']])
    expect(banc.page.objet).not.toHaveBeenCalled()
  })

  // Mutation : la ligne `passage` retirée du relais (un passage lancé par un décor resterait inconnu de la page).
  it('relaie à la page le passage que le moteur dit commencer, puis cesser', () => {
    const banc = monter()
    banc.rappels().passage?.(true)
    banc.rappels().passage?.(false)
    expect(banc.page.passage.mock.calls).toEqual([[true], [false]])
  })
})
