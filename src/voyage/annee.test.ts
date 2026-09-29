import { describe, expect, it } from 'vitest'
import {
  afficherGenerique,
  avancees,
  billetsDeProgression,
  chemin,
  doitGuetterVerdict,
  estUnPalier,
  ligneDuBas,
  phraseDuChemin,
  statutDeLAnnee,
  verdictAChange,
  vusEnAvance,
} from './annee'
import { visionnage } from '../test/journal'

const P = (vus: number, total: number, completes: number, autres = 3) => ({
  essentiels_vus: vus,
  essentiels_total: total,
  salles_completes: completes,
  salles_autres: autres,
})
const TICKET = { annee: 1897, emis_le: '2026-09-21T21:00:00.000Z', utilise_le: null }
const VERDICT = { mure: false, motif: 'Il manque encore deux essentiels.', jugee_le: '2026-09-21T21:00:00.000Z' }

describe('le statut d’une année', () => {
  // Mutations : `<=` au lieu de `<` (l'année en cours passerait pour ouverte) ; l'égalité oubliée.
  it('suit l’année en cours de la carte, comme le back', () => {
    expect(statutDeLAnnee(1896, 1897)).toBe('ouverte')
    expect(statutDeLAnnee(1897, 1897)).toBe('en_cours')
    expect(statutDeLAnnee(1898, 1897)).toBe('verrouillee')
  })
})

describe('les billets de la corde', () => {
  it('comptent films, essentiels et salles complètes, au singulier jusqu’à un', () => {
    expect(billetsDeProgression(3, P(1, 5, 0))).toEqual([
      { cle: 'films', valeur: 3, total: null, libelle: 'films vus' },
      { cle: 'essentiels', valeur: 1, total: 5, libelle: 'essentiel' },
      { cle: 'salles', valeur: 0, total: 3, libelle: 'salle complète' },
    ])
    expect(billetsDeProgression(1, P(2, 5, 2)).map((b) => b.libelle)).toEqual(['film vu', 'essentiels', 'salles complètes'])
  })

  // Mutation : retirer le cas `essentiels_total === 0` affiche « 0 essentiel sur 0 ».
  it('disent « Aucun essentiel encore » plutôt que zéro sur zéro', () => {
    expect(billetsDeProgression(2, P(0, 0, 0)).map((b) => b.cle)).toEqual(['films', 'aucun-essentiel'])
  })

  // Mutation : ignorer `progression` nulle fait lire ses champs (et lever).
  it('ne montrent que les films tant que la progression est inconnue', () => {
    expect(billetsDeProgression(0, null)).toEqual([{ cle: 'films', valeur: 0, total: null, libelle: 'film vu' }])
  })
})

describe('les avancées au retour d’un enregistrement', () => {
  // Mutations : `>=` au lieu de `>` (un billet immobile volerait) ; une avancée des salles oubliée.
  it('ne rendent que les billets qui ont gagné, de leur ancienne valeur à la nouvelle', () => {
    expect(avancees({ profondeur: 2, progression: P(1, 5, 0) }, { profondeur: 3, progression: P(2, 5, 0) })).toEqual([
      { cle: 'films', avant: 2, apres: 3 },
      { cle: 'essentiels', avant: 1, apres: 2 },
    ])
    expect(avancees({ profondeur: 3, progression: P(2, 5, 0) }, { profondeur: 3, progression: P(2, 5, 1) })).toEqual([
      { cle: 'salles', avant: 0, apres: 1 },
    ])
  })

  it('ne comptent jamais un recul, ni une progression inconnue d’un côté', () => {
    expect(avancees({ profondeur: 3, progression: P(2, 5, 1) }, { profondeur: 2, progression: P(1, 5, 0) })).toEqual([])
    expect(avancees({ profondeur: 2, progression: null }, { profondeur: 2, progression: P(2, 5, 1) })).toEqual([])
  })
})

describe('les paliers', () => {
  // Mutations : l'Ours à un autre seuil que `OURS_FILMS_MIN` ; le Lion sans la garde du total nul.
  it('sont l’Ours à trois films, le Lion au dernier essentiel, la Palme à deux salles', () => {
    expect(estUnPalier('films', 3, P(0, 5, 0))).toBe(true)
    expect(estUnPalier('films', 4, P(0, 5, 0))).toBe(false)
    expect(estUnPalier('essentiels', 5, P(5, 5, 0))).toBe(true)
    expect(estUnPalier('essentiels', 4, P(4, 5, 0))).toBe(false)
    expect(estUnPalier('essentiels', 0, P(0, 0, 0))).toBe(false)
    expect(estUnPalier('salles', 2, P(0, 5, 2))).toBe(true)
    expect(estUnPalier('salles', 1, P(0, 5, 1))).toBe(false)
  })

  // Mutation : `valeur >= 2` pour la Palme : une troisième salle complète rejouerait le palier.
  it('ne se franchissent qu’une fois, jamais au-delà du seuil', () => {
    expect(estUnPalier('salles', 3, P(0, 5, 3))).toBe(false)
  })
})

describe('la ligne du bas', () => {
  // Mutation : le verdict avant le ticket cacherait « Utiliser » derrière un « pas encore mûre » périmé.
  it('montre le ticket qui attend avant tout verdict', () => {
    expect(ligneDuBas(TICKET, VERDICT, 1896)).toEqual({ type: 'ticket', annee: 1897 })
  })

  it('montre le billet déjà utilisé, avec sa date', () => {
    expect(ligneDuBas({ ...TICKET, utilise_le: '2026-09-22T08:00:00.000Z' }, null, 1897)).toEqual({
      type: 'billet',
      annee: 1897,
      utiliseLe: '2026-09-22T08:00:00.000Z',
    })
  })

  // Mutation : `!maturite.mure` retiré dirait « pas encore mûre » d'une année jugée mûre.
  it('ne dit « pas encore mûre » que d’un verdict négatif', () => {
    expect(ligneDuBas(null, VERDICT, 1896)).toEqual({ type: 'jury', motif: VERDICT.motif })
    expect(ligneDuBas(null, { ...VERDICT, mure: true }, 1896)).toBeNull()
    expect(ligneDuBas(null, null, 1896)).toBeNull()
  })

  // Mutation : `ticket.annee > anneeEnCours` retiré : un membre qui rattrape le Voyage suivi
  // encaisserait un ticket vers une année déjà ouverte, qui n'ouvre plus rien.
  it('n’offre jamais un ticket vers une année déjà ouverte', () => {
    expect(ligneDuBas(TICKET, VERDICT, 1897)).toEqual({ type: 'jury', motif: VERDICT.motif })
    expect(ligneDuBas(TICKET, null, 1898)).toBeNull()
  })
})

describe('le guet du verdict', () => {
  // Mutation : `relu !== avant` remplacé par `relu !== null` arrêterait le guet sur l'ancien verdict.
  it('s’arrête sur un verdict neuf ou un ticket, jamais sur le même verdict', () => {
    expect(verdictAChange('2026-09-21T21:00:00.000Z', '2026-09-21T21:00:00.000Z', null)).toBe(false)
    expect(verdictAChange('2026-09-21T21:00:00.000Z', '2026-09-22T09:00:00.000Z', null)).toBe(true)
    expect(verdictAChange(null, '2026-09-22T09:00:00.000Z', null)).toBe(true)
    expect(verdictAChange('2026-09-21T21:00:00.000Z', '2026-09-21T21:00:00.000Z', TICKET)).toBe(true)
  })

  // Mutations : chaque garde retirée, une à une (`ia`, `creation`, l'année de sortie).
  it('ne guette qu’après une création, au compte IA, pour un film sorti l’année en cours', () => {
    const base = { ia: true, creation: true, anneeDuFilm: 1897, anneeEnCours: 1897 }
    expect(doitGuetterVerdict(base)).toBe(true)
    expect(doitGuetterVerdict({ ...base, ia: false })).toBe(false)
    expect(doitGuetterVerdict({ ...base, creation: false })).toBe(false)
    expect(doitGuetterVerdict({ ...base, anneeDuFilm: 1896 })).toBe(false)
    expect(doitGuetterVerdict({ ...base, anneeDuFilm: null })).toBe(false)
  })
})

describe('le générique', () => {
  // Mutation : `ticket.utilise_le !== null` en plus cacherait le générique de l'année qui vient de gagner son ticket.
  it('existe dès le ticket de l’année, utilisé ou non', () => {
    expect(afficherGenerique(TICKET)).toBe(true)
    expect(afficherGenerique({ ...TICKET, utilise_le: '2026-09-22T08:00:00.000Z' })).toBe(true)
    expect(afficherGenerique(null)).toBe(false)
  })
})

describe('le chemin d’une année fermée', () => {
  it('va de l’année en cours à elle', () => {
    expect(chemin(1897, 1896)).toEqual([1896, 1897])
    expect(chemin(1899, 1896)).toEqual([1896, 1897, 1898, 1899])
  })

  // Mutation : promettre le jury sans regarder `ia`.
  it('ne promet le jury qu’au compte IA', () => {
    expect(phraseDuChemin(1897, 1896, { ia: true, rattrape: null })).toBe('Encore un ticket : le Lion de 1896, ou plus tôt si le jury le décide.')
    expect(phraseDuChemin(1897, 1896, { ia: false, rattrape: null })).toBe('Encore un ticket : le Lion de 1896.')
  })

  // Mutation : taire le Voyage suivi : un membre qui rattrape croirait n'avoir que son ticket.
  it('dit au membre qui rattrape que l’année s’ouvre aussi avec le Voyage suivi', () => {
    expect(phraseDuChemin(1897, 1896, { ia: false, rattrape: 'theo' })).toBe('Encore un ticket : le Lion de 1896, ou dès que theo y arrive.')
    expect(phraseDuChemin(1899, 1896, { ia: false, rattrape: 'theo' })).toBe('Encore 3 tickets, un par année, depuis 1896, ou dès que theo y arrive.')
  })

  // Mutation : ajouter le jury à la suite du Voyage suivi : les deux promesses iraient ensemble.
  it('ne promet jamais le jury et le Voyage suivi ensemble', () => {
    expect(phraseDuChemin(1897, 1896, { ia: true, rattrape: 'theo' })).toBe('Encore un ticket : le Lion de 1896, ou dès que theo y arrive.')
  })

  it('compte les tickets qui manquent au-delà d’un', () => {
    expect(phraseDuChemin(1899, 1896, { ia: true, rattrape: null })).toBe('Encore 3 tickets, un par année, depuis 1896.')
  })
})

describe('les films vus en avance', () => {
  // Mutations : le filtre d'année retiré ; le doublon gardé ; une série comptée.
  it('ne gardent que mes films de l’année, une fois chacun, au visionnage le plus récent', () => {
    const items = [
      visionnage({ id: 'e3', media: 'm1', annee: 1897, date: '2026-09-20' }),
      visionnage({ id: 'e2', media: 'm2', annee: 1898, date: '2026-09-19' }),
      visionnage({ id: 'e1', media: 'm1', annee: 1897, date: '2026-09-01' }),
    ]
    const serie = visionnage({ id: 'e4', media: 'm4', annee: 1897, date: '2026-08-01' })
    serie.media.type = 'tv'
    expect(vusEnAvance([...items, serie], 1897).map((i) => i.entry.id)).toEqual(['e3'])
  })
})
