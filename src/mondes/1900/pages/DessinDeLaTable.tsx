import { useId } from 'react'
import styles from './Wagon.module.css'

/**
 * La table du wagon-restaurant vue du bout de la nappe (maquette « Voyage immobile 1900 », écran 20,
 * l. 2342-2460) : la vitre sur la campagne au crépuscule, la lampe à abat-jour plissé, deux couverts
 * face à face. Les tracés de la maquette, recopiés tels quels (décision 14 du propriétaire : des
 * tracés, aucune image d'époque) ; leurs couleurs sont leur donnée. Un décor, muet : la table dit son
 * état par ses cartons. Engendré de la maquette, il ne se retouche pas à la main.
 *
 * **Les réserves** (dégradés, verre, couvert, serviette) ne se posent qu'une fois par page, par
 * `ReservesDuWagon` : plusieurs tables peuvent attendre le même soir, et un identifiant ne se répète
 * pas dans un document. Ce que la scène définit elle-même (le losange de la frise, les monts, le
 * bourg, les poteaux, le rideau, la banquette) prend un identifiant par scène (`useId`).
 */
export function ReservesDuWagon() {
  return (
    <svg className={styles.reserves} width="0" height="0" aria-hidden="true">
      <defs>
      <linearGradient id="wr-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1330"/><stop offset=".46" stopColor="#1f2b58"/><stop offset=".7" stopColor="#4b406d"/><stop offset=".86" stopColor="#b96a43"/><stop offset=".95" stopColor="#eaa55c"/></linearGradient>
      <linearGradient id="wr-teck" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2c170b"/><stop offset=".12" stopColor="#4a2a15"/><stop offset=".5" stopColor="#3b2010"/><stop offset=".88" stopColor="#4a2a15"/><stop offset="1" stopColor="#2c170b"/></linearGradient>
      <linearGradient id="wr-loupe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7a4a24"/><stop offset=".5" stopColor="#5d361a"/><stop offset="1" stopColor="#6f4220"/></linearGradient>
      <linearGradient id="wr-velours" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7d2a26"/><stop offset=".3" stopColor="#5a1b1a"/><stop offset=".55" stopColor="#8a302a"/><stop offset=".8" stopColor="#541917"/><stop offset="1" stopColor="#732622"/></linearGradient>
      <linearGradient id="wr-banq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22386a"/><stop offset=".5" stopColor="#172850"/><stop offset="1" stopColor="#0d1630"/></linearGradient>
      <linearGradient id="wr-nappe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3d6"/><stop offset=".3" stopColor="#f4ead2"/><stop offset="1" stopColor="#e4dac2"/></linearGradient>
      <linearGradient id="wr-laiton" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7a5a22"/><stop offset=".35" stopColor="#f0d488"/><stop offset=".6" stopColor="#c9a257"/><stop offset="1" stopColor="#6b4d1c"/></linearGradient>
      <linearGradient id="wr-soie" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b9722f"/><stop offset=".3" stopColor="#f1c06c"/><stop offset=".5" stopColor="#ffe5a6"/><stop offset=".7" stopColor="#f1c06c"/><stop offset="1" stopColor="#b06a2b"/></linearGradient>
      <linearGradient id="wr-argent" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f2ea"/><stop offset=".5" stopColor="#9aa0a3"/><stop offset="1" stopColor="#d9d8d0"/></linearGradient>
      <radialGradient id="wr-halo"><stop offset="0" stopColor="#ffdf9a" stopOpacity=".62"/><stop offset=".45" stopColor="#ffc56a" stopOpacity=".2"/><stop offset="1" stopColor="#ffc56a" stopOpacity="0"/></radialGradient>
      <radialGradient id="wr-flaque"><stop offset="0" stopColor="#ffe7ae" stopOpacity=".8"/><stop offset="1" stopColor="#ffe7ae" stopOpacity="0"/></radialGradient>
      <radialGradient id="wr-penombre" cx=".5" cy=".5" r=".78"><stop offset=".6" stopColor="#0c0704" stopOpacity="0"/><stop offset="1" stopColor="#0c0704" stopOpacity=".62"/></radialGradient>
      <clipPath id="wr-vitre"><rect x="59" y="31" width="272" height="170" rx="9"/></clipPath>
      <g id="wr-fleur">
      <rect x="-17" y="-80" width="34" height="160" rx="2" fill="url(#wr-loupe)" stroke="#c9a257" strokeWidth=".8" strokeOpacity=".7"/>
      <rect x="-13.5" y="-76.5" width="27" height="153" fill="none" stroke="#2a1608" strokeWidth=".8" opacity=".7"/>
      <path d="M0 62 C-5 36 6 14 -1 -14 C-4 -26 1 -34 0 -42" fill="none" stroke="#8d9a5a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M-1 30 C-12 26 -13 12 -9 2 C-3 10 0 20 -1 30 Z M1 6 C11 2 13 -10 10 -20 C3 -12 0 -4 1 6 Z" fill="#74824a"/>
      <path d="M0 -40 C-9 -44 -11 -58 -6 -68 C-3 -62 -2 -58 0 -55 C2 -58 3 -62 6 -68 C11 -58 9 -44 0 -40 Z" fill="#e9d6a4"/>
      <path d="M0 -42 C-3 -48 -3 -58 0 -66 C3 -58 3 -48 0 -42 Z" fill="#d49a58"/>
      <circle cx="-7" cy="48" r="2.2" fill="#e9d6a4"/><circle cx="7" cy="-28" r="1.8" fill="#e9d6a4"/>
      </g>
      <g id="wr-verre">
      <ellipse cx="0" cy="1" rx="9" ry="2.4" fill="#3a2a16" opacity=".18"/>
      <ellipse cx="0" cy="0" rx="7.5" ry="2.2" fill="rgba(255,255,255,.35)" stroke="#fff" strokeWidth=".7" strokeOpacity=".8"/>
      <path d="M0 -1 V-17" stroke="#fff" strokeWidth="1.3" strokeOpacity=".75"/>
      <path d="M-8.5 -40 C-10 -26 -6 -17 0 -17 C6 -17 10 -26 8.5 -40 Z" fill="rgba(235,244,246,.2)" stroke="#fff" strokeWidth=".8" strokeOpacity=".8"/>
      <ellipse cx="0" cy="-40" rx="8.5" ry="2" fill="none" stroke="#fff" strokeWidth=".7" strokeOpacity=".8"/>
      <path d="M-5.5 -36 C-6.5 -29 -5 -23 -2.5 -20" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".85"/>
      </g>
      <path id="wr-vin" d="M-8.7 -31 C-8.5 -23 -5 -18 0 -18 C5 -18 8.5 -23 8.7 -31 C5 -29.5 -5 -29.5 -8.7 -31 Z"/>
      <g id="wr-couvert">
      <ellipse cx="98" cy="292" rx="42" ry="13.5" fill="#3a2a16" opacity=".2"/>
      <ellipse cx="98" cy="288" rx="39" ry="12.8" fill="#fffdf6" stroke="#b9ae95" strokeWidth="1"/>
      <ellipse cx="98" cy="287.5" rx="34" ry="10.6" fill="none" stroke="#1d3767" strokeWidth="1.3"/>
      <ellipse cx="98" cy="287.5" rx="31.5" ry="9.7" fill="none" stroke="#c9a257" strokeWidth=".7"/>
      <ellipse cx="98" cy="288" rx="23" ry="6.8" fill="#f3efe2" stroke="#d9d0bb" strokeWidth=".7"/>
      <path d="M64 270.5 H116 M116 269 h13 M116 270.5 h14 M116 272 h13" stroke="#5c5f60" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".25" transform="translate(1 1.6)"/>
      <path d="M64 270.5 H112 C114 268.5 116 268.4 118 268.8 h11 M118 270.5 h12 M118 272.2 h11 M112 270.5 C114 272.5 116 272.6 118 272.2" stroke="url(#wr-argent)" strokeWidth="2.1" strokeLinecap="round" fill="none"/>
      <path d="M58 307 H96 C108 304.5 124 304.8 137 307.5 C124 309.8 108 309.5 96 309 H58 Z" fill="#5c5f60" opacity=".25" transform="translate(1 1.8)"/>
      <path d="M58 306.2 H96 V309 H58 Z" fill="#d9d8d0" stroke="#8f9498" strokeWidth=".5"/><path d="M96 305 C110 303.5 126 304.5 138 307.5 C126 309.6 110 309.6 96 309.2 Z" fill="url(#wr-argent)" stroke="#8f9498" strokeWidth=".5"/>
      </g>
      <g id="wr-deplie">
      <path d="M22 318 C30 306 44 300 58 304 C66 308 70 316 66 326 C58 340 40 350 16 356 Z" fill="#fffaf0" stroke="#cfc4aa" strokeWidth=".8"/>
      <path d="M30 322 C40 314 52 312 62 316 M26 334 C38 326 50 324 60 326 M22 346 C32 340 42 336 52 334" fill="none" stroke="#c9bfa8" strokeWidth="1" strokeLinecap="round"/>
      </g>
      </defs>
    </svg>
  )
}

/**
 * Une scène. Ce qui dit l'état de l'invité porte une classe : `pris` (le vin dans son verre, sa
 * serviette dépliée) et `mitre` (sa serviette pliée), que la feuille montre selon `data-etat` de la
 * scène. Le couvert de l'hôte, à gauche, est toujours servi. Les lointains (`l1`, `l2`, `l3`) défilent
 * en boucle, hors du calme seulement.
 */
export default function DessinDeLaTable() {
  const n = `wr${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox="0 0 390 550" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="390" height="550" fill="url(#wr-teck)"/>
      <g opacity=".5" stroke="#1d0f06" strokeWidth=".6"><path d="M4 0 V240 M12 0 V240 M27 0 V240 M48 0 V240 M342 0 V240 M363 0 V240 M378 0 V240 M386 0 V240"/></g>
      <rect width="390" height="19" fill="#27140a"/><path d="M0 19.5 H390" stroke="#c9a257" strokeWidth="1.2"/>
      <g fill="#d9b77a" opacity=".85"><path id={`${n}-losange`} d="M15 4 l5 5.5 l-5 5.5 l-5 -5.5 Z"/><use href={`#${n}-losange`} x="40"/><use href={`#${n}-losange`} x="80"/><use href={`#${n}-losange`} x="120"/><use href={`#${n}-losange`} x="160"/><use href={`#${n}-losange`} x="200"/><use href={`#${n}-losange`} x="240"/><use href={`#${n}-losange`} x="280"/><use href={`#${n}-losange`} x="320"/><use href={`#${n}-losange`} x="360"/></g>
      <g fill="none" stroke="#7c8a52" strokeWidth="1" opacity=".9"><path d="M22 9.5 h26 M62 9.5 h26 M102 9.5 h26 M142 9.5 h26 M182 9.5 h26 M222 9.5 h26 M262 9.5 h26 M302 9.5 h26 M342 9.5 h26"/></g>
      <use href="#wr-fleur" x="25" y="112"/><use href="#wr-fleur" x="365" y="112"/>
      <rect x="49" y="21" width="292" height="190" rx="15" fill="#1c0f07"/>
      <rect x="54" y="26" width="282" height="180" rx="12" fill="#5d361a" stroke="#2a1608"/>
      <g clipPath="url(#wr-vitre)">
      <rect x="59" y="31" width="272" height="170" fill="url(#wr-ciel)"/>
      <g fill="#fff3cf"><circle cx="92" cy="50" r=".9"/><circle cx="128" cy="42" r=".7"/><circle cx="150" cy="70" r=".8"/><circle cx="226" cy="46" r=".9"/><circle cx="252" cy="78" r=".7"/><circle cx="312" cy="96" r=".8"/><circle cx="108" cy="92" r=".6"/><circle cx="300" cy="44" r=".6"/></g>
      <circle cx="278" cy="62" r="26" fill="#fff3cf" opacity=".1"/><circle cx="278" cy="62" r="10.5" fill="#fff3cf"/><circle cx="274" cy="59" r="2.2" fill="#e0d2a8" opacity=".7"/><circle cx="281" cy="66" r="1.5" fill="#e0d2a8" opacity=".7"/>
      <g className={styles.l1} fill="#27305c"><path id={`${n}-monts`} d="M0 164 C30 150 52 138 84 146 C110 152 126 132 160 136 C196 140 214 156 244 150 C268 146 282 158 300 164 V204 H0 Z"/><use href={`#${n}-monts`} x="300"/><use href={`#${n}-monts`} x="600"/></g>
      <g className={styles.l2}><g id={`${n}-bourg`}><path d="M0 172 C40 162 70 168 110 164 C150 160 190 172 230 166 C262 162 284 168 300 172 V204 H0 Z" fill="#161c3c"/><path d="M118 166 v-9 l5 -5 l5 5 v9 Z M130 166 v-7 l6 -4 l6 4 v7 Z M146 166 v-19 l3 -10 l3 10 v19 Z M154 166 v-8 l6 -4 l6 4 v8 Z M38 169 v-6 l5 -4 l5 4 v6 Z" fill="#141a38"/><g fill="#f6c868"><rect x="121.5" y="158" width="2" height="2.5"/><rect x="134.5" y="159.5" width="2" height="2.5"/><rect x="158.5" y="159" width="2" height="2.5"/><rect x="42" y="164" width="1.8" height="2.2"/></g><path d="M240 168 c-2 -10 4 -16 8 -16 c5 0 9 7 7 16 Z M262 168 c-2 -7 3 -12 6 -12 c4 0 7 5 5 12 Z M72 168 c-2 -8 3 -13 7 -13 c4 0 7 6 5 13 Z" fill="#141a38"/></g><use href={`#${n}-bourg`} x="300"/><use href={`#${n}-bourg`} x="600"/></g>
      <rect x="59" y="182" width="272" height="20" fill="#0b0e1f"/>
      <g className={styles.l3} fill="#0b0e1f" stroke="#0b0e1f"><g id={`${n}-poteau`}><path d="M40 204 V118 M30 126 H50 M32 134 H48" strokeWidth="2.6" fill="none"/><path d="M30 126 C80 156 140 156 190 126 M32 134 C80 162 140 162 188 134" strokeWidth=".7" fill="none" opacity=".8"/><path d="M96 190 c-4 -12 2 -20 8 -20 c8 0 12 10 8 20 Z M118 190 c-2 -8 2 -13 6 -13 c5 0 8 6 5 13 Z" stroke="none"/></g><use href={`#${n}-poteau`} x="160"/><use href={`#${n}-poteau`} x="320"/><use href={`#${n}-poteau`} x="480"/></g>
      <ellipse cx="195" cy="150" rx="74" ry="56" fill="url(#wr-halo)" opacity=".7"/>
      <path d="M59 31 H150 L92 201 H59 Z M205 31 h26 L173 201 h-26 Z" fill="#fff" opacity=".045"/>
      </g>
      <rect x="59" y="31" width="272" height="170" rx="9" fill="none" stroke="#c9a257" strokeWidth="1.4"/><rect x="59" y="31" width="272" height="170" rx="9" fill="none" stroke="#000" strokeWidth="5" opacity=".28" clipPath="url(#wr-vitre)"/>
      <path d="M52 24 H338 V44 C326 56 314 56 302 44 C290 56 278 56 266 44 C254 56 242 56 230 44 C218 56 206 56 195 44 C184 56 172 56 160 44 C148 56 136 56 124 44 C112 56 100 56 88 44 C76 56 64 56 52 44 Z" fill="url(#wr-velours)"/>
      <path d="M52 44 C64 56 76 56 88 44 C100 56 112 56 124 44 C136 56 148 56 160 44 C172 56 184 56 195 44 C206 56 218 56 230 44 C242 56 254 56 266 44 C278 56 290 56 302 44 C314 56 326 56 338 44" fill="none" stroke="#e2b23c" strokeWidth="2.4" strokeDasharray="1.2 1.6"/>
      <path d="M50 27 H340" stroke="url(#wr-laiton)" strokeWidth="3" strokeLinecap="round"/>
      <g id={`${n}-rideau`}><path d="M52 30 H92 C90 70 84 104 68 130 C80 150 88 176 90 208 H52 Z" fill="url(#wr-velours)"/><path d="M62 32 C62 70 62 104 60 128 M74 32 C74 70 70 104 64 128 M84 32 C82 70 76 106 67 129 M62 136 C62 160 60 186 58 208 M68 134 C74 156 78 182 80 208" fill="none" stroke="#3d100f" strokeWidth="1.3" opacity=".7"/><path d="M68 32 C68 70 66 104 62 128 M79 32 C78 70 74 104 66 128" fill="none" stroke="#b9544a" strokeWidth=".8" opacity=".55"/><path d="M52 126 C58 133 66 134 72 128" fill="none" stroke="#e2b23c" strokeWidth="3" strokeLinecap="round"/><path d="M57 132 v14 M55 146 h4 l1 12 h-6 Z" stroke="#e2b23c" strokeWidth="1.4" fill="#c9962a"/><path d="M52 207 H90" stroke="#e2b23c" strokeWidth="2.4" strokeDasharray="1.2 1.6"/></g>
      <use href={`#${n}-rideau`} transform="translate(390 0) scale(-1 1)"/>
      <rect x="42" y="206" width="306" height="9" rx="2" fill="url(#wr-loupe)" stroke="#2a1608" strokeWidth=".8"/><path d="M44 207.5 H346" stroke="#e9c98a" strokeWidth=".8" opacity=".6"/>
      <rect x="0" y="215" width="390" height="30" fill="#24130a"/>
      <g id={`${n}-banquette`}>
      <path d="M0 160 L60 148 V246 L0 380 Z" fill="url(#wr-banq)"/>
      <path d="M0 160 L60 148" stroke="url(#wr-laiton)" strokeWidth="4" strokeLinecap="round"/>
      <g stroke="#070c1c" strokeWidth="1" opacity=".8" fill="none"><path d="M0 160 L60 172.5 M0 215 L60 197 M0 270 L60 221.5 M0 325 L60 246 M0 215 L60 148 M0 270 L60 172.5 M0 325 L60 197 M0 380 L60 221.5"/></g><g stroke="#4a66a8" strokeWidth=".7" opacity=".5" fill="none"><path d="M0 161.5 L60 174 M0 216.5 L60 149.5 M0 271.5 L60 174"/></g>
      <g fill="#c9a257"><circle cx="41.5" cy="168.6" r="1.7"/><circle cx="41.5" cy="202.5" r="1.7"/><circle cx="41.5" cy="236.4" r="1.7"/><circle cx="1" cy="215" r="2"/><circle cx="1" cy="270" r="2"/><circle cx="59" cy="172.5" r="1.3"/><circle cx="59" cy="197" r="1.3"/><circle cx="59" cy="221.5" r="1.3"/></g>
      <path d="M60 148 V246" stroke="#050812" strokeWidth="2" opacity=".7"/>
      </g>
      <use href={`#${n}-banquette`} transform="translate(390 0) scale(-1 1)"/>
      <path d="M4 156 C14 150 30 148 44 148 C48 160 46 178 40 196 C30 204 14 204 2 212 Z" fill="#b98a3a"/><path d="M8 162 C18 158 30 156 40 156 M6 176 C16 172 28 170 40 172 M4 192 C14 188 26 186 38 188" fill="none" stroke="#6b3d1a" strokeWidth="1.2" strokeDasharray="3 2.4"/><path d="M2 212 C14 204 30 204 40 196" fill="none" stroke="#f1dca0" strokeWidth="2" strokeDasharray="1 1.8"/>
      <path d="M78 229 H312 L512 550 H-122 Z" fill="#1a0e06" opacity=".5" transform="translate(0 5)"/>
      <path d="M78 228 H312 L500 532 H-110 Z" fill="url(#wr-nappe)"/>
      <path d="M-110 532 H500 L504 550 H-114 Z" fill="#b5aa92"/><path d="M-110 532 H500" stroke="#fffaf0" strokeWidth="1.2" opacity=".8"/>
      <ellipse cx="195" cy="262" rx="170" ry="56" fill="url(#wr-flaque)"/>
      <g fill="none"><path d="M96 237 H294 L464 532 M96 237 L-74 532" stroke="#b9ad92" strokeWidth="3.4" opacity=".4"/><path d="M100 240.5 H290 L452 532 M100 240.5 L-62 532" stroke="#fffdf4" strokeWidth="1" opacity=".8"/>
      <path d="M156 228 L96 532 M234 228 L294 532 M48 276 H342 M-14 376 H404" stroke="#fffdf6" strokeWidth="1.3" opacity=".85"/><path d="M157.5 228 L98 532 M235.5 228 L296 532 M48 277.5 H342 M-14 377.8 H404" stroke="#8f8468" strokeWidth=".9" opacity=".3"/></g>
      <g transform="translate(-13 -3)"><ellipse cx="238" cy="244" rx="10" ry="2.8" fill="#3a2a16" opacity=".22"/><path d="M231 243 C228 232 230 224 234.5 219 V210 H241.5 V219 C246 224 248 232 245 243 Z" fill="rgba(225,238,242,.3)" stroke="#fff" strokeWidth=".8" strokeOpacity=".8"/><path d="M230.6 240 C229.5 234 230.5 229 232.6 225 H243.4 C245.5 229 246.5 234 245.4 240 Z" fill="#cfe2e8" opacity=".45"/><path d="M233 238 C231.8 232 233 226 235 222" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round"/><ellipse cx="238" cy="210" rx="3.6" ry="1" fill="none" stroke="#fff" strokeWidth=".7"/></g>
      <g transform="translate(12 -2)"><ellipse cx="156" cy="246" rx="8" ry="2.2" fill="#3a2a16" opacity=".22"/><path d="M150 245 C149 239 151 235 153 233 H159 C161 235 163 239 162 245 Z" fill="url(#wr-argent)" stroke="#70757a" strokeWidth=".5"/><path d="M153 233 C153 229 159 229 159 233" fill="#e9e7df" stroke="#70757a" strokeWidth=".5"/><circle cx="156" cy="229.5" r="1.2" fill="#f4f2ea"/></g>
      <ellipse cx="195" cy="251" rx="34" ry="7" fill="#3a2a16" opacity=".28"/>
      <ellipse cx="195" cy="248" rx="19" ry="5" fill="url(#wr-laiton)" stroke="#5a4016" strokeWidth=".6"/>
      <path d="M187 247 C185 236 191 230 190.5 218 C190 206 193 196 193 174 H197 C197 196 200 206 199.5 218 C199 230 205 236 203 247 Z" fill="url(#wr-laiton)" stroke="#5a4016" strokeWidth=".6"/><ellipse cx="195" cy="219" rx="6.5" ry="2" fill="#f0d488" stroke="#5a4016" strokeWidth=".5"/><ellipse cx="195" cy="200" rx="4" ry="1.4" fill="#f0d488" stroke="#5a4016" strokeWidth=".5"/>
      <circle cx="195" cy="148" r="118" fill="url(#wr-halo)" style={{ mixBlendMode: 'screen' }}/>
      <path d="M157 174 L176 116 H214 L233 174 Z" fill="url(#wr-soie)"/>
      <g stroke="#a8642a" strokeWidth=".8" opacity=".6" fill="none"><path d="M163.5 174 L179.5 116 M170 174 L183 116 M176.5 174 L186.5 116 M183 174 L190 116 M189 174 L193 116 M195 174 V116 M201 174 L197 116 M207 174 L200 116 M213.5 174 L203.5 116 M220 174 L207 116 M226.5 174 L210.5 116"/></g>
      <path d="M176 116 H214 l1.2 4 H174.8 Z" fill="#8a4a1e"/><path d="M157 174 H233 l-1.5 -5 H158.5 Z" fill="#8a4a1e"/><path d="M158 177.5 H232" stroke="#c9853f" strokeWidth="6" strokeDasharray="1.3 2"/>
      <ellipse cx="195" cy="116" rx="19" ry="2.4" fill="#ffe9b4" opacity=".8"/>
      <use href="#wr-couvert"/><use href="#wr-couvert" transform="translate(390 0) scale(-1 1)"/>
      <use href="#wr-verre" x="141" y="268"/><use href="#wr-vin" x="141" y="268" fill="#7a1f24"/>
      <use href="#wr-verre" x="249" y="268"/><use className={styles.pris} href="#wr-vin" x="249" y="268" fill="#7a1f24"/>
      <use href="#wr-deplie"/>
      <path d="M84 290 c5 -5 13 -6 19 -3 c5 -3 11 -1 12 3 c-9 5 -22 5 -31 0 Z" fill="#d9a55c" stroke="#9a6a2c" strokeWidth=".6"/><path d="M92 288 l4 3 M100 287 l4 3" stroke="#9a6a2c" strokeWidth=".7"/>
      <use className={styles.pris} href="#wr-deplie" transform="translate(390 0) scale(-1 1)"/>
      <g className={styles.mitre} transform="translate(292 288)"><ellipse cx="0" cy="1" rx="17" ry="4.4" fill="#3a2a16" opacity=".18"/><path d="M-15 0 L-8 -22 L0 -6 L8 -22 L15 0 Z" fill="#efe7d4" stroke="#c9bfa8" strokeWidth=".7"/><path d="M-12 0 L0 -34 L12 0 Z" fill="#fffdf6" stroke="#c9bfa8" strokeWidth=".7"/><path d="M0 -34 V0 M-6 0 L0 -18 L6 0" fill="none" stroke="#d6cdb8" strokeWidth=".8"/></g>
      <rect width="390" height="550" fill="url(#wr-penombre)"/>
    </svg>
  )
}
