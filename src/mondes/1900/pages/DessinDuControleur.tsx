/**
 * Le contrôleur des billets (maquette « Voyage immobile 1900 », l. 1635-1699 : `.ctrl`), de trois
 * quarts, la casquette à bandeau rouge, la sacoche en bandoulière, la pince à poinçonner dans une
 * main et l'autre tendue : les tracés de la maquette, portés tels quels. Un dessin, jamais une
 * photographie ; ses couleurs sont sa donnée, comme celles d'un objet trouvé. Il ne se lit pas : le
 * dialogue qui le pose dit qui il est.
 */
export default function DessinDuControleur() {
  return (
    <svg viewBox="0 0 262 370" aria-hidden="true" focusable="false">
      <defs>
      <linearGradient id="ct-drap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#55535a"/><stop offset=".28" stopColor="#2d2d36"/><stop offset=".72" stopColor="#17171d"/><stop offset="1" stopColor="#0b0a0e"/></linearGradient>
      <linearGradient id="ct-manche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d5a5e"/><stop offset=".42" stopColor="#2d2d36"/><stop offset="1" stopColor="#101016"/></linearGradient>
      <radialGradient id="ct-chair" cx=".28" cy=".3" r=".9"><stop offset="0" stopColor="#e3cba4"/><stop offset=".48" stopColor="#b9966e"/><stop offset="1" stopColor="#58402c"/></radialGradient>
      <linearGradient id="ct-cuir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#93663b"/><stop offset="1" stopColor="#35200f"/></linearGradient>
      <linearGradient id="ct-laiton" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f1dc9f"/><stop offset=".5" stopColor="#b48f48"/><stop offset="1" stopColor="#584220"/></linearGradient>
      <linearGradient id="ct-acier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d9d9d2"/><stop offset=".5" stopColor="#7c7f80"/><stop offset="1" stopColor="#34373a"/></linearGradient>
      <pattern id="ct-h1" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 2 H4" stroke="#050508" strokeWidth=".9"/></pattern>
      <pattern id="ct-h2" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)"><path d="M0 1.7 H3.4" stroke="#3a2818" strokeWidth=".7"/></pattern>
      <linearGradient id="ct-fond" x1="0" y1="0" x2="0" y2="1"><stop offset=".74" stopColor="#fff"/><stop offset="1" stopColor="#000"/></linearGradient>
      <mask id="ct-pied" maskUnits="userSpaceOnUse" x="-60" y="0" width="380" height="370"><rect x="-60" width="380" height="370" fill="url(#ct-fond)"/></mask>
      </defs>
      <g mask="url(#ct-pied)">
      <path d="M86 370 L96 240 C99 206 124 187 150 181 L178 179 C212 183 238 200 246 240 L258 370 Z" fill="url(#ct-drap)"/>
      <path d="M178 180 C212 183 238 200 246 240 L258 370 H188 C192 318 190 250 178 180 Z" fill="url(#ct-h1)" opacity=".6"/>
      <path d="M104 262 C112 300 112 336 106 370 H130 C134 330 130 292 122 258 Z" fill="url(#ct-h1)" opacity=".35"/>
      <path d="M99 236 C103 208 126 191 150 184" fill="none" stroke="#f0cd92" strokeWidth="2.4" strokeLinecap="round" opacity=".55"/>
      <path d="M163 186 L154 252 L170 370" fill="none" stroke="#06060a" strokeWidth="1.8"/>
      <path d="M167 186 L158 252 L174 370" fill="none" stroke="#6a6870" strokeWidth=".7" opacity=".5"/>
      <g fill="url(#ct-laiton)" stroke="#2a1e0c" strokeWidth=".8"><circle cx="148" cy="214" r="4"/><circle cx="145.500" cy="244" r="4"/><circle cx="146.500" cy="274" r="4"/><circle cx="150" cy="304" r="4"/><circle cx="154" cy="334" r="4"/></g>
      <path d="M148 150 H186 V178 C174 187 156 185 148 177 Z" fill="#9a7a58"/><path d="M148 162 C160 172 176 172 186 160 V178 C174 187 156 185 148 177 Z" fill="#3d2c1e" opacity=".55"/>
      <path d="M140 170 C150 182 174 184 190 170 L192 187 C174 198 150 196 138 185 Z" fill="#1c1c24"/><path d="M140 170 C150 182 174 184 190 170" fill="none" stroke="#8c3a2e" strokeWidth="1.6"/><circle cx="147" cy="183" r="2.2" fill="url(#ct-laiton)"/>
      <path d="M176 92 H195 C199 104 199 114 196 124 L188 120 C186 110 182 100 176 92 Z" fill="#2a2018"/>
      <path d="M126 94 C122 108 121 124 124 138 C126 152 136 164 152 167 C172 170 192 156 196 130 C198 112 196 100 192 92 Z" fill="url(#ct-chair)"/>
      <path d="M170 94 H192 C198 112 198 132 192 148 C184 162 170 168 158 167 C170 150 173 120 170 94 Z" fill="url(#ct-h2)" opacity=".5"/>
      <path d="M126 100 H192 L193 106 C170 102 146 102 126 108 Z" fill="#2a1c12" opacity=".5"/>
      <path d="M187 117 C195 115 198 124 196 132 C194 138 189 139 187 135 Z" fill="#a98360" stroke="#553c28" strokeWidth=".9"/><path d="M190 121 C193 123 193 130 190 133" fill="none" stroke="#553c28" strokeWidth=".8"/>
      <path d="M128 110 C122 120 116 130 120 135 C123 139 129 138 133 134" fill="#cdae87" stroke="#674a32" strokeWidth="1.1" strokeLinejoin="round"/>
      <path d="M129 106 q7 -5 14 -1 M151 105 q7 -4 14 0" fill="none" stroke="#2a2018" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M132 114 q5 -3 10 0 M153 114 q5 -3 10 0" fill="none" stroke="#2a1c12" strokeWidth="1.3" strokeLinecap="round"/><circle cx="137.500" cy="115.200" r="1.900" fill="#1c130c"/><circle cx="158.500" cy="115.200" r="1.900" fill="#1c130c"/>
      <path d="M148 122 C155 132 156 142 152 150" fill="none" stroke="#7a5c40" strokeWidth=".9" opacity=".6"/>
      <path d="M138 140 C128 135 116 140 108 150 C120 153 131 151 138 146 C146 151 160 153 172 147 C164 137 150 135 138 140 Z" fill="#2a2018"/>
      <path d="M114 148 C122 144 130 143 137 144 M141 144 C150 142 160 143 167 146" fill="none" stroke="#7d6a55" strokeWidth=".8" opacity=".7"/>
      <path d="M133 155 q8 4 15 0" fill="none" stroke="#674a32" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M124 93 L128 58 C140 47 186 47 198 58 L201 93 Z" fill="url(#ct-drap)"/>
      <path d="M128 58 C140 47 186 47 198 58 C186 65 140 65 128 58 Z" fill="#45444c"/>
      <path d="M170 62 L172 93 H201 L198 58 C192 62 180 63 170 62 Z" fill="url(#ct-h1)" opacity=".55"/>
      <path d="M123 81 H201 L201.500 95 H122.500 Z" fill="#7e3329"/><path d="M123 81 H201 M122.500 95 H201.500" stroke="#c7a45e" strokeWidth="1"/>
      <path d="M131 57 C143 50 170 49 186 53" fill="none" stroke="#f0cd92" strokeWidth="1.8" strokeLinecap="round" opacity=".6"/>
      <g fill="url(#ct-laiton)" stroke="#2a1e0c" strokeWidth=".6"><path d="M151 71 C144 66 137 67 133 71 C139 71 144 73 149 76 Z M165 71 C172 66 179 67 183 71 C177 71 172 73 167 76 Z"/><circle cx="158" cy="72" r="5.200"/></g><circle cx="158" cy="72" r="2" fill="#2a1e0c"/>
      <path d="M95 105 C103 95 119 93 124 93 L155 97 C150 103 126 101 96 108 Z" fill="#08080b"/><path d="M102 100 C110 96 121 95 132 96" fill="none" stroke="#a5a4a8" strokeWidth="1.1" strokeLinecap="round" opacity=".75"/>
      <path d="M222 196 L128 338 L140 346 L234 208 Z" fill="url(#ct-cuir)"/><path d="M226 205 L136 339" fill="none" stroke="#dcb97e" strokeWidth=".7" strokeDasharray="3 2.500" opacity=".6"/>
      <rect x="176" y="258" width="13" height="10" rx="1.500" transform="rotate(-56 182 263)" fill="none" stroke="url(#ct-laiton)" strokeWidth="2.200"/>
      <path d="M100 326 h60 a5 5 0 0 1 5 5 v39 h-70 v-39 a5 5 0 0 1 5 -5 Z" fill="url(#ct-cuir)" stroke="#1f1107" strokeWidth="1.600"/>
      <path d="M95 331 a5 5 0 0 1 5 -5 h60 a5 5 0 0 1 5 5 v12 C150 357 110 357 95 343 Z" fill="#7d5532" stroke="#1f1107" strokeWidth="1.200"/>
      <path d="M132 330 h28 a5 5 0 0 1 5 5 v35 h-26 Z" fill="url(#ct-h1)" opacity=".4"/>
      <rect x="124" y="345" width="12" height="11" rx="2" fill="url(#ct-laiton)" stroke="#3b2a10"/>
      <path d="M226 206 C246 232 250 280 236 322 L208 314 C216 290 214 262 204 238 Z" fill="#17171e" stroke="#07070a" strokeWidth="1"/>
      <path d="M226 206 C246 232 250 280 236 322 L222 318 C232 284 232 244 216 214 Z" fill="url(#ct-h1)" opacity=".6"/>
      <path d="M210 300 L239 308 M211.500 294 L240 302" stroke="url(#ct-laiton)" strokeWidth="1.800"/>
      <g transform="translate(206 324) rotate(26)"><path d="M-3 0 C-7 14 -7 28 -3 42" fill="none" stroke="url(#ct-acier)" strokeWidth="5" strokeLinecap="round"/><path d="M8 0 C13 13 13 26 10 38" fill="none" stroke="#55585a" strokeWidth="5" strokeLinecap="round"/><path d="M-8 3 L-4 -19 H10 L14 3 Z" fill="url(#ct-acier)" stroke="#1c1d1f" strokeWidth=".9"/><path d="M-1 -19 V-11 H7 V-19" fill="#1c1d1f"/><circle cx="3" cy="-3" r="2.400" fill="#1c1d1f"/></g>
      <path d="M205 312 C198 320 200 334 212 337 C225 339 236 331 235 320 L230 311 Z" fill="url(#ct-chair)" stroke="#553c28" strokeWidth=".9"/><path d="M206 322 L226 318 M208 329 L228 325" fill="none" stroke="#6b4c33" strokeWidth=".9" strokeLinecap="round"/>
      <path d="M124 200 C96 206 60 226 34 246 L48 280 C72 264 104 252 132 246 C138 230 134 212 124 200 Z" fill="url(#ct-manche)"/>
      <path d="M48 280 C72 264 104 252 132 246 L130 232 C100 240 68 254 42 270 Z" fill="url(#ct-h1)" opacity=".65"/>
      <path d="M40 243 C64 226 96 210 122 203" fill="none" stroke="#f0cd92" strokeWidth="2" strokeLinecap="round" opacity=".6"/>
      <path d="M39 243 L53 277 M47 238 L60 271" stroke="url(#ct-laiton)" strokeWidth="2.200"/>
      <g transform="translate(42 264) scale(1.16) translate(-42 -264)">
      <path d="M34 248 C30 238 22 233 15 236 C13 242 19 248 26 253 Z" fill="url(#ct-chair)" stroke="#553c28" strokeWidth=".9" strokeLinejoin="round"/>
      <path d="M36 248 C26 246 16 250 8 256 L-7 262 C-11 265 -9 271 -4 270 L10 267 L-9 274 C-13 277 -10 283 -5 282 L12 277 L-3 284 C-6 288 -2 292 3 290 L22 284 C34 284 44 280 48 274 Z" fill="url(#ct-chair)" stroke="#553c28" strokeWidth=".9" strokeLinejoin="round"/>
      <path d="M12 260 C20 260 30 264 35 271 M22 255 C28 256 33 259 36 263" fill="none" stroke="#7a5c40" strokeWidth=".9" strokeLinecap="round"/>
      <path d="M22 284 C34 284 44 280 48 274 L46 268 C40 276 30 280 16 282 Z" fill="#3d2c1e" opacity=".45"/>
      </g>
      </g>
    </svg>
  )
}
