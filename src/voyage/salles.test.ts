import { describe, expect, it } from 'vitest'
import {
  ampoules,
  autresPistes,
  brouillonSuivant,
  compteDeLaSalle,
  contexteLisible,
  doitDemanderContexte,
  etiquetteEtat,
  pistesApresUsage,
  porteDeLEtagere,
  salleComplete,
  zoneNouvelleSalle,
} from './salles'
import { filmDeSalle, salle } from '../test/voyage'

const f = (id: string, etat: 'vu' | 'sur_le_plex' | 'demande' | 'a_demander' | 'introuvable') => filmDeSalle({ id, tmdb_id: Number(id), etat })

describe('une salle', () => {
  // Mutations : `every` remplacé par `some` ; l'introuvable oublié dans `acquis` ; la garde de la salle vide retirée.
  it('n’est complète qu’avec au moins un film, tous vus ou introuvables', () => {
    expect(salleComplete(salle({ id: 's', films: [f('1', 'vu'), f('2', 'introuvable')] }))).toBe(true)
    expect(salleComplete(salle({ id: 's', films: [f('1', 'vu'), f('2', 'sur_le_plex')] }))).toBe(false)
    expect(salleComplete(salle({ id: 's', films: [] }))).toBe(false)
  })

  // Mutation : allumer un introuvable (la maquette le laisse éteint).
  it('allume une ampoule par film vu, jamais pour un introuvable', () => {
    expect(ampoules(salle({ id: 's', films: [f('1', 'vu'), f('2', 'introuvable'), f('3', 'a_demander')] }))).toEqual([true, false, false])
  })

  it('compte ses films vus', () => {
    expect(compteDeLaSalle(salle({ id: 's', films: [f('1', 'vu'), f('2', 'vu'), f('3', 'demande')] }))).toBe('2 vus sur 3')
    expect(compteDeLaSalle(salle({ id: 's', films: [f('1', 'vu'), f('2', 'demande')] }))).toBe('1 vu sur 2')
  })

  // Mutation : compter les films `acquis` : un introuvable passerait pour vu, jumeau de l'ampoule éteinte.
  it('ne compte jamais un introuvable parmi les vus', () => {
    expect(compteDeLaSalle(salle({ id: 's', films: [f('1', 'vu'), f('2', 'introuvable')] }))).toBe('1 vu sur 2')
  })
})

describe('la porte de l’étagère', () => {
  // Mutation : l'ordre des deux premiers tests inversé montrerait « Salle épuisée » pendant une fournée.
  it('dit qu’une salle se remplit avant tout, puis qu’elle est épuisée', () => {
    expect(porteDeLEtagere({ fournee_en_cours: true, epuisee: true }, true)).toEqual({ texte: 'La salle se remplit…', geste: false })
    expect(porteDeLEtagere({ fournee_en_cours: false, epuisee: true }, true)).toEqual({ texte: 'Salle épuisée', geste: false })
    expect(porteDeLEtagere({ fournee_en_cours: false, epuisee: false }, true)).toEqual({ texte: 'En voir plus', geste: true })
  })

  // Mutation : ignorer `ia` offre « En voir plus » à un membre que l'API refuse (403).
  it('n’offre jamais « En voir plus » à un membre hors IA', () => {
    expect(porteDeLEtagere({ fournee_en_cours: false, epuisee: false }, false)).toBeNull()
    expect(porteDeLEtagere({ fournee_en_cours: false, epuisee: true }, false)).toEqual({ texte: 'Salle épuisée', geste: false })
  })
})

describe('le contexte d’une salle', () => {
  // Mutation : `|| ia` retiré cacherait le contexte au compte IA ; `contexte !== null` retiré l'offrirait hors IA.
  it('se lit s’il est écrit, et ne se demande qu’au compte IA', () => {
    expect(contexteLisible({ contexte: 'Un texte.' }, false)).toBe(true)
    expect(contexteLisible({ contexte: null }, false)).toBe(false)
    expect(contexteLisible({ contexte: null }, true)).toBe(true)
  })

  // Mutation : toujours appeler : chaque ouverture coûterait un appel au chroniqueur.
  it('ne part chez le chroniqueur que si rien n’est écrit', () => {
    expect(doitDemanderContexte({ contexte: 'Un texte.' })).toBe(false)
    expect(doitDemanderContexte({ contexte: null })).toBe(true)
  })
})

describe('l’étiquette d’un état', () => {
  it('prend le mot du monde pour un introuvable', () => {
    expect(etiquetteEtat('introuvable', 'perdu')).toBe('perdu')
    expect(etiquetteEtat('introuvable', 'introuvable')).toBe('introuvable')
    expect(etiquetteEtat('a_demander', 'perdu')).toBe('à voir')
    expect(etiquetteEtat('sur_le_plex', 'perdu')).toBe('sur ton Plex')
    expect(etiquetteEtat('demande', 'perdu')).toBe('demandé')
  })
})

describe('la nouvelle salle', () => {
  it('montre la salle qui s’écrit, le refus, ou le bouton', () => {
    expect(zoneNouvelleSalle({ statut: 'en_cours' })).toBe('fantome')
    expect(zoneNouvelleSalle({ statut: 'refusee' })).toBe('refus')
    expect(zoneNouvelleSalle({ statut: 'creee' })).toBe('bouton')
    expect(zoneNouvelleSalle(null)).toBe('bouton')
  })

  // Mutation : `p.nom === utilisee` garderait la seule piste utilisée.
  it('retire la seule piste utilisée', () => {
    const pistes = [
      { nom: 'A', raison: 'a' },
      { nom: 'B', raison: 'b' },
    ]
    expect(pistesApresUsage(pistes, 'A')).toEqual([{ nom: 'B', raison: 'b' }])
    expect(pistesApresUsage(pistes, null)).toEqual(pistes)
  })

  it('n’offre d’autres pistes que quand il n’en reste aucune', () => {
    expect(autresPistes([])).toBe(true)
    expect(autresPistes([{ nom: 'A', raison: 'a' }])).toBe(false)
  })

  // Mutation : `{ texte, piste: null }` à l'écriture oublierait la piste touchée à l'envoi.
  it('garde la piste touchée même quand on réécrit le texte', () => {
    const touche = brouillonSuivant({ texte: '', piste: null }, { type: 'piste', piste: { nom: 'Les fantômes', raison: 'r' } })
    expect(touche).toEqual({ texte: 'Les fantômes', piste: 'Les fantômes' })
    expect(brouillonSuivant(touche, { type: 'ecrire', texte: 'Les fantômes de 1897' })).toEqual({ texte: 'Les fantômes de 1897', piste: 'Les fantômes' })
  })
})
