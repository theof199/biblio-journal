import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import {
  composerUneSeance,
  ignorerLaSeance,
  prendreLaSeance,
  remplacerDansLaSeance,
  type CorpsRemplacement,
  type FicheAnnee,
  type FichePrete,
  type FilmSeance,
  type ReponseSeance,
  type Seance as SeanceDeLAnnee,
} from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import Feuillet from '../Feuillet'
import { RELECTURES, messageEchecComposition } from '../relecture'
import { etiquetteEtat } from '../salles'
import { candidatsCourt, candidatsLong, corpsRemplacement, seanceRecente, seancesPassees, zoneSeance, type CandidatSeance } from '../seance'
import { useGuet } from '../salles/useFournee'
import styles from './Seance.module.css'

const messageDe = (e: unknown, repli: string) => (e instanceof ApiError ? e.message : repli)

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** La fiche prête en cache, retouchée sans attendre la relecture. */
function majFiche(client: ReturnType<typeof useQueryClient>, annee: number, maj: (f: FichePrete) => FichePrete) {
  client.setQueryData<FicheAnnee>(cles.annee(annee), (f) => (f && 'statut' in f && f.statut === 'prete' ? maj(f) : f))
}

/** Une séance rendue par l'API (`prendre`, `ignorer`, `remplacer`), posée dans la fiche en cache. */
const poserLaSeance = (client: ReturnType<typeof useQueryClient>, annee: number, r: ReponseSeance) =>
  majFiche(client, annee, (f) => ({ ...f, seances: f.seances.map((s) => (s.id === r.seance.id ? r.seance : s)) }))

/** Le billet d'un morceau : celui de sa bobine quand le court est une bobine précise du programme. */
const billetDe = (annee: number, f: FilmSeance) => `/voyage/${annee}/films/${f.film_id}/billet${f.bobine ? `?bobine=${f.bobine.tmdb_id}` : ''}`

interface Props {
  monde: Monde
  annee: number
  fiche: Pick<FichePrete, 'seances' | 'seance_en_cours' | 'salles'>
}

/**
 * « Ce soir à la baraque » (maquette 1890 : `seance`, styles 207 à 225 ; portée de `BlocSeance`,
 * `AnneeScreen.kt`), sur l'année en cours et au compte IA seulement (la page le garde) : « Composer
 * une séance », le prospectus d'attente, ou le prospectus de la séance et ses talons ; les séances
 * passées, repliées. Chaque écriture est gardée contre le double toucher.
 */
export default function Seance({ monde, annee, fiche }: Props) {
  const client = useQueryClient()
  const m = monde.pages.mots
  const zone = zoneSeance(fiche.seance_en_cours, fiche.seances)
  const recente = seanceRecente(fiche.seances)
  const passees = seancesPassees(fiche.seances)
  const guet = useGuet(annee, fiche.seance_en_cours, RELECTURES.seance)

  // Le nombre de séances quand la composition est partie : à la fin, sans séance de plus, la page le dit.
  const avant = useRef<number | null>(null)
  const [echec, setEchec] = useState<string | null>(null)
  const enCours = fiche.seance_en_cours
  const nombre = fiche.seances.length
  useEffect(() => {
    if (enCours || avant.current === null) return
    setEchec(messageEchecComposition('fini', avant.current, nombre))
    avant.current = null
  }, [enCours, nombre])

  const composer = useMutation({
    mutationFn: () => composerUneSeance(annee),
    // La fiche en cache se marque tout de suite : le guet part sans attendre un aller-retour.
    onSuccess: (_r, n: number) => {
      avant.current = n
      majFiche(client, annee, (f) => ({ ...f, seance_en_cours: true }))
    },
  })
  const envoi = useRef(false)
  const lancer = () => {
    if (envoi.current) return
    envoi.current = true
    setEchec(null)
    composer.mutate(nombre, { onSettled: () => void (envoi.current = false) })
  }

  const [frappe, setFrappe] = useState(false)
  const geste = useMutation({
    mutationFn: ({ id, prendre }: { id: string; prendre: boolean }) => (prendre ? prendreLaSeance(id) : ignorerLaSeance(id)),
    // `seance_prise` de la carte (la carte « Ce soir » de l'accueil) et la fiche se relisent.
    onSuccess: (r) => {
      poserLaSeance(client, annee, r)
      void client.invalidateQueries({ queryKey: cles.voyage })
    },
  })
  const agir = (id: string, prendre: boolean) => {
    if (envoi.current) return
    envoi.current = true
    geste.mutate({ id, prendre }, { onSuccess: () => setFrappe(prendre), onSettled: () => void (envoi.current = false) })
  }

  const feuillet = useCalque('remplacer')
  const morceau = feuillet.valeur === 'long' || feuillet.valeur === 'court' ? feuillet.valeur : null

  const carte = (zone === 'proposee' || zone === 'prise') && recente ? recente : null
  const erreurGeste = geste.error ? messageDe(geste.error, 'La séance n’a pas pu s’écrire. Réessaie.') : null

  return (
    <section aria-label={`${m.seance.titre} ${m.seance.sous}`}>
      <p className={styles.titreSec}>
        {m.seance.titre} <small>{m.seance.sous}</small>
      </p>

      {zone === 'bouton' ? (
        <div className={styles.composer}>
          <button type="button" className={styles.bouton} onClick={lancer} disabled={composer.isPending}>
            Composer une séance
          </button>
          {composer.error ? (
            <p role="alert" className={styles.message}>
              {messageDe(composer.error, 'La séance n’a pas pu se demander. Réessaie.')}
            </p>
          ) : echec ? (
            <p role="alert" className={styles.message}>
              {echec}
            </p>
          ) : null}
        </div>
      ) : zone === 'en_cours' ? (
        <div className={styles.papier}>
          <p className={styles.gros}>
            Grande séance<small>en composition</small>
          </p>
          {guet.abandon ? (
            <div role="alert">
              <p className={styles.texte}>{messageEchecComposition('abandon', avant.current ?? nombre, nombre)}</p>
              <button type="button" className={styles.bouton} onClick={guet.reessayer}>
                Réessayer
              </button>
            </div>
          ) : (
            <p role="status" className={`${styles.texte} ${styles.plume}`}>
              Le chroniqueur compose la séance…
            </p>
          )}
        </div>
      ) : carte ? (
        <article className={`${styles.papier} ${styles.seance}`} aria-label={`Séance n° ${carte.rang}`}>
          <p className={styles.gros}>
            Grande séance<small>ce soir à 8 h ½</small>
          </p>
          <div className={styles.num}>
            <span>{`Séance n° ${carte.rang}`}</span>
            <span>Entrée libre</span>
          </div>
          <Partie monde={monde} annee={annee} role="Le long" film={carte.long} />
          {carte.court ? <Partie monde={monde} annee={annee} role="En ouverture" film={carte.court} /> : null}
          <p className={styles.entracte}>
            <span>Pendant le générique</span>
            {carte.anecdote}
          </p>
          <div className={styles.talons}>
            {carte.statut === 'proposee' ? (
              <button type="button" className={`${styles.talon} ${styles.plein}`} onClick={() => agir(carte.id, true)}>
                Prendre
              </button>
            ) : null}
            <button type="button" className={styles.talon} onClick={() => agir(carte.id, false)}>
              Ignorer
            </button>
            <button type="button" className={styles.talon} onClick={() => feuillet.ouvrir('long')}>
              Autre long
            </button>
            <button type="button" className={styles.talon} onClick={() => feuillet.ouvrir('court')}>
              Autre court
            </button>
          </div>
          {carte.statut === 'prise' ? <span className={`${styles.tampon} ${frappe ? styles.frappe : ''}`}>PRISE</span> : null}
          {erreurGeste ? (
            <p role="alert" className={styles.erreur}>
              {erreurGeste}
            </p>
          ) : null}
          <div className={`${styles.num} ${styles.pied}`}>
            <span>À rendre avant minuit</span>
            <span>{`Talon n° ${carte.rang}`}</span>
          </div>
        </article>
      ) : null}

      {passees.length > 0 ? <Passees seances={passees} /> : null}

      {carte && morceau ? (
        <Feuillet monde={monde} titre={morceau === 'long' ? 'Un autre long' : 'Un autre court'} onFermer={feuillet.fermer}>
          <Remplacements
            annee={annee}
            seance={carte.id}
            morceau={morceau}
            groupes={morceau === 'long' ? candidatsLong(fiche.salles) : candidatsCourt(fiche.salles, carte.long.film_id)}
            monde={monde}
            onFermer={feuillet.fermer}
          />
        </Feuillet>
      ) : null}
    </section>
  )
}

/** Un morceau de la séance : son affiche, son rôle, son titre, sa salle et son état ; « Je l’ai vu » s'il ne l'est pas. */
function Partie({ monde, annee, role, film }: { monde: Monde; annee: number; role: string; film: FilmSeance }) {
  const etat = etiquetteEtat(film.etat, monde.pages.mots.introuvable)
  return (
    <div className={styles.partie}>
      <span className={styles.cab}>{film.cover_url ? <img src={film.cover_url} alt="" /> : <span className={styles.sansImage} />}</span>
      <div>
        <span className={styles.role}>{role}</span>
        <b>{film.title}</b>
        <small>{`${film.salle} · ${etat}`}</small>
        {film.etat !== 'vu' ? (
          <Link to={billetDe(annee, film)} className={styles.vu} aria-label={`Je l’ai vu : ${film.title}`}>
            Je l’ai vu
          </Link>
        ) : null}
      </div>
    </div>
  )
}

/** « Séances passées » : le long et la date, repliés ; une séance prise dont le long est vu dit « vue ». */
function Passees({ seances }: { seances: SeanceDeLAnnee[] }) {
  return (
    <details className={styles.passees}>
      <summary>Séances passées</summary>
      <ul>
        {seances.map((s) => (
          <li key={s.id}>{`${s.long.title} · ${JOUR.format(new Date(s.composee_le))}${s.statut === 'prise' && s.long.etat === 'vu' ? ' · vue' : ''}`}</li>
        ))}
      </ul>
    </details>
  )
}

interface PropsRemplacements {
  annee: number
  seance: string
  morceau: 'long' | 'court'
  groupes: ReturnType<typeof candidatsLong>
  monde: Monde
  onFermer: () => void
}

/**
 * Le feuillet « Autre long » / « Autre court » : un choix local, par salle, une bobine en retrait sous
 * son programme ; le choix s'écrit sans appel au chroniqueur. Le feuillet porte sa mutation : les
 * rappels de `mutate` se taisent une fois le feuillet démonté (le « retour » du téléphone pendant
 * l'envoi), alors que ceux d'une mutation qui lui survit reculeraient une seconde fois, hors de l'année.
 */
function Remplacements({ annee, seance, morceau, groupes, monde, onFermer }: PropsRemplacements) {
  const client = useQueryClient()
  const remplacer = useMutation({
    mutationFn: (corps: CorpsRemplacement) => remplacerDansLaSeance(seance, corps),
    onSuccess: (r) => {
      poserLaSeance(client, annee, r)
      void client.invalidateQueries({ queryKey: cles.voyage })
    },
  })
  const envoi = useRef(false)
  const onChoisir = (c: CandidatSeance) => {
    if (envoi.current) return
    envoi.current = true
    remplacer.mutate(corpsRemplacement(morceau, c), { onSuccess: onFermer, onSettled: () => void (envoi.current = false) })
  }
  const occupe = remplacer.isPending
  const erreur = remplacer.error ? messageDe(remplacer.error, 'La séance n’a pas pu changer. Réessaie.') : null

  return (
    <>
      {groupes.length === 0 ? <p className={styles.rien}>Rien à proposer pour l’instant.</p> : null}
      {groupes.map((g) => (
        <section key={g.salle} aria-label={g.salle}>
          <h3 className={styles.salle}>{g.salle}</h3>
          <ul className={styles.choix}>
            {g.candidats.map((c) => (
              <li key={`${c.filmId}-${c.type}-${c.tmdbId}`}>
                <button type="button" className={`${styles.candidat} ${c.type === 'bobine' ? styles.bobine : ''}`} disabled={occupe} onClick={() => onChoisir(c)}>
                  {c.affiche ? <img src={c.affiche} alt="" /> : <span className={styles.sansImage} />}
                  <span>
                    {c.titre}
                    <small>{`${c.type === 'bobine' ? 'bobine · ' : ''}${etiquetteEtat(c.etat, monde.pages.mots.introuvable)}`}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {erreur ? (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      ) : null}
    </>
  )
}
