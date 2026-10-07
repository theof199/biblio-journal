import { describe, expect, it } from 'vitest'
import { aLAffiche, anneesDuCatalogue, catalogue, chercher, passage, plier } from './catalogue'
import { numeroDeLaSalle } from './salles'
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
      // La dernière année de la décennie en est : une borne stricte la perdrait.
      annee({ annee: 1899, statut: 'ouverte', visitee: true }),
      annee({ annee: 1900, statut: 'ouverte', visitee: true }),
    ]
    expect(anneesDuCatalogue(annees, 1890)).toEqual([1895, 1896, 1899])
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

  // La voie d'une vue est le numéro que la fiche d'année donne à sa salle (`numeroDeLaSalle`, la règle
  // du brief 3), celle de la ligne qui ouvre la fiche du film. Les rangs ne suivent pas l'ordre de la
  // réponse, et la première salle n'a pas le rang 1. Mutations : un numéro recalculé ici (`i + 1`, la
  // place de la salle dans la réponse) ; la voie de la dernière salle où le film paraît ; une bobine
  // sans la voie de son programme.
  it('donne à chaque vue la voie de sa salle, celle de la fiche d’année', () => {
    const haut = salle({ id: 's-haut', rang: 7, cle: null, films: [manoir, programme] })
    const bas = salle({ id: 's-bas', rang: 2, cle: 'essentiels', films: [train, { ...manoir, id: 'f-manoir-bis' }] })
    const vues = catalogue([fichePrete({ annee: 1896, salles: [haut, bas] })])
    expect(vues.map((v) => [v.filmId, v.tmdbId, v.voie])).toEqual([
      ['f-manoir', 3, 7],
      ['f-prog', 4, 7],
      ['f-prog', 5, 7],
      ['f-prog', 6, 7],
      ['f-train', 1, 2],
    ])
    expect(vues.map((v) => v.voie)).toEqual([haut, haut, haut, haut, bas].map(numeroDeLaSalle))
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

  // Un caractère hors du plan de base (un emoji, deux unités UTF-16) : les positions se comptent en
  // unités, comme `indexOf` et `slice`. Mutation : une position par caractère plié (le passage glisse
  // d'une unité après l'emoji).
  it('souligne le bon passage après un caractère de deux unités', () => {
    expect(passage('🎬 L’Arrivée', 'arrivee')).toEqual({ avant: '🎬 L’', trouve: 'Arrivée', apres: '' })
  })

  // Un titre typographié porte des espaces insécables (« Que la fête commence ! ») ; un clavier de
  // téléphone en double une par mégarde. Mutations : l'insécable gardée ; les espaces de la saisie
  // non resserrées.
  it('tient toute espace pour une espace, et resserre celles de la saisie', () => {
    expect(passage('Que la fête commence\u00a0!', 'commence !')).toEqual({ avant: 'Que la fête ', trouve: 'commence\u00a0!', apres: '' })
    expect(passage('Le\u202fManoir', 'le manoir')).toEqual({ avant: '', trouve: 'Le\u202fManoir', apres: '' })
    expect(passage('Georges Méliès', ' georges   melies ')).toEqual({ avant: '', trouve: 'Georges Méliès', apres: '' })
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

  // Le jumeau de `passage` : la saisie se resserre aussi pour trouver, pas seulement pour souligner.
  // Mutation : `chercher` sur la saisie seulement rognée.
  it('trouve une saisie aux espaces doublées', () => {
    expect(chercher(vues, ' georges  melies ', new Set()).map((v) => v.tmdbId)).toEqual([3])
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
