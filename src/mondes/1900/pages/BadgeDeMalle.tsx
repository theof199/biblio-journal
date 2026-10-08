import { useId, type ReactElement } from 'react'
import type { PlaceDeMalle } from '../../../api/voyage'
import { FORMES, MOTS_DE_LA_MALLE as M, badgeDe, compteDeLaTrace, etatDeLaPlace, nomLuDeLaPlace, type Badge, type DessinDeBadge } from './malle'

/**
 * Le badge d'une place de la malle aux étiquettes (maquette, écran 18 : `etiquetteSVG`, `traceSVG`),
 * dans ses trois états : **collée** (la forme en papier, ses filets, son dessin, son nom court et sa
 * devise), **en trace de colle** (la forme pâle et son compte), **cachée non gagnée** (un « ? », sans
 * forme). Il ne lit rien et ne décide rien : l'état et les mots viennent de `malle.ts`, la devise du
 * contrat. Il prend la taille de sa boîte, carrée.
 *
 * Ses couleurs sont sa donnée (`BADGES`) et les encres pâles de la trace sont dites ici : aucune
 * feuille ne les porte. Ses polices sont les jetons du monde, que la page pose au-dessus de lui.
 */
const RAIL = { fontFamily: 'var(--m-f-titre)' }
const TEXTE = { fontFamily: 'var(--m-f-texte)' }
const BOITE = { display: 'block', width: '100%', height: '100%', overflow: 'visible' } as const
/** La colle sur le cuir : un ivoire, plus ou moins passé. */
const colle = (part: number) => `rgba(255, 244, 214, ${part})`

type Encres = { a: string; b: string; c: string; p: string }

/** Les quinze dessins, autour de l'origine, dans une boîte de 40 ; `a`, `b`, `c` sont les encres, `p` le papier. */
const DESSINS: Record<DessinDeBadge, (e: Encres) => ReactElement> = {
  kepi: ({ a, b, c }) => (
    <>
      <path d="M-13 2 C-13 -12 13 -12 13 2 Z" fill={a} />
      <rect x="-13" y="1" width="26" height="5" fill={b} />
      <path d="M-15 6 H15 C19 6 21 10 16 11 H-4 C-10 11 -15 9 -15 6 Z" fill={a} />
      <circle cy="-4.5" r="2.6" fill={c} />
      <path d="M-9 16 h18" stroke={b} strokeWidth="1.5" />
    </>
  ),
  camera: ({ a, b, c }) => (
    <>
      <rect x="-10" y="-15" width="18" height="16" fill={a} />
      <rect x="8" y="-10" width="5" height="6" fill={b} />
      <circle cx="-1" cy="-7" r="3.6" fill="none" stroke={c} strokeWidth="1.5" />
      <path d="M-10 -9 h-4 v5" fill="none" stroke={b} strokeWidth="1.7" />
      <path d="M-1 1 L-9 17 M-1 1 L7 17 M-1 1 V17" stroke={a} strokeWidth="1.7" />
    </>
  ),
  pochoir: ({ a, b, c }) => (
    <>
      <circle cx="-7" cy="5" r="8" fill={a} opacity=".9" />
      <circle cx="5" cy="6" r="8" fill={b} opacity=".85" />
      <circle cx="-1" cy="-5" r="8" fill={c} opacity=".9" />
      <path d="M8 -17 L17 -8 L14 -5 L5 -14 Z" fill="#5a3a1c" />
      <path d="M5 -14 L14 -5 L10 0 C6 0 1 -5 1 -9 Z" fill="#221910" />
    </>
  ),
  tete: ({ a, b, c }) => (
    <>
      <circle cy="-5" r="12" fill="none" stroke={a} strokeWidth="1.9" />
      <circle cx="-4" cy="-8" r="1.3" fill={a} />
      <circle cx="4" cy="-8" r="1.3" fill={a} />
      <path d="M-7 -1 C-4 -4 -1 -3 0 -1 C1 -3 4 -4 7 -1 C4 0 1 0 0 -1 C-1 0 -4 0 -7 -1 Z" fill={b} />
      <path d="M-3 3 C-1 5 1 5 3 3" fill="none" stroke={a} strokeWidth="1.2" />
      <rect x="-16" y="8" width="32" height="3" fill={b} />
      <path d="M-12 11 V18 M12 11 V18" stroke={b} strokeWidth="2" />
      <path d="M-21 -8 l6 3 l-6 3 Z" fill={c} />
    </>
  ),
  portevoix: ({ a, b, c }) => (
    <>
      <path d="M-14 -3 L8 -13 V13 L-14 3 Z" fill={a} />
      <rect x="-18" y="-3" width="5" height="6" fill={b} />
      <path d="M12 -8 C16 -4 16 4 12 8 M16 -12 C22 -5 22 5 16 12" fill="none" stroke={b} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M-6 6 l3 10 h4 l-2 -9" fill={c} />
    </>
  ),
  clandestin: ({ a, b, c }) => (
    <>
      <rect x="-15" y="-6" width="30" height="20" rx="2" fill={a} />
      <path d="M-15 -6 L-11 -13 H11 L15 -6 Z" fill={b} />
      <rect x="-12" y="-4.5" width="24" height="6" fill="#f4efe2" />
      <circle cx="-5" cy="-1.5" r="1.5" fill={a} />
      <circle cx="5" cy="-1.5" r="1.5" fill={a} />
      <rect x="-3" y="5" width="6" height="5" fill={c} />
    </>
  ),
  aiguillage: ({ a, b, c, p }) => (
    <>
      <path d="M-18 11 C-6 11 -2 -11 18 -11 M-18 -11 C-6 -11 -2 11 18 11" fill="none" stroke={a} strokeWidth="2.4" />
      <circle cx="-18" cy="-11" r="3.6" fill={b} />
      <circle cx="-18" cy="11" r="3.6" fill={c} />
      <circle cx="18" cy="-11" r="3.6" fill={c} />
      <circle cx="18" cy="11" r="3.6" fill={b} />
      <circle r="5" fill={p} stroke={a} strokeWidth="1.6" />
      <path d="M0 -3 V0 L2 1.6" fill="none" stroke={a} strokeWidth="1.1" />
    </>
  ),
  lune: ({ a, b, c }) => (
    <>
      <path d="M4 -16 A15 15 0 1 0 15 8 A12 12 0 0 1 4 -16 Z" fill={c} />
      <path d="M-12 -13 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" fill={b} />
      <circle cx="-15" cy="5" r="1.2" fill={b} />
      <circle cx="-6" cy="-3" r="1" fill={b} />
      <path d="M-18 16 H18" stroke={a} strokeWidth="1.8" />
    </>
  ),
  roue: ({ a, b, c }) => (
    <>
      <circle r="8" fill="none" stroke={a} strokeWidth="2.2" />
      <circle r="2" fill={a} />
      <path d="M0 -8 V8 M-8 0 H8 M-5.6 -5.6 L5.6 5.6 M-5.6 5.6 L5.6 -5.6" stroke={a} strokeWidth="1" />
      <path d="M-9 -2 C-16 -4 -20 -9 -21 -14 C-16 -11 -12 -10 -8 -6 Z M-10 2 C-15 2 -19 -1 -21 -5 C-16 -3 -13 -3 -9 -2 Z" fill={b} />
      <path d="M9 -2 C16 -4 20 -9 21 -14 C16 -11 12 -10 8 -6 Z M10 2 C15 2 19 -1 21 -5 C16 -3 13 -3 9 -2 Z" fill={b} />
      <path d="M-12 14 H12" stroke={c} strokeWidth="1.8" />
    </>
  ),
  omnibus: ({ a, b }) => (
    <>
      <path d="M-17 -7 H17 C24 -7 24 7 17 7 H-17" fill="none" stroke={a} strokeWidth="1.8" />
      {[-16, -8, 0, 8, 16].map((x) => (
        <g key={x} fill={b}>
          <circle cx={x} cy="-7" r="2.7" />
          <circle cx={x} cy="7" r="2.7" />
        </g>
      ))}
    </>
  ),
  globe: ({ a, b, c }) => (
    <>
      <circle r="14" fill="none" stroke={a} strokeWidth="2" />
      <ellipse rx="6" ry="14" fill="none" stroke={a} strokeWidth="1.2" />
      <path d="M-14 0 H14 M-12 -7 H12 M-12 7 H12" stroke={a} strokeWidth="1.2" />
      <path d="M-19 9 C-8 22 14 20 20 4" fill="none" stroke={b} strokeWidth="1.7" />
      <path d="M21 2 l-6 2 l4 5 Z" fill={b} />
      <circle cx="9" cy="-9" r="2.2" fill={c} />
    </>
  ),
  chou: ({ a, b, c, p }) => (
    <>
      <circle cy="3" r="13" fill={a} />
      <path d="M0 -10 C-9 -5 -9 9 0 16 C9 9 9 -5 0 -10 Z" fill="none" stroke={p} strokeWidth="1.3" />
      <path d="M0 -4 C-4 -1 -4 7 0 11 C4 7 4 -1 0 -4 Z" fill="none" stroke={p} strokeWidth="1.1" />
      <path d="M-13 3 C-19 -5 -13 -13 -6 -11 M13 3 C19 -5 13 -13 6 -11" fill="none" stroke={b} strokeWidth="2" strokeLinecap="round" />
      <path d="M0 -20 l1.3 3.2 3.4 .3 -2.6 2.2 .8 3.3 -2.9 -1.8 -2.9 1.8 .8 -3.3 -2.6 -2.2 3.4 -.3 Z" fill={c} />
    </>
  ),
  masque: ({ a, b, p }) => (
    <>
      <path d="M-16 -4 H16 C12 -6 10 -8 9 -15 H-9 C-10 -8 -12 -6 -16 -4 Z" fill={a} />
      <path d="M-20 -3 H20" stroke={a} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-12 1 H12 V6 C8 9 -8 9 -12 6 Z" fill={b} />
      <ellipse cx="-5" cy="4.5" rx="2.6" ry="1.6" fill={p} />
      <ellipse cx="5" cy="4.5" rx="2.6" ry="1.6" fill={p} />
      <path d="M-9 11 C-4 14 4 14 9 11 L0 19 Z" fill={a} />
    </>
  ),
  rails: ({ a, b, c }) => (
    <>
      <path d="M-18 -5 H18 M-18 11 H18" stroke={a} strokeWidth="1.7" />
      <rect x="-13" y="-14" width="14" height="8" rx="1" fill={b} />
      <circle cx="-10" cy="-5.5" r="1.9" fill={a} />
      <circle cx="-2" cy="-5.5" r="1.9" fill={a} />
      <rect x="-1" y="2" width="14" height="8" rx="1" fill={c} />
      <circle cx="2" cy="10.5" r="1.9" fill={a} />
      <circle cx="10" cy="10.5" r="1.9" fill={a} />
    </>
  ),
  billet: ({ a, p }) => (
    <>
      <path d="M-17 -10 H17 V-3 A3 3 0 0 0 17 3 V10 H-17 V3 A3 3 0 0 0 -17 -3 Z" fill={a} />
      <path d="M-5 -10 V10" stroke={p} strokeWidth="1" strokeDasharray="2 2" />
      <text x="6" y="0" textAnchor="middle" style={RAIL} fontWeight="700" fontSize="8" fill={p}>28</text>
      <text x="6" y="6.5" textAnchor="middle" style={RAIL} fontWeight="700" fontSize="4.6" fill={p}>DÉC.</text>
      <path d="M-11 -4.5 l1.2 2.8 3 .3 -2.3 2 .7 3 -2.6 -1.6 -2.6 1.6 .7 -3 -2.3 -2 3 -.3 Z" fill={p} />
    </>
  ),
}

/** La taille d'un mot pour qu'il tienne dans `larg`, plafonnée : la règle de la maquette. */
const taille = (txt: string, larg: number, max: number, esp = 0.4) => Number(Math.min(max, (larg - txt.length * esp) / (txt.length * 0.5)).toFixed(2))

function Mot({ txt, y, larg, max, coul, esp = 0.4 }: { txt: string; y: number; larg: number; max: number; coul: string; esp?: number }) {
  if (txt === '') return null
  return (
    <text x="50" y={y} textAnchor="middle" style={RAIL} fontWeight="700" fontSize={taille(txt, larg, max, esp)} letterSpacing={esp} fill={coul}>
      {txt.toUpperCase()}
    </text>
  )
}

/** Le nom court, sur une ligne ou plusieurs, centré sur `y`. */
function Nom({ court, y, larg, max, coul, pas = 9 }: { court: readonly string[]; y: number; larg: number; max: number; coul: string; pas?: number }) {
  if (court.length === 1) return <Mot txt={court[0]!} y={y} larg={larg} max={max} coul={coul} />
  return (
    <>
      {court.map((ligne, k) => (
        <Mot key={k} txt={ligne} y={y - ((court.length - 1) * pas) / 2 + k * pas} larg={larg} max={max * 0.86} coul={coul} />
      ))}
    </>
  )
}

function Arc({ id, d, txt, max, coul, long }: { id: string; d: string; txt: string; max: number; coul: string; long: number }) {
  if (txt === '') return null
  return (
    <>
      <path id={id} d={d} fill="none" />
      <text style={RAIL} fontWeight="700" fontSize={taille(txt, long, max, 0.6)} letterSpacing=".6" fill={coul} textAnchor="middle">
        <textPath href={`#${id}`} startOffset="50%">
          {txt.toUpperCase()}
        </textPath>
      </text>
    </>
  )
}

/** L'étiquette collée : sa forme en papier, ses filets, le dessin, le nom et la devise, à la place que la forme leur laisse. */
function Collee({ badge, devise, id }: { badge: Badge; devise: string; id: string }) {
  const [a, b, c] = badge.encres
  const p = badge.papier
  const d = FORMES[badge.forme]
  const { court } = badge
  const filet = (k: number, coul: string, ep: number) => <path d={d} transform={`translate(50 50) scale(${k}) translate(-50 -50)`} fill="none" stroke={coul} strokeWidth={ep} />
  const dessin = (x: number, y: number, t: number) => (badge.dessin === null ? null : <g transform={`translate(${x} ${y}) scale(${t / 40})`}>{DESSINS[badge.dessin]({ a, b, c, p })}</g>)
  let corps: ReactElement
  if (badge.forme === 'rond') {
    corps = (
      <>
        {filet(0.93, a, 2.2)}
        {filet(0.86, b, 0.8)}
        <circle cx="50" cy="50" r="19.5" fill="none" stroke={b} strokeWidth=".7" strokeDasharray="1 2" />
        {dessin(50, 50, 30)}
        <Arc id={`${id}h`} d="M19.5 50 A30.5 30.5 0 0 1 80.5 50" txt={court.join(' ')} max={8.6} coul={a} long={80} />
        <Arc id={`${id}b`} d="M14 50 A36 36 0 0 0 86 50" txt={devise} max={6} coul={b} long={76} />
      </>
    )
  } else if (badge.forme === 'ovale') {
    corps = (
      <>
        {filet(0.92, a, 2.2)}
        {filet(0.84, b, 0.8)}
        {dessin(50, 38, 27)}
        <Nom court={court} y={66} larg={62} max={9.5} coul={a} pas={8} />
        <Mot txt={devise} y={77} larg={40} max={5.4} coul={b} esp={1.2} />
      </>
    )
  } else if (badge.forme === 'ecusson') {
    corps = (
      <>
        <rect x="0" y="0" width="100" height="23" fill={a} />
        <Mot txt={devise} y={18} larg={66} max={8} coul={p} esp={1.6} />
        {filet(0.92, b, 1.6)}
        {dessin(50, 43, 31)}
        <Nom court={court} y={73} larg={46} max={10} coul={a} pas={8.5} />
        <path d="M44 86 h12" stroke={c} strokeWidth="1.6" />
      </>
    )
  } else if (badge.forme === 'losange') {
    corps = (
      <>
        {filet(0.9, b, 1.4)}
        {dessin(50, 25, 23)}
        <rect x="0" y="40" width="100" height="19" fill={a} />
        <Mot txt={court.join(' ')} y={53.2} larg={74} max={10} coul={p} />
        <Mot txt={devise} y={70} larg={44} max={5.6} coul={b} esp={1} />
        <path d="M50 77 l1.4 3.4 3.6 .3 -2.8 2.3 .9 3.5 -3.1 -1.9 -3.1 1.9 .9 -3.5 -2.8 -2.3 3.6 -.3 Z" fill={c} />
      </>
    )
  } else if (badge.forme === 'pans') {
    corps = (
      <>
        {filet(0.91, a, 2)}
        {filet(0.83, b, 0.8)}
        <Mot txt={devise} y={27.5} larg={60} max={6.2} coul={b} esp={1.4} />
        <path d="M24 31 H76" stroke={b} strokeWidth=".7" />
        {dessin(50, 47.5, 27)}
        <Nom court={court} y={court.length === 1 ? 74 : 73} larg={62} max={10.5} coul={a} pas={8.5} />
      </>
    )
  } else {
    // La forme neutre d'une clé inconnue : deux filets, la devise servie, le nom servi, sans dessin.
    corps = (
      <>
        {filet(0.92, a, 1.8)}
        {filet(0.85, b, 0.7)}
        <Mot txt={devise} y={33} larg={62} max={6} coul={b} esp={1.4} />
        <path d="M26 38 H74" stroke={c} strokeWidth=".9" />
        <Nom court={court} y={59} larg={70} max={11} coul={a} pas={12} />
      </>
    )
  }
  return (
    <>
      <defs>
        <clipPath id={id}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={p} />
      <g clipPath={`url(#${id})`}>{corps}</g>
    </>
  )
}

/** La trace de colle : la forme, pâle, deux taches, et le compte. */
function Trace({ badge, compte }: { badge: Badge; compte: string | null }) {
  const chiffres = compte === null ? null : /^(\d+) (\D+) (\d+)$/.exec(compte)
  return (
    <>
      <path d={FORMES[badge.forme]} fill={colle(0.1)} stroke={colle(0.36)} strokeWidth="1.3" strokeDasharray="1 3.4" strokeLinecap="round" />
      <g fill={colle(0.07)}>
        <ellipse cx="34" cy="36" rx="17" ry="9" transform="rotate(-24 34 36)" />
        <ellipse cx="64" cy="66" rx="19" ry="8" transform="rotate(18 64 66)" />
      </g>
      {compte === null ? null : chiffres ? (
        <text x="50" y="55" textAnchor="middle" style={RAIL} fontWeight="700" fontSize="21" fill={colle(0.8)}>
          {chiffres[1]}
          <tspan style={TEXTE} fontStyle="italic" fontWeight="400" fontSize="12" dx="3">
            {chiffres[2]}
          </tspan>
          <tspan dx="3">{chiffres[3]}</tspan>
        </text>
      ) : (
        <text x="50" y="54" textAnchor="middle" style={TEXTE} fontStyle="italic" fontSize="15" fill={colle(0.78)}>
          {compte}
        </text>
      )}
    </>
  )
}

/** La cachée non gagnée : un « ? » dans un rond pointillé, sans forme, sans rien d'elle. */
function Cachee() {
  return (
    <>
      <circle cx="50" cy="50" r="30" fill={colle(0.05)} stroke={colle(0.3)} strokeWidth="1.3" strokeDasharray="2 5" strokeLinecap="round" />
      <text x="50" y="62" textAnchor="middle" style={RAIL} fontWeight="700" fontSize="34" fill={colle(0.45)}>
        {M.signeDeLaCachee}
      </text>
    </>
  )
}

/**
 * `muet` : le badge est posé dans un bouton, ou à côté d'un texte, qui dit déjà son nom (la malle, sa
 * ligne dans la sacoche, la fiche d'une place) : il se tait, pour qu'une place n'ait qu'un nom lu.
 */
export default function BadgeDeMalle({ place, muet = false }: { place: PlaceDeMalle; muet?: boolean }) {
  // Deux badges sur une page ne partagent ni leur découpe ni leurs arcs ; `useId` rend des « : » qu'une `url(#…)` n'aime pas.
  const id = `badge${useId().replace(/[^\w-]/g, '')}`
  const etat = etatDeLaPlace(place)
  const badge = place.cle === null ? null : badgeDe(place.cle, place.nom)
  return (
    <svg viewBox="0 0 100 100" {...(muet ? { 'aria-hidden': true } : { role: 'img', 'aria-label': nomLuDeLaPlace(place) })} data-etat={etat} style={BOITE}>
      {badge === null ? (
        <Cachee />
      ) : etat === 'collee' ? (
        <Collee badge={badge} devise={place.devise ?? ''} id={id} />
      ) : (
        <Trace badge={badge} compte={place.progression === null ? null : compteDeLaTrace(place.progression)} />
      )}
    </svg>
  )
}
