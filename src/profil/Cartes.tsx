import { jourLocal } from '../ui/format'
import { DECENNIES_DU_VOYAGE, bilanJournal, decenniesCouvertesGrille, filmsParMois, repartitionNotes } from './bilan'
import styles from './Cartes.module.css'
import type { JournalItem } from '../api/journal'

const LARGEUR_BARRE = 10
const HAUTEUR = 40

/** Un histogramme sobre, à la main : une barre par valeur, à l'échelle du maximum (jamais de bibliothèque pour dix rectangles). */
export function GraphiqueBarres({ valeurs, libelle }: { valeurs: number[]; libelle: string }) {
  const max = Math.max(1, ...valeurs)
  return (
    <svg
      className={styles.graphique}
      viewBox={`0 0 ${valeurs.length * LARGEUR_BARRE} ${HAUTEUR}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${libelle} : ${valeurs.join(', ')}`}
    >
      {valeurs.map((v, i) => {
        // Une barre à zéro garde un filet, pour qu'on la voie vide plutôt qu'absente.
        const hauteur = v === 0 ? 1 : (HAUTEUR * v) / max
        const x = i * LARGEUR_BARRE + LARGEUR_BARRE * 0.15
        const largeur = LARGEUR_BARRE * 0.7
        return (
          <g key={i}>
            <rect className={styles.fondBarre} x={x} y={0} width={largeur} height={HAUTEUR} />
            <rect className={styles.barre} x={x} y={HAUTEUR - hauteur} width={largeur} height={hauteur} data-valeur={v} />
          </g>
        )
      })}
    </svg>
  )
}

/** Quatorze cases, une par décennie du Voyage : pleine si un film de la décennie a été vu. */
export function GrilleDecennies({ couvertes, decennies }: { couvertes: boolean[]; decennies: readonly number[] }) {
  return (
    <ul className={styles.grille} aria-label="Décennies couvertes">
      {couvertes.map((oui, i) => (
        <li
          key={decennies[i]}
          className={`${styles.case} ${oui ? styles.caseCouverte : ''}`}
          aria-label={`${decennies[i]} : ${oui ? 'couverte' : 'pas encore'}`}
        />
      ))}
    </ul>
  )
}

const virgule = (n: number) => String(n).replace('.', ',')

/** « … » tant que le journal n'est pas là : jamais un chiffre provisoire, ni un zéro qui se ferait passer pour un compte. */
export function BilanCarte({ journal, anneeCourante }: { journal: JournalItem[] | undefined; anneeCourante: number }) {
  const b = journal ? bilanJournal(journal, anneeCourante) : null
  const d = b?.decennies
  const lignes = [
    b ? `${b.seancesEnSalle} séances en salle, dont ${b.seancesEnSalleCetteAnnee} cette année` : '…',
    !b ? '…' : b.noteMoyenne === null ? 'Aucun film noté' : `Note moyenne : ${virgule(b.noteMoyenne)}/10`,
    !b
      ? '…'
      : !d
        ? 'Aucune année connue'
        : `${d.premiere} → ${d.derniere}, ${d.couvertes} ${d.couvertes > 1 ? 'décennies' : 'décennie'} sur ${d.total}`,
    !b
      ? '…'
      : b.plusAncien === null
        ? 'Le plus ancien : inconnu'
        : `Le plus ancien : ${b.plusAncien.titre} (${b.plusAncien.annee})`,
  ]
  return (
    <section className={styles.carte} aria-label="Bilan">
      <h2 className={styles.titre}>Bilan</h2>
      {lignes.map((l, i) => (
        <p key={i} className={styles.ligne}>
          {l}
        </p>
      ))}
    </section>
  )
}

/** Trois séries pures dessinées ici ; absente tant que le journal est vide ou pas arrivé (pas de graphique à zéro partout). */
export function GraphiquesCarte({ journal }: { journal: JournalItem[] | undefined }) {
  if (!journal || journal.length === 0) return null
  const moisCourant = jourLocal().slice(0, 7)
  return (
    <section className={styles.carte} aria-label="Graphiques">
      <h2 className={styles.titre}>Graphiques</h2>
      <p className={styles.sousTitre}>Films par mois</p>
      <GraphiqueBarres valeurs={filmsParMois(journal, moisCourant)} libelle="Films par mois" />
      <p className={styles.sousTitre}>Décennies couvertes</p>
      <GrilleDecennies couvertes={decenniesCouvertesGrille(journal)} decennies={DECENNIES_DU_VOYAGE} />
      <p className={styles.sousTitre}>Répartition des notes</p>
      <GraphiqueBarres valeurs={repartitionNotes(journal)} libelle="Répartition des notes" />
    </section>
  )
}