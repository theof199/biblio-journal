import { formatJourBref } from '../../../ui/format'
import { jourDeParis } from '../../../voyage/passeport'

/** Les mots et les règles du passeport des années 1900 (maquette, écran 9), sans rendu. */
export const MOTS_DU_PASSEPORT = {
  frontiere: 'Frontière',
  vise: 'Visé',
  tampons: 'Les tampons de frontière',
  douane: 'Groupe devant le bureau des douanes françaises, au sommet du Donon, vers 1900',
  legende: 'Le bureau des douanes françaises au sommet du Donon, sur la frontière de 1871, vers 1900.',
} as const

/** Quand le tampon de la décennie se pose : la règle de `ceQuiManque`, dite une fois. */
export const regleDuTampon = (decennie: number): string =>
  `Le tampon se pose quand chaque année porte sa récompense et que le ticket de ${decennie + 10} est utilisé.`

/**
 * La date d'un tampon de frontière, **à Paris** comme le tampon de la décennie (`jourDeParis`) : le
 * jour et le mois sur une ligne, l'année dessous, et le jour en toutes lettres pour qui ne voit pas
 * le tampon. Le format se crée à chaque appel : les tests changent le fuseau de Node.
 */
export function dateDuTampon(iso: string): { jour: string; annee: string; libelle: string } {
  const jour = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso))
  return { jour: formatJourBref(jour), annee: jour.slice(0, 4), libelle: jourDeParis(iso) }
}

/** Ce que dit la place du tampon tant que la décennie n'est pas bouclée (maquette : `.attente`). */
export const placeDuTampon = (decennie: number): string => `La place du tampon des années ${decennie}`

export const libelleDeLaSortie = (decennie: number, iso: string): string => `Tampon rond : sortie des années ${decennie}, le ${dateDuTampon(iso).libelle}`
export const libelleDeLEntree = (decennie: number): string => `Tampon rectangulaire : frontière, entrée en ${decennie}, visé`
