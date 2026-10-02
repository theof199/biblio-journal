/** « d'» devant une voyelle (un `Y` compris, « d’Yves »), « de » sinon : « d’Éric Rohmer », « de Chantal Akerman ». */
const commenceParUneVoyelle = (nom: string): boolean => /^[aeiouy]/i.test(nom.normalize('NFD'))

/**
 * La ligne sous le titre d'une coupure : « de Chantal Akerman, 1975 », « d’Éric Rohmer, 1969 ». Un
 * film sans réalisateur n'a que son année, un film sans année que son réalisateur ; vide sans l'un ni l'autre.
 */
export function legendeDeFilm(realisateur: string | null | undefined, annee: number | null | undefined): string {
  const nom = realisateur?.trim()
  const auteur = nom ? `${commenceParUneVoyelle(nom) ? 'd’' : 'de '}${nom}` : null
  return [auteur, annee != null ? String(annee) : null].filter(Boolean).join(', ')
}
