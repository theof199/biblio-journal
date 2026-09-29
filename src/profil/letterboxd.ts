/**
 * La lecture de l'export Letterboxd (reprise de `LetterboxdDiary.kt`, Android), dans le navigateur :
 * ni bibliothèque ni réseau. Le web extrait `diary.csv` du ZIP (`DecompressionStream`, l'API du
 * navigateur) et l'envoie tel quel à `POST /me/journal/import/letterboxd` ; le back seul décide de
 * l'import. Le CSV est relu ici uniquement pour retrouver la date et la note d'une ligne, quand le
 * membre choisit un candidat du rapport : miroir de la lecture du back, jamais une seconde vérité.
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

/** « PK\x03\x04 » : l'en-tête d'une entrée locale de ZIP. */
export function ressembleAUnZip(octets: Uint8Array): boolean {
  return octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04
}

const SIG_FIN = 0x06054b50
const SIG_CENTRALE = 0x02014b50
const SIG_LOCALE = 0x04034b50

async function decompresser(donnees: Uint8Array): Promise<Uint8Array> {
  const flux = new Response(donnees as BodyInit).body!.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

/**
 * `diary.csv`, où qu'il vive dans l'arborescence du ZIP. Lu par le répertoire central (les tailles
 * y sont toujours justes, même quand l'en-tête local les laisse à zéro). Stocké ou déflaté : les
 * deux seules méthodes qu'un export produit.
 */
export async function extraireDiaryCsv(zip: Uint8Array): Promise<string> {
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

    if (nom.endsWith('/') || nom.slice(nom.lastIndexOf('/') + 1) !== 'diary.csv') continue

    if (decalageLocal + 30 > zip.length || vue.getUint32(decalageLocal, true) !== SIG_LOCALE) throw new FichierIllisibleError()
    const debut = decalageLocal + 30 + vue.getUint16(decalageLocal + 26, true) + vue.getUint16(decalageLocal + 28, true)
    const donnees = zip.subarray(debut, debut + tailleCompressee)
    if (donnees.length !== tailleCompressee) throw new FichierIllisibleError()
    if (methode === 0) return texte.decode(donnees)
    if (methode !== 8) throw new FichierIllisibleError()
    try {
      return texte.decode(await decompresser(donnees))
    } catch {
      throw new FichierIllisibleError()
    }
  }
  throw new DiaryCsvMissingError()
}

/** Le CSV à envoyer : extrait du ZIP si c'en est un (signature `PK`), lu tel quel sinon. */
export async function csvDepuisFichier(octets: Uint8Array): Promise<string> {
  return ressembleAUnZip(octets) ? extraireDiaryCsv(octets) : new TextDecoder('utf-8').decode(octets)
}

/** Guillemets et virgules dans un champ, guillemet échappé en le doublant (RFC 4180). */
export function lireCsv(texte: string): string[][] {
  const lignes: string[][] = []
  let ligne: string[] = []
  let champ = ''
  let entreGuillemets = false
  const finChamp = () => {
    ligne.push(champ)
    champ = ''
  }
  const finLigne = () => {
    finChamp()
    lignes.push(ligne)
    ligne = []
  }
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!
    if (entreGuillemets && c === '"' && texte[i + 1] === '"') {
      champ += '"'
      i++
    } else if (entreGuillemets && c === '"') entreGuillemets = false
    else if (entreGuillemets) champ += c
    else if (c === '"') entreGuillemets = true
    else if (c === ',') finChamp()
    else if (c === '\r') continue
    else if (c === '\n') finLigne()
    else champ += c
  }
  if (champ !== '' || ligne.length > 0) finLigne()
  // Une ligne blanche (fin de fichier) ne porte aucune donnée.
  return lignes.filter((l) => !(l.length === 1 && l[0] === ''))
}

const ENTETES = ['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating', 'Rewatch', 'Tags', 'Watched Date']

/** Une ligne de `diary.csv` telle que le back la lit : date déjà résolue, note déjà convertie. */
export interface LigneDiary {
  ligne: number
  name: string
  year: number | null
  date: string | null
  rating: number | null
}

/**
 * Étoiles Letterboxd (0,5 à 5, parfois vide) vers une note sur 10. Une note hors de 1 à 10
 * (« 0 », illisible) devient nulle : le formulaire n'accepte que 1 à 10.
 */
export function noteLetterboxd(brut: string): number | null {
  const valeur = brut.trim()
  if (valeur === '') return null
  const etoiles = Number(valeur)
  if (!Number.isFinite(etoiles)) return null
  const note = Math.round(etoiles * 2)
  return note >= 1 && note <= 10 ? note : null
}

/** `AAAA-MM-JJ` bien formé et réel (pas de 31 février), sinon nul. */
export function dateLetterboxd(brut: string): string | null {
  const valeur = brut.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === valeur ? valeur : null
}

/**
 * Les lignes de `diary.csv` indexées par leur numéro (l'en-tête vaut 1, comme `ligne` dans la
 * réponse du back). Vide si l'en-tête n'est pas celui de `diary.csv` : le back aura répondu 400.
 */
export function lireLignesDiary(csv: string): Map<number, LigneDiary> {
  const lignes = lireCsv(csv)
  const entete = lignes[0]
  const table = new Map<number, LigneDiary>()
  if (!entete) return table
  const index = new Map(entete.map((nom, i) => [nom, i]))
  if (!ENTETES.every((nom) => index.has(nom))) return table
  const champ = (l: string[], nom: string) => l[index.get(nom)!] ?? ''
  lignes.slice(1).forEach((l, i) => {
    const numero = i + 2
    const annee = champ(l, 'Year').trim()
    table.set(numero, {
      ligne: numero,
      name: champ(l, 'Name').trim(),
      year: annee.length === 4 && /^\d+$/.test(annee) ? Number(annee) : null,
      date: dateLetterboxd(champ(l, 'Watched Date')) ?? dateLetterboxd(champ(l, 'Date')),
      rating: noteLetterboxd(champ(l, 'Rating')),
    })
  })
  return table
}
