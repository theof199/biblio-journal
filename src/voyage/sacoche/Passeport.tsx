import { useQuery } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { lireVoyage, type Voyage } from '../../api/voyage'
import { creerRegistre } from '../../mondes'
import type { Monde } from '../../mondes/types'
import { gabaritDe } from '../gabarit'
import { anneauDuPasseport, tamponDe } from '../passeport'
import { decenniesDuPasseport } from '../sacoche'
import PageParDefaut from './Page'
import PagesParDefaut from './Pages'
import commun from './Sacoche.module.css'

/** Le monde de chaque décennie, par le registre : la sacoche ne connaît aucun monde précis. */
const mondes = creerRegistre()

/**
 * Une page du passeport, dessinée par le monde de **sa** décennie (`pageDuPasseport`), jamais par
 * celui de mon année en cours : la page des années 1890 reste la sienne dans une sacoche de 1900.
 */
function PageDuPasseport({ v, decennie: d }: { v: Voyage; decennie: number }) {
  const monde = mondes(d)
  const Page = gabaritDe(monde, 'pageDuPasseport', PageParDefaut)
  return <Page monde={monde} decennie={d} tampon={tamponDe(v.tampons, d)} anneau={anneauDuPasseport(v.annees, d, v.depart)} vers={`/voyage/decennies/${d}`} />
}

/**
 * Le passeport de la sacoche : une page par décennie, du départ à la décennie en cours. Lit la carte
 * (`GET /me/voyage`, la clé de la carte), jamais une fiche d'année ; son cadre est celui du monde de
 * mon année en cours (`passeportDeLaSacoche`), que la page lui passe, posé dans une région qui ne
 * change pas : la carte répond, le monde change, et la région reste la même. Pas de générique au toucher
 * d'un tampon : il viendra avec les célébrations. Sans monde (la page attend la carte), la région est
 * là, cachée et sans dessin.
 */
export default function Passeport({ monde }: { monde: Monde | null }) {
  const voyage = useQuery({ queryKey: cles.voyage, queryFn: ({ signal }) => lireVoyage(signal) })
  const v = voyage.data
  const Pages = monde ? gabaritDe(monde, 'passeportDeLaSacoche', PagesParDefaut) : null
  return (
    <section className={commun.bloc} aria-label="Passeport" hidden={!Pages}>
      {Pages ? (
        <Pages
          panne={voyage.error ? { erreur: voyage.error, reessayer: () => void voyage.refetch() } : null}
          pages={v ? decenniesDuPasseport(v).map((d) => ({ decennie: d, page: <PageDuPasseport v={v} decennie={d} /> })) : null}
          sansTampon={v ? v.tampons.length === 0 : false}
        />
      ) : null}
    </section>
  )
}
