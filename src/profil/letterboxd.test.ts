import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DiaryCsvMissingError,
  FichierIllisibleError,
  NavigateurSansZipError,
  extraireDiaryCsv,
  fichiersDepuisExport,
  lireExport,
  ressembleAUnZip,
} from './letterboxd'
import { fabriquerZip } from '../test/zip'

const ENTETE = 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date'
const CSV = `${ENTETE}
2026-09-02,"Alien, le huitième passager",1979,https://boxd.it/a,4.5,,,2026-09-01
2026-09-03,Heat,1995,https://boxd.it/b,,Yes,,
`
const WATCHED = 'Date,Name,Year,Letterboxd URI\n2026-09-01,Alien,1979,https://boxd.it/f1\n2024-03-03,Heat,1995,https://boxd.it/f2\n'
const RATINGS = 'Date,Name,Year,Letterboxd URI,Rating\n2024-03-03,Heat,1995,https://boxd.it/f2,4\n'
const enc = (t: string) => new TextEncoder().encode(t)

describe('le fichier d’export', () => {
  it('reconnaît un ZIP à sa signature, et rien d’autre', () => {
    expect(ressembleAUnZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe(true)
    expect(ressembleAUnZip(enc(CSV))).toBe(false)
    expect(ressembleAUnZip(new Uint8Array([0x50, 0x4b]))).toBe(false)
  })

  it('un CSV seul est lu tel quel, comme diary.csv', async () => {
    expect(await fichiersDepuisExport(enc(CSV))).toEqual({ csv: CSV })
  })

  it('extrait diary.csv, watched.csv et ratings.csv d’un ZIP déflaté, sous un dossier, à côté d’autres fichiers', async () => {
    // « 400 films dans le zip, 200 à l'import » : `diary.csv` seul ne porte que les visionnages
    // datés. Les films marqués vus sans entrée de journal ne sont que dans `watched.csv`.
    const zip = await fabriquerZip([
      { nom: 'letterboxd-export/ratings.csv', contenu: RATINGS, methode: 'deflate' },
      { nom: 'letterboxd-export/reviews.csv', contenu: 'Date,Name\n', methode: 'deflate' },
      { nom: 'letterboxd-export/diary.csv', contenu: CSV, methode: 'deflate' },
      { nom: 'letterboxd-export/watched.csv', contenu: WATCHED, methode: 'deflate' },
    ])
    expect(await fichiersDepuisExport(zip)).toEqual({ csv: CSV, watched_csv: WATCHED, ratings_csv: RATINGS })
  })

  it('un export sans watched.csv s’envoie avec diary.csv seul ; ratings.csv sans watched.csv ne part pas', async () => {
    const zip = await fabriquerZip([
      { nom: 'diary.csv', contenu: CSV },
      { nom: 'ratings.csv', contenu: RATINGS },
    ])
    expect(await lireExport(zip)).toEqual({ csv: CSV })
  })

  it('extrait diary.csv d’un ZIP stocké, accents compris', async () => {
    const csv = `${ENTETE}\n2026-01-01,Amélie,2001,u,4,,,2026-01-01\n`
    const zip = await fabriquerZip([{ nom: 'diary.csv', contenu: csv }])
    expect(await extraireDiaryCsv(zip)).toBe(csv)
  })

  it('un ZIP d’archiveur réel : extras de tailles différentes, commentaire, tailles locales à zéro', async () => {
    const zip = await fabriquerZip([
      { nom: 'ratings.csv', contenu: RATINGS, methode: 'deflate', reel: true },
      { nom: 'diary.csv', contenu: CSV, methode: 'deflate', reel: true },
      { nom: 'watched.csv', contenu: WATCHED, methode: 'deflate', reel: true },
    ])
    expect(await lireExport(zip)).toEqual({ csv: CSV, watched_csv: WATCHED, ratings_csv: RATINGS })
    const stocke = await fabriquerZip([{ nom: 'diary.csv', contenu: CSV, reel: true }])
    expect(await extraireDiaryCsv(stocke)).toBe(CSV)
  })

  it('le fichier le moins profond l’emporte sur un homonyme rangé plus bas, même listé avant lui', async () => {
    const zip = await fabriquerZip([
      { nom: 'deleted/diary.csv', contenu: 'pas celui-ci', methode: 'deflate' },
      { nom: 'diary.csv', contenu: CSV, methode: 'deflate' },
      { nom: 'orphaned/diary.csv', contenu: 'ni celui-ci' },
    ])
    expect(await extraireDiaryCsv(zip)).toBe(CSV)

    // Un export rangé sous un dossier : ses `deleted/` sont un cran plus bas.
    const range = await fabriquerZip([
      { nom: 'export/deleted/watched.csv', contenu: 'pas celui-ci' },
      { nom: 'export/deleted/diary.csv', contenu: 'ni celui-ci' },
      { nom: 'export/diary.csv', contenu: CSV },
      { nom: 'export/watched.csv', contenu: WATCHED },
    ])
    expect(await lireExport(range)).toEqual({ csv: CSV, watched_csv: WATCHED })
  })

  it('un ZIP sans diary.csv : l’erreur qui le dit, avant tout réseau', async () => {
    const zip = await fabriquerZip([
      { nom: 'watched.csv', contenu: 'x' },
      { nom: 'dossier/mon-diary.csv', contenu: 'x' }, // le nom exact, pas une fin de nom
      { nom: 'diary.csv/', contenu: '' }, // un dossier
    ])
    const erreur = await extraireDiaryCsv(zip).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(DiaryCsvMissingError)
    expect((erreur as Error).message).toBe('Ce ZIP ne contient pas diary.csv')
  })

  it('un ZIP tronqué ou corrompu : illisible, jamais une exception brute', async () => {
    const zip = await fabriquerZip([{ nom: 'diary.csv', contenu: CSV, methode: 'deflate' }])
    await expect(extraireDiaryCsv(zip.subarray(0, 40))).rejects.toBeInstanceOf(FichierIllisibleError)
    const abime = zip.slice()
    abime.fill(0xff, 30 + 'diary.csv'.length, 34 + 'diary.csv'.length) // le début du flux déflaté
    await expect(extraireDiaryCsv(abime)).rejects.toBeInstanceOf(FichierIllisibleError)
  })

  describe('un navigateur sans DecompressionStream', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('un ZIP déflaté : le message qui dit d’envoyer diary.csv, pas « illisible »', async () => {
      const zip = await fabriquerZip([{ nom: 'diary.csv', contenu: CSV, methode: 'deflate' }])
      vi.stubGlobal('DecompressionStream', undefined)
      const erreur = await extraireDiaryCsv(zip).catch((e: unknown) => e)
      expect(erreur).toBeInstanceOf(NavigateurSansZipError)
      expect((erreur as Error).message).toBe(
        'Ce navigateur ne sait pas ouvrir un ZIP : choisis plutôt le fichier diary.csv, extrait de l’export.',
      )
    })

    it('un ZIP stocké se lit toujours, et diary.csv seul aussi', async () => {
      const zip = await fabriquerZip([{ nom: 'diary.csv', contenu: CSV }])
      vi.stubGlobal('DecompressionStream', undefined)
      expect(await extraireDiaryCsv(zip)).toBe(CSV)
      expect(await fichiersDepuisExport(enc(CSV))).toEqual({ csv: CSV })
    })
  })
})
