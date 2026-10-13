import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import Coque from './Coque'
import { createQueryClient } from '../api/queryClient'
import { exemple } from '../test/contrat'
import { json, servir } from '../test/serveur'
import { ROUTES_ACCUEIL } from '../test/routesAccueil'
import { voyage1890 } from '../test/voyage'

// La carte se charge à la demande dans l'app (`paresseux`) : sans ce chargement préalable, le premier
// test qui ouvre `/voyage` paierait sa compilation dans le délai d'un `findByRole` (le remède de
// `test/pageVoyage.tsx`).
await import('../pages/Carte')
// Le Feuilleton et ses deux espaces aussi : trois morceaux.
await import('../feuilleton/Feuilleton')
await import('../studio/Studio')
await import('../maison/Maison')

const SESSION = exemple<{ user: { pseudo: string } }>('/auth/me', 'get', 200)
/** La carte, l'onglet Voyage, lit son Voyage et ses tickets. */
const CARTE = {
  'GET /api/me/voyage': () =>
    json(voyage1890(1895, [1895, 1896, 1897, 1898, 1899].map((annee) => ({ annee, statut: annee === 1895 ? ('en_cours' as const) : ('verrouillee' as const) })))),
  'GET /api/me/voyage/tickets': () => json({ tickets: [] }),
}
const NON_CONNECTE = { code: 'UNAUTHENTICATED', message: 'Tu dois être connecté pour faire ça.', retryable: false }

/**
 * Mercredi 14 octobre 2026, 10 h à Paris : une heure de travail. `/feuilleton` mène à l'espace de
 * l'heure (`feuilleton/espaces.ts`), que ces tests fixent pour savoir où l'onglet arrive.
 */
const HEURE_DE_TRAVAIL = new Date('2026-10-14T08:00:00Z')

/**
 * Les onglets, leur chemin, leur icône Tabler, et le titre de la page qu'ils ouvrent. Le fronton de
 * l'accueil porte le jour du calendrier (`formatJour`, `accueil/fronton.ts`) : un motif plutôt qu'un
 * texte fixe. `arrivee` : l'adresse où mène l'onglet quand ce n'est pas son chemin (le Feuilleton
 * n'a pas de page à lui, il ouvre un de ses deux espaces).
 */
const ATTENDUS = [
  { libelle: 'Accueil', chemin: '/', arrivee: '/', icone: 'building-pavilion', titre: /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) /u },
  { libelle: 'Voyage', chemin: '/voyage', arrivee: '/voyage', icone: 'route', titre: `Le Voyage de ${SESSION.user.pseudo}` },
  { libelle: 'Suivis', chemin: '/suivis', arrivee: '/suivis', icone: 'chair-director', titre: 'Suivis' },
  { libelle: 'Feuilleton', chemin: '/feuilleton', arrivee: '/feuilleton/studio', icone: 'device-tv-old', titre: 'Travail' },
  { libelle: 'Profil', chemin: '/profil', arrivee: '/profil', icone: 'armchair', titre: `Profil de ${SESSION.user.pseudo}` },
] as const

/** Le chemin courant, lu par le test : une redirection se constate, elle ne se devine pas. */
function Ou() {
  return <output data-testid="chemin">{useLocation().pathname}</output>
}

function monter(chemin: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[chemin]}>
        <App />
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Une entrée avec son état de navigation : la fiche d'un film ne vit que de lui. */
function monterAvecEtat(entree: { pathname: string; state: unknown }) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entree]}>
        <App />
        <Ou />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const barre = () => screen.getByRole('navigation', { name: 'Onglets' })
const chemin = () => screen.getByTestId('chemin').textContent

describe('la coque à onglets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Seule l'horloge est fausse : les délais du réseau doublé et des requêtes restent réels.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(HEURE_DE_TRAVAIL)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Mutations, dans `ONGLETS` : l'onglet Feuilleton retiré, déplacé, ou gardé sous `/au-cine`.
  it.each(ATTENDUS)('sur $chemin, la barre montre les cinq onglets et marque $libelle seul', async (courant) => {
    servir({ 'GET /api/auth/me': () => json(SESSION), ...ROUTES_ACCUEIL, ...CARTE })
    monter(courant.chemin)

    expect(await screen.findByRole('heading', { level: 1, name: courant.titre })).toBeInTheDocument()
    const liens = within(barre()).getAllByRole('link')
    expect(liens.map((l) => l.textContent)).toEqual(ATTENDUS.map((o) => o.libelle))
    for (const [i, lien] of liens.entries()) {
      const attendu = ATTENDUS[i]!
      expect(lien).toHaveAttribute('href', attendu.chemin)
      expect(lien.querySelector('svg')).toHaveClass(`tabler-icon-${attendu.icone}`)
      if (attendu === courant) expect(lien).toHaveAttribute('aria-current', 'page')
      else expect(lien).not.toHaveAttribute('aria-current')
    }
  })

  it('sur le Voyage, la coque pose le lieu « écran » sur <html>, que le ciel du bâtiment n’atteint pas', async () => {
    servir({ 'GET /api/auth/me': () => json(SESSION), ...ROUTES_ACCUEIL, ...CARTE })
    monter('/voyage')

    expect(await screen.findByRole('heading', { level: 1, name: ATTENDUS[1].titre })).toBeInTheDocument()
    expect(document.documentElement.dataset.lieu).toBe('ecran')
  })

  it('en quittant le Voyage pour l’accueil, <html> perd son lieu', async () => {
    servir({ 'GET /api/auth/me': () => json(SESSION), ...ROUTES_ACCUEIL, ...CARTE })
    monter('/voyage')
    await within(await screen.findByRole('navigation', { name: 'Onglets' })).findAllByRole('link')

    fireEvent.click(within(barre()).getByRole('link', { name: 'Accueil' }))

    expect(await screen.findByRole('heading', { level: 1, name: ATTENDUS[0].titre })).toBeInTheDocument()
    expect(document.documentElement).not.toHaveAttribute('data-lieu')
  })

  it('changer d’onglet remet la zone de contenu en haut', async () => {
    servir({ 'GET /api/auth/me': () => json(SESSION), ...ROUTES_ACCUEIL, ...CARTE })
    monter('/profil')
    await within(await screen.findByRole('navigation', { name: 'Onglets' })).findAllByRole('link')
    const zone = screen.getByRole('main')
    zone.scrollTop = 300

    fireEvent.click(within(barre()).getByRole('link', { name: 'Suivis' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Suivis' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBe(zone)
    expect(zone.scrollTop).toBe(0)
  })

  it.each(ATTENDUS)('un clic sur $libelle mène à sa page', async (cible) => {
    // Depuis un autre onglet : un clic sur l'onglet déjà ouvert ne prouverait rien.
    const depart = cible.chemin === '/profil' ? '/suivis' : '/profil'
    servir({ 'GET /api/auth/me': () => json(SESSION), ...ROUTES_ACCUEIL, ...CARTE })
    monter(depart)
    await within(await screen.findByRole('navigation', { name: 'Onglets' })).findAllByRole('link')

    fireEvent.click(within(barre()).getByRole('link', { name: cible.libelle }))

    expect(await screen.findByRole('heading', { level: 1, name: cible.titre })).toBeInTheDocument()
    expect(chemin()).toBe(cible.arrivee)
    expect(within(barre()).getByRole('link', { name: cible.libelle })).toHaveAttribute('aria-current', 'page')
  })

  // Aucune sous-page n'existe encore dans `App.tsx` : la coque se monte seule, sous une route qui
  // prend tout, comme le fera `voyage/:annee`.
  it.each(ATTENDUS.filter((o) => o.chemin !== '/'))('sur une sous-page de $chemin, $libelle reste seul marqué', (parent) => {
    render(
      <MemoryRouter initialEntries={[`${parent.chemin}/sous-page`]}>
        <Routes>
          <Route element={<Coque />}>
            <Route path="*" element={<h1>Sous-page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const marques = within(barre())
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
      .map((lien) => lien.textContent)
    expect(marques).toEqual([parent.libelle])
  })

  // Mutation : la route `voyage/decennies/:decennie` déclarée à côté de `<Coque />` dans `App.tsx`
  // au lieu de dedans : la barre disparaîtrait.
  it('la page d’une décennie garde la barre, l’onglet Voyage seul marqué', async () => {
    servir({
      'GET /api/auth/me': () => json(SESSION),
      ...CARTE,
      'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899': () => json({ items: [], next_cursor: null }),
    })
    monter('/voyage/decennies/1890')

    expect(await screen.findByRole('heading', { level: 1, name: 'Années 1890' })).toBeInTheDocument()
    const marques = within(barre())
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
      .map((lien) => lien.textContent)
    expect(marques).toEqual(['Voyage'])
  })

  // Mutation : la route `voyage/decennies/:decennie/billets` déclarée à côté de `<Coque />`.
  it('la boîte à billets garde la barre, l’onglet Voyage seul marqué', async () => {
    servir({
      'GET /api/auth/me': () => json(SESSION),
      ...CARTE,
      'GET /api/me/journal?limit=100&sortie_min=1890&sortie_max=1899': () => json({ items: [], next_cursor: null }),
    })
    monter('/voyage/decennies/1890/billets')

    expect(await screen.findByRole('heading', { level: 1, name: 'La boîte à billets' })).toBeInTheDocument()
    const marques = within(barre())
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
      .map((lien) => lien.textContent)
    expect(marques).toEqual(['Voyage'])
  })

  // Mutation : la route `voyage/decennies/:decennie/recherche` déclarée à côté de `<Coque />`.
  it('le guichet garde la barre, l’onglet Voyage seul marqué', async () => {
    servir({ 'GET /api/auth/me': () => json(SESSION), ...CARTE })
    monter('/voyage/decennies/1890/recherche')

    expect(await screen.findByRole('heading', { level: 1, name: 'Catalogue des vues' })).toBeInTheDocument()
    const marques = within(barre())
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
      .map((lien) => lien.textContent)
    expect(marques).toEqual(['Voyage'])
  })

  // Mutations : la route `au-cine/films/:tmdbId` déclarée à côté de `<Coque />` (la barre
  // disparaîtrait) ; `aussi: ['/au-cine']` retiré de l'onglet Accueil dans `ONGLETS` (plus aucun onglet
  // ne serait marqué : la page n'est sous le chemin d'aucun).
  it('la fiche d’un film ouverte depuis Au ciné garde son adresse et la barre, l’onglet Accueil seul marqué', async () => {
    servir({
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/reference/films/27205': () => json(exemple('/reference/films/{tmdbId}', 'get', 200)),
      'GET /api/reference/films/27205/seances': () => json({ jour: '2026-10-03', calcule_le: null, cinemas: [] }),
      'GET /api/reference/films/27205/realisateurs': () => json({ realisateurs: [] }),
    })
    const film = { tmdb_id: 27205, title: 'Inception', original_title: null, year: 2010, cover_url: null, vu: null, introuvable: false }
    monterAvecEtat({ pathname: '/au-cine/films/27205', state: { film, realisateur: null } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Inception' })).toBeInTheDocument()
    const marques = within(barre())
      .getAllByRole('link')
      .filter((lien) => lien.getAttribute('aria-current') === 'page')
      .map((lien) => lien.textContent)
    expect(marques).toEqual(['Accueil'])
    expect(chemin()).toBe('/au-cine/films/27205')
  })

  // Mutations : dans `App.tsx`, la route `au-cine` retirée (l'adresse tomberait sur `*`, donc sur
  // l'accueil) ou rendue en redirection vers `/` ; dans `ONGLETS`, `aussi: ['/au-cine']` retiré de
  // l'onglet Accueil (aucun onglet marqué), ou un onglet « Au ciné » remis dans la barre (six billets).
  it('/au-cine est une page, sans onglet à elle : la barre garde ses cinq billets, l’onglet Accueil seul marqué', async () => {
    const requetes = servir({
      'GET /api/auth/me': () => json(SESSION),
      'GET /api/reference/sorties': () => json(exemple('/reference/sorties', 'get', 200)),
      'GET /api/me/cinema/seances': () => json({ jour: '2026-10-13', calcule_le: null, cinemas: [], seances: [] }),
      'GET /api/me/journal?limit=40&reaction=en_salle': () => json({ items: [], next_cursor: null }),
      'GET /api/me/realisateurs': () => json([]),
      'GET /api/me/sagas': () => json([]),
    })
    monter('/au-cine')

    expect(await screen.findByRole('heading', { level: 1, name: 'Au ciné' })).toBeInTheDocument()
    expect(chemin()).toBe('/au-cine')
    expect(await screen.findByText('Sorti cette semaine dans mes cinémas')).toBeInTheDocument()
    const liens = within(barre()).getAllByRole('link')
    expect(liens.map((lien) => lien.textContent)).toEqual(['Accueil', 'Voyage', 'Suivis', 'Feuilleton', 'Profil'])
    expect(liens.filter((lien) => lien.getAttribute('aria-current') === 'page').map((lien) => lien.textContent)).toEqual(['Accueil'])
    // La page lit ce qui est à elle, pas le journal de l'accueil.
    expect(requetes).not.toContain('GET /api/me/journal?limit=20')
  })

  it.each(['/nulle-part', '/voyage/1898/salles', '/profil/inconnu'])('une route inconnue (%s) ramène à l’accueil', async (inconnue) => {
    servir({ 'GET /api/auth/me': () => json(SESSION), ...ROUTES_ACCUEIL, ...CARTE })
    monter(inconnue)

    expect(await screen.findByRole('heading', { level: 1, name: ATTENDUS[0].titre })).toBeInTheDocument()
    expect(chemin()).toBe('/')
  })

  it.each(ATTENDUS)('sans session, $chemin mène à la connexion', async ({ chemin: route }) => {
    servir({ 'GET /api/auth/me': () => json(NON_CONNECTE, 401) })
    monter(route)

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(chemin()).toBe('/connexion')
    expect(screen.queryByRole('navigation', { name: 'Onglets' })).not.toBeInTheDocument()
  })
})
