import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import type { JournalItem } from '../../api/journal'
import { demanderFilm, marquerIntrouvable, retirerIntrouvable } from '../../api/realisateurs'
import { poserSurLePodium, type FilmDeSalle, type Podium } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import Feuillet from '../Feuillet'
import { bobineAVoir, boutonsDuFilm, tmdbVise } from '../film'
import { choixDesMarches, corpsPodium, type Candidat } from '../podium'
import styles from './Guichet.module.css'

const messageDe = (e: unknown, repli: string) => (e instanceof ApiError ? e.message : repli)

/** Les gestes du guichet qui écrivent sans quitter la fiche. */
type Geste = 'demander' | 'introuvable' | 'remettre'

/**
 * Ce que chaque geste périme, comme la fiche d'un film des Suivis (`pages/FicheFilm.tsx`), son
 * jumeau : la fiche de l'année et la carte (`cles.voyage`) ; une marque « introuvable » change aussi
 * le prochain à voir des filmographies et des sagas ; une demande, les filmographies et le Plex.
 * Oublier les Suivis laisserait la page d'un réalisateur d'où la fiche s'est ouverte (décision D5)
 * sur l'ancien état au retour.
 */
const PERIMES: Record<Geste, readonly (readonly string[])[]> = {
  demander: [cles.voyage, cles.realisateurs, cles.plex],
  introuvable: [cles.voyage, cles.realisateurs, cles.sagas],
  remettre: [cles.voyage, cles.realisateurs, cles.sagas],
}

interface Props {
  monde: Monde
  annee: number
  film: FilmDeSalle
  podium: Podium
  /** Mon dernier visionnage de ce film, retrouvé dans mon journal (seulement pour un film vu). */
  entree: JournalItem | undefined
  /** « Le film » : la feuille du chroniqueur, et son carton. */
  onFilm: () => void
}

/**
 * Le guichet de la fiche d'un film (maquette 1890 : `initFilm`, `.guichet-zone`) : les boutons de
 * `boutonsDuFilm`, dans l'ordre rendu, puis « Le film » toujours. Les écritures sont gardées contre
 * le double toucher (`isPending` ne se voit qu'au rendu suivant), relisent la fiche, et un refus
 * s'affiche tel que l'API l'a écrit.
 */
export default function Guichet({ monde, annee, film, podium, entree, onFilm }: Props) {
  const client = useQueryClient()
  const feuillet = useCalque('podium')
  // Un programme vu en partie : les gestes visent la bobine qui reste à voir (`tmdbVise`).
  const tmdb = tmdbVise(film)

  const ecrire = useMutation({
    mutationFn: async (g: Geste): Promise<void> => {
      if (g === 'demander') await demanderFilm(tmdb)
      else if (g === 'introuvable') await marquerIntrouvable(tmdb)
      else await retirerIntrouvable(tmdb)
    },
    onSuccess: (_r, g) => {
      for (const cle of PERIMES[g]) void client.invalidateQueries({ queryKey: cle })
    },
  })
  const envoi = useRef(false)
  const geste = (g: Geste) => {
    if (envoi.current) return
    envoi.current = true
    ecrire.mutate(g, { onSettled: () => void (envoi.current = false) })
  }

  // Un programme monte sur le podium par sa ligne de salle, un film par son identifiant TMDB.
  const cible: Candidat = film.programme
    ? { type: 'programme', programmeId: film.id, titre: film.title, affiche: film.cover_url }
    : { type: 'film', tmdbId: tmdb, titre: film.title, affiche: film.cover_url, note: film.note }
  const billet = `/voyage/${annee}/films/${film.id}/billet`
  // Un programme se note bobine par bobine, et porte l'identifiant TMDB de sa première bobine
  // (l'API) : sans `?bobine=`, le billet noterait la première, fût-elle déjà vue. « Je l'ai vu »
  // ouvre donc celui de la première bobine qui reste à voir (un programme non vu en a toujours une).
  const aVoir = bobineAVoir(film)
  const billetVu = aVoir ? `${billet}?bobine=${aVoir.tmdb_id}` : billet

  return (
    <div className={styles.guichet}>
      {boutonsDuFilm(film.etat, film.plex_url, entree !== undefined).map((b) => {
        switch (b) {
          case 'corriger':
            return (
              <Link key={b} to={`${billet}/corriger`} state={{ item: entree }} className={styles.ticket}>
                <span>
                  <b>Corriger</b>
                  <small>ta note, tes réactions</small>
                </span>
                <span className={styles.talon} aria-hidden="true">
                  {film.note !== null ? `${film.note}/10` : 'VU'}
                </span>
              </Link>
            )
          case 'plex':
            return (
              <a key={b} href={film.plex_url ?? undefined} target="_blank" rel="noreferrer" className={styles.laiton}>
                <i aria-hidden="true" />
                Voir sur le Plex
              </a>
            )
          case 'vu':
            return (
              <Link key={b} to={billetVu} className={styles.ticket}>
                <span>
                  <b>Je l’ai vu</b>
                  <small>poinçonner mon billet</small>
                </span>
                <span className={styles.talon} aria-hidden="true">
                  VU ?
                </span>
              </Link>
            )
          case 'demander':
            return (
              <button key={b} type="button" className={styles.filet} disabled={ecrire.isPending} onClick={() => geste('demander')}>
                Demander sur Sir
              </button>
            )
          case 'introuvable':
            return (
              <button key={b} type="button" className={styles.gris} disabled={ecrire.isPending} onClick={() => geste('introuvable')}>
                Introuvable
              </button>
            )
          case 'remettre':
            return (
              <button key={b} type="button" className={styles.gris} disabled={ecrire.isPending} onClick={() => geste('remettre')}>
                Le remettre à voir
              </button>
            )
          case 'podium':
            return (
              <button key={b} type="button" className={styles.laiton} onClick={() => feuillet.ouvrir('choisir')}>
                <i aria-hidden="true" />
                Mettre sur le podium
              </button>
            )
        }
      })}
      {film.etat === 'demande' ? <p className={styles.note}>demandé</p> : null}
      {ecrire.error ? (
        <p role="alert" className={styles.erreur}>
          {messageDe(ecrire.error, 'Le guichet n’a pas pu l’écrire. Réessaie.')}
        </p>
      ) : null}
      <button type="button" className={styles.filet} onClick={onFilm}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="6.5" r="2" />
          <circle cx="12" cy="17.5" r="2" />
          <circle cx="6.5" cy="12" r="2" />
          <circle cx="17.5" cy="12" r="2" />
        </svg>
        Le film
      </button>

      {feuillet.valeur === 'choisir' ? (
        <Feuillet monde={monde} titre="Mettre sur le podium" onFermer={feuillet.fermer}>
          <ChoixDuPodium annee={annee} podium={podium} cible={cible} onFermer={feuillet.fermer} />
        </Feuillet>
      ) : null}
    </div>
  )
}

interface PropsChoix {
  annee: number
  podium: Podium
  cible: Candidat
  onFermer: () => void
}

/**
 * Le feuillet « Mettre sur le podium » : une ligne par marche, celle qui porte déjà ce film cochée
 * (`choixDesMarches`). Le feuillet porte sa mutation : sa fermeture passe par les rappels de
 * `mutate`, qui se taisent une fois le feuillet démonté (le « retour » du téléphone pendant l'envoi) ;
 * une mutation qui lui survivrait reculerait une seconde fois, hors de la fiche.
 */
function ChoixDuPodium({ annee, podium, cible, onFermer }: PropsChoix) {
  const client = useQueryClient()
  const poser = useMutation({
    mutationFn: (place: number) => poserSurLePodium(annee, place, corpsPodium(cible)),
    // La fiche et la carte (l'affiche du n°1) se relisent.
    onSuccess: () => void client.invalidateQueries({ queryKey: cles.voyage }),
  })
  const envoi = useRef(false)
  const choisir = (place: number) => {
    if (envoi.current) return
    envoi.current = true
    poser.mutate(place, { onSuccess: onFermer, onSettled: () => void (envoi.current = false) })
  }

  return (
    <>
      <ul className={styles.marches}>
        {choixDesMarches(podium, cible).map((c) => (
          <li key={c.place}>
            <button type="button" aria-pressed={c.cochee} disabled={poser.isPending} onClick={() => choisir(c.place)}>
              <span className={styles.place}>{c.place}</span>
              <span>{c.occupant ?? 'à venir'}</span>
            </button>
          </li>
        ))}
      </ul>
      {poser.error ? (
        <p role="alert" className={styles.erreurFeuillet}>
          {messageDe(poser.error, 'Le podium n’a pas pu s’écrire. Réessaie.')}
        </p>
      ) : null}
    </>
  )
}
