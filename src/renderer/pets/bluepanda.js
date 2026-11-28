// Maple: a sky-blue panda with a big bubbly ringed tail, a white face mask and deep blue
// socks. Original design.
import { definePet } from '../rig.js';

const C = {
  line: '#244563',
  ink: '#18283a',
  fur: '#7ec8f4',
  ring: '#d3edff',
  cream: '#fffaf2',
  dark: '#356a9c',
  nose: '#1f3550',
  blush: '#f7a1b5',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;

// The tail is a chain of bubbles from the tip to the base, alternating blue and light blue.
const TAIL = [
  [156, 92, 11, C.cream],
  [165, 108, 13, C.fur],
  [166, 126, 14, C.ring],
  [159, 143, 15, C.fur],
  [146, 156, 15, C.ring],
  [130, 164, 14, C.fur],
].map(([cx, cy, r, fill]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${outline}/>`).join('');

export default definePet({
  id: 'bluepanda',
  name: 'Maple',
  species: 'Blue panda',
  colors: C,
  anchors: {
    head: [100, 98],
    headSize: [48, 38],
    headTop: [100, 60],
    eyeL: [82, 100],
    eyeR: [118, 100],
    mouth: [100, 119],
    hands: [100, 168],
    sweat: [150, 78],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 134],
    pawL: [78, 142],
    pawR: [122, 142],
    footL: [84, 176],
    footR: [116, 176],
    tail: [126, 166],
    earL: [72, 80],
    earR: [128, 80],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="46" ry="6" fill="#000" opacity="0.16"/>',
    tail: TAIL,
    footL: `<ellipse cx="84" cy="179" rx="13" ry="7" fill="${C.dark}" ${outline}/>`,
    footR: `<ellipse cx="116" cy="179" rx="13" ry="7" fill="${C.dark}" ${outline}/>`,
    body: [
      `<ellipse cx="100" cy="152" rx="36" ry="29" fill="${C.fur}" ${outline}/>`,
      `<ellipse cx="100" cy="160" rx="21" ry="17" fill="${C.dark}"/>`,
    ].join(''),
    earL: [
      `<path d="M64 86 C 54 66 58 50 70 46 C 80 46 90 56 92 68 Z" fill="${C.fur}" ${outline}/>`,
      `<path d="M70 78 C 65 66 67 57 72 55 C 78 57 83 62 85 69 Z" fill="${C.cream}"/>`,
    ].join(''),
    earR: [
      `<path d="M136 86 C 146 66 142 50 130 46 C 120 46 110 56 108 68 Z" fill="${C.fur}" ${outline}/>`,
      `<path d="M130 78 C 135 66 133 57 128 55 C 122 57 117 62 115 69 Z" fill="${C.cream}"/>`,
    ].join(''),
    head: [
      `<ellipse cx="100" cy="98" rx="48" ry="38" fill="${C.fur}" ${outline}/>`,
      // The white mask over the cheeks and muzzle, and a white spot above each eye.
      `<path d="M66 106 C 68 126 86 134 100 134 C 114 134 132 126 134 106 C 124 114 112 111 100 113 C 88 111 76 114 66 106 Z" fill="${C.cream}"/>`,
      `<ellipse cx="80" cy="84" rx="7" ry="4.5" fill="${C.cream}"/>`,
      `<ellipse cx="120" cy="84" rx="7" ry="4.5" fill="${C.cream}"/>`,
      `<path d="M94 110 Q 100 106 106 110 Q 100 117 94 110 Z" fill="${C.nose}"/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="70" cy="112" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/>`,
      `<ellipse cx="130" cy="112" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/></g>`,
    ].join(''),
    pawL: `<path d="M74 138 C 64 150 66 166 78 170 C 86 172 90 164 86 156 C 84 150 82 144 74 138 Z" fill="${C.dark}" ${outline}/>`,
    pawR: `<path d="M126 138 C 136 150 134 166 122 170 C 114 172 110 164 114 156 C 116 150 118 144 126 138 Z" fill="${C.dark}" ${outline}/>`,
  },
});
