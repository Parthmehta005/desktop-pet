// Nimbus: a squishy inflatable care-bot. Original design: pale lavender, a cloud-puff
// crest, mint ear pods, a dark visor with mint LED eyes, and a glowing heart on its chest.
import { definePet } from '../rig.js';

const C = {
  line: '#6b5aa6',
  ink: '#8ff7d0', // LED colour on the visor
  body: '#e6dcff',
  belly: '#f3eeff',
  mint: '#9ef0d2',
  visor: '#2d2a4a',
  heart: '#ff7aa8',
  heartLine: '#c2456f',
  blush: '#ffb3cf',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;
const led = (w) => `fill="none" stroke="${C.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

export default definePet({
  id: 'softbot',
  name: 'Nimbus',
  species: 'Soft care-bot',
  colors: C,
  anchors: {
    head: [100, 94],
    headSize: [40, 34],
    headTop: [100, 56],
    eyeL: [86, 92],
    eyeR: [114, 92],
    mouth: [100, 101],
    hands: [100, 166],
    sweat: [140, 74],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 126],
    pawL: [76, 146],
    pawR: [124, 146],
    footL: [84, 178],
    footR: [116, 178],
    earL: [58, 96],
    earR: [142, 96],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="44" ry="6" fill="#000" opacity="0.16"/>',
    footL: `<ellipse cx="84" cy="179" rx="13" ry="7" fill="${C.body}" ${outline}/>`,
    footR: `<ellipse cx="116" cy="179" rx="13" ry="7" fill="${C.body}" ${outline}/>`,
    body: [
      `<ellipse cx="100" cy="150" rx="44" ry="32" fill="${C.body}" ${outline}/>`,
      `<ellipse cx="100" cy="156" rx="28" ry="22" fill="${C.belly}"/>`,
      // Soft seams, like an inflatable.
      `<path d="M66 138 Q100 128 134 138" fill="none" stroke="${C.line}" stroke-width="2" stroke-linecap="round" opacity="0.25"/>`,
      `<path d="M62 162 Q100 172 138 162" fill="none" stroke="${C.line}" stroke-width="2" stroke-linecap="round" opacity="0.2"/>`,
      `<g class="heart-light"><circle cx="100" cy="150" r="13" fill="${C.heart}" opacity="0.22"/>`,
      `<path d="M100 159 C 90 152 88 144 94 141 C 97 140 99 141 100 143 C 101 141 103 140 106 141 C 112 144 110 152 100 159 Z" fill="${C.heart}" stroke="${C.heartLine}" stroke-width="1.5" stroke-linejoin="round"/></g>`,
    ].join(''),
    earL: `<ellipse cx="58" cy="96" rx="7" ry="11" fill="${C.mint}" ${outline}/>`,
    earR: `<ellipse cx="142" cy="96" rx="7" ry="11" fill="${C.mint}" ${outline}/>`,
    head: [
      // Cloud-puff crest.
      `<circle cx="87" cy="63" r="8" fill="${C.mint}" ${outline}/>`,
      `<circle cx="113" cy="63" r="8" fill="${C.mint}" ${outline}/>`,
      `<circle cx="100" cy="57" r="10" fill="${C.mint}" ${outline}/>`,
      `<ellipse cx="100" cy="94" rx="40" ry="34" fill="${C.body}" ${outline}/>`,
      `<rect x="66" y="79" width="68" height="29" rx="14.5" fill="${C.visor}" stroke="${C.line}" stroke-width="2"/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="74" cy="115" rx="6" ry="3.5" fill="${C.blush}" opacity="0.8"/>`,
      `<ellipse cx="126" cy="115" rx="6" ry="3.5" fill="${C.blush}" opacity="0.8"/></g>`,
    ].join(''),
    pawL: `<ellipse cx="72" cy="162" rx="10" ry="13" fill="${C.body}" ${outline}/>`,
    pawR: `<ellipse cx="128" cy="162" rx="10" ry="13" fill="${C.body}" ${outline}/>`,
  },
  // LED face on the visor.
  eyes: {
    open: (_s, c) => `<ellipse rx="4.5" ry="5.5" fill="${c.ink}"/>`,
    happy: () => `<path d="M-5.5 2 Q0 -5 5.5 2" ${led(3)}/>`,
    closed: () => `<path d="M-5.5 0 Q0 4 5.5 0" ${led(2.8)}/>`,
    sleepy: (_s, c) => `<path d="M-5 0 A5 4.5 0 0 0 5 0 Z" fill="${c.ink}"/>`,
    worried: (side, c) => `<ellipse rx="4" ry="5" fill="${c.ink}"/><path d="M${5.5 * side} -7.5 L${-4.5 * side} -10" ${led(2.2)}/>`,
    wide: (_s, c) => `<circle r="6.5" fill="none" stroke="${c.ink}" stroke-width="2.2"/><circle r="2.6" fill="${c.ink}"/>`,
    down: (_s, c) => `<path d="M-5 0 A5 5 0 0 0 5 0 Z" fill="${c.ink}"/>`,
  },
  mouths: {
    neutral: () => `<path d="M-5 -1 Q0 3 5 -1" ${led(2.2)}/>`,
    smile: () => `<path d="M-7 -2 Q0 5 7 -2" ${led(2.6)}/>`,
    worried: () => `<path d="M-6 0.5 Q-3 -2 0 0.5 Q3 3 6 0.5" ${led(2.2)}/>`,
    o: () => `<circle r="3" ${led(2.2)}/>`,
    flat: () => `<path d="M-4.5 0 H4.5" ${led(2.2)}/>`,
  },
});
