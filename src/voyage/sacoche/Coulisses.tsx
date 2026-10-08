import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireDepenses } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { gabaritDe } from '../gabarit'
import { CREDITS, lignesDesDepenses, moisEnUTC } from '../sacoche'
import RepliParDefaut from './Repli'
import commun from './Sacoche.module.css'

/**
 * Les Coulisses de la sacoche : repliées au premier rendu ; dépliées, les dépenses au chroniqueur et
 * les crédits des images. Ce qui coûte ou s'attribue n'a pas à s'imposer au niveau du passeport et du
 * portefeuille. **Les dépenses ne se lisent qu'au dépli** (`enabled`), jamais à l'ouverture de la
 * sacoche ; rien ne s'en dit avant la réponse, ni pour une liste vide (tout membre hors du compte
 * IA) : la ligne ne paraît pas pour disparaître aussitôt. Une panne, elle, se dit. Le dessin est celui
 * du monde de mon année en cours (`coulisses`), que la page lui passe, dans une région que son titre
 * nomme (`ids.titre`) et qui reste la même d'un monde à l'autre : le pli survit au changement de
 * monde, et à l'attente de la carte, où la région est là, cachée et sans dessin (`monde` nul).
 */
export default function Coulisses({ monde }: { monde: Monde | null }) {
  const [depliees, setDepliees] = useState(false)
  const depenses = useQuery({ queryKey: cles.depenses, queryFn: ({ signal }) => lireDepenses(signal), enabled: depliees })
  const id = useId()
  const Repli = monde ? gabaritDe(monde, 'coulisses', RepliParDefaut) : null
  return (
    <section className={commun.bloc} aria-labelledby={`${id}-titre`} hidden={!Repli}>
      {Repli ? (
        <Repli
          ids={{ titre: `${id}-titre`, contenu: `${id}-contenu` }}
          depliees={depliees}
          basculer={() => setDepliees((d) => !d)}
          panneDesDepenses={depenses.error ? { erreur: depenses.error, reessayer: () => void depenses.refetch() } : null}
          depenses={depenses.data ? lignesDesDepenses(depenses.data.mois, moisEnUTC()) : null}
          credits={CREDITS}
        />
      ) : null}
    </section>
  )
}
