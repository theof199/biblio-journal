import { describe, expect, it } from 'vitest'
import {
  affichesDeColonne,
  apercuLitLaFiche,
  detecterFrontiereAvancee,
  etatDeCase,
  compterRecompenses,
  jauge,
  prochainPas,
  recompensesJusquaAnneeEnCours,
  ticketOffert,
} from './regles'
import { annee, fichePrete } from '../test/voyage'

const P = (vus: number, total: number, completes: number) => ({
  essentiels_vus: vus,
  essentiels_total: total,
  salles_completes: completes,
  salles_autres: 3,
})

describe('les récompenses du HUD', () => {
  // Mutation : `<` au lieu de `<=` écarte l'année en cours elle-même.
  it('comptent l’année en cours, jamais une année postérieure', () => {
    const annees = [annee({ annee: 1897, recompense: 'lion' }), annee({ annee: 1898, recompense: 'ours' }), annee({ annee: 1899, recompense: 'ours' })]
    expect(recompensesJusquaAnneeEnCours(annees, 1898)).toEqual(['lion', 'ours'])
  })

  // Mutation : `compte[r] = 1` au lieu de `+= 1` plafonne chaque sorte à une récompense.
  it('se comptent une à une, par sorte', () => {
    expect(compterRecompenses(['ours', 'lion', 'ours', 'ours'])).toEqual({ palme: 0, lion: 1, ours: 3 })
  })
})

describe('prochainPas', () => {
  // Mutation : retirer la garde `recompense !== 'lion'` fait dire « encore 1 essentiel » à un Lion
  // obtenu par un introuvable (essentiels_vus ne le compte pas).
  it('se tait sur le Lion une fois le Lion acquis, même si un essentiel n’est pas « vu »', () => {
    expect(prochainPas(4, P(2, 3, 0), 'lion', true, true)).toEqual(['Palme : 2 salles de plus'])
  })

  // Mutation : la garde du Lion réduite à `recompense !== 'lion'` réclame un essentiel à une Palme
  // dont un essentiel est introuvable.
  it('se tait sur le Lion sous la Palme aussi', () => {
    expect(prochainPas(4, P(2, 3, 2), 'palme', true, true)).toEqual([])
  })

  // Mutation : la garde de l'Ours remplacée par `if (true)` réclame des films à un Lion obtenu par
  // des introuvables, qui ne comptent pas dans la profondeur.
  it('se tait sur l’Ours dès qu’une récompense est acquise, même sous trois films', () => {
    expect(prochainPas(0, P(0, 2, 0), 'lion', true, true)).toEqual(['Palme : 2 salles de plus'])
  })

  it('compte l’Ours, le Lion et la Palme d’une année commencée', () => {
    expect(prochainPas(1, P(1, 3, 1), null, true, true)).toEqual([
      'Ours : encore 2 films',
      'Lion : encore 2 essentiels',
      'Palme : 1 salle de plus',
    ])
  })

  // Mutation : ignorer `ia` promet un jury à un membre qui n'en a pas.
  it('ne promet jamais de jury à un membre hors IA', () => {
    expect(prochainPas(3, P(3, 3, 2), 'palme', false, false)).toEqual(['Ticket : au Lion'])
    expect(prochainPas(3, P(3, 3, 2), 'palme', false, true)).toEqual(['Ticket : au Lion, ou plus tôt si le jury le décide'])
  })

  it('ne dit rien sans progression (année pas encore ouverte)', () => {
    expect(prochainPas(0, null, null, false, true)).toEqual([])
  })
})

describe('la jauge', () => {
  it('vise le Lion tant qu’il manque, puis la Palme', () => {
    expect(jauge(P(3, 5, 0), 'ours')).toEqual({ vus: 3, total: 5 })
    expect(jauge(P(4, 5, 1), 'lion')).toEqual({ vus: 1, total: 2 })
    expect(jauge(P(5, 5, 2), 'palme')).toEqual({ vus: 2, total: 2 })
  })

  // Mutation : retirer le test `essentiels_total === 0` rend une jauge 0/0 (division par zéro au tracé).
  it('n’existe pas sans essentiel connu ni sans progression', () => {
    expect(jauge(P(0, 0, 0), null)).toBeNull()
    expect(jauge(null, null)).toBeNull()
  })
})

describe('l’état d’une case', () => {
  it('suit le statut, puis la récompense', () => {
    expect(etatDeCase(annee({ annee: 1899, statut: 'verrouillee' }), true).etat).toBe('verrou')
    expect(etatDeCase(annee({ annee: 1898, statut: 'en_cours', recompense: 'ours' }), true).etat).toBe('encours')
    expect(etatDeCase(annee({ annee: 1897, statut: 'ouverte', recompense: 'lion' }), true).etat).toBe('lion')
    expect(etatDeCase(annee({ annee: 1896, statut: 'ouverte', recompense: null }), true).etat).toBe('passee')
  })

  // Mutation : oublier `!ia` met « Théo est trop lent » sur l'année que le compte IA n'a
  // simplement pas encore visitée. Oublier `!a.visitee` le met sur toutes les années déjà écrites.
  it('n’est en attente que pour un membre hors IA, sur une année lisible non ouverte', () => {
    const nonVisitee = annee({ annee: 1898, statut: 'en_cours', visitee: false })
    expect(etatDeCase(nonVisitee, false).attente).toBe(true)
    expect(etatDeCase(nonVisitee, true).attente).toBe(false)
    expect(etatDeCase(annee({ annee: 1899, statut: 'verrouillee', visitee: false }), false).attente).toBe(false)
    expect(etatDeCase(annee({ annee: 1897, statut: 'ouverte', visitee: true }), false).attente).toBe(false)
  })
})

describe('l’aperçu', () => {
  // Mutation : lire la fiche d'une année non visitée enfile une ouverture chez le chroniqueur.
  it('ne lit la fiche que d’une année déjà écrite et non verrouillée', () => {
    expect(apercuLitLaFiche(annee({ annee: 1898, statut: 'en_cours', visitee: false }))).toBe(false)
    expect(apercuLitLaFiche(annee({ annee: 1899, statut: 'verrouillee', visitee: true }))).toBe(false)
    expect(apercuLitLaFiche(annee({ annee: 1897, statut: 'ouverte', visitee: true }))).toBe(true)
  })
})

describe('la colonne Morris', () => {
  it('sans fiche en cache, montre la seule affiche connue de la carte', () => {
    expect(affichesDeColonne(annee({ annee: 1897, affiche_url: 'https://a/1.jpg' }), undefined)).toEqual(['https://a/1.jpg'])
    expect(affichesDeColonne(annee({ annee: 1897, affiche_url: null }), undefined)).toEqual([])
  })

  // Mutation : `vues.size < 4` retiré, ou le tri inversé.
  it('pose le podium, puis les meilleures notes, quatre au plus et sans doublon', () => {
    const fiche = fichePrete()
    const film = fiche.salles[0]!.films[0]!
    const vu = (url: string, note: number) => ({ ...film, etat: 'vu' as const, cover_url: url, note })
    fiche.podium = [{ ...fiche.podium[0]!, cover_url: 'https://a/p1.jpg' }, null, null]
    fiche.salles = [{ ...fiche.salles[0]!, films: [vu('https://a/n6.jpg', 6), vu('https://a/p1.jpg', 10), vu('https://a/n9.jpg', 9), vu('https://a/n8.jpg', 8), vu('https://a/n7.jpg', 7)] }]
    expect(affichesDeColonne(annee({ annee: 1897 }), fiche)).toEqual(['https://a/p1.jpg', 'https://a/n9.jpg', 'https://a/n8.jpg', 'https://a/n7.jpg'])
  })
})

describe('la frontière qui avance', () => {
  // Mutation : rendre une avancée quand `avant` est nul rejoue la marche à chaque première ouverture ;
  // `apres === avant` au lieu de `apres <= avant` fait marcher l'avatar à reculons.
  it('ne rejoue rien à la première ouverture ni sans avancée', () => {
    expect(detecterFrontiereAvancee(null, 1898)).toBeNull()
    expect(detecterFrontiereAvancee(1898, 1898)).toBeNull()
    expect(detecterFrontiereAvancee(1899, 1897)).toBeNull()
  })

  // Mutation : comparer les années au lieu des décennies passe toujours la porte.
  it('ne passe la porte qu’en changeant de décennie', () => {
    expect(detecterFrontiereAvancee(1897, 1898)).toEqual({ anneeQuittee: 1897, decennieQuittee: null })
    expect(detecterFrontiereAvancee(1899, 1900)).toEqual({ anneeQuittee: 1899, decennieQuittee: 1890 })
  })
})

describe('le ticket offert', () => {
  const t = (annee: number, utiliseLe: string | null = null) => ({ annee, motif: '', emis_le: '2026-09-01T00:00:00.000Z', montre_le: null, utilise_le: utiliseLe })

  // Mutations : la garde `utilise_le === null` retirée ; `anneeEnCours + 1` remplacé par tout ticket non utilisé.
  it('n’est que celui de l’année qui suit, pas encore utilisé', () => {
    expect(ticketOffert(1897, [t(1898), t(1899)])?.annee).toBe(1898)
    expect(ticketOffert(1897, [t(1898, '2026-09-02T00:00:00.000Z')])).toBeUndefined()
    expect(ticketOffert(1897, [t(1899)])).toBeUndefined()
    expect(ticketOffert(1897, [t(1897)])).toBeUndefined()
  })
})
