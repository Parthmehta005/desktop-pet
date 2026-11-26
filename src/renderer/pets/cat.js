// Mochi: a round cream cat with a ginger patch over one ear. Original design.
import { definePet } from '../rig.js';

const C = {
  line: '#4a3b32',
  ink: '#2e2622',
  fur: '#fbebd3',
  patch: '#f2b880',
  belly: '#fff7ea',
  pink: '#f7a8b8',
  nose: '#e88b9a',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;
const tailPath = 'M128 168 C 162 168 174 140 162 110';

export default definePet({
  id: 'cat',
  name: 'Mochi',
  species: 'Cat',
  colors: C,
  anchors: {
    head: [100, 98],
    headSize: [46, 40],
    headTop: [100, 58],
    eyeL: [82, 99],
    eyeR: [118, 99],
    mouth: [100, 115],
    hands: [100, 168],
    sweat: [146, 78],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 134],
    pawL: [84, 160],
    pawR: [116, 160],
    footL: [82, 176],
    footR: [118, 176],
    tail: [128, 164],
    earL: [74, 70],
    earR: [126, 70],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="44" ry="6" fill="#000" opacity="0.16"/>',
    tail: [
      `<path d="${tailPath}" fill="none" stroke="${C.line}" stroke-width="15" stroke-linecap="round"/>`,
      `<path d="${tailPath}" fill="none" stroke="${C.fur}" stroke-width="9" stroke-linecap="round"/>`,
      `<path d="M166.5 124 C 166 118 164.5 114 162 110" fill="none" stroke="${C.patch}" stroke-width="9" stroke-linecap="round"/>`,
    ].join(''),
    footL: `<ellipse cx="82" cy="177" rx="14" ry="8" fill="${C.fur}" ${outline}/>`,
    footR: `<ellipse cx="118" cy="177" rx="14" ry="8" fill="${C.fur}" ${outline}/>`,
    body: [
      `<ellipse cx="100" cy="150" rx="40" ry="32" fill="${C.fur}" ${outline}/>`,
      `<ellipse cx="100" cy="158" rx="23" ry="19" fill="${C.belly}"/>`,
    ].join(''),
    earL: [
      `<path d="M63 84 L58 44 L93 64 Z" fill="${C.fur}" ${outline}/>`,
      `<path d="M67 75 L65 55 L84 66 Z" fill="${C.pink}"/>`,
    ].join(''),
    earR: [
      `<path d="M137 84 L142 44 L107 64 Z" fill="${C.patch}" ${outline}/>`,
      `<path d="M133 75 L135 55 L116 66 Z" fill="${C.pink}"/>`,
    ].join(''),
    head: [
      `<ellipse cx="100" cy="98" rx="46" ry="40" fill="${C.fur}"/>`,
      `<path d="M110 62 C 124 61 136 70 140 84 C 132 88 122 86 116 80 C 110 74 108 68 110 62 Z" fill="${C.patch}"/>`,
      `<ellipse cx="100" cy="98" rx="46" ry="40" fill="none" ${outline}/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="70" cy="113" rx="7" ry="4.5" fill="${C.pink}" opacity="0.6"/>`,
      `<ellipse cx="130" cy="113" rx="7" ry="4.5" fill="${C.pink}" opacity="0.6"/></g>`,
      `<path d="M95.5 106 L104.5 106 L100 111 Z" fill="${C.nose}" stroke="${C.line}" stroke-width="1.5" stroke-linejoin="round"/>`,
      `<g fill="none" stroke="${C.line}" stroke-width="1.8" stroke-linecap="round" opacity="0.55">`,
      '<path d="M62 108 L44 104"/><path d="M62 114 L44 116"/>',
      '<path d="M138 108 L156 104"/><path d="M138 114 L156 116"/></g>',
    ].join(''),
    pawL: [
      `<ellipse cx="80" cy="170" rx="11" ry="9" fill="${C.fur}" ${outline}/>`,
      `<path d="M77 173 v3.5 M83 173 v3.5" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"/>`,
    ].join(''),
    pawR: [
      `<ellipse cx="120" cy="170" rx="11" ry="9" fill="${C.fur}" ${outline}/>`,
      `<path d="M117 173 v3.5 M123 173 v3.5" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"/>`,
    ].join(''),
  },
  mouths: {
    // A little "ω" cat mouth.
    neutral: (c) => `<path d="M-7 -1 Q-3.5 4 0 -1 Q3.5 4 7 -1" fill="none" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
});
