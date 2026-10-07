import { decennieDe, type FrontiereAvancee } from '../voyage/regles'

/**
 * La mise en scène d'une frontière qui avance, sans DOM ni canvas : le moteur marche, la page
 * montre tampon et carton. Changer de décennie passe d'abord la porte du monde quitté ; le tampon
 * ne se montre que si le passeport porte vraiment cette décennie (`tampons` de `GET /me/voyage`),
 * jamais d'après la seule avancée : 1899 → 1900 sans un Ours par année ne boucle rien.
 *
 * Quand le monde d'arrivée a un passage d'entrée (plan 3b), il remplace la marche et le carton : la
 * porte (et l'adieu, que la page y enchaîne), le tampon, le passage, le clap ; puis la marche jusqu'à
 * l'année d'arrivée si elle n'est pas la première de sa décennie. `aUnPassage` se lit au registre,
 * par la page : cette suite ne connaît aucun monde.
 */
export interface Scene {
  passerLaPorte: () => Promise<void>
  marcher: (vers: number) => Promise<void>
  montrerTampon: (decennie: number) => Promise<void>
  montrerCarton: (annee: number) => Promise<void>
  claquer: () => void
  aUnPassage: (decennie: number) => boolean
  direBonjour: (decennie: number) => Promise<void>
}

export async function jouerAvancee(avancee: FrontiereAvancee, vers: number, tampons: readonly number[], scene: Scene): Promise<void> {
  if (avancee.decennieQuittee !== null) {
    await scene.passerLaPorte()
    if (tampons.includes(avancee.decennieQuittee)) await scene.montrerTampon(avancee.decennieQuittee)
    const arrivee = decennieDe(vers)
    if (scene.aUnPassage(arrivee)) {
      await scene.direBonjour(arrivee)
      scene.claquer()
      if (vers !== arrivee) await scene.marcher(vers)
      return
    }
    await scene.marcher(vers)
    scene.claquer()
    await scene.montrerCarton(vers)
    return
  }
  await scene.marcher(vers)
  scene.claquer()
}
