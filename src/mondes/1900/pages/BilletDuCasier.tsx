import { useMouvementReduit } from '../../../ui/mouvement'
import { formatDateVisionnage } from '../../../ui/format'
import { numeroLisible } from '../../../voyage/billets'
import type { PropsBilletEnGrand } from '../../../voyage/boite/BilletEnGrand'
import { useDialogue } from '../../../voyage/dialogue'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import Action from './Action'
import Carton from './Carton'
import { MOTS_DU_COMPOSTEUR as C, datePressee, ligneDuFilm } from './carton'
import { MOTS_DU_CASIER as M } from './casier'
import styles from './Casier.module.css'

/**
 * Un billet du casier sorti en grand (maquette, écran 7 : le billet Edmondson) : le carton, qui dit le
 * titre, la ligne du film, le numéro et la note ; dessous, la date de la séance en toutes lettres (la
 * tranche ne la porte que pressée), les réactions en coupons, et ma remarque sur le carnet, que la
 * page tient de mon seul journal. « Corriger le billet » ne s'offre que si la page le passe. Présenté
 * au contrôleur (`poinconne`), le carton garde son poinçon doré.
 *
 * Un dialogue : « Ranger au casier » prend le focus et le rend, Échap et le voile ferment. Il ne lit
 * rien : `Visionneuse` lui passe les réactions lues. Rien n'y bouge au calme.
 */
export default function BilletDuCasier({ monde, billet, reactions, corriger, onFermer, poinconne = false }: PropsBilletEnGrand) {
  const m = monde.pages.mots
  const calme = useMouvementReduit()
  const ranger = useDialogue<HTMLButtonElement>(onFermer)
  const { entry, media, carnet } = billet.item
  const date = formatDateVisionnage(entry.finished_at)
  return (
    <div className={styles.calque} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.voile} onClick={onFermer} aria-hidden="true" />
      <div className={styles.sorti} role="dialog" aria-modal="true" aria-label={media.title}>
        <div className={styles.zone}>
          <Carton
            tete={C.compagnie}
            titre={media.title}
            sous={ligneDuFilm(media.director, media.year!)}
            numero={numeroLisible(billet.numero)}
            note={entry.rating}
            presse={datePressee(entry.finished_at)}
            tampon={{ mot: m.billet.tampon, dit: `${m.billet.tampon} : ${m.billet.tamponAutour} ${date}` }}
            poincon={poinconne ? { dit: C.poincon } : null}
          />
        </div>
        <p className={styles.seance}>{`${m.billet.titre} ${date}`}</p>
        {reactions.length > 0 ? (
          <ul className={styles.coupons} aria-label={M.reactions}>
            {reactions.map((r) => (
              <li key={r.cle}>{r.phrase !== null ? `${r.emoji} ${r.phrase}` : r.cle}</li>
            ))}
          </ul>
        ) : null}
        {carnet.comment ? (
          <div className={styles.remarque}>
            <p className={styles.sur}>
              {C.remarque} <small>{C.remarqueSous}</small>
            </p>
            <p className={styles.carnet}>{carnet.comment}</p>
          </div>
        ) : null}
        <div className={styles.gestes}>
          {corriger ? (
            <Action vers={corriger} etat={{ item: billet.item }} sous={C.corrigerSous}>
              {C.corriger}
            </Action>
          ) : null}
          <button ref={ranger} type="button" className={styles.ranger} onClick={onFermer}>
            {m.boite.ranger}
          </button>
        </div>
      </div>
    </div>
  )
}
