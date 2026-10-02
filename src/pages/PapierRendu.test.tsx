import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import PapierRendu, { type EtatPapier } from './PapierRendu'
import styles from './PapierRendu.module.css'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { json, servir } from '../test/serveur'
import { SessionProvider } from '../session/SessionContext'
import { decoupe } from '../formulaire/decoupe'
import { exemple } from '../test/contrat'
import type { JournalItem } from '../api/journal'
import type { Session } from '../api/schema'
import type { LigneEnBref } from '../formulaire/enBref'

const SESSION = exemple<Session>('/auth/me', 'get', 200)
const ITEM = exemple<JournalItem>('/me/journal', 'post', 201)
const ADORE = { cle: 'adore', emoji: '❤️', phrase: 'J’ai adoré' }
const TOUCHE = { cle: 'touche', emoji: '🥲', phrase: 'Ça m’a touché' }

/** Une entrée écrite, aux seules valeurs que le test pose : le reste vient de l'exemple du contrat. */
function entree(o: { note?: number | null; remarque?: string | null; titre?: string; realisateur?: string | null; annee?: number | null; date?: string } = {}): JournalItem {
  return {
    ...ITEM,
    entry: { ...ITEM.entry, rating: o.note === undefined ? 8 : o.note, finished_at: o.date ?? '2026-10-02' },
    media: {
      ...ITEM.media,
      title: o.titre ?? 'Inception',
      director: o.realisateur === undefined ? 'Christopher Nolan' : o.realisateur,
      year: o.annee === undefined ? 2010 : o.annee,
    },
    carnet: { reactions: [], comment: o.remarque === undefined ? null : o.remarque },
  }
}

function monter(etat: Partial<EtatPapier> & { item: JournalItem } | null) {
  const complet = etat && { reactions: [], enBref: [], ...etat }
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SessionProvider session={SESSION}>
        <MemoryRouter initialEntries={[{ pathname: '/journal/x/papier', state: complet }]}>
          <Routes>
            <Route path="/journal/:id/papier" element={<PapierRendu />} />
            <Route path="/" element={<p>Accueil</p>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

/** Une remarque d'exactement `longueur` caractères, de vrais mots. */
const remarqueDe = (longueur: number) => 'La forêt, la pluie, quatre vérités. '.repeat(10).slice(0, longueur).trimEnd().padEnd(longueur, '.')

describe('le papier rendu', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('est branché sous la coque, à `journal/:id/papier`, la barre d’onglets restant visible', async () => {
    servir({ 'GET /api/auth/me': () => json(SESSION) })
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[{ pathname: `/journal/${ITEM.entry.id}/papier`, state: { item: entree(), reactions: [], enBref: [] } }]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Mutation : la route retirée de `App.tsx` (le chemin retomberait sur `*`, donc sur l'accueil).
    expect(await screen.findByText('Papier rendu')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('sans état de navigation (rechargement, accès direct), renvoie à l’accueil : la critique est déjà au journal', () => {
    monter(null)

    // Mutation : la garde retirée (la page lirait `etat.item` sur `null`).
    expect(screen.getByText('Accueil')).toBeInTheDocument()
  })

  it('ne fait aucune requête : tout vient de l’état de navigation', () => {
    monter({ item: entree({ remarque: 'Une claque.' }), reactions: [ADORE] })

    expect(fetch).not.toHaveBeenCalled()
  })

  describe('la coupure', () => {
    it('annonce « Papier rendu », puis la rubrique « Critique » et la date de la séance', () => {
      monter({ item: entree({ date: '2026-10-02' }) })

      expect(screen.getByText('Papier rendu')).toBeInTheDocument()
      expect(screen.getByText('Critique')).toBeInTheDocument()
      expect(screen.getByText('2 octobre 2026')).toBeInTheDocument()
    })

    it('titre le film, puis « de réalisateur, année »', () => {
      monter({ item: entree({ titre: 'Inception' }) })

      expect(screen.getByRole('heading', { level: 1, name: 'Inception' })).toBeInTheDocument()
      expect(screen.getByText('de Christopher Nolan, 2010')).toBeInTheDocument()
    })

    it('lie par une espace insécable le deux-points d’un titre : la ligne ne commence pas par lui', () => {
      monter({ item: entree({ titre: 'Batman : Le Défi' }) })

      // Mutation : le titre imprimé tel quel (espace ordinaire).
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Batman\u00a0: Le Défi')
    })

    it('élide « de » devant une voyelle, et ne dit rien d’un réalisateur ni d’une année qu’il ne connaît pas', () => {
      const { unmount } = monter({ item: entree({ realisateur: 'Éric Rohmer', annee: 1969 }) })
      expect(screen.getByText('d’Éric Rohmer, 1969')).toBeInTheDocument()
      unmount()

      monter({ item: entree({ realisateur: null, annee: null }) })
      expect(screen.queryByText(/^de |^d’|, /)).toBeNull()
    })

    it('imprime d’un corps plus petit un titre de plus de vingt-huit caractères', () => {
      const court = 'x'.repeat(28)
      const long = 'x'.repeat(29)
      const { unmount } = monter({ item: entree({ titre: court }) })
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveClass(styles.long!)
      unmount()

      monter({ item: entree({ titre: long }) })
      // Mutation : le seuil déplacé (`>` devenu `>=`), ou la classe jamais posée.
      expect(screen.getByRole('heading', { level: 1 })).toHaveClass(styles.long!)
    })

    it('signe de son pseudo, au crayon', () => {
      monter({ item: entree() })

      expect(screen.getByText(SESSION.user.pseudo)).toBeInTheDocument()
    })

    it('pose les réactions du membre en tampons, avec leur emoji et leur phrase', () => {
      monter({ item: entree(), reactions: [ADORE, TOUCHE] })

      expect(screen.getByText('❤️ J’ai adoré')).toBeInTheDocument()
      expect(screen.getByText('🥲 Ça m’a touché')).toBeInTheDocument()
    })

    it('n’imprime aucun tampon sans réaction', () => {
      const { container } = monter({ item: entree(), reactions: [] })

      expect(container.querySelector(`.${styles.reactions}`)).toBeNull()
    })

    it('est découpée aux ciseaux, d’un contour tiré de l’identifiant de l’entrée', () => {
      const { container } = monter({ item: entree() })

      const papier = container.querySelector(`.${styles.coupure}`) as HTMLElement
      // Mutation : la graine changée (le contour ne serait plus celui que `decoupe` rend pour l'entrée).
      expect(papier.style.getPropertyValue('--decoupe')).toBe(decoupe(ITEM.entry.id))
    })
  })

  describe('quand la remarque est courte, ou absente : la note fait la une', () => {
    it('met en avant la note : cinq étoiles, le verdict en lettres de fronton, « 8 sur 10 »', () => {
      monter({ item: entree({ note: 8, remarque: null }) })

      expect(screen.getByRole('img', { name: 'Noté 8 sur 10' })).toBeInTheDocument()
      expect(screen.getByText('Très bien')).toBeInTheDocument()
      expect(screen.getByText('8 sur 10')).toBeInTheDocument()
    })

    it('met la remarque courte entre guillemets, en citation', () => {
      monter({ item: entree({ remarque: 'Une claque.' }) })

      expect(screen.getByText('« Une claque. »')).toBeInTheDocument()
    })

    it('n’imprime pas de citation quand il n’y a pas de remarque, ni quand elle est blanche', () => {
      const { unmount } = monter({ item: entree({ remarque: null }) })
      expect(screen.queryByText(/«/)).toBeNull()
      unmount()

      monter({ item: entree({ remarque: '   ' }) })
      expect(screen.queryByText(/«/)).toBeNull()
    })

    it('garde la remarque de cent dix caractères en citation : c’est la limite haute de « courte »', () => {
      const remarque = remarqueDe(110)
      monter({ item: entree({ remarque }) })

      // Mutation : le seuil `> 110` devenu `>= 110`.
      expect(screen.getByText(`« ${remarque} »`)).toBeInTheDocument()
    })

    it('sans note, dit « Vu le 2 octobre 2026, sans note. » et n’imprime aucune étoile', () => {
      monter({ item: entree({ note: null, remarque: null, date: '2026-10-02' }) })

      expect(screen.getByText('Vu le 2 octobre 2026, sans note.')).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: /^Noté/ })).toBeNull()
    })
  })

  describe('quand la remarque est longue : le texte en colonne', () => {
    const longue = remarqueDe(111)

    it('passe le texte en colonne, sans guillemets, au-delà de cent dix caractères', () => {
      monter({ item: entree({ remarque: longue }) })

      expect(screen.getByText(longue)).toBeInTheDocument()
      expect(screen.queryByText(/«/)).toBeNull()
    })

    it('met en chapeau les étoiles, le verdict et « 8 sur 10 »', () => {
      const { container } = monter({ item: entree({ note: 8, remarque: longue }) })

      const chapeau = container.querySelector(`.${styles.verdictImprime}`) as HTMLElement
      // Mutation : le chapeau retiré de la colonne, ou la note oubliée dedans.
      expect(within(chapeau).getByRole('img', { name: 'Noté 8 sur 10' })).toBeInTheDocument()
      expect(within(chapeau).getByText('Très bien')).toBeInTheDocument()
      expect(within(chapeau).getByText('8 sur 10')).toBeInTheDocument()
    })

    it('n’a pas de chapeau sans note', () => {
      const { container } = monter({ item: entree({ note: null, remarque: longue }) })

      expect(container.querySelector(`.${styles.verdictImprime}`)).toBeNull()
      expect(screen.getByText(longue)).toBeInTheDocument()
    })

    it('fait du texte une colonne, l’affiche à côté', () => {
      const { container } = monter({ item: entree({ remarque: longue }) })

      const colonne = container.querySelector(`.${styles.colonne}`) as HTMLElement
      expect(within(colonne).getByText(longue)).toBeInTheDocument()
      expect(colonne.querySelector('img')).toBeInTheDocument()
    })
  })

  describe('« En bref »', () => {
    const retrospective = (o: Partial<Extract<LigneEnBref, { type: 'suivi' }>> = {}): LigneEnBref => ({
      type: 'suivi',
      genre: 'Rétrospective',
      nom: 'Agnès Varda',
      vus: 10,
      total: 22,
      boucle: false,
      trous: ['vu', 'neuf', 'pas-encore'],
      ...o,
    })

    it('n’existe pas sans ligne : pas de seconde coupure', () => {
      monter({ item: entree(), enBref: [] })

      expect(screen.queryByText('En bref')).toBeNull()
    })

    it('est une seconde coupure, découpée d’un autre contour que la première', () => {
      const { container } = monter({ item: entree(), enBref: [retrospective()] })

      expect(screen.getByText('En bref')).toBeInTheDocument()
      const [critique, bref] = [...container.querySelectorAll(`.${styles.coupure}`)] as HTMLElement[]
      expect(bref!.style.getPropertyValue('--decoupe')).toBe(decoupe(`${ITEM.entry.id}:bref`))
      expect(bref!.style.getPropertyValue('--decoupe')).not.toBe(critique!.style.getPropertyValue('--decoupe'))
    })

    it('dit la rétrospective et son compte', () => {
      monter({ item: entree(), enBref: [retrospective()] })

      expect(screen.getByText('Rétrospective Agnès Varda.')).toBeInTheDocument()
      expect(screen.getByText(/10 séances sur 22\./)).toBeInTheDocument()
    })

    it('met « séance » au singulier pour une seule', () => {
      monter({ item: entree(), enBref: [retrospective({ vus: 1, total: 5 })] })

      expect(screen.getByText(/1 séance sur 5\./)).toBeInTheDocument()
    })

    it('ne dit « Bouclée ! » que quand la séance referme la rétrospective', () => {
      const { unmount } = monter({ item: entree(), enBref: [retrospective({ boucle: false })] })
      expect(screen.queryByText(/Bouclée/)).toBeNull()
      unmount()

      monter({ item: entree(), enBref: [retrospective({ boucle: true })] })
      // Mutation : le mot imprimé même quand rien n'est bouclé.
      expect(screen.getByText('Bouclée !')).toBeInTheDocument()
    })

    it('dit « Cycle … » pour une saga, et « Bouclé ! » au masculin', () => {
      monter({ item: entree(), enBref: [retrospective({ genre: 'Cycle', nom: 'Mad Max', boucle: true })] })

      expect(screen.getByText('Cycle Mad Max.')).toBeInTheDocument()
      expect(screen.getByText('Bouclé !')).toBeInTheDocument()
    })

    it('aligne un trou par film, celui de la séance marqué', () => {
      const { container } = monter({ item: entree(), enBref: [retrospective({ trous: ['vu', 'neuf', 'pas-encore', 'introuvable'] })] })

      const trous = [...container.querySelectorAll(`.${styles.trous} i`)]
      expect(trous.map((trou) => trou.getAttribute('data-etat'))).toEqual(['vu', 'neuf', 'pas-encore', 'introuvable'])
    })

    it('lie aussi par une espace insécable le titre en gras de la ligne de séance', () => {
      monter({ item: entree(), enBref: [{ type: 'seance', titre: 'Batman : Le Défi', rang: 2 }] })

      expect(screen.getByText(/^Batman.: Le Défi\.$/).textContent).toBe('Batman\u00a0: Le Défi.')
    })

    it('dit la deuxième séance d’un film déjà vu, avec son titre en tête', () => {
      monter({ item: entree(), enBref: [{ type: 'seance', titre: 'Rashōmon', rang: 2 }] })

      expect(screen.getByText('Rashōmon.')).toBeInTheDocument()
      expect(screen.getByText(/Deuxième séance au journal\./)).toBeInTheDocument()
    })

    it('dit le rang du film dans son mois', () => {
      monter({ item: entree(), enBref: [{ type: 'mois', mois: 'Octobre 2026', rang: 4 }] })

      expect(screen.getByText('Octobre 2026.')).toBeInTheDocument()
      expect(screen.getByText(/Quatrième film du mois\./)).toBeInTheDocument()
    })

    it('garde les lignes dans l’ordre où le formulaire les a données', () => {
      monter({
        item: entree(),
        enBref: [retrospective(), { type: 'seance', titre: 'Rashōmon', rang: 2 }, { type: 'mois', mois: 'Octobre 2026', rang: 4 }],
      })

      const lignes = screen.getAllByText(/Rétrospective Agnès Varda\.|Rashōmon\.|Octobre 2026\./).map((ligne) => ligne.textContent)
      expect(lignes).toEqual(['Rétrospective Agnès Varda.', 'Rashōmon.', 'Octobre 2026.'])
    })
  })

  describe('la suite', () => {
    it('propose « À l’accueil » et « Un autre film »', () => {
      monter({ item: entree() })

      // Mutation : les deux liens échangés.
      expect(screen.getByRole('link', { name: 'À l’accueil' })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: 'Un autre film' })).toHaveAttribute('href', '/recherche')
    })
  })
})
