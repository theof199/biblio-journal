import { useMouvementReduit } from '../../../ui/mouvement'
import { NOM_DE_RECOMPENSE } from '../../../voyage/annee/Embleme'
import type { PropsProgramme } from '../../../voyage/annee/Programme'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { gainDe, ligneDeLIndicateur } from './lignes'
import Rubrique from './Rubrique'
import styles from './Indicateur.module.css'

/**
 * L'indicateur de la gare, à la place du programme (maquette, écrans 2 et 14 : `.chaix`) : une ligne
 * par arrivée que la fiche compte, arrivée ou attendue, sur toute année prête. Une année bouclée
 * porte le tampon rouge, avec sa récompense. Au retour d'un billet, la ligne gagnée se pointe en
 * rouge (le « +1 » monte au compteur, sous la tête) ; au calme, elle est pointée d'un coup.
 */
export default function Indicateur({ monde, annee, arrivees, gains, bouclee, recompense, ia }: PropsProgramme) {
  const m = monde.pages.mots
  const calme = useMouvementReduit()
  const n = arrivees.filter((a) => a.arrivee).length
  return (
    <section className={styles.indicateur} aria-label={m.programme.sur} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <Rubrique>
        {m.programme.sur}
        <small>{`${n} sur ${arrivees.length}`}</small>
      </Rubrique>
      <div className={styles.chaix}>
        <p className={styles.ent}>
          <span>{`Ligne ${annee}`}</span>
          {m.programme.titre}
        </p>
        <table>
          <tbody>
            {arrivees.map((a) => {
              const ligne = ligneDeLIndicateur(a, annee, ia)
              const gain = gainDe(a, gains)
              return (
                <tr key={a.cle} className={gain ? styles.pointee : undefined} data-pointee={gain ? 'oui' : 'non'}>
                  <th scope="row">{ligne.nom}</th>
                  <td>
                    {ligne.libelle}
                    {ligne.note ? <small>{ligne.note}</small> : null}
                  </td>
                  <td className={styles.etat}>
                    <span>{ligne.etat}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {bouclee ? <p className={styles.tampon}>{recompense ? `${m.annonce.bouclee} · ${NOM_DE_RECOMPENSE[recompense]}` : m.annonce.bouclee}</p> : null}
      </div>
    </section>
  )
}
