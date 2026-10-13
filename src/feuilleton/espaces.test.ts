import { afterEach, describe, expect, it, vi } from 'vitest'
import { ESPACES, autreEspace, espaceDeLHeure, espaceDuChemin } from './espaces'

/** Un instant, écrit en UTC : c'est la règle qui le lit à l'heure de Paris. */
const a = (iso: string) => espaceDeLHeure(new Date(iso))

describe('l’espace de l’heure', () => {
  afterEach(() => vi.unstubAllEnvs())

  // Octobre 2026, heure d'été (UTC+2) : le 12 est un lundi, le 16 un vendredi.
  // Mutations, dans `espaceDeLHeure` : `heure <= FIN_DU_TRAVAIL` (18 h 00 resterait au Travail) ;
  // `FIN_DU_TRAVAIL` à 17 (17 h 59 passerait à la Maison).
  it('le vendredi, 17 h 59 est encore au Travail et 18 h 00 à la Maison', () => {
    expect(a('2026-10-16T15:59:59Z')).toBe('studio')
    expect(a('2026-10-16T16:00:00Z')).toBe('maison')
  })

  // Mutations : `heure > DEBUT_DU_TRAVAIL` (6 h 00 resterait à la Maison) ; `DEBUT_DU_TRAVAIL` à 5.
  it('le lundi, 5 h 59 est encore à la Maison et 6 h 00 au Travail', () => {
    expect(a('2026-10-12T03:59:59Z')).toBe('maison')
    expect(a('2026-10-12T04:00:00Z')).toBe('studio')
  })

  // Mutation : `JOURS_DE_REPOS` vidé, ou réduit au dimanche.
  it('le samedi et le dimanche, la Maison, en pleine journée comme le reste du temps', () => {
    expect(a('2026-10-17T10:00:00Z')).toBe('maison')
    expect(a('2026-10-18T10:00:00Z')).toBe('maison')
    expect(a('2026-10-17T04:00:00Z')).toBe('maison')
    expect(a('2026-10-18T15:59:00Z')).toBe('maison')
  })

  it('en semaine, le soir et la nuit, la Maison ; en journée, le Travail', () => {
    expect(a('2026-10-14T21:00:00Z')).toBe('maison')
    expect(a('2026-10-14T00:30:00Z')).toBe('maison')
    expect(a('2026-10-14T10:00:00Z')).toBe('studio')
  })

  // Le passage à l'heure d'hiver est le dimanche 25 octobre 2026, celui à l'heure d'été le dimanche 29
  // mars : 6 h et 18 h de Paris ne sont pas le même instant UTC de part et d'autre.
  // Mutation : le fuseau du format remplacé par un décalage fixe (`Etc/GMT-2`, l'heure d'été toute
  // l'année) : les bornes d'hiver tomberaient une heure trop tôt.
  it('les bornes suivent l’heure de Paris de part et d’autre d’un changement d’heure', () => {
    // Le vendredi d'avant (été, UTC+2) et le lundi d'après (hiver, UTC+1) le 25 octobre.
    expect(a('2026-10-23T04:00:00Z')).toBe('studio')
    expect(a('2026-10-23T16:00:00Z')).toBe('maison')
    expect(a('2026-10-26T04:00:00Z')).toBe('maison')
    expect(a('2026-10-26T04:59:59Z')).toBe('maison')
    expect(a('2026-10-26T05:00:00Z')).toBe('studio')
    expect(a('2026-10-26T16:00:00Z')).toBe('studio')
    expect(a('2026-10-26T16:59:59Z')).toBe('studio')
    expect(a('2026-10-26T17:00:00Z')).toBe('maison')
    // Le vendredi d'avant (hiver) et le lundi d'après (été) le 29 mars.
    expect(a('2026-03-27T04:00:00Z')).toBe('maison')
    expect(a('2026-03-27T16:00:00Z')).toBe('studio')
    expect(a('2026-03-30T04:00:00Z')).toBe('studio')
    expect(a('2026-03-30T16:00:00Z')).toBe('maison')
  })

  it('le jour même d’un changement d’heure est un dimanche : la Maison', () => {
    expect(a('2026-10-25T00:30:00Z')).toBe('maison')
    expect(a('2026-10-25T01:30:00Z')).toBe('maison')
    expect(a('2026-10-25T10:00:00Z')).toBe('maison')
    expect(a('2026-03-29T10:00:00Z')).toBe('maison')
  })

  // Mutation : l'heure et le jour lus à l'appareil (`instant.getHours()`, `instant.getDay()`).
  it.each(['Pacific/Auckland', 'America/Los_Angeles', 'UTC'])('sur un appareil réglé sur %s, c’est toujours l’heure de Paris qui tranche', (ailleurs) => {
    vi.stubEnv('TZ', ailleurs)
    // Garde du test : le fuseau de l'appareil a bien changé.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(ailleurs)

    // Vendredi 17 h 59 et 18 h 00 à Paris : à Auckland c'est déjà samedi, à Los Angeles le matin.
    expect(a('2026-10-16T15:59:59Z')).toBe('studio')
    expect(a('2026-10-16T16:00:00Z')).toBe('maison')
    // Lundi 5 h 59 et 6 h 00 à Paris : à Los Angeles c'est encore dimanche.
    expect(a('2026-10-12T03:59:59Z')).toBe('maison')
    expect(a('2026-10-12T04:00:00Z')).toBe('studio')
  })
})

describe('les espaces du Feuilleton', () => {
  // Mutation : un chemin partagé par les deux espaces, ou `autreEspace` rendant l'espace reçu.
  it('deux espaces, deux adresses, chacun l’autre de l’autre', () => {
    expect(ESPACES.studio.chemin).toBe('/feuilleton/studio')
    expect(ESPACES.maison.chemin).toBe('/feuilleton/maison')
    expect(autreEspace('studio')).toBe('maison')
    expect(autreEspace('maison')).toBe('studio')
  })

  // Mutation : `pathname.startsWith` au lieu de l'égalité : `/feuilleton` passerait pour un espace.
  it('`/feuilleton` seul n’est pas un espace', () => {
    expect(espaceDuChemin('/feuilleton/studio')).toBe('studio')
    expect(espaceDuChemin('/feuilleton/maison')).toBe('maison')
    expect(espaceDuChemin('/feuilleton')).toBeNull()
    expect(espaceDuChemin('/')).toBeNull()
  })
})
