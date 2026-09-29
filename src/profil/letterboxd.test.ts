import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DiaryCsvMissingError,
  FichierIllisibleError,
  NavigateurSansZipError,
  csvDepuisFichier,
  dateLetterboxd,
  extraireDiaryCsv,
  lireCsv,
  lireLignesDiary,
  noteLetterboxd,
  ressembleAUnZip,
} from './letterboxd'
import { fabriquerZip } from '../test/zip'

const ENTETE = 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date'
const CSV = `${ENTETE}
2026-09-02,"Alien, le huitième passager",1979,https://boxd.it/a,4.5,,,2026-09-01
2026-09-03,Heat,1995,https://boxd.it/b,,Yes,,
`
const enc = (t: string) => new TextEncoder().encode(t)

describe('lireCsv', () => {
  it('lit les guillemets, les virgules et les guillemets doublés dans un champ', () => {
    expect(lireCsv('a,"b, c","d ""e"""\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ])
  })

  it('lit du CRLF et écarte les lignes blanches, la dernière sans saut de ligne comprise', () => {
    expect(lireCsv('a,b\r\n\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('un saut de ligne entre guillemets reste dans le champ', () => {
    expect(lireCsv('"a\nb",c\n')).toEqual([['a\nb', 'c']])
  })
})

describe('noteLetterboxd', () => {
  it('double les étoiles : 0,5 vaut 1, 4,5 vaut 9, 5 vaut 10', () => {
    expect([noteLetterboxd('0.5'), noteLetterboxd('4.5'), noteLetterboxd('5')]).toEqual([1, 9, 10])
  })

  it('vide, illisible ou hors de 1 à 10 : nulle, le formulaire refuserait le reste', () => {
    expect([noteLetterboxd(''), noteLetterboxd('  '), noteLetterboxd('beaucoup'), noteLetterboxd('0'), noteLetterboxd('6')]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ])
  })
})

describe('dateLetterboxd', () => {
  it('rend une date réelle telle quelle', () => {
    expect(dateLetterboxd(' 2024-02-29 ')).toBe('2024-02-29')
  })

  it('refuse une forme fausse et un jour qui n’existe pas', () => {
    expect(dateLetterboxd('29/02/2024')).toBeNull()
    expect(dateLetterboxd('2025-02-29')).toBeNull()
    expect(dateLetterboxd('2026-13-01')).toBeNull()
    expect(dateLetterboxd('')).toBeNull()
  })
})

describe('lireLignesDiary', () => {
  it('indexe par numéro de ligne, l’en-tête valant 1, avec la date vue plutôt que la date de saisie', () => {
    const lignes = lireLignesDiary(CSV)
    expect(lignes.get(2)).toEqual({ ligne: 2, name: 'Alien, le huitième passager', year: 1979, date: '2026-09-01', rating: 9 })
    // « Watched Date » vide : la colonne « Date » prend le relais ; note vide : nulle.
    expect(lignes.get(3)).toEqual({ ligne: 3, name: 'Heat', year: 1995, date: '2026-09-03', rating: null })
    expect(lignes.has(1)).toBe(false)
  })

  it('une année qui n’a pas quatre chiffres est ignorée', () => {
    const csv = `${ENTETE}\n2026-09-02,X,79,u,3,,,2026-09-02\n2026-09-02,Y,,u,3,,,2026-09-02\n`
    const l = lireLignesDiary(csv)
    expect([l.get(2)!.year, l.get(3)!.year]).toEqual([null, null])
  })

  it('un CSV qui n’est pas diary.csv (en-têtes de watched.csv) ne donne rien', () => {
    expect(lireLignesDiary('Date,Name,Year,Letterboxd URI\n2026-01-01,X,2000,u\n').size).toBe(0)
    expect(lireLignesDiary('').size).toBe(0)
  })
})

describe('le fichier d’export', () => {
  it('reconnaît un ZIP à sa signature, et rien d’autre', () => {
    expect(ressembleAUnZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe(true)
    expect(ressembleAUnZip(enc(CSV))).toBe(false)
    expect(ressembleAUnZip(new Uint8Array([0x50, 0x4b]))).toBe(false)
  })

  it('un CSV seul est lu tel quel', async () => {
    expect(await csvDepuisFichier(enc(CSV))).toBe(CSV)
  })

  it('extrait diary.csv d’un ZIP déflaté, sous un dossier, à côté d’autres fichiers', async () => {
    const zip = await fabriquerZip([
      { nom: 'ratings.csv', contenu: 'Date,Name\n', methode: 'deflate' },
      { nom: 'letterboxd-export/diary.csv', contenu: CSV, methode: 'deflate' },
    ])
    expect(await csvDepuisFichier(zip)).toBe(CSV)
  })

  it('extrait diary.csv d’un ZIP stocké, accents compris', async () => {
    const csv = `${ENTETE}\n2026-01-01,Amélie,2001,u,4,,,2026-01-01\n`
    const zip = await fabriquerZip([{ nom: 'diary.csv', contenu: csv }])
    expect(await extraireDiaryCsv(zip)).toBe(csv)
  })

  it('un ZIP d’archiveur réel : extras de tailles différentes, commentaire, tailles locales à zéro', async () => {
    const zip = await fabriquerZip([
      { nom: 'ratings.csv', contenu: 'Date,Name\n', methode: 'deflate', reel: true },
      { nom: 'diary.csv', contenu: CSV, methode: 'deflate', reel: true },
    ])
    expect(await extraireDiaryCsv(zip)).toBe(CSV)
    const stocke = await fabriquerZip([{ nom: 'diary.csv', contenu: CSV, reel: true }])
    expect(await extraireDiaryCsv(stocke)).toBe(CSV)
  })

  it('le diary.csv de la racine l’emporte sur un homonyme de sous-dossier, même rangé avant lui', async () => {
    const zip = await fabriquerZip([
      { nom: 'deleted/diary.csv', contenu: 'pas celui-ci', methode: 'deflate' },
      { nom: 'diary.csv', contenu: CSV, methode: 'deflate' },
      { nom: 'orphaned/diary.csv', contenu: 'ni celui-ci' },
    ])
    expect(await extraireDiaryCsv(zip)).toBe(CSV)
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
      expect(await csvDepuisFichier(enc(CSV))).toBe(CSV)
    })
  })
})
