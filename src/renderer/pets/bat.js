// Mango: a fruit bat with a light green head and big ears, a dark green body, purple wings
// and one little fang. Original design.
import { definePet, DEFAULT_MOUTHS } from '../rig.js';

const C = {
  line: '#2b3a2a',
  ink: '#1c2418',
  head: '#a8dc7a',
  fur: '#3f8a4e',
  chest: '#5fa85f',
  muzzle: '#e6f6cf',
  wing: '#7b54b0',
  bone: '#a689d8',
  inner: '#d6c0f4',
  blush: '#f59ab8',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;
const thin = `stroke="${C.line}" stroke-width="2.5" stroke-linejoin="round"`;
const bones = (d) => `<path d="${d}" fill="none" stroke="${C.bone}" stroke-width="2" stroke-linecap="round"/>`;

// The fang shows when its mouth is closed.
const FANG = (c) => `<path d="M2.5 1.5 L 4.5 6.5 L 6.5 1.5 Z" fill="#fff" stroke="${c.ink}" stroke-width="1.2" stroke-linejoin="round"/>`;
const withFang = (variant) => (c) => DEFAULT_MOUTHS[variant](c) + FANG(c);

export default definePet({
  id: 'bat',
  name: 'Mango',
  species: 'Fruit bat',
  colors: C,
  anchors: {
    head: [100, 98],
    headSize: [40, 36],
    headTop: [100, 62],
    eyeL: [86, 98],
    eyeR: [114, 98],
    mouth: [100, 117],
    hands: [100, 168],
    sweat: [140, 80],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 132],
    pawL: [80, 150],
    pawR: [120, 150],
    footL: [90, 176],
    footR: [110, 176],
    // The wings fold in towards the middle of its back.
    tail: [100, 146],
    earL: [76, 78],
    earR: [124, 78],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="34" ry="6" fill="#000" opacity="0.16"/>',
    // The wings are drawn as the tail: spread behind the body, on the part that flutters.
    tail: [
      `<path d="M78 136 C 58 118 36 116 28 132 C 34 132 40 138 40 146 C 46 140 52 142 54 150 C 58 144 64 146 68 154 C 71 148 76 148 80 152 Z" fill="${C.wing}" ${outline}/>`,
      bones('M78 138 C 62 126 44 124 30 132 M60 128 L 40 146 M67 134 L 54 150 M73 140 L 68 154'),
      `<path d="M122 136 C 142 118 164 116 172 132 C 166 132 160 138 160 146 C 154 140 148 142 146 150 C 142 144 136 146 132 154 C 129 148 124 148 120 152 Z" fill="${C.wing}" ${outline}/>`,
      bones('M122 138 C 138 126 156 124 170 132 M140 128 L 160 146 M133 134 L 146 150 M127 140 L 132 154'),
    ].join(''),
    footL: `<path d="M84 180 C 84 172 96 172 96 180 C 94 184 86 184 84 180 Z" fill="${C.wing}" ${thin}/>`,
    footR: `<path d="M116 180 C 116 172 104 172 104 180 C 106 184 114 184 116 180 Z" fill="${C.wing}" ${thin}/>`,
    body: [
      `<ellipse cx="100" cy="152" rx="28" ry="28" fill="${C.fur}" ${outline}/>`,
      `<path d="M86 138 L 90 146 L 94 138 L 100 148 L 106 138 L 110 146 L 114 138 C 114 156 108 166 100 166 C 92 166 86 156 86 138 Z" fill="${C.chest}"/>`,
    ].join(''),
    earL: [
      `<path d="M76 86 C 56 82 44 62 48 44 C 50 37 57 35 63 39 C 78 49 90 62 92 74 Z" fill="${C.head}" ${outline}/>`,
      `<path d="M75 78 C 62 74 55 61 56 49 C 65 52 77 61 84 71 Z" fill="${C.inner}"/>`,
    ].join(''),
    earR: [
      `<path d="M124 86 C 144 82 156 62 152 44 C 150 37 143 35 137 39 C 122 49 110 62 108 74 Z" fill="${C.head}" ${outline}/>`,
      `<path d="M125 78 C 138 74 145 61 144 49 C 135 52 123 61 116 71 Z" fill="${C.inner}"/>`,
    ].join(''),
    head: [
      `<circle cx="100" cy="98" r="40" fill="${C.head}" ${outline}/>`,
      `<path d="M93 62 C 94 52 100 50 101 58 C 104 50 112 52 108 62" fill="${C.head}" ${thin}/>`,
      `<ellipse cx="100" cy="112" rx="17" ry="12" fill="${C.muzzle}"/>`,
      `<ellipse cx="100" cy="106" rx="5" ry="3.5" fill="${C.ink}"/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="76" cy="110" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/>`,
      `<ellipse cx="124" cy="110" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/></g>`,
    ].join(''),
    pawL: `<path d="M80 150 C 72 154 70 164 76 170 C 82 172 88 168 88 162 Z" fill="${C.wing}" ${outline}/>`,
    pawR: `<path d="M120 150 C 128 154 130 164 124 170 C 118 172 112 168 112 162 Z" fill="${C.wing}" ${outline}/>`,
  },
  mouths: {
    neutral: withFang('neutral'),
    flat: withFang('flat'),
    worried: withFang('worried'),
  },
});
