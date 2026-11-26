// Biscuit: an orange-and-white corgi with big ears and a fluffy tail. Original design.
import { definePet } from '../rig.js';

const C = {
  line: '#5a3a24',
  ink: '#2b1d14',
  fur: '#f0a35e',
  white: '#fff8ef',
  pink: '#f6a5b0',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;

export default definePet({
  id: 'corgi',
  name: 'Biscuit',
  species: 'Corgi',
  colors: C,
  anchors: {
    head: [100, 98],
    headSize: [46, 38],
    headTop: [100, 60],
    eyeL: [82, 96],
    eyeR: [118, 96],
    mouth: [100, 115],
    hands: [100, 168],
    sweat: [146, 80],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 134],
    pawL: [84, 160],
    pawR: [116, 160],
    footL: [82, 176],
    footR: [118, 176],
    tail: [136, 152],
    earL: [76, 68],
    earR: [124, 68],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="46" ry="6" fill="#000" opacity="0.16"/>',
    tail: [
      `<ellipse cx="146" cy="144" rx="12" ry="9" fill="${C.fur}" ${outline}/>`,
      `<ellipse cx="149" cy="142" rx="6" ry="4.5" fill="${C.white}"/>`,
    ].join(''),
    footL: `<ellipse cx="82" cy="178" rx="13" ry="7" fill="${C.white}" ${outline}/>`,
    footR: `<ellipse cx="118" cy="178" rx="13" ry="7" fill="${C.white}" ${outline}/>`,
    body: [
      `<ellipse cx="100" cy="152" rx="45" ry="29" fill="${C.fur}" ${outline}/>`,
      `<ellipse cx="100" cy="160" rx="26" ry="19" fill="${C.white}"/>`,
    ].join(''),
    earL: [
      `<path d="M64 82 C 50 60 52 36 64 30 C 76 34 88 54 91 66 Z" fill="${C.fur}" ${outline}/>`,
      `<path d="M67 73 C 59 59 60 45 66 40 C 73 45 80 57 83 64 Z" fill="${C.pink}"/>`,
    ].join(''),
    earR: [
      `<path d="M136 82 C 150 60 148 36 136 30 C 124 34 112 54 109 66 Z" fill="${C.fur}" ${outline}/>`,
      `<path d="M133 73 C 141 59 140 45 134 40 C 127 45 120 57 117 64 Z" fill="${C.pink}"/>`,
    ].join(''),
    head: [
      `<ellipse cx="100" cy="98" rx="46" ry="38" fill="${C.fur}"/>`,
      // White blaze down the forehead widening into the muzzle.
      `<path d="M100 61 C 95 72 92 84 88 95 C 81 108 84 124 100 127 C 116 124 119 108 112 95 C 108 84 105 72 100 61 Z" fill="${C.white}"/>`,
      `<ellipse cx="100" cy="98" rx="46" ry="38" fill="none" ${outline}/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="69" cy="111" rx="7" ry="4.5" fill="${C.pink}" opacity="0.6"/>`,
      `<ellipse cx="131" cy="111" rx="7" ry="4.5" fill="${C.pink}" opacity="0.6"/></g>`,
      `<ellipse cx="100" cy="106" rx="6.5" ry="4.8" fill="${C.ink}"/>`,
      '<ellipse cx="98" cy="104.5" rx="2" ry="1.2" fill="#fff" opacity="0.8"/>',
    ].join(''),
    pawL: `<ellipse cx="80" cy="170" rx="11" ry="9" fill="${C.white}" ${outline}/>`,
    pawR: `<ellipse cx="120" cy="170" rx="11" ry="9" fill="${C.white}" ${outline}/>`,
  },
  mouths: {
    neutral: (c) => `<path d="M-7 -2 Q-3.5 3 0 -1 Q3.5 3 7 -2" fill="none" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
});
