import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { creerRegistre } from '../../mondes'
import Tampon from './Tampon'
import styles from './Tampon.module.css'
import FEUILLE from './Tampon.module.css?raw'

const mondes = creerRegistre()

/** `prefers-reduced-motion` : `oui` pour le calme. */
const calme = (oui: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: oui, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }))

describe('le tampon du passeport', () => {
  beforeEach(() => calme(false))
  afterEach(() => {
    vi.unstubAllGlobals()
    // Rend `TZ` tel qu'il était : Node le relit à chaque affectation.
    vi.unstubAllEnvs()
  })

  // Mutation : `timeZone` retiré du format. Node relit `TZ` à l'affectation : sous Honolulu, le
  // minuit UTC du 31 décembre recule au 30.
  it('dit la décennie, le titre du voyageur et le jour où elle a été bouclée', () => {
    vi.stubEnv('TZ', 'Pacific/Honolulu')
    render(<Tampon monde={mondes(1890)} decennie={1890} tampon={{ decennie: 1890, boucle_le: '1999-12-31T00:00:00.000Z' }} />)
    expect(screen.getByText('Passeport')).toBeInTheDocument()
    expect(screen.getByText('Années 1890')).toBeInTheDocument()
    expect(screen.getByText('bouclée')).toBeInTheDocument()
    expect(screen.getByText('Spectateur des origines')).toBeInTheDocument()
    expect(screen.getByText('31 décembre 1999')).toHaveAttribute('dateTime', '1999-12-31T00:00:00.000Z')
  })

  // `boucle_le` est aussi l'instant où le ticket de la décennie suivante a été utilisé
  // (`calculerTampons`) : un ticket utilisé à 0 h 30 à Paris l'a été le 1er janvier.
  // Mutation : `timeZone: 'UTC'` (le 31 décembre). Le premier du mois s'écrit « 1er », comme partout
  // ailleurs dans le Journal (`formatDateVisionnage`) ; mutation : `Intl` seul (« 1 janvier 2000 »).
  it('dit le jour de Paris quand la décennie a été bouclée par un ticket utilisé la nuit', () => {
    vi.stubEnv('TZ', 'UTC')
    render(<Tampon monde={mondes(1890)} decennie={1890} tampon={{ decennie: 1890, boucle_le: '1999-12-31T23:30:00.000Z' }} />)
    expect(screen.getByText('1er janvier 2000')).toBeInTheDocument()
  })

  // Mutations : la place qui dit « bouclée » ; la place qui montre la date ou le millésime du tampon.
  it('sans tampon, montre sa place et ne dit rien de bouclé', () => {
    const { container } = render(<Tampon monde={mondes(1890)} decennie={1890} tampon={null} place />)
    expect(screen.getByText('Le tampon se pose ici')).toBeInTheDocument()
    expect(screen.getByText('Spectateur des origines')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/boucl/i)
    expect(container.querySelector('time')).toBeNull()
    expect(container.firstElementChild).toHaveClass(styles.place!)
    expect(container.firstElementChild).not.toHaveClass(styles.tampon!)
  })

  // Mutation : la place montrée sans qu'on la demande (sur la carte, un rond vide à la place du tampon).
  it('sans tampon ni place, ne montre rien', () => {
    const { container } = render(<Tampon monde={mondes(1890)} decennie={1890} tampon={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  // Il ne frappe que quand il vient d'être posé (la carte, au passage de la décennie) : le livret
  // l'ouvre posé depuis des mois, et le montre posé. Mutations : `frappe` ignoré (le tampon frappe à
  // chaque ouverture du livret) ; la garde du calme retirée (le tampon frappe aussi au calme).
  it('frappe quand il vient d’être posé, jamais posé de longue date ni au calme', () => {
    const tampon = { decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' }
    const vif = render(<Tampon monde={mondes(1890)} decennie={1890} tampon={tampon} frappe />)
    expect(vif.container.firstElementChild).toHaveClass(styles.tampon!, styles.frappe!)
    vif.unmount()
    const ancien = render(<Tampon monde={mondes(1890)} decennie={1890} tampon={tampon} />)
    expect(ancien.container.firstElementChild).toHaveClass(styles.tampon!)
    expect(ancien.container.firstElementChild).not.toHaveClass(styles.frappe!)
    ancien.unmount()
    calme(true)
    const pose = render(<Tampon monde={mondes(1890)} decennie={1890} tampon={tampon} frappe />)
    expect(pose.container.firstElementChild).toHaveClass(styles.tampon!)
    expect(pose.container.firstElementChild).not.toHaveClass(styles.frappe!)
  })

  // La carte le montre hors de toute page du Voyage : sans les jetons posés sur lui, son encre et sa
  // police retomberaient à rien. Mutation : le `style` retiré de la racine (du tampon, puis de la place).
  it.each([true, false])('pose lui-même les jetons de son monde (posé : %s)', (pose) => {
    const monde = mondes(1890)
    const { container } = render(
      <Tampon monde={monde} decennie={1890} tampon={pose ? { decennie: 1890, boucle_le: '2026-09-28T12:00:00.000Z' } : null} place />,
    )
    const racine = container.firstElementChild as HTMLElement
    expect(racine.style.getPropertyValue('--m-rouge')).toBe(monde.pages.jetons['--m-rouge'])
    expect(racine.style.getPropertyValue('--m-f-pochoir')).toBe(monde.pages.jetons['--m-f-pochoir'])
  })

  // Le jumeau du titre : un monde sans titre de voyageur (« à venir ») n'en invente pas.
  // Mutation : le titre du monde 1890 écrit en dur.
  it('dit le titre du monde de sa décennie, et rien quand il n’en a pas', () => {
    render(<Tampon monde={mondes(1900)} decennie={1900} tampon={{ decennie: 1900, boucle_le: '2026-09-28T12:00:00.000Z' }} />)
    expect(screen.getByText('Années 1900')).toBeInTheDocument()
    expect(screen.queryByText('Spectateur des origines')).toBeNull()
    expect(screen.getByText('28 septembre 2026')).toBeInTheDocument()
  })

  // Le tampon n'est pas un geste : ni le corail, ni une autre encre que le rouge du monde ; son
  // millésime au pochoir (décision D9). Mutations : `color: var(--corail)` ; le millésime en
  // `var(--m-f-affiche)`.
  it('s’encre du rouge du monde, jamais du corail, et frappe son millésime au pochoir', () => {
    const regle = (selecteur: string) => {
      const debut = FEUILLE.indexOf(`${selecteur} {`)
      return debut < 0 ? '' : FEUILLE.slice(debut, FEUILLE.indexOf('}', debut))
    }
    expect(FEUILLE).not.toMatch(/--corail/)
    expect(regle('.tampon')).toMatch(/color:\s*var\(--m-rouge\)/)
    expect(regle('.millesime')).toMatch(/font:[^;]*var\(--m-f-pochoir\)/)
  })

  // Ce qui le garde lisible, où qu'on le pose. L'encre rouge ne se lit que sur son rond de papier
  // (5,7:1 ; 1,4:1 sur le velours du livret). La place, sans fond à elle, écrit en `--m-doux`
  // (5,3:1 sur le velours ; `--m-pale`, 3,3:1). Et sa taille a un plancher : le livret de la
  // maquette le loge dans 56 px, où son jour tomberait à 3 px. Mutations : le fond de papier retiré ;
  // la place en `--m-pale` ; le plancher retiré.
  it('reste lisible : encre sur papier, place en encre douce, jamais sous 196 px', () => {
    const regle = (selecteur: string) => {
      const debut = FEUILLE.indexOf(`${selecteur} {`)
      return debut < 0 ? '' : FEUILLE.slice(debut, FEUILLE.indexOf('}', debut))
    }
    expect(regle('.tampon')).toMatch(/background:\s*var\(--m-papier\)/)
    // La dernière règle `.place` : la sienne, pas celle qu'elle partage avec le tampon, écrite avant.
    const place = FEUILLE.slice(FEUILLE.lastIndexOf('\n.place {'))
    expect(place.slice(0, place.indexOf('}'))).toMatch(/(^|[\s;{])color:\s*var\(--m-doux\)/)
    expect(regle('.tampon,\n.place')).toMatch(/font-size:\s*max\(1em,\s*12\.25px\)/)
  })
})
