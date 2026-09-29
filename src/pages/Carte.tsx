import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { estPrete, lireAnnee, lireTickets, lireVoyage, utiliserTicket, type FicheAnnee } from '../api/voyage'
import CarteCanvas, { type Moteur } from '../carte/CarteCanvas'
import Apercu from '../carte/Apercu'
import type { EtatCarte } from '../carte/moteur'
import { jouerAvancee } from '../carte/avancee'
import { ecrireAnneeVue, lireAnneeVue } from '../carte/memoire'
import { creerRegistre } from '../mondes'
import type { DateVraie } from '../mondes/types'
import { useSession } from '../session/SessionContext'
import Panne from '../ui/Panne'
import { vibrer } from '../ui/haptique'
import { useMouvementReduit } from '../ui/mouvement'
import {
  affichesDeColonne,
  compterRecompenses,
  detecterFrontiereAvancee,
  etatDeCase,
  jauge,
  prochainPas,
  recompensesJusquaAnneeEnCours,
  type FrontiereAvancee,
} from '../voyage/regles'
import styles from '../carte/Carte.module.css'

const mondes = creerRegistre()
/**
 * Hors du composant, donc stable : `useQueries` ne rend alors un nouveau tableau que si une
 * fiche change (constaté, TanStack Query 5.104). Sans lui, un tableau neuf à chaque rendu
 * referait l'état de la carte, et le moteur jetterait ses tuiles à chaque rendu de la page (un aperçu, une petite affiche).
 */
const donneesDesFiches = (r: Array<{ data: FicheAnnee | undefined }>) => r.map((q) => q.data)
const LIBELLE = { palme: 'Palme', lion: 'Lion', ours: 'Ours', encours: 'en cours', passee: 'passée', verrou: 'à tourner' } as const

export default function Carte() {
  const { user } = useSession()
  const navigate = useNavigate()
  const client = useQueryClient()
  const calme = useMouvementReduit()
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const tickets = useQuery({ queryKey: cles.tickets, queryFn: ({ signal }) => lireTickets(signal) })
  const v = voyage.data

  // Les fiches déjà en cache (une visite, un aperçu) garnissent les colonnes Morris, sans rien lire.
  const fiches = useQueries({
    queries: (v?.annees ?? []).map((a) => ({
      queryKey: cles.annee(a.annee),
      queryFn: () => lireAnnee(a.annee),
      enabled: false,
    })),
    combine: donneesDesFiches,
  })

  const [anneeAvatar, setAnneeAvatar] = useState<number | null>(null)
  const [avancee, setAvancee] = useState<{ av: FrontiereAvancee; vers: number } | null>(null)
  const [moteur, setMoteur] = useState<Moteur | null>(null)
  const [apercu, setApercu] = useState<{ annee: number; ancre: { x: number; y: number } } | null>(null)
  const [ensemble, setEnsemble] = useState(false)
  /** L'année à bâtir sous les yeux dès que le moteur est là : la toute première visite, au départ du Voyage (idée 8). */
  const [chantierDuDepart, setChantierDuDepart] = useState<number | null>(null)
  const [date, setDate] = useState<DateVraie | null>(null)
  const [roulotteDite, setRoulotteDite] = useState(false)
  const [calque, setCalque] = useState<{ type: 'tampon'; decennie: number } | { type: 'carton'; annee: number } | null>(null)

  // La frontière : à l'ouverture, depuis la dernière année que cet appareil a montrée ; ensuite,
  // depuis là où se tient l'avatar.
  useEffect(() => {
    if (!v || avancee) return
    const apres = v.annee_en_cours
    const depuis = anneeAvatar ?? lireAnneeVue(user.id)
    const av = detecterFrontiereAvancee(depuis, apres)
    if (av) {
      setAnneeAvatar(av.anneeQuittee)
      setAvancee({ av, vers: apres })
    } else if (anneeAvatar !== apres) {
      // Aucune année vue, ni ici ni en mémoire, au départ du Voyage : la toute première visite voit
      // la séance de 1895 s'installer. La mémoire écrite ici, la visite suivante ne la revoit pas.
      if (depuis === null && apres === v.depart) setChantierDuDepart(apres)
      setAnneeAvatar(apres)
      ecrireAnneeVue(user.id, apres)
    }
  }, [v, anneeAvatar, avancee, user.id])

  useEffect(() => {
    if (!moteur || chantierDuDepart === null) return
    moteur.ouvrirSousLesYeux(chantierDuDepart)
    setChantierDuDepart(null)
  }, [moteur, chantierDuDepart])

  const attendre = useCallback((ms: number) => new Promise<void>((fin) => setTimeout(fin, ms)), [])

  // La phrase de la roulotte s'efface d'elle-même, au rythme du carton.
  useEffect(() => {
    if (!roulotteDite) return
    const j = setTimeout(() => setRoulotteDite(false), 3100)
    return () => clearTimeout(j)
  }, [roulotteDite])

  useEffect(() => {
    if (!avancee || !moteur || !v) return
    let vivant = true
    void jouerAvancee(avancee.av, avancee.vers, v.tampons.map((t) => t.decennie), {
      // La porte passée, le monde quitté dit adieu (idée 7) : `passerLaPorte` n'est appelée qu'au
      // changement de décennie, `decennieQuittee` n'y est jamais nulle.
      passerLaPorte: async () => {
        await moteur.passerLaPorte()
        if (avancee.av.decennieQuittee !== null) await moteur.direAdieu(avancee.av.decennieQuittee)
      },
      marcher: (vers) => moteur.marcher(vers),
      montrerTampon: async (decennie) => {
        setCalque({ type: 'tampon', decennie })
        await attendre(1800)
        setCalque(null)
      },
      montrerCarton: async (annee) => {
        setCalque({ type: 'carton', annee })
        await attendre(3100)
        setCalque(null)
      },
      claquer: () => {
        moteur.claquer()
        vibrer(20)
      },
    }).then(() => {
      if (!vivant) return
      setAnneeAvatar(avancee.vers)
      ecrireAnneeVue(user.id, avancee.vers)
      setAvancee(null)
    })
    return () => {
      vivant = false
    }
  }, [avancee, moteur, v, attendre, user.id])

  const etat = useMemo<EtatCarte | null>(() => {
    if (!v || anneeAvatar === null) return null
    return {
      anneeAvatar,
      tampons: v.tampons.map((t) => t.decennie),
      // La roulotte (idée 1) : garée là où en est le Voyage suivi ; la sienne, pour qui le mène.
      roulotte: v.source ? { pseudo: v.source.pseudo, annee: v.source.annee_en_cours } : { pseudo: user.pseudo, annee: null },
      cases: v.annees.map((a, i) => {
        const { etat, attente } = etatDeCase(a, v.ia)
        const fiche = fiches[i]
        return {
          annee: a.annee,
          etat,
          attente,
          profondeur: a.profondeur,
          jauge: jauge(a.progression, a.recompense),
          affiches: affichesDeColonne(a, estPrete(fiche) ? fiche : undefined),
        }
      }),
    }
  }, [v, anneeAvatar, fiches, user.pseudo])

  const ticket = v ? tickets.data?.tickets.find((t) => t.annee === v.annee_en_cours + 1 && t.utilise_le === null) : undefined
  const utiliser = useMutation({
    mutationFn: (annee: number) => utiliserTicket(annee),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: cles.voyage })
    },
  })
  // `isPending` ne se voit qu'au rendu suivant (TanStack notifie par `setTimeout`) : deux
  // touchers rapprochés encaisseraient deux fois, et le second répondrait 404 « déjà utilisé ».
  const envoi = useRef(false)
  const encaisser = (annee: number) => {
    if (envoi.current) return
    envoi.current = true
    utiliser.mutate(annee, { onSettled: () => void (envoi.current = false) })
  }

  if (voyage.isPending) return <p role="status">Chargement…</p>
  if (voyage.error || !v) return <Panne erreur={voyage.error} onReessayer={() => void voyage.refetch()} />

  const enCours = v.annees.find((a) => a.annee === v.annee_en_cours)
  const monde = mondes(Math.floor(v.annee_en_cours / 10) * 10)
  const compte = compterRecompenses(recompensesJusquaAnneeEnCours(v.annees, v.annee_en_cours))
  const ticketConnu = !!tickets.data?.tickets.some((t) => t.annee === v.annee_en_cours + 1)
  // Sans progression, l'année n'est pas encore ouverte : « Tout est vu » y serait faux.
  const objectif = !enCours
    ? null
    : !enCours.progression
      ? etatDeCase(enCours, v.ia).attente
        ? 'Tu le rattrapes bientôt'
        : 'Touche l’année pour l’ouvrir'
      : prochainPas(enCours.profondeur, enCours.progression, enCours.recompense, ticketConnu, v.ia)[0] ?? 'Tout est vu'
  const j = enCours ? jauge(enCours.progression, enCours.recompense) : null
  const apercuAnnee = apercu ? v.annees.find((a) => a.annee === apercu.annee) : undefined

  return (
    <div className={styles.ecran} style={{ ['--accent' as string]: monde.palette.accent }}>
      <h1 className="sr-only">Le Voyage de {user.pseudo}</h1>
      {etat ? (
        <CarteCanvas
          etat={etat}
          calme={calme}
          surMoteur={setMoteur}
          rappels={{
            toucherAnnee: (a) => navigate(`/voyage/${a}`),
            apercu: (annee, ancre) => setApercu({ annee, ancre }),
            finApercu: () => setApercu(null),
            ensemble: setEnsemble,
            date: setDate,
            roulotte: () => setRoulotteDite(true),
          }}
        />
      ) : null}

      <header className={styles.hud}>
        <div>
          <span className={styles.chapitre}>{[monde.chapitre, monde.nom].filter(Boolean).join(' · ')}</span>
          <span className={styles.annee}>{v.annee_en_cours}</span>
        </div>
        <p className={styles.recompenses} aria-label={`${compte.palme} Palmes, ${compte.lion} Lions, ${compte.ours} Ours`}>
          <span>{compte.palme}</span> <span>{compte.lion}</span> <span>{compte.ours}</span>
        </p>
        {objectif ? (
          <p className={styles.objectif}>
            <span>{objectif}</span>
            {j ? <b>{`${j.vus}/${j.total}`}</b> : null}
          </p>
        ) : null}
        {v.source ? <p className={styles.source}>Tu suis le Voyage de {v.source.pseudo}</p> : null}
      </header>

      <nav className={`sr-only ${styles.annees}`} aria-label="Les années du Voyage">
        <ul>
          {etat?.cases.map((c) => (
            <li key={c.annee}>
              <Link to={`/voyage/${c.annee}`}>{`${c.annee}, ${c.attente ? 'tu le rattrapes bientôt' : LIBELLE[c.etat]}`}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.boutons}>
        <button type="button" onClick={() => moteur?.allerIci()}>
          Tu es ici
        </button>
        <button type="button" aria-pressed={ensemble} onClick={() => moteur?.basculerEnsemble(!ensemble)}>
          {ensemble ? 'Revenir à la carte' : 'Vue d’ensemble'}
        </button>
      </div>

      {ticket && !avancee ? (
        <div className={styles.ticketOmbre}>
          <button type="button" className={styles.ticket} disabled={utiliser.isPending} onClick={() => encaisser(ticket.annee)}>
            <span>Utiliser le ticket</span>
            <span>{`${v.annee_en_cours} → ${ticket.annee % 10 === 0 ? 'nouveau monde' : ticket.annee}`}</span>
          </button>
        </div>
      ) : null}
      {utiliser.error ? (
        <p role="alert" className={styles.erreur}>
          {utiliser.error instanceof ApiError ? utiliser.error.message : 'Le ticket n’a pas pu être utilisé. Réessaie.'}
        </p>
      ) : null}

      {apercu && apercuAnnee ? (
        <Apercu annee={apercuAnnee} anneeEnCours={v.annee_en_cours} ia={v.ia} attente={etatDeCase(apercuAnnee, v.ia).attente} ancre={apercu.ancre} />
      ) : null}

      {date ? (
        <div className={styles.affiche} role="dialog" aria-modal="true" aria-labelledby="affiche-titre">
          <small>{date.lieu}</small>
          <strong id="affiche-titre">{date.titre}</strong>
          <span>{date.jour}</span>
          <p>{date.texte}</p>
          {date.image ? (
            <figure>
              <img src={date.image.url} alt="" />
              <figcaption>{date.image.legende}</figcaption>
            </figure>
          ) : null}
          <button type="button" onClick={() => setDate(null)}>
            Refermer
          </button>
        </div>
      ) : null}
      {roulotteDite && v.source ? (
        <p role="status" className={styles.roulotte}>
          {`La roulotte de ${v.source.pseudo} : il est rendu en ${v.source.annee_en_cours}, ses salles t’attendent là-bas.`}
        </p>
      ) : null}

      {calque?.type === 'tampon' ? (
        <div className={styles.tampon} role="status">
          <span>Passeport</span>
          <strong>{`Années ${calque.decennie}`}</strong>
          <span>bouclée</span>
          <em>{mondes(calque.decennie).titreVoyageur}</em>
        </div>
      ) : null}
      {calque?.type === 'carton' ? (
        <div className={styles.carton} role="status">
          <p>{mondes(Math.floor(calque.annee / 10) * 10).chapitre}</p>
          <p className="celebration">{mondes(Math.floor(calque.annee / 10) * 10).nom}</p>
          <p>{mondes(Math.floor(calque.annee / 10) * 10).sous}</p>
        </div>
      ) : null}
    </div>
  )
}
