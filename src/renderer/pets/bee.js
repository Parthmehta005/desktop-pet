// Hum: a round fuzzy bumblebee with two stripes, antennae and glassy wings. Original design.
import { definePet } from '../rig.js';

const C = {
  line: '#3a2c24',
  ink: '#2a1f19',
  yellow: '#ffd04a',
  stripe: '#3d302a',
  wing: '#eef8ff',
  wingLine: '#7fa6c4',
  blush: '#ff9a86',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;
const thin = `stroke="${C.line}" stroke-width="2.5" stroke-linejoin="round"`;
const wing = (d) => `<path d="${d}" fill="${C.wing}" opacity="0.92" stroke="${C.wingLine}" stroke-width="2.2" stroke-linejoin="round"/>`;
const antenna = (d, [x, y]) => `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="5.5" fill="${C.stripe}"/>`;

export default definePet({
  id: 'bee',
  name: 'Hum',
  species: 'Bumblebee',
  colors: C,
  anchors: {
    head: [100, 92],
    headSize: [40, 38],
    headTop: [100, 54],
    eyeL: [86, 94],
    eyeR: [114, 94],
    mouth: [100, 109],
    hands: [100, 168],
    sweat: [140, 74],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 128],
    pawL: [78, 150],
    pawR: [122, 150],
    footL: [88, 176],
    footR: [112, 176],
    // The wings sit on its back and buzz from there.
    tail: [100, 132],
    earL: [88, 60],
    earR: [112, 60],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="36" ry="6" fill="#000" opacity="0.16"/>',
    // The wings are drawn as the tail: behind the body, on the part that buzzes.
    tail: [
      wing('M86 128 C 66 100 42 104 44 122 C 46 138 70 140 86 132 Z'),
      wing('M114 128 C 134 100 158 104 156 122 C 154 138 130 140 114 132 Z'),
      wing('M84 134 C 70 124 52 132 56 144 C 60 152 76 146 84 138 Z'),
      wing('M116 134 C 130 124 148 132 144 144 C 140 152 124 146 116 138 Z'),
    ].join(''),
    footL: `<ellipse cx="88" cy="180" rx="7" ry="5" fill="${C.stripe}" ${thin}/>`,
    footR: `<ellipse cx="112" cy="180" rx="7" ry="5" fill="${C.stripe}" ${thin}/>`,
    body: [
      `<ellipse cx="100" cy="150" rx="36" ry="31" fill="${C.yellow}"/>`,
      // Two stripes that follow the body's curve; the outline goes on top of them.
      `<path d="M67.6 136 L 132.4 136 Q 136 141 135.7 146 L 64.3 146 Q 64 141 67.6 136 Z" fill="${C.stripe}"/>`,
      `<path d="M65 157 L 135 157 Q 133 163 129.5 167 L 70.5 167 Q 67 163 65 157 Z" fill="${C.stripe}"/>`,
      `<ellipse cx="100" cy="150" rx="36" ry="31" fill="none" ${outline}/>`,
    ].join(''),
    earL: antenna('M90 60 C 86 46 80 40 72 38', [70, 37]),
    earR: antenna('M110 60 C 114 46 120 40 128 38', [130, 37]),
    head: [
      `<circle cx="100" cy="92" r="38" fill="${C.yellow}" ${outline}/>`,
      `<path d="M92 56 Q 96 46 100 55 Q 104 46 108 56" fill="${C.yellow}" ${thin}/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="76" cy="106" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/>`,
      `<ellipse cx="124" cy="106" rx="6" ry="4" fill="${C.blush}" opacity="0.65"/></g>`,
    ].join(''),
    pawL: `<ellipse cx="76" cy="160" rx="7" ry="10" fill="${C.stripe}" ${thin}/>`,
    pawR: `<ellipse cx="124" cy="160" rx="7" ry="10" fill="${C.stripe}" ${thin}/>`,
  },
});
