import { useCallback, useEffect, useRef, useState } from 'react'
import Panne from '../../../ui/Panne'
import { useMouvementReduit } from '../../../ui/mouvement'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import type { Monde } from '../../types'
import type { PropsWagonRestaurant, TableDuWagon } from '../../../voyage/wagon/tables'
import Carton from './Carton'
import DessinDeLaTable, { ReservesDuWagon } from './DessinDeLaTable'
import Rubrique from './Rubrique'
import { MOTS_DU_WAGON as M, avecLHote, cartonDeLHote, cartonDeLInvite, ceQueDitLaTable, monBilletTamponne, nomDeLaTable, soirPasseDit } from './wagon'
import sacoche from './Sacoche.module.css'
import styles from './Wagon.module.css'

/**
 * Mon billet d'une table vue à deux, sur son carton, sous le tampon vert (`monBilletTamponne` : rien
 * tant que le serveur ne dit pas `vu_ensemble`). Le mien seul.
 */
function MonBillet({ table, monde }: { table: TableDuWagon['table']; monde: Monde }) {
  const m = monde.pages.mots.billet
  const billet = monBilletTamponne(table, m.tampon, m.tamponAutour)
  if (!billet) return null
  return (
    <figure className={styles.billet} aria-label={M.monBillet}>
      <Carton {...billet} />
    </figure>
  )
}

/**
 * Une table de ce soir : la scène de la maquette, qui dit l'état **sur la table** (le couvert de
 * l'hôte, à gauche, toujours servi ; celui de l'invité, à droite, selon `etat` : `data-etat`), les
 * deux cartons, le menu, puis les gestes qu'on m'offre et eux seuls. Le menu ne dit que le titre et
 * « ce soir ». Vue à deux, la table montre **mon** billet tamponné ; celui de l'autre n'est pas servi.
 *
 * **La mise en lumière** (maquette, l. 1347-1355) : `entree`, la scène porte `data-entree` et la
 * feuille joue l'entrée de la table — le noir qui se lève en clignant et les lueurs de la lampe qui
 * prennent, le menu qui se pose, les deux cartons qui paraissent. Le carton de l'invité entre le
 * dernier : la fin de son animation dit `onEclairee`, et la scène ne porte plus rien à rejouer.
 */
function TableDuSoir({ t, monde, calme, entree, onEclairee, prendre, decliner }: { t: TableDuWagon; monde: Monde; calme: boolean; entree: boolean; onEclairee: (id: string) => void; prendre: (id: string) => void; decliner: (id: string) => void }) {
  const { table, role, gestes } = t
  const hote = cartonDeLHote(table, role)
  const invite = cartonDeLInvite(table, role)
  // L'écoute est posée sur l'élément : React, lui, choisit le nom de l'événement d'après le
  // navigateur (préfixé sous jsdom), et la fin d'une animation d'un mot du carton remonte jusqu'ici.
  const cartonDeLInviteRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const carton = cartonDeLInviteRef.current
    if (!entree || !carton) return
    const fin = (e: AnimationEvent) => (e.target === carton ? onEclairee(table.id) : undefined)
    carton.addEventListener('animationend', fin)
    return () => carton.removeEventListener('animationend', fin)
  }, [entree, table.id, onEclairee])
  return (
    <article className={styles.table} aria-label={nomDeLaTable(table, role)}>
      <div className={styles.scene} data-etat={table.etat} data-vivante={calme ? 'non' : 'oui'} data-entree={entree ? 'oui' : undefined}>
        <DessinDeLaTable />
        {entree ? <span className={styles.noir} aria-hidden="true" /> : null}
        <p className={styles.carton} data-qui="hote">
          <b>{hote.nom}</b>
          <span>{hote.dit}</span>
        </p>
        <p ref={cartonDeLInviteRef} className={styles.carton} data-qui="invite">
          <b>{invite.nom}</b>
          <span>{invite.dit}</span>
        </p>
        <p className={styles.menu}>
          <small>
            {M.sur}
            <i>{M.titre}</i>
          </small>
          <b>{M.menu}</b>
          <span className={styles.plat}>{M.plat}</span>
          <strong>{table.film.titre}</strong>
          <em>
            {M.ceSoir}
            <i>{M.service}</i>
          </em>
        </p>
      </div>
      {gestes.prendre || gestes.decliner ? (
        <div className={styles.choix}>
          {gestes.prendre ? (
            <button type="button" className={styles.plein} aria-disabled={t.enCours} onClick={() => prendre(table.id)}>
              {M.prendre}
              <small>{avecLHote(table)}</small>
            </button>
          ) : null}
          {gestes.decliner ? (
            <button type="button" aria-disabled={t.enCours} onClick={() => decliner(table.id)}>
              {M.decliner}
              <small>{M.rienNeSePerd}</small>
            </button>
          ) : null}
        </div>
      ) : null}
      <p className={styles.etat} role="status">
        {ceQueDitLaTable(table, role)}
      </p>
      <MonBillet table={table} monde={monde} />
      {t.refus ? (
        <p className={styles.refus} role="alert">
          {t.refus}
        </p>
      ) : null}
    </article>
  )
}

/**
 * Le wagon-restaurant de 1900 (maquette « Voyage immobile 1900 », écran 20), le gabarit
 * `wagonRestaurant` : mes tables de ce soir, **une scène par table** (plusieurs invitations peuvent
 * attendre le même soir), dans l'ordre servi, puis les soirs passés, en lignes, sans scène ni geste ;
 * une table vue à deux, ce soir ou passée, montre mon billet sous le tampon vert.
 * `pages/VoyageWagonRestaurant.tsx` lit, écrit et décide de ce qui s'offre : rien ne se lit ni ne se
 * déduit ici. Les lointains de la vitre bougent en boucle, jamais au calme.
 *
 * **La mise en lumière se joue une fois, à l'entrée de la page** (`aEclairer`) : pour les tables de ce
 * soir que la page montre en arrivant, **toutes ensemble** (une scène tient l'écran à elle seule : une
 * cascade ne ferait qu'attendre dans le noir les tables qu'on ne voit pas encore). Chaque table sort
 * de la liste à la fin de son entrée ; une table venue ensuite, un geste, une relecture ne rallument
 * rien. Au calme la liste est vide d'emblée : la table est éclairée, le menu posé.
 */
export default function WagonRestaurant({ monde, panne, tables, prendre, decliner }: PropsWagonRestaurant) {
  const calme = useMouvementReduit()
  const ceSoir = tables?.filter((t) => !t.passee) ?? []
  const passees = tables?.filter((t) => t.passee) ?? []
  // Nulle tant que la page n'a pas montré ses tables ; fixée à leur premier rendu, puis seulement vidée.
  const [aEclairer, setAEclairer] = useState<ReadonlySet<string> | null>(null)
  if (aEclairer === null && tables) setAEclairer(new Set(calme ? [] : ceSoir.map((t) => t.table.id)))
  const eclairee = useCallback((id: string) => setAEclairer((s) => (s?.has(id) ? new Set([...s].filter((autre) => autre !== id)) : s)), [])
  return (
    <div className={styles.wagon} style={STYLE_DU_TEMPO}>
      <header className={styles.tete}>
        <p>{M.sur}</p>
        <h1>{M.titre}</h1>
      </header>
      {panne ? (
        <div className={sacoche.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : null}
      {tables ? (
        <>
          <Rubrique>{M.ceSoir}</Rubrique>
          {ceSoir.length === 0 ? (
            <p className={sacoche.vide}>{M.aucune}</p>
          ) : (
            <>
              <ReservesDuWagon />
              <ol className={styles.tables} aria-label={M.ceSoir}>
                {ceSoir.map((t) => (
                  <li key={t.table.id}>
                    <TableDuSoir t={t} monde={monde} calme={calme} entree={aEclairer?.has(t.table.id) ?? false} onEclairee={eclairee} prendre={prendre} decliner={decliner} />
                  </li>
                ))}
              </ol>
            </>
          )}
          {passees.length > 0 ? (
            <>
              <Rubrique>{M.passees}</Rubrique>
              <ul className={styles.passees} aria-label={M.passees}>
                {passees.map(({ table, role }) => {
                  const dit = soirPasseDit(table, role)
                  return (
                    <li key={table.id}>
                      <small>{dit.jour}</small>
                      <b>{dit.titre}</b>
                      <span>{dit.ou}</span>
                      <em>{dit.reste}</em>
                      <MonBillet table={table} monde={monde} />
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
