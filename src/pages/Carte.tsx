import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconCurrentLocation, IconMap2, IconVolume, IconVolumeOff } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { ApiError } from '../api/client'
import { estPrete, lireAnnee, lireTickets, lireVoyage, utiliserTicket, type FicheAnnee } from '../api/voyage'
import CarteCanvas, { type Moteur } from '../carte/CarteCanvas'
import Apercu from '../carte/Apercu'
import type { EtatCarte } from '../carte/moteur'
import { jouerAvancee } from '../carte/avancee'
import { ecrireAnneeVue, ecrireBobines, ecrireSon, lireAnneeVue, lireBobines, lireSon } from '../carte/memoire'
import { ambianceDeLaPage } from '../carte/son'
import { STYLE_DU_TEMPO } from '../voyage/tempo'
import { creerRegistre } from '../mondes'
import type { DateVraie } from '../mondes/types'
import { useSession } from '../session/SessionContext'
import Panne from '../ui/Panne'
import { vibrer } from '../ui/haptique'
import { useMouvementReduit } from '../ui/mouvement'
import { tamponDe } from '../voyage/passeport'
import Tampon from '../voyage/passeport/Tampon'
import {
  affichesDeColonne,
  compterRecompenses,
  decennieDe,
  detecterFrontiereAvancee,
  etatDeCase,
  jauge,
  prochainPas,
  recompensesJusquaAnneeEnCours,
  rattrapeBientot,
  tropLent,
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
/**
 * Le message d'une bobine qui arrive au compteur s'efface après trois secondes ; celui des trois
 * retrouvées vient après lui (maquette : `toast`, et le `setTimeout` de 3300 ms d'`arriver`). Des
 * temps de lecture, pas d'animation : ils ne suivent pas le tempo.
 */
const LECTURE_MS = 3000
const APRES_LA_DERNIERE_MS = 3300
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
  /** Vrai tant que le moteur n'a pas dit le contraire : « Tu es ici » ne s'offre qu'à l'avatar perdu de vue. */
  const [avatarVu, setAvatarVu] = useState(true)
  /** L'année à bâtir sous les yeux dès que le moteur est là : la toute première visite, au départ du Voyage (idée 8). */
  const [chantierDuDepart, setChantierDuDepart] = useState<number | null>(null)
  const [date, setDate] = useState<DateVraie | null>(null)
  const [roulotteDite, setRoulotteDite] = useState(false)
  const [calque, setCalque] = useState<{ type: 'tampon'; decennie: number } | { type: 'carton'; annee: number } | null>(null)

  // Le son (plan 2d) : une ambiance par page, qui ne crée rien avant le bouton « Son ». Le réglage
  // retenu ne rallume rien de lui-même : il dit seulement au bouton de proposer de le reprendre.
  const [ambiance] = useState(() => ambianceDeLaPage(user.id))
  const [sonEnMarche, setSonEnMarche] = useState(() => ambiance.enMarche)
  const [sonVoulu, setSonVoulu] = useState(() => lireSon(user.id))
  useEffect(() => {
    const cache = () => ambiance.taire(document.hidden)
    cache()
    document.addEventListener('visibilitychange', cache)
    return () => {
      document.removeEventListener('visibilitychange', cache)
      ambiance.taire(true)
    }
  }, [ambiance])
  const basculerSon = () => {
    if (ambiance.enMarche) {
      ambiance.couper()
      setSonEnMarche(false)
      setSonVoulu(false)
      ecrireSon(user.id, false)
    } else if (ambiance.allumer()) {
      setSonEnMarche(true)
      setSonVoulu(true)
      ecrireSon(user.id, true)
    } else {
      setMessage({ titre: 'Le son n’est pas disponible dans ce navigateur.', texte: null })
    }
  }

  // Les bobines perdues (plan 2d) : trouvées sur cet appareil, par membre. Celle qui vole vers le
  // compteur n'y est comptée qu'à son arrivée.
  const [trouvees, setTrouvees] = useState(() => lireBobines(user.id))
  const trouveesRef = useRef(trouvees)
  const [enVol, setEnVol] = useState<string | null>(null)
  const [pulsation, setPulsation] = useState(0)
  const [message, setMessage] = useState<{ titre: string; texte: string | null } | null>(null)
  const compteurRef = useRef<HTMLParagraphElement>(null)
  const ecranRef = useRef<HTMLDivElement>(null)
  const derniereRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (derniereRef.current !== null && clearTimeout(derniereRef.current)), [])
  useEffect(() => {
    if (!message) return
    const j = setTimeout(() => setMessage(null), LECTURE_MS)
    return () => clearTimeout(j)
  }, [message])

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

  const bobinesDuVoyage = useMemo(() => [...new Set((v?.annees ?? []).map((a) => decennieDe(a.annee)))].flatMap((d) => mondes(d).bobines), [v])

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
  // Une année en attente du Voyage suivi le dit de lui (`tropLent`), nulle part ailleurs.
  const lent = tropLent(v.source)
  // La lectrice derrière le voyageur suivi : son année en cours le dit, nulle autre.
  const rattrape = rattrapeBientot(v)
  // Sans progression, l'année n'est pas encore ouverte : « Tout est vu » y serait faux.
  const objectif = !enCours
    ? null
    : !enCours.progression
      ? etatDeCase(enCours, v.ia).attente
        ? lent
        : 'Touche l’année pour l’ouvrir'
      : prochainPas(enCours.profondeur, enCours.progression, enCours.recompense, ticketConnu, v.ia)[0] ?? 'Tout est vu'
  const j = enCours ? jauge(enCours.progression, enCours.recompense) : null
  const apercuAnnee = apercu ? v.annees.find((a) => a.annee === apercu.annee) : undefined
  const comptees = (cles: readonly string[], sauf: string | null) => bobinesDuVoyage.filter((b) => cles.includes(b.cle) && b.cle !== sauf).length
  const nBobines = comptees(trouvees, enVol)
  const ramassee = (cle: string) => {
    if (!trouveesRef.current.includes(cle)) trouveesRef.current = [...trouveesRef.current, cle]
    setTrouvees(trouveesRef.current)
    ecrireBobines(user.id, trouveesRef.current)
    setEnVol(cle)
    ambiance.carillon()
  }
  const arrivee = (cle: string) => {
    setEnVol(null)
    setPulsation((p) => p + 1)
    const b = bobinesDuVoyage.find((x) => x.cle === cle)
    const n = comptees(trouveesRef.current, null)
    const total = bobinesDuVoyage.length
    if (b) setMessage({ titre: `Bobine retrouvée ${n}/${total}`, texte: `« ${b.titre} », ${b.qui} : un film perdu.` })
    if (b && n === total) {
      if (derniereRef.current !== null) clearTimeout(derniereRef.current)
      derniereRef.current = setTimeout(() => setMessage({ titre: total === 3 ? 'Les trois bobines perdues sont retrouvées.' : 'Toutes les bobines perdues sont retrouvées.', texte: null }), APRES_LA_DERNIERE_MS)
    }
  }
  // Maquette : `cibleHud`. Le compteur caché (avant la première trouvaille), le coin haut droit.
  const cibleBobines = () => {
    const e = ecranRef.current?.getBoundingClientRect()
    const r = compteurRef.current?.getBoundingClientRect()
    if (e && r && r.width) return { x: r.left - e.left + 14, y: r.top - e.top + r.height / 2 }
    return { x: (e?.width || 390) - 40, y: 40 }
  }

  return (
    <div ref={ecranRef} className={styles.ecran} style={{ ['--accent' as string]: monde.palette.accent, ...STYLE_DU_TEMPO }}>
      <h1 className="sr-only">Le Voyage de {user.pseudo}</h1>
      {etat ? (
        <CarteCanvas
          etat={etat}
          calme={calme}
          bobines={trouvees}
          surMoteur={setMoteur}
          rappels={{
            toucherAnnee: (a) => navigate(`/voyage/${a}`),
            apercu: (annee, ancre) => setApercu({ annee, ancre }),
            finApercu: () => setApercu(null),
            ensemble: setEnsemble,
            date: setDate,
            roulotte: () => setRoulotteDite(true),
            avatarVisible: setAvatarVu,
            bobine: ramassee,
            bobineArrivee: arrivee,
            cibleBobines,
            clap: () => ambiance.clap(),
            presences: (liste) => ambiance.presences(liste),
          }}
        />
      ) : null}

      <header className={styles.hud}>
        <div>
          {/* Le chapitre ouvre la page de la décennie en cours (plan 2c, décision D5). */}
          <Link to={`/voyage/decennies/${decennieDe(v.annee_en_cours)}`} className={styles.chapitre}>
            {[monde.chapitre, monde.nom].filter(Boolean).join(' · ')}
          </Link>
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
        {v.source ? <p className={styles.source}>{`Tu suis le Voyage de ${v.source.pseudo}${rattrape ? ' · tu le rattrapes bientôt' : ''}`}</p> : null}
        {/* Le compteur des bobines perdues : discret, il n'apparaît qu'à la première (maquette : `#hudBob`). */}
        <p ref={compteurRef} key={pulsation} className={`${styles.bobines}${pulsation ? ` ${styles.pulse}` : ''}`} hidden={nBobines === 0 && enVol === null}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8.6" fill="currentColor" />
            <circle cx="10" cy="10" r="6.8" fill="#3a2a12" />
            <g fill="currentColor">
              <circle cx="10" cy="5.9" r="1.7" />
              <circle cx="13.9" cy="8.7" r="1.7" />
              <circle cx="12.4" cy="13.3" r="1.7" />
              <circle cx="7.6" cy="13.3" r="1.7" />
              <circle cx="6.1" cy="8.7" r="1.7" />
            </g>
            <circle cx="10" cy="10" r="1.1" fill="currentColor" />
          </svg>
          <span>{`Bobines retrouvées ${nBobines}/${bobinesDuVoyage.length}`}</span>
        </p>
      </header>

      <nav className={`sr-only ${styles.annees}`} aria-label="Les années du Voyage">
        <ul>
          {etat?.cases.map((c) => (
            <li key={c.annee}>
              <Link to={`/voyage/${c.annee}`}>{`${c.annee}, ${c.attente && lent ? lent : LIBELLE[c.etat]}${rattrape && c.annee === v.annee_en_cours ? ', tu le rattrapes bientôt' : ''}`}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.boutons}>
        <button
          type="button"
          aria-label="Son"
          title={sonEnMarche ? 'Son : allumé' : sonVoulu ? 'Son : touche pour le reprendre' : 'Son : coupé'}
          aria-pressed={sonEnMarche}
          onClick={basculerSon}
        >
          {sonEnMarche || sonVoulu ? <IconVolume size={20} aria-hidden="true" /> : <IconVolumeOff size={20} aria-hidden="true" />}
        </button>
        {!avatarVu && !ensemble ? (
          <button type="button" aria-label="Tu es ici" title="Tu es ici" onClick={() => moteur?.allerIci()}>
            <IconCurrentLocation size={20} aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label={ensemble ? 'Revenir à la carte' : 'Vue d’ensemble'}
          title={ensemble ? 'Revenir à la carte' : 'Vue d’ensemble'}
          aria-pressed={ensemble}
          onClick={() => moteur?.basculerEnsemble(!ensemble)}
        >
          <IconMap2 size={20} aria-hidden="true" />
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
        <Apercu annee={apercuAnnee} anneeEnCours={v.annee_en_cours} ia={v.ia} attente={etatDeCase(apercuAnnee, v.ia).attente} tropLent={lent} rattrape={rattrape} ancre={apercu.ancre} />
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
      {message ? (
        <p role="status" className={styles.message}>
          <b>{message.titre}</b>
          {message.texte ? (
            <>
              <br />
              {message.texte}
            </>
          ) : null}
        </p>
      ) : null}
      {roulotteDite && v.source ? (
        <p role="status" className={styles.roulotte}>
          {`La roulotte de ${v.source.pseudo} : il est rendu en ${v.source.annee_en_cours}, ses salles t’attendent là-bas.`}
        </p>
      ) : null}

      {calque?.type === 'tampon' ? (
        <div className={styles.tampon} role="status">
          <Tampon monde={mondes(calque.decennie)} decennie={calque.decennie} tampon={tamponDe(v.tampons, calque.decennie)} frappe />
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
