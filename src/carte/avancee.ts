import type { FrontiereAvancee } from '../voyage/regles'

/**
 * La mise en scène d'une frontière qui avance, sans DOM ni canvas : le moteur marche, la page
 * montre tampon et carton. Changer de décennie passe d'abord la porte du monde quitté ; le tampon
 * ne se montre que si le passeport porte vraiment cette décennie (`tampons` de `GET /me/voyage`),
 * jamais d'après la seule avancée : 1899 → 1900 sans un Ours par année ne boucle rien.
 */
export interface Scene {
  passerLaPorte: () => Promise<void>
  marcher: (vers: number) => Promise<void>
  montrerTampon: (decennie: number) => Promise<void>
  montrerCarton: (annee: number) => Promise<void>
  claquer: () => void
}

export async function jouerAvancee(avancee: FrontiereAvancee, vers: number, tampons: readonly number[], scene: Scene): Promise<void> {
  if (avancee.decennieQuittee !== null) {
    await scene.passerLaPorte()
    if (tampons.includes(avancee.decennieQuittee)) await scene.montrerTampon(avancee.decennieQuittee)
    await scene.marcher(vers)
    scene.claquer()
    await scene.montrerCarton(vers)
    return
  }
  await scene.marcher(vers)
  scene.claquer()
}
