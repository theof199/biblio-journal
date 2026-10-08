import type { ObjetTrouve } from '../objets'

/**
 * Le dessin d'un objet trouvé, tel que le catalogue le porte : ses tracés, dans sa vue de 40 sur 40.
 * Muet : la place de consigne dit son nom, et l'envol de la carte n'est qu'un décor. Il remplit ce
 * qui le porte ; il ne lit ni n'écrit rien. Le quai pose les mêmes tracés sur sa toile (`gares.ts`).
 */
export default function DessinDObjet({ objet }: { objet: ObjetTrouve }) {
  return (
    <svg viewBox="-20 -20 40 40" aria-hidden="true">
      <g transform={objet.tourne ? `rotate(${objet.tourne})` : undefined}>
        {objet.traits.map((t, k) => (
          <path
            key={k}
            d={t.d}
            fill={t.fond ?? 'none'}
            stroke={t.trait}
            strokeWidth={t.trait ? (t.epais ?? 1) : undefined}
            strokeLinecap={t.rond ? 'round' : undefined}
            strokeDasharray={t.tirets?.join(' ')}
          />
        ))}
      </g>
    </svg>
  )
}
