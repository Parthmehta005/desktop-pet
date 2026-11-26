// Bolt: a boxy little tin robot with a screen face, an antenna and a wind-up key. Original design.
import { definePet } from '../rig.js';

const C = {
  line: '#36404c',
  ink: '#7ff5ff', // the LED face colour
  metal: '#c9d3de',
  dark: '#5d6b7a',
  screen: '#263241',
  accent: '#ffb347',
  blush: '#ff8fb0',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;
const led = (w) => `fill="none" stroke="${C.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

export default definePet({
  id: 'robot',
  name: 'Bolt',
  species: 'Robot',
  colors: C,
  anchors: {
    head: [100, 97],
    headSize: [44, 35],
    headTop: [100, 60],
    eyeL: [86, 93],
    eyeR: [114, 93],
    mouth: [100, 109],
    hands: [100, 166],
    sweat: [148, 78],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 130],
    pawL: [84, 150],
    pawR: [116, 150],
    footL: [82, 178],
    footR: [118, 178],
    tail: [138, 150],
    earL: [52, 97],
    earR: [148, 97],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="40" ry="6" fill="#000" opacity="0.16"/>',
    // A wind-up key on its back.
    tail: [
      `<rect x="136" y="146" width="12" height="6" fill="${C.dark}" stroke="${C.line}" stroke-width="2"/>`,
      `<ellipse cx="153" cy="141" rx="6" ry="8" fill="${C.accent}" ${outline}/>`,
      `<ellipse cx="153" cy="157" rx="6" ry="8" fill="${C.accent}" ${outline}/>`,
    ].join(''),
    footL: `<rect x="70" y="172" width="25" height="12" rx="4" fill="${C.dark}" ${outline}/>`,
    footR: `<rect x="105" y="172" width="25" height="12" rx="4" fill="${C.dark}" ${outline}/>`,
    body: [
      `<rect x="62" y="126" width="76" height="50" rx="12" fill="${C.metal}" ${outline}/>`,
      `<rect x="82" y="138" width="36" height="22" rx="5" fill="${C.screen}" stroke="${C.line}" stroke-width="2"/>`,
      `<circle cx="91" cy="149" r="3" fill="${C.accent}"/><circle cx="100" cy="149" r="3" fill="#4cc38a"/><circle cx="109" cy="149" r="3" fill="#5aa9ff"/>`,
    ].join(''),
    earL: `<rect x="46" y="86" width="13" height="22" rx="4" fill="${C.dark}" ${outline}/>`,
    earR: `<rect x="141" y="86" width="13" height="22" rx="4" fill="${C.dark}" ${outline}/>`,
    head: [
      `<path d="M100 62 V46" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>`,
      `<g class="antenna-light"><circle cx="100" cy="42" r="6" fill="${C.accent}" stroke="${C.line}" stroke-width="2.5"/></g>`,
      `<rect x="56" y="62" width="88" height="70" rx="14" fill="${C.metal}" ${outline}/>`,
      `<rect x="66" y="74" width="68" height="46" rx="9" fill="${C.screen}" stroke="${C.line}" stroke-width="2"/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><rect x="69" y="104" width="9" height="4" rx="2" fill="${C.blush}" opacity="0.7"/>`,
      `<rect x="122" y="104" width="9" height="4" rx="2" fill="${C.blush}" opacity="0.7"/></g>`,
    ].join(''),
    pawL: `<circle cx="78" cy="166" r="9" fill="${C.dark}" ${outline}/>`,
    pawR: `<circle cx="122" cy="166" r="9" fill="${C.dark}" ${outline}/>`,
  },
  // LED face: glowing shapes on the dark screen.
  eyes: {
    open: (_s, c) => `<rect x="-5" y="-7" width="10" height="14" rx="3" fill="${c.ink}"/>`,
    happy: () => `<path d="M-6 3 L0 -4 L6 3" ${led(3.4)}/>`,
    closed: () => `<path d="M-6 1 H6" ${led(3.2)}/>`,
    sleepy: (_s, c) => `<rect x="-6" y="-1" width="12" height="6" rx="2" fill="${c.ink}"/>`,
    worried: (side, c) => `<rect x="-5" y="-5" width="10" height="11" rx="3" fill="${c.ink}"/><path d="M${6 * side} -9 L${-5 * side} -12" ${led(2.6)}/>`,
    wide: (_s, c) => `<rect x="-7.5" y="-7.5" width="15" height="15" rx="4" fill="none" stroke="${c.ink}" stroke-width="2.6"/><rect x="-2.5" y="-2.5" width="5" height="5" fill="${c.ink}"/>`,
    down: (_s, c) => `<rect x="-6" y="0" width="12" height="7" rx="2" fill="${c.ink}"/>`,
  },
  mouths: {
    neutral: (c) => `<rect x="-8" y="-1.5" width="16" height="3" rx="1.5" fill="${c.ink}"/>`,
    smile: () => `<path d="M-9 -2 Q0 7 9 -2" ${led(3)}/>`,
    worried: () => `<path d="M-9 1 L-4.5 -2 L0 1 L4.5 -2 L9 1" ${led(2.6)}/>`,
    o: (c) => `<rect x="-4" y="-4" width="8" height="8" rx="2" fill="none" stroke="${c.ink}" stroke-width="2.6"/>`,
    flat: (c) => `<rect x="-6" y="-1" width="12" height="2" rx="1" fill="${c.ink}"/>`,
  },
});
