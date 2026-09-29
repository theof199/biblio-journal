import type { Rampe } from '../rampe'

/**
 * La roulotte de qui mène le Voyage (maquette du 29 septembre 2026 : `roulotte`, `roulotteCarte`) :
 * garée par le moteur sur l'année où ce Voyage est rendu, pour tout autre membre.
 */
/** `planche` : la suite d'images de la roulotte (`carte/assets/roulotte.webp`), nulle tant qu'elle manque ou charge ; le dessin de la maquette tient alors sa place. */
export function dessinerRoulotte(g: CanvasRenderingContext2D, x: number, y: number, dir: number, roule: boolean, t: number, vivant: boolean, echelle: number, pseudo: string, couleur: Rampe['couleur'], nuit: number, planche: CanvasImageSource | null): void {
  void nuit
  void planche
  void dir
  void roule
  void t
  void vivant
  void pseudo
  g.fillStyle = couleur('#6b5a3a')
  g.fillRect(x - 40 * echelle, y - 34 * echelle, 72 * echelle, 26 * echelle)
}

/** La plaque de la roulotte garée : « Théo est rendu en 1896 ». */
export function dessinerPlaqueRoulotte(g: CanvasRenderingContext2D, x: number, y: number, texte: string, couleur: Rampe['couleur']): void {
  g.fillStyle = couleur('#F2E8D5')
  g.fillRect(x - 60, y, 120, 18)
  g.fillStyle = couleur('#151009')
  g.fillText(texte, x, y + 13)
}
