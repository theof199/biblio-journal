import { useState } from 'react'
import { MAX_REACTIONS, basculerReaction } from '../../../api/reactions'
import { formatDateVisionnage, jourLocal } from '../../../ui/format'
import { useMouvementReduit } from '../../../ui/mouvement'
import Panne from '../../../ui/Panne'
import { decalerJour, peutAvancer, raccourci } from '../../../voyage/billet'
import { INERTE, type Etape, type PropsBilletDeSeance } from '../../../voyage/billet/BilletDeSeance'
import { NUMERO_EN_ATTENTE, numeroLisible, tirerLeNumero } from '../../../voyage/billets'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { imageDu1900 } from '../images'
import Action from './Action'
import Carton, { type GesteDuCarton } from './Carton'
import { MOTS_DU_COMPOSTEUR as M, PLACES, compteDesCoupons, datePressee, ligneDuFilm, molettesDeLaPresse } from './carton'
import Rubrique from './Rubrique'
import styles from './Composteur.module.css'

/** Ce que le composteur fait du carton à chaque étape de la séquence, que la page joue seule. */
const GESTES: Readonly<Record<Etape, GesteDuCarton | null>> = { repos: null, descend: 'avale', pose: 'frappe', remonte: 'rendu', numerote: null, talon: 'part' }

const NOTES = Array.from({ length: PLACES }, (_, i) => i + 1)

/**
 * Le composteur, le billet de séance des années 1900 (maquette, écrans 6 et 7) : le carton Edmondson
 * en tête, qui porte le titre de la page et montre ce qu'on y écrit (la date se presse sur sa tranche,
 * la note s'y perce), puis le formulaire : la date, la note, les réactions en coupons, la remarque en
 * carnet. Sous le bouton, « Le modèle » : les billets du Métropolitain.
 *
 * La page garde tout ce qui lit et écrit ; elle joue la séquence du compostage et n'en passe que
 * l'étape : le composteur avale le carton, le frappe, le rend, le numéro roule, le carton part. En
 * correction, rien ne se joue : le carton est déjà tamponné, son numéro lu en tête. Tout geste du
 * billet par défaut reste offert, « ‹ », « › » et « sans note » compris.
 */
export default function Composteur({ monde, annee, film, correction, brouillon, onRetoucher, reactions, numero, tirage, etape, support, occupe, refus, onComposter, suppression }: PropsBilletDeSeance) {
  const mots = monde.pages.mots.billet
  const calme = useMouvementReduit()
  // Ce qui vient de changer sous le doigt, pour que le carton le montre : rien au montage.
  const [frais, setFrais] = useState<{ trous?: { depuis: number; tour: number }; presse?: number; dateDAvant?: string }>({})

  const aujourdhui = jourLocal()
  const allume = raccourci(brouillon.date, aujourdhui)
  const dater = (date: string) => {
    onRetoucher((b) => ({ ...b, date }))
    if (!occupe && date !== brouillon.date) setFrais((f) => ({ ...f, presse: (f.presse ?? 0) + 1, dateDAvant: brouillon.date }))
  }
  const noter = (note: number | null) => {
    onRetoucher((b) => ({ ...b, note }))
    if (!occupe) setFrais((f) => ({ ...f, trous: note !== null && note > (brouillon.note ?? 0) ? { depuis: brouillon.note ?? 0, tour: (f.trous?.tour ?? 0) + 1 } : undefined }))
  }

  const roule = tirage !== null
  const ordre = reactions.catalogue?.map((r) => r.cle) ?? []
  // Le tampon : posé dès que le composteur frappe, et pour toujours sur un billet qu'on corrige.
  const tamponne = correction || etape === 'pose' || etape === 'remonte' || etape === 'numerote' || etape === 'talon'
  const modele = imageDu1900('billets-metro')

  return (
    <div className={styles.composteur} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      {correction ? (
        <Rubrique balise="p">
          {M.tonBillet} <small>{M.tonBilletSous}</small>
        </Rubrique>
      ) : null}
      <div ref={support} className={styles.zone}>
        <Carton
          tete={M.compagnie}
          titre={film.titre}
          titreDePage
          sous={ligneDuFilm(film.realisateur, annee)}
          numero={roule ? tirerLeNumero(numero, tirage) : numero !== null ? numeroLisible(numero) : NUMERO_EN_ATTENTE}
          numeroQuiRoule={roule}
          note={brouillon.note}
          presse={datePressee(brouillon.date)}
          tampon={tamponne ? { mot: mots.tampon, dit: `${mots.tampon} : ${mots.tamponAutour} ${formatDateVisionnage(brouillon.date)}` } : null}
          geste={GESTES[etape]}
          frais={frais}
        />
      </div>

      {/* Le billet parti, rien du formulaire ne répond, au doigt comme au clavier, focus compris. */}
      <div className={styles.formulaire} {...(occupe ? INERTE : null)}>
        <div className={styles.rub}>
          <p className={styles.rubTete}>
            {M.date} <em>{M.dateSous}</em>
          </p>
          <div className={styles.roues} role="group" aria-label="Date du visionnage">
            <button type="button" className={styles.jour} aria-pressed={allume === 'aujourdhui'} onClick={() => dater(aujourdhui)}>
              {M.aujourdhui}
            </button>
            <button type="button" className={styles.jour} aria-pressed={allume === 'hier'} onClick={() => dater(decalerJour(aujourdhui, -1))}>
              {M.hier}
            </button>
            <span className={styles.presse}>
              <button type="button" className={styles.fleche} aria-label="Jour précédent" onClick={() => dater(decalerJour(brouillon.date, -1))}>
                ‹
              </button>
              <span className={styles.molettes} aria-hidden="true">
                {molettesDeLaPresse(brouillon.date).map((valeur, i) => (
                  // Seule une molette dont la valeur vient de changer tourne ; au montage, elle est posée.
                  <i key={`${i}-${valeur}`} data-tourne={frais.dateDAvant && molettesDeLaPresse(frais.dateDAvant)[i] !== valeur ? 'oui' : undefined}>
                    {valeur}
                  </i>
                ))}
              </span>
              <button type="button" className={styles.fleche} aria-label="Jour suivant" disabled={!peutAvancer(brouillon.date, aujourdhui)} onClick={() => dater(decalerJour(brouillon.date, 1))}>
                ›
              </button>
            </span>
            <p className="sr-only" aria-live="polite">
              {formatDateVisionnage(brouillon.date)}
            </p>
          </div>
        </div>

        <div className={styles.rub}>
          <p className={styles.rubTete}>
            {M.note} <em>{M.noteSous}</em>
          </p>
          <div className={styles.poincons} role="group" aria-label="Note sur 10">
            {NOTES.map((n) => (
              <button key={n} type="button" data-perce={brouillon.note !== null && n <= brouillon.note} aria-label={`${n} sur 10`} aria-pressed={brouillon.note === n} onClick={() => noter(n)}>
                {n}
              </button>
            ))}
          </div>
          <button type="button" className={styles.sansNote} aria-pressed={brouillon.note === null} onClick={() => noter(null)}>
            {M.sansNote}
          </button>
        </div>

        <div className={styles.rub}>
          <p className={styles.rubTete}>
            {M.reactions} <em>{M.reactionsSous}</em>
          </p>
          {reactions.catalogue ? (
            <>
              <div className={styles.coupons}>
                {reactions.catalogue.map((r) => (
                  <button
                    key={r.cle}
                    type="button"
                    aria-pressed={brouillon.reactions.includes(r.cle)}
                    onClick={() => onRetoucher((b) => ({ ...b, reactions: basculerReaction([...b.reactions], r.cle, ordre, MAX_REACTIONS) }))}
                  >
                    <span aria-hidden="true">{r.emoji}</span> {r.phrase}
                  </button>
                ))}
              </div>
              <p className={styles.compte}>{compteDesCoupons(brouillon.reactions.length)}</p>
            </>
          ) : reactions.panne ? (
            <div className={styles.panne}>
              <Panne erreur={reactions.panne} onReessayer={reactions.onReessayer} />
            </div>
          ) : (
            <p role="status" className={styles.attente}>
              Chargement…
            </p>
          )}
        </div>

        <div className={styles.rub}>
          <p className={styles.rubTete}>
            {M.remarque} <em>{M.remarqueSous}</em>
          </p>
          <textarea className={styles.carnet} aria-label="Remarque privée" placeholder={M.remarqueVide} value={brouillon.remarque} onChange={(e) => onRetoucher((b) => ({ ...b, remarque: e.target.value }))} />
        </div>
      </div>

      {refus ? (
        <p role="alert" className={styles.refus}>
          {refus}
        </p>
      ) : null}
      <Action onClick={onComposter} disabled={occupe} sous={correction ? M.corrigerSous : mots.validerSous}>
        {correction ? M.corriger : mots.valider}
      </Action>
      {suppression}

      <Rubrique>
        {M.modele} <small>{M.modeleSous}</small>
      </Rubrique>
      {modele ? <img className={styles.modele} src={modele} alt={M.modeleDit} width={640} height={385} loading="lazy" decoding="async" /> : null}
      <p className={styles.legende}>{M.legende}</p>
      <p className={styles.format}>{M.format}</p>
    </div>
  )
}
