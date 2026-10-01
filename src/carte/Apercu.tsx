import { useQuery } from '@tanstack/react-query'
import { cles } from '../api/cles'
import { estPrete, lireAnnee, type AnneeCarte } from '../api/voyage'
import { RATTRAPE, apercuLitLaFiche, prochainPas } from '../voyage/regles'
import styles from './Carte.module.css'

const RECOMPENSE = { palme: 'Palme', lion: 'Lion', ours: 'Ours' } as const

interface Props {
  annee: AnneeCarte
  anneeEnCours: number
  ia: boolean
  attente: boolean
  /** Ce que dit une année en attente (`tropLent`) ; nul sans voyageur suivi. */
  tropLent: string | null
  /** L'année en cours de la lectrice, derrière le voyageur suivi (`rattrapeBientot`). */
  rattrape: boolean
  ancre: { x: number; y: number }
}

/**
 * L'aperçu d'une année, à l'appui long (maquette : `montrerApercu`). Ses trois meilleurs films
 * sont son podium, que seule la fiche porte : elle ne se lit que si l'année est déjà écrite
 * (`apercuLitLaFiche`), jamais sur une année dont la lecture réveillerait le chroniqueur.
 */
export default function Apercu({ annee, anneeEnCours, ia, attente, tropLent, rattrape, ancre }: Props) {
  const fiche = useQuery({
    queryKey: cles.annee(annee.annee),
    queryFn: ({ signal }) => lireAnnee(annee.annee, signal),
    enabled: apercuLitLaFiche(annee),
  })
  const prete = estPrete(fiche.data) ? fiche.data : null
  const titre =
    annee.statut === 'verrouillee' ? 'À tourner' : annee.statut === 'en_cours' ? 'En cours' : annee.recompense ? RECOMPENSE[annee.recompense] : 'Passée'
  let corps: string | null = null
  if (annee.statut === 'verrouillee') corps = 'Personne ici pour l’instant.'
  else if (attente) corps = tropLent ? `${tropLent}.` : null
  // Le titre dit déjà « En cours » : la phrase s'y ajoute.
  else if (rattrape && annee.annee === anneeEnCours) corps = `${RATTRAPE}.`
  else if (!annee.visitee) corps = 'Pas encore ouverte : touche l’année pour l’ouvrir.'
  const films = prete ? prete.podium.flatMap((m) => (m ? [m.title] : [])) : []
  // Sans progression (année pas encore ouverte), rien à compter : jamais « Tout est vu ».
  const reste = annee.progression
    ? prochainPas(annee.profondeur, annee.progression, annee.recompense, annee.annee !== anneeEnCours, ia)[0] ?? 'Tout est vu'
    : null

  return (
    <div className={styles.apercu} role="status" style={{ left: ancre.x, top: ancre.y }}>
      <p className={styles.apercuTete}>
        <span className={styles.apercuAnnee}>{annee.annee}</span> <span>{titre}</span>
      </p>
      {corps ? <p className={styles.apercuVide}>{corps}</p> : null}
      {films.length > 0 ? (
        <ol className={styles.apercuFilms}>
          {films.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ol>
      ) : null}
      {annee.statut !== 'verrouillee' ? (
        <p className={styles.apercuBas}>
          <span>{`${annee.profondeur} film${annee.profondeur > 1 ? 's' : ''}`}</span> {reste ? <b>{reste}</b> : null}
        </p>
      ) : null}
    </div>
  )
}
