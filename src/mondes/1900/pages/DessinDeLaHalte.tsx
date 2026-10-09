/**
 * La petite gare de campagne au bout de l'embranchement, et l'atelier vitré à côté (maquette « Voyage
 * immobile 1900 », `#halte`, l. 1548-1616) : les tracés de la maquette, recopiés tels quels, sans son
 * filtre de matière. Un dessin, posé devant la photographie du lointain que le dialogue porte
 * (`HalteDeLaCarte.tsx`) ; ses couleurs sont sa donnée. Muet : le dialogue dit le nom de la halte.
 */
export default function DessinDeLaHalte() {
  return (
    <svg viewBox="0 0 390 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
    <pattern id="ha-h" width="4.400" height="4.400" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 2.200 H4.400" stroke="#2c2118" strokeWidth=".8"/></pattern>
    <pattern id="ha-v" width="3.600" height="3.600" patternUnits="userSpaceOnUse" patternTransform="rotate(-48)"><path d="M0 1.800 H3.600" stroke="#2c2118" strokeWidth=".6"/></pattern>
    <pattern id="ha-ard" width="9" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 C0 2 9 2 9 6 M-4.500 3 C-4.500 -1 4.500 -1 4.500 3 M4.500 3 C4.500 -1 13.500 -1 13.500 3" fill="none" stroke="#221b16" strokeWidth=".7"/></pattern>
    <pattern id="ha-bri" width="9" height="5" patternUnits="userSpaceOnUse"><path d="M0 .3 H9 M0 2.800 H9 M2 .3 V2.800 M6.500 2.800 V5" stroke="#4a241b" strokeWidth=".55" fill="none"/></pattern>
    <pattern id="ha-bal" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.500" cy="2" r=".9" fill="#1c140d"/><circle cx="5" cy="5.200" r=".7" fill="#8f8168"/><circle cx="4.600" cy="1.200" r=".5" fill="#1c140d"/></pattern>
    <filter id="ha-poch" x="-8%" y="-8%" width="116%" height="116%"><feGaussianBlur stdDeviation="1.200"/></filter>
    </defs>
    <g>
    <path d="M0 506 C70 492 150 500 230 494 S340 486 390 492 V584 H0 Z" fill="#8f9470" opacity=".86"/>
    <path d="M0 506 C70 492 150 500 230 494 S340 486 390 492 V530 H0 Z" fill="url(#ha-v)" opacity=".3"/>
    <g filter="url(#ha-poch)" fill="#6c7852" opacity=".92" transform="translate(2 -2)"><ellipse cx="20" cy="446" rx="11" ry="38"/><ellipse cx="40" cy="456" rx="9" ry="28"/></g>
    <g fill="url(#ha-h)" opacity=".75"><ellipse cx="20" cy="446" rx="10" ry="37"/><ellipse cx="40" cy="456" rx="8" ry="27"/></g>
    <path d="M20 482 V496 M40 482 V496" stroke="#2c2118" strokeWidth="1.600"/>
    <g transform="translate(288 450)">
    <path d="M-8 60 C20 54 70 54 98 60 V66 H-8 Z" fill="#7d8460" opacity=".9"/>
    <path d="M0 56 V20 L24 0 H68 L86 20 V56 Z" fill="#c4d8d3" opacity=".9" filter="url(#ha-poch)" transform="translate(2 -1.500)"/>
    <path d="M25 2 H45 V19 H13 Z M49 21 H71 V37 H49 Z" fill="#f3f5ea" opacity=".6"/>
    <path d="M49 2 H67 L84 20 H49 Z M0 38 H24 V56 H0 Z" fill="url(#ha-v)" opacity=".4"/>
    <path d="M0 20 H86 M24 0 V56 M48 0 V56 M68 0 V56 M0 38 H86 M12 10 V56 M36 0 V56 M59 0 V56 M78 11 V56" stroke="#3a4442" strokeWidth=".9" fill="none"/>
    <path d="M0 56 V20 L24 0 H68 L86 20 V56" fill="none" stroke="#2c2118" strokeWidth="1.600" strokeLinejoin="round"/>
    <rect x="-3" y="53" width="92" height="6" fill="#b3a382" stroke="#2c2118" strokeWidth="1"/>
    <path d="M46 0 V-8 M43 -8 H49" stroke="#2c2118" strokeWidth="1.200"/>
    </g>
    <g transform="translate(0 30)">
    <g transform="translate(52 0)">
    <rect x="149.500" y="382.500" width="14" height="27" fill="#9a5a45" filter="url(#ha-poch)"/><rect x="148" y="384" width="14" height="26" fill="url(#ha-bri)"/><rect x="148" y="384" width="14" height="26" fill="none" stroke="#2c2118" strokeWidth="1.200"/><rect x="145" y="379.500" width="20" height="5.500" fill="#3b2a20"/>
    <path d="M-10 452 L20 404 H186 L216 452 Z" fill="#716e68"/>
    <path d="M-10 452 L20 404 H186 L216 452 Z" fill="url(#ha-ard)" opacity=".85"/>
    <path d="M-10 452 L20 404 H70 L46 452 Z" fill="#f4efe2" opacity=".13"/><path d="M150 404 H186 L216 452 H176 Z" fill="url(#ha-h)" opacity=".4"/>
    <path d="M20 404 H186 M20 404 v-8 M186 404 v-8" stroke="#2c2118" strokeWidth="2" fill="none"/><path d="M-12 452 H218" stroke="#2c2118" strokeWidth="2.800"/>
    <path d="M88 448 V425 L103 412 L118 425 V448 Z" fill="#dfd1ad" stroke="#2c2118" strokeWidth="1.400" strokeLinejoin="round"/>
    <circle cx="103" cy="432" r="9.500" fill="#f4efe2" stroke="#2c2118" strokeWidth="2"/><path d="M103 432 V425.500 M103 432 L107.500 434" stroke="#2c2118" strokeWidth="1.500" strokeLinecap="round"/><path d="M103 424 v1.500 M103 438.500 v1.500 M95 432 h1.500 M109.500 432 h1.500" stroke="#2c2118" strokeWidth=".8"/>
    <rect x="4" y="452" width="198" height="84" fill="#e2d4b0"/>
    <rect x="118" y="452" width="84" height="84" fill="url(#ha-v)" opacity=".2"/>
    <g fill="#a55746" opacity=".88" filter="url(#ha-poch)" transform="translate(1.500 -1.500)"><rect x="4" y="452" width="10" height="84"/><rect x="192" y="452" width="10" height="84"/><rect x="4" y="452" width="198" height="7"/><rect x="4" y="529" width="198" height="7"/></g>
    <g fill="none" stroke="#a55746" strokeWidth="5" opacity=".85"><path d="M22 490 a17 17 0 0 1 34 0 M86 486 a17 17 0 0 1 34 0 M150 490 a17 17 0 0 1 34 0"/></g>
    <g fill="url(#ha-bri)" opacity=".85"><rect x="4" y="452" width="10" height="84"/><rect x="192" y="452" width="10" height="84"/><rect x="4" y="452" width="198" height="7"/><rect x="4" y="529" width="198" height="7"/></g>
    <rect x="4" y="452" width="198" height="84" fill="none" stroke="#2c2118" strokeWidth="1.400"/>
    <g fill="#33271d" stroke="#1d150e" strokeWidth="1"><path d="M26 536 V488 a13 13 0 0 1 26 0 V536 Z"/><path d="M90 536 V484 a13 13 0 0 1 26 0 V536 Z"/><path d="M154 536 V488 a13 13 0 0 1 26 0 V536 Z"/></g>
    <g fill="#aebdb8"><path d="M30 512 V489 a9 9 0 0 1 18 0 V512 Z"/><path d="M158 512 V489 a9 9 0 0 1 18 0 V512 Z"/><path d="M94 496 V485 a9 9 0 0 1 18 0 V496 Z"/></g>
    <path d="M31 508 L46 484 M159 508 L174 484" stroke="#f3f5ea" strokeWidth="2.400" opacity=".45"/>
    <path d="M39 480 V512 M30 497 H48 M167 480 V512 M158 497 H176 M103 476 V496 M94 496 H112" stroke="#33271d" strokeWidth="1.200" fill="none"/>
    <path d="M96 502 h14 v13 h-14 Z M96 519 h14 v13 h-14 Z M27 516 h24 M155 516 h24" fill="none" stroke="#6b543c" strokeWidth=".9"/><circle cx="111.500" cy="517" r="1.300" fill="#c9a257"/>
    <rect x="4" y="478" width="198" height="11" fill="#2c2118" opacity=".24"/>
    <path d="M-16 470 H222 L214 478 H-8 Z" fill="#3b2e22"/><path d="M-16 470 H222" stroke="#8b7a5e" strokeWidth="1" opacity=".7"/>
    <path d="M-8 478 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l3 4.500 V478 Z" fill="#4a3a2b"/>
    <path d="M-4 478 V536 M210 478 V536" stroke="#2c2118" strokeWidth="3"/><path d="M-4 494 C4 492 10 486 12 478 M210 494 C202 492 196 486 194 478" fill="none" stroke="#2c2118" strokeWidth="1.400"/>
    <path d="M60 512 H82" stroke="#33271d" strokeWidth="2"/><rect x="59" y="520" width="24" height="3.500" fill="#33271d"/><path d="M62 512 V536 M80 512 V536" stroke="#33271d" strokeWidth="2"/>
    <rect x="130" y="523" width="17" height="13" fill="#7a5a38" stroke="#2c2118" strokeWidth="1"/><path d="M134 523 V536 M143 523 V536" stroke="#2c2118" strokeWidth="1"/><rect x="133" y="515" width="11" height="8" fill="#8f6d45" stroke="#2c2118" strokeWidth="1"/>
    <path d="M236 536 V488" stroke="#2c2118" strokeWidth="2.400"/><path d="M231 488 l2 -11 h6 l2 11 Z" fill="#ece2b4" stroke="#2c2118" strokeWidth="1.200" strokeLinejoin="round"/><path d="M232 477 h8 l-4 -5 Z" fill="#2c2118"/><path d="M232 536 h8" stroke="#2c2118" strokeWidth="3"/>
    </g>
    <path d="M283 537 V507 M301 537 V507 M319 537 V507 M337 537 V507 M355 537 V507 M373 537 V507 M275 515 H390 M275 529 H390" stroke="#2c2118" strokeWidth="3.200" opacity=".45" fill="none"/>
    <g stroke="#efe6d0" fill="none"><path d="M282 536 V506 M300 536 V506 M318 536 V506 M336 536 V506 M354 536 V506 M372 536 V506" strokeWidth="2.400"/><path d="M274 514 H390 M274 528 H390" strokeWidth="1.900"/></g>
    <rect x="0" y="536" width="390" height="40" fill="#c6b998"/>
    <path d="M44 536 H324 L340 550 H28 Z" fill="#2c2118" opacity=".2"/>
    <path d="M0 548 H390 M0 562 H390 M30 536 L18 576 M90 536 L82 576 M150 536 L146 576 M210 536 L210 576 M270 536 L274 576 M330 536 L338 576" stroke="#2c2118" strokeWidth=".7" opacity=".3" fill="none"/>
    <rect x="250" y="536" width="140" height="40" fill="url(#ha-v)" opacity=".22"/>
    <path d="M0 536 H390" stroke="#2c2118" strokeWidth="1.200" opacity=".7"/>
    <rect x="0" y="574" width="390" height="5" fill="#6a5d47"/>
    <rect x="0" y="579" width="390" height="181" fill="#5b4c3a"/><rect x="0" y="579" width="390" height="181" fill="url(#ha-bal)" opacity=".7"/>
    <rect x="0" y="579" width="390" height="9" fill="#1c140d" opacity=".5"/>
    <g fill="#2a2119"><rect x="10" y="596" width="10" height="62"/><rect x="50" y="596" width="10" height="62"/><rect x="90" y="596" width="10" height="62"/><rect x="130" y="596" width="10" height="62"/><rect x="170" y="596" width="10" height="62"/><rect x="210" y="596" width="10" height="62"/><rect x="250" y="596" width="10" height="62"/><rect x="290" y="596" width="10" height="62"/></g>
    <path d="M0 607 H318 M0 647 H318" stroke="#1c140d" strokeWidth="5.500"/><path d="M0 605.500 H318 M0 645.500 H318" stroke="#c9c2b0" strokeWidth="2.200"/>
    <g transform="translate(318 0)"><path d="M0 584 V664 M14 584 V664" stroke="#2a1d13" strokeWidth="6"/><rect x="-8" y="596" width="30" height="12" fill="#8f3a2e" stroke="#2a1d13" strokeWidth="1.600"/><rect x="-8" y="642" width="30" height="12" fill="#8f3a2e" stroke="#2a1d13" strokeWidth="1.600"/><path d="M14 590 L42 664 M14 650 L34 664" stroke="#2a1d13" strokeWidth="4"/></g>
    </g>
    </g>
    </svg>
  )
}
