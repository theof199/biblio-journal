import { describe, expect, it } from 'vitest'
import { aLAffiche, anneesDuCatalogue, catalogue, chercher, passage, plier } from './catalogue'
import { annee, fichePrete, filmDeSalle, salle } from '../test/voyage'

const train = filmDeSalle({ id: 'f-train', tmdb_id: 1, title: 'L’Arrivée d’un train en gare de La Ciotat', realisateur: 'Louis Lumière', etat: 'sur_le_plex' })
const fee = filmDeSalle({ id: 'f-fee', tmdb_id: 2, title: 'La Fée aux choux', realisateur: 'Alice Guy', etat: 'vu', note: 8 })
const manoir = filmDeSalle({ id: 'f-manoir', tmdb_id: 3, title: 'Le Manoir du diable', realisateur: 'Georges Méliès', etat: 'a_demander' })
const programme = filmDeSalle({
  id: 'f-prog',
  tmdb_id: 4,
  title: 'Programme Lumière',
  realisateur: 'Louis Lumière',
  etat: 'sur_le_plex',
  programme: {
    duree_min: 2,
    bobines: [
      { tmdb_id: 5, title: 'L’Arroseur arrosé', duree_min: 1, cover_url: null, plex_url: null, etat: 'vu' },
      { tmdb_id: 6, title: 'Le Repas de bébé', duree_min: 1, cover_url: null, plex_url: null, etat: 'a_demander' },
    ],
  },
})
const F1896 = fichePrete({
  annee: 1896,
  // « Ailleurs » a une clé, sans être la salle des essentiels.
  salles: [salle({ id: 's-ess', cle: 'essentiels', films: [train, fee] }), salle({ id: 's-truc', cle: 'ailleurs', films: [manoir, { ...train, id: 'f-train-bis' }] })],
})
const F1895 = fichePrete({ annee: 1895, salles: [salle({ id: 's-95', cle: 'essentiels', films: [programme] })] })

describe('les années du catalogue', () => {
  // Mutations : lire une année non visitée (le chroniqueur l'ouvrirait) ; une verrouillée ; une d'une autre décennie.
  it('ne lisent que les fiches déjà écrites et ouvertes de la décennie', () => {
    const annees = [
      annee({ annee: 1895, statut: 'ouverte', visitee: true }),
      annee({ annee: 1896, statut: 'en_cours', visitee: true }),
      annee({ annee: 1897, statut: 'ouverte', visitee: false }),
      annee({ annee: 1898, statut: 'verrouillee', visitee: true }),
      annee({ annee: 1900, statut: 'ouverte', visitee: true }),
    ]
    expect(anneesDuCatalogue(annees, 1890)).toEqual([1895, 1896])
  })
})

describe('le catalogue des vues', () => {
  // Mutations : un film de deux salles compté deux fois ; les bobines oubliées ; la salle des essentiels mal lue.
  it('prend chaque film une fois, puis les bobines de son programme', () => {
    const vues = catalogue([F1895, F1896])
    expect(vues.map((v) => [v.annee, v.filmId, v.tmdbId, v.essentiel])).toEqual([
      [1895, 'f-prog', 4, true],
      [1895, 'f-prog', 5, true],
      [1895, 'f-prog', 6, true],
      [1896, 'f-train', 1, true],
      [1896, 'f-fee', 2, true],
      [1896, 'f-manoir', 3, false],
    ])
    // Une bobine n'a ni réalisateur ni note au contrat ; son état est le sien.
    expect(vues[1]).toMatchObject({ titre: 'L’Arroseur arrosé', realisateur: '', etat: 'vu', note: null })
  })
})

describe('le pliage', () => {
  // Mutations : les accents gardés ; l'apostrophe typographique gardée ; « œ » non déplié.
  it('ôte accents et casse, redresse l’apostrophe, déplie les ligatures', () => {
    expect(plier('L’Arrivée').plie).toBe("l'arrivee")
    expect(plier('Cœur').plie).toBe('coeur')
    expect(plier('ÉMILE').plie).toBe('emile')
  })

  // Mutation : la position du caractère plié plutôt que celle d'origine (le passage souligné glisserait).
  it('souligne le passage trouvé dans le titre tel qu’il s’écrit', () => {
    expect(passage('L’Arrivée d’un train', "l'arrivee")).toEqual({ avant: '', trouve: 'L’Arrivée', apres: ' d’un train' })
    expect(passage('Le Cœur de la ville', 'coeur')).toEqual({ avant: 'Le ', trouve: 'Cœur', apres: ' de la ville' })
    expect(passage('Le Manoir du diable', 'xyz')).toBeNull()
    expect(passage('Le Manoir du diable', '   ')).toBeNull()
  })

  // Mutation : la fin prise au caractère suivant (une moitié de ligature soulignerait le caractère d'après).
  it('souligne la ligature entière quand la saisie s’arrête en son milieu', () => {
    expect(passage('Cœur', 'co')).toEqual({ avant: '', trouve: 'Cœ', apres: 'ur' })
  })
})

describe('le guichet', () => {
  const vues = catalogue([F1895, F1896])

  // Mutations : le réalisateur ignoré ; la saisie non pliée ; le filtre d'années retiré, ou inversé.
  it('trouve par le titre ou le réalisateur, sans accents, dans les années cochées', () => {
    expect(chercher(vues, 'melies', new Set()).map((v) => v.tmdbId)).toEqual([3])
    expect(chercher(vues, 'FÉE', new Set()).map((v) => v.tmdbId)).toEqual([2])
    expect(chercher(vues, 'lumiere', new Set([1896])).map((v) => v.tmdbId)).toEqual([1])
    expect(chercher(vues, '', new Set([1895])).map((v) => v.tmdbId)).toEqual([4, 5, 6])
  })

  // Mutations : un essentiel vu à l'affiche ; un film hors des essentiels ; l'ordre des années ; plus de six.
  it('met à l’affiche, sans saisie, les essentiels pas encore vus, l’année la plus récente d’abord', () => {
    expect(aLAffiche(vues).map((v) => v.tmdbId)).toEqual([1, 4, 6])
    const nombreux = catalogue([
      fichePrete({ annee: 1897, salles: [salle({ id: 's', cle: 'essentiels', films: Array.from({ length: 8 }, (_, i) => filmDeSalle({ id: `x${i}`, tmdb_id: 100 + i, etat: 'a_demander' })) })] }),
    ])
    expect(aLAffiche(nombreux)).toHaveLength(6)
  })
})
