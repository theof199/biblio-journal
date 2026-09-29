/**
 * La lecture de l'export Letterboxd (reprise de `LetterboxdDiary.kt`, Android), dans le navigateur :
 * ni bibliothèque ni réseau. Le web extrait du ZIP (`DecompressionStream`, l'API du navigateur)
 * `diary.csv`, et depuis le correctif du 30 septembre 2026 `watched.csv` et `ratings.csv`, et les
 * envoie tels quels à `POST /me/journal/import/letterboxd` ; le back seul décide de l'import.
 *
 * **Pourquoi trois fichiers.** `diary.csv` ne porte que les visionnages datés ; un film seulement
 * marqué « vu » sur Letterboxd n'est que dans `watched.csv`. Android n'envoyait que le premier : un
 * export de 400 films vus n'en importait que 200.
 *
 * Le CSV ne se relit plus ici : le rapport du back donne, pour chaque ligne non reconnue, la date
 * et la note que l'import aurait écrites.
 */

/** Le ZIP est lisible mais ne contient pas `diary.csv`. */
export class DiaryCsvMissingError extends Error {
  constructor() {
    super('Ce ZIP ne contient pas diary.csv')
    this.name = 'DiaryCsvMissingError'
  }
}

/** Le fichier ressemble à un ZIP mais ne se lit pas (tronqué, chiffré, compression inconnue). */
export class FichierIllisibleError extends Error {
  constructor() {
    super('Ce fichier n’a pas pu être lu.')
    this.name = 'FichierIllisibleError'
  }
}

/**
 * Le navigateur n'a pas `DecompressionStream` (avant Chrome 103, Safari 16.4, Firefox 113) : le
 * ZIP n'est pas en cause, le `diary.csv` extrait à la main passe toujours.
 */
export class NavigateurSansZipError extends Error {
  constructor() {
    super('Ce navigateur ne sait pas ouvrir un ZIP : choisis plutôt le fichier diary.csv, extrait de l’export.')
    this.name = 'NavigateurSansZipError'
  }
}

/** « PK\x03\x04 » : l'en-tête d'une entrée locale de ZIP. */
export function ressembleAUnZip(octets: Uint8Array): boolean {
  return octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04
}

const SIG_FIN = 0x06054b50
const SIG_CENTRALE = 0x02014b50
const SIG_LOCALE = 0x04034b50

async function decompresser(donnees: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new NavigateurSansZipError()
  const flux = new Response(donnees as BodyInit).body!.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

/** Une entrée du répertoire central, telle qu'il la décrit (les tailles y sont toujours justes). */
interface EntreeCentrale {
  nom: string
  methode: number
  tailleCompressee: number
  decalageLocal: number
}

/** Le répertoire central du ZIP : la liste de ses entrées, ou `FichierIllisibleError`. */
function repertoire(zip: Uint8Array): EntreeCentrale[] {
  const vue = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const texte = new TextDecoder('utf-8')

  let fin = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (vue.getUint32(i, true) === SIG_FIN) {
      fin = i
      break
    }
  }
  if (fin < 0) throw new FichierIllisibleError()

  const nombre = vue.getUint16(fin + 10, true)
  let position = vue.getUint32(fin + 16, true)
  const entrees: EntreeCentrale[] = []
  for (let n = 0; n < nombre; n++) {
    if (position + 46 > zip.length || vue.getUint32(position, true) !== SIG_CENTRALE) throw new FichierIllisibleError()
    const methode = vue.getUint16(position + 10, true)
    const tailleCompressee = vue.getUint32(position + 20, true)
    const longueurNom = vue.getUint16(position + 28, true)
    const longueurExtra = vue.getUint16(position + 30, true)
    const longueurCommentaire = vue.getUint16(position + 32, true)
    const decalageLocal = vue.getUint32(position + 42, true)
    const nom = texte.decode(zip.subarray(position + 46, position + 46 + longueurNom))
    position += 46 + longueurNom + longueurExtra + longueurCommentaire
    entrees.push({ nom, methode, tailleCompressee, decalageLocal })
  }
  return entrees
}

/**
 * Le fichier `nom`, où qu'il vive dans l'arborescence : **le moins profond l'emporte**, le premier
 * rencontré à profondeur égale. Celui de la racine passe donc devant un homonyme rangé plus bas,
 * quel que soit l'ordre des entrées — et un export rangé sous un dossier (`export/diary.csv`)
 * passe devant ses propres `deleted/` et `orphaned/`, que Letterboxd range un cran plus bas.
 */
function trouver(entrees: EntreeCentrale[], nom: string): EntreeCentrale | null {
  let choisie: EntreeCentrale | null = null
  let profondeur = Infinity
  for (const entree of entrees) {
    if (entree.nom.endsWith('/') || entree.nom.slice(entree.nom.lastIndexOf('/') + 1) !== nom) continue
    const p = entree.nom.split('/').length
    if (p < profondeur) {
      choisie = entree
      profondeur = p
    }
  }
  return choisie
}

/** Le contenu d'une entrée, stockée ou déflatée : les deux seules méthodes qu'un export produit. */
async function lire(zip: Uint8Array, entree: EntreeCentrale): Promise<string> {
  const vue = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const texte = new TextDecoder('utf-8')
  const locale = entree.decalageLocal
  if (locale + 30 > zip.length || vue.getUint32(locale, true) !== SIG_LOCALE) throw new FichierIllisibleError()
  // Les longueurs du nom et de l'extra se relisent dans l'en-tête local : son extra n'a pas
  // forcément la taille de celui du répertoire central.
  const debut = locale + 30 + vue.getUint16(locale + 26, true) + vue.getUint16(locale + 28, true)
  const donnees = zip.subarray(debut, debut + entree.tailleCompressee)
  if (donnees.length !== entree.tailleCompressee) throw new FichierIllisibleError()
  if (entree.methode === 0) return texte.decode(donnees)
  if (entree.methode !== 8) throw new FichierIllisibleError()
  try {
    return texte.decode(await decompresser(donnees))
  } catch (e) {
    throw e instanceof NavigateurSansZipError ? e : new FichierIllisibleError()
  }
}

/** Le corps de `POST /me/journal/import/letterboxd` : `diary.csv`, et les deux autres s'ils y sont. */
export interface FichiersExport {
  csv: string
  watched_csv?: string
  ratings_csv?: string
}

/**
 * `diary.csv`, `watched.csv` et `ratings.csv` d'un ZIP d'export. `diary.csv` est exigé
 * (`DiaryCsvMissingError`) ; les deux autres manquent sans rien dire — un export ancien, ou refait à
 * la main, s'importe encore, sans ses films vus sans date.
 */
export async function lireExport(zip: Uint8Array): Promise<FichiersExport> {
  const entrees = repertoire(zip)
  const diary = trouver(entrees, 'diary.csv')
  if (!diary) throw new DiaryCsvMissingError()
  const fichiers: FichiersExport = { csv: await lire(zip, diary) }
  const watched = trouver(entrees, 'watched.csv')
  if (watched) fichiers.watched_csv = await lire(zip, watched)
  const ratings = trouver(entrees, 'ratings.csv')
  // Une note sans la liste des films vus ne sert à rien : le back l'ignorerait.
  if (ratings && watched) fichiers.ratings_csv = await lire(zip, ratings)
  return fichiers
}

/** `diary.csv` seul, d'un ZIP d'export. */
export async function extraireDiaryCsv(zip: Uint8Array): Promise<string> {
  return (await lireExport(zip)).csv
}

/** Ce qu'on envoie : l'export extrait du ZIP si c'en est un (signature `PK`), `diary.csv` lu tel quel sinon. */
export async function fichiersDepuisExport(octets: Uint8Array): Promise<FichiersExport> {
  return ressembleAUnZip(octets) ? lireExport(octets) : { csv: new TextDecoder('utf-8').decode(octets) }
}
