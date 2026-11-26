// Axo: a pink axolotl with feathery gills and a finned tail. Original design.
import { definePet } from '../rig.js';

const C = {
  line: '#8a3d58',
  ink: '#3a1d2a',
  skin: '#f9b6c8',
  belly: '#fde3ea',
  gill: '#ff7aa2',
  blush: '#ff8fb0',
};
const outline = `stroke="${C.line}" stroke-width="3" stroke-linejoin="round"`;

/** A gill frond: a thick rounded stroke with an outline, from (x1,y1) to (x2,y2). */
function frond(x1, y1, cx, cy, x2, y2) {
  const d = `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
  return `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="11" stroke-linecap="round"/>`
    + `<path d="${d}" fill="none" stroke="${C.gill}" stroke-width="6" stroke-linecap="round"/>`;
}

export default definePet({
  id: 'axolotl',
  name: 'Axo',
  species: 'Axolotl',
  colors: C,
  anchors: {
    head: [100, 100],
    headSize: [50, 36],
    headTop: [100, 64],
    eyeL: [78, 98],
    eyeR: [122, 98],
    mouth: [100, 113],
    hands: [100, 168],
    sweat: [150, 84],
  },
  pivots: {
    rig: [100, 184],
    body: [100, 182],
    head: [100, 134],
    pawL: [84, 158],
    pawR: [116, 158],
    footL: [82, 176],
    footR: [118, 176],
    tail: [126, 166],
    earL: [60, 100],
    earR: [140, 100],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="44" ry="6" fill="#000" opacity="0.16"/>',
    tail: [
      `<path d="M124 158 C 148 160 168 150 178 132 C 174 158 154 176 124 174 Z" fill="${C.skin}" ${outline}/>`,
      `<path d="M134 166 C 152 166 164 156 172 144" fill="none" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>`,
    ].join(''),
    footL: `<ellipse cx="82" cy="178" rx="12" ry="7" fill="${C.skin}" ${outline}/>`,
    footR: `<ellipse cx="118" cy="178" rx="12" ry="7" fill="${C.skin}" ${outline}/>`,
    body: [
      `<ellipse cx="100" cy="154" rx="35" ry="28" fill="${C.skin}" ${outline}/>`,
      `<ellipse cx="100" cy="160" rx="22" ry="18" fill="${C.belly}"/>`,
    ].join(''),
    earL: [
      frond(60, 90, 46, 80, 38, 66),
      frond(56, 100, 40, 100, 30, 94),
      frond(60, 110, 46, 120, 40, 130),
    ].join(''),
    earR: [
      frond(140, 90, 154, 80, 162, 66),
      frond(144, 100, 160, 100, 170, 94),
      frond(140, 110, 154, 120, 160, 130),
    ].join(''),
    head: [
      `<ellipse cx="100" cy="100" rx="50" ry="36" fill="${C.skin}" ${outline}/>`,
      `<ellipse cx="100" cy="116" rx="26" ry="10" fill="${C.belly}" opacity="0.7"/>`,
    ].join(''),
    faceExtras: [
      `<g class="blush"><ellipse cx="66" cy="110" rx="7" ry="4.5" fill="${C.blush}" opacity="0.6"/>`,
      `<ellipse cx="134" cy="110" rx="7" ry="4.5" fill="${C.blush}" opacity="0.6"/></g>`,
    ].join(''),
    pawL: `<ellipse cx="80" cy="169" rx="10" ry="8" fill="${C.skin}" ${outline}/>`,
    pawR: `<ellipse cx="120" cy="169" rx="10" ry="8" fill="${C.skin}" ${outline}/>`,
  },
  eyes: {
    // Small, wide-set dot eyes.
    open: (_side, c) => `<circle r="4.5" fill="${c.ink}"/><circle cx="1.4" cy="-1.6" r="1.5" fill="#fff"/>`,
  },
  mouths: {
    // A wide, easy-going smile.
    neutral: (c) => `<path d="M-12 -3 Q0 6 12 -3" fill="none" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
});
