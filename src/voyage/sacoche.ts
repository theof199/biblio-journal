import type { DepenseDuMois, Voyage } from '../api/voyage'
import { decennieDe } from './regles'

/**
 * La sacoche du voyageur, sans rendu : les décennies du passeport, et les Coulisses (les dépenses
 * au chroniqueur, dites mois par mois, et les crédits des images du Voyage, lus dans les
 * `CREDITS.md` des dossiers `assets/`).
 */

/** Les décennies du passeport : de celle du départ du Voyage à celle de mon année en cours. */
export function decenniesDuPasseport(v: Pick<Voyage, 'depart' | 'annee_en_cours'>): number[] {
  const liste: number[] = []
  for (let d = decennieDe(v.depart); d <= decennieDe(v.annee_en_cours); d += 10) liste.push(d)
  return liste
}

/**
 * Le mois courant (`AAAA-MM`, que `en-CA` écrit ainsi), **à Paris** : le 31 août à 23 h 30 UTC, il
 * est déjà le 1er septembre à Paris. Jamais le fuseau de l'appareil. Le format se crée à chaque
 * appel, comme `jourDeParis` : un format créé au chargement ne verrait pas le fuseau changé par un test.
 */
export function moisDeParis(maintenant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Paris' }).format(maintenant)
}

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

/** « Août 2026 » pour `2026-08`. */
export function nomDuMois(mois: string): string {
  const [annee, numero] = mois.split('-')
  return `${MOIS[Number(numero) - 1] ?? numero} ${annee}`
}

const appels = (n: number) => `${n} ${n > 1 ? 'appels' : 'appel'}`

/**
 * `cout_centimes` est une **estimation** au tarif public d'Anthropic, en centimes de dollar (la
 * facture du compte fait foi, dit le contrat) : elle se dit « environ », avec sa monnaie, à une
 * décimale (portée de `formatCentimes`, Android).
 */
function cout(centimes: number): string {
  const chiffre = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(centimes)
  return `environ ${chiffre} ${centimes < 2 ? 'centime' : 'centimes'} de dollar`
}

const ligne = (libelle: string, m: DepenseDuMois) => `${libelle} : ${appels(m.appels)}, ${cout(m.cout_centimes)}`

/**
 * Les lignes des dépenses : le mois courant d'abord (« aucun appel » s'il manque à la réponse),
 * puis les mois précédents, du plus récent au plus ancien (`mois` est toujours `AAAA-MM` : le tri
 * du texte suffit). Nul pour une liste vide : la ligne Dépenses se masque alors (décision du
 * propriétaire du 1er octobre 2026 : seul le compte IA appelle le chroniqueur).
 */
export function lignesDesDepenses(mois: readonly DepenseDuMois[], moisCourant: string): { courant: string; precedents: string[] } | null {
  if (mois.length === 0) return null
  const courant = mois.find((m) => m.mois === moisCourant)
  return {
    courant: courant ? ligne('Ce mois-ci', courant) : 'Ce mois-ci : aucun appel',
    precedents: mois
      .filter((m) => m.mois !== moisCourant)
      .sort((a, b) => b.mois.localeCompare(a.mois))
      .map((m) => ligne(nomDuMois(m.mois), m)),
  }
}

/** Une image créditée : son fichier, son œuvre, sa licence et sa source, telles que le `CREDITS.md` les écrit. */
export interface Credit {
  fichier: string
  oeuvre: string
  licence: string
  source: string
}

export interface GroupeDeCredits {
  titre: string
  credits: Credit[]
}

/** La valeur d'une ligne `- Champ : …` d'une entrée, l'italique Markdown ôté. */
function champ(entree: string, nom: string): string {
  const trouve = new RegExp(`^- ${nom} : (.+)$`, 'm').exec(entree)
  return (trouve?.[1] ?? '').replace(/\*/g, '').trim()
}

/**
 * Les crédits d'un `CREDITS.md` : son titre (la ligne `# …`) et une entrée par section
 * `## \`fichier\`` (le format qu'exige `src/test/credits.test.ts`). Un dossier sans image n'a pas
 * d'entrée, et ne donne pas de groupe.
 */
export function lireCredits(texte: string): GroupeDeCredits | null {
  const titre = /^# (.+)$/m.exec(texte)?.[1]?.trim() ?? 'Crédits'
  const credits = texte
    .split(/^## /m)
    .slice(1)
    .flatMap((entree): Credit[] => {
      const fichier = /^`([^`]+)`/.exec(entree)?.[1]
      if (!fichier) return []
      return [{ fichier, oeuvre: champ(entree, 'Œuvre'), licence: champ(entree, 'Licence'), source: champ(entree, 'Source') }]
    })
  return credits.length > 0 ? { titre, credits } : null
}

/**
 * Tous les `CREDITS.md` des dossiers `assets/` (le même glob que `src/test/credits.test.ts`), lus
 * au build : les crédits ne se recopient jamais, ils se lisent où ils sont écrits. Le glob ne nomme
 * aucun monde : un monde ajouté apporte ses crédits sans toucher à la sacoche.
 */
const FICHIERS = import.meta.glob('../**/assets/CREDITS.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const CREDITS: readonly GroupeDeCredits[] = Object.keys(FICHIERS)
  .sort()
  .flatMap((chemin) => {
    const groupe = lireCredits(FICHIERS[chemin]!)
    return groupe ? [groupe] : []
  })
