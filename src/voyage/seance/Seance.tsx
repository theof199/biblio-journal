import { useEffect, useRef, useState } from 'react'
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
  type ReponseSeance,
} from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import Feuillet from '../Feuillet'
import { gabaritDe } from '../gabarit'
import { RELECTURES, messageEchecComposition } from '../relecture'
import { etiquetteEtat } from '../salles'
import { candidatsCourt, candidatsLong, corpsRemplacement, seanceRecente, seancesPassees, zoneSeance, type CandidatSeance } from '../seance'
import { useGuet } from '../salles/useFournee'
import Prospectus from './Prospectus'
import styles from './Seance.module.css'

const messageDe = (e: unknown, repli: string) => (e instanceof ApiError ? e.message : repli)

/** La fiche prête en cache, retouchée sans attendre la relecture. */
function majFiche(client: ReturnType<typeof useQueryClient>, annee: number, maj: (f: FichePrete) => FichePrete) {
  client.setQueryData<FicheAnnee>(cles.annee(annee), (f) => (f && 'statut' in f && f.statut === 'prete' ? maj(f) : f))
}

/** Une séance rendue par l'API (`prendre`, `ignorer`, `remplacer`), posée dans la fiche en cache. */
const poserLaSeance = (client: ReturnType<typeof useQueryClient>, annee: number, r: ReponseSeance) =>
  majFiche(client, annee, (f) => ({ ...f, seances: f.seances.map((s) => (s.id === r.seance.id ? r.seance : s)) }))

interface Props {
  monde: Monde
  annee: number
  fiche: Pick<FichePrete, 'seances' | 'seance_en_cours' | 'salles'>
}

/**
 * La séance du soir, sur l'année en cours et au compte IA seulement (la page le garde). Son dessin est
 * une section que le monde peut composer (`gabarits.seance` ; le défaut : `Prospectus`). Ce qui écrit
 * reste ici : composer, prendre, ignorer, chacun gardé contre le double toucher, le guet d'une
 * composition, et le feuillet des remplacements, dans l'adresse (`?remplacer=long|court`).
 */
export default function Seance({ monde, annee, fiche }: Props) {
  const client = useQueryClient()
  const LaSeance = gabaritDe(monde, 'seance', Prospectus)
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
    <>
      <LaSeance
        monde={monde}
        annee={annee}
        zone={zone}
        carte={carte}
        passees={passees}
        composer={{ lancer, occupe: composer.isPending, erreur: composer.error ? messageDe(composer.error, 'La séance n’a pas pu se demander. Réessaie.') : echec }}
        guet={{ abandon: guet.abandon, message: messageEchecComposition('abandon', avant.current ?? nombre, nombre), reessayer: guet.reessayer }}
        talons={{
          prendre: () => carte && agir(carte.id, true),
          ignorer: () => carte && agir(carte.id, false),
          autreLong: () => feuillet.ouvrir('long'),
          autreCourt: () => feuillet.ouvrir('court'),
          erreur: erreurGeste,
          frappe,
        }}
      />
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
    </>
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
                  {c.affiche ? <img src={c.affiche} alt="" loading="lazy" decoding="async" /> : <span className={styles.sansImage} />}
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
