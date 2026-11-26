// Pip: a small navy penguin with a heart-shaped white face and orange beak. Original design.
import { definePet } from '../rig.js';

const C = {
  line: '#1e2638',
  ink: '#1b1f2a',
  navy: '#34436b',
  white: '#fbfbf7',
  orange: '#f4a62a',
  blush: '#f7a8b8',
  mouth: '#c2413b',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;
const beakStroke = `stroke="${C.line}" stroke-width="1.8" stroke-linejoin="round"`;

export default definePet({
  id: 'penguin',
  name: 'Pip',
  species: 'Penguin',
  colors: C,
  anchors: {
    head: [100, 98],
    headSize: [42, 42],
    headTop: [100, 56],
    eyeL: [85, 96],
    eyeR: [115, 96],
    mouth: [100, 110],
    hands: [100, 168],
    sweat: [142, 78],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 136],
    pawL: [68, 134],
    pawR: [132, 134],
    footL: [82, 180],
    footR: [118, 180],
    tail: [136, 176],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="40" ry="6" fill="#000" opacity="0.16"/>',
    tail: `<path d="M132 170 L152 182 L134 183 Z" fill="${C.navy}" ${outline}/>`,
    footL: `<path d="M70 181 C 70 172 93 172 95 181 C 90 187 75 187 70 181 Z" fill="${C.orange}" ${outline}/>`,
    footR: `<path d="M105 181 C 107 172 130 172 130 181 C 125 187 110 187 105 181 Z" fill="${C.orange}" ${outline}/>`,
    body: [
      `<ellipse cx="100" cy="148" rx="40" ry="35" fill="${C.navy}" ${outline}/>`,
      `<ellipse cx="100" cy="153" rx="27" ry="27" fill="${C.white}"/>`,
    ].join(''),
    head: [
      // The head blends into the body: fill a circle, outline only its upper arc.
      `<circle cx="100" cy="98" r="42" fill="${C.navy}"/>`,
      `<path d="M58.5 106 A42 42 0 1 1 141.5 106" fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>`,
      `<path d="M100 84 C 92 70 66 74 66 98 C 66 118 84 128 100 128 C 116 128 134 118 134 98 C 134 74 108 70 100 84 Z" fill="${C.white}"/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="74" cy="110" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/>`,
      `<ellipse cx="126" cy="110" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/></g>`,
    ].join(''),
    pawL: `<path d="M66 132 C 52 146 52 166 62 174 C 70 162 74 148 72 134 Z" fill="${C.navy}" ${outline}/>`,
    pawR: `<path d="M134 132 C 148 146 148 166 138 174 C 130 162 126 148 128 134 Z" fill="${C.navy}" ${outline}/>`,
  },
  // The beak is the mouth.
  mouths: {
    neutral: (c) => `<path d="M-8 0 Q0 -6 8 0 Q0 7 -8 0 Z" fill="${c.orange}" ${beakStroke}/>`,
    flat: (c) => `<path d="M-8 0 Q0 -5 8 0 Q0 5 -8 0 Z" fill="${c.orange}" ${beakStroke}/>`,
    worried: (c) => `<path d="M-8 2 Q0 -5 8 -1 Q0 7 -8 2 Z" fill="${c.orange}" ${beakStroke}/>`,
    smile: (c) => `<path d="M-6 1 Q0 11 6 1 Z" fill="${c.mouth}" ${beakStroke}/><path d="M-9 -1 Q0 -8 9 -1 L0 3 Z" fill="${c.orange}" ${beakStroke}/>`,
    o: (c) => `<path d="M-6 2 Q0 13 6 2 Q0 5 -6 2 Z" fill="${c.orange}" ${beakStroke}/><path d="M-8 -2 Q0 -9 8 -2 L0 1 Z" fill="${c.orange}" ${beakStroke}/>`,
  },
});
